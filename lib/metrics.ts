// 파생 지표 계산 — 순수 함수만 둔다 (CLAUDE.md 원칙 5).
// 화면 컴포넌트는 여기 함수를 부르기만 하고, 직접 계산하지 않는다.
// 2차 스탯(TS%, eFG%, TOV%, AST/TO, PER)은 KBL이 계산한 값을 그대로 쓰고(USG%만 표준 척도로 ×5 — usgFromKbl),
// PIE 는 쓰지 않는다(2026-09-30 결정: 팬이 읽기 어렵고 2025-26에만 있음 — processed 에는 원값 보존).
// 여기서는 "그 값이 비교 집단 안에서 몇 번째쯤인가"(백분위), 경기당·40분당 환산, 시즌 커버리지 판정,
// 레이더 5축(공격·수비·3점·허슬·효율 — 구성 요소 백분위 평균), 국적 집단별 등급, 유형 라벨, 카드 스탯 순위를 만든다.

import type { Nationality, SeasonCoverage } from "./types";
import { PLAYER_TYPES, playerTypeDef, TYPE_ALLROUNDER_MIN, TYPE_ROLE_MAX, type PlayerTypeKey } from "./glossary";

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


/**
 * "낮을수록 좋은" 값의 백분위 (0~100) = 100 − percentileRank. 파울·TOV% 처럼 적은 쪽이 상위인 항목에 쓴다.
 * mid-rank 규칙이 그대로 뒤집힌다: (나보다 큰 값의 개수 + 0.5 × 같은 값의 개수) / N × 100.
 */
export function percentileRankLow(value: number, reference: readonly number[]): number | null {
  const p = percentileRank(value, reference);
  return p === null ? null : 100 - p;
}

// ─────────────────────────────────────────────
// USG% 척도 보정
// ─────────────────────────────────────────────

/**
 * KBL USG% → 표준 척도 배수. KBL usgRt 는 Basketball-Reference 표준식
 *   USG% = 100 × ((FGA + 0.44×FTA + TOV) × (팀 출전시간 / 5)) / (출전시간 × (팀 FGA + 0.44×팀 FTA + 팀 TOV))
 * 의 정확히 1/5 로 확인됐다 (2026-09-30, 2025-26 정규시즌 500분 이상 선수 전원 표준식/KBL 비율 4.95~5.06 —
 * "팀 출전시간 / 5" 항이 빠진 것으로 추정). 출처: https://www.basketball-reference.com/about/glossary.html
 */
export const USG_KBL_SCALE = 5;

/** KBL USG% 원값 → 표준 척도 (× 5). scripts/process.ts 가 processed usgPct 에 저장할 때 쓴다 (원값은 usgPctRaw) */
export function usgFromKbl(raw: number): number {
  return Number.isFinite(raw) ? raw * USG_KBL_SCALE : 0;
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
    // PIE 는 판정에서 뺐다(화면에서 쓰지 않음). 실제 데이터에서는 PIE 도 같은 시즌에만 채워져 결과는 같다
    advanced: flag("usgPct", "astPct", "rebPct"),
    plusMinus: flag("plusMinus"),
    goodDef: flag("goodDef"),
    hustle: flag("screenAst", "deflections"),
  };
}

// ─────────────────────────────────────────────
// 레이더 5축: 공격 · 수비 · 3점 · 허슬 · 효율 (2026-09-30 등급 체계 2차, PLAN.md §8)
// ─────────────────────────────────────────────
// 축 하나 = 관련 스탯 여러 개(구성 요소)의 **백분위 평균**. 볼륨(40분당)과 효율(성공률·지수)을 함께 넣는다.
//   1) 구성 요소 백분위: 같은 시즌·같은 국적 집단(gradeGroupOf)·표본 기준 충족 선수 안에서 percentileRank.
//      낮을수록 좋은 항목(40분당 파울·TOV%)은 percentileRankLow(반전).
//   2) 축 원점수 = 그 선수에게 쓸 수 있는 구성 요소 백분위의 단순 평균(가중치 모두 1).
//      - 시즌에 기록이 없는 항목은 뺀다(activeRadarComponents: coverage 플래그 + KBL 계산값은 0 아닌 비율 50%).
//      - 성공률(2점%·3점%)은 그 선수의 경기당 시도가 리그 평균 이상일 때만 넣는다(아니면 그 선수만 그 항목 제외).
//      - 남은 구성 요소가 0개면 축은 null → 화면 "-".
//   3) 축 백분위(레이더 값·축 등급) = 축 원점수를 같은 집단 표본 충족 선수들의 축 원점수에 대어 다시 percentileRank.
//      왜 한 번 더: 백분위 여러 개를 평균하면 값이 50 근처로 모여(상위 10%라도 평균은 70대) S~F 경계(90/75/…)가
//      "집단 안 위치"라는 뜻을 잃는다. 다시 순위를 매기면 S = 그 집단 상위 10% 가 그대로 지켜진다.
//   4) 종합 = 5축 백분위 평균(null 축 제외)을 같은 방식으로 집단 안에서 다시 percentileRank → 종합 등급.
// 가중치: 전부 1(단순 평균). 근거 — 팬이 "무엇이 몇 %"로 바로 이해할 수 있고, 어느 항목을 더 무겁게 볼지에 대한
// 합의된 기준이 없다. 스틸은 수비·허슬 두 축에 모두 들어간다(사용자 제안 그대로 — 둘 다의 대표 기록이라서).
// 40분당 환산은 per40, 경기당 +/- 는 perGame.

export const RADAR_AXES = ["offense", "defense", "three", "hustle", "efficiency"] as const;
export type RadarAxis = (typeof RADAR_AXES)[number];

/** 축 이름 (레이더 꼭짓점·표·용어집) */
export const RADAR_AXIS_LABELS: Record<RadarAxis, string> = {
  offense: "공격",
  defense: "수비",
  three: "3점",
  hustle: "허슬",
  efficiency: "효율",
};

