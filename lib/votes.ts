// 팬 참여 (2026-10-16, 로드맵 1단계 — 로그인 회원만): 이번 주 팬 MVP 투표. 순수 함수만.
// (경기 승부 예측은 같은 날 사용자 결정으로 폐지 — 경기 카드가 복잡해져서)
// 후보는 빌드 때 data/processed/{시즌}/games.json 으로 만들어 public/vote/data.json 에 둔다(scripts/build-votes.ts).
// 화면은 같은 함수로 정적 HTML 을 만들고, 서버(API)는 그 정적 파일을 한 번 받아 투표가 맞는지 검사한다(lib/server/vote-data.ts).
// 자유 글은 어디에도 없다 — 선수 번호만 저장.
import { kstWeekStart } from "./account";
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
// 2026-10-16 사용자: 득점 순으로 늘어놓으면 득점이 전부처럼 보인다 → 팀마다 한 명씩, 그 주에 가장 눈에 띈 기록을 보인 선수(5~10명).
// 눈에 띈 정도 = 그 주 경기당 기록 ÷ 문턱(VOTE_HIGHLIGHTS) 중 가장 큰 값. 문턱은 "한 경기에 이 정도면 돋보인다"는 우리 규칙.

/** 후보 부문과 문턱 (경기당) */
export type VoteHighlight = "pts" | "reb" | "ast" | "tpm" | "def";
export const VOTE_HIGHLIGHTS: readonly { key: VoteHighlight; label: string; min: number }[] = [
  { key: "pts", label: "득점", min: 20 },
  { key: "reb", label: "리바운드", min: 10 },
  { key: "ast", label: "어시스트", min: 7 },
  { key: "tpm", label: "3점슛", min: 3 },
  { key: "def", label: "스틸+블록", min: 3 },
];
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
  tpm: number;
  stl: number;
  blk: number;
  /** 가장 눈에 띈 부문 */
  highlight: VoteHighlight;
  /** 눈에 띈 정도 = 그 부문 경기당 ÷ 문턱 (소수 둘째 자리 — 줄 세우기용) */
  score: number;
}

export interface VoteWeek {
  week: string;
  /** 후보가 되는 최소 경기 (voteMinGames — 팀들이 2경기씩 치른 뒤부터 2, 그 주 1경기만 한 팀은 1) */
  minGames: number;
  /** 팀마다 한 명, 눈에 띈 정도 순 */
  players: VoteCandidate[];
}

