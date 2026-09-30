// 시즌 순위표의 정렬·필터·순위·표기 규칙 — 순수 함수만 둔다 (CLAUDE.md 원칙 5).
// 화면(app/components/LeadersView)은 여기 함수를 부르기만 하고 직접 계산하지 않는다.
// 경기당 환산은 lib/metrics.ts 의 perGame 을 그대로 쓴다. 비율 지표(야투%·TS%·PER·USG%·PIE)는 KBL 계산값 그대로.

import { isQualified, perGame, QUALIFY_PRESETS, type QualifyRule } from "./metrics";
import type { LeaderPlayer, SeasonCoverage } from "./types";

// ─────────────────────────────────────────────
// 지표 정의
// ─────────────────────────────────────────────

export type LeaderStatKey =
  | "games"
  | "minutes"
  | "points"
  | "reb"
  | "ast"
  | "stl"
  | "blk"
  | "tpm"
  | "fgPct"
  | "tsPct"
  | "per"
  | "usgPct"
  | "pie";

/** 경기당 / 시즌 합계 */
export type StatMode = "perGame" | "total";
/** 전체 / 국내 / 외국인 */
export type OriginFilter = "all" | "domestic" | "foreign";
export type SortDir = "desc" | "asc";

export interface LeaderStatDef {
  key: LeaderStatKey;
  /** 부문 이름, 예: "득점" */
  label: string;
  /** 표 열 제목(짧게), 예: "득점" / "3점" */
  short: string;
  /**
   * count: 시즌 누적값 → 경기당 모드면 perGame 환산
   * games: 경기 수 — 모드와 관계없이 그대로
   * rate : KBL 계산 비율·지수 — 모드와 관계없이 그대로
   */
  kind: "count" | "games" | "rate";
  /** true 면 coverage.advanced 시즌에만 보인다 */
  advanced?: boolean;
}

export const LEADER_STATS: Record<LeaderStatKey, LeaderStatDef> = {
  games: { key: "games", label: "경기", short: "경기", kind: "games" },
  minutes: { key: "minutes", label: "출전시간", short: "출전(분)", kind: "count" },
  points: { key: "points", label: "득점", short: "득점", kind: "count" },
  reb: { key: "reb", label: "리바운드", short: "리바", kind: "count" },
  ast: { key: "ast", label: "어시스트", short: "어시", kind: "count" },
  stl: { key: "stl", label: "스틸", short: "스틸", kind: "count" },
  blk: { key: "blk", label: "블록", short: "블록", kind: "count" },
  tpm: { key: "tpm", label: "3점 성공", short: "3점", kind: "count" },
  fgPct: { key: "fgPct", label: "야투율", short: "야투%", kind: "rate" },
  tsPct: { key: "tsPct", label: "TS%", short: "TS%", kind: "rate" },
  per: { key: "per", label: "PER", short: "PER", kind: "rate" },
  usgPct: { key: "usgPct", label: "USG%", short: "USG%", kind: "rate", advanced: true },
  pie: { key: "pie", label: "PIE", short: "PIE", kind: "rate", advanced: true },
};

/** 상단 부문 선택지 (1~3위 카드). 순서 = 화면 표시 순서 */
export const LEADER_CATEGORIES: readonly LeaderStatKey[] = [
  "points", "reb", "ast", "stl", "blk", "tpm", "fgPct", "tsPct", "per", "usgPct", "pie",
];

/** 기본 부문: 팬이 가장 먼저 찾는 "득점왕" */
export const DEFAULT_CATEGORY: LeaderStatKey = "points";

/** 표 열 기본 순서. 앞의 CORE_COLUMNS 는 모바일 첫 화면에 들어가는 핵심 열 */
export const TABLE_COLUMNS: readonly LeaderStatKey[] = [
  "games", "points", "reb", "ast", "minutes", "stl", "blk", "tpm", "fgPct", "tsPct", "per", "usgPct", "pie",
];
export const CORE_COLUMNS: readonly LeaderStatKey[] = ["games", "points", "reb", "ast"];

/** 시즌 커버리지에 맞는 지표만 남긴다 (advanced 지표는 coverage.advanced 일 때만). 시즌 코드로 판단하지 않는다 */
export function availableStats(keys: readonly LeaderStatKey[], coverage: Pick<SeasonCoverage, "advanced">): LeaderStatKey[] {
  return keys.filter((k) => !LEADER_STATS[k].advanced || coverage.advanced);
}

