"use client";
// 54-0 게임 화면 (규칙·점수는 lib/game.ts — 여기서는 계산하지 않고 부르기만).
// 순서: 주전 다섯 칸(가드 2·포워드 2·센터 1) → 슬롯 돌리기(시대 구간 + 팀) → 그 팀 후보 중 한 명 고르기 → 다섯 번 → 54경기 결과.
// 결과는 주소 ?l= 로 남겨 링크로 공유, 이미지 저장은 공식 사진 없는 사본(useCardSave).
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  canPick, decodeLineupParam, emptyLineup, encodeLineupParam, foreignCount, GAME_FOREIGN_MAX, GAME_ROUNDS, GAME_SEASON_GAMES,
  GAME_SLOTS, isLineupFull, openSlotsFor, pickBlockReason, placePick, respinEra, respinTeam, resultVerdict, simulateSeason,
  SLOT_LABELS, sortCandidates, spin, teamOf, type GameCandidate, type GamePool, type GameTeam, type Lineup, type SeasonResult,
  type Spin,
} from "@/lib/game";
import { overallGrade, RADAR_AXES, RADAR_AXIS_LABELS } from "@/lib/metrics";
import { playerHref } from "@/lib/cardview";
import { positionLabel } from "@/lib/roster";
import { FALLBACK_TEAM_COLOR, gradeTone } from "@/lib/teams";
import { teamShortLabel } from "@/lib/images";
import type { TeamColor } from "@/lib/types";
import InfoLink from "./InfoLink";
import PlayerAvatar from "./PlayerAvatar";
import Skeleton from "./Skeleton";
import TeamLogo from "./TeamLogo";
import { useCardSave } from "./useCardSave";
import { useThemeColors, type ThemeColors } from "./useThemeColors";

/** 처음 보여 줄 후보 수 (나머지는 "더 보기") */
const CANDIDATES_VISIBLE = 8;
/** 슬롯이 도는 시간 (ms) — 동작 줄이기 설정이면 바로 멈춘다 */
const SPIN_MS = 900;

