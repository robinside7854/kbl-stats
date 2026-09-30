// 파생 지표 계산 — 순수 함수만 둔다 (CLAUDE.md 원칙 5).
// 화면 컴포넌트는 여기 함수를 부르기만 하고, 직접 계산하지 않는다.
// 2차 스탯(USG%, TS%, AST%, REB%, PIE, PER)은 KBL이 계산한 값을 그대로 쓰고,
// 여기서는 "그 값이 시즌 안에서 몇 번째쯤인가"(백분위), 경기당·40분당 환산,
// 시즌 커버리지 판정, 레이더 축 세트(modern/classic), 유형 라벨만 만든다.

import type { SeasonCoverage } from "./types";

// ─────────────────────────────────────────────
// 레이더 축 세트
// ─────────────────────────────────────────────
// 시즌마다 채워진 2차 스탯이 다르다(CLAUDE.md "시즌별 데이터 커버리지").
// - modern : KBL 2차 스탯(USG%·AST%·REB%·PIE)이 있는 시즌용 — 기존 축
// - classic: 2차 스탯이 없는 시즌용 "전 시즌 공통 축" — 1차 스탯 40분 환산 + 전 시즌에 있는 TS%·PER
// 어느 세트를 쓸지는 시즌 코드가 아니라 시즌 파일의 coverage.advanced 로 정한다 (axisSetFor).

/** 축 세트별 5개 축. 배열 순서가 곧 레이더 꼭짓점 순서다. */
export const RADAR_AXIS_SETS = {
  modern: ["usgPct", "tsPct", "astPct", "rebPct", "pie"],
  classic: ["pts40", "tsPct", "ast40", "reb40", "per"],
} as const;
export type RadarAxisSet = keyof typeof RADAR_AXIS_SETS;
export type RadarAxis = (typeof RADAR_AXIS_SETS)[RadarAxisSet][number];

/** 세트의 축 목록 */
export function radarAxes(set: RadarAxisSet): readonly RadarAxis[] {
  return RADAR_AXIS_SETS[set];
}

/** 시즌 커버리지로 축 세트 선택: 2차 스탯이 충분하면 modern, 아니면 classic */
export function axisSetFor(coverage: { advanced: boolean }): RadarAxisSet {
  return coverage.advanced ? "modern" : "classic";
}

/** 세트마다 "종합 기여도" 역할을 하는 축 — 기본 선수(1위) 고르기 등에 쓴다 */
export const RADAR_IMPACT_AXIS: Record<RadarAxisSet, RadarAxis> = {
  modern: "pie",
  classic: "per",
};

export const RADAR_AXIS_LABELS: Record<RadarAxis, string> = {
  usgPct: "USG%",
  tsPct: "TS%",
  astPct: "AST%",
  rebPct: "REB%",
  pie: "PIE",
  pts40: "40분당 득점",
  ast40: "40분당 AST",
  reb40: "40분당 REB",
  per: "PER",
};

/** 좁은 자리(플레이어 카드의 작은 레이더 꼭짓점)용 짧은 축 이름. 40분당 축은 옆 표에 "40분당"이 적혀 있다 */
export const RADAR_AXIS_SHORT_LABELS: Record<RadarAxis, string> = {
  usgPct: "USG%",
  tsPct: "TS%",
  astPct: "AST%",
  rebPct: "REB%",
  pie: "PIE",
  pts40: "득점",
  ast40: "AST",
  reb40: "REB",
  per: "PER",
};

/** 레이더 계산에 필요한 최소 필드 (lib/types.ts Player·CardPlayer의 부분집합) */
export interface RadarInput {
  games: number;
  minutes: number;        // 시즌 누적 (분)
  points: number;         // 시즌 누적
  reb: number;            // 시즌 누적
  ast: number;            // 시즌 누적
  per: number;
  usgPct: number;
  tsPct: number;
  astPct: number;
  rebPct: number;
  pie: number;
}

/**
 * 한 선수의 축 값. KBL 2차 스탯은 그대로, 40분당 축(pts40·ast40·reb40)은 per40()으로 파생한다.
 */
export function axisValue(p: RadarInput, axis: RadarAxis): number {
  switch (axis) {
    case "pts40":
      return per40(p.points, p.minutes);
    case "ast40":
      return per40(p.ast, p.minutes);
    case "reb40":
      return per40(p.reb, p.minutes);
    default:
      return p[axis];
  }
}

// ─────────────────────────────────────────────
// 표본 기준 (백분위 비교 집단)
// ─────────────────────────────────────────────