/**
 * 표 열 순서. 선택한 부문(focus)이 핵심 열이 아니면 선수 열 바로 뒤(맨 앞)로 끌어온다 —
 * 모바일에서 가로 스크롤 없이도 지금 보는 부문의 값이 보이게.
 */
export function columnOrder(focus: LeaderStatKey, coverage: Pick<SeasonCoverage, "advanced">): LeaderStatKey[] {
  const cols = availableStats(TABLE_COLUMNS, coverage);
  if (!cols.includes(focus) || CORE_COLUMNS.includes(focus)) return cols;
  return [focus, ...cols.filter((k) => k !== focus)];
}

// ─────────────────────────────────────────────
// 값·필터·정렬·순위
// ─────────────────────────────────────────────

/** 표시·정렬에 쓰는 값. count 지표는 경기당 모드에서 perGame(누적, 경기 수) */
export function statValue(p: LeaderPlayer, key: LeaderStatKey, mode: StatMode): number {
  const v = p[key];
  if (LEADER_STATS[key].kind === "count" && mode === "perGame") return perGame(v, p.games);
  return v;
}

/** 비율 지표는 경기당/합계 전환의 영향을 받지 않는다 */
export function isModeIndependent(key: LeaderStatKey): boolean {
  return LEADER_STATS[key].kind !== "count";
}

export interface LeaderFilter {
  origin: OriginFilter;
  /** null 이면 전체 팀 */
  teamCode: string | null;
  rule: QualifyRule;
}

/** 국내/외국인 · 팀 · 표본 기준(lib/metrics isQualified)으로 거른다 */
export function filterLeaders<T extends LeaderPlayer>(players: readonly T[], f: LeaderFilter): T[] {
  return players.filter(
    (p) =>
      (f.origin === "all" || (f.origin === "foreign") === p.isForeign) &&
      (f.teamCode === null || p.teamCode === f.teamCode) &&
      isQualified(p, f.rule),
  );
}

/**
 * key 기준 정렬 (새 배열). 동점이면 경기 수 많은 순 → 한글 이름순 → 선수 번호순으로 항상 같은 순서.
 * NaN 등 숫자가 아닌 값은 방향과 관계없이 맨 뒤.
 */
export function sortLeaders<T extends LeaderPlayer>(
  players: readonly T[],
  key: LeaderStatKey,
  dir: SortDir,
  mode: StatMode,
): T[] {
  const sign = dir === "desc" ? -1 : 1;
  return players
    .map((p) => ({ p, v: statValue(p, key, mode) }))
    .sort((a, b) => {
      const af = Number.isFinite(a.v);
      const bf = Number.isFinite(b.v);
      if (af !== bf) return af ? -1 : 1;
      if (af && a.v !== b.v) return sign * (a.v - b.v);
      return b.p.games - a.p.games || a.p.nameKo.localeCompare(b.p.nameKo, "ko") || a.p.id.localeCompare(b.p.id);
    })
    .map((x) => x.p);
}

/**
 * key 기준 순위 (높은 값이 1위, 동점은 같은 순위 · 다음 순위는 건너뜀: 1, 2, 2, 4).
 * 정렬 방향과 관계없이 "그 부문 몇 위"를 보여 주기 위한 것. 반환: 선수 id → 순위
 */
export function rankMap(players: readonly LeaderPlayer[], key: LeaderStatKey, mode: StatMode): Map<string, number> {
  const sorted = sortLeaders(players, key, "desc", mode);
  const out = new Map<string, number>();
  let prev = NaN;
  let rank = 0;
  sorted.forEach((p, i) => {
    const v = statValue(p, key, mode);
    if (i === 0 || v !== prev) rank = i + 1;
    prev = v;
    out.set(p.id, rank);
  });
  return out;
}

export interface LeaderEntry<T extends LeaderPlayer = LeaderPlayer> {
  player: T;
  value: number;
  rank: number;
}

