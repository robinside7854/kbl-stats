// 54-0 게임 (2026-10-02 사용자 요청 — 82-0.com 의 KBL 판, 검토 문서 docs/game-54-0-review-2026-10-02.md) — 순수 함수만.
// 규칙 (사용자 결정 2026-10-02):
//   - 슬롯을 돌리면 무작위 "시대 구간 + 팀"이 나오고, 그 팀이 그 구간에 뛴 선수 중 한 명을 골라 주전 다섯 자리에 넣는다.
//   - 시대 구간은 7개 (선수가 있는 시즌을 오래된 순으로 7 덩어리, 남는 시즌은 최근 구간에 하나씩 — 시즌 코드는 코드표에서 온다).
//     같은 구간이 여러 번 나와도 된다 (2026-10-02 사용자 결정 — 처음엔 82-0 처럼 한 번 쓴 구간을 뺐다).
//   - 자리는 가드 2 · 포워드 2 · 센터 1. 가드-포워드(GF)는 가드·포워드 칸, 포워드-센터(FC)는 포워드·센터 칸 어디든.
//   - 외국 선수(외국 + 아시아쿼터)는 최대 2명 (GAME_FOREIGN_MAX).
//   - 다시 돌리기: 팀 1번, 시대 1번.
//   - 오늘의 뽑기(날짜 고정 시드)는 하지 않는다.
// 점수: 선수 한 명 = 그 시즌 종합 점수(카드 종합 등급과 같은 값 — 같은 국적 풀 안 백분위 1~99, lib/metrics gradeScore).
//   시즌 안 백분위라 시대·경기 수 차이가 저절로 맞춰진다. 원숫자 합(득점+리바+…)을 쓰지 않는 이유: KBL 은 그 합의 상위 100시즌 중
//   97개가 외국 선수라 외국 선수만 뽑으면 이기는 게임이 된다 (검토 문서 §2).
//   팀 전력 = 다섯 명 평균 75% + 팀 능력치(6축마다 다섯 명 중 가장 높은 축 백분위의 평균) 25%.
//   → 한 가지 유형만 모으면(슈터 다섯) 리바운드·수비 칸이 비어 손해.
// 시즌: 54경기. 경기마다 승리 확률 = winProbability(전력), 라인업으로 정한 시드의 난수로 굴린다 → 같은 라인업은 언제나 같은 성적.
import { RADAR_AXES, type RadarAxis } from "./metrics";
import type { Position, TeamColor } from "./types";

export const GAME_SEASON_GAMES = 54;
export const GAME_ERA_COUNT = 7;
export const GAME_FOREIGN_MAX = 2;
export const GAME_ROUNDS = 5;

// ─────────────────────────────────────────────
// 데이터 (public/game/pool.json — scripts/build-game.ts 가 만든다)

/**
 * 후보 한 명 = 그 팀·그 구간의 선수. score·axes 는 그 구간 최고 시즌(종합 점수 기준, 화면에는 안 보임),
 * ppg~bpg 는 그 구간·그 팀에서 뛴 시즌 전체 평균(화면에 보이는 값)
 */
export interface GameCandidate {
  id: string;
  nameKo: string;
  seasonCode: number;
  /** "25-26" */
  season: string;
  position: Position;
  foreign: boolean;
  photoUrl: string | null;
  /** 종합 점수 1~99 */
  score: number;
  /** 6축 백분위 (RADAR_AXES 순서, 없으면 0) */
  axes: number[];
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  /** 평균을 낸 시즌 구간 "97-00" (한 시즌이면 "98-99") */
  span: string;
  seasonCount: number;
}

export interface GameTeam {
  teamCode: string;
  /** 그 구간 마지막 시즌의 한글 약칭 */
  name: string;
  logoUrl: string | null;
  color: TeamColor;
  candidates: GameCandidate[];
}

export interface GameEra {
  /** 0~6 */
  index: number;
  /** "97-01" */
  label: string;
  seasonCodes: number[];
  teams: GameTeam[];
}

export interface GamePool {
  eras: GameEra[];
}

/**
 * 시즌을 시대 구간 n개로 (오래된 순 입력). 덩어리 크기는 floor(시즌 수 / n), 남는 시즌은 최근 구간부터 하나씩 더한다.
 * 30개 시즌 → 4·4·4·4·4·5·5.
 */
