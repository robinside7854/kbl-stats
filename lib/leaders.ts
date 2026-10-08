// 시즌 순위표의 정렬·필터·순위·표기 규칙 — 순수 함수만 둔다 (CLAUDE.md 원칙 5).
// 화면(app/components/LeadersView)은 여기 함수를 부르기만 하고 직접 계산하지 않는다.
// 경기당 환산은 lib/metrics.ts 의 perGame 을 그대로 쓴다. 비율 지표(야투%·3점%·자유투%·TS%·PER)는 KBL 계산값 그대로.
// 성공률(야투·3점·자유투)의 시도 기준은 lib/metrics.ts attemptThresholds — 플레이어 카드와 같은 함수.

import {
  attemptThresholds,
  DEFAULT_QUALIFY,
  isPctKey,
  isQualified,
  meetsAttemptThreshold,
  PCT_ATTEMPTS,
  per30,
  perGame,
  QUALIFY_PRESETS,
  qualifyShort,
  type AttemptThresholds,
  type QualifyRule,
  winPct,
} from "./metrics";
import {
  filterByNationality,
  filterByPosition,
  nationalityFilterLabel as nationalityFilterLabelOf,
  nationalityFromParam,
  nationalityParam,
  positionFilterLabel as positionFilterLabelOf,
  positionFromParam,
  positionParam,
  type NationalityFilter,
  type PositionFilter,
} from "./roster";
import type { LeaderPlayer } from "./types";
import type { LeaderZoneKey } from "./shots";

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
  | "tov"
  | "fouls"
  | "fgPct"
  | "tpPct"
  | "ftPct"
  | "tsPct"
  | "usgPct"
  | "per"
  // 2026-10-01 (Basketball-Reference·NBA.com 참고): 허슬(2025-26만) · 슛 구역 성공률(슛 차트 있는 2006-07~)
  | "defl"
  | "screen"
  | "rimPct"
  | "midPct"
  | "corner3Pct"
  | "arc3Pct"
  | "corner3LPct"
  | "corner3RPct"
  | "winPct";

/** 경기당 / 시즌 합계 / 30분당 (30분당 = 시즌 누적 ÷ 출전 분 × 30, lib/metrics per30 — NBA 의 36분(3쿼터)을 KBL 10분 쿼터에 맞춤) */
export type StatMode = "perGame" | "total" | "per30";
/**
 * 전체 / 국내 / 외국 / 아시아쿼터 — 선수 마스터 국적(nationality) 기준 (lib/roster.ts filterByNationality).
 * 마스터가 없으면 이름 추정 isForeign 으로 국내/외국만 갈린다(아시아쿼터는 빈 목록).
 */
export type OriginFilter = NationalityFilter;
export type SortDir = "desc" | "asc";

export interface LeaderStatDef {
  key: LeaderStatKey;
  /** 부문 이름, 예: "득점" */
  label: string;
  /** 표 열 제목(짧게), 예: "득점" / "3점%" */
  short: string;
  /** PC 표 머리글이 short 보다 더 짧아야 할 때 (17개 열을 992px 안에 넣기 위해), 예: 출전시간 "출전" */
  th?: string;
  /**
   * count: 시즌 누적값 → 경기당 모드면 perGame 환산
   * games: 경기 수 — 모드와 관계없이 그대로
   * rate : KBL 계산 비율·지수 — 모드와 관계없이 그대로
   * zone : 슛 구역 성공률 (슛 차트 좌표로 우리가 센 성공 ÷ 시도) — 모드와 관계없이 그대로
   */
  kind: "count" | "games" | "rate" | "zone";
  /** zone 지표의 구역 (lib/shots) */
  zone?: LeaderZoneKey;
  /** high: 클수록 상위(기본) / low: 작을수록 상위 (턴오버) — 1~3위 카드·순위·기본 정렬 방향 */
  better: "high" | "low";
}