/** 부문 상위 n명 (1~3위 카드용). 동점으로 n명을 넘길 수 있지만 카드 수는 n개로 자른다 */
export function topLeaders<T extends LeaderPlayer>(
  players: readonly T[],
  key: LeaderStatKey,
  mode: StatMode,
  n = 3,
): LeaderEntry<T>[] {
  const ranks = rankMap(players, key, mode);
  return sortLeaders(players, key, "desc", mode)
    .slice(0, n)
    .map((p) => ({ player: p, value: statValue(p, key, mode), rank: ranks.get(p.id)! }));
}

// ─────────────────────────────────────────────
// 표기
// ─────────────────────────────────────────────

const nf = (d: number) => new Intl.NumberFormat("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const NF0 = nf(0);
const NF1 = nf(1);

/** 숫자 표기: 경기 수·합계 누적은 정수(천 단위 쉼표), 경기당·비율은 소수 1자리 */
export function formatStat(value: number, key: LeaderStatKey, mode: StatMode): string {
  if (!Number.isFinite(value)) return "–";
  const kind = LEADER_STATS[key].kind;
  if (kind === "games" || (kind === "count" && mode === "total")) return NF0.format(value);
  return NF1.format(value);
}

/** 카드·열 설명에 쓰는 지표 이름, 예: "경기당 득점", "시즌 합계 득점", "TS%" */
export function statTitle(key: LeaderStatKey, mode: StatMode): string {
  const def = LEADER_STATS[key];
  if (def.kind !== "count") return def.label;
  return `${mode === "perGame" ? "경기당" : "시즌 합계"} ${def.label}`;
}

// ─────────────────────────────────────────────
// 주소 쿼리 (공유·새로고침 시 상태 유지)
// ─────────────────────────────────────────────

export interface LeadersState {
  category: LeaderStatKey;
  mode: StatMode;
  origin: OriginFilter;
  teamCode: string | null;
  /** QUALIFY_PRESETS 의 번호 */
  presetIdx: number;
}

export const DEFAULT_LEADERS_STATE: LeadersState = {
  category: DEFAULT_CATEGORY,
  mode: "perGame",
  origin: "all",
  teamCode: null,
  presetIdx: 0,
};

const ORIGIN_PARAM: Record<OriginFilter, string> = { all: "all", domestic: "dom", foreign: "for" };

/**
 * 쿼리 문자열 → 상태. 모르는 값·이 시즌에 없는 팀·커버리지 밖 부문은 기본값으로.
 * 형식: ?cat=reb&mode=total&origin=dom&team=55&q=1 (기본값인 항목은 생략)
 */
export function parseLeadersQuery(
  search: string,
  ctx: { teamCodes: readonly string[]; coverage: Pick<SeasonCoverage, "advanced"> },
): LeadersState {
  const qs = new URLSearchParams(search);
  const d = DEFAULT_LEADERS_STATE;
  const cat = qs.get("cat") as LeaderStatKey | null;
  const origin = (Object.keys(ORIGIN_PARAM) as OriginFilter[]).find((o) => ORIGIN_PARAM[o] === qs.get("origin"));
  const team = qs.get("team");
  const q = Number(qs.get("q"));
  return {
    category: cat && availableStats(LEADER_CATEGORIES, ctx.coverage).includes(cat) ? cat : d.category,
    mode: qs.get("mode") === "total" ? "total" : d.mode,
    origin: origin ?? d.origin,
    teamCode: team && ctx.teamCodes.includes(team) ? team : d.teamCode,
    presetIdx: Number.isInteger(q) && q >= 0 && q < QUALIFY_PRESETS.length ? q : d.presetIdx,
  };
}

/** 상태 → 쿼리 문자열 ("" 또는 "?..."). 기본값 항목은 넣지 않는다 */
export function leadersQueryString(s: LeadersState): string {
  const d = DEFAULT_LEADERS_STATE;
  const qs = new URLSearchParams();
  if (s.category !== d.category) qs.set("cat", s.category);
  if (s.mode !== d.mode) qs.set("mode", s.mode);
  if (s.origin !== d.origin) qs.set("origin", ORIGIN_PARAM[s.origin]);
  if (s.teamCode !== d.teamCode && s.teamCode !== null) qs.set("team", s.teamCode);
  if (s.presetIdx !== d.presetIdx) qs.set("q", String(s.presetIdx));
  const str = qs.toString();
  return str ? `?${str}` : "";
}
