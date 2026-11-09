// 54-0 도전 과제 배지 (2026-11-09 사용자 결정 — 제안한 16개 전부, 로그인 없이 이 브라우저 + 로그인하면 계정에도) — 순수 함수만.
// 판 하나에서 받는 배지는 두 단계로 판정한다:
//   - season: 정규리그 결과가 나왔을 때 (성적·조합·케미 중 정규리그만 보는 것)
//   - playoff: 플레이오프를 끝까지 봤을 때 (우승 관련) — 결과를 미리 알려 주지 않으려고 "이어서 하기"를 끝낸 뒤에만
// 판 수 배지는 완성한 판 수로, 주간 챔피언은 서버가 주간 순위로 판정한다(lib/server/members memberBadgeState).
// 형제 목록은 손으로 관리한다: data/codes/game-brothers.json
import brothers from "../data/codes/game-brothers.json";
import { BALL_MAX, GAME_SEASON_GAMES, lineupBonuses, type GameCandidate } from "./game";
import { formOf, isPlayoffSeed, type PlayoffResult } from "./game-playoffs";

export type BadgeGroup = "record" | "combo" | "chem" | "steady";
export const BADGE_GROUP_LABELS: Record<BadgeGroup, string> = { record: "성적", combo: "조합", chem: "케미", steady: "꾸준함" };

export const GAME_BADGES = [
  { key: "perfect", group: "record", label: "퍼펙트", rule: "54전 전승" },
  { key: "flawless", group: "record", label: "완전무결", rule: "54-0 에 플레이오프 전승 우승" },
  { key: "first_ring", group: "record", label: "첫 반지", rule: "처음으로 챔프전 우승" },
  { key: "sweep", group: "record", label: "스윕", rule: "플레이오프 7전 7승으로 우승" },
  { key: "underdog", group: "record", label: "언더독", rule: "45승 미만으로 우승" },
  { key: "domestic", group: "combo", label: "국내파", rule: "외국 선수·아시아쿼터 없이 정규리그 1위" },
  { key: "one_club", group: "combo", label: "원클럽맨", rule: "다섯 명 모두 같은 구단(이름이 바뀐 구단 포함)으로 정규리그 1위" },
  { key: "old_school", group: "combo", label: "그 시절", rule: "다섯 명 모두 99-00 이전 시즌으로 정규리그 1위" },
  { key: "alumni", group: "combo", label: "동문회", rule: "다섯 명 모두 같은 학교" },
  { key: "brothers", group: "combo", label: "형제의 난", rule: "형제 선수를 한 팀에 (허웅·허훈 등)" },
  { key: "dirty_work", group: "chem", label: "궂은일의 미학", rule: "궂은일 담당 2명 이상으로 우승" },
  { key: "one_ball", group: "chem", label: "볼은 하나라도", rule: "볼은 하나 최대 감점을 받고도 우승" },
  { key: "big_game", group: "chem", label: "큰 경기 체질", rule: "플레이오프에서 더 잘한 선수 3명 이상으로 우승" },
  { key: "plays_10", group: "steady", label: "도전자", rule: "10판 완성" },
  { key: "plays_100", group: "steady", label: "단골", rule: "100판 완성" },
  { key: "plays_500", group: "steady", label: "54-0 중독", rule: "500판 완성" },
  { key: "weekly_champ", group: "steady", label: "주간 챔피언", rule: "주간 순위 1위 (로그인 회원)" },
] as const satisfies readonly { key: string; group: BadgeGroup; label: string; rule: string }[];

export type BadgeKey = (typeof GAME_BADGES)[number]["key"];
export const BADGE_KEYS: readonly BadgeKey[] = GAME_BADGES.map((b) => b.key);
export const isBadgeKey = (v: unknown): v is BadgeKey => typeof v === "string" && (BADGE_KEYS as readonly string[]).includes(v);
export const badgeDef = (key: BadgeKey) => GAME_BADGES.find((b) => b.key === key)!;

/** 언더독 문턱: 이보다 적게 이기고 우승 */
export const UNDERDOG_WINS = 45;
/** 그 시절: 이 시즌 코드 이하 (99-00 = 4) */
export const OLD_SCHOOL_MAX_SEASON = 4;
/** 판 수 배지 */
export const PLAY_BADGES: readonly [BadgeKey, number][] = [
  ["plays_10", 10],
  ["plays_100", 100],
  ["plays_500", 500],
];

const BROTHER_PAIRS = (brothers as { pairs: string[][] }).pairs.filter((p) => p.length === 2) as [string, string][];

export interface BadgeGameInput {
  players: readonly GameCandidate[];
  /** 칸 순서와 같은 팀 코드 (원클럽맨) */
  teamCodes: readonly string[];
  wins: number;
  /** 구단 계보 (매각 전 코드 → 다음 코드) */
  successor: Readonly<Record<string, string>>;
}

