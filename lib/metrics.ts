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
 * 표본 기준 프리셋 (첫 번째가 기본값). 레이더 카드의 백분위 비교 집단과 순위표의 표본 필터가
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
