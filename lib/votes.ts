// 팬 참여 (2026-10-16, 로드맵 1단계 — 로그인 회원만): ① 이번 주 팬 MVP 투표 ② 경기 승부 예측. 순수 함수만.
// 후보·경기 표는 빌드 때 data/processed/{시즌}/games.json 으로 만들어 public/vote/data.json 에 둔다(scripts/build-votes.ts).
// 화면은 같은 함수로 정적 HTML 을 만들고, 서버(API)는 그 정적 파일을 한 번 받아 투표·예측이 맞는지 검사한다(lib/server/vote-data.ts).
// 자유 글은 어디에도 없다 — 선수 번호·홈/원정만 저장.
import { kstWeekStart } from "./account";
import { winnerSide } from "./games";
import type { SeasonGame } from "./types";

const KST_MS = 9 * 3600_000;
const DAY_MS = 24 * 3600_000;

// ── 주 (한국 시간 월요일 0시 ~ 일요일 밤) ──

/** 주 이름 = 그 주 월요일 한국 날짜 "2026-10-12" (offset -1 = 지난주) */
export function voteWeekKey(now: Date, offset = 0): string {
  return new Date(kstWeekStart(now, offset).getTime() + KST_MS).toISOString().slice(0, 10);
}

/** 경기 날짜("2026-10-14") → 그 주 이름 */
export function weekKeyOfDate(date: string): string {
  const t = Date.parse(`${date}T12:00:00+09:00`);
  return voteWeekKey(new Date(t));
}

/** 주 이름 → 그 주 시작 시각(월요일 0시 KST) */
export function weekStartOf(key: string): Date {
  return new Date(Date.parse(`${key}T00:00:00+09:00`));
}

/** 주 이름 → "10.12(월) ~ 10.18(일)" */
export function voteWeekLabel(key: string): string {
  const s = weekStartOf(key).getTime() + KST_MS;
  const f = (t: number) => {
    const d = new Date(t);
    return `${d.getUTCMonth() + 1}.${d.getUTCDate()}`;
  };
  return `${f(s)}(월) ~ ${f(s + 6 * DAY_MS)}(일)`;
}

export const isWeekKey = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// ── 팬 MVP 후보 ──

/** 화면에 처음 보이는 후보 수 */
export const VOTE_SHOW = 12;
/** 파일에 넣는 후보 수 (그 주 최소 경기를 채운 선수 중 기록 점수 순) */
export const VOTE_FILE_LIMIT = 40;
/** 파일에 넣는 주 수 (최근부터) */
export const VOTE_FILE_WEEKS = 4;

export interface VoteCandidate {
  id: string;
  nameKo: string;
  /** 그 주 마지막 경기 팀 */
  teamCode: string;
  photoUrl: string | null;
  games: number;
  /** 경기당 (소수 한 자리) */
  pts: number;
  reb: number;
  ast: number;
  /** 기록 점수 = 경기당 득점 + 리바운드 + 어시스트 (우리 규칙 — 줄 세우기용) */
  score: number;
}

export interface VoteWeek {
  week: string;
  /** 후보가 되는 최소 경기 (voteMinGames — 팀들이 2경기씩 치른 뒤부터 2) */
  minGames: number;
  /** 기록 점수 순 */
  players: VoteCandidate[];
}

/** 경기 승부 예측용 경기 한 줄 (서버 검사·채점) */
export interface PickGame {
  gmkey: string;
  date: string;
  start: string | null;
  home: string;
  away: string;
  ended: boolean;
  winner: PickSide | null;
}