export const LEADER_STATS: Record<LeaderStatKey, LeaderStatDef> = {
  games: { key: "games", label: "경기", short: "경기", kind: "games", better: "high" },
  minutes: { key: "minutes", label: "출전시간", short: "출전(분)", th: "출전", kind: "count", better: "high" },
  points: { key: "points", label: "득점", short: "득점", kind: "count", better: "high" },
  reb: { key: "reb", label: "리바운드", short: "리바", kind: "count", better: "high" },
  ast: { key: "ast", label: "어시스트", short: "어시", kind: "count", better: "high" },
  stl: { key: "stl", label: "스틸", short: "스틸", kind: "count", better: "high" },
  blk: { key: "blk", label: "블록", short: "블록", kind: "count", better: "high" },
  // 3점 성공: 2026-10-01 홈 부문 추가 요청으로 다시 넣음(경기당 성공 개수). 열은 3점% 바로 앞
  tpm: { key: "tpm", label: "3점 성공", short: "3점", kind: "count", better: "high" },
  tov: { key: "tov", label: "턴오버", short: "턴오버", kind: "count", better: "low" },
  // 파울: 표 열로만 (부문 1~3위 카드에는 넣지 않는다). 정렬 기본 방향은 적은 순
  fouls: { key: "fouls", label: "파울", short: "파울", kind: "count", better: "low" },
  fgPct: { key: "fgPct", label: "야투율", short: "야투%", kind: "rate", better: "high" },
  tpPct: { key: "tpPct", label: "3점 성공률", short: "3점%", kind: "rate", better: "high" },
  ftPct: { key: "ftPct", label: "자유투 성공률", short: "자유투%", kind: "rate", better: "high" },
  tsPct: { key: "tsPct", label: "TS%", short: "TS%", kind: "rate", better: "high" },
  // USG%: 공격 점유율(높을수록 "많이 맡는다" — 잘한다는 뜻은 아님). 2026-10-01 사용자 요청으로 부문(고급 묶음)에도 넣음. 없는 시즌은 null → 칩 숨김
  usgPct: { key: "usgPct", label: "USG%", short: "USG%", kind: "rate", better: "high" },
  per: { key: "per", label: "PER", short: "PER", kind: "rate", better: "high" },
  // 승률: 그 선수가 뛴 경기의 팀 승률 (결장 경기 제외, lib/metrics winPct). 2026-10-01 사용자 요청
  winPct: { key: "winPct", label: "승률", short: "승률", kind: "rate", better: "high" },
  // 허슬: KBL 이 2025-26 부터 기록 (coverage.hustle). 없는 시즌은 null → 부문 칩에서 숨긴다
  defl: { key: "defl", label: "디플렉션", short: "디플렉션", kind: "count", better: "high" },
  screen: { key: "screen", label: "스크린 어시스트", short: "스크린A", kind: "count", better: "high" },
  // 슛 구역 성공률: 그 구역 경기당 시도가 리그 평균 이상인 선수만 순위 (leaderThresholds.zones)
  rimPct: { key: "rimPct", label: "골밑 성공률", short: "골밑%", kind: "zone", zone: "rim", better: "high" },
  midPct: { key: "midPct", label: "미드레인지 성공률", short: "미드%", kind: "zone", zone: "mid", better: "high" },
  corner3Pct: { key: "corner3Pct", label: "코너 3점 성공률", short: "코너3%", kind: "zone", zone: "corner3", better: "high" },
  // 코너 좌우 (슈터가 바스켓을 볼 때 기준, lib/shots cornerSide) — 2026-10-01 사용자 요청
  corner3LPct: { key: "corner3LPct", label: "왼쪽 코너 3점 성공률", short: "왼코너%", kind: "zone", zone: "corner3L", better: "high" },
  corner3RPct: { key: "corner3RPct", label: "오른쪽 코너 3점 성공률", short: "오른코너%", kind: "zone", zone: "corner3R", better: "high" },
  arc3Pct: { key: "arc3Pct", label: "아크 3점 성공률", short: "아크3%", kind: "zone", zone: "arc3", better: "high" },
};

/**
 * 부문 묶음 (2026-10-01: 부문 칩이 18개로 늘어 한 줄을 옆으로 밀어야 했다 → 묶음을 먼저 고르고 그 안의 부문을 고른다).
 * 순서 = 화면 순서. 그 시즌에 값이 없는 부문은 빠지고, 부문이 하나도 없는 묶음(옛 시즌 허슬·슛 구역)은 묶음째 숨긴다.
 */
export type LeaderCategoryGroupKey = "basic" | "shooting" | "zones" | "advanced" | "hustle";

export interface LeaderCategoryGroup {
  key: LeaderCategoryGroupKey;
  label: string;
  categories: readonly LeaderStatKey[];
}