export type RadarComponentKey =
  | "pts40" | "ast40" | "usgPct" | "twoPPct"
  | "stl40" | "blk40" | "dreb40" | "gd40" | "fouls40"
  | "tpm40" | "tpPct" | "tpa40"
  | "oreb40" | "defl40" | "screen40" | "pmPerGame"
  | "tsPct" | "efgPct" | "tovPct" | "astTo" | "per";

export interface RadarComponentDef {
  key: RadarComponentKey;
  /** 화면 표기, 예: "40분당 득점" */
  label: string;
  /** high: 클수록 상위 / low: 작을수록 상위(백분위 반전) */
  better: "high" | "low";
  /** 이 시즌 커버리지 플래그가 true 여야 쓰는 항목 (USG%: advanced, 굿디펜스: goodDef, 허슬: hustle, +/-: plusMinus) */
  requires?: keyof SeasonCoverage;
  /** KBL 계산값(없으면 0으로 온다) → 표본 충족 선수 절반 이상이 0 이면 그 시즌엔 뺀다 (coverageFlag) */
  kblComputed?: boolean;
  /** 성공률: 경기당 시도(twoPa·tpa)가 리그 평균(radarAttemptThresholds) 이상인 선수만 */
  attempt?: "twoPa" | "tpa";
}

/** 구성 요소 정의 (한 요소가 두 축에 들어갈 수 있다 — 40분당 스틸) */
export const RADAR_COMPONENTS: Record<RadarComponentKey, RadarComponentDef> = {
  pts40: { key: "pts40", label: "40분당 득점", better: "high" },
  ast40: { key: "ast40", label: "40분당 어시스트", better: "high" },
  usgPct: { key: "usgPct", label: "USG%", better: "high", requires: "advanced", kblComputed: true },
  twoPPct: { key: "twoPPct", label: "2점 성공률", better: "high", attempt: "twoPa" },
  stl40: { key: "stl40", label: "40분당 스틸", better: "high" },
  blk40: { key: "blk40", label: "40분당 블록", better: "high" },
  dreb40: { key: "dreb40", label: "40분당 수비 리바운드", better: "high" },
  gd40: { key: "gd40", label: "40분당 굿디펜스", better: "high", requires: "goodDef" },
  fouls40: { key: "fouls40", label: "40분당 파울", better: "low" },
  tpm40: { key: "tpm40", label: "40분당 3점 성공", better: "high" },
  tpPct: { key: "tpPct", label: "3점 성공률", better: "high", attempt: "tpa" },
  tpa40: { key: "tpa40", label: "40분당 3점 시도", better: "high" },
  oreb40: { key: "oreb40", label: "40분당 공격 리바운드", better: "high" },
  defl40: { key: "defl40", label: "40분당 디플렉션", better: "high", requires: "hustle" },
  screen40: { key: "screen40", label: "40분당 스크린 어시스트", better: "high", requires: "hustle" },
  pmPerGame: { key: "pmPerGame", label: "경기당 +/-", better: "high", requires: "plusMinus" },
  tsPct: { key: "tsPct", label: "TS%", better: "high", kblComputed: true },
  efgPct: { key: "efgPct", label: "eFG%", better: "high", kblComputed: true },
  tovPct: { key: "tovPct", label: "TOV%", better: "low", kblComputed: true },
  astTo: { key: "astTo", label: "AST/TO", better: "high", kblComputed: true },
  per: { key: "per", label: "PER", better: "high", kblComputed: true },
};

/** 축별 구성 요소 (배열 순서 = 설명·표 순서) */
export const RADAR_AXIS_COMPONENTS: Record<RadarAxis, readonly RadarComponentKey[]> = {
  offense: ["pts40", "ast40", "usgPct", "twoPPct"],
  defense: ["stl40", "blk40", "dreb40", "gd40", "fouls40"],
  three: ["tpm40", "tpPct", "tpa40"],
  hustle: ["oreb40", "stl40", "defl40", "screen40", "pmPerGame"],
  efficiency: ["tsPct", "efgPct", "tovPct", "astTo", "per"],
};

const ALL_COMPONENTS = Object.keys(RADAR_COMPONENTS) as RadarComponentKey[];

/** 레이더 계산에 필요한 선수 필드 (lib/types CardPlayer 의 부분집합, 누적은 시즌 합계) */
export interface RadarInput {
  games: number;
  minutes: number;        // 시즌 누적 (분)
  points: number; ast: number; stl: number; blk: number; fouls: number;
  oreb: number; dreb: number;
  tpm: number; tpa: number; twoPa: number;
  goodDef: number; deflections: number; screenAst: number; plusMinus: number;
  twoPPct: number; tpPct: number;              // KBL 계산 성공률 (0~100)
  usgPct: number; tsPct: number; efgPct: number; tovPct: number; astTo: number; per: number;
}

/** 한 선수의 구성 요소 값 (40분당 환산·경기당 +/- 는 여기서, 나머지는 KBL 값 그대로) */
export function componentValue(p: RadarInput, key: RadarComponentKey): number {
  switch (key) {
    case "pts40": return per40(p.points, p.minutes);
    case "ast40": return per40(p.ast, p.minutes);
    case "stl40": return per40(p.stl, p.minutes);
    case "blk40": return per40(p.blk, p.minutes);
    case "dreb40": return per40(p.dreb, p.minutes);
    case "gd40": return per40(p.goodDef, p.minutes);
    case "fouls40": return per40(p.fouls, p.minutes);
    case "tpm40": return per40(p.tpm, p.minutes);
    case "tpa40": return per40(p.tpa, p.minutes);
    case "oreb40": return per40(p.oreb, p.minutes);
    case "defl40": return per40(p.deflections, p.minutes);
    case "screen40": return per40(p.screenAst, p.minutes);
    case "pmPerGame": return perGame(p.plusMinus, p.games);
    default: return p[key];
  }
}

