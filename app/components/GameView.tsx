"use client";
// 54-0 게임 화면 (규칙·점수는 lib/game.ts — 여기서는 계산하지 않고 부르기만).
// 순서: 주전 다섯 칸(가드 2·포워드 2·센터 1) → 슬롯머신 두 대(왼쪽 시즌 구간 · 오른쪽 팀, 버튼 하나로 같이 돌고 왼쪽이 먼저 멈춤)
//   → 그 팀 후보 중 한 명 고르기(그 구간 평균 기록, 득점순 — 등급·점수는 안 보임) → 다섯 번 → 농구 코트 위 5명 + 54경기 결과·기록.
// 결과는 주소 ?l= 로 남겨 링크로 공유, 이미지 저장은 공식 사진 없는 사본(useCardSave).
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  canPick, decodeLineupParam, emptyLineup, encodeLineupParam, foreignCount, GAME_FOREIGN_MAX, GAME_ROUNDS, GAME_SEASON_GAMES,
  GAME_SLOTS, isLineupFull, lineupTotals, openSlotsFor, pickBlockReason, placePick, respinEra, respinTeam, resultVerdict,
  simulateSeason, SLOT_LABELS, sortCandidates, spin, teamOf, type GameCandidate, type GamePool, type GameTeam, type Lineup,
  type SeasonResult, type Spin,
} from "@/lib/game";
import { RADAR_AXES, RADAR_AXIS_LABELS } from "@/lib/metrics";
import { playerHref } from "@/lib/cardview";
import { positionLabel } from "@/lib/roster";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import { teamShortLabel } from "@/lib/images";
import InfoLink from "./InfoLink";
import PlayerAvatar from "./PlayerAvatar";
import Skeleton from "./Skeleton";
import TeamLogo from "./TeamLogo";
import { useCardSave } from "./useCardSave";
import { trackEvent } from "./Analytics";
import { useThemeColors, type ThemeColors } from "./useThemeColors";

/** 처음 보여 줄 후보 수 (나머지는 "더 보기") */
const CANDIDATES_VISIBLE = 8;
/** 릴이 멈추는 시각 (ms) — 왼쪽(시즌)이 먼저, 오른쪽(팀)이 나중. 동작 줄이기 설정이면 바로 멈춘다 */
const ERA_STOP_MS = 800;
const TEAM_STOP_MS = 1300;
const TICK_MS = 70;

/** 기록 다섯 개 (후보 줄·결과 표 공용) */
const STAT_COLS = [
  { key: "ppg", label: "득점" },
  { key: "rpg", label: "리바" },
  { key: "apg", label: "어시" },
  { key: "spg", label: "스틸" },
  { key: "bpg", label: "블록" },
] as const;

/** 뽑은 선수 + 그 팀 (칸·결과 그림용) */
interface Picked {
  c: GameCandidate;
  team: GameTeam;
}

