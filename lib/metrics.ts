// 파생 지표 계산 — 순수 함수만 둔다 (CLAUDE.md 원칙 5).
// 화면 컴포넌트는 여기 함수를 부르기만 하고, 직접 계산하지 않는다.
// 2차 스탯(USG%, TS%, AST%, REB%, PIE, PER)은 KBL이 계산한 값을 그대로 쓰고,
// 여기서는 "그 값이 시즌 안에서 몇 번째쯤인가"(백분위)와 경기당 환산만 만든다.

/** 레이더 카드 5개 축. 순서가 곧 레이더 꼭짓점 순서다. */
export const RADAR_AXES = ["usgPct", "tsPct", "astPct", "rebPct", "pie"] as const;
export type RadarAxis = (typeof RADAR_AXES)[number];

export const RADAR_AXIS_LABELS: Record<RadarAxis, string> = {
  usgPct: "USG%",
  tsPct: "TS%",
  astPct: "AST%",
  rebPct: "REB%",
  pie: "PIE",
};

/** 레이더 계산에 필요한 최소 필드 (lib/types.ts Player의 부분집합) */
export interface RadarInput {
  games: number;
  minutes: number;
  usgPct: number;
  tsPct: number;
  astPct: number;
  rebPct: number;
  pie: number;
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

export function isQualified(p: Pick<RadarInput, "games" | "minutes">, rule: QualifyRule): boolean {
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

export type RadarPercentiles = Record<RadarAxis, number | null>;

/** 한 선수의 5개 축 백분위. referenceByAxis 는 buildReference() 결과를 넘긴다. */
export function radarPercentiles(
  p: RadarInput,
  referenceByAxis: Record<RadarAxis, number[]>,
): RadarPercentiles {
  const out = {} as RadarPercentiles;
  for (const axis of RADAR_AXES) out[axis] = percentileRank(p[axis], referenceByAxis[axis]);
  return out;
}

/** 표본 기준을 충족한 선수들의 축별 값 배열 (백분위 비교 집단) */
export function buildReference<T extends RadarInput>(
  players: readonly T[],
  rule: QualifyRule,
): Record<RadarAxis, number[]> {
  const qualified = players.filter((p) => isQualified(p, rule));
  const out = {} as Record<RadarAxis, number[]>;
  for (const axis of RADAR_AXES) out[axis] = qualified.map((p) => p[axis]);
  return out;
}

// ─────────────────────────────────────────────
// 경기당 환산
// ─────────────────────────────────────────────

/** 시즌 누적값 ÷ 출전 경기 수. 경기 0이면 0. */
export function perGame(total: number, games: number): number {
  return games > 0 ? total / games : 0;
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
};

/**
 * 백분위 프로필 → 한 줄 유형 라벨. 규칙 (위에서부터 먼저 맞는 것):
 *  1) 5개 축이 모두 60 이상          → "올라운더"      (고르게 상위권)
 *  2) 가장 높은 축이 40 미만          → "궂은일 담당 롤 플레이어" (어느 축도 두드러지지 않음)
 *  3) 그 외: 가장 높은 축의 유형       → TYPE_BY_AXIS
 *     동점이면 RADAR_AXES 순서(USG → TS → AST → REB → PIE)로 먼저 나온 축.
 * 백분위가 null인 축은 무시. 전부 null이면 "분석 불가".
 * 의도: 재미용 한 줄. 정교한 분류(클러스터링 등)는 하지 않는다.
 */
export function playerType(pct: RadarPercentiles): PlayerType {
  const entries = RADAR_AXES.map((a) => [a, pct[a]] as const).filter(
    (e): e is readonly [RadarAxis, number] => e[1] !== null,
  );
  if (entries.length === 0) return { label: "분석 불가", axis: null };
  if (entries.length === RADAR_AXES.length && entries.every(([, v]) => v >= 60)) {
    return { label: "올라운더", axis: null };
  }
  let top = entries[0];
  for (const e of entries) if (e[1] > top[1]) top = e;
  if (top[1] < 40) return { label: "궂은일 담당 롤 플레이어", axis: null };
  return { label: TYPE_BY_AXIS[top[0]], axis: top[0] };
}
