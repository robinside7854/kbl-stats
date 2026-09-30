// 시즌 순위표의 정렬·필터·순위·표기 규칙 — 순수 함수만 둔다 (CLAUDE.md 원칙 5).
// 화면(app/components/LeadersView)은 여기 함수를 부르기만 하고 직접 계산하지 않는다.
// 경기당 환산은 lib/metrics.ts 의 perGame 을 그대로 쓴다. 비율 지표(야투%·3점%·자유투%·TS%·PER)는 KBL 계산값 그대로.
// 성공률(야투·3점·자유투)의 시도 기준은 lib/metrics.ts attemptThresholds — 플레이어 카드와 같은 함수.

import {
  isPctKey,
  isQualified,
  meetsAttemptThreshold,
  PCT_ATTEMPTS,
  perGame,
  QUALIFY_PRESETS,
  type AttemptThresholds,
  type QualifyRule,
} from "./metrics";
import type { LeaderPlayer } from "./types";

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
  | "tov"
  | "fgPct"
  | "tpPct"
  | "ftPct"
  | "tsPct"
  | "per";

/** 경기당 / 시즌 합계 */
export type StatMode = "perGame" | "total";
/** 전체 / 국내 / 외국인 */
export type OriginFilter = "all" | "domestic" | "foreign";
export type SortDir = "desc" | "asc";

export interface LeaderStatDef {
  key: LeaderStatKey;
  /** 부문 이름, 예: "득점" */
  label: string;
  /** 표 열 제목(짧게), 예: "득점" / "3점%" */
  short: string;
  /**
   * count: 시즌 누적값 → 경기당 모드면 perGame 환산
   * games: 경기 수 — 모드와 관계없이 그대로
   * rate : KBL 계산 비율·지수 — 모드와 관계없이 그대로
   */
  kind: "count" | "games" | "rate";
  /** high: 클수록 상위(기본) / low: 작을수록 상위 (턴오버) — 1~3위 카드·순위·기본 정렬 방향 */
  better: "high" | "low";
}

export const LEADER_STATS: Record<LeaderStatKey, LeaderStatDef> = {
  games: { key: "games", label: "경기", short: "경기", kind: "games", better: "high" },
  minutes: { key: "minutes", label: "출전시간", short: "출전(분)", kind: "count", better: "high" },
  points: { key: "points", label: "득점", short: "득점", kind: "count", better: "high" },
  reb: { key: "reb", label: "리바운드", short: "리바", kind: "count", better: "high" },
  ast: { key: "ast", label: "어시스트", short: "어시", kind: "count", better: "high" },
  stl: { key: "stl", label: "스틸", short: "스틸", kind: "count", better: "high" },
  blk: { key: "blk", label: "블록", short: "블록", kind: "count", better: "high" },
  tov: { key: "tov", label: "턴오버", short: "턴오버", kind: "count", better: "low" },
  fgPct: { key: "fgPct", label: "야투율", short: "야투%", kind: "rate", better: "high" },
  tpPct: { key: "tpPct", label: "3점 성공률", short: "3점%", kind: "rate", better: "high" },
  ftPct: { key: "ftPct", label: "자유투 성공률", short: "자유투%", kind: "rate", better: "high" },
  tsPct: { key: "tsPct", label: "TS%", short: "TS%", kind: "rate", better: "high" },
  per: { key: "per", label: "PER", short: "PER", kind: "rate", better: "high" },
};

/** 상단 부문 선택지 (1~3위 카드). 순서 = 화면 표시 순서 */
export const LEADER_CATEGORIES: readonly LeaderStatKey[] = [
  "points", "reb", "ast", "stl", "blk", "tov", "fgPct", "tpPct", "ftPct", "tsPct", "per",
];

/** 기본 부문: 팬이 가장 먼저 찾는 "득점왕" */
export const DEFAULT_CATEGORY: LeaderStatKey = "points";

/** 표 열 기본 순서. 앞의 CORE_COLUMNS 는 모바일 첫 화면에 들어가는 핵심 열 (출전시간은 경기 바로 오른쪽) */
export const TABLE_COLUMNS: readonly LeaderStatKey[] = [
  "games", "minutes", "points", "reb", "ast", "stl", "blk", "tov", "fgPct", "tpPct", "ftPct", "tsPct", "per",
];
export const CORE_COLUMNS: readonly LeaderStatKey[] = ["games", "minutes", "points", "reb", "ast"];

/**
 * 표 열 순서. 선택한 부문(focus)이 핵심 열이 아니면 선수 열 바로 뒤(맨 앞)로 끌어온다 —
 * 모바일에서 가로 스크롤 없이도 지금 보는 부문의 값이 보이게.
 */
export function columnOrder(focus: LeaderStatKey): LeaderStatKey[] {
  const cols = [...TABLE_COLUMNS];
  if (!cols.includes(focus) || CORE_COLUMNS.includes(focus)) return cols;
  return [focus, ...cols.filter((k) => k !== focus)];
}

