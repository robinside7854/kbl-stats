// 파생 지표 계산 — 순수 함수만 둔다 (CLAUDE.md 원칙 5).
// 화면 컴포넌트는 여기 함수를 부르기만 하고, 직접 계산하지 않는다.
// 2차 스탯(TS%, eFG%, TOV%, AST/TO, PER)은 KBL이 계산한 값을 그대로 쓰고(USG%만 표준 척도로 ×5 — usgFromKbl),
// PIE 는 쓰지 않는다(2026-09-30 결정: 팬이 읽기 어렵고 2025-26에만 있음 — processed 에는 원값 보존).
// 여기서는 "그 값이 비교 집단 안에서 몇 번째쯤인가"(백분위), 경기당·30분당 환산, 시즌 커버리지 판정,
// 레이더 6축(공격·수비·리바운드·슈팅·리딩·효율 — 구성 요소 백분위 평균), 국적 집단별 등급(종합은 포지션별 가중), 유형 라벨, 카드 스탯 순위를 만든다.

import type { Nationality, Position, SeasonCoverage } from "./types";
import {
  PLAYER_TYPES,
  playerTypeDef,
  TYPE_ALLROUNDER_MIN,
  TYPE_ROLE_MAX,
  TYPE_HANDLER_AST_MIN,
  TYPE_PLAYMAKER_AST_MIN,
  TYPE_SPOTUP_AST_MAX,
  type PlayerTypeKey,
} from "./glossary";

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
/**
 * 진행 중 시즌의 기본 기준 = 기준 없음(출전 선수 전원). 2026-10-03 사용자: 개막 직후엔 아무도 10경기를 못 채워
 * 리더보드·홈이 비었다 → 진행 중 시즌은 기준 없이, 마감된 시즌만 기본 기준(DEFAULT_QUALIFY).
 * 시즌이 쌓이면 출전이 적은 선수가 경기당 순위 위로 올 수 있다 — 그때는 순위표 "표본 기준" 고급 필터로 거른다.
 */
export const NO_QUALIFY: QualifyRule = { minGames: 0, minMinutes: 0 };
const isNoQualify = (r: QualifyRule) => r.minGames <= 0 && r.minMinutes <= 0;
/** 프리셋 긴 표기, 예: "10경기·100분 이상" (기준 없음 = "출전 선수 전원") */
export const qualifyLabel = (r: QualifyRule) => (isNoQualify(r) ? "출전 선수 전원" : `${r.minGames}경기·${r.minMinutes}분 이상`);
/** 모바일 선택 상자용 짧은 표기, 예: "10경기·100분+" */
export const qualifyShort = (r: QualifyRule) => (isNoQualify(r) ? "전원" : `${r.minGames}경기·${r.minMinutes}분+`);

/** 진행 중 시즌 = 선수가 있는 가장 최근 시즌이고 아직 우승팀(챔프전 4승)이 없다 */
export function isOngoingSeason(seasonCode: number, latestWithPlayers: number | null, champion: unknown): boolean {
  return seasonCode === latestWithPlayers && !champion;
}
/** 시즌의 기본 표본 기준: 진행 중이면 기준 없음, 마감이면 DEFAULT_QUALIFY */
export const seasonDefaultQualify = (ongoing: boolean): QualifyRule => (ongoing ? NO_QUALIFY : DEFAULT_QUALIFY);
/** 순위표 표본 기준 목록 (첫 번째가 기본값). 진행 중 시즌은 맨 앞에 "출전 선수 전원" */
export const qualifyPresetsFor = (ongoing: boolean): readonly QualifyRule[] =>
  ongoing ? [NO_QUALIFY, ...QUALIFY_PRESETS] : QUALIFY_PRESETS;

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
// KBL 이 주지 않은 시즌의 USG%·AST%·REB%(OREB%·DREB%) 직접 계산 (2026-10-01 사용자 요청: "공식이 있으면 전 시즌 계산")
// ─────────────────────────────────────────────
// KBL 2차 스탯 중 USG%·AST%·REB% 는 2025-26 에만 있다(2023-24·2024-25 는 선수 약 11%만). 세 지표는 Basketball-Reference
// 표준식이라 선수 시즌 합계 + 팀 합계로 다시 만들 수 있다. 출처: https://www.basketball-reference.com/about/glossary.html
//   USG%  = 100 × (FGA + 0.44×FTA + TOV) × (팀 출전/5) ÷ (출전 × (팀 FGA + 0.44×팀 FTA + 팀 TOV))
//   AST%  = 100 × AST ÷ ((출전 ÷ (팀 출전/5)) × 팀 FGM − FGM)
//   REB%  = 100 × REB × (팀 출전/5) ÷ (출전 × (팀 REB + 상대 REB))      (OREB% 는 팀 OREB + 상대 DREB, DREB% 는 팀 DREB + 상대 OREB)
// 팀 합계 = 그 시즌 그 팀 선수 기록의 합(KBL 팀 기록은 수집하지 않음). 상대 합계는 경기별 기록이 없어 **균형 일정 근사**:
//   상대 X ≈ (리그 X 합 − 팀 X) ÷ (리그 출전 합 − 팀 출전) × 팀 출전 — KBL 정규시즌은 모든 팀과 같은 횟수로 붙는다.
// 검산(2025-26, 300분 이상 111명, KBL 값과 비교): |차이| 중앙값 USG 0.14 · AST 0.33 · REB 0.13 · OREB 0.12 · DREB 0.27, 최대 3.05(AST).
// 한계: 시즌 중 이적한 선수는 KBL 기록에 시즌 전체가 한 팀으로 묶여 그 두 팀 합계가 조금 틀어진다.

export interface TeamShareInput {
  teamCode: string;
  minutes: number;
  fga: number;
  fgm: number;
  fta: number;
  tov: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
}

