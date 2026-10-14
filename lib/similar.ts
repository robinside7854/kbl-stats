// 비슷한 선수 (Basketball-Reference Similarity Scores 를 우리 데이터에 맞게 단순화, 2026-10-01) — 순수 함수만.
// 재료: 시즌마다 표본 기준을 넘긴 선수의 레이더 6축 백분위(lib/metrics radarScore — 같은 시즌·같은 국적 풀 안 위치)
//   + 종합 백분위 + 역할 유형(playerType) + 주 공격 유형(슛 차트, 2006-07~). 2026-10-01 사용자: "레이더만이 아니라 유형·평가 전반을 종합적으로".
// 레이더 유사도 = 100 × (1 − 6축 백분위 거리 ÷ 최대 거리).  최대 거리 = 100 × √6 (모든 축이 0 대 100).
// 종합 유사도(combinedSimilarity) = 레이더 60% + 종합 평가 15%(100 − 종합 백분위 차) + 역할 유형 15%(같으면 100) + 공격 유형 10%(같으면 100).
//   공격 유형·종합 백분위가 한쪽이라도 없으면 그 항목은 빼고 나머지 비중으로 다시 나눈다.
// 비교 대상: 같은 국적 풀(국내끼리 / 외국인끼리)만 — 백분위가 풀 안 위치라 국내 S 와 외국 S 는 실제 기록 크기가 다르다.
//   그리고 둘 다 포지션 묶음(G/F/C)을 알면 같은 묶음끼리만 — 처음엔 포지션을 안 봤더니 센터 하윤기와 가드 이정석이 짝이 됐다.
// 한 선수는 가장 비슷한 시즌 하나만 (같은 선수가 목록을 채우지 않게), 자기 자신의 다른 시즌은 뺀다.
// 출처: Basketball-Reference "Similarity Scores" 개념(https://www.basketball-reference.com/about/similar.html) — 계산식은 우리 것.

import { RADAR_AXES, type RadarAxis } from "./metrics";

export interface SimilarVector {
  id: string;
  seasonCode: number;
  /** 국적 풀 (lib/metrics gradeGroupOf 결과 — "domestic" / 외국인 풀 키) */
  pool: string;
  /** 포지션 묶음 G/F/C (모르면 null — 그때는 포지션을 보지 않는다) */
  pos: string | null;
  /** 6축 백분위 (RADAR_AXES 순서) */
  axes: number[];
  /** 종합 백분위 0~100 (lib/metrics overallPercentile, 없으면 null) */
  overall?: number | null;
  /** 역할 유형 키 (lib/metrics playerType) */
  role?: string | null;
  /** 주 공격 유형 키 (lib/shots offenseType, 슛 차트 없는 시즌·50개 미만은 null) */
  offense?: string | null;
}

/** 종합 유사도 항목 비중 (합 1) */
export const SIMILAR_WEIGHTS = { radar: 0.6, overall: 0.15, role: 0.15, offense: 0.1 } as const;

export const SIMILAR_COUNT = 5;
const MAX_DIST = 100 * Math.sqrt(RADAR_AXES.length);

/** 6축 값이 모두 있는 경우만 벡터로 (축 하나라도 없으면 null) */
export function toAxisVector(axes: Partial<Record<RadarAxis, number | null>>): number[] | null {
  const out: number[] = [];
  for (const a of RADAR_AXES) {
    const v = axes[a];
    if (v === null || v === undefined || !Number.isFinite(v)) return null;
    out.push(v);
  }
  return out;
}

/** 두 벡터 유사도 0~100 (같으면 100) */
export function similarityScore(a: readonly number[], b: readonly number[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += (a[i] - b[i]) ** 2;
  return 100 * (1 - Math.sqrt(d) / MAX_DIST);
}

/** 두 시즌의 종합 유사도 0~100 (위 머리말 공식). 없는 항목은 빼고 비중을 다시 나눈다 */
export function combinedSimilarity(a: SimilarVector, b: SimilarVector): number {
  const W = SIMILAR_WEIGHTS;
  let sum = W.radar * similarityScore(a.axes, b.axes);
  let w = W.radar;
  if (a.overall != null && b.overall != null) {
    sum += W.overall * (100 - Math.abs(a.overall - b.overall));
    w += W.overall;
  }
  if (a.role && b.role) {
    sum += W.role * (a.role === b.role ? 100 : 0);
    w += W.role;
  }
  if (a.offense && b.offense) {
    sum += W.offense * (a.offense === b.offense ? 100 : 0);
    w += W.offense;
  }
  return sum / w;
}

export interface SimilarMatch {
  id: string;
  seasonCode: number;
  score: number;
  /** 역할 유형이 같은가 (화면 "같은 유형" 표시) */
  sameRole: boolean;
}

/** target 과 가장 비슷한 다른 선수의 시즌 n 개 (선수마다 최고 시즌 하나, 같은 풀만). 점수 높은 순, 같으면 최근 시즌·번호 순 */
export function findSimilar(target: SimilarVector, pool: readonly SimilarVector[], n = SIMILAR_COUNT): SimilarMatch[] {
  const best = new Map<string, SimilarMatch>();
  for (const v of pool) {
    if (v.id === target.id || v.pool !== target.pool) continue;
    if (target.pos && v.pos && target.pos !== v.pos) continue;
    const score = combinedSimilarity(target, v);
    const prev = best.get(v.id);
    if (!prev || score > prev.score) best.set(v.id, { id: v.id, seasonCode: v.seasonCode, score, sameRole: !!target.role && target.role === v.role });
  }
  return [...best.values()]
    .sort((x, y) => y.score - x.score || y.seasonCode - x.seasonCode || x.id.localeCompare(y.id))
    .slice(0, n);
}

/** 화면에 넘기는 비슷한 시즌 한 줄 */
export interface SimilarEntry {
  id: string;
  nameKo: string;
  seasonCode: number;
  seasonLabel: string;
  teamShort: string;
  teamColor: string;
  photoUrl: string | null;
  /** 유사도 0~100 */
  score: number;
  /** 그 시즌 역할 유형 라벨 (예: "플레이메이커") */
  roleLabel: string | null;
  /** 고른 선수와 역할 유형이 같은가 */
  sameRole: boolean;
}


/**
 * 선수 한 명의 시즌별 비슷한 시즌 파일 주소 (2026-10-14 결과물 줄이기).
 * 선수 페이지에는 처음 보이는 시즌 목록만 넣고, 다른 시즌을 고르면 이 파일 하나를 받는다
 * (빌드 때 app/similar/[file]/route.ts 가 정적 파일로 만든다 — 내용 = 시즌 코드 → SimilarEntry[]).
 */
export function similarFileUrl(playerNo: string): string {
  return `/similar/${playerNo}.json`;
}
