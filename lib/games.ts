// 시즌 경기 규칙 (순수) — 홈 "오늘의 경기"·팀 순위 (2026-10-03 사용자 요청). 재료는 data/processed/{시즌}/games.json (scripts/boxscores.ts).
import type { GameBoxRow, GameSide, SeasonGame } from "./types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-10-03" → "10월 3일 (토)" */
export function gameDayLabel(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const wd = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return `${Number(m[2])}월 ${Number(m[3])}일 (${WEEKDAYS[wd]})`;
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
}

export function computeStandings(games: readonly SeasonGame[]): StandingRow[] {
  type Acc = Omit<StandingRow, "rank" | "games" | "pct" | "gamesBehind" | "last5" | "streak"> & { results: ("W" | "L")[] };
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