export interface TeamShareStats {
  usgPct: number;
  astPct: number;
  rebPct: number;
  orebPct: number;
  drebPct: number;
}

type TeamSum = { min: number; fga: number; fgm: number; fta: number; tov: number; oreb: number; dreb: number; reb: number };

/** 선수 시즌 합계 → 표준식 USG%·AST%·REB%·OREB%·DREB% (입력 순서대로). 출전 0분·분모 0 이하면 0 */
export function computeTeamShareStats(players: readonly TeamShareInput[]): TeamShareStats[] {
  const keys = ["fga", "fgm", "fta", "tov", "oreb", "dreb", "reb"] as const;
  const teams = new Map<string, TeamSum>();
  const league: TeamSum = { min: 0, fga: 0, fgm: 0, fta: 0, tov: 0, oreb: 0, dreb: 0, reb: 0 };
  for (const p of players) {
    const t = teams.get(p.teamCode) ?? { min: 0, fga: 0, fgm: 0, fta: 0, tov: 0, oreb: 0, dreb: 0, reb: 0 };
    t.min += p.minutes;
    league.min += p.minutes;
    for (const k of keys) {
      t[k] += p[k];
      league[k] += p[k];
    }
    teams.set(p.teamCode, t);
  }
  /** 균형 일정 근사: 이 팀이 만난 상대의 X 합 */
  const opp = (t: TeamSum, k: "oreb" | "dreb" | "reb") => {
    const otherMin = league.min - t.min;
    return otherMin > 0 ? ((league[k] - t[k]) / otherMin) * t.min : 0;
  };
  const pct = (num: number, den: number) => (den > 0 && Number.isFinite(num / den) ? (100 * num) / den : 0);
  return players.map((p) => {
    const t = teams.get(p.teamCode)!;
    if (p.minutes <= 0 || t.min <= 0) return { usgPct: 0, astPct: 0, rebPct: 0, orebPct: 0, drebPct: 0 };
    const share = t.min / 5;
    return {
      usgPct: pct((p.fga + 0.44 * p.fta + p.tov) * share, p.minutes * (t.fga + 0.44 * t.fta + t.tov)),
      astPct: pct(p.ast, (p.minutes / share) * t.fgm - p.fgm),
      rebPct: pct(p.reb * share, p.minutes * (t.reb + opp(t, "reb"))),
      orebPct: pct(p.oreb * share, p.minutes * (t.oreb + opp(t, "dreb"))),
      drebPct: pct(p.dreb * share, p.minutes * (t.dreb + opp(t, "oreb"))),
    };
  });
}

// ─────────────────────────────────────────────
// 경기당 환산
// ─────────────────────────────────────────────

/** 시즌 누적값 ÷ 출전 경기 수. 경기 0이면 0. */
export function perGame(total: number, games: number): number {
  return games > 0 ? total / games : 0;
}

/**
 * 30분당 환산 = 시즌 누적값 ÷ 누적 출전시간(분) × 30. 출전 0분이면 0.
 * 기준 시간: NBA 의 per-36 은 48분 경기(12분 × 4쿼터) 중 3쿼터(36분)를 뛰었다는 가정이다.
 * KBL 은 10분 × 4쿼터 = 40분 경기라 같은 "3쿼터를 뛴 주전"의 가정은 30분이다 (2026-10-01 사용자 결정 —
 * 처음엔 풀타임 40분으로 했으나, NBA per-36 의 뜻(3쿼터)에 맞춰 30분으로 바꿨다).
 * 출처: Basketball-Reference "Per 36 Minutes" 정의를 KBL 쿼터 길이(10분)에 맞춘 것.
 * 주의: 출전시간이 아주 적은 선수는 값이 튄다 → 순위는 표본 기준(isQualified)으로 거른다.
 */
export const PER_MINUTES_BASE = 30;