/** 뽑은 선수 + 그 팀 색 (칸·결과 그림용) */
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
  const [usedEras, setUsedEras] = useState<number[]>([]);
  const [current, setCurrent] = useState<Spin | null>(null);
  const [rolling, setRolling] = useState<Spin | null>(null);
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

  // 결과가 나오면 주소에 라인업을 남긴다 (링크 공유)
  useEffect(() => {
    if (full && !shared) window.history.replaceState(null, "", `${window.location.pathname}?l=${encodeLineupParam(lineup)}`);
  }, [full, shared, lineup]);

  function animateTo(next: Spin | null) {
    if (!pool || !next) return;
    setChoosing(null);
    setShowAll(false);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setCurrent(next);
      return;
    }
    // 도는 동안은 아무 구간·팀이나 번갈아 보여 주다가 결과에서 멈춘다 (보여 주기용 — 결과는 이미 정해짐)
    const start = performance.now();
    setCurrent(null);
    if (timer.current) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      if (performance.now() - start >= SPIN_MS) {
        window.clearInterval(timer.current!);
        timer.current = null;
        setRolling(null);
        setCurrent(next);
        return;
      }
      const era = pool.eras[Math.floor(Math.random() * pool.eras.length)];
      const t = era.teams[Math.floor(Math.random() * era.teams.length)];
      setRolling({ era: era.index, teamCode: t.teamCode });
    }, 70);
  }

  function doSpin() {
    if (pool) animateTo(spin(pool, usedEras, lineup, Math.random));
  }

  function doRespinTeam() {
    if (!pool || !current) return;
    const next = respinTeam(pool, current, lineup, Math.random);
    if (!next) return;
    setTeamSkip(false);
    animateTo(next);
  }

  function doRespinEra() {
    if (!pool || !current) return;
    const next = respinEra(pool, current, usedEras, lineup, Math.random);
    if (!next) return;
    setEraSkip(false);
    animateTo(next);
  }

  function place(c: GameCandidate, slot: number) {
    if (!pool || !current) return;
    const team = teamOf(pool, current)!;
    setLineup((l) => placePick(l, slot, c));
    setTeams((t) => t.map((x, i) => (i === slot ? team : x)));
    setUsedEras((u) => [...u, current.era]);
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
    setLineup(emptyLineup());
    setTeams(GAME_SLOTS.map(() => null));
    setUsedEras([]);
    setCurrent(null);
    setRolling(null);
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
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const round = lineup.filter(Boolean).length;
  const shown = rolling ?? current;
  const shownEra = shown && pool ? pool.eras[shown.era] : null;
  const shownTeam = shown && pool ? teamOf(pool, shown) : null;

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
          <LineupBoard lineup={lineup} teams={teams} colors={colors} />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sub text-ink-2">
            <span className="tabular">
              라운드 {Math.min(round + 1, GAME_ROUNDS)}/{GAME_ROUNDS} · 외국 선수 {foreignCount(lineup)}/{GAME_FOREIGN_MAX}
            </span>
            <EraTrack pool={pool} used={usedEras} current={current?.era ?? null} />
          </div>

          <section aria-label="슬롯" className="surface-card mt-4 rounded-container p-4">
            <div className="flex min-h-16 items-center gap-3" aria-live="polite">
              {shownEra && shownTeam ? (
                <>
                  <TeamLogo logoUrl={shownTeam.logoUrl} shortName={shownTeam.name} color={shownTeam.color} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="tabular text-sub font-semibold text-ink-2">{shownEra.label} 시즌</p>
                    <p className="truncate text-h2 font-bold text-ink">{shownTeam.name}</p>
                  </div>
                </>
              ) : (
                <p className="text-body text-ink-2">슬롯을 돌려 시대와 팀을 뽑으세요.</p>
              )}
            </div>
            {!current && !rolling && (
              <button
                type="button"
                onClick={doSpin}
                className="focus-ring mt-3 h-11 w-full cursor-pointer rounded-control bg-ink text-body font-bold text-surface transition-colors duration-200 hover:bg-ink-2"
              >
                슬롯 돌리기
              </button>
            )}
            {current && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <SkipButton label="팀 다시" left={teamSkip} onClick={doRespinTeam} />
                <SkipButton label="시대 다시" left={eraSkip} onClick={doRespinEra} />
              </div>
            )}
          </section>

          {current && shownTeam && !rolling && (
            <CandidateList
              team={shownTeam}
              lineup={lineup}
              colors={colors}
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

function SkipButton({ label, left, onClick }: { label: string; left: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={!left}
      onClick={onClick}
      className="focus-ring h-11 cursor-pointer rounded-control border border-line bg-surface text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-surface"
    >
      {label} <span className="tabular text-sub font-medium text-ink-3">{left ? "1번 남음" : "씀"}</span>
    </button>
  );
}

/** 7개 시대 구간: 쓴 곳은 채운 칸, 지금 구간은 테두리 */
function EraTrack({ pool, used, current }: { pool: GamePool; used: number[]; current: number | null }) {
  return (
    <ol aria-label="시대 구간" className="grid w-full grid-cols-7 gap-1 sm:w-auto">
      {pool.eras.map((e) => {
        const isUsed = used.includes(e.index);
        const isCurrent = current === e.index;
        return (
          <li
            key={e.index}
            title={`${e.label}${isUsed ? " (씀)" : ""}`}
            aria-label={`${e.label} ${isUsed ? "씀" : isCurrent ? "지금" : "남음"}`}
            className={`tabular flex h-6 items-center justify-center whitespace-nowrap rounded-control px-0.5 text-caption tracking-tight sm:px-1.5 font-semibold ${
              isUsed ? "bg-ink text-surface" : isCurrent ? "border-[1.5px] border-ink text-ink" : "border border-line text-ink-3"
            }`}
          >
            {e.label}
          </li>
        );
      })}
    </ol>
  );
}

/** 주전 다섯 칸 */
function LineupBoard({ lineup, teams, colors }: { lineup: Lineup; teams: (GameTeam | null)[]; colors: ThemeColors }) {
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
                <ScoreBadge score={c.score} color={team.color} colors={colors} small />
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

function ScoreBadge({ score, color, colors, small = false }: { score: number; color: TeamColor; colors: ThemeColors; small?: boolean }) {
  const grade = overallGrade(score);
  const tone = gradeTone(grade, color, colors);
  return (
    <span
      className={`tabular inline-flex shrink-0 items-center gap-0.5 rounded-control border-[1.5px] font-black ${small ? "mt-1 h-6 px-1 text-caption" : "h-8 px-1.5 text-base"}`}
      style={{ background: tone.bg, color: tone.ink, borderColor: tone.border }}
      aria-label={`종합 ${grade} ${score}점`}
    >
      {grade}
      <span className="text-caption font-bold">{score}</span>
    </span>
  );
}

interface ListProps {
  team: GameTeam;
  lineup: Lineup;
  colors: ThemeColors;
  choosing: string | null;
  showAll: boolean;
  onShowAll: () => void;
  onChoose: (c: GameCandidate) => void;
  onPlace: (c: GameCandidate, slot: number) => void;
}

/** 그 팀·그 구간 후보: 고를 수 있는 선수 먼저(종합 점수 순), 못 고르는 선수는 흐리게 + 까닭 */
function CandidateList({ team, lineup, colors, choosing, showAll, onShowAll, onChoose, onPlace }: ListProps) {
  const sorted = sortCandidates(team.candidates);
  const ordered = [...sorted.filter((c) => canPick(lineup, c)), ...sorted.filter((c) => !canPick(lineup, c))];
  const visible = showAll ? ordered : ordered.slice(0, CANDIDATES_VISIBLE);
  return (
    <section aria-labelledby="cand-title" className="mt-4">
      <h2 id="cand-title" className="text-h2 font-bold">
        한 명을 고르세요 <span className="text-sub font-medium text-ink-3">{team.candidates.length}명</span>
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
                className="focus-ring-inset flex min-h-16 w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors duration-200 hover:bg-surface-2 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <PlayerAvatar photoUrl={c.photoUrl} nameKo={c.nameKo} color={team.color} size={40} className={reason ? "opacity-40" : ""} />
                <span className="min-w-0 flex-1">
                  <span className={`flex items-center gap-1.5 text-body font-bold ${reason ? "text-ink-3" : "text-ink"}`}>
                    <span className="truncate">{c.nameKo}</span>
                    {c.foreign && <span className="shrink-0 rounded-control border border-line px-1 text-caption font-semibold text-ink-2">외국</span>}
                  </span>
                  <span className="tabular block truncate text-caption text-ink-2">
                    {reason ?? `${pos ?? ""} · ${c.season} · ${c.ppg.toFixed(1)}점 ${c.rpg.toFixed(1)}리바 ${c.apg.toFixed(1)}어시`}
                  </span>
                </span>
                <ScoreBadge score={c.score} color={team.color} colors={colors} />
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
          <div ref={exportRef} className="w-[420px] bg-surface p-3">
            <ResultCard picked={picked} result={result} colors={colors} official={false} />
          </div>
        </div>
      )}
    </section>
  );
}

/** 결과 카드 (화면·저장 이미지 공용). official=false 면 공식 사진·로고 없이 대체 디자인만 */
function ResultCard({ picked, result, colors, official }: { picked: Picked[]; result: SeasonResult; colors: ThemeColors; official: boolean }) {
  const mvp = picked.reduce((b, p) => (p.c.score > b.c.score || (p.c.score === b.c.score && p.c.ppg > b.c.ppg) ? p : b), picked[0]);
  const perfect = result.wins === GAME_SEASON_GAMES;
  return (
    <div className="surface-card rounded-container p-4">
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

      <ol aria-label={`54경기 결과: ${result.wins}승 ${result.losses}패, 최다 연승 ${result.longestStreak}`} className="mt-3 grid grid-cols-[repeat(18,minmax(0,1fr))] gap-[3px]">
        {result.games.map((w, i) => (
          <li key={i} className={`aspect-square rounded-[2px] ${w ? "bg-ink" : "border border-line bg-surface-2"}`} />
        ))}
      </ol>
      <p className="tabular mt-1.5 text-caption text-ink-3">
        최다 {result.longestStreak}연승 · 팀 전력 {result.rating.rating.toFixed(1)}
      </p>

      <ul className="mt-4 divide-y divide-line">
        {picked.map((p, i) => (
          <li key={p.c.id} className="flex min-h-12 items-center gap-2.5 py-1.5">
            <span className="w-11 shrink-0 text-caption font-semibold text-ink-3">{SLOT_LABELS[GAME_SLOTS[i]]}</span>
            <PlayerAvatar photoUrl={p.c.photoUrl} nameKo={p.c.nameKo} color={p.team.color} size={36} official={official} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-body font-bold text-ink">
                {official ? (
                  <Link href={playerHref(p.c.id, p.c.seasonCode)} className="focus-ring truncate rounded-control hover:underline">
                    {p.c.nameKo}
                  </Link>
                ) : (
                  <span className="truncate">{p.c.nameKo}</span>
                )}
                {p === mvp && <span className="shrink-0 rounded-control border border-line px-1 text-caption font-semibold text-ink-2">MVP</span>}
              </span>
              <span className="tabular flex min-w-0 items-center gap-1 text-caption text-ink-2">
                <TeamLogo logoUrl={p.team.logoUrl} shortName={p.team.name} color={p.team.color} size={16} official={official} />
                <span className="truncate">
                  {teamShortLabel(p.team.name)} · {p.c.season} · {positionLabel(p.c.position)}
                </span>
              </span>
            </span>
            <ScoreBadge score={p.c.score} color={p.team.color} colors={colors} />
          </li>
        ))}
      </ul>

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
