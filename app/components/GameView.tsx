"use client";
// 54-0 게임 화면 (규칙·점수는 lib/game.ts — 여기서는 계산하지 않고 부르기만).
// 순서: 주전 다섯 칸(가드 2·포워드 2·센터 1) → 슬롯머신 두 대(왼쪽 시즌 하나 · 오른쪽 팀 3개, 버튼 하나로 같이 돌고 왼쪽이 먼저 멈춤)
//   → 세 팀 후보 중 한 명 고르기(그 시즌 기록, 득점순 — 등급·점수는 안 보임) → 다섯 번 → 농구 코트 위 5명 + 54경기 결과·기록.
// 결과는 주소 ?l= 로 남겨 링크로 공유, 이미지 저장은 공식 사진 없는 사본(useCardSave).
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  canPick, decodeLineupParam, emptyLineup, encodeLineupParam, foreignCount, GAME_FOREIGN_MAX, GAME_ROUNDS, GAME_SEASON_GAMES,
  GAME_SLOTS, isLineupFull, lineupTotals, openSlotsFor, pickBlockReason, placePick, respinEra, respinTeam, resultVerdict,
  simulateSeason, SLOT_LABELS, spin, teamOfCandidate, teamsOf, GAME_SPIN_TEAMS, filterByPositionChip, sortCandidatesBy, POSITION_CHIPS, SORT_COLUMNS, nextSort, type PositionChip, type SortDir, type SortKey, type SortStat, type GameCandidate, type GamePool, type GameTeam, type Lineup,
  type SeasonResult, type Spin,
} from "@/lib/game";
import { overallGrade, RADAR_AXES, RADAR_AXIS_LABELS } from "@/lib/metrics";
import { playerHref } from "@/lib/cardview";
import { positionLabel } from "@/lib/roster";
import { FALLBACK_TEAM_COLOR, gradeTone } from "@/lib/teams";
import type { TeamColor } from "@/lib/types";
import { teamShortLabel } from "@/lib/images";
import ChipRow from "./ChipRow";
import { IconChevronDown, IconChevronUp } from "./icons";
import InfoLink from "./InfoLink";
import PlayerAvatar from "./PlayerAvatar";
import Skeleton from "./Skeleton";
import TeamLogo from "./TeamLogo";
import { useCardSave } from "./useCardSave";
import { trackEvent, trackFilters } from "./track";
import { useThemeColors, type ThemeColors } from "./useThemeColors";