export function splitEras<T>(seasons: readonly T[], n = GAME_ERA_COUNT): T[][] {
  if (seasons.length === 0) return [];
  const k = Math.min(n, seasons.length);
  const base = Math.floor(seasons.length / k);
  const extra = seasons.length - base * k;
  const out: T[][] = [];
  let i = 0;
  for (let e = 0; e < k; e++) {
    const size = base + (e >= k - extra ? 1 : 0);
    out.push(seasons.slice(i, i + size));
    i += size;
  }
  return out;
}

// ─────────────────────────────────────────────
// 자리

export type SlotGroup = "G" | "F" | "C";
export const GAME_SLOTS: readonly SlotGroup[] = ["G", "G", "F", "F", "C"];
export const SLOT_LABELS: Record<SlotGroup, string> = { G: "가드", F: "포워드", C: "센터" };

/** 이 포지션이 들어갈 수 있는 칸 묶음 */
export function slotGroupsFor(position: Position): SlotGroup[] {
  switch (position) {
    case "G":
      return ["G"];
    case "F":
      return ["F"];
    case "C":
      return ["C"];
    case "GF":
      return ["G", "F"];
    case "FC":
      return ["F", "C"];
  }
}

/** 칸 다섯 개 (GAME_SLOTS 순서). null = 빈칸 */
export type Lineup = (GameCandidate | null)[];

export const emptyLineup = (): Lineup => GAME_SLOTS.map(() => null);

/** 이 선수가 지금 들어갈 수 있는 빈칸 번호들 */
export function openSlotsFor(lineup: Lineup, c: GameCandidate): number[] {
  const groups = slotGroupsFor(c.position);
  return GAME_SLOTS.flatMap((g, i) => (lineup[i] === null && groups.includes(g) ? [i] : []));
}

export const foreignCount = (lineup: Lineup) => lineup.filter((p) => p?.foreign).length;

/** 지금 라인업에 넣을 수 있는 선수인가: 이미 뽑은 선수가 아니고, 맞는 빈칸이 있고, 외국 선수 한도 안 */
export function canPick(lineup: Lineup, c: GameCandidate): boolean {
  if (lineup.some((p) => p?.id === c.id)) return false;
  if (c.foreign && foreignCount(lineup) >= GAME_FOREIGN_MAX) return false;
  return openSlotsFor(lineup, c).length > 0;
}

/** 못 고르는 까닭 (화면 안내). 고를 수 있으면 null */
export function pickBlockReason(lineup: Lineup, c: GameCandidate): string | null {
  if (lineup.some((p) => p?.id === c.id)) return "이미 뽑은 선수";
  if (c.foreign && foreignCount(lineup) >= GAME_FOREIGN_MAX) return `외국 선수 ${GAME_FOREIGN_MAX}명 다 참`;
  if (openSlotsFor(lineup, c).length === 0) return `${slotGroupsFor(c.position).map((g) => SLOT_LABELS[g]).join("·")} 칸 다 참`;
  return null;
}

export function placePick(lineup: Lineup, slot: number, c: GameCandidate): Lineup {
  const next = lineup.slice();
  next[slot] = c;
  return next;
}

export const isLineupFull = (lineup: Lineup) => lineup.every((p) => p !== null);

// ─────────────────────────────────────────────
// 슬롯 돌리기

/** 0 이상 1 미만 난수 함수 (화면은 Math.random, 테스트·시뮬레이션은 시드 난수) */
export type Rng = () => number;

/** 시드 난수 (mulberry32) */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 문자열 → 32비트 시드 (FNV-1a) */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const pickOne = <T>(xs: readonly T[], rng: Rng): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];

export interface Spin {
  era: number;
  teamCode: string;
}

/** 이 팀에 지금 고를 수 있는 선수가 있는가 */
export const teamHasPick = (team: GameTeam, lineup: Lineup) => team.candidates.some((c) => canPick(lineup, c));

function validTeams(pool: GamePool, era: number, lineup: Lineup): GameTeam[] {
  return pool.eras[era]?.teams.filter((t) => teamHasPick(t, lineup)) ?? [];
}

function validEras(pool: GamePool, lineup: Lineup, exclude: number | null = null): number[] {
  return pool.eras.filter((e) => e.index !== exclude && validTeams(pool, e.index, lineup).length > 0).map((e) => e.index);
}