export interface QualifyRule {
  minGames: number;
  minMinutes: number;
}

/** 기본 기준: 10경기 이상 AND 누적 100분 이상. 1997 시즌(팀당 21경기)에서도 절반 수준이라 무리 없음. */
export const DEFAULT_QUALIFY: QualifyRule = { minGames: 10, minMinutes: 100 };

/**
 * 표본 기준 프리셋 (첫 번째가 기본값). 플레이어 카드의 순위·백분위 비교 집단과 순위표의 표본 필터가
 * 같은 목록을 쓴다 — 화면마다 기준이 달라 "같은 선수가 한쪽에만 보이는" 일을 막기 위해.
 */
export const QUALIFY_PRESETS: readonly QualifyRule[] = [
  DEFAULT_QUALIFY,
  { minGames: 20, minMinutes: 300 },
  { minGames: 30, minMinutes: 500 },
  { minGames: 5, minMinutes: 50 },
];
/** 프리셋 긴 표기, 예: "10경기·100분 이상" */
export const qualifyLabel = (r: QualifyRule) => `${r.minGames}경기·${r.minMinutes}분 이상`;
/** 모바일 선택 상자용 짧은 표기, 예: "10경기·100분+" */
export const qualifyShort = (r: QualifyRule) => `${r.minGames}경기·${r.minMinutes}분+`;

export function isQualified(p: { games: number; minutes: number }, rule: QualifyRule): boolean {
  return p.games >= rule.minGames && p.minutes >= rule.minMinutes;
}

// ─────────────────────────────────────────────
// 백분위 (percentile rank)
// ─────────────────────────────────────────────

/**
 * 백분위 순위 (0~100). "mid-rank" 방식:
 *   percentile = (기준값보다 작은 값의 개수 + 0.5 × 같은 값의 개수) / N × 100
 * - reference: 비교 집단(해당 시즌 표본 기준 충족 선수)의 값 배열
 * - value 가 집단 안에 있으면 자기 자신도 "같은 값"으로 반 칸 센다 → 1위도 100이 아니라 100 - 50/N.
 *   (예: 140명 중 1위 ≈ 99.6, 꼴찌 ≈ 0.4, 중앙 ≈ 50)
 * - 표본 미달 선수도 같은 집단에 대어 계산한다 (자신은 집단에 없으므로 순수 비교).
 * - 집단이 비었거나 value가 숫자가 아니면 null.
 * 출처: 통계에서 흔히 쓰는 percentile rank 정의 (Wikipedia "Percentile rank").
 */
export function percentileRank(value: number, reference: readonly number[]): number | null {
  if (!Number.isFinite(value)) return null;
  const valid = reference.filter(Number.isFinite);
  const n = valid.length;
  if (n === 0) return null;
  let below = 0;
  let equal = 0;
  for (const v of valid) {
    if (v < value) below++;
    else if (v === value) equal++;
  }
  return ((below + 0.5 * equal) / n) * 100;
}

/** 세트에 속한 축만 채워진다 (세트 밖 축은 undefined) */
export type RadarPercentiles = Partial<Record<RadarAxis, number | null>>;
/** 축별 비교 집단 값 배열. 세트에 속한 축만 채워진다 */
export type RadarReference = Partial<Record<RadarAxis, number[]>>;

/** 한 선수의 세트 5개 축 백분위. reference 는 같은 세트로 만든 buildReference() 결과를 넘긴다. */
export function radarPercentiles(p: RadarInput, reference: RadarReference, set: RadarAxisSet): RadarPercentiles {
  const out: RadarPercentiles = {};
  for (const axis of radarAxes(set)) out[axis] = percentileRank(axisValue(p, axis), reference[axis] ?? []);
  return out;
}

/** 표본 기준을 충족한 선수들의 축별 값 배열 (백분위 비교 집단) */
export function buildReference<T extends RadarInput>(
  players: readonly T[],
  rule: QualifyRule,
  set: RadarAxisSet,
): RadarReference {
  const qualified = players.filter((p) => isQualified(p, rule));
  const out: RadarReference = {};
  for (const axis of radarAxes(set)) out[axis] = qualified.map((p) => axisValue(p, axis));
  return out;
}

// ─────────────────────────────────────────────
// 경기당 환산
// ─────────────────────────────────────────────

/** 시즌 누적값 ÷ 출전 경기 수. 경기 0이면 0. */
export function perGame(total: number, games: number): number {
  return games > 0 ? total / games : 0;
}