/** 레이더 성공률 항목의 시도 기준: 표본 충족 선수의 경기당 2점·3점 시도 평균 (attemptThresholds 와 같은 방식) */
export interface RadarThresholds {
  twoPa: number;
  tpa: number;
}

export function radarAttemptThresholds(players: readonly RadarInput[], rule: QualifyRule): RadarThresholds {
  const q = players.filter((p) => isQualified(p, rule) && p.games > 0);
  const mean = (f: "twoPa" | "tpa") => (q.length ? q.reduce((s, p) => s + p[f] / p.games, 0) / q.length : 0);
  return { twoPa: mean("twoPa"), tpa: mean("tpa") };
}

/** 이 선수에게 이 구성 요소를 쓸 수 있나 (성공률은 시도 기준) */
function componentEligible(p: RadarInput, def: RadarComponentDef, t: RadarThresholds): boolean {
  if (!def.attempt) return true;
  return p.games > 0 && p[def.attempt] / p.games >= t[def.attempt];
}

/**
 * 시즌에 기록이 있는 구성 요소. requires 플래그가 false 면 빼고, KBL 계산값(kblComputed)은
 * 표본 충족 선수 중 0 아닌 비율이 50% 미만이면 뺀다(coverageFlag — KBL 은 기록이 없으면 0 을 준다).
 * 리그 전체 선수로 한 번 정한다(국적 집단마다 달라지지 않게).
 */
export function activeRadarComponents(
  players: readonly RadarInput[],
  rule: QualifyRule,
  coverage: SeasonCoverage,
): RadarComponentKey[] {
  const q = players.filter((p) => isQualified(p, rule));
  return ALL_COMPONENTS.filter((k) => {
    const def = RADAR_COMPONENTS[k];
    if (def.requires && !coverage[def.requires]) return false;
    if (def.kblComputed && !coverageFlag(q.map((p) => componentValue(p, k)))) return false;
    return true;
  });
}

// ─────────────────────────────────────────────
// 등급 비교 집단 = 국적 집단 (국내 / 외국 / 아시아쿼터)
// ─────────────────────────────────────────────
// 외국 선수가 공격 볼륨(득점·USG%)을 독점해 리그 전체로 등급을 매기면 국내·아시아쿼터 선수는 잘해야 A~B 였다
// (2025-26 실측: 국내 표본 충족 109명 중 최고 등급 B). → 등급(백분위)은 같은 국적 집단 안에서 매긴다.
// 순위("n위/총원")는 지금처럼 리그 전체(또는 같은 포지션)다 — 등급과 순위는 다른 질문에 답한다.
// 국적은 lib/roster nationalityOf 와 같은 규칙: 선수 마스터 값, 없으면 isForeign(이름 추정)으로 국내/외국 2집단.

/**
 * 아시아쿼터 집단 최소 인원 (표본 충족 선수 기준). 이보다 적으면 외국 집단과 합쳐 계산한다.
 * 이유: 몇 명뿐인 집단에서는 한 명이 곧 상위 10~20% 라 등급이 의미 없이 튄다(3명이면 1위가 S, 2위가 B).
 * 8명이면 한 칸이 약 12%p 로 S(상위 10%)·A(25%) 경계를 겨우 구분할 수 있는 최소 크기다.
 * 2025-26 아시아쿼터 표본 충족은 10명 → 따로, 도입 초기 시즌(2020-21~)은 몇 명뿐이라 합산.
 */
export const MIN_GRADE_GROUP = 8;

export type GradeGroupKey = "domestic" | "foreign" | "asia" | "foreignAsia";

/** 등급 기준 표기에 쓰는 집단 이름 */
export const GRADE_GROUP_LABELS: Record<GradeGroupKey, string> = {
  domestic: "국내 선수",
  foreign: "외국 선수",
  asia: "아시아쿼터 선수",
  foreignAsia: "아시아쿼터·외국 합산",
};

export interface GradeInput extends RadarInput {
  nationality: Nationality | null;
  isForeign: boolean;
}

/** 선수 국적 → 집단 (lib/roster nationalityOf 와 같은 규칙. 순환 import 를 피하려고 여기 한 줄로 둔다) */
function nationalityKey(p: { nationality: Nationality | null; isForeign: boolean }): Nationality {
  return p.nationality ?? (p.isForeign ? "foreign" : "domestic");
}

/** 등급 집단: mergeAsia 면 아시아쿼터·외국을 한 집단으로 */
export function gradeGroupOf(p: { nationality: Nationality | null; isForeign: boolean }, mergeAsia: boolean): GradeGroupKey {
  const n = nationalityKey(p);
  if (n === "domestic") return "domestic";
  return mergeAsia ? "foreignAsia" : n;
}

/**
 * 아시아쿼터를 외국과 합칠지: 그 시즌에 아시아쿼터 선수가 있고, 그중 표본 충족이 MIN_GRADE_GROUP 명 미만이면 합친다.
 * 아시아쿼터가 아예 없는 시즌(도입 전, 선수 마스터 없는 시즌)은 합치지 않는다 → 외국 선수는 그냥 "외국 선수" 집단.
 */
export function shouldMergeAsia(players: readonly GradeInput[], rule: QualifyRule): boolean {
  const asia = players.filter((p) => nationalityKey(p) === "asia");
  return asia.length > 0 && asia.filter((p) => isQualified(p, rule)).length < MIN_GRADE_GROUP;
}

/** 한 국적 집단의 비교 재료 */
export interface GradeGroupRef {
  key: GradeGroupKey;
  /** 집단의 표본 충족 선수 수 */
  count: number;
  /** 구성 요소별 값 배열 (표본 충족 + 성공률은 시도 기준 충족) */
  comp: Partial<Record<RadarComponentKey, number[]>>;
  /** 축별 원점수 배열 (표본 충족 선수, null 제외) */
  axisRaw: Record<RadarAxis, number[]>;
}