export function per30(total: number, minutes: number): number {
  return minutes > 0 ? (total / minutes) * PER_MINUTES_BASE : 0;
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
// 레이더 6축: 공격 · 수비 · 리바운드 · 슈팅 · 리딩 · 효율 (2026-10-01 피드백 7차 — 5축(공격·수비·3점·허슬·효율)에서 개편)
// ─────────────────────────────────────────────
// 축 하나 = 관련 스탯 여러 개(구성 요소)의 **백분위 평균**. 볼륨(경기당 실제 기록)과 효율(성공률·지수)을 함께 넣는다.
// 볼륨은 **경기당**(시즌 합계 ÷ 경기 수)이다 (2026-09-30 피드백 5차, PLAN.md §13). 처음엔 40분당 환산을 썼으나
// 출전 10분 안팎인 선수의 40분당 값이 4배로 부풀어 벤치 선수가 공격·허슬 A~S 를 받았다 — 팬이 보는 "실제 경기당 기록"과
// 등급이 어긋났다. 경기당이면 출전 시간이 곧 역할이라 주전·많이 뛰는 선수가 볼륨 축에서 앞선다(의도).
//   1) 구성 요소 백분위: 같은 시즌·같은 국적 집단(gradeGroupOf)·표본 기준 충족 선수 안에서 percentileRank.
//      낮을수록 좋은 항목(TOV%)은 percentileRankLow(반전).
//   2) 축 원점수 = 그 선수에게 쓸 수 있는 구성 요소 백분위의 단순 평균(가중치 모두 1).
//      - 시즌에 기록이 없는 항목은 뺀다(activeRadarComponents: coverage 플래그 + KBL 계산값은 0 아닌 비율 50%).
//      - 성공률(3점%·미드레인지%·자유투%)은 그 선수의 경기당 시도가 리그 평균 이상일 때만 넣는다(아니면 그 선수만 그 항목 제외).
//      - 남은 구성 요소가 0개면 축은 null → 화면 "-".
//   3) 축 백분위(레이더 값·축 등급) = 축 원점수를 같은 집단 표본 충족 선수들의 축 원점수에 대어 다시 percentileRank.
//      왜 한 번 더: 백분위 여러 개를 평균하면 값이 50 근처로 모여(상위 10%라도 평균은 70대) S~F 경계(90/75/…)가
//      "집단 안 위치"라는 뜻을 잃는다. 다시 순위를 매기면 S = 그 집단 상위 10% 가 그대로 지켜진다.
//   4) 종합 = 6축 백분위의 **포지션별 가중** 평균(axisWeights, overallScore)을 같은 집단 안에서 **다시 백분위**로 바꾸고(overallPercentile)
//      종합 컷(OVERALL_GRADE_CUTS — S 상위 5%)을 댄다. 2026-10-01 사용자 결정: "매 시즌 S 는 몇 명만".
// 축 구성(2026-10-01 사용자 정의):
//   공격   — 순수 득점: 경기당 득점·야투 성공·야투 시도·자유투 시도 + USG%(있는 시즌만). 어시스트는 리딩으로 옮김
//   수비   — 경기당 스틸·블록·굿디펜스(2000-01~)·디플렉션(2025-26~). 파울은 뺌(수비 적극성의 대가라 감점이 애매)
//   리바운드 — 경기당 공격·수비 리바운드 + REB%(2025-26~). 박스아웃은 KBL 이 기록하지 않아 없음
//   슈팅   — 골밑을 뺀 슛 감각: 경기당 3점 성공·3점 시도·3점 성공률 + 경기당 미드레인지 시도·미드레인지 성공률(슛 차트 있는 2006-07~, lib/shots 구역) + 자유투 성공률(2026-10-01 추가)
//   리딩   — 경기당 어시스트·AST/TO·TOV%(반전) + AST%(2025-26~). 경기당 턴오버(반전)는 넣었다가 뺐다 — 공을 덜 만지는 벤치 선수가 올라가서(비율인 TOV% 만)
//   효율   — PER·TS%·eFG%
// 가중치: 축 안에서는 전부 1(단순 평균). 근거 — 팬이 "무엇이 몇 %"로 바로 이해할 수 있고, 어느 항목을 더 무겁게 볼지에 대한
// 합의된 기준이 없다. 스틸은 수비 축에만(허슬 축 폐지). +/-·스크린 어시스트·2점 성공률은 어느 축에도 안 들어간다.

export const RADAR_AXES = ["offense", "defense", "rebound", "shooting", "playmaking", "efficiency"] as const;
export type RadarAxis = (typeof RADAR_AXES)[number];

/** 축 이름 (레이더 꼭짓점·표·용어집) */
export const RADAR_AXIS_LABELS: Record<RadarAxis, string> = {
  offense: "공격",
  defense: "수비",
  rebound: "리바운드",
  shooting: "슈팅",
  playmaking: "리딩",
  efficiency: "효율",
};

export type RadarComponentKey =
  | "ptsPerGame" | "fgmPerGame" | "fgaPerGame" | "ftaPerGame" | "usgPct"
  | "stlPerGame" | "blkPerGame" | "gdPerGame" | "deflPerGame"
  | "orebPerGame" | "drebPerGame" | "rebPct"
  | "tpmPerGame" | "tpaPerGame" | "tpPct" | "midAPerGame" | "midPct" | "ftPct"
  | "astPerGame" | "astTo" | "tovPct" | "astPct"
  | "per" | "tsPct" | "efgPct";

export interface RadarComponentDef {
  key: RadarComponentKey;
  /** 화면 표기, 예: "경기당 득점" */
  label: string;
  /** high: 클수록 상위 / low: 작을수록 상위(백분위 반전) */
  better: "high" | "low";
  /** 이 시즌 커버리지 플래그가 true 여야 쓰는 항목 (USG%·REB%·AST%: advanced, 굿디펜스: goodDef, 디플렉션: hustle, 미드레인지: shots) */
  requires?: keyof SeasonCoverage;
  /** KBL 계산값(없으면 0으로 온다) → 표본 충족 선수 절반 이상이 0 이면 그 시즌엔 뺀다 (coverageFlag) */
  kblComputed?: boolean;
  /** 성공률: 경기당 시도(tpa·midA·fta)가 리그 평균(radarAttemptThresholds) 이상인 선수만 */
  attempt?: "tpa" | "midA" | "fta";
}

/** 구성 요소 정의 */
export const RADAR_COMPONENTS: Record<RadarComponentKey, RadarComponentDef> = {
  ptsPerGame: { key: "ptsPerGame", label: "경기당 득점", better: "high" },
  fgmPerGame: { key: "fgmPerGame", label: "경기당 야투 성공", better: "high" },
  fgaPerGame: { key: "fgaPerGame", label: "경기당 야투 시도", better: "high" },
  ftaPerGame: { key: "ftaPerGame", label: "경기당 자유투 시도", better: "high" },
  usgPct: { key: "usgPct", label: "USG%", better: "high", requires: "advanced", kblComputed: true },
  stlPerGame: { key: "stlPerGame", label: "경기당 스틸", better: "high" },
  blkPerGame: { key: "blkPerGame", label: "경기당 블록", better: "high" },
  gdPerGame: { key: "gdPerGame", label: "경기당 굿디펜스", better: "high", requires: "goodDef" },
  deflPerGame: { key: "deflPerGame", label: "경기당 디플렉션", better: "high", requires: "hustle" },
  orebPerGame: { key: "orebPerGame", label: "경기당 공격 리바운드", better: "high" },
  drebPerGame: { key: "drebPerGame", label: "경기당 수비 리바운드", better: "high" },
  rebPct: { key: "rebPct", label: "REB%", better: "high", requires: "advanced", kblComputed: true },
  tpmPerGame: { key: "tpmPerGame", label: "경기당 3점 성공", better: "high" },
  tpaPerGame: { key: "tpaPerGame", label: "경기당 3점 시도", better: "high" },
  tpPct: { key: "tpPct", label: "3점 성공률", better: "high", attempt: "tpa" },
  midAPerGame: { key: "midAPerGame", label: "경기당 미드레인지 시도", better: "high", requires: "shots" },
  midPct: { key: "midPct", label: "미드레인지 성공률", better: "high", requires: "shots", attempt: "midA" },
  ftPct: { key: "ftPct", label: "자유투 성공률", better: "high", attempt: "fta" },
  astPerGame: { key: "astPerGame", label: "경기당 어시스트", better: "high" },
  astTo: { key: "astTo", label: "AST/TO", better: "high", kblComputed: true },
  tovPct: { key: "tovPct", label: "TOV%", better: "low", kblComputed: true },
  astPct: { key: "astPct", label: "AST%", better: "high", requires: "advanced", kblComputed: true },
  per: { key: "per", label: "PER", better: "high", kblComputed: true },
  tsPct: { key: "tsPct", label: "TS%", better: "high", kblComputed: true },
  efgPct: { key: "efgPct", label: "eFG%", better: "high", kblComputed: true },
};

/** 축별 구성 요소 (배열 순서 = 설명·표 순서) */
export const RADAR_AXIS_COMPONENTS: Record<RadarAxis, readonly RadarComponentKey[]> = {
  offense: ["ptsPerGame", "fgmPerGame", "fgaPerGame", "ftaPerGame", "usgPct"],
  defense: ["stlPerGame", "blkPerGame", "gdPerGame", "deflPerGame"],
  rebound: ["orebPerGame", "drebPerGame", "rebPct"],
  shooting: ["tpmPerGame", "tpaPerGame", "tpPct", "midAPerGame", "midPct", "ftPct"],
  playmaking: ["astPerGame", "astTo", "tovPct", "astPct"],
  efficiency: ["per", "tsPct", "efgPct"],
};

const ALL_COMPONENTS = Object.keys(RADAR_COMPONENTS) as RadarComponentKey[];

/** 레이더 계산에 필요한 선수 필드 (lib/types CardPlayer 의 부분집합, 누적은 시즌 합계) */
export interface RadarInput {
  games: number;
  minutes: number;        // 시즌 누적 (분)
  points: number; ast: number; stl: number; blk: number; tov: number;
  fgm: number; fga: number; fta: number;
  oreb: number; dreb: number;
  tpm: number; tpa: number;
  goodDef: number; deflections: number;
  /** 미드레인지 슛 시도·성공 (슛 차트 구역, coverage.shots 시즌만. 없으면 0) */
  midA: number; midM: number;
  tpPct: number; ftPct: number;                   // KBL 계산 성공률 (0~100)
  usgPct: number; rebPct: number; astPct: number; // 2차 스탯 (coverage.advanced 시즌만 의미)
  tsPct: number; efgPct: number; tovPct: number; astTo: number; per: number;
}

/** 한 선수의 구성 요소 값 (누적 기록은 경기당 = 시즌 합계 ÷ 경기 수, 나머지는 KBL 값 그대로. 미드레인지 성공률은 우리 계산) */
export function componentValue(p: RadarInput, key: RadarComponentKey): number {
  switch (key) {
    case "ptsPerGame": return perGame(p.points, p.games);
    case "fgmPerGame": return perGame(p.fgm, p.games);
    case "fgaPerGame": return perGame(p.fga, p.games);
    case "ftaPerGame": return perGame(p.fta, p.games);
    case "stlPerGame": return perGame(p.stl, p.games);
    case "blkPerGame": return perGame(p.blk, p.games);
    case "gdPerGame": return perGame(p.goodDef, p.games);
    case "deflPerGame": return perGame(p.deflections, p.games);
    case "orebPerGame": return perGame(p.oreb, p.games);
    case "drebPerGame": return perGame(p.dreb, p.games);
    case "tpmPerGame": return perGame(p.tpm, p.games);
    case "tpaPerGame": return perGame(p.tpa, p.games);
    case "midAPerGame": return perGame(p.midA, p.games);
    case "midPct": return p.midA > 0 ? (p.midM / p.midA) * 100 : 0;
    case "astPerGame": return perGame(p.ast, p.games);
    default: return p[key];
  }
}

/** 레이더 성공률 항목의 시도 기준: 표본 충족 선수의 경기당 3점·미드레인지·자유투 시도 평균 (attemptThresholds 와 같은 방식) */
export interface RadarThresholds {
  tpa: number;
  midA: number;
  fta: number;
}

export function radarAttemptThresholds(players: readonly RadarInput[], rule: QualifyRule): RadarThresholds {
  const q = players.filter((p) => isQualified(p, rule) && p.games > 0);
  const mean = (f: "tpa" | "midA" | "fta") => (q.length ? q.reduce((s, p) => s + p[f] / p.games, 0) / q.length : 0);
  return { tpa: mean("tpa"), midA: mean("midA"), fta: mean("fta") };
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
    if (def.requires && !coverage[def.requires]) return false; // shots 는 옛 파일에 없음(undefined) → 뺀다
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
// 집단은 국내 / 외국인(외국+아시아쿼터) 둘뿐이다(2026-10-01 사용자 결정 — 아시아쿼터도 외국인 풀).

/**
 * (2026-10-01 피드백 8차) 등급 집단은 **국내 / 외국인(외국+아시아쿼터) 두 풀**로 고정한다 — 사용자 결정:
 * 국내 선수와 용병을 한 풀에서 비교하는 것은 무리이고, 아시아쿼터는 외국인 풀에 넣는다.
 * 전엔 아시아쿼터가 표본 충족 8명(MIN_GRADE_GROUP) 이상이면 따로 집단을 만들었다 — 상수는 참고용으로 남긴다.
 */
export const MIN_GRADE_GROUP = 8;

export type GradeGroupKey = "domestic" | "foreign" | "asia" | "foreignAsia";

/** 등급 기준 표기에 쓰는 집단 이름 */
export const GRADE_GROUP_LABELS: Record<GradeGroupKey, string> = {
  domestic: "국내 선수",
  foreign: "외국 선수",
  asia: "아시아쿼터 선수",
  foreignAsia: "외국인 선수(아시아쿼터 포함)",
};

export interface GradeInput extends RadarInput {
  nationality: Nationality | null;
  isForeign: boolean;
  /** 포지션 (선수 마스터). 종합 점수·유형 라벨의 축 가중치에 쓴다(axisWeights) — 없으면 가중치 전부 1 */
  position?: Position | null;
  /** 그 시즌 수상 (쉼표로 이은 SeasonAwardKey, 예: "defense5,best5") — 등급 가산점(AWARD_GRADE_BONUS). 없으면 "" */
  awards?: string;
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
 * 아시아쿼터를 외국과 합칠지: 그 시즌에 아시아쿼터 선수가 한 명이라도 있으면 **항상** 합친다(두 풀 고정, 2026-10-01).
 * 아시아쿼터가 아예 없는 시즌(도입 전, 선수 마스터 없는 시즌)은 합칠 대상이 없어 외국 선수는 그냥 "외국 선수" 집단.
 */
export function shouldMergeAsia(players: readonly GradeInput[], _rule: QualifyRule): boolean {
  return players.some((p) => nationalityKey(p) === "asia");
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
  /** 종합 점수(6축 가중 평균, 각자 포지션 가중치) 배열 — 종합 백분위의 비교 대상 (표본 충족 선수, null 제외) */
  overallRaw: number[];
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
   * 종합 백분위 (종합 등급) = 종합 점수(overallAvg)를 같은 집단 표본 충족 선수들의 종합 점수에 대어 다시 매긴 백분위.
   * 99 면 "그 풀 상위 1%". 종합 등급은 이 값에 OVERALL_GRADE_CUTS(S 95 = 상위 5%)를 댄다.
   */
  overall: number | null;
  /** 종합 점수 = 6축 백분위(axes)의 포지션별 가중 평균 (overallScore, axisWeights) + 수상 종합 가산 — 재순위 전 값 */
  overallAvg: number | null;
  /** 수상 가산점 (awardBonusOf). 받은 상이 없으면 null */
  awardBonus: AwardBonus | null;
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
 * 종합 점수 = 6축 백분위의 가중 평균 (null 축은 빼고, 전부 null 이면 null). weights 를 안 주면 6축 같은 비중.
 * 종합 등급은 이 값을 집단 안에서 **다시 백분위**로 바꿔(overallPercentile) 종합 컷(OVERALL_GRADE_CUTS)을 댄다.
 * 변천: 2026-09-30 피드백 3차에 "평균에 컷 직접(85/70/…)"으로 바꿨으나(재순위 + 축 컷 90 이면 S 가 상위 10% 로 많고
 * 한 축만 뛰어난 선수도 S 였다), 2026-10-01 사용자가 "종합도 백분위로, 매 시즌 S 는 몇 명만"을 원해 재순위 + S 상위 5% 로 돌아왔다.
 * 평균 자체가 여러 축이 함께 높아야 올라가므로 상위 5% 는 여전히 다재다능한 선수 쪽이다.
 * 축 등급은 그대로 "구성 요소 백분위 평균 → 집단 안 재순위" (백분위 몇 개의 평균은 50 근처로 모이기 때문).
 * 가중치(axisWeights): 포지션별 역할 묶음(가드·포워드·빅맨)에 맞춰 축 비중을 바꾼다 (아래 ROLE_AXIS_WEIGHTS).
 */
export function overallScore(
  axes: Partial<Record<RadarAxis, number | null>>,
  weights: Readonly<Record<RadarAxis, number>> = EQUAL_AXIS_WEIGHTS,
): number | null {
  let sum = 0;
  let wsum = 0;
  for (const a of RADAR_AXES) {
    const v = axes[a];
    const w = weights[a];
    if (v === null || v === undefined || !Number.isFinite(v) || w <= 0) continue;
    sum += v * w;
    wsum += w;
  }
  return wsum > 0 ? sum / wsum : null;
}

// ─────────────────────────────────────────────
// 포지션별 종합 가중치 (2026-10-01 피드백 7차 — "빅맨은 슈팅·리딩이 낮아도 리바운드·블록이 높으면, 가드는 리바운드가 낮아도 리딩·스틸이 높으면 높게")
// ─────────────────────────────────────────────
// 축 백분위(레이더 모양·축 등급)는 그대로 두고 **종합 점수·유형 라벨 판정**에서만 축 비중을 포지션에 맞춘다 —
// 레이더는 "실제로 어떤 선수인가", 종합은 "제 역할 안에서 얼마나 잘하나".
// 역할 묶음(선수 마스터 포지션 코드): 가드 = G·GF / 포워드 = F / 빅맨 = FC·C. 포지션을 모르면 전부 1.
//   가드   — 리딩 ×1.5, 리바운드 ×0.5 (나머지 1)
//   포워드 — 전부 1 (KBL 포워드 코드엔 윙과 빅맨이 섞여 있어 어느 쪽으로도 기울이지 않는다)
//   빅맨   — 리바운드 ×1.5, 슈팅 ×0.5, 리딩 ×0.5 (나머지 1)
// 블록·스틸은 수비 축 안에 있어 따로 비중을 두지 않는다(빅맨 블록·가드 스틸이 각자 수비 축을 올린다).
// 근거(2025-26 국내 표본 충족 실측, 축 백분위 평균): 리바운드 가드 37 · 빅맨 83, 슈팅 가드 55 · 빅맨 37, 리딩 가드 64 · 빅맨 35 —
// 포지션 때문에 구조적으로 낮은 축이 종합을 끌어내리지 않게 하되, 0 으로 아예 빼지는 않는다(그 축이 뛰어나면 여전히 보탬).

export type RoleGroup = "guard" | "forward" | "big";

/** 포지션 코드 → 역할 묶음 */
export function roleGroupOf(position: Position | null | undefined): RoleGroup | null {
  if (!position) return null;
  if (position === "G" || position === "GF") return "guard";
  if (position === "F") return "forward";
  return "big";
}

export const ROLE_GROUP_LABELS: Record<RoleGroup, string> = { guard: "가드", forward: "포워드", big: "빅맨" };

export const EQUAL_AXIS_WEIGHTS: Readonly<Record<RadarAxis, number>> = {
  offense: 1, defense: 1, rebound: 1, shooting: 1, playmaking: 1, efficiency: 1,
};

/** 역할 묶음별 축 가중치 (적지 않은 축은 1) */
export const ROLE_AXIS_WEIGHTS: Record<RoleGroup, Partial<Record<RadarAxis, number>>> = {
  guard: { playmaking: 1.5, rebound: 0.5 },
  forward: {},
  big: { rebound: 1.5, shooting: 0.5, playmaking: 0.5 },
};

/** 포지션별 축 가중치 (종합 점수·유형 라벨용). 포지션 없으면 6축 모두 1 */
export function axisWeights(position: Position | null | undefined): Readonly<Record<RadarAxis, number>> {
  const role = roleGroupOf(position);
  if (!role) return EQUAL_AXIS_WEIGHTS;
  return { ...EQUAL_AXIS_WEIGHTS, ...ROLE_AXIS_WEIGHTS[role] };
}

/**
 * 종합 가중치 안내 한 줄 (카드 "등급 기준" 옆). 가중치가 전부 1이면 null.
 * 예: "가드라 리딩 ×1.5 · 리바운드 ×0.5", "빅맨이라 리바운드 ×1.5 · 슈팅 ×0.5 · 리딩 ×0.5"
 */
export function overallWeightNote(position: Position | null | undefined): string | null {
  const role = roleGroupOf(position);
  if (!role) return null;
  const parts = RADAR_AXES.filter((a) => ROLE_AXIS_WEIGHTS[role][a] !== undefined && ROLE_AXIS_WEIGHTS[role][a] !== 1).map(
    (a) => `${RADAR_AXIS_LABELS[a]} ×${ROLE_AXIS_WEIGHTS[role][a]}`,
  );
  if (parts.length === 0) return null;
  const who = ROLE_GROUP_LABELS[role];
  return `${who}${role === "big" ? "이라" : "라"} ${parts.join(" · ")}`;
}

// ─────────────────────────────────────────────
// 수상 가산점 (2026-10-02 사용자: "수비 5걸에 선정된 선수는 스탯에 보이지 않는 수비력을 인정받은 것 — 등급에 가산점")
// ─────────────────────────────────────────────
// 재료: 시즌 파일 seasonAwards (공홈 역대수상현황) → 카드 awards. 그 시즌에 받은 상만 그 시즌 등급에 더한다.
//   축 가산(축 백분위에 더함, 99.9 상한): 최우수 수비상 수비 +15 · 수비 5걸 수비 +10 — 기록에 안 잡히는 수비(대인·도움 수비)를 인정
//   종합 가산(종합 점수에 더함, 그 뒤 집단 안 재순위): 정규리그 MVP·외국선수 MVP +10 · 베스트5 +5 · 챔프전 MVP +3
// 신인상·식스맨상·기량 발전상은 "그 집단 안에서" 주는 상이라 가산하지 않는다. 가산은 같은 집단 모든 선수에 똑같이 적용해
// 재순위하므로(buildGradingContext) 상을 받은 선수만 위로 올라가고 기준이 흔들리지 않는다.
// 숫자는 우리 규칙(KBL 공식 아님) — 바꾸려면 여기만 고친다.

export interface AwardBonusRule {
  label: string;
  axis?: { axis: RadarAxis; pts: number };
  overall?: number;
}

export const AWARD_GRADE_BONUS: Readonly<Record<string, AwardBonusRule>> = {
  defensive: { label: "최우수 수비상", axis: { axis: "defense", pts: 15 } },
  defense5: { label: "수비 5걸", axis: { axis: "defense", pts: 10 } },
  mvp: { label: "정규리그 MVP", overall: 10 },
  foreignMvp: { label: "외국선수 MVP", overall: 10 },
  best5: { label: "베스트5", overall: 5 },
  finalsMvp: { label: "챔프전 MVP", overall: 3 },
};

export interface AwardBonus {
  /** 축별 더한 점수 */
  axes: Partial<Record<RadarAxis, number>>;
  /** 종합 점수에 더한 점수 */
  overall: number;
  /** 가산된 상 이름 (화면 안내), 예: ["수비 5걸", "베스트5"] */
  labels: string[];
}

/** 카드 awards 문자열 → 가산점. 가산되는 상이 없으면 null */
export function awardBonusOf(awards: string | null | undefined): AwardBonus | null {
  if (!awards) return null;
  const out: AwardBonus = { axes: {}, overall: 0, labels: [] };
  for (const key of new Set(awards.split(",").map((k) => k.trim()))) {
    const r = AWARD_GRADE_BONUS[key];
    if (!r) continue;
    out.labels.push(r.label);
    if (r.axis) out.axes[r.axis.axis] = (out.axes[r.axis.axis] ?? 0) + r.axis.pts;
    if (r.overall) out.overall += r.overall;
  }
  return out.labels.length ? out : null;
}

/** 축 백분위에 수상 가산 (값이 없는 축은 그대로 null, 상한 99.9) */
function withAxisBonus(axes: Record<RadarAxis, number | null>, b: AwardBonus | null): Record<RadarAxis, number | null> {
  if (!b) return axes;
  const out = { ...axes };
  for (const a of RADAR_AXES) {
    const add = b.axes[a];
    if (add && out[a] !== null) out[a] = Math.min(99.9, out[a]! + add);
  }
  return out;
}

/** 축(가산 후) → 종합 점수 + 종합 가산 */
function overallWithBonus(axes: Record<RadarAxis, number | null>, position: Position | null | undefined, b: AwardBonus | null) {
  const v = overallScore(axes, axisWeights(position));
  return v === null ? null : v + (b?.overall ?? 0);
}

/** 수상 가산 안내 한 줄 (카드), 예: "수비 5걸 수비 +10 · 베스트5 종합 +5". 없으면 null */
export function awardBonusNote(b: AwardBonus | null): string | null {
  if (!b) return null;
  return b.labels
    .map((label) => {
      const r = Object.values(AWARD_GRADE_BONUS).find((x) => x.label === label)!;
      return r.axis ? `${label} ${RADAR_AXIS_LABELS[r.axis.axis]} +${r.axis.pts}` : `${label} 종합 +${r.overall}`;
    })
    .join(" · ");
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
    const overallRaw: number[] = [];
    members.forEach((p, i) => {
      const b = awardBonusOf(p.awards);
      const v = overallWithBonus(withAxisBonus(axisPercentiles(raws[i], { axisRaw }), b), p.position, b);
      if (v !== null) overallRaw.push(v);
    });
    groups[key] = { key, count: members.length, comp, axisRaw, overallRaw };
  }
  return { rule, active, thresholds, mergeAsia, advanced: coverage.advanced, groups };
}

/** 한 선수의 레이더·종합 점수 (그 선수 국적 집단 기준). 표본 미달 선수도 집단에 대어 계산한다 */
export function radarScore(p: GradeInput, ctx: GradingContext): RadarScore {
  const g = ctx.groups[gradeGroupOf(p, ctx.mergeAsia)];
  const empty: GradeGroupRef = { key: "domestic", count: 0, comp: {}, axisRaw: emptyAxes<number[]>(() => []), overallRaw: [] };
  const ref = g ?? empty;
  const { raw, components } = axisRawScores(p, ref, ctx);
  const awardBonus = awardBonusOf(p.awards);
  const axes = withAxisBonus(axisPercentiles(raw, ref), awardBonus);
  const overallAvg = overallWithBonus(axes, p.position, awardBonus);
  return { axes, raw, components, overallAvg, overall: overallPercentile(overallAvg, ref.overallRaw), awardBonus };
}

/** 종합 점수 → 같은 집단 안 백분위 (비교 대상이 없으면 null) */
export function overallPercentile(avg: number | null, groupOverall: readonly number[]): number | null {
  return avg === null || groupOverall.length === 0 ? null : percentileRank(avg, groupOverall);
}

/** 시즌에 기록이 없어 빠진 구성 요소 이름 (카드 아래 안내, 예: ["USG%", "경기당 디플렉션"]) */
export function missingComponentLabels(ctx: Pick<GradingContext, "active">): string[] {
  return ALL_COMPONENTS.filter((k) => !ctx.active.includes(k)).map((k) => RADAR_COMPONENTS[k].label);
}

// ─────────────────────────────────────────────
// 선수 유형 라벨 (재미용, 단순 규칙) — 2026-10-01 피드백 7차: 포지션 세분 유형 추가
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
 * 6축 백분위 → 한 줄 유형 라벨. 규칙 (위에서부터 먼저 맞는 것, 라벨·문턱값은 lib/glossary PLAYER_TYPES·TYPE_*):
 *  1) 세는 축(가중치 > 0)이 모두 TYPE_ALLROUNDER_MIN(60) 이상 → "올라운더"
 *  2) 가장 높은 축이 TYPE_ROLE_MAX(60, 같은 풀 상위 40%) 미만 → "롤플레이어" (리그에선 평범한 축이 "자기 중 가장 높다"는 이유로 라벨이 붙지 않게, 2026-10-01)
 *  3) 가장 높은 축이 리딩인데 경기당 어시스트 백분위 < TYPE_PLAYMAKER_AST_MIN(60) 이면 리딩을 빼고 다음으로 높은 축으로 판정
 *     (턴오버가 적은 것만으로 리딩 축이 높은 선수를 플레이메이커에서 거른다. 다음 축도 40 미만이면 "롤플레이어")
 *     그 축이 슈팅이면 경기당 어시스트 백분위(assistPct)로 나눈다 (2026-10-01 사용자 결정):
 *     ≥ TYPE_HANDLER_AST_MIN(70) → "플레이메이커"(메인 핸들러) · < TYPE_SPOTUP_AST_MAX(40) → "스팟업 슈터" · 그 사이·값 없음 → "슈터"
 *  4) 그 외: 가장 높은 축의 유형 → 공격 "득점원" · 수비 "수비수" · 리바운드 "리바운더" · 리딩 "플레이메이커" · 효율 "피니셔"
 *     (락다운 디펜더는 수비수, 리바운딩 가드는 리바운더, 플레이메이킹 빅맨은 플레이메이커, 스트레치 빅맨은 슈터 쪽으로 합침 — 2026-10-01)
 *     동점이면 축 순서(공격 → 수비 → 리바운드 → 슈팅 → 리딩 → 효율)로 먼저 나온 축.
 * null 축은 무시(올라운더 판정에서는 세는 축이 모두 있어야 한다). 전부 null이면 "분석 불가".
 * weights(axisWeights): 가중치 0 인 축은 아예 세지 않는다(지금 역할 묶음엔 0 이 없지만 규칙으로 둔다).
 */