export interface VoteDataFile {
  version: 1;
  seasonCode: number;
  builtAt: string;
  /** 최근 주부터 */
  weeks: VoteWeek[];
  games: PickGame[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** 후보 최소 경기: 그 주 팀들이 치른 경기 수의 가운데값이 2 이상이면 2, 아니면 1 (주 초반엔 1경기 선수도 후보) */
export function voteMinGames(teamGames: ReadonlyMap<string, number>): number {
  const list = [...teamGames.values()].sort((a, b) => a - b);
  if (list.length === 0) return 1;
  const mid = list[Math.floor((list.length - 1) / 2)];
  return mid >= 2 ? 2 : 1;
}

/** 한 주 후보 (박스스코어가 있는 끝난 경기만) */
export function buildVoteWeek(games: readonly SeasonGame[], week: string, photoOf: (id: string) => string | null = () => null): VoteWeek | null {
  type Acc = { id: string; nameKo: string; teamCode: string; lastDate: string; games: number; pts: number; reb: number; ast: number };
  const acc = new Map<string, Acc>();
  const teamGames = new Map<string, number>();
  for (const g of games) {
    if (!g.ended || !g.box || weekKeyOfDate(g.date) !== week) continue;
    for (const side of ["home", "away"] as const) teamGames.set(g[side].teamCode, (teamGames.get(g[side].teamCode) ?? 0) + 1);
    for (const side of ["home", "away"] as const) {
      for (const row of g.box[side]) {
        if (row.sec <= 0) continue;
        const a = acc.get(row.id) ?? { id: row.id, nameKo: row.nameKo, teamCode: g[side].teamCode, lastDate: g.date, games: 0, pts: 0, reb: 0, ast: 0 };
        a.games += 1;
        a.pts += row.pts;
        a.reb += row.reb;
        a.ast += row.ast;
        if (g.date >= a.lastDate) {
          a.lastDate = g.date;
          a.teamCode = g[side].teamCode;
        }
        acc.set(row.id, a);
      }
    }
  }
  if (acc.size === 0) return null;
  const all = [...acc.values()];
  const minGames = voteMinGames(teamGames);
  const players = all
    .filter((a) => a.games >= minGames)
    .map((a) => {
      const pts = r1(a.pts / a.games);
      const reb = r1(a.reb / a.games);
      const ast = r1(a.ast / a.games);
      return { id: a.id, nameKo: a.nameKo, teamCode: a.teamCode, photoUrl: photoOf(a.id), games: a.games, pts, reb, ast, score: r1(pts + reb + ast), total: a.pts };
    })
    .sort((a, b) => b.score - a.score || b.total - a.total || a.nameKo.localeCompare(b.nameKo, "ko"))
    .slice(0, VOTE_FILE_LIMIT)
    .map(({ total: _t, ...c }) => c);
  return { week, minGames, players };
}

/** 시즌 경기 → 정적 파일 내용 */
export function buildVoteData(seasonCode: number, games: readonly SeasonGame[], photoOf: (id: string) => string | null = () => null, builtAt = new Date()): VoteDataFile {
  const weekKeys = [...new Set(games.filter((g) => g.ended && g.box).map((g) => weekKeyOfDate(g.date)))].sort().reverse().slice(0, VOTE_FILE_WEEKS);
  const weeks = weekKeys.flatMap((w) => {
    const v = buildVoteWeek(games, w, photoOf);
    return v ? [v] : [];
  });
  return {
    version: 1,
    seasonCode,
    builtAt: builtAt.toISOString(),
    weeks,
    games: games.map((g) => ({
      gmkey: g.gmkey,
      date: g.date,
      start: g.start,
      home: g.home.teamCode,
      away: g.away.teamCode,
      ended: g.ended,
      winner: winnerSide(g),
    })),
  };
}

export const findVoteWeek = (weeks: readonly VoteWeek[], key: string): VoteWeek | null => weeks.find((w) => w.week === key) ?? null;

/** 그 주 후보인가 (서버 검사) */
export function isVoteCandidate(weeks: readonly VoteWeek[], key: string, playerNo: unknown): playerNo is string {
  if (typeof playerNo !== "string" || !/^\d{1,10}$/.test(playerNo)) return false;
  return findVoteWeek(weeks, key)?.players.some((p) => p.id === playerNo) ?? false;
}

/** 기록 한 줄 "3경기 24.3점 9.0리바 5.0어시" */
export const candidateLine = (c: Pick<VoteCandidate, "games" | "pts" | "reb" | "ast">): string =>
  `${c.games}경기 ${c.pts.toFixed(1)}점 ${c.reb.toFixed(1)}리바 ${c.ast.toFixed(1)}어시`;

export interface VoteTally {
  week: string;
  /** 선수 번호 → 표 수 */
  counts: Record<string, number>;
  total: number;
}

export interface VoteResultRow {
  candidate: VoteCandidate;
  votes: number;
  /** 0~100 정수 */
  pct: number;
}

/** 후보 + 표 → 표 많은 순 (같으면 기록 점수 순 = 후보 순서). 표가 없는 후보도 뒤에 남는다 */
export function voteResults(week: VoteWeek, tally: VoteTally | null): VoteResultRow[] {
  const counts = tally?.counts ?? {};
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  return week.players
    .map((c, i) => ({ c, i, votes: counts[c.id] ?? 0 }))
    .sort((a, b) => b.votes - a.votes || a.i - b.i)
    .map(({ c, votes }) => ({ candidate: c, votes, pct: total > 0 ? Math.round((votes / total) * 100) : 0 }));
}

/** 팬 MVP (표가 하나라도 있을 때만) */
export function fanMvp(week: VoteWeek, tally: VoteTally | null): VoteResultRow | null {
  const top = voteResults(week, tally)[0];
  return top && top.votes > 0 ? top : null;
}

// ── 경기 승부 예측 ──

export type PickSide = "home" | "away";
export const parsePickSide = (v: unknown): PickSide | null => (v === "home" || v === "away" ? v : null);
export const isGmkey = (v: unknown): v is string => typeof v === "string" && /^S\d{1,3}G\d{2}N\d{1,4}$/.test(v);
/** 시작 시각을 모르는 경기는 그날 이 시각에 마감 (KBL 주말 낮 경기가 가장 이르다) */
export const PICK_FALLBACK_START = "14:00";
/** 시즌 예측 순위에 오르는 최소 채점 경기 수 */
export const PICK_RANKING_MIN = 10;
export const PICK_RANKING_LIMIT = 50;

/** 예측 마감 시각 = 경기 시작 (한국 시간) */
export function pickLockAt(g: { date: string; start: string | null }): Date {
  const start = g.start && /^\d{1,2}:\d{2}$/.test(g.start) ? g.start.padStart(5, "0") : PICK_FALLBACK_START;
  return new Date(Date.parse(`${g.date}T${start}:00+09:00`));
}

/** 아직 예측할 수 있나 (끝나지 않았고 시작 전) */
export function isPickOpen(g: { date: string; start: string | null; ended: boolean }, now: Date): boolean {
  return !g.ended && now.getTime() < pickLockAt(g).getTime();
}

/** 경기마다 [홈, 원정] 예측 수 */
export type PickCounts = Record<string, [number, number]>;

/** 팬 예측 비율 → 더 많은 쪽과 % (예측이 없으면 null) */
export function pickShare(c: [number, number] | undefined): { side: PickSide; pct: number; total: number } | null {
  if (!c) return null;
  const total = c[0] + c[1];
  if (total === 0) return null;
  const side: PickSide = c[0] >= c[1] ? "home" : "away";
  return { side, pct: Math.round(((side === "home" ? c[0] : c[1]) / total) * 100), total };
}

/** 채점할 경기 (끝났고 승패가 있는 경기) */
export function settledGames(games: readonly PickGame[]): { gmkeys: string[]; winners: PickSide[] } {
  const done = games.filter((g) => g.ended && g.winner);
  return { gmkeys: done.map((g) => g.gmkey), winners: done.map((g) => g.winner as PickSide) };
}

export interface PickRecord {
  hits: number;
  total: number;
}

export interface MyPicks extends PickRecord {
  /** gmkey → 고른 쪽 */
  picks: Record<string, PickSide>;
}

/** 적중률 표기 "70%" (채점 0경기면 "–") */
export const hitRateLabel = (r: PickRecord): string => (r.total > 0 ? `${Math.round((r.hits / r.total) * 100)}%` : "–");

export interface PickRankRow extends PickRecord {
  rank: number;
  nickname: string;
  teamCode: string | null;
}

export interface PickRanking {
  rows: PickRankRow[];
  /** 순위 조건(채점 PICK_RANKING_MIN 경기 이상)을 채운 회원 수 */
  members: number;
  minPicks: number;
}

/** 이미 정렬된 줄에 순위 (적중 수·채점 수가 같으면 같은 순위 — 1,2,2,4) */
export function rankPickRows(rows: readonly Omit<PickRankRow, "rank">[]): PickRankRow[] {
  const out: PickRankRow[] = [];
  rows.forEach((r, i) => {
    const prev = out[i - 1];
    const rank = prev && prev.hits === r.hits && prev.total === r.total ? prev.rank : i + 1;
    out.push({ ...r, rank });
  });
  return out;
}
