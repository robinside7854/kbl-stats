// 시즌 경기 규칙 (순수) — 홈 "오늘의 경기"·팀 순위 (2026-10-03 사용자 요청). 재료는 data/processed/{시즌}/games.json (scripts/boxscores.ts).
import type { GameBoxRow, GameSide, SeasonGame, TeamColor } from "./types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-10-03" → "10월 3일 (토)" */
export function gameDayLabel(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const wd = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return `${Number(m[2])}월 ${Number(m[3])}일 (${WEEKDAYS[wd]})`;
}

/** "2026-10-07" → "10월 7일 경기까지 반영" — 기록 화면 머리말의 기준 한 줄 (lib/data dataAsOfDate) */
export function asOfLabel(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${Number(m[1])}월 ${Number(m[2])}일 경기까지 반영` : `${date} 경기까지 반영`;
}

export interface GameDay {
  date: string;
  games: SeasonGame[];
}

/** 끝난 경기가 있는 가장 최근 날짜의 경기들 (그날 아직 안 끝난 경기도 포함). 없으면 null */
export function latestGameDay(games: readonly SeasonGame[]): GameDay | null {
  let date: string | null = null;
  for (const g of games) if (g.ended && (!date || g.date > date)) date = g.date;
  return date ? { date, games: games.filter((g) => g.date === date) } : null;
}

/** after 날짜 다음으로 경기가 잡힌 가장 이른 날짜의 경기들 (예정 경기). 없으면 null */
export function nextGameDay(games: readonly SeasonGame[], after: string | null): GameDay | null {
  let date: string | null = null;
  for (const g of games) if (!g.ended && (!after || g.date > after) && (!date || g.date < date)) date = g.date;
  return date ? { date, games: games.filter((g) => g.date === date && !g.ended) } : null;
}

export interface SeasonProgress {
  ended: number;
  total: number;
  /** 0~100, 소수 한 자리 */
  pct: number;
}

/** 정규시즌 진행률 (2026-10-04 사용자 요청) — games.json 은 정규시즌 일정 전체(예정 경기 포함)라 끝난 경기 ÷ 전체 경기. 일정이 없으면 null */
export function seasonProgress(games: readonly SeasonGame[]): SeasonProgress | null {
  if (games.length === 0) return null;
  const ended = games.filter((g) => g.ended).length;
  return { ended, total: games.length, pct: Math.round((ended / games.length) * 1000) / 10 };
}

/** "2025-2026" → "KBL 2025-2026 시즌" (홈 제목 — 새 시즌이 개막하면 홈 시즌이 바뀌어 자동으로 따라간다) */
export function seasonTitle(seasonLabel: string): string {
  return `KBL ${seasonLabel} 시즌`;
}

/** 이긴 쪽 ("home" | "away"), 점수가 없거나 같으면 null */
export function winnerSide(g: SeasonGame): "home" | "away" | null {
  if (!g.ended || g.home.score === null || g.away.score === null || g.home.score === g.away.score) return null;
  return g.home.score > g.away.score ? "home" : "away";
}

/** 그 팀 최다 득점 선수 (같으면 리바운드 → 어시스트 → 출전 시간). 기록이 없으면 null */
export function topPerformer(rows: readonly GameBoxRow[] | undefined): GameBoxRow | null {
  if (!rows || rows.length === 0) return null;
  return [...rows].sort((a, b) => b.pts - a.pts || b.reb - a.reb || b.ast - a.ast || b.sec - a.sec)[0];
}

/** "18득점 7리바" 꼴 한 줄 (리바·어시는 5개 이상일 때만) */
export function performerLine(r: GameBoxRow): string {
  const parts = [`${r.pts}득점`];
  if (r.reb >= 5) parts.push(`${r.reb}리바`);
  if (r.ast >= 5) parts.push(`${r.ast}어시`);
  return parts.join(" ");
}

/** 그날 모든 경기에서 득점 많은 선수 n명 (검색창 빈 화면 "경기 활약", 2026-10-08 토스 검토). 같으면 리바 → 어시 */
export function dayTopPerformers(day: GameDay, n = 3): { id: string; line: string }[] {
  const rows = day.games.flatMap((g) => [...(g.box?.home ?? []), ...(g.box?.away ?? [])]);
  return [...rows]
    .sort((a, b) => b.pts - a.pts || b.reb - a.reb || b.ast - a.ast)
    .slice(0, n)
    .map((r) => ({ id: r.id, line: performerLine(r) }));
}

/** 경기 카드 "주요 선수" 구분 (2026-10-05 사용자: 팀별 2명 — 득점 1위 + 어시·3점·수비·리바 중 돋보인 선수) */
export type StandoutKind = "points" | "ast" | "tpm" | "def" | "reb";
export const STANDOUT_LABELS: Record<StandoutKind, string> = { points: "득점", ast: "어시", tpm: "3점", def: "수비", reb: "리바" };

export interface Standout {
  kind: StandoutKind;
  row: GameBoxRow;
}

/**
 * 두 번째 선수를 고르는 기준 (우리 규칙, 2026-10-05): 득점 1위를 뺀 선수 중 부문 1위의 기록 ÷ 문턱이 가장 큰 부문.
 * 문턱 = 한 경기에서 "눈에 띈다"고 볼 만한 값 — 어시 5·3점 성공 3·스틸+블록 3·리바 8. 1 이상인 부문이 없으면 득점 2위.
 * 같으면 이 순서(어시 → 3점 → 수비 → 리바).
 */
export const STANDOUT_THRESHOLDS: Record<Exclude<StandoutKind, "points">, { value: (r: GameBoxRow) => number; min: number }> = {
  ast: { value: (r) => r.ast, min: 5 },
  tpm: { value: (r) => r.tpm, min: 3 },
  def: { value: (r) => r.stl + r.blk, min: 3 },
  reb: { value: (r) => r.reb, min: 8 },
};

/** 팀 박스스코어 → 주요 선수 최대 2명 (득점 1위 + 다른 부문에서 돋보인 1명) */
export function teamStandouts(rows: readonly GameBoxRow[] | undefined): Standout[] {
  const top = topPerformer(rows);
  if (!rows || !top) return [];
  const rest = rows.filter((r) => r.id !== top.id);
  const out: Standout[] = [{ kind: "points", row: top }];
  let best: Standout | null = null;
  let bestRatio = 1;
  for (const [kind, t] of Object.entries(STANDOUT_THRESHOLDS) as [Exclude<StandoutKind, "points">, (typeof STANDOUT_THRESHOLDS)["ast"]][]) {
    // 그 부문 1위 (같으면 득점 → 출전 시간)
    const leader = [...rest].sort((a, b) => t.value(b) - t.value(a) || b.pts - a.pts || b.sec - a.sec)[0];
    if (!leader) continue;
    const ratio = t.value(leader) / t.min;
    if (ratio >= bestRatio && (best === null || ratio > bestRatio)) {
      best = { kind, row: leader };
      bestRatio = ratio;
    }
  }
  const second = best ?? (topPerformer(rest) ? { kind: "points" as const, row: topPerformer(rest)! } : null);
  if (second) out.push(second);
  return out;
}

/** 주요 선수 한 줄: 그 부문 기록을 앞에 ("8어시 · 9득점", "3점 4개 · 14득점", "스틸 3·블록 1 · 5득점") */
export function standoutLine({ kind, row: r }: Standout): string {
  switch (kind) {
    case "points":
      return performerLine(r);
    case "ast":
      return `${r.ast}어시 · ${r.pts}득점`;
    case "tpm":
      return `3점 ${r.tpm}개 · ${r.pts}득점`;
    case "reb":
      return `${r.reb}리바 · ${r.pts}득점`;
    case "def": {
      const parts = [r.stl ? `스틸 ${r.stl}` : "", r.blk ? `블록 ${r.blk}` : ""].filter(Boolean).join("·");
      return `${parts} · ${r.pts}득점`;
    }
  }
}

/** 출전 초 → "32:05" */
export function minutesLabel(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────
// 팀 순위 (끝난 정규시즌 경기 결과로 — 선수 기록 합산이 아니라 경기 점수라 공식 승패와 같다)
// 동률은 승률 → 승 수 → 득실차 순. KBL 공식 동률 규정(상대 전적 등)은 반영하지 않는다.
// ─────────────────────────────────────────────

export interface StandingRow {
  teamCode: string;
  name: string;
  rank: number;
  games: number;
  wins: number;
  losses: number;
  /** 0~1 */
  pct: number;
  /** 1위와 게임 차 (1위 = 0) */
  gamesBehind: number;
  homeWins: number;
  homeLosses: number;
  awayWins: number;
  awayLosses: number;
  pointsFor: number;
  pointsAgainst: number;
  /** 최근 5경기 결과, 오래된 것 → 최근 ("W"|"L") */
  last5: ("W" | "L")[];
  /** "3연승" / "2연패" / "" */
  streak: string;
  /** 지금 이어지는 연승(W)·연패(L)와 경기 수 (경기 없으면 null·0) */
  streakKind: "W" | "L" | null;
  streakCount: number;
}

/** 연승·연패를 따로 보여 줄 최소 경기 수 (1연승은 소식이 아니라서 — 2026-10-11 우리 규칙) */
export const STREAK_SHOW_MIN = 2;

/** 보여 줄 만한 연승·연패 { label: "3연승", kind } — 2경기 미만이면 null */
export function notableStreak(r: Pick<StandingRow, "streakKind" | "streakCount">): { label: string; kind: "W" | "L" } | null {
  if (!r.streakKind || r.streakCount < STREAK_SHOW_MIN) return null;
  return { label: `${r.streakCount}${r.streakKind === "W" ? "연승" : "연패"}`, kind: r.streakKind };
}

export function computeStandings(games: readonly SeasonGame[]): StandingRow[] {
  type Acc = Omit<StandingRow, "rank" | "games" | "pct" | "gamesBehind" | "last5" | "streak" | "streakKind" | "streakCount"> & { results: ("W" | "L")[] };
  const acc = new Map<string, Acc>();
  const get = (side: GameSide) => {
    let a = acc.get(side.teamCode);
    if (!a) {
      a = { teamCode: side.teamCode, name: side.name, wins: 0, losses: 0, homeWins: 0, homeLosses: 0, awayWins: 0, awayLosses: 0, pointsFor: 0, pointsAgainst: 0, results: [] };
      acc.set(side.teamCode, a);
    }
    return a;
  };
  const ordered = [...games].sort((a, b) => a.date.localeCompare(b.date));
  for (const g of ordered) {
    const w = winnerSide(g);
    if (!w || !g.home.teamCode || !g.away.teamCode) continue;
    const h = get(g.home), a = get(g.away);
    h.pointsFor += g.home.score!; h.pointsAgainst += g.away.score!;
    a.pointsFor += g.away.score!; a.pointsAgainst += g.home.score!;
    if (w === "home") {
      h.wins++; h.homeWins++; a.losses++; a.awayLosses++;
      h.results.push("W"); a.results.push("L");
    } else {
      a.wins++; a.awayWins++; h.losses++; h.homeLosses++;
      a.results.push("W"); h.results.push("L");
    }
  }
  const rows = [...acc.values()].map((a) => {
    const games = a.wins + a.losses;
    const last = a.results[a.results.length - 1];
    let n = 0;
    for (let i = a.results.length - 1; i >= 0 && a.results[i] === last; i--) n++;
    const { results, ...rest } = a;
    return {
      ...rest,
      games,
      pct: games ? a.wins / games : 0,
      last5: results.slice(-5),
      streak: last ? `${n}${last === "W" ? "연승" : "연패"}` : "",
      streakKind: last ?? null,
      streakCount: n,
      rank: 0,
      gamesBehind: 0,
    };
  });
  rows.sort((x, y) => y.pct - x.pct || y.wins - x.wins || (y.pointsFor - y.pointsAgainst) - (x.pointsFor - x.pointsAgainst) || x.name.localeCompare(y.name, "ko"));
  const top = rows[0];
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && prev.pct === r.pct && prev.wins === r.wins ? prev.rank : i + 1;
    r.gamesBehind = top ? (top.wins - r.wins + (r.losses - top.losses)) / 2 : 0;
  });
  return rows;
}

/** 승률 표기 ".625" (1.000 은 "1.000") */
export const pctLabel = (p: number) => (p >= 1 ? "1.000" : p.toFixed(3).replace(/^0/, ""));
/** 게임 차 표기 (0 → "-", 0.5 단위) */
export const gamesBehindLabel = (gb: number) => (gb === 0 ? "-" : Number.isInteger(gb) ? String(gb) : gb.toFixed(1));

// ─────────────────────────────────────────────
// 시즌 일정 (2026-10-03 사용자: 날짜별 경기 일정·박스스코어, 메뉴 "일정")
// ─────────────────────────────────────────────

/** 날짜별로 묶기 (날짜 오름차순, 날짜 안은 원래 순서) */
export function groupByDate<T extends { date: string }>(games: readonly T[]): { date: string; games: T[] }[] {
  const map = new Map<string, T[]>();
  for (const g of [...games].sort((a, b) => a.date.localeCompare(b.date))) {
    const list = map.get(g.date) ?? [];
    list.push(g);
    map.set(g.date, list);
  }
  return [...map].map(([date, games]) => ({ date, games }));
}

/** 경기가 있는 달 "2026-10" 목록 (오름차순) */
export function monthsOf(games: readonly { date: string }[]): string[] {
  return [...new Set(games.map((g) => g.date.slice(0, 7)))].sort();
}

/** "2026-10" → "10월" (해가 바뀌는 시즌이라 1월은 "1월") */
export const monthLabel = (ym: string) => `${Number(ym.slice(5, 7))}월`;

/**
 * 처음 펼칠 달: today 가 든 달에 경기가 있으면 그 달, today 가 시즌 뒤면 마지막 달, 앞이면 첫 달.
 * today 가 달 목록 사이(경기 없는 달)면 그 뒤 첫 달.
 */
export function pickMonth(months: readonly string[], today: string): string | null {
  if (months.length === 0) return null;
  const ym = today.slice(0, 7);
  if (months.includes(ym)) return ym;
  if (ym > months[months.length - 1]) return months[months.length - 1];
  return months.find((m) => m > ym) ?? months[0];
}

/** 박스스코어 정렬 열 */
export type BoxSortKey = "sec" | "pts" | "reb" | "ast" | "stl" | "blk" | "tov" | "fgm" | "fgPct" | "tpm" | "tpPct" | "ftm" | "ftPct";

/** 성공률 % (시도 0 이면 null) */
const pctOf = (m: number, a: number) => (a > 0 ? (m / a) * 100 : null);
/** 야투율 (시도 0 이면 null) */
export const fgPctOf = (r: { fgm: number; fga: number }) => pctOf(r.fgm, r.fga);
/** 3점 성공률 */
export const tpPctOf = (r: { tpm: number; tpa: number }) => pctOf(r.tpm, r.tpa);
/** 자유투 성공률 */
export const ftPctOf = (r: { ftm: number; fta: number }) => pctOf(r.ftm, r.fta);

/** 박스스코어 줄 내림차순 정렬 (값이 같으면 득점 → 출전 시간 → 이름, 야투율 없는 줄은 뒤로) */
export function sortBoxRows(rows: readonly GameBoxRow[], key: BoxSortKey): GameBoxRow[] {
  const val = (r: GameBoxRow): number => {
    if (key === "fgPct") return fgPctOf(r) ?? -1;
    if (key === "tpPct") return tpPctOf(r) ?? -1;
    if (key === "ftPct") return ftPctOf(r) ?? -1;
    return r[key];
  };
  return [...rows].sort((a, b) => val(b) - val(a) || b.pts - a.pts || b.sec - a.sec || a.nameKo.localeCompare(b.nameKo, "ko"));
}

// ─────────────────────────────────────────────
// 일정 화면 "내 응원팀만" (2026-10-06)
// ─────────────────────────────────────────────

/** 일정 보기 범위: 내 응원팀 경기만 / 전체 */
export type ScheduleScope = "mine" | "all";

/** 응원팀(팀 코드 여러 개) 중 하나라도 뛰는 경기만 (순서 그대로) */
export function gamesOfTeams<T extends { home: { teamCode: string }; away: { teamCode: string } }>(
  games: readonly T[],
  teamCodes: readonly string[],
): T[] {
  const set = new Set(teamCodes);
  return games.filter((g) => set.has(g.home.teamCode) || set.has(g.away.teamCode));
}

/**
 * 처음 보기 범위: 응원팀 경기가 이 시즌에 없으면 전체, 아니면 이 브라우저에서 마지막으로 고른 것(없으면 내 응원팀).
 * saved 는 localStorage 값 그대로(모르는 값은 무시).
 */
export function initialScheduleScope(saved: string | null | undefined, hasTeamGames: boolean): ScheduleScope {
  if (!hasTeamGames) return "all";
  return saved === "all" ? "all" : "mine";
}

// ─────────────────────────────────────────────
// "이 경기 포인트" (2026-10-08 토스 검토 B-8: 토스증권 "왜 올랐을까?" 요점 3줄처럼) — 박스스코어 팝업 위 2~3줄.
// AI 를 쓰지 않고 박스스코어 숫자로만 만든다. 문턱은 우리 규칙(아래 상수).
// ─────────────────────────────────────────────

/** 접전·대승 점수 차 */
export const POINT_CLOSE_MARGIN = 3;
export const POINT_BLOWOUT_MARGIN = 20;
/** 한 선수 득점이 이 이상이면 그 선수를 먼저 (트리플더블이 없을 때) */
export const POINT_BIG_SCORE = 30;
/** 팀 기록 차이 문턱 — 이만큼 넘게 벌어진 것 중 문턱 대비 가장 큰 것 하나 */
export const POINT_TEAM_EDGES = [
  { key: "reb", label: "리바운드", min: 8, better: "high" },
  { key: "tpm", label: "3점", min: 5, better: "high" },
  { key: "ast", label: "어시스트", min: 8, better: "high" },
  { key: "tov", label: "턴오버", min: 6, better: "low" },
] as const;

type BoxSide = "home" | "away";

function teamSum(rows: readonly GameBoxRow[], key: "reb" | "tpm" | "ast" | "tov"): number {
  return rows.reduce((n, r) => n + r[key], 0);
}

/** 10개 넘긴 부문 수 (득점·리바·어시·스틸·블록) */
function doubleCount(r: GameBoxRow): number {
  return [r.pts, r.reb, r.ast, r.stl, r.blk].filter((v) => v >= 10).length;
}

function doubleLine(r: GameBoxRow): string {
  const parts: string[] = [`${r.pts}점`];
  if (r.reb >= 10) parts.push(`${r.reb}리바`);
  if (r.ast >= 10) parts.push(`${r.ast}어시`);
  if (r.stl >= 10) parts.push(`${r.stl}스틸`);
  if (r.blk >= 10) parts.push(`${r.blk}블록`);
  return parts.join(" ");
}

/** 경기 요점 최대 3줄. names = 팀 약칭. 박스스코어가 없거나 안 끝난 경기는 [] */
export function gameKeyPoints(g: SeasonGame, names: Record<BoxSide, string>): string[] {
  const win = winnerSide(g);
  if (!g.box || !win || g.home.score === null || g.away.score === null) return [];
  const out: string[] = [];
  const lose: BoxSide = win === "home" ? "away" : "home";
  const margin = Math.abs(g.home.score - g.away.score);
  if (margin <= POINT_CLOSE_MARGIN) out.push(`${names[win]} ${margin}점 차 접전 끝에 승리`);
  else if (margin >= POINT_BLOWOUT_MARGIN) out.push(`${names[win]} ${margin}점 차 대승`);

  // 선수 한 명: 트리플더블 → 30점 이상 → 더블더블 (같은 줄에선 득점 많은 선수)
  const all = (["home", "away"] as const).flatMap((k) => g.box![k].map((r) => ({ r, side: k })));
  const byPts = [...all].sort((a, b) => b.r.pts - a.r.pts || b.r.reb - a.r.reb || b.r.ast - a.r.ast);
  const triple = byPts.find((x) => doubleCount(x.r) >= 3);
  const big = byPts.find((x) => x.r.pts >= POINT_BIG_SCORE);
  const dbl = byPts.find((x) => doubleCount(x.r) >= 2);
  if (triple) out.push(`${triple.r.nameKo}(${names[triple.side]}) 트리플더블 · ${doubleLine(triple.r)}`);
  else if (big) out.push(`${big.r.nameKo}(${names[big.side]}) ${big.r.pts}점 · 야투 ${big.r.fgm}/${big.r.fga}${big.r.tpm >= 3 ? ` · 3점 ${big.r.tpm}개` : ""}`);
  else if (dbl) out.push(`${dbl.r.nameKo}(${names[dbl.side]}) 더블더블 · ${doubleLine(dbl.r)}`);

  // 팀 기록 차이: 문턱 대비 가장 크게 벌어진 것 하나 (이긴 팀이 앞선 것을 먼저)
  let edge: { text: string; score: number } | null = null;
  for (const e of POINT_TEAM_EDGES) {
    const w = teamSum(g.box[win], e.key);
    const l = teamSum(g.box[lose], e.key);
    const diff = e.better === "high" ? w - l : l - w; // 이긴 팀 기준 앞선 만큼
    const abs = Math.abs(diff);
    if (abs < e.min) continue;
    const side = diff > 0 ? win : lose;
    const mine = side === win ? w : l;
    const theirs = side === win ? l : w;
    const text =
      e.better === "high"
        ? `${names[side]} ${e.label} ${abs}개 더 (${mine}-${theirs})`
        : `${names[side]} ${e.label} ${abs}개 적음 (${mine}-${theirs})`;
    const score = (abs / e.min) * (diff > 0 ? 1.2 : 1);
    if (!edge || score > edge.score) edge = { text, score };
  }
  if (edge) out.push(edge.text);
  return out.slice(0, 3);
}

/**
 * 응원팀 경기를 앞으로 (2026-10-08 토스 검토 C-11 가벼운 안: 홈 편집 화면 대신 자동 맞춤).
 * 응원팀을 고른 순서대로(첫 팀 경기가 맨 앞), 나머지는 원래 순서 그대로. 응원팀이 없으면 그대로.
 */
export function myTeamsFirst<T extends { home: { teamCode: string }; away: { teamCode: string } }>(
  games: readonly T[],
  teamCodes: readonly string[],
): T[] {
  if (teamCodes.length === 0) return games.slice();
  const rank = (g: T) => {
    const i = teamCodes.findIndex((c) => c === g.home.teamCode || c === g.away.teamCode);
    return i < 0 ? teamCodes.length : i;
  };
  return games.map((g, i) => ({ g, i, r: rank(g) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.g);
}

/** 일정 화면에서 펼쳐 둘 지난 경기일 수 (2026-10-09 사용자: 모바일 세로 스크롤이 너무 길다 → 최근 2일만) */
export const SCHEDULE_RECENT_PAST_DAYS = 2;

/**
 * 일정 날짜 묶음 → 접어 둘 지난 날 / 보일 날. 오늘보다 앞선 경기일 중 가장 최근 keep 일과 오늘·앞으로의 날은 보이고,
 * 그보다 오래된 날은 접는다. today 를 모르면(첫 화면 그리기 전) 접지 않는다.
 */
export function splitPastDays<T extends { date: string }>(
  days: readonly T[],
  today: string | null,
  keep = SCHEDULE_RECENT_PAST_DAYS,
): { hidden: T[]; visible: T[] } {
  if (!today) return { hidden: [], visible: days.slice() };
  const pastCount = days.filter((d) => d.date < today).length;
  const cut = Math.max(0, pastCount - keep);
  return { hidden: days.slice(0, cut), visible: days.slice(cut) };
}

// ─────────────────────────────────────────────
// 팀 간 상대 전적 (2026-10-14 스포츠 앱 비교 A-1 — KBO STATS "팀간전적" 탭 참고). 끝난 정규시즌 경기 점수로 센다.
// ─────────────────────────────────────────────

export interface HeadToHeadRecord {
  wins: number;
  losses: number;
  /** 득점·실점 합 */
  pointsFor: number;
  pointsAgainst: number;
}

/** 팀 → 상대 팀 → 전적 */
export function headToHead(games: readonly SeasonGame[]): Map<string, Map<string, HeadToHeadRecord>> {
  const out = new Map<string, Map<string, HeadToHeadRecord>>();
  const rec = (team: string, opp: string) => {
    let m = out.get(team);
    if (!m) out.set(team, (m = new Map()));
    let r = m.get(opp);
    if (!r) m.set(opp, (r = { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }));
    return r;
  };
  for (const g of games) {
    const w = winnerSide(g);
    if (!w || !g.home.teamCode || !g.away.teamCode) continue;
    const h = rec(g.home.teamCode, g.away.teamCode);
    const a = rec(g.away.teamCode, g.home.teamCode);
    h.pointsFor += g.home.score!; h.pointsAgainst += g.away.score!;
    a.pointsFor += g.away.score!; a.pointsAgainst += g.home.score!;
    if (w === "home") { h.wins++; a.losses++; } else { a.wins++; h.losses++; }
  }
  return out;
}

/**
 * 순위 표 순서대로 상대 전적 승 수 표 — wins[i][j] = i 팀이 j 팀에게 이긴 수 (진 수는 wins[j][i]).
 * 같은 팀 칸·맞붙은 적 없는 칸은 0 (화면은 games[i][j] = wins[i][j] + wins[j][i] 가 0 이면 "–").
 */
export function headToHeadWins(order: readonly string[], games: readonly SeasonGame[]): number[][] {
  const h2h = headToHead(games);
  return order.map((a) => order.map((b) => (a === b ? 0 : (h2h.get(a)?.get(b)?.wins ?? 0))));
}

// ─────────────────────────────────────────────
// 팀 경기 띠 (2026-10-14 스포츠 앱 비교 B-3 — KBO STATS 마이팀 날짜 칸): 지난 경기 몇 개 + 다음 경기 몇 개
// ─────────────────────────────────────────────

export const TEAM_STRIP_PAST = 3;
export const TEAM_STRIP_NEXT = 2;

export interface TeamStripGame {
  gmkey: string;
  date: string;
  start: string | null;
  /** 이 팀이 홈 */
  home: boolean;
  oppCode: string;
  oppName: string;
  /** 끝난 경기만 (아니면 null) */
  teamScore: number | null;
  oppScore: number | null;
  /** 이겼으면 true, 졌으면 false, 아직이면 null */
  win: boolean | null;
}

/** 시즌 경기에서 이 팀의 지난 경기(최근 past 개, 오래된 → 최근)와 다음 경기(next 개, 가까운 순) */
export function teamGameStrip(
  games: readonly SeasonGame[],
  teamCode: string,
  past = TEAM_STRIP_PAST,
  next = TEAM_STRIP_NEXT,
): { past: TeamStripGame[]; next: TeamStripGame[] } {
  const mine = games
    .filter((g) => g.home.teamCode === teamCode || g.away.teamCode === teamCode)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? ""));
  const toStrip = (g: SeasonGame): TeamStripGame => {
    const home = g.home.teamCode === teamCode;
    const me = home ? g.home : g.away;
    const opp = home ? g.away : g.home;
    const w = winnerSide(g);
    return {
      gmkey: g.gmkey,
      date: g.date,
      start: g.start,
      home,
      oppCode: opp.teamCode,
      oppName: opp.name,
      teamScore: w ? me.score : null,
      oppScore: w ? opp.score : null,
      win: w ? (w === "home") === home : null,
    };
  };
  const ended = mine.filter((g) => winnerSide(g));
  const upcoming = mine.filter((g) => !g.ended && !winnerSide(g));
  return { past: ended.slice(-past).map(toStrip), next: upcoming.slice(0, next).map(toStrip) };
}

// ─────────────────────────────────────────────
// 선수 최근 경기 (2026-10-14 스포츠 앱 비교 5 — NBA·ESPN 선수 화면의 "최근 경기"). 박스스코어가 있는 시즌만
// ─────────────────────────────────────────────

export const RECENT_GAMES_COUNT = 5;

/** 경기 화면에 쓰는 상대 팀 이름·로고 한 줄 */
export interface OppBrand {
  shortName: string;
  logoUrl: string | null;
  color: TeamColor;
}

/** 팀 페이지 상대 전적 한 줄 (그 시즌 상대 팀 이름·로고 + 전적) */
export interface TeamHeadToHeadLine extends HeadToHeadRecord, OppBrand {
  teamCode: string;
}

export interface PlayerRecentGame {
  gmkey: string;
  date: string;
  home: boolean;
  oppCode: string;
  oppName: string;
  teamScore: number;
  oppScore: number;
  win: boolean;
  sec: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tpm: number;
  fgm: number;
  fga: number;
}

/** 시즌 경기에서 이 선수가 뛴 최근 n 경기 (최근 먼저). 박스스코어가 없는 시즌이면 [] */
export function playerRecentGames(games: readonly SeasonGame[], playerNo: string, n = RECENT_GAMES_COUNT): PlayerRecentGame[] {
  const out: PlayerRecentGame[] = [];
  const ordered = [...games].sort((a, b) => b.date.localeCompare(a.date) || (b.start ?? "").localeCompare(a.start ?? ""));
  for (const g of ordered) {
    if (out.length >= n) break;
    const w = winnerSide(g);
    if (!w || !g.box) continue;
    for (const side of ["home", "away"] as const) {
      const r = g.box[side].find((x) => x.id === playerNo);
      if (!r || r.sec <= 0) continue;
      const opp = side === "home" ? g.away : g.home;
      out.push({
        gmkey: g.gmkey,
        date: g.date,
        home: side === "home",
        oppCode: opp.teamCode,
        oppName: opp.name,
        teamScore: g[side].score!,
        oppScore: opp.score!,
        win: w === side,
        sec: r.sec,
        pts: r.pts,
        reb: r.reb,
        ast: r.ast,
        stl: r.stl,
        blk: r.blk,
        tpm: r.tpm,
        fgm: r.fgm,
        fga: r.fga,
      });
      break;
    }
  }
  return out;
}

/** 경기 일정 화면의 그날로 가는 주소 (경기 띠·최근 경기 줄 공용) */
export const scheduleDayHref = (seasonCode: number, date: string) => `/season/${seasonCode}/schedule?date=${date}`;

// ── 일정 달력 띠 (2026-10-14 스포츠 앱 비교 2번 — 레사모 달력) ─────────────
/** 달력 띠 한 칸: 그 달 하루 */
export interface CalendarDay {
  /** "2026-10-03" */
  date: string;
  day: number;
  /** "일"~"토" */
  weekday: string;
  /** 0 일요일 · 6 토요일 */
  weekdayIndex: number;
  /** 그날 경기 수 (보이는 범위 기준) */
  games: number;
  /** 내 응원팀 경기 — 그날 첫 경기의 상대 팀·결과 (내 팀 기준, 안 끝났으면 null) */
  mine: { oppCode: string; result: "win" | "loss" | null } | null;
}

/** "2026-10" 달의 날짜 칸 1일~말일. myCodes 가 있으면 그 팀이 나온 첫 경기를 mine 으로 */
export function monthCalendar(month: string, games: readonly SeasonGame[], myCodes: readonly string[] = []): CalendarDay[] {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return [];
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const byDate = new Map<string, SeasonGame[]>();
  for (const g of games) {
    if (g.date.slice(0, 7) !== month) continue;
    const list = byDate.get(g.date) ?? [];
    list.push(g);
    byDate.set(g.date, list);
  }
  const mySet = new Set(myCodes);
  const out: CalendarDay[] = [];
  for (let d = 1; d <= last; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    const list = byDate.get(date) ?? [];
    let mine: CalendarDay["mine"] = null;
    if (mySet.size > 0) {
      const g = list.find((x) => mySet.has(x.home.teamCode) || mySet.has(x.away.teamCode));
      if (g) {
        const side = mySet.has(g.home.teamCode) ? "home" : "away";
        const opp = side === "home" ? g.away : g.home;
        const win = winnerSide(g);
        mine = { oppCode: opp.teamCode, result: win === null ? null : win === side ? "win" : "loss" };
      }
    }
    out.push({ date, day: d, weekday: WEEKDAYS[wd], weekdayIndex: wd, games: list.length, mine });
  }
  return out;
}