export const LEADER_CATEGORY_GROUPS: readonly LeaderCategoryGroup[] = [
  { key: "basic", label: "기본", categories: ["points", "reb", "ast", "stl", "blk"] }, // 턴오버·승률은 부문 칩에서 뺌(2026-10-01 사용자: 순위로 보는 의미가 없음) — 표 열 정렬로는 그대로 볼 수 있음
  { key: "shooting", label: "슈팅", categories: ["tpm", "fgPct", "tpPct", "ftPct"] },
  { key: "zones", label: "슛 구역", categories: ["rimPct", "midPct", "corner3Pct", "corner3LPct", "corner3RPct", "arc3Pct"] },
  { key: "advanced", label: "고급", categories: ["per", "tsPct", "usgPct"] },
  { key: "hustle", label: "허슬", categories: ["defl", "screen"] },
];

/** 상단 부문 선택지 (1~3위 카드) = 묶음 순서대로 펼친 것 */
export const LEADER_CATEGORIES: readonly LeaderStatKey[] = LEADER_CATEGORY_GROUPS.flatMap((g) => g.categories);

/** 부문이 속한 묶음 (부문 목록에 없으면 기본) */
export function categoryGroupOf(key: LeaderStatKey): LeaderCategoryGroupKey {
  return LEADER_CATEGORY_GROUPS.find((g) => g.categories.includes(key))?.key ?? "basic";
}

/** 그 시즌에 고를 수 있는 묶음과 그 안의 부문 (available = availableCategories 결과). 빈 묶음은 뺀다 */
export function availableCategoryGroups(available: readonly LeaderStatKey[]): LeaderCategoryGroup[] {
  return LEADER_CATEGORY_GROUPS.map((g) => ({ ...g, categories: g.categories.filter((k) => available.includes(k)) })).filter(
    (g) => g.categories.length > 0,
  );
}

/**
 * 리더보드 부문 칩 한 줄 (2026-10-06 사용자: 누르는 단계는 최대 2번 — 묶음 → 부문 두 단계를 한 줄로).
 * 많이 보는 6개는 늘 칩으로, 나머지는 "다른 부문" 버튼을 눌러 펼친 묶음 목록에서 고른다.
 */
export const PRIMARY_CATEGORIES: readonly LeaderStatKey[] = ["points", "reb", "ast", "stl", "blk", "tpm"];

/** 칩 한 줄에 놓을 부문 (그 시즌에 있는 것만) */
export function primaryCategories(available: readonly LeaderStatKey[]): LeaderStatKey[] {
  return PRIMARY_CATEGORIES.filter((k) => available.includes(k));
}

/** "다른 부문" 펼침 목록: 칩 한 줄에 없는 부문을 묶음별로 (빈 묶음은 뺀다) */
export function secondaryCategoryGroups(available: readonly LeaderStatKey[]): LeaderCategoryGroup[] {
  return availableCategoryGroups(available)
    .map((g) => ({ ...g, categories: g.categories.filter((k) => !PRIMARY_CATEGORIES.includes(k)) }))
    .filter((g) => g.categories.length > 0);
}

/** 묶음 칩 안의 짧은 이름: 슛 구역 묶음은 " 성공률"을 뗀다(묶음 이름이 이미 말해 줌) */
export function categoryChipLabel(key: LeaderStatKey): string {
  const def = LEADER_STATS[key];
  return def.kind === "zone" ? def.label.replace(" 성공률", "") : def.label;
}

/** 그 시즌에 값이 있는 부문만 (허슬은 2025-26, 슛 구역은 슛 차트 있는 시즌). 값이 하나도 없으면 칩을 숨긴다 */
export function availableCategories(players: readonly LeaderPlayer[]): LeaderStatKey[] {
  return LEADER_CATEGORIES.filter((k) => players.some((p) => Number.isFinite(rawValue(p, k))));
}

/** 기본 부문: 팬이 가장 먼저 찾는 "득점왕" */
export const DEFAULT_CATEGORY: LeaderStatKey = "points";

/** 표 열 기본 순서. 앞의 CORE_COLUMNS 는 모바일 첫 화면에 들어가는 핵심 열 (출전시간은 경기 바로 오른쪽) */
export const TABLE_COLUMNS: readonly LeaderStatKey[] = [
  "games", "minutes", "points", "reb", "ast", "stl", "blk", "tov", "fouls", "fgPct", "tpm", "tpPct", "ftPct", "tsPct", "usgPct", "per",
];
export const CORE_COLUMNS: readonly LeaderStatKey[] = ["games", "minutes", "points", "reb", "ast"];