/**
 * 40분당 환산 = 시즌 누적값 ÷ 누적 출전시간(분) × 40. 출전 0분이면 0.
 * KBL 정규 경기는 40분(10분 × 4쿼터)이라 "풀타임 한 경기를 뛰었다면"의 값이 된다.
 * NBA(48분 경기)에서 흔히 쓰는 per-36(= 누적 ÷ 분 × 36)과 같은 방식의 환산이며,
 * 출전시간이 다른 선수끼리 생산성을 비교하려는 목적도 같다.
 * 출처: Basketball-Reference "Per 36 Minutes" 정의를 KBL 경기 시간(40분)에 맞춘 것.
 * 주의: 출전시간이 아주 적은 선수는 값이 튄다 → 백분위 비교 집단은 표본 기준(isQualified)으로 거른다.
 */
export function per40(total: number, minutes: number): number {
  return minutes > 0 ? (total / minutes) * 40 : 0;
}

export interface PerGameStats {
  minutes: number;
  points: number;
  reb: number;
  ast: number;
}

/** 카드에 쓰는 경기당 출전시간·득점·리바운드·어시스트 (각각 perGame 적용) */
export function perGameStats(p: { games: number; minutes: number; points: number; reb: number; ast: number }): PerGameStats {
  return {
    minutes: perGame(p.minutes, p.games),
    points: perGame(p.points, p.games),
    reb: perGame(p.reb, p.games),
    ast: perGame(p.ast, p.games),
  };
}

// ─────────────────────────────────────────────
// 시즌 커버리지 (항목별로 데이터가 채워져 있는가)
// ─────────────────────────────────────────────

/**
 * 값 배열 중 0이 아닌(유한한) 값의 비율이 threshold 이상이면 true. 빈 배열이면 false.
 * KBL은 기록하지 않은 항목을 0으로 준다 → "선수 절반 이상이 0이 아니면 그 시즌은 이 항목이 있다"로 본다.
 * 기본 50%: 2025-26의 2차 스탯(97%)은 통과, 2023-24·2024-25(약 11%)는 탈락,
 * 굿디펜스(기록률 55~90%)는 통과하는 경계.
 */
export function coverageFlag(values: readonly number[], threshold = 0.5): boolean {
  if (values.length === 0) return false;
  const nonZero = values.filter((v) => Number.isFinite(v) && v !== 0).length;
  return nonZero / values.length >= threshold;
}

/** 커버리지 판정에 쓰는 선수 필드 (lib/types.ts Player의 부분집합) */
export interface CoverageInput {
  usgPct: number;
  pie: number;
  astPct: number;
  rebPct: number;
  plusMinus: number;
  goodDef: number;
  screenAst: number;
  deflections: number;
}

/** 한 시즌 선수 목록 → 항목별 커버리지 플래그 (process.ts가 시즌 파일에 저장) */
export function seasonCoverage(players: readonly CoverageInput[], threshold = 0.5): SeasonCoverage {
  const flag = (...keys: (keyof CoverageInput)[]) =>
    keys.every((k) => coverageFlag(players.map((p) => p[k]), threshold));
  return {
    advanced: flag("usgPct", "pie", "astPct", "rebPct"),
    plusMinus: flag("plusMinus"),
    goodDef: flag("goodDef"),
    hustle: flag("screenAst", "deflections"),
  };
}

// ─────────────────────────────────────────────
// 선수 유형 라벨 (재미용, 단순 규칙)
// ─────────────────────────────────────────────

export interface PlayerType {
  label: string;
  /** 라벨을 정한 근거 축 (올라운더·롤플레이어면 null) */
  axis: RadarAxis | null;
}

const TYPE_BY_AXIS: Record<RadarAxis, string> = {
  usgPct: "볼 핸들러형 득점원",
  tsPct: "효율형 슈터",
  astPct: "플레이메이커",
  rebPct: "리바운더",
  pie: "코트 위 임팩트형",
  pts40: "득점원",
  ast40: "플레이메이커",
  reb40: "리바운더",
  per: "코트 위 임팩트형",
};

/**
 * 백분위 프로필 → 한 줄 유형 라벨. set 의 5개 축만 본다. 규칙 (위에서부터 먼저 맞는 것):
 *  1) 5개 축이 모두 60 이상          → "올라운더"      (고르게 상위권)
 *  2) 가장 높은 축이 40 미만          → "궂은일 담당 롤 플레이어" (어느 축도 두드러지지 않음)
 *  3) 그 외: 가장 높은 축의 유형       → TYPE_BY_AXIS
 *     동점이면 세트 축 순서(modern: USG → TS → AST → REB → PIE, classic: 득점 → TS → AST → REB → PER)로 먼저 나온 축.
 * 백분위가 null(또는 없음)인 축은 무시. 전부 null이면 "분석 불가".
 * 의도: 재미용 한 줄. 정교한 분류(클러스터링 등)는 하지 않는다.
 */