function rootOf(code: string, successor: Readonly<Record<string, string>>): string {
  const seen = new Set<string>();
  let c = code;
  while (successor[c] && !seen.has(c)) {
    seen.add(c);
    c = successor[c];
  }
  return c;
}

/** 정규리그 결과만으로 받는 배지 */
export function seasonBadges(g: BadgeGameInput): BadgeKey[] {
  const out: BadgeKey[] = [];
  const first = isPlayoffSeed(g.wins);
  if (g.wins === GAME_SEASON_GAMES) out.push("perfect");
  if (first && g.players.every((p) => !p.foreign && !p.asia)) out.push("domestic");
  if (first && g.teamCodes.length === g.players.length && new Set(g.teamCodes.map((c) => rootOf(c, g.successor))).size === 1) out.push("one_club");
  if (first && g.players.every((p) => p.seasonCode <= OLD_SCHOOL_MAX_SEASON)) out.push("old_school");
  const school = g.players[0]?.school;
  if (school && g.players.every((p) => p.school === school)) out.push("alumni");
  const ids = new Set(g.players.map((p) => p.id));
  if (BROTHER_PAIRS.some(([a, b]) => ids.has(a) && ids.has(b))) out.push("brothers");
  return out;
}

/**
 * 플레이오프를 끝까지 본 뒤 받는 배지. firstTitle = 이 판 전에 우승한 적이 없는가(첫 반지).
 */
export function playoffBadges(g: BadgeGameInput, playoff: PlayoffResult | null, firstTitle: boolean): BadgeKey[] {
  if (!playoff?.champion) return [];
  const out: BadgeKey[] = [];
  if (firstTitle) out.push("first_ring");
  const sweep = playoff.rounds.every((r) => r.losses === 0);
  if (sweep) out.push("sweep");
  if (sweep && g.wins === GAME_SEASON_GAMES) out.push("flawless");
  if (g.wins < UNDERDOG_WINS) out.push("underdog");
  const bonuses = lineupBonuses(g.players);
  if ((bonuses.find((b) => b.key === "glue")?.playerIds.length ?? 0) >= 2) out.push("dirty_work");
  if ((bonuses.find((b) => b.key === "ball")?.points ?? 0) <= -BALL_MAX) out.push("one_ball");
  if (g.players.filter((p) => formOf(p) > 1).length >= 3) out.push("big_game");
  return out;
}

/** 판 수로 받는 배지 */
export function playBadges(plays: number): BadgeKey[] {
  return PLAY_BADGES.filter(([, n]) => plays >= n).map(([k]) => k);
}

// ── 저장 형태 (브라우저·계정 공용) ──

/** 받은 배지 → 받은 날(ISO) · 완성한 판 수 */
export interface BadgeState {
  earned: Partial<Record<BadgeKey, string>>;
  plays: number;
}
export const EMPTY_BADGES: BadgeState = { earned: {}, plays: 0 };
export const MAX_BADGE_PLAYS = 1_000_000;

/** 저장된 값 검사 (모르는 배지·이상한 날짜는 버린다) */
export function parseBadgeState(raw: unknown): BadgeState {
  if (!raw || typeof raw !== "object") return { earned: {}, plays: 0 };
  const r = raw as { earned?: unknown; plays?: unknown };
  const earned: BadgeState["earned"] = {};
  if (r.earned && typeof r.earned === "object") {
    for (const [k, v] of Object.entries(r.earned as Record<string, unknown>)) {
      if (isBadgeKey(k) && typeof v === "string" && !Number.isNaN(Date.parse(v))) earned[k] = new Date(v).toISOString();
    }
  }
  const plays = typeof r.plays === "number" && Number.isInteger(r.plays) && r.plays >= 0 ? Math.min(r.plays, MAX_BADGE_PLAYS) : 0;
  return { earned, plays };
}

/** 배지 더하기 → 새로 받은 배지 (이미 있으면 날짜 유지) */
export function addBadges(state: BadgeState, keys: readonly BadgeKey[], at: string): { state: BadgeState; added: BadgeKey[] } {
  const earned = { ...state.earned };
  const added: BadgeKey[] = [];
  for (const k of keys) {
    if (!earned[k]) {
      earned[k] = at;
      added.push(k);
    }
  }
  return { state: { ...state, earned }, added };
}

/** 두 기록 합치기 (브라우저 ↔ 계정): 배지는 합집합(이른 날짜), 판 수는 큰 쪽 */
export function mergeBadgeStates(a: BadgeState, b: BadgeState): BadgeState {
  const earned: BadgeState["earned"] = { ...a.earned };
  for (const [k, v] of Object.entries(b.earned) as [BadgeKey, string][]) {
    if (!earned[k] || v < earned[k]!) earned[k] = v;
  }
  const plays = Math.max(a.plays, b.plays);
  const withPlays = addBadges({ earned, plays }, playBadges(plays), new Date().toISOString()).state;
  return withPlays;
}

export const earnedCount = (s: BadgeState) => BADGE_KEYS.filter((k) => s.earned[k]).length;