export default function GameView() {
  const colors = useThemeColors();
  const [pool, setPool] = useState<GamePool | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [lineup, setLineup] = useState<Lineup>(emptyLineup);
  const [teams, setTeams] = useState<(GameTeam | null)[]>(() => GAME_SLOTS.map(() => null));
  /** 정해진 슬롯 (릴이 다 멈춘 뒤) */
  const [current, setCurrent] = useState<Spin | null>(null);
  /** 릴에 지금 보이는 값 — 왼쪽 시즌 구간, 오른쪽 팀 */
  const [reelEra, setReelEra] = useState<number | null>(null);
  const [reelTeam, setReelTeam] = useState<Spin | null>(null);
  const [eraSpinning, setEraSpinning] = useState(false);
  const [teamSpinning, setTeamSpinning] = useState(false);
  const [tick, setTick] = useState(0);
  const [teamSkip, setTeamSkip] = useState(true);
  const [eraSkip, setEraSkip] = useState(true);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [shared, setShared] = useState<Picked[] | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/game/pool.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((p: GamePool) => {
        if (!alive) return;
        setPool(p);
        // 공유 주소로 들어오면 그 라인업 결과를 바로
        const players = decodeLineupParam(p, new URLSearchParams(window.location.search).get("l"));
        if (players) setShared(players.map((c) => ({ c, team: findTeam(p, c) })));
      })
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  const full = isLineupFull(lineup);
  const picked: Picked[] | null = useMemo(() => {
    if (shared) return shared;
    if (!full) return null;
    return lineup.map((c, i) => ({ c: c!, team: teams[i]! }));
  }, [shared, full, lineup, teams]);
  const result = useMemo(() => (picked ? simulateSeason(picked.map((p) => p.c)) : null), [picked]);

  // 직접 완성한 판만 센다(공유 링크로 본 결과는 빼고)
  useEffect(() => {
    if (result && !shared) trackEvent("game_complete", { wins: result.wins });
  }, [result, shared]);

  // 결과가 나오면 주소에 라인업을 남긴다 (링크 공유)
  useEffect(() => {
    if (full && !shared) window.history.replaceState(null, "", `${window.location.pathname}?l=${encodeLineupParam(lineup)}`);
  }, [full, shared, lineup]);

  const spinning = eraSpinning || teamSpinning;

  /**
   * 릴 돌리기. 결과(next)는 이미 정해져 있고 화면은 보여 주기용으로 아무 값이나 번갈아 보이다가 멈춘다.
   * reels 에서 true 인 릴만 돈다: 처음 돌리기는 둘 다(왼쪽이 먼저 멈춤), 시대 다시는 왼쪽만, 팀 다시는 오른쪽만.
   */
  function animateTo(next: Spin | null, reels: { era: boolean; team: boolean }) {
    if (!pool || !next) return;
    setChoosing(null);
    setShowAll(false);
    setCurrent(null);
    if (timer.current) window.clearInterval(timer.current);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || (!reels.era && !reels.team)) {
      setReelEra(next.era);
      setReelTeam(next);
      setCurrent(next);
      return;
    }
    // 안 도는 릴은 바로 결과 값으로 (팀 다시: 시즌 그대로 / 시대 다시: 같은 팀의 그 시대 로고·이름)
    if (!reels.era) setReelEra(next.era);
    if (!reels.team) setReelTeam(next);
    setEraSpinning(reels.era);
    setTeamSpinning(reels.team);
    // 둘 다 돌면 왼쪽 먼저·오른쪽 나중, 하나만 돌면 짧게
    const eraStop = reels.era ? ERA_STOP_MS : 0;
    const teamStop = reels.team ? (reels.era ? TEAM_STOP_MS : ERA_STOP_MS) : 0;
    const start = performance.now();
    let eraDone = !reels.era;
    let teamDone = !reels.team;
    timer.current = window.setInterval(() => {
      const t = performance.now() - start;
      setTick((k) => k + 1);
      if (!eraDone) {
        if (t >= eraStop) {
          eraDone = true;
          setReelEra(next.era);
          setEraSpinning(false);
        } else setReelEra(Math.floor(Math.random() * pool.eras.length));
      }
      if (!teamDone) {
        if (t >= teamStop) {
          teamDone = true;
          setReelTeam(next);
          setTeamSpinning(false);
        } else {
          const era = pool.eras[Math.floor(Math.random() * pool.eras.length)];
          setReelTeam({ era: era.index, teamCode: era.teams[Math.floor(Math.random() * era.teams.length)].teamCode });
        }
      }
      if (eraDone && teamDone) {
        window.clearInterval(timer.current!);
        timer.current = null;
        setCurrent(next);
      }
    }, TICK_MS);
  }

  function doSpin() {
    trackEvent("game_spin");
    if (pool) animateTo(spin(pool, lineup, Math.random), { era: true, team: true });
  }

  function doRespinTeam() {
    if (!pool || !current) return;
    const next = respinTeam(pool, current, lineup, Math.random);
    if (!next) return;
    setTeamSkip(false);
    animateTo(next, { era: false, team: true });
  }

  function doRespinEra() {
    if (!pool || !current) return;
    const next = respinEra(pool, current, lineup, Math.random);
    if (!next) return;
    setEraSkip(false);
    // 팀은 그대로 두고 왼쪽 릴만 — 같은 팀이 다른 시대에 없어 팀도 바뀌는 드문 경우만 오른쪽도 돈다
    animateTo(next, { era: true, team: next.teamCode !== current.teamCode });
  }

  function place(c: GameCandidate, slot: number) {
    if (!pool || !current) return;
    const team = teamOf(pool, current)!;
    setLineup((l) => placePick(l, slot, c));
    setTeams((t) => t.map((x, i) => (i === slot ? team : x)));
    setCurrent(null);
    setChoosing(null);
  }

  function choose(c: GameCandidate) {
    const slots = openSlotsFor(lineup, c);
    if (slots.length === 0) return;
    // 같은 묶음 칸만 남았으면(가드 둘 등) 바로, 다른 묶음 칸 중 고를 수 있으면(GF·FC) 칸을 묻는다
    if (new Set(slots.map((s) => GAME_SLOTS[s])).size === 1) place(c, slots[0]);
    else setChoosing(choosing === c.id ? null : c.id);
  }

  function restart() {
    if (timer.current) window.clearInterval(timer.current);
    setLineup(emptyLineup());
    setTeams(GAME_SLOTS.map(() => null));
    setCurrent(null);
    setReelEra(null);
    setReelTeam(null);
    setEraSpinning(false);
    setTeamSpinning(false);
    setTeamSkip(true);
    setEraSkip(true);
    setChoosing(null);
    setShared(null);
    setCopied(false);
    window.history.replaceState(null, "", window.location.pathname);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      trackEvent("game_share_link");
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const round = lineup.filter(Boolean).length;
  const eraLabel = pool && reelEra !== null ? pool.eras[reelEra]?.label ?? null : null;
  const reelTeamObj = pool && reelTeam ? teamOf(pool, reelTeam) : null;
  const currentTeam = pool && current ? teamOf(pool, current) : null;

  return (
    <main className="mx-auto max-w-3xl px-4 pt-5">
      <header className="mb-4">
        <h1 className="flex items-center gap-1 text-h1 font-bold">
          54-0 <InfoLink term="game54" className="ml-1" />
        </h1>
        <p className="mt-0.5 text-sub text-ink-2">시대와 팀을 뽑아 역대 주전 5명을 꾸리고 54전 전승에 도전하세요.</p>
      </header>

      {loadError ? (
        <p className="surface-card rounded-container px-4 py-8 text-center text-body text-ink-2">선수 목록을 불러오지 못했습니다. 새로고침해 주세요.</p>
      ) : !pool ? (
        <div className="space-y-3" aria-busy="true" aria-label="불러오는 중">
          <Skeleton className="h-28 rounded-container" />
          <Skeleton className="h-40 rounded-container" />
        </div>
      ) : picked && result ? (
        <ResultView picked={picked} result={result} colors={colors} shared={!!shared} copied={copied} onCopy={copyLink} onRestart={restart} />
      ) : (
        <>
          <LineupBoard lineup={lineup} teams={teams} />
          <p className="tabular mt-2 text-sub text-ink-2">
            라운드 {Math.min(round + 1, GAME_ROUNDS)}/{GAME_ROUNDS} · 외국 선수 {foreignCount(lineup)}/{GAME_FOREIGN_MAX}
          </p>

          <section aria-label="슬롯머신" className="surface-card mt-4 rounded-container p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-2 sm:gap-3" aria-live="polite" aria-busy={spinning}>
              <SlotReel title="시즌" spinning={eraSpinning} tick={tick}>
                {eraLabel ? (
                  // deslop-ignore-next-line 11
                  <span className="tabular text-[34px] leading-none font-black tracking-tight text-ink sm:text-[44px]">{eraLabel}</span>
                ) : (
                  <ReelBlank />
                )}
              </SlotReel>
              <SlotReel title="팀" spinning={teamSpinning} tick={tick}>
                {reelTeamObj ? (
                  <span className="flex min-w-0 flex-col items-center gap-1.5">
                    <TeamLogo logoUrl={reelTeamObj.logoUrl} shortName={reelTeamObj.name} color={reelTeamObj.color} size={48} />
                    <span className="max-w-full truncate text-body font-bold text-ink sm:text-h2">{reelTeamObj.name}</span>
                  </span>
                ) : (
                  <ReelBlank />
                )}
              </SlotReel>
            </div>
            {!current && !spinning && (
              <button
                type="button"
                onClick={doSpin}
                className="focus-ring mt-3 h-12 w-full cursor-pointer rounded-control bg-ink text-body font-bold text-surface transition-colors duration-200 hover:bg-ink-2"
              >
                슬롯 돌리기
              </button>
            )}
            {(current || spinning) && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <SkipButton label="시대 다시" left={eraSkip} disabled={spinning} onClick={doRespinEra} />
                <SkipButton label="팀 다시" left={teamSkip} disabled={spinning} onClick={doRespinTeam} />
              </div>
            )}
          </section>

          {current && currentTeam && !spinning && (
            <CandidateList
              team={currentTeam}
              lineup={lineup}
              choosing={choosing}
              showAll={showAll}
              onShowAll={() => setShowAll(true)}
              onChoose={choose}
              onPlace={place}
            />
          )}
        </>
      )}
    </main>
  );
}