/**
 * 표 열 순서. 선택한 부문(focus)이 핵심 열이 아니면 선수 열 바로 뒤(맨 앞)로 끌어온다 —
 * 모바일에서 가로 스크롤 없이도 지금 보는 부문의 값이 보이게.
 */
export function columnOrder(focus: LeaderStatKey): LeaderStatKey[] {
  const cols = [...TABLE_COLUMNS];
  if (CORE_COLUMNS.includes(focus)) return cols;
  // 표 기본 열에 없는 부문(허슬·슛 구역)도 맨 앞에 끼워 지금 보는 값이 보이게
  return [focus, ...cols.filter((k) => k !== focus)];
}

/** 그 지표의 "상위" 방향 정렬 (high → desc, low → asc). 부문 선택·열 제목 첫 클릭의 기본 방향 */
export function defaultSortDir(key: LeaderStatKey): SortDir {
  return LEADER_STATS[key].better === "low" ? "asc" : "desc";
}

// ─────────────────────────────────────────────
// 값·필터·정렬·순위
// ─────────────────────────────────────────────

/** 모드 환산 전 값 (시즌 누적·비율). 없으면 NaN — USG% 없는 시즌, 허슬 없는 시즌, 슛 차트 없는 시즌·그 구역 시도 0 */
export function rawValue(p: LeaderPlayer, key: LeaderStatKey): number {
  const def = LEADER_STATS[key];
  if (def.kind === "zone") {
    const z = p.zones?.[def.zone!];
    return z && z.a > 0 ? (z.m / z.a) * 100 : NaN;
  }
  if (key === "winPct") return winPct(p.wins ?? 0, p.losses ?? 0) ?? NaN;
  if (key === "defl") return p.deflections ?? NaN;
  if (key === "screen") return p.screenAst ?? NaN;
  return (p[key as keyof LeaderPlayer] as number | null | undefined) ?? NaN;
}

/** 표시·정렬에 쓰는 값. count 지표는 경기당 모드에서 perGame, 30분당 모드에서 per30. 값이 없으면 NaN → 표기 "–"·정렬 맨 뒤 */
export function statValue(p: LeaderPlayer, key: LeaderStatKey, mode: StatMode): number {
  const v = rawValue(p, key);
  if (LEADER_STATS[key].kind !== "count") return v;
  // 출전시간은 30분당으로 바꾸면 의미가 없어(항상 30) 경기당으로 보여 준다
  if (mode === "perGame" || (mode === "per30" && key === "minutes")) return perGame(v, p.games);
  if (mode === "per30") return p.minutes > 0 ? per30(v, p.minutes) : NaN;
  return v;
}

/** 비율 지표는 경기당/합계/30분당 전환의 영향을 받지 않는다 */
export function isModeIndependent(key: LeaderStatKey): boolean {
  return LEADER_STATS[key].kind !== "count";
}

// ─────────────────────────────────────────────
// 성공률 시도 기준 (야투·3점·자유투 = lib/metrics attemptThresholds + 슛 구역)
// ─────────────────────────────────────────────

export type ZoneStatKey = "rimPct" | "midPct" | "corner3Pct" | "arc3Pct";

/** 순위표 시도 기준: 야투·3점·자유투(카드와 같은 값) + 슛 구역별 경기당 시도 리그 평균 */
export interface LeaderThresholds extends AttemptThresholds {
  zones?: Partial<Record<LeaderZoneKey, number>>;
}

/**
 * 슛 구역 시도 기준 = 표본 충족 + 슛 데이터 있는 선수의 그 구역 경기당 시도 평균 (attemptThresholds 와 같은 방식).
 * 1개 던져 1개 넣은 100%가 1위가 되지 않게 — 우리 사이트 규칙.
 */
export function zoneThresholds(players: readonly LeaderPlayer[], rule: QualifyRule): Partial<Record<LeaderZoneKey, number>> {
  const q = players.filter((p) => isQualified(p, rule) && p.games > 0 && p.zones);
  const out: Partial<Record<LeaderZoneKey, number>> = {};
  if (q.length === 0) return out;
  for (const key of ["rim", "paint", "mid", "corner3", "arc3", "corner3L", "corner3R"] as const) {
    const withKey = q.filter((p) => p.zones![key]);
    if (withKey.length) out[key] = withKey.reduce((s, p) => s + p.zones![key]!.a / p.games, 0) / withKey.length;
  }
  return out;
}