export interface VoteDataFile {
  version: 1;
  seasonCode: number;
  builtAt: string;
  /** 최근 주부터 */
  weeks: VoteWeek[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** 후보 최소 경기: 그 주 팀들이 치른 경기 수의 가운데값이 2 이상이면 2, 아니면 1 (주 초반엔 1경기 선수도 후보) */
export function voteMinGames(teamGames: ReadonlyMap<string, number>): number {
  const list = [...teamGames.values()].sort((a, b) => a - b);
  if (list.length === 0) return 1;
  const mid = list[Math.floor((list.length - 1) / 2)];
  return mid >= 2 ? 2 : 1;
}

const highlightValue = (c: Pick<VoteCandidate, "pts" | "reb" | "ast" | "tpm" | "stl" | "blk">, key: VoteHighlight): number =>
  key === "def" ? c.stl + c.blk : c[key];

/** 가장 눈에 띈 부문과 그 정도, 모든 부문 정도의 합 (같으면 VOTE_HIGHLIGHTS 순서가 먼저) */
export function voteHighlightOf(c: Pick<VoteCandidate, "pts" | "reb" | "ast" | "tpm" | "stl" | "blk">): { key: VoteHighlight; score: number; sum: number } {
  let best: { key: VoteHighlight; score: number } = { key: "pts", score: -1 };
  let sum = 0;
  for (const h of VOTE_HIGHLIGHTS) {
    const r = highlightValue(c, h.key) / h.min;
    sum += r;
    if (r > best.score) best = { key: h.key, score: r };
  }
  return { ...best, sum };
}

/** 한 주 후보 (박스스코어가 있는 끝난 경기만) — 그 주 뛴 팀마다 한 명 */
export function buildVoteWeek(games: readonly SeasonGame[], week: string, photoOf: (id: string) => string | null = () => null): VoteWeek | null {
  type Acc = { id: string; nameKo: string; teamCode: string; lastDate: string; games: number; pts: number; reb: number; ast: number; tpm: number; stl: number; blk: number };
  const acc = new Map<string, Acc>();
  const teamGames = new Map<string, number>();
  for (const g of games) {
    if (!g.ended || !g.box || weekKeyOfDate(g.date) !== week) continue;
    for (const side of ["home", "away"] as const) teamGames.set(g[side].teamCode, (teamGames.get(g[side].teamCode) ?? 0) + 1);
    for (const side of ["home", "away"] as const) {
      for (const row of g.box[side]) {
        if (row.sec <= 0) continue;
        const a = acc.get(row.id) ?? { id: row.id, nameKo: row.nameKo, teamCode: g[side].teamCode, lastDate: g.date, games: 0, pts: 0, reb: 0, ast: 0, tpm: 0, stl: 0, blk: 0 };
        a.games += 1;
        a.pts += row.pts;
        a.reb += row.reb;
        a.ast += row.ast;
        a.tpm += row.tpm;
        a.stl += row.stl;
        a.blk += row.blk;
        if (g.date >= a.lastDate) {
          a.lastDate = g.date;
          a.teamCode = g[side].teamCode;
        }
        acc.set(row.id, a);
      }
    }
  }
  if (acc.size === 0) return null;
  const minGames = voteMinGames(teamGames);
  type Row = VoteCandidate & { sum: number; total: number };
  const bestOfTeam = new Map<string, Row>();
  for (const a of acc.values()) {
    // 그 주 1경기만 한 팀은 1경기로도 후보 (팀마다 한 명은 꼭 나오게)
    if (a.games < Math.min(minGames, teamGames.get(a.teamCode) ?? 1)) continue;
    const per = (v: number) => r1(v / a.games);
    const c = { pts: per(a.pts), reb: per(a.reb), ast: per(a.ast), tpm: per(a.tpm), stl: per(a.stl), blk: per(a.blk) };
    const h = voteHighlightOf(c);
    const row: Row = { id: a.id, nameKo: a.nameKo, teamCode: a.teamCode, photoUrl: photoOf(a.id), games: a.games, ...c, highlight: h.key, score: Math.round(h.score * 100) / 100, sum: h.sum, total: a.pts };
    const cur = bestOfTeam.get(a.teamCode);
    if (!cur || row.score > cur.score || (row.score === cur.score && (row.sum > cur.sum || (row.sum === cur.sum && row.total > cur.total)))) bestOfTeam.set(a.teamCode, row);
  }
  const players = [...bestOfTeam.values()]
    .sort((a, b) => b.score - a.score || b.sum - a.sum || a.nameKo.localeCompare(b.nameKo, "ko"))
    .map(({ sum: _s, total: _t, ...c }) => c);
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
  };
}

export const findVoteWeek = (weeks: readonly VoteWeek[], key: string): VoteWeek | null => weeks.find((w) => w.week === key) ?? null;

/** 그 주 후보인가 (서버 검사) */
export function isVoteCandidate(weeks: readonly VoteWeek[], key: string, playerNo: unknown): playerNo is string {
  if (typeof playerNo !== "string" || !/^\d{1,10}$/.test(playerNo)) return false;
  return findVoteWeek(weeks, key)?.players.some((p) => p.id === playerNo) ?? false;
}

/** 눈에 띈 기록 "리바운드 14.0" (스틸+블록은 "스틸+블록 4.0") */
export function highlightText(c: VoteCandidate): string {
  const h = VOTE_HIGHLIGHTS.find((x) => x.key === c.highlight) ?? VOTE_HIGHLIGHTS[0];
  return `${h.label} ${highlightValue(c, h.key).toFixed(1)}`;
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

/** 후보 + 표 → 표 많은 순 (같으면 후보 순서 = 눈에 띈 정도 순). 표가 없는 후보도 뒤에 남는다 */
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