/** 새 슬롯: 구간 하나(고를 선수가 있는 곳, 앞 라운드와 같아도 됨) → 그 구간 팀 하나. 돌릴 곳이 없으면 null */
export function spin(pool: GamePool, lineup: Lineup, rng: Rng): Spin | null {
  const eras = validEras(pool, lineup);
  if (eras.length === 0) return null;
  const era = pickOne(eras, rng);
  return { era, teamCode: pickOne(validTeams(pool, era, lineup), rng).teamCode };
}

/** 팀 다시 돌리기: 같은 구간의 다른 팀. 다른 팀이 없으면 null */
export function respinTeam(pool: GamePool, current: Spin, lineup: Lineup, rng: Rng): Spin | null {
  const teams = validTeams(pool, current.era, lineup).filter((t) => t.teamCode !== current.teamCode);
  if (teams.length === 0) return null;
  return { era: current.era, teamCode: pickOne(teams, rng).teamCode };
}

/**
 * 시대 다시 돌리기: 지금과 다른 구간. 같은 팀(팀 코드)이 그 구간에도 있으면 팀은 그대로, 없으면 그 구간의 팀 하나.
 * 바꿀 구간이 없으면 null
 */
export function respinEra(pool: GamePool, current: Spin, lineup: Lineup, rng: Rng): Spin | null {
  const eras = validEras(pool, lineup, current.era);
  if (eras.length === 0) return null;
  const era = pickOne(eras, rng);
  const teams = validTeams(pool, era, lineup);
  const same = teams.find((t) => t.teamCode === current.teamCode);
  return { era, teamCode: (same ?? pickOne(teams, rng)).teamCode };
}

export function teamOf(pool: GamePool, s: Spin): GameTeam | null {
  return pool.eras[s.era]?.teams.find((t) => t.teamCode === s.teamCode) ?? null;
}

/** 화면 후보 정렬: 그 구간 경기당 득점 높은 순 → 이름 (등급·점수는 보여 주지 않는다 — 2026-10-02 사용자 요청) */
export function sortCandidates(cs: readonly GameCandidate[]): GameCandidate[] {
  return [...cs].sort((a, b) => b.ppg - a.ppg || a.nameKo.localeCompare(b.nameKo, "ko"));
}

/** 시뮬레이션·테스트용: 점수 높은 순 (화면에는 쓰지 않는다) */
export function sortByScore(cs: readonly GameCandidate[]): GameCandidate[] {
  return [...cs].sort((a, b) => b.score - a.score || b.ppg - a.ppg);
}

/** 라인업 합계 (결과 화면 팀 합계 줄) */
export function lineupTotals(players: readonly GameCandidate[]) {
  const sum = (k: "ppg" | "rpg" | "apg" | "spg" | "bpg") => Math.round(players.reduce((s, p) => s + p[k], 0) * 10) / 10;
  return { ppg: sum("ppg"), rpg: sum("rpg"), apg: sum("apg"), spg: sum("spg"), bpg: sum("bpg") };
}

// ─────────────────────────────────────────────
// 전력·시즌

export const PLAYER_WEIGHT = 0.75;

export interface TeamRating {
  /** 다섯 명 종합 점수 평균 */
  avgScore: number;
  /** 6축마다 다섯 명 중 최고 백분위 */
  axes: Record<RadarAxis, number>;
  /** axes 평균 */
  balance: number;
  /** 팀 전력 0~99 */
  rating: number;
  /** 가장 낮은 축 */
  weakest: RadarAxis;
}

export function teamRating(players: readonly GameCandidate[]): TeamRating {
  const axes = Object.fromEntries(
    RADAR_AXES.map((a, i) => [a, players.length ? Math.max(...players.map((p) => p.axes[i] ?? 0)) : 0]),
  ) as Record<RadarAxis, number>;
  const vals = RADAR_AXES.map((a) => axes[a]);
  const balance = vals.reduce((s, v) => s + v, 0) / vals.length;
  const avgScore = players.length ? players.reduce((s, p) => s + p.score, 0) / players.length : 0;
  const weakest = RADAR_AXES.reduce((w, a) => (axes[a] < axes[w] ? a : w), RADAR_AXES[0]);
  return { avgScore, axes, balance, rating: PLAYER_WEIGHT * avgScore + (1 - PLAYER_WEIGHT) * balance, weakest };
}