/** 한 시즌·한 표본 기준의 등급 재료 (리그 전체 선수로 만든다 — 카드 순위 범위와 관계없다) */
export interface GradingContext {
  rule: QualifyRule;
  active: RadarComponentKey[];
  thresholds: RadarThresholds;
  mergeAsia: boolean;
  /** USG% 를 쓸 수 있는 시즌인가 (coverage.advanced) */
  advanced: boolean;
  groups: Partial<Record<GradeGroupKey, GradeGroupRef>>;
}

/** 구성 요소 하나의 결과 (pct=null 이면 이 선수에겐 빠진 항목) */
export interface RadarComponentScore {
  key: RadarComponentKey;
  value: number;
  pct: number | null;
}

export interface RadarScore {
  /** 축 백분위 (레이더 값·축 등급) — 집단 안에서 축 원점수를 다시 순위 매긴 값 */
  axes: Record<RadarAxis, number | null>;
  /** 축 원점수 = 구성 요소 백분위 평균 */
  raw: Record<RadarAxis, number | null>;
  /** 축별 구성 요소 (활성 요소만, 순서 = RADAR_AXIS_COMPONENTS) */
  components: Record<RadarAxis, RadarComponentScore[]>;
  /**
   * 종합 점수 (종합 등급) = 5축 백분위(axes)의 단순 평균 — 다시 순위 매기지 않는다 (overallScore).
   * 0~100 척도라 종합 전용 컷(OVERALL_GRADE_CUTS)을 그대로 대면 S 는 "5축 평균 85 이상" = 여러 축이 동시에 높은 선수만 받는다.
   */
  overall: number | null;
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
const emptyAxes = <T>(f: () => T) => Object.fromEntries(RADAR_AXES.map((a) => [a, f()])) as Record<RadarAxis, T>;

/** 구성 요소 백분위 → 축 원점수 (집단 재료 comp 기준) */
function axisRawScores(
  p: RadarInput,
  g: Pick<GradeGroupRef, "comp">,
  ctx: Pick<GradingContext, "active" | "thresholds">,
): { raw: Record<RadarAxis, number | null>; components: Record<RadarAxis, RadarComponentScore[]> } {
  const raw = emptyAxes<number | null>(() => null);
  const components = emptyAxes<RadarComponentScore[]>(() => []);
  for (const axis of RADAR_AXES) {
    const vals: number[] = [];
    for (const key of RADAR_AXIS_COMPONENTS[axis]) {
      if (!ctx.active.includes(key)) continue;
      const def = RADAR_COMPONENTS[key];
      const value = componentValue(p, key);
      let pct: number | null = null;
      if (componentEligible(p, def, ctx.thresholds)) {
        const ref = g.comp[key] ?? [];
        pct = def.better === "low" ? percentileRankLow(value, ref) : percentileRank(value, ref);
      }
      components[axis].push({ key, value, pct });
      if (pct !== null) vals.push(pct);
    }
    raw[axis] = mean(vals);
  }
  return { raw, components };
}

/** 축 원점수 → 축 백분위(집단 안에서 다시 순위) */
function axisPercentiles(raw: Record<RadarAxis, number | null>, g: Pick<GradeGroupRef, "axisRaw">) {
  const axes = emptyAxes<number | null>(() => null);
  for (const a of RADAR_AXES) axes[a] = raw[a] === null ? null : percentileRank(raw[a]!, g.axisRaw[a]);
  return axes;
}

/**
 * 종합 점수 = 5축 백분위의 단순 평균 (null 축은 빼고, 전부 null 이면 null). 가중치 없이 5축을 같은 비중으로 본다.
 * 종합 등급 = 이 값에 종합 전용 컷(OVERALL_GRADE_CUTS 85/70/55/40/25)을 **직접** 댄다 — 집단 안에서 다시 순위 매기지 않는다.
 * (2026-09-30 피드백 3차: 다시 순위를 매기면 "평균이 집단 상위 10%"만 되면 S 라, 한 축만 뛰어나도 S 가 나왔다 —
 *  예: 강성욱 2025-26 축 S·A·D·A·A → 재순위 종합 S. 평균에 컷을 직접 대면 S 는 5축 평균이 컷 이상 = 여러 축이 동시에 높아야 한다.
 *  처음엔 축 컷 90 을 그대로 댔더니 2025-26 종합 S 가 0명이라 종합 전용 컷 85/70/55/40/25 로 내렸다.)
 * 축 등급은 그대로 "구성 요소 백분위 평균 → 집단 안 재순위" (백분위 몇 개의 평균은 50 근처로 모이기 때문).
 */
export function overallScore(axes: Partial<Record<RadarAxis, number | null>>): number | null {
  return mean(RADAR_AXES.map((a) => axes[a]).filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v)));
}

/**
 * 시즌 등급 재료. players = 그 시즌 **리그 전체** 선수. 국적 집단마다 구성 요소·축·종합 원점수 배열을 만든다.
 */
export function buildGradingContext(
  players: readonly GradeInput[],
  rule: QualifyRule,
  coverage: SeasonCoverage,
): GradingContext {
  const active = activeRadarComponents(players, rule, coverage);
  const thresholds = radarAttemptThresholds(players, rule);
  const mergeAsia = shouldMergeAsia(players, rule);
  const groups: GradingContext["groups"] = {};
  const byGroup = new Map<GradeGroupKey, GradeInput[]>();
  for (const p of players) {
    if (!isQualified(p, rule)) continue;
    const k = gradeGroupOf(p, mergeAsia);
    byGroup.set(k, [...(byGroup.get(k) ?? []), p]);
  }
  for (const [key, members] of byGroup) {
    const comp: GradeGroupRef["comp"] = {};
    for (const k of active) {
      const def = RADAR_COMPONENTS[k];
      comp[k] = members.filter((p) => componentEligible(p, def, thresholds)).map((p) => componentValue(p, k));
    }
    const raws = members.map((p) => axisRawScores(p, { comp }, { active, thresholds }).raw);
    const axisRaw = emptyAxes<number[]>(() => []);
    for (const r of raws) for (const a of RADAR_AXES) if (r[a] !== null) axisRaw[a].push(r[a]!);
    groups[key] = { key, count: members.length, comp, axisRaw };
  }
  return { rule, active, thresholds, mergeAsia, advanced: coverage.advanced, groups };
}