function findTeam(pool: GamePool, c: GameCandidate): GameTeam {
  for (const e of pool.eras) for (const t of e.teams) if (t.candidates.includes(c)) return t;
  return { teamCode: "", name: "", logoUrl: null, color: FALLBACK_TEAM_COLOR, candidates: [] };
}

/** 슬롯머신 한 대: 이름표 + 창. 도는 동안 값이 바뀔 때마다 위에서 내려오고, 멈추면 한 번 튕긴다 */
function SlotReel({ title, spinning, tick, children }: { title: string; spinning: boolean; tick: number; children: React.ReactNode }) {
  const [stopKey, setStopKey] = useState(0);
  const was = useRef(spinning);
  useEffect(() => {
    if (was.current && !spinning) setStopKey((k) => k + 1);
    was.current = spinning;
  }, [spinning]);
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-center text-caption font-bold text-ink-2">{title}</span>
      <div className="mt-1 flex h-32 items-center justify-center overflow-hidden rounded-card border-2 border-ink bg-surface-2 px-2 sm:h-36">
        <span key={spinning ? `t${tick}` : `s${stopKey}`} className={`flex min-w-0 justify-center ${spinning ? "reel-tick" : "reel-stop"}`}>
          {children}
        </span>
      </div>
    </div>
  );
}