/**
 * 이 지표의 순위에 들 수 있는가. 성공률(야투·3점·자유투)은 경기당 시도가 기준(t) 이상이어야 한다.
 * t 를 넘기지 않으면(undefined) 시도 기준 없이 모두 true.
 */
export function isRankEligible(p: LeaderPlayer, key: LeaderStatKey, t?: LeaderThresholds): boolean {
  if (!t) return true;
  const def = LEADER_STATS[key];
  if (def.kind === "zone") {
    const min = t.zones?.[def.zone!];
    const z = p.zones?.[def.zone!];
    if (min === undefined) return true;
    return !!z && p.games > 0 && z.a / p.games >= min;
  }
  if (!isPctKey(key)) return true;
  return meetsAttemptThreshold(p, key, t);
}

export interface LeaderFilter {
  origin: OriginFilter;
  /** 포지션 묶음 (없으면 전체) — lib/roster.ts filterByPosition */
  position?: PositionFilter;
  /** null 이면 전체 팀 */
  teamCode: string | null;
  rule: QualifyRule;
}

/** 국적(nationality 기반) · 포지션 · 팀 · 표본 기준(lib/metrics isQualified)으로 거른다 */
export function filterLeaders<T extends LeaderPlayer>(players: readonly T[], f: LeaderFilter): T[] {
  return filterByPosition(filterByNationality(players, f.origin), f.position ?? "all").filter(
    (p) => (f.teamCode === null || p.teamCode === f.teamCode) && isQualified(p, f.rule),
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
 * t 를 넘기면 성공률 지표의 시도 기준 미달 선수는 순위가 없다(맵에 없음 → 화면은 "–"). 값이 없는 선수도 순위 없음.
 */
export function rankMap(
  players: readonly LeaderPlayer[],
  key: LeaderStatKey,
  mode: StatMode,
  t?: AttemptThresholds,
): Map<string, number> {
  // 값이 없는 선수(USG% 없는 시즌 = NaN)는 순위를 매기지 않는다
  const sorted = sortLeaders(players, key, defaultSortDir(key), mode, t).filter(
    (p) => isRankEligible(p, key, t) && Number.isFinite(statValue(p, key, mode)),
  );
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
export function madeAttempts(p: LeaderPlayer, key: LeaderStatKey): { made: number; att: number; text?: string } | null {
  const def = LEADER_STATS[key];
  // 승률 칸 아래는 "31승 21패"
  if (key === "winPct") return { made: p.wins ?? 0, att: (p.wins ?? 0) + (p.losses ?? 0), text: `${p.wins ?? 0}승 ${p.losses ?? 0}패` };
  if (def.kind === "zone") {
    const z = p.zones?.[def.zone!];
    return z ? { made: z.m, att: z.a } : null;
  }
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
  if (LEADER_STATS[key].kind === "zone") return LEADER_STATS[key].label.replace(" 성공률", "");
  return isPctKey(key) ? PCT_ATTEMPTS[key].name : null;
}

// ─────────────────────────────────────────────
// 표기
// ─────────────────────────────────────────────

const nf = (d: number) => new Intl.NumberFormat("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const NF0 = nf(0);
const NF1 = nf(1);

/** 성공/시도 표기, 예: "396/794" (시즌 합계 — 경기당 모드에서도 합계 그대로) */
export function formatMadeAttempts(m: { made: number; att: number; text?: string }): string {
  if (m.text) return m.text;
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
  if (mode === "per30" && key === "minutes") return `경기당 ${def.label}`;
  return `${mode === "perGame" ? "경기당" : mode === "per30" ? "30분당" : "시즌 합계"} ${def.label}`;
}

// ─────────────────────────────────────────────
// 주소 쿼리 (공유·새로고침 시 상태 유지)
// ─────────────────────────────────────────────

export interface LeadersState {
  category: LeaderStatKey;
  mode: StatMode;
  origin: OriginFilter;
  /** 포지션 묶음 (쿼리 pos=g|f|c) */
  position: PositionFilter;
  teamCode: string | null;
  /** QUALIFY_PRESETS 의 번호 */
  presetIdx: number;
}

export const DEFAULT_LEADERS_STATE: LeadersState = {
  category: DEFAULT_CATEGORY,
  mode: "perGame",
  origin: "all",
  position: "all",
  teamCode: null,
  presetIdx: 0,
};

/**
 * 쿼리 문자열 → 상태. 모르는 값·이 시즌에 없는 팀·없는 부문(예: 예전 주소의 cat=pie)은 기본값으로.
 * 형식: ?cat=reb&mode=total&origin=dom&pos=g&team=55&q=1 (기본값인 항목은 생략)
 */
export function parseLeadersQuery(
  search: string,
  ctx: { teamCodes: readonly string[]; presetCount?: number },
): LeadersState {
  const qs = new URLSearchParams(search);
  const d = DEFAULT_LEADERS_STATE;
  const cat = qs.get("cat") as LeaderStatKey | null;
  const team = qs.get("team");
  const q = Number(qs.get("q"));
  return {
    category: cat && LEADER_CATEGORIES.includes(cat) ? cat : d.category,
    // 예전 공유 링크 mode=per40 도 30분당으로 받는다
    mode: qs.get("mode") === "total" ? "total" : qs.get("mode") === "per30" || qs.get("mode") === "per40" ? "per30" : d.mode,
    origin: nationalityFromParam(qs.get("origin")),
    position: positionFromParam(qs.get("pos")),
    teamCode: team && ctx.teamCodes.includes(team) ? team : d.teamCode,
    presetIdx: Number.isInteger(q) && q >= 0 && q < (ctx.presetCount ?? QUALIFY_PRESETS.length) ? q : d.presetIdx,
  };
}

/** 상태 → 쿼리 문자열 ("" 또는 "?..."). 기본값 항목은 넣지 않는다 */
export function leadersQueryString(s: LeadersState): string {
  const d = DEFAULT_LEADERS_STATE;
  const qs = new URLSearchParams();
  if (s.category !== d.category) qs.set("cat", s.category);
  if (s.mode !== d.mode) qs.set("mode", s.mode);
  if (s.origin !== d.origin) qs.set("origin", nationalityParam(s.origin));
  if (s.position !== d.position) qs.set("pos", positionParam(s.position));
  if (s.teamCode !== d.teamCode && s.teamCode !== null) qs.set("team", s.teamCode);
  if (s.presetIdx !== d.presetIdx) qs.set("q", String(s.presetIdx));
  const str = qs.toString();
  return str ? `?${str}` : "";
}

// ─────────────────────────────────────────────
// 행 카드·더 보기 (모바일 순위표·기록표 — 2026-09-30 디자인 점검 A1·A3)
// ─────────────────────────────────────────────

/** 순위표 첫 화면 행 수. "더 보기"를 누를 때마다 이만큼 더 */
export const LEADERS_PAGE_SIZE = 25;

/**
 * 앞에서 limit 개만 자른다 + 남은 개수. 목록 화면의 "더 보기 (남은 n명)" 공용.
 * limit 이 0 이하이면 빈 목록.
 */
export function takeFirst<T>(rows: readonly T[], limit: number): { shown: T[]; remaining: number } {
  const n = Math.max(0, Math.min(rows.length, Math.floor(limit)));
  return { shown: rows.slice(0, n), remaining: rows.length - n };
}

/**
 * 모바일 행 카드의 보조값 열쇠 (접힌 상태에서 이름 아래 작게).
 * 경기 · 출전 · 다음 핵심(득점, 지금 기준이 득점이면 리바) 중 지금 정렬 기준(key)을 뺀 앞 3개.
 */
export function rowSummaryKeys(key: LeaderStatKey): LeaderStatKey[] {
  const pool: LeaderStatKey[] = ["games", "minutes", "points", "reb", "ast"];
  return pool.filter((k) => k !== key).slice(0, 3);
}

/** 보조값 한 토막, 예: "54경기" · "32.1분" · "득점 25.3" */
export function formatSummaryStat(p: LeaderPlayer, key: LeaderStatKey, mode: StatMode): string {
  const text = formatStat(statValue(p, key, mode), key, mode);
  if (key === "games") return `${text}경기`;
  if (key === "minutes") return `${text}분`;
  return `${LEADER_STATS[key].short} ${text}`;
}

// ─────────────────────────────────────────────
// 적용 중 필터 요약 칩 (필터 시트 옆 한 줄 — 디자인 점검 A2)
// ─────────────────────────────────────────────

/** 순위표에서 "필터" 시트 안에 들어가는 항목 (부문은 항상 보이는 1차 컨트롤이라 제외) */
export type LeaderFilterField = "mode" | "position" | "origin" | "teamCode" | "presetIdx";

export interface FilterChipInfo<F extends string> {
  field: F;
  /** 칩 글자, 예: "가드" · "국내" · "20경기·300분+" */
  label: string;
}

/**
 * 기본값이 아닌 필터만 칩으로. 순서 = 시트 안 순서.
 * teamLabel: 팀 코드 → 표시 이름 (화면이 팀 목록으로 만든다)
 */
export function leaderFilterChips(
  s: LeadersState,
  teamLabel: (code: string) => string,
  presets: readonly QualifyRule[] = QUALIFY_PRESETS,
): FilterChipInfo<LeaderFilterField>[] {
  const d = DEFAULT_LEADERS_STATE;
  const out: FilterChipInfo<LeaderFilterField>[] = [];
  if (s.mode !== d.mode) out.push({ field: "mode", label: s.mode === "total" ? "시즌 합계" : s.mode === "per30" ? "30분당" : "경기당" });
  if (s.position !== d.position) out.push({ field: "position", label: positionFilterLabelOf(s.position) });
  if (s.origin !== d.origin) out.push({ field: "origin", label: nationalityFilterLabelOf(s.origin) });
  if (s.teamCode !== null) out.push({ field: "teamCode", label: teamLabel(s.teamCode) });
  if (s.presetIdx !== d.presetIdx) out.push({ field: "presetIdx", label: qualifyShort(presets[s.presetIdx] ?? presets[0]) });
  return out;
}

/** 칩의 ✕: 그 항목만 기본값으로 */
export function clearLeaderFilter(s: LeadersState, field: LeaderFilterField): LeadersState {
  return { ...s, [field]: DEFAULT_LEADERS_STATE[field] };
}

/** 필터 시트의 "초기화": 부문은 그대로 두고 나머지를 기본값으로 */
export function resetLeaderFilters(s: LeadersState): LeadersState {
  return { ...DEFAULT_LEADERS_STATE, category: s.category };
}

// ─────────────────────────────────────────────
// CSV 내려받기 (Basketball-Reference "Share & Export" 참고, 2026-10-01)
// ─────────────────────────────────────────────

const csvCell = (v: string | number) => {
  const t = String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/**
 * 지금 화면의 순위표(필터·정렬·단위 그대로) → CSV 문자열. 엑셀에서 한글이 깨지지 않게 앞에 BOM 을 붙인다.
 * 열: 순위 · 선수 · 팀 · 포지션 · columns (표기는 화면과 같은 formatStat), 성공률은 성공/시도 열을 하나 더.
 */
export function leadersCsv(
  rows: readonly LeaderPlayer[],
  columns: readonly LeaderStatKey[],
  mode: StatMode,
  ranks: ReadonlyMap<string, number>,
  teamName: (p: LeaderPlayer) => string,
): string {
  const head = ["순위", "선수", "팀", "포지션"];
  for (const k of columns) {
    head.push(statTitle(k, mode));
    if (attemptName(k)) head.push(`${LEADER_STATS[k].short} 성공/시도`);
  }
  const lines = [head.map(csvCell).join(",")];
  for (const p of rows) {
    const cells: (string | number)[] = [ranks.get(p.id) ?? "", p.nameKo, teamName(p), p.position ?? ""];
    for (const k of columns) {
      const v = statValue(p, k, mode);
      cells.push(Number.isFinite(v) ? formatStat(v, k, mode).replace(/,/g, "") : "");
      if (attemptName(k)) {
        const ma = madeAttempts(p, k);
        cells.push(ma ? `${ma.made}/${ma.att}` : "");
      }
    }
    lines.push(cells.map(csvCell).join(","));
  }
  return "\uFEFF" + lines.join("\r\n");
}

// ─────────────────────────────────────────────
// 시즌 리그 1위 표시 (Basketball-Reference 기록표의 굵은 숫자, 2026-10-01)
// ─────────────────────────────────────────────

/** 굵게 표시할 부문: 많을수록 좋은 기록·성공률·지수 (턴오버·파울은 "적은 1위"라 헷갈려서, USG% 는 높을수록 잘함이 아니라서 뺀다) */
export const LEADER_MARK_KEYS: readonly LeaderStatKey[] = [
  "points", "reb", "ast", "stl", "blk", "tpm", "fgPct", "tpPct", "ftPct", "tsPct", "per",
];

/**
 * 한 시즌 리그 1위 부문 (선수 id → 1위였던 부문). 순위표 기본값과 같은 규칙: 기본 표본 기준(DEFAULT_QUALIFY),
 * 성공률은 시도 기준, 공동 1위 포함. 모드별로 다르다(합계 1위 ≠ 경기당 1위).
 */
export function seasonLeaderMarks(
  players: readonly LeaderPlayer[],
  mode: StatMode,
  rule: QualifyRule = DEFAULT_QUALIFY,
): Map<string, LeaderStatKey[]> {
  const pool = players.filter((p) => isQualified(p, rule));
  const t = attemptThresholds(players, rule);
  const out = new Map<string, LeaderStatKey[]>();
  for (const key of LEADER_MARK_KEYS) {
    for (const [id, r] of rankMap(pool, key, mode, t)) {
      if (r !== 1) continue;
      const list = out.get(id) ?? [];
      list.push(key);
      out.set(id, list);
    }
  }
  return out;
}

// ─────────────────────────────────────────────
// 순위 변동 ▲▼ (2026-10-08 토스 검토 B — 토스증권 "실시간 이슈"처럼 순위 옆에 변동·새로 진입)
// 진행 중 시즌만: 마지막 경기일 기록을 빼서 "그 전 경기일까지" 합계를 만들고, 같은 필터·같은 방식으로 순위를 다시 매겨 비교한다.
// 누적 기록 부문(득점·리바·어시·스틸·블록·3점)만 — 성공률·고급 지표는 하루 기록으로 되돌릴 수 없다.
// ─────────────────────────────────────────────

/** 순위 변동을 보여 주는 부문 */
export const RANK_CHANGE_KEYS: readonly LeaderStatKey[] = PRIMARY_CATEGORIES;
/** 이 순위 안에 처음 들어오면 "새로" */
export const RANK_NEW_TOP = 10;

/** 그 전 경기일까지의 합계 (마지막 경기일에 뛴 선수만 — 안 뛴 선수는 지금과 같다) */
export interface PrevLine {
  games: number;
  minutes: number;
  points: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tpm: number;
}

/** 마지막 경기일 한 줄 (games.json 박스스코어에서 필요한 것만) */
export interface DayLine {
  id: string;
  sec: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tpm: number;
}

/** 지금 합계 − 마지막 경기일 기록. 출전 시간이 0 인 줄(명단만 오른 선수)도 경기 수 1 로 센다(KBL 경기 수와 같게 — 박스에 있으면 뛴 것) */
export function previousLines(players: readonly LeaderPlayer[], day: readonly DayLine[]): Record<string, PrevLine> {
  const byId = new Map(players.map((p) => [p.id, p]));
  const out: Record<string, PrevLine> = {};
  for (const r of day) {
    const p = byId.get(r.id);
    if (!p) continue;
    out[r.id] = {
      games: Math.max(0, p.games - 1),
      minutes: Math.max(0, p.minutes - r.sec / 60),
      points: Math.max(0, p.points - r.pts),
      reb: Math.max(0, p.reb - r.reb),
      ast: Math.max(0, p.ast - r.ast),
      stl: Math.max(0, p.stl - r.stl),
      blk: Math.max(0, p.blk - r.blk),
      tpm: Math.max(0, p.tpm - r.tpm),
    };
  }
  return out;
}

/** 그 전 경기일 시점의 선수 목록 (그때 아직 안 뛴 선수 = 경기 0 은 뺀다) */
export function withPrevious<T extends LeaderPlayer>(players: readonly T[], prev: Record<string, PrevLine>): T[] {
  return players.flatMap((p) => {
    const l = prev[p.id];
    if (!l) return [p];
    if (l.games <= 0) return [];
    return [{ ...p, ...l }];
  });
}

export interface RankChange {
  kind: "up" | "down" | "new";
  /** 오르거나 내린 계단 수 (new 는 0) */
  delta: number;
}

/** 지금 순위 vs 그 전 순위 → 바뀐 선수만 (같으면 없음). 상위 RANK_NEW_TOP 에 처음 들어오면 new */
export function rankChanges(cur: ReadonlyMap<string, number>, prev: ReadonlyMap<string, number>, top = RANK_NEW_TOP): Map<string, RankChange> {
  const out = new Map<string, RankChange>();
  for (const [id, r] of cur) {
    const before = prev.get(id);
    if (r <= top && (before === undefined || before > top)) out.set(id, { kind: "new", delta: 0 });
    else if (before === undefined) continue;
    else if (before > r) out.set(id, { kind: "up", delta: before - r });
    else if (before < r) out.set(id, { kind: "down", delta: r - before });
  }
  return out;
}