/** 한 선수의 레이더·종합 점수 (그 선수 국적 집단 기준). 표본 미달 선수도 집단에 대어 계산한다 */
export function radarScore(p: GradeInput, ctx: GradingContext): RadarScore {
  const g = ctx.groups[gradeGroupOf(p, ctx.mergeAsia)];
  const empty: GradeGroupRef = { key: "domestic", count: 0, comp: {}, axisRaw: emptyAxes<number[]>(() => []) };
  const ref = g ?? empty;
  const { raw, components } = axisRawScores(p, ref, ctx);
  const axes = axisPercentiles(raw, ref);
  return { axes, raw, components, overall: overallScore(axes) };
}

/** 시즌에 기록이 없어 빠진 구성 요소 이름 (카드 아래 안내, 예: ["USG%", "40분당 디플렉션"]) */
export function missingComponentLabels(ctx: Pick<GradingContext, "active">): string[] {
  return ALL_COMPONENTS.filter((k) => !ctx.active.includes(k)).map((k) => RADAR_COMPONENTS[k].label);
}

// ─────────────────────────────────────────────
// 선수 유형 라벨 (재미용, 단순 규칙)
// ─────────────────────────────────────────────

export interface PlayerType {
  /** 유형 키 (lib/glossary PLAYER_TYPES) — 용어 탭 앵커 /glossary#type-{key} */
  key: PlayerTypeKey;
  label: string;
  /** 라벨을 정한 근거 축 (올라운더·롤플레이어면 null) */
  axis: RadarAxis | null;
}

/** 유형 키 → PlayerType (라벨은 lib/glossary PLAYER_TYPES 한 곳에서 읽는다) */
function typeOf(key: PlayerTypeKey): PlayerType {
  const d = playerTypeDef(key);
  return { key, label: d.label, axis: d.axis };
}

/**
 * 5축 백분위 → 한 줄 유형 라벨. 규칙 (위에서부터 먼저 맞는 것, 라벨·문턱값은 lib/glossary PLAYER_TYPES·TYPE_*):
 *  1) 5개 축이 모두 TYPE_ALLROUNDER_MIN(60) 이상 → "올라운더"      (고르게 상위권)
 *  2) 가장 높은 축이 TYPE_ROLE_MAX(40) 미만      → "궂은일 담당 롤 플레이어" (어느 축도 두드러지지 않음)
 *  3) 그 외: 가장 높은 축의 유형                  → 공격 "득점원" · 수비 "수비수" · 3점 "슈터" · 허슬 "허슬 플레이어" · 효율 "효율형"
 *     동점이면 축 순서(공격 → 수비 → 3점 → 허슬 → 효율)로 먼저 나온 축.
 * null 축은 무시(올라운더 판정에서는 5축이 모두 있어야 한다). 전부 null이면 "분석 불가".
 */
export function playerType(pct: Partial<Record<RadarAxis, number | null>>): PlayerType {
  const entries = RADAR_AXES.map((a) => [a, pct[a] ?? null] as const).filter(
    (e): e is readonly [RadarAxis, number] => e[1] !== null,
  );
  if (entries.length === 0) return typeOf("unknown");
  if (entries.length === RADAR_AXES.length && entries.every(([, v]) => v >= TYPE_ALLROUNDER_MIN)) return typeOf("allRounder");
  let top = entries[0];
  for (const e of entries) if (e[1] > top[1]) top = e;
  if (top[1] < TYPE_ROLE_MAX) return typeOf("role");
  const def = PLAYER_TYPES.find((t) => t.axis === top[0])!;
  return typeOf(def.key);
}

// ─────────────────────────────────────────────
// 플레이어 카드 메인 스탯 10개 + 시즌 순위
// ─────────────────────────────────────────────
// 카드 중단 3×3 격자: 득점·리바운드·어시스트 / 스틸·블록·턴오버 / 야투율·3점 성공률·자유투 성공률 + 파울(순위 없음).
// 누적 스탯은 경기당(perGame), 성공률은 KBL 계산값(0~100) 그대로.
// 순위 비교 집단 = 현재 표본 기준(QUALIFY_PRESETS 중 선택된 것)을 충족한 선수.
// 성공률은 여기에 "경기당 시도 수" 기준을 더한다 — 표본 기준만으로는 1/1(100%) 같은 선수가 1위가 되기 때문.
// 시도 기준은 시즌마다 데이터에서 계산한다(attemptThresholds). 플레이어 카드와 순위표(lib/leaders.ts)가 같은 함수를 쓴다.

export type CardStatKey = "points" | "reb" | "ast" | "stl" | "blk" | "tov" | "fgPct" | "tpPct" | "ftPct" | "fouls";

/** 성공률 지표 → 시도 필드 (야투율 = 야투 시도, 3점 성공률 = 3점 시도, 자유투 성공률 = 자유투 시도) */
export type PctKey = "fgPct" | "tpPct" | "ftPct";
export type AttemptField = "fga" | "tpa" | "fta";
export const PCT_ATTEMPTS: Record<PctKey, { field: AttemptField; name: string }> = {
  fgPct: { field: "fga", name: "야투" },
  tpPct: { field: "tpa", name: "3점" },
  ftPct: { field: "fta", name: "자유투" },
};
export const isPctKey = (k: string): k is PctKey => k in PCT_ATTEMPTS;

/** 시도 기준: 시도 필드별 경기당 최소 시도 수 */
export type AttemptThresholds = Record<AttemptField, number>;

/** 시도 기준 계산에 필요한 최소 필드 */
export interface AttemptInput {
  games: number;
  minutes: number;
  fga: number; tpa: number; fta: number; // 시즌 누적 시도
}