export function playerType(pct: RadarPercentiles, set: RadarAxisSet): PlayerType {
  const axes = radarAxes(set);
  const entries = axes
    .map((a) => [a, pct[a] ?? null] as const)
    .filter((e): e is readonly [RadarAxis, number] => e[1] !== null);
  if (entries.length === 0) return { label: "분석 불가", axis: null };
  if (entries.length === axes.length && entries.every(([, v]) => v >= 60)) {
    return { label: "올라운더", axis: null };
  }
  let top = entries[0];
  for (const e of entries) if (e[1] > top[1]) top = e;
  if (top[1] < 40) return { label: "궂은일 담당 롤 플레이어", axis: null };
  return { label: TYPE_BY_AXIS[top[0]], axis: top[0] };
}

// ─────────────────────────────────────────────
// 플레이어 카드 메인 스탯 9개 + 시즌 순위
// ─────────────────────────────────────────────
// 카드 중단 3×3 격자: 득점·리바운드·어시스트 / 스틸·블록·턴오버 / 야투율·3점 성공률·자유투 성공률.
// 누적 스탯은 경기당(perGame), 성공률은 KBL 계산값(0~100) 그대로.
// 순위 비교 집단 = 현재 표본 기준(QUALIFY_PRESETS 중 선택된 것)을 충족한 선수.
// 성공률은 여기에 "경기당 시도 수" 기준을 더한다 — 표본 기준만으로는 1/1(100%) 같은 선수가 1위가 되기 때문.

export type CardStatKey = "points" | "reb" | "ast" | "stl" | "blk" | "tov" | "fgPct" | "tpPct" | "ftPct";

export interface CardStatDef {
  key: CardStatKey;
  label: string;
  /** perGame: 시즌 누적 ÷ 경기 수 / pct: KBL 계산 성공률(%) 그대로 */
  kind: "perGame" | "pct";
  /** high: 클수록 1위 / low: 작을수록 1위 (턴오버) */
  better: "high" | "low";
  /** 성공률 순위의 시도 기준 — 경기당 시도 수가 min 이상인 선수만 순위 집단에 넣는다 */
  attempts?: { field: "fga" | "tpa" | "fta"; minPerGame: number; name: string };
}

/**
 * 카드 9개 스탯. 배열 순서 = 격자 순서.
 * - 턴오버(tov)는 적을수록 좋으므로 오름차순 순위(가장 적은 선수가 1위).
 *   주의: 경기당 값이라 출전시간이 적은 선수가 유리하다 — 표본 기준으로 최소 출전은 거른다.
 * - 성공률 시도 기준(우리 규칙, KBL 공식 규정 아님): 야투 경기당 4회, 3점 경기당 1.5회, 자유투 경기당 1회 이상.
 *   2025-26 기본 표본(142명) 기준 각각 약 53명·90명·62명이 순위 집단이 된다.
 *   참고: NBA는 시즌 성공 수(야투 300·3점 82·자유투 125개)로 자격을 정한다 — 여기선 시즌 길이가 달라도 같은 잣대가 되도록 경기당 시도 수로.
 */
export const CARD_STATS: readonly CardStatDef[] = [
  { key: "points", label: "득점", kind: "perGame", better: "high" },
  { key: "reb", label: "리바운드", kind: "perGame", better: "high" },
  { key: "ast", label: "어시스트", kind: "perGame", better: "high" },
  { key: "stl", label: "스틸", kind: "perGame", better: "high" },
  { key: "blk", label: "블록", kind: "perGame", better: "high" },
  { key: "tov", label: "턴오버", kind: "perGame", better: "low" },
  { key: "fgPct", label: "야투율", kind: "pct", better: "high", attempts: { field: "fga", minPerGame: 4, name: "야투" } },
  { key: "tpPct", label: "3점 성공률", kind: "pct", better: "high", attempts: { field: "tpa", minPerGame: 1.5, name: "3점" } },
  { key: "ftPct", label: "자유투 성공률", kind: "pct", better: "high", attempts: { field: "fta", minPerGame: 1, name: "자유투" } },
];