export function playerType(
  pct: Partial<Record<RadarAxis, number | null>>,
  weights: Readonly<Record<RadarAxis, number>> = EQUAL_AXIS_WEIGHTS,
  position: Position | null | undefined = null,
  assistPct: number | null = null,
): PlayerType {
  const counted = RADAR_AXES.filter((a) => weights[a] > 0);
  const entries = counted.map((a) => [a, pct[a] ?? null] as const).filter(
    (e): e is readonly [RadarAxis, number] => e[1] !== null,
  );
  if (entries.length === 0) return typeOf("unknown");
  if (entries.length === counted.length && entries.every(([, v]) => v >= TYPE_ALLROUNDER_MIN)) return typeOf("allRounder");
  let top = entries[0];
  for (const e of entries) if (e[1] > top[1]) top = e;
  if (top[1] < TYPE_ROLE_MAX) return typeOf("role");
  let topAxis = top[0];
  // 리딩이 가장 높아도 어시스트 자체가 적으면(턴오버가 적어서 리딩 축이 높은 경우) 다음으로 높은 축으로 본다
  if (topAxis === "playmaking" && assistPct !== null && assistPct < TYPE_PLAYMAKER_AST_MIN) {
    let next: readonly [RadarAxis, number] | null = null;
    for (const e of entries) if (e[0] !== "playmaking" && (next === null || e[1] > next[1])) next = e;
    if (next === null || next[1] < TYPE_ROLE_MAX) return typeOf("role");
    topAxis = next[0];
  }
  if (topAxis === "shooting" && assistPct !== null) {
    if (assistPct >= TYPE_HANDLER_AST_MIN) return typeOf("playmaker");
    if (assistPct < TYPE_SPOTUP_AST_MAX) return typeOf("spotUp");
  }
  const def = PLAYER_TYPES.find((t) => t.axis === topAxis)!;
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
 * 종합 등급 컷 (종합 백분위 = 그 풀 안 순위에 댄다, 2026-10-01).
 * S 상위 5% · A 다음 15%(상위 20%) · B 다음 25%(상위 45%) · C 다음 25% · D 다음 20% · F 하위 10%.
 * 축 등급(상위 10% S)보다 S 를 좁혀 "매 시즌 S 는 몇 명" — 2025-26 국내 표본 충족 약 110명이면 S 5~6명, 외국인 풀 약 30명이면 1~2명.
 */
export const OVERALL_GRADE_CUTS: readonly (readonly [Grade, number])[] = [
  ["S", 95],
  ["A", 80],
  ["B", 55],
  ["C", 30],
  ["D", 10],
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

/** 종합 백분위 → 종합 등급 (OVERALL_GRADE_CUTS) */
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
  /** 6축 백분위 (국적 집단 안) */
  pct: Record<RadarAxis, number | null>;
  /** 축별 등급 (percentileGrade) */
  grades: Record<RadarAxis, Grade | "-">;
  /** 종합 등급 (6축 백분위의 포지션별 가중 평균 → 풀 안 백분위 → overallGrade = OVERALL_GRADE_CUTS, S 상위 5%) */
  overall: Grade | "-";
  /** 종합 백분위 (0~100, 풀 안 순위 — 99 면 상위 1%) */
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
    type: playerType(
      radar.axes,
      axisWeights(p.position),
      p.position,
      radar.components.playmaking.find((c) => c.key === "astPerGame")?.pct ?? null,
    ),
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
  /** 통산 승·패 — 본인이 뛴 경기의 팀 결과만 (KBL 선수 기록의 승·패, 결장 경기는 없음) */
  wins: number;
  losses: number;
  /** 통산 승률 = 승 ÷ (승 + 패) × 100. 경기 0이면 null */
  winPct: number | null;
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
  /** 뛴 경기의 팀 승·패 (옛 데이터엔 없을 수 있어 선택) */
  wins?: number;
  losses?: number;
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
  const sum = (k: keyof CareerSummaryInput) => seasons.reduce((s, x) => s + (Number.isFinite(x[k]) ? (x[k] as number) : 0), 0);
  const games = sum("games");
  const wins = sum("wins");
  const losses = sum("losses");
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
    wins,
    losses,
    winPct: winPct(wins, losses),
  };
}