/**
 * 성공률 순위의 시도 기준 = "그 시즌 표본 기준(rule) 충족 선수의 경기당 시도 수 리그 평균".
 *   threshold[field] = mean( 선수별 누적 시도 ÷ 출전 경기 )   (표본 충족 선수만)
 * - 선수별 경기당 값의 단순 평균이다(총 시도 ÷ 총 경기가 아님) → "보통 선수만큼은 던진 선수"라는 뜻.
 * - 시즌 길이·시대(3점 시도가 적던 옛 시즌 등)가 달라도 그 시즌 안에서 같은 잣대가 된다. 숫자를 박지 않는다.
 * - 우리 규칙이며 KBL 공식 규정이 아니다. (참고: NBA는 시즌 성공 수로 자격을 정한다 — 야투 300·3점 82·자유투 125개)
 * - 표본 충족 선수가 없으면 0 (= 시도 기준 없음).
 */
export function attemptThresholds(players: readonly AttemptInput[], rule: QualifyRule): AttemptThresholds {
  const q = players.filter((p) => isQualified(p, rule) && p.games > 0);
  const mean = (f: AttemptField) => (q.length ? q.reduce((s, p) => s + p[f] / p.games, 0) / q.length : 0);
  return { fga: mean("fga"), tpa: mean("tpa"), fta: mean("fta") };
}

/** 성공률 시도 기준 충족 여부: 경기당 시도 ≥ 기준 (0경기면 false) */
export function meetsAttemptThreshold(p: AttemptInput, key: PctKey, t: AttemptThresholds): boolean {
  const field = PCT_ATTEMPTS[key].field;
  return p.games > 0 && p[field] / p.games >= t[field];
}

const NF_ATT = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 시도 기준 짧은 표기, 예: "야투 7.1·3점 2.6·자유투 2.0" (카드 하단·순위표 안내문) */
export function attemptsNote(t: AttemptThresholds): string {
  return (Object.keys(PCT_ATTEMPTS) as PctKey[])
    .map((k) => `${PCT_ATTEMPTS[k].name} ${NF_ATT.format(t[PCT_ATTEMPTS[k].field])}`)
    .join("·");
}

export interface CardStatDef {
  key: CardStatKey;
  label: string;
  /** perGame: 시즌 누적 ÷ 경기 수 / pct: KBL 계산 성공률(%) 그대로 */
  kind: "perGame" | "pct";
  /** high: 클수록 1위 / low: 작을수록 1위 (턴오버) */
  better: "high" | "low";
  /**
   * 시즌 순위를 매기는가. false 면 값만 보여 주고 순위 집단도 만들지 않는다(rank.reason = "unranked").
   * 파울: 많을수록 나쁘다고도 좋다고도 할 수 없어(수비 적극성·출전시간 영향) 순위를 매기지 않는다.
   */
  ranked: boolean;
}

/**
 * 카드 스탯 10개. 배열 순서 = 격자 순서 (앞 9개가 3×3, 파울은 마지막).
 * - 턴오버(tov)는 적을수록 좋으므로 오름차순 순위(가장 적은 선수가 1위).
 *   주의: 경기당 값이라 출전시간이 적은 선수가 유리하다 — 표본 기준으로 최소 출전은 거른다.
 * - 성공률(kind "pct")은 attemptThresholds 기준 충족 선수만 순위 집단에 넣는다.
 * - 파울(fouls)은 경기당 값만, 순위 없음(ranked: false).
 */
export const CARD_STATS: readonly CardStatDef[] = [
  { key: "points", label: "득점", kind: "perGame", better: "high", ranked: true },
  { key: "reb", label: "리바운드", kind: "perGame", better: "high", ranked: true },
  { key: "ast", label: "어시스트", kind: "perGame", better: "high", ranked: true },
  { key: "stl", label: "스틸", kind: "perGame", better: "high", ranked: true },
  { key: "blk", label: "블록", kind: "perGame", better: "high", ranked: true },
  { key: "tov", label: "턴오버", kind: "perGame", better: "low", ranked: true },
  { key: "fgPct", label: "야투율", kind: "pct", better: "high", ranked: true },
  { key: "tpPct", label: "3점 성공률", kind: "pct", better: "high", ranked: true },
  { key: "ftPct", label: "자유투 성공률", kind: "pct", better: "high", ranked: true },
  { key: "fouls", label: "파울", kind: "perGame", better: "low", ranked: false },
];

/** 카드 스탯 계산에 필요한 최소 필드 (lib/types.ts CardPlayer 의 부분집합) */
export interface CardStatInput extends AttemptInput {
  points: number; reb: number; ast: number; stl: number; blk: number; tov: number; fouls: number; // 시즌 누적
  fgPct: number; tpPct: number; ftPct: number; // KBL 계산값 (0~100)
}

/** 카드에 보이는 값: 누적 스탯은 perGame(누적, 경기), 성공률은 그대로 */
export function cardStatValue(p: CardStatInput, def: CardStatDef): number {
  return def.kind === "perGame" ? perGame(p[def.key], p.games) : p[def.key];
}