function ReelBlank() {
  // deslop-ignore-next-line 11
  return <span className="text-[40px] leading-none font-black text-ink-3">?</span>;
}

function SkipButton({ label, left, disabled, onClick }: { label: string; left: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={!left || disabled}
      onClick={onClick}
      className="focus-ring h-11 cursor-pointer rounded-control border border-line bg-surface text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-surface"
    >
      {label} <span className="tabular text-sub font-medium text-ink-3">{left ? "1번 남음" : "씀"}</span>
    </button>
  );
}

/** 주전 다섯 칸 (등급·점수 없이 사진·이름·구간만) */
function LineupBoard({ lineup, teams }: { lineup: Lineup; teams: (GameTeam | null)[] }) {
  return (
    <ol aria-label="주전 라인업" className="grid grid-cols-5 gap-1.5 sm:gap-2">
      {GAME_SLOTS.map((g, i) => {
        const c = lineup[i];
        const team = teams[i];
        return (
          <li
            key={i}
            className={`flex min-w-0 flex-col items-center rounded-card px-1 py-2 text-center ${c ? "surface-card" : "border border-dashed border-line"}`}
          >
            <span className="text-caption font-semibold text-ink-3">{SLOT_LABELS[g]}</span>
            {c && team ? (
              <>
                <PlayerAvatar photoUrl={c.photoUrl} nameKo={c.nameKo} color={team.color} size={44} className="mt-1" />
                <span className="mt-1 w-full truncate text-caption font-bold text-ink">{c.nameKo}</span>
                <span className="tabular w-full truncate text-caption text-ink-3">{c.span}</span>
              </>
            ) : (
              // 빈 아바타 자리 (원형은 아바타 모양이라 허용)
              // deslop-ignore-next-line 19
              <span className="mt-1 flex size-11 items-center justify-center rounded-full bg-surface-2 text-caption text-ink-3">{g}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** 기록 다섯 칸 (이름표 + 숫자) */
function StatStrip({ c, dim = false }: { c: Pick<GameCandidate, "ppg" | "rpg" | "apg" | "spg" | "bpg">; dim?: boolean }) {
  return (
    <span className="tabular grid grid-cols-5 gap-1 text-center">
      {STAT_COLS.map((s) => (
        <span key={s.key} className="flex flex-col">
          <span className="text-caption text-ink-3">{s.label}</span>
          <span className={`text-body font-bold ${dim ? "text-ink-3" : "text-ink"}`}>{c[s.key].toFixed(1)}</span>
        </span>
      ))}
    </span>
  );
}

interface ListProps {
  team: GameTeam;
  lineup: Lineup;
  choosing: string | null;
  showAll: boolean;
  onShowAll: () => void;
  onChoose: (c: GameCandidate) => void;
  onPlace: (c: GameCandidate, slot: number) => void;
}

/** 그 팀·그 구간 후보: 고를 수 있는 선수 먼저(그 구간 경기당 득점 순), 못 고르는 선수는 흐리게 + 까닭. 등급·점수는 보이지 않는다 */
function CandidateList({ team, lineup, choosing, showAll, onShowAll, onChoose, onPlace }: ListProps) {
  const sorted = sortCandidates(team.candidates);
  const ordered = [...sorted.filter((c) => canPick(lineup, c)), ...sorted.filter((c) => !canPick(lineup, c))];
  const visible = showAll ? ordered : ordered.slice(0, CANDIDATES_VISIBLE);
  return (
    <section aria-labelledby="cand-title" className="mt-4">
      <h2 id="cand-title" className="text-h2 font-bold">
        한 명을 고르세요 <span className="text-sub font-medium text-ink-3">{team.candidates.length}명 · 그 시대 경기당 평균</span>
      </h2>
      <ul className="surface-card mt-2 divide-y divide-line rounded-container">
        {visible.map((c) => {
          const reason = pickBlockReason(lineup, c);
          const slots = openSlotsFor(lineup, c);
          const pos = positionLabel(c.position);
          return (
            <li key={`${c.id}:${c.seasonCode}`}>
              <button
                type="button"
                disabled={!!reason}
                onClick={() => onChoose(c)}
                aria-expanded={slots.length > 1 ? choosing === c.id : undefined}
                className="focus-ring-inset flex w-full cursor-pointer flex-col gap-2 px-3 py-2.5 text-left transition-colors duration-200 hover:bg-surface-2 disabled:cursor-not-allowed disabled:hover:bg-transparent sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <PlayerAvatar photoUrl={c.photoUrl} nameKo={c.nameKo} color={team.color} size={40} className={reason ? "opacity-40" : ""} />
                  <span className="min-w-0 flex-1">
                    <span className={`flex items-center gap-1.5 text-body font-bold ${reason ? "text-ink-3" : "text-ink"}`}>
                      <span className="truncate">{c.nameKo}</span>
                      {c.foreign && <span className="shrink-0 rounded-control border border-line px-1 text-caption font-semibold text-ink-2">외국</span>}
                    </span>
                    <span className="tabular block truncate text-caption text-ink-2">
                      {reason ?? `${pos ?? ""} · ${c.span}${c.seasonCount > 1 ? ` · ${c.seasonCount}시즌` : ""}`}
                    </span>
                  </span>
                </span>
                <span className="w-full sm:w-64 sm:shrink-0">
                  <StatStrip c={c} dim={!!reason} />
                </span>
              </button>
              {choosing === c.id && (
                <div className="flex gap-2 px-3 pb-3">
                  {[...new Set(slots.map((s) => GAME_SLOTS[s]))].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => onPlace(c, slots.find((s) => GAME_SLOTS[s] === g)!)}
                      className="focus-ring h-10 flex-1 cursor-pointer rounded-control bg-ink text-sub font-bold text-surface transition-colors duration-200 hover:bg-ink-2"
                    >
                      {SLOT_LABELS[g]} 칸에
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!showAll && ordered.length > CANDIDATES_VISIBLE && (
        <button
          type="button"
          onClick={onShowAll}
          className="focus-ring mt-2 h-11 w-full cursor-pointer rounded-control border border-line bg-surface text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
        >
          더 보기 ({ordered.length - CANDIDATES_VISIBLE}명)
        </button>
      )}
    </section>
  );
}

interface ResultProps {
  picked: Picked[];
  result: SeasonResult;
  colors: ThemeColors;
  shared: boolean;
  copied: boolean;
  onCopy: () => void;
  onRestart: () => void;
}

function ResultView({ picked, result, colors, shared, copied, onCopy, onRestart }: ResultProps) {
  const { exportRef, saving, saveError, save } = useCardSave(colors.surface);
  return (
    <section aria-label="시즌 결과">
      <ResultCard picked={picked} result={result} colors={colors} official />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={onRestart}
          className="focus-ring col-span-2 h-11 cursor-pointer rounded-control bg-ink text-body font-bold text-surface transition-colors duration-200 hover:bg-ink-2 sm:col-span-1"
        >
          {shared ? "나도 해 보기" : "다시 하기"}
        </button>
        <button
          type="button"
          onClick={() => save(`54-0-${result.wins}-${result.losses}.png`)}
          disabled={saving}
          className="focus-ring h-11 cursor-pointer rounded-control border border-line bg-surface text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
        >
          {saving ? "저장 중…" : "이미지 저장"}
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="focus-ring h-11 cursor-pointer rounded-control border border-line bg-surface text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
        >
          {copied ? "복사됨" : "링크 복사"}
        </button>
      </div>
      {saveError && <p className="mt-2 text-sub text-ink-2">{saveError}</p>}
      {saving && (
        <div aria-hidden className="pointer-events-none fixed top-0" style={{ left: -10000 }}>
          <div ref={exportRef} className="w-[440px] bg-surface p-3">
            <ResultCard picked={picked} result={result} colors={colors} official={false} />
          </div>
        </div>
      )}
    </section>
  );
}

/** 코트 위 자리 (가로·세로 %, 바스켓은 아래 가운데). 칸 순서 = GAME_SLOTS (가드·가드·포워드·포워드·센터) */
const COURT_SPOTS: readonly { x: number; y: number }[] = [
  { x: 50, y: 15 }, // 가드: 탑
  { x: 17, y: 41 }, // 가드: 왼쪽 윙
  { x: 83, y: 41 }, // 포워드: 오른쪽 윙
  { x: 19, y: 75 }, // 포워드: 왼쪽 로우
  { x: 63, y: 79 }, // 센터: 골밑
];

/** FIBA 하프코트 15m × 14m. 미터 단위 viewBox, 바스켓이 아래 */
function CourtLines() {
  const W = 15;
  const H = 14;
  const rimY = H - 1.575;
  // 3점: 바스켓에서 6.75m 호 + 사이드 0.9m 안쪽 직선 (직선이 호와 만나는 높이)
  const cx = W / 2;
  const sideX = 0.9;
  const dy = Math.sqrt(6.75 ** 2 - (cx - sideX) ** 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
      <g fill="none" stroke="var(--ink-3)" strokeWidth={0.06}>
        <rect x={0.03} y={0.03} width={W - 0.06} height={H - 0.06} />
        {/* 페인트 4.9 × 5.8, 자유투 원 r1.8 */}
        <rect x={cx - 2.45} y={H - 5.8} width={4.9} height={5.8} />
        <circle cx={cx} cy={H - 5.8} r={1.8} />
        {/* 3점 라인 */}
        <path d={`M ${sideX} ${H} L ${sideX} ${rimY - dy} A 6.75 6.75 0 0 1 ${W - sideX} ${rimY - dy} L ${W - sideX} ${H}`} />
        {/* 백보드·림 */}
        <line x1={cx - 0.9} y1={H - 1.2} x2={cx + 0.9} y2={H - 1.2} strokeWidth={0.1} />
        <circle cx={cx} cy={rimY} r={0.225} />
        {/* 하프라인 쪽 센터 원 반쪽 */}
        <path d={`M ${cx - 1.8} 0 A 1.8 1.8 0 0 0 ${cx + 1.8} 0`} />
      </g>
    </svg>
  );
}

/** 결과 카드 (화면·저장 이미지 공용). official=false 면 공식 사진·로고 없이 대체 디자인만 */
function ResultCard({ picked, result, colors, official }: { picked: Picked[]; result: SeasonResult; colors: ThemeColors; official: boolean }) {
  const mvp = picked.reduce((b, p) => (p.c.score > b.c.score || (p.c.score === b.c.score && p.c.ppg > b.c.ppg) ? p : b), picked[0]);
  const perfect = result.wins === GAME_SEASON_GAMES;
  const totals = lineupTotals(picked.map((p) => p.c));
  return (
    <div className="surface-card rounded-container p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sub font-semibold text-ink-2">54-0 · KBL 역대 라인업</p>
          <p className="tabular mt-1 flex items-baseline gap-2">
            {/* deslop-ignore-next-line 11 */}
            <span className="text-[56px] leading-none font-black tracking-tight text-ink">
              {result.wins}-{result.losses}
            </span>
            {perfect && (
              <span className="rounded-control px-1.5 py-0.5 text-sub font-bold" style={{ background: colors.gradeS, color: colors.gradeSInk }}>
                전승
              </span>
            )}
          </p>
          <p className="mt-1 text-body font-semibold text-ink">{resultVerdict(result.wins)}</p>
        </div>
        <p className="tabular shrink-0 text-right text-caption text-ink-3">
          최다 {result.longestStreak}연승
          <br />팀 전력 {result.rating.rating.toFixed(1)}
        </p>
      </div>

      {/* 코트 위 다섯 명 */}
      <div className="relative mt-4 aspect-[15/14] w-full overflow-hidden rounded-card bg-surface-2">
        <CourtLines />
        {picked.map((p, i) => {
          const spot = COURT_SPOTS[i];
          return (
            <div
              key={p.c.id}
              className="absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
            >
              <PlayerAvatar photoUrl={p.c.photoUrl} nameKo={p.c.nameKo} color={p.team.color} size={56} official={official} />
              <span className="mt-0.5 flex max-w-full flex-col rounded-control bg-surface px-1.5 py-0.5">
                <span className="truncate text-caption font-bold text-ink">
                  {p.c.nameKo}
                  {p === mvp ? " · MVP" : ""}
                </span>
                <span className="tabular truncate text-caption text-ink-2">
                  {teamShortLabel(p.team.name)} {p.c.span}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <ol aria-label={`54경기 결과: ${result.wins}승 ${result.losses}패, 최다 연승 ${result.longestStreak}`} className="mt-4 grid grid-cols-[repeat(18,minmax(0,1fr))] gap-[3px]">
        {result.games.map((w, i) => (
          <li key={i} className={`aspect-square rounded-[2px] ${w ? "bg-ink" : "border border-line bg-surface-2"}`} />
        ))}
      </ol>

      {/* 다섯 명 기록 (그 시대 경기당 평균) + 합계 */}
      <table className="tabular mt-4 w-full table-fixed text-caption">
        <caption className="mb-1 text-left text-sub font-bold text-ink">경기당 기록 (그 시대 평균)</caption>
        <thead>
          <tr className="text-ink-3">
            <th scope="col" className="w-[34%] py-1 text-left font-medium">선수</th>
            {STAT_COLS.map((s) => (
              <th key={s.key} scope="col" className="py-1 text-right font-medium">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line border-y border-line">
          {picked.map((p, i) => (
            <tr key={p.c.id}>
              <th scope="row" className="truncate py-1.5 text-left font-semibold text-ink">
                <span className="mr-1.5 font-medium text-ink-3" aria-label={SLOT_LABELS[GAME_SLOTS[i]]}>{GAME_SLOTS[i]}</span>
                {official ? (
                  <Link href={playerHref(p.c.id, p.c.seasonCode)} className="focus-ring rounded-control hover:underline">
                    {p.c.nameKo}
                  </Link>
                ) : (
                  p.c.nameKo
                )}
              </th>
              {STAT_COLS.map((s) => (
                <td key={s.key} className="py-1.5 text-right text-ink">
                  {p.c[s.key].toFixed(1)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold text-ink">
            <th scope="row" className="py-1.5 text-left">합계</th>
            {STAT_COLS.map((s) => (
              <td key={s.key} className="py-1.5 text-right">
                {totals[s.key].toFixed(1)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>

      <h3 className="mt-4 text-sub font-bold text-ink">팀 능력치</h3>
      <ul className="mt-1.5 space-y-1.5">
        {RADAR_AXES.map((a) => {
          const v = result.rating.axes[a];
          const weak = a === result.rating.weakest;
          return (
            <li key={a} className="tabular flex items-center gap-2 text-caption">
              <span className={`w-14 shrink-0 ${weak ? "font-bold text-ink" : "text-ink-2"}`}>{RADAR_AXIS_LABELS[a]}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-[2px] bg-surface-2">
                <span className="block h-full" style={{ width: `${v}%`, background: colors.series1 }} />
              </span>
              <span className="w-14 shrink-0 text-right text-ink-2">{weak ? `약점 ${v}` : v}</span>
            </li>
          );
        })}
      </ul>
      {!official && <p className="mt-3 text-caption text-ink-3">KBL - Stats Reference · 비영리 팬 프로젝트</p>}
    </div>
  );
}