/**
 * 승률 = 승 ÷ (승 + 패) × 100. 승·패는 KBL 선수 기록 그대로 = 그 선수가 뛴 경기의 팀 결과(결장한 경기는 들어가지 않는다).
 * 2026-10-01 확인: 시즌 행 663개 중 639개가 승 + 패 = 경기 수, 24개는 1경기 차(KBL 원본). 경기 0이면 null.
 */
export function winPct(wins: number, losses: number): number | null {
  const g = wins + losses;
  return g > 0 ? (wins / g) * 100 : null;
}

/**
 * 등급 점수 (2026-10-01 사용자 요청 "등급에도 점수, 만점 99"): 백분위를 반올림해 1~99 로 자른 값.
 * 게임 카드 능력치처럼 99 가 최고 — 축 등급 S(백분위 90 이상)는 90~99점, 종합 S(상위 5%)는 95~99점.
 */
export const GRADE_SCORE_MAX = 99;
export function gradeScore(pct: number | null | undefined): number | null {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  return Math.min(GRADE_SCORE_MAX, Math.max(1, Math.round(pct)));
}

/** 백분위 → "상위 N%" (N = 100 − 백분위, 올림·최소 1). 카드 종합 등급 툴팁·읽기 라벨. null → null */
export function topShareLabel(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  return `상위 ${Math.max(1, Math.ceil(100 - pct))}%`;
}