/** 성공률 시도 기준 충족 여부 (성공률이 아닌 스탯은 항상 true) */
export function meetsAttempts(p: CardStatInput, def: CardStatDef, t: AttemptThresholds): boolean {
  return !isPctKey(def.key) || meetsAttemptThreshold(p, def.key, t);
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

/**
 * 표본 기준(+ 성공률은 시도 기준 t)을 충족한 선수들의 스탯별 값 배열. t 는 같은 rule 로 만든 attemptThresholds().
 * 순위 없는 스탯(ranked: false)은 빈 배열.
 */
export function buildCardStatPools(
  players: readonly CardStatInput[],
  rule: QualifyRule,
  t: AttemptThresholds,
): CardStatPools {
  const qualified = players.filter((p) => isQualified(p, rule));
  const out = {} as CardStatPools;
  for (const def of CARD_STATS) {
    out[def.key] = def.ranked ? qualified.filter((p) => meetsAttempts(p, def, t)).map((p) => cardStatValue(p, def)) : [];
  }
  return out;
}

/**
 * 한 스탯의 순위 결과.
 * - rank: 순위 (1부터), of: 순위 집단 크기
 * - rank=null, reason="sample": 표본 기준 미달 → 화면은 "표본 미달"
 * - rank=null, reason="attempts": 표본은 되지만 성공률 시도 기준 미달 → 화면은 "시도 부족"
 * - rank=null, reason="unranked": 순위를 매기지 않는 스탯(파울) → 화면은 순위 자리를 비운다 (of 는 0)
 */
export type CardStatRank =
  | { rank: number; of: number; reason: null }
  | { rank: null; of: number; reason: "sample" | "attempts" | "unranked" };

export interface CardStatEntry {
  def: CardStatDef;
  value: number;
  rank: CardStatRank;
}

/** 한 선수의 카드 스탯 값 + 시즌 순위. pools·t 는 같은 rule 로 만든 buildCardStatPools()·attemptThresholds() 결과 */
export function cardStats(
  p: CardStatInput,
  pools: CardStatPools,
  rule: QualifyRule,
  t: AttemptThresholds,
): CardStatEntry[] {
  const qualified = isQualified(p, rule);
  return CARD_STATS.map((def) => {
    const value = cardStatValue(p, def);
    const pool = pools[def.key];
    let rank: CardStatRank;
    if (!def.ranked) rank = { rank: null, of: 0, reason: "unranked" };
    else if (!qualified) rank = { rank: null, of: pool.length, reason: "sample" };
    else if (!meetsAttempts(p, def, t)) rank = { rank: null, of: pool.length, reason: "attempts" };
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

// ─────────────────────────────────────────────
// 등급 (S~F) — 백분위를 팬이 읽기 쉬운 글자로
// ─────────────────────────────────────────────

export type Grade = "S" | "A" | "B" | "C" | "D" | "F";

/**
 * 등급 경계 (백분위 이상이면 그 등급). 위에서부터 먼저 맞는 것.
 * 근거: 상위 10% / 25% / 45% / 65% / 85% 컷 — S는 시즌 최상위 10%, A는 상위 4분의 1,
 * B·C는 중간(45~65%)을 기준으로 위아래, D는 하위권, F는 하위 15%.
 * 게임 카드처럼 S가 희소하고, 평균 선수(백분위 50)가 B와 C 사이에 오도록 잡았다.
 */
export const GRADE_CUTS: readonly (readonly [Grade, number])[] = [
  ["S", 90],
  ["A", 75],
  ["B", 55],
  ["C", 35],
  ["D", 15],
  ["F", -Infinity],
];

/**
 * 종합 등급 전용 컷 (5축 백분위 평균 = overallScore 에 직접 댄다). 축 등급 컷(GRADE_CUTS)보다 한 단계 낮다.
 * 이유(2026-09-30 피드백): 5축 평균은 여러 축이 동시에 높아야 올라가서, 축 컷 90 을 그대로 대면 2025-26 종합 S 가 0명이었다
 * (5축 평균 최고 이정현 86.7). 85 로 낮춰도 S 는 "다섯 축 평균 85 이상" = 여러 축이 모두 상위권인 선수뿐이다.
 */
export const OVERALL_GRADE_CUTS: readonly (readonly [Grade, number])[] = [
  ["S", 85],
  ["A", 70],
  ["B", 55],
  ["C", 40],
  ["D", 25],
  ["F", -Infinity],
];

function gradeByCuts(pct: number | null | undefined, cuts: readonly (readonly [Grade, number])[]): Grade | "-" {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return "-";
  for (const [g, cut] of cuts) if (pct >= cut) return g;
  return "F";
}

/** 백분위(0~100) → 축 등급 (GRADE_CUTS). null·NaN → "-" */
export function percentileGrade(pct: number | null | undefined): Grade | "-" {
  return gradeByCuts(pct, GRADE_CUTS);
}

/** 종합 점수(5축 평균) → 종합 등급 (OVERALL_GRADE_CUTS) */
export function overallGrade(score: number | null | undefined): Grade | "-" {
  return gradeByCuts(score, OVERALL_GRADE_CUTS);
}

// ─────────────────────────────────────────────
// 기본 선수 고르기
// ─────────────────────────────────────────────

/**
 * 카드 첫 화면에 띄울 선수 id: 기본 표본 기준 충족 선수 중 PER(전 시즌에 있는 종합 생산성 지수) 1위.
 * 충족 선수가 없으면 전체 중 1위. 목록이 비면 null. (팀을 고른 경우 그 팀 선수 목록을 넘긴다)
 */
export function pickDefaultPlayer<T extends { id: string; games: number; minutes: number; per: number }>(
  players: readonly T[],
): string | null {
  if (players.length === 0) return null;
  const pool = players.filter((p) => isQualified(p, DEFAULT_QUALIFY));
  const list = pool.length ? pool : players;
  return list.reduce((best, p) => (p.per > best.per ? p : best), list[0]).id;
}

// ─────────────────────────────────────────────
// 플레이어 카드 한 장의 계산 묶음 — 선수 상세·선수 탭·비교 탭이 같이 쓴다 (lib/cardview)
// ─────────────────────────────────────────────

/** 카드 계산에 필요한 선수 필드 (레이더 + 메인 스탯 + 국적) */
export type CardInput = GradeInput & CardStatInput;

/** 한 시즌·한 표본 기준의 비교 재료: 순위(스탯 순위 집단·성공률 시도 기준)와 등급(국적 집단) */
export interface CardContext {
  rule: QualifyRule;
  thresholds: AttemptThresholds;
  pools: CardStatPools;
  /** 순위 집단 중 표본 기준 충족 선수 수 */
  qualifiedCount: number;
  /** 등급 재료 — 순위 범위(전체/같은 포지션)와 관계없이 리그 전체 선수의 국적 집단 */
  grading: GradingContext;
}

/**
 * 카드 비교 재료. players 가 곧 **순위** 집단이다 — 포지션으로 좁히려면 lib/roster filterByPosition 결과를 넘긴다.
 * 등급은 opts.grading(리그 전체로 만든 buildGradingContext)을 쓴다. 없으면 players 와 coverage 로 만든다.
 * opts.thresholds: 성공률 시도 기준을 따로 줄 때 (집단을 좁혀도 리그 전체 값 유지). 없으면 players 로 계산.
 */
export function buildCardContext(
  players: readonly CardInput[],
  rule: QualifyRule,
  coverage: SeasonCoverage,
  opts: { thresholds?: AttemptThresholds; grading?: GradingContext } = {},
): CardContext {
  const thresholds = opts.thresholds ?? attemptThresholds(players, rule);
  return {
    rule,
    thresholds,
    pools: buildCardStatPools(players, rule, thresholds),
    qualifiedCount: players.filter((p) => isQualified(p, rule)).length,
    grading: opts.grading ?? buildGradingContext(players, rule, coverage),
  };
}

/** 등급 기준 집단 정보 (카드의 "등급 기준: 국내 선수 109명 중") */
export interface GradeGroupInfo {
  key: GradeGroupKey;
  label: string;
  /** 집단의 표본 충족 선수 수 */
  count: number;
}

/** 카드 한 장에 그리는 값 (player 는 화면이 쓰는 선수 객체 그대로) */
export interface CardEntryOf<T> {
  player: T;
  /** 5축 백분위 (국적 집단 안) */
  pct: Record<RadarAxis, number | null>;
  /** 축별 등급 (percentileGrade) */
  grades: Record<RadarAxis, Grade | "-">;
  /** 종합 등급 (5축 백분위 평균 → overallGrade = OVERALL_GRADE_CUTS 85/70/55/40/25, 재순위 없음) */
  overall: Grade | "-";
  /** 종합 점수 = 5축 백분위 평균 (0~100) */
  overallPct: number | null;
  /** 축별 구성 요소 값·백분위 (툴팁·표 보기) */
  radar: RadarScore;
  type: PlayerType;
  qualified: boolean;
  /** 메인 스탯 (CARD_STATS 순서, 파울 포함 10개) + 시즌 순위 */
  stats: CardStatEntry[];
  gradeGroup: GradeGroupInfo;
  /** USG% (표준 척도). 그 시즌에 USG% 가 없으면(coverage.advanced 아님) null */
  usgPct: number | null;
}

/** 한 선수의 카드 값: 백분위·등급·유형·표본 충족·메인 스탯 순위. ctx 는 같은 시즌 선수로 만든 buildCardContext() */
export function buildCardEntry<T extends CardInput>(p: T, ctx: CardContext): CardEntryOf<T> {
  const radar = radarScore(p, ctx.grading);
  const grades = emptyAxes<Grade | "-">(() => "-");
  for (const a of RADAR_AXES) grades[a] = percentileGrade(radar.axes[a]);
  const gk = gradeGroupOf(p, ctx.grading.mergeAsia);
  return {
    player: p,
    pct: radar.axes,
    grades,
    overall: overallGrade(radar.overall),
    overallPct: radar.overall,
    radar,
    type: playerType(radar.axes),
    qualified: isQualified(p, ctx.rule),
    stats: cardStats(p, ctx.pools, ctx.rule, ctx.thresholds),
    gradeGroup: { key: gk, label: GRADE_GROUP_LABELS[gk], count: ctx.grading.groups[gk]?.count ?? 0 },
    usgPct: ctx.grading.advanced && Number.isFinite(p.usgPct) ? p.usgPct : null,
  };
}

// ─────────────────────────────────────────────
// 통산 (선수 페이지 머리말)
// ─────────────────────────────────────────────

export interface CareerSummary {
  seasons: number;
  games: number;
  /** 통산 경기당 = 전 시즌 합계 ÷ 전 시즌 경기 합계 (시즌별 경기당 값의 평균이 아니다) */
  points: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  /** 통산 야투율 = 전 시즌 야투 성공 합계 ÷ 시도 합계 × 100. 시도 0이면 null */
  fgPct: number | null;
  /** 통산 3점 성공률 = 전 시즌 3점 성공 합계 ÷ 시도 합계 × 100. 시도 0이면 null */
  tpPct: number | null;
}

/** 통산 요약 입력 (시즌 합계 — 순위표 행 LeaderPlayer·CareerSeason 과 같은 필드) */
export interface CareerSummaryInput {
  games: number;
  points: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
}

/** 성공 합계 ÷ 시도 합계 × 100 (시도 0이면 null) */
export function madePct(made: number, att: number): number | null {
  return att > 0 ? (made / att) * 100 : null;
}

/**
 * 통산 요약. 경기당 값은 "합계 ÷ 합계 경기"(perGame)로 계산한다 —
 * 시즌 평균들의 평균을 내면 몇 경기 안 뛴 시즌이 한 시즌 전체와 같은 비중이 되어 값이 왜곡된다.
 * (Basketball-Reference 통산 Per Game 과 같은 방식)
 * 성공률도 같은 이유로 시즌 성공률의 평균이 아니라 "성공 합계 ÷ 시도 합계"(Basketball-Reference 통산 FG% 와 같음).
 */
export function careerSummary(seasons: readonly CareerSummaryInput[]): CareerSummary {
  const sum = (k: keyof CareerSummaryInput) => seasons.reduce((s, x) => s + (Number.isFinite(x[k]) ? x[k] : 0), 0);
  const games = sum("games");
  return {
    seasons: seasons.length,
    games,
    points: perGame(sum("points"), games),
    reb: perGame(sum("reb"), games),
    ast: perGame(sum("ast"), games),
    stl: perGame(sum("stl"), games),
    blk: perGame(sum("blk"), games),
    fgPct: madePct(sum("fgm"), sum("fga")),
    tpPct: madePct(sum("tpm"), sum("tpa")),
  };
}