/** 성공률 시도 기준 짧은 표기, 예: "경기당 야투 4·3점 1.5·자유투 1회" (카드 하단 기준 줄) */
export function attemptsNote(defs: readonly CardStatDef[] = CARD_STATS): string {
  const parts = defs.filter((d) => d.attempts).map((d) => `${d.attempts!.name} ${d.attempts!.minPerGame}`);
  return parts.length ? `경기당 ${parts.join("·")}회` : "";
}

/** 카드 스탯 계산에 필요한 최소 필드 (lib/types.ts CardPlayer 의 부분집합) */
export interface CardStatInput {
  games: number;
  minutes: number;
  points: number; reb: number; ast: number; stl: number; blk: number; tov: number; // 시즌 누적
  fgPct: number; tpPct: number; ftPct: number; // KBL 계산값 (0~100)
  fga: number; tpa: number; fta: number;       // 시즌 누적 시도
}

/** 카드에 보이는 값: 누적 스탯은 perGame(누적, 경기), 성공률은 그대로 */
export function cardStatValue(p: CardStatInput, def: CardStatDef): number {
  return def.kind === "perGame" ? perGame(p[def.key], p.games) : p[def.key];
}

/** 성공률 시도 기준 충족 여부 (시도 기준이 없는 스탯은 항상 true) */
export function meetsAttempts(p: CardStatInput, def: CardStatDef): boolean {
  if (!def.attempts) return true;
  return p.games > 0 && p[def.attempts.field] / p.games >= def.attempts.minPerGame;
}

/**
 * 경쟁 순위(standard competition ranking): 1 + (나보다 "확실히" 나은 값의 개수).
 * 동점은 같은 순위, 다음 순위는 건너뛴다 → 값 30, 25, 25, 20 이면 1, 2, 2, 4.
 * better="low" 면 작은 값이 낫다(턴오버). pool 에 NaN 등 숫자가 아닌 값은 무시한다.
 * lib/leaders.ts rankMap 과 같은 규칙(1, 2, 2, 4)이다.
 */
export function competitionRank(value: number, pool: readonly number[], better: "high" | "low"): number {
  let ahead = 0;
  for (const v of pool) {
    if (!Number.isFinite(v)) continue;
    if (better === "high" ? v > value : v < value) ahead++;
  }
  return ahead + 1;
}

/** 스탯별 순위 집단 값 배열 */
export type CardStatPools = Record<CardStatKey, number[]>;

/** 표본 기준(+ 성공률은 시도 기준)을 충족한 선수들의 스탯별 값 배열 */
export function buildCardStatPools(players: readonly CardStatInput[], rule: QualifyRule): CardStatPools {
  const qualified = players.filter((p) => isQualified(p, rule));
  const out = {} as CardStatPools;
  for (const def of CARD_STATS) {
    out[def.key] = qualified.filter((p) => meetsAttempts(p, def)).map((p) => cardStatValue(p, def));
  }
  return out;
}

/**
 * 한 스탯의 순위 결과.
 * - rank: 순위 (1부터), of: 순위 집단 크기
 * - rank=null, reason="sample": 표본 기준 미달 → 화면은 "표본 미달"
 * - rank=null, reason="attempts": 표본은 되지만 성공률 시도 기준 미달 → 화면은 "시도 부족"
 */
export type CardStatRank =
  | { rank: number; of: number; reason: null }
  | { rank: null; of: number; reason: "sample" | "attempts" };

export interface CardStatEntry {
  def: CardStatDef;
  value: number;
  rank: CardStatRank;
}

/** 한 선수의 카드 9개 스탯 값 + 시즌 순위. pools 는 같은 rule 로 만든 buildCardStatPools() 결과 */
export function cardStats(p: CardStatInput, pools: CardStatPools, rule: QualifyRule): CardStatEntry[] {
  const qualified = isQualified(p, rule);
  return CARD_STATS.map((def) => {
    const value = cardStatValue(p, def);
    const pool = pools[def.key];
    let rank: CardStatRank;
    if (!qualified) rank = { rank: null, of: pool.length, reason: "sample" };
    else if (!meetsAttempts(p, def)) rank = { rank: null, of: pool.length, reason: "attempts" };
    else rank = { rank: competitionRank(value, pool, def.better), of: pool.length, reason: null };
    return { def, value, rank };
  });
}

/** 순위 강조 단계: 1~3위 메달, 4~10위 강조, 그 밖은 없음 */
export type RankTier = "gold" | "silver" | "bronze" | "top10" | null;

export function rankTier(rank: number | null): RankTier {
  if (rank === null) return null;
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  if (rank <= 10) return "top10";
  return null;
}