/**
 * 전력 → 한 경기 승리 확률. 패배 확률을 표(WIN_CURVE)의 점 사이 직선으로 읽는다 — 위로 갈수록 1승 더하기가 어려운 곡선
 * (82-0 의 비선형 곡선과 같은 뜻). 전력 100(다섯 명 모두 99점·6축 만점)이어야 전승 확정 — 사실상 오지 않는다.
 * 2026-10-02 사용자 결정 "전승은 1% 정도로 어렵게" → 같은 날 등급을 숨긴 뒤 "득점 1위만 골라도 0.2% 정도"로 조정:
 *   위쪽(전력 96 이상) 패배 확률만 0.68배로 낮췄다 — 아래쪽(아무나 뽑은 라인업)의 성적은 그대로.
 *   시뮬레이션(tests/game.test.ts): 매번 그 팀 득점 1위를 고르면 전승 약 0.2%, 숨은 점수 1위면 약 1.5%.
 */
export const WIN_CURVE: readonly (readonly [rating: number, lossRate: number])[] = [
  [30, 0.98],
  [60, 0.67],
  [75, 0.4],
  [90, 0.15],
  [96, 0.068],
  [98, 0.051],
  [99, 0.0408],
  [100, 0],
];
export function winProbability(rating: number): number {
  const pts = WIN_CURVE;
  if (rating <= pts[0][0]) return 1 - pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    if (rating <= x1) {
      const [x0, y0] = pts[i - 1];
      return 1 - (y0 + ((rating - x0) / (x1 - x0)) * (y1 - y0));
    }
  }
  return 1;
}

export interface SeasonResult {
  wins: number;
  losses: number;
  /** 경기마다 이겼는가 (54개) */
  games: boolean[];
  /** 가장 긴 연승 */
  longestStreak: number;
  rating: TeamRating;
}

/** 라인업 시드 (칸 순서대로 선수·시즌) — 같은 라인업은 같은 성적 */
export const lineupKey = (players: readonly GameCandidate[]) => players.map((p) => `${p.id}:${p.seasonCode}`).join(",");

export function simulateSeason(players: readonly GameCandidate[]): SeasonResult {
  const rating = teamRating(players);
  const p = winProbability(rating.rating);
  const rng = seededRng(hashSeed(lineupKey(players)));
  const games = Array.from({ length: GAME_SEASON_GAMES }, () => rng() < p);
  let longestStreak = 0;
  let run = 0;
  for (const w of games) {
    run = w ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
  }
  const wins = games.filter(Boolean).length;
  return { wins, losses: GAME_SEASON_GAMES - wins, games, longestStreak, rating };
}

/** 성적 한 줄 평 */
export function resultVerdict(wins: number): string {
  if (wins === GAME_SEASON_GAMES) return "전승 시즌!";
  if (wins >= 48) return "역대급 시즌, 전승까지 조금만 더";
  if (wins >= 40) return "정규리그 1위 후보";
  if (wins >= 30) return "플레이오프 진출권";
  if (wins >= 20) return "중위권";
  return "다음 시즌을 기약";
}

/** 공유 주소 쿼리 ?l=번호:시즌,… (칸 순서) ↔ 라인업 */
export function encodeLineupParam(lineup: Lineup): string {
  return lineup.map((p) => (p ? `${p.id}:${p.seasonCode}` : "")).join(",");
}

/** ?l= 값 → 칸 순서 선수. 풀에 없거나 칸·외국 선수 규칙에 안 맞으면 null */
export function decodeLineupParam(pool: GamePool, value: string | null): GameCandidate[] | null {
  if (!value) return null;
  const parts = value.split(",");
  if (parts.length !== GAME_SLOTS.length) return null;
  const all = new Map<string, GameCandidate>();
  for (const e of pool.eras) for (const t of e.teams) for (const c of t.candidates) all.set(`${c.id}:${c.seasonCode}`, c);
  const out: GameCandidate[] = [];
  for (let i = 0; i < parts.length; i++) {
    const c = all.get(parts[i]);
    if (!c || !slotGroupsFor(c.position).includes(GAME_SLOTS[i]) || out.some((p) => p.id === c.id)) return null;
    out.push(c);
  }
  if (out.filter((p) => p.foreign).length > GAME_FOREIGN_MAX) return null;
  return out;
}