/** 처음 보여 줄 후보 수 (나머지는 "더 보기") — 팀 3개라 후보가 보통 25~30명 */
const CANDIDATES_VISIBLE = 10;
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
  /** 릴에 지금 보이는 값 — 왼쪽 시즌, 오른쪽 팀 3개 */
  const [reelEra, setReelEra] = useState<number | null>(null);
  const [reelTeam, setReelTeam] = useState<Spin | null>(null);
  const [eraSpinning, setEraSpinning] = useState(false);
  const [teamSpinning, setTeamSpinning] = useState(false);
  const [tick, setTick] = useState(0);
  const [teamSkip, setTeamSkip] = useState(true);
  const [eraSkip, setEraSkip] = useState(true);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  /** 후보 정렬 (다음 슬롯에도 유지) — 포지션 칩은 슬롯마다 "전체"로 돌아간다(CandidateList 안 상태) */
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "ppg", dir: "desc" });
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
   * reels 에서 true 인 릴만 돈다: 처음 돌리기는 둘 다(왼쪽이 먼저 멈춤), 시즌 다시는 왼쪽만, 팀 다시는 오른쪽만.
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
    // 안 도는 릴은 바로 결과 값으로 (팀 다시: 시즌 그대로 / 시즌 다시: 같은 팀들의 그 시즌 로고·이름)
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
          const shuffled = [...era.teams].sort(() => Math.random() - 0.5).slice(0, GAME_SPIN_TEAMS);
          setReelTeam({ era: era.index, teamCodes: shuffled.map((t) => t.teamCode) });
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
    // 팀은 그대로 두고 왼쪽 릴만 — 지금 팀이 그 시즌에 없어 팀이 바뀌는 경우만 오른쪽도 돈다
    const teamChanged = next.teamCodes.length !== current.teamCodes.length || next.teamCodes.some((c, i) => c !== current.teamCodes[i]);
    animateTo(next, { era: true, team: teamChanged });
  }

  function place(c: GameCandidate, slot: number) {
    if (!pool || !current) return;
    const team = teamOfCandidate(pool, current, c);
    if (!team) return;
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
  const reelTeams = pool && reelTeam ? teamsOf(pool, reelTeam) : [];
  const currentTeams = pool && current ? teamsOf(pool, current) : [];

  return (
    <main className="mx-auto max-w-3xl px-4 pt-5">
      <header className="mb-4">
        <h1 className="flex items-center gap-1 text-h1 font-bold">
          54-0 <InfoLink term="game54" className="ml-1" />
        </h1>
        <p className="mt-0.5 text-sub text-ink-2">시즌과 팀 3개를 뽑아 역대 주전 5명을 꾸리고 54전 전승에 도전하세요.</p>
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
              <SlotReel title={`팀 ${GAME_SPIN_TEAMS}개`} spinning={teamSpinning} tick={tick}>
                {reelTeams.length > 0 ? (
                  <span className="flex w-full min-w-0 flex-col gap-1.5">
                    {reelTeams.map((t) => (
                      <span key={t.teamCode} className="flex min-w-0 items-center gap-2">
                        <TeamLogo logoUrl={t.logoUrl} shortName={t.name} color={t.color} size={28} />
                        <span className="min-w-0 truncate text-sub font-bold text-ink sm:text-body">{t.name}</span>
                      </span>
                    ))}
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
                <SkipButton label="시즌 다시" left={eraSkip} disabled={spinning} onClick={doRespinEra} />
                <SkipButton label="팀 다시" left={teamSkip} disabled={spinning} onClick={doRespinTeam} />
              </div>
            )}
          </section>

          {current && currentTeams.length > 0 && !spinning && (
            <CandidateList
              teams={currentTeams}
              sort={sort}
              onSort={setSort}
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

/** 주전 다섯 칸 — 등급은 여기서도 숨기고 마지막 결과 화면에서만 공개 */
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
                <span className="mt-1">
                  <PlayerAvatar photoUrl={c.photoUrl} nameKo={c.nameKo} color={team.color} size={44} />
                </span>
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

/**
 * 후보 표 열 너비 — 머리글과 줄이 같은 격자를 쓴다. 폰(390px)에서도 가로 스크롤 없이 9열:
 * 이름(나머지) · 팀 로고 · 포지션 약자 · 숫자 6열. PC 는 사진·팀 이름·포지션 이름까지
 */
const CAND_GRID =
  "grid grid-cols-[minmax(0,1fr)_1.5rem_2.5rem_repeat(6,1.75rem)] items-center sm:grid-cols-[minmax(0,1fr)_6rem_5.5rem_repeat(6,3rem)] sm:gap-x-2";

interface ListProps {
  teams: GameTeam[];
  sort: { key: SortKey; dir: SortDir };
  onSort: (s: { key: SortKey; dir: SortDir }) => void;
  lineup: Lineup;
  choosing: string | null;
  showAll: boolean;
  onShowAll: () => void;
  onChoose: (c: GameCandidate) => void;
  onPlace: (c: GameCandidate, slot: number) => void;
}

/** 세 팀 후보를 표 하나로: 머리글을 누르면 그 열로 정렬(다시 누르면 반대 순서). 고를 수 있는 선수 먼저, 못 고르는 선수는 흐리게 + 까닭. 등급·점수는 보이지 않는다 */
function CandidateList({ teams, sort, onSort, lineup, choosing, showAll, onShowAll, onChoose, onPlace }: ListProps) {
  const [pos, setPos] = useState<PositionChip>("all");
  const teamOf = new Map(teams.flatMap((t) => t.candidates.map((c) => [c, t] as const)));
  const all = teams.flatMap((t) => t.candidates);
  const sorted = sortCandidatesBy(filterByPositionChip(all, pos), sort.key, sort.dir, (c) => teamOf.get(c)?.name ?? "");
  const ordered = [...sorted.filter((c) => canPick(lineup, c)), ...sorted.filter((c) => !canPick(lineup, c))];
  const visible = showAll ? ordered : ordered.slice(0, CANDIDATES_VISIBLE);
  return (
    <section aria-labelledby="cand-title" className="mt-4">
      <h2 id="cand-title" className="text-h2 font-bold">
        한 명을 고르세요 <span className="text-sub font-medium text-ink-3">{all.length}명 · 그 시즌 경기당 기록</span>
      </h2>
      <ChipRow
        label="포지션"
        className="mt-2"
        chips={POSITION_CHIPS.map((p) => ({
          value: p,
          label: (
            <>
              {p === "all" ? "전체" : SLOT_LABELS[p]}
              <span className="tabular text-sub font-medium opacity-70">{filterByPositionChip(all, p).length}</span>
            </>
          ),
        }))}
        value={pos}
        onChange={(v) => {
          setPos(v);
          trackFilters("game", { position: v });
        }}
      />
      {ordered.length === 0 ? (
        <p className="surface-card mt-2 rounded-container px-4 py-6 text-center text-body text-ink-2">
          이 포지션 선수가 없습니다.{" "}
          <button type="button" onClick={() => setPos("all")} className="focus-ring rounded-control font-semibold text-ink underline">
            전체 보기
          </button>
        </p>
      ) : (
        <div className="surface-card mt-2 rounded-container">
          {/* 머리글 = 정렬 버튼 */}
          <div className={`${CAND_GRID} border-b border-line px-2 sm:px-3`}>
            {SORT_COLUMNS.map((col) => {
              const active = col.key === sort.key;
              const dirText = active ? (sort.dir === "desc" ? (col.numeric ? "높은 순" : "역순") : col.numeric ? "낮은 순" : "가나다순") : "";
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => {
                    const next = nextSort(sort, col.key);
                    onSort(next);
                    trackFilters("game", { sort: `${next.key}_${next.dir}` });
                  }}
                  aria-label={`${col.label}${active ? ` (지금 ${dirText})` : ""} 정렬`}
                  className={`focus-ring-inset flex h-11 min-w-0 cursor-pointer flex-col justify-center rounded-control text-caption transition-colors duration-200 hover:bg-surface-2 ${
                    col.key === "name" ? "items-start pl-1" : "items-center"
                  } ${active ? "font-bold text-ink" : "font-medium text-ink-3"}`}
                >
                  <span className="max-w-full truncate">
                    {col.key === "team" ? (
                      <>
                        <span className="sm:hidden">팀</span>
                        <span className="hidden sm:inline">{col.label}</span>
                      </>
                    ) : (
                      col.label
                    )}
                  </span>
                  <span aria-hidden className="h-4">
                    {active && (sort.dir === "desc" ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />)}
                  </span>
                </button>
              );
            })}
          </div>
          <ul className="divide-y divide-line">
            {visible.map((c) => {
              const reason = pickBlockReason(lineup, c);
              const slots = openSlotsFor(lineup, c);
              const team = teamOf.get(c)!;
              const num = (key: SortStat, text: string) => (
                <span key={key} className={`text-center text-caption sm:text-body ${reason ? "text-ink-3" : key === sort.key ? "font-bold text-ink" : "text-ink-2"}`}>
                  {text}
                </span>
              );
              return (
                <li key={`${c.id}:${c.seasonCode}`}>
                  <button
                    type="button"
                    disabled={!!reason}
                    onClick={() => onChoose(c)}
                    aria-expanded={slots.length > 1 ? choosing === c.id : undefined}
                    className={`${CAND_GRID} tabular focus-ring-inset min-h-12 w-full cursor-pointer px-2 py-1.5 text-left transition-colors duration-200 hover:bg-surface-2 disabled:cursor-not-allowed disabled:hover:bg-transparent sm:px-3`}
                  >
                    <span className="flex min-w-0 items-center gap-2 pl-1">
                      <span className="hidden sm:inline-flex">
                        <PlayerAvatar photoUrl={c.photoUrl} nameKo={c.nameKo} color={team.color} size={32} className={reason ? "opacity-40" : ""} />
                      </span>
                      <span className="min-w-0">
                        <span className={`block truncate text-sub font-bold sm:text-body ${reason ? "text-ink-3" : "text-ink"}`}>{c.nameKo}</span>
                        {(reason || c.foreign) && (
                          <span className="block truncate text-caption text-ink-3">{reason ?? "외국 선수"}</span>
                        )}
                      </span>
                    </span>
                    <span className="flex min-w-0 items-center justify-center gap-1.5 sm:justify-start">
                      <TeamLogo logoUrl={team.logoUrl} shortName={team.name} color={team.color} size={20} />
                      <span className="hidden truncate text-sub text-ink-2 sm:inline">{team.name}</span>
                    </span>
                    <span className="truncate text-center text-caption font-semibold text-ink-2 sm:text-sub">
                      <span className="sm:hidden">{c.position}</span>
                      <span className="hidden sm:inline">{positionLabel(c.position) ?? c.position}</span>
                    </span>
                    {num("ppg", c.ppg.toFixed(1))}
                    {num("rpg", c.rpg.toFixed(1))}
                    {num("apg", c.apg.toFixed(1))}
                    {num("spg", c.spg.toFixed(1))}
                    {num("bpg", c.bpg.toFixed(1))}
                    {num("tpPct", c.tpPct == null ? "–" : c.tpPct.toFixed(1))}
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
        </div>
      )}
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
/**
 * 좌우 대칭: 탑 1 · 윙 2 · 로우 2. 값은 상자 안 사진 가운데 위치(이름표는 사진 아래로 붙는다).
 * 폰은 상자를 코트보다 조금 길게(15:16) 두고 남는 아래쪽(엔드라인 밖)을 로우 선수 이름표 자리로 쓴다
 */
const COURT_SPOTS: readonly { x: number; y: number }[] = [
  { x: 50, y: 11 }, // 가드: 탑
  { x: 20, y: 32 }, // 가드: 왼쪽 윙
  { x: 80, y: 32 }, // 포워드: 오른쪽 윙
  { x: 24, y: 71 }, // 포워드: 왼쪽 로우
  { x: 76, y: 71 }, // 센터: 오른쪽 로우(골밑)
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
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMin meet" aria-hidden>
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
        <p className="tabular shrink-0 text-right text-caption text-ink-3">팀 전력 {result.rating.rating.toFixed(1)}</p>
      </div>

      {/* 코트 위 다섯 명 — PC 에서도 너무 커지지 않게 폭을 묶는다 */}
      <div className="relative mx-auto mt-4 aspect-[15/16] w-full max-w-md max-[359px]:aspect-[15/19] sm:aspect-[15/14] overflow-hidden rounded-card bg-surface-2">
        <CourtLines />
        {picked.map((p, i) => {
          const spot = COURT_SPOTS[i];
          return (
            <div
              key={p.c.id}
              className="absolute flex w-32 -translate-x-1/2 -translate-y-6 flex-col items-center text-center sm:-translate-y-8"
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
            >
              {/* 폰은 코트가 작아 사진·이름표를 줄인다 (윙 이름표가 로우 사진에 겹치지 않게) */}
              <span className="flex sm:hidden">
                <PlayerAvatar photoUrl={p.c.photoUrl} nameKo={p.c.nameKo} color={p.team.color} size={48} official={official} />
              </span>
              <span className="hidden sm:flex">
                <PlayerAvatar photoUrl={p.c.photoUrl} nameKo={p.c.nameKo} color={p.team.color} size={64} official={official} />
              </span>
              <span className="surface-card mt-1 flex max-w-full flex-col rounded-control px-1.5 py-0.5 sm:px-2 sm:py-1">
                <span className="flex min-w-0 items-center justify-center gap-1">
                  <span className="truncate text-sub font-bold text-ink">{p.c.nameKo}</span>
                  <GradeChip score={p.c.score} color={p.team.color} colors={colors} />
                </span>
                <span className="tabular truncate text-caption text-ink-2">
                  {SLOT_LABELS[GAME_SLOTS[i]]}
                  {p === mvp ? " · MVP" : ""}
                </span>
                <span className="tabular truncate text-caption text-ink-3">
                  {teamShortLabel(p.team.name)} {p.c.span}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* 다섯 명 기록 (그 시즌 경기당) + 합계 */}
      <table className="tabular mt-4 w-full table-fixed text-caption">
        <caption className="mb-1 text-left text-sub font-bold text-ink">경기당 기록 (그 시즌)</caption>
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
              <span className={`flex w-24 shrink-0 items-center gap-1 ${weak ? "font-bold text-ink" : "text-ink-2"}`}>
                {RADAR_AXIS_LABELS[a]}
                {weak && <span className="rounded-control border border-line px-1 font-semibold text-ink-2">약점</span>}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-[2px] bg-surface-2">
                <span className="block h-full" style={{ width: `${v}%`, background: colors.series1 }} />
              </span>
              <span className={`w-8 shrink-0 text-right ${weak ? "font-bold text-ink" : "text-ink-2"}`}>{v}</span>
            </li>
          );
        })}
      </ul>
      {!official && <p className="mt-3 text-caption text-ink-3">KBL - Stats Reference · 비영리 팬 프로젝트</p>}
    </div>
  );
}

/** 뽑은 뒤에만 보이는 종합 등급 글자 (고를 때는 등급을 숨긴다) */
function GradeChip({ score, color, colors }: { score: number; color: TeamColor; colors: ThemeColors }) {
  const grade = overallGrade(score);
  const tone = gradeTone(grade, color, colors);
  return (
    <span
      className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-control border px-1 text-caption font-black"
      style={{ background: tone.bg, color: tone.ink, borderColor: tone.border }}
      aria-label={`종합 등급 ${grade}`}
    >
      {grade}
    </span>
  );
}