/** 그 지표의 "상위" 방향 정렬 (high → desc, low → asc). 부문 선택·열 제목 첫 클릭의 기본 방향 */
export function defaultSortDir(key: LeaderStatKey): SortDir {
  return LEADER_STATS[key].better === "low" ? "asc" : "desc";
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

/**
 * 이 지표의 순위에 들 수 있는가. 성공률(야투·3점·자유투)은 경기당 시도가 기준(t) 이상이어야 한다.
 * t 를 넘기지 않으면(undefined) 시도 기준 없이 모두 true.
 */
export function isRankEligible(p: LeaderPlayer, key: LeaderStatKey, t?: AttemptThresholds): boolean {
  if (!t || !isPctKey(key)) return true;
  return meetsAttemptThreshold(p, key, t);
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
 * t(시도 기준)를 넘기면 성공률 지표에서 시도 기준 미달 선수는 방향과 관계없이 충족 선수 뒤로 보낸다.
 */
export function sortLeaders<T extends LeaderPlayer>(
  players: readonly T[],
  key: LeaderStatKey,
  dir: SortDir,
  mode: StatMode,
  t?: AttemptThresholds,
): T[] {
  const sign = dir === "desc" ? -1 : 1;
  return players
    .map((p) => ({ p, v: statValue(p, key, mode), ok: isRankEligible(p, key, t) }))
    .sort((a, b) => {
      if (a.ok !== b.ok) return a.ok ? -1 : 1;
      const af = Number.isFinite(a.v);
      const bf = Number.isFinite(b.v);
      if (af !== bf) return af ? -1 : 1;
      if (af && a.v !== b.v) return sign * (a.v - b.v);
      return b.p.games - a.p.games || a.p.nameKo.localeCompare(b.p.nameKo, "ko") || a.p.id.localeCompare(b.p.id);
    })
    .map((x) => x.p);
}

/**
 * key 기준 순위 ("상위" 방향이 1위: 대부분 높은 값, 턴오버는 낮은 값. 동점은 같은 순위 · 다음 순위는 건너뜀: 1, 2, 2, 4).
 * 정렬 방향과 관계없이 "그 부문 몇 위"를 보여 주기 위한 것. 반환: 선수 id → 순위.
 * t 를 넘기면 성공률 지표의 시도 기준 미달 선수는 순위가 없다(맵에 없음 → 화면은 "–").
 */
export function rankMap(
  players: readonly LeaderPlayer[],
  key: LeaderStatKey,
  mode: StatMode,
  t?: AttemptThresholds,
): Map<string, number> {
  const sorted = sortLeaders(players, key, defaultSortDir(key), mode, t).filter((p) => isRankEligible(p, key, t));
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

/**
 * 부문 상위 n명 (1~3위 카드용). "상위" 방향으로 — 턴오버는 적은 순.
 * 성공률은 t(시도 기준) 충족 선수만. 동점으로 n명을 넘길 수 있지만 카드 수는 n개로 자른다.
 */
export function topLeaders<T extends LeaderPlayer>(
  players: readonly T[],
  key: LeaderStatKey,
  mode: StatMode,
  n = 3,
  t?: AttemptThresholds,
): LeaderEntry<T>[] {
  const ranks = rankMap(players, key, mode, t);
  return sortLeaders(players, key, defaultSortDir(key), mode, t)
    .filter((p) => ranks.has(p.id))
    .slice(0, n)
    .map((p) => ({ player: p, value: statValue(p, key, mode), rank: ranks.get(p.id)! }));
}

/** 성공률 열의 시즌 합계 성공/시도 (예: { made: 396, att: 794 }). 성공률이 아닌 지표는 null */
export function madeAttempts(p: LeaderPlayer, key: LeaderStatKey): { made: number; att: number } | null {
  switch (key) {
    case "fgPct":
      return { made: p.fgm, att: p.fga };
    case "tpPct":
      return { made: p.tpm, att: p.tpa };
    case "ftPct":
      return { made: p.ftm, att: p.fta };
    default:
      return null;
  }
}

/** 성공률 지표의 시도 필드 이름 (예: "야투"). 성공률이 아니면 null */
export function attemptName(key: LeaderStatKey): string | null {
  return isPctKey(key) ? PCT_ATTEMPTS[key].name : null;
}

// ─────────────────────────────────────────────
// 표기
// ─────────────────────────────────────────────

const nf = (d: number) => new Intl.NumberFormat("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const NF0 = nf(0);
const NF1 = nf(1);

/** 성공/시도 표기, 예: "396/794" (시즌 합계 — 경기당 모드에서도 합계 그대로) */
export function formatMadeAttempts(m: { made: number; att: number }): string {
  return `${NF0.format(m.made)}/${NF0.format(m.att)}`;
}

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
 * 쿼리 문자열 → 상태. 모르는 값·이 시즌에 없는 팀·없는 부문(예: 예전 주소의 cat=pie)은 기본값으로.
 * 형식: ?cat=reb&mode=total&origin=dom&team=55&q=1 (기본값인 항목은 생략)
 */
export function parseLeadersQuery(
  search: string,
  ctx: { teamCodes: readonly string[] },
): LeadersState {
  const qs = new URLSearchParams(search);
  const d = DEFAULT_LEADERS_STATE;
  const cat = qs.get("cat") as LeaderStatKey | null;
  const origin = (Object.keys(ORIGIN_PARAM) as OriginFilter[]).find((o) => ORIGIN_PARAM[o] === qs.get("origin"));
  const team = qs.get("team");
  const q = Number(qs.get("q"));
  return {
    category: cat && LEADER_CATEGORIES.includes(cat) ? cat : d.category,
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
