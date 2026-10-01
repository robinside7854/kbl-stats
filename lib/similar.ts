// 비슷한 선수 (Basketball-Reference Similarity Scores 를 우리 데이터에 맞게 단순화, 2026-10-01) — 순수 함수만.
// 재료: 시즌마다 표본 기준을 넘긴 선수의 레이더 6축 백분위(lib/metrics radarScore — 같은 시즌·같은 국적 풀 안 위치).
// 유사도 = 100 × (1 − 6축 백분위 거리 ÷ 최대 거리).  최대 거리 = 100 × √6 (모든 축이 0 대 100).
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
}

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

export interface SimilarMatch {
  id: string;
  seasonCode: number;
  score: number;
}

/** target 과 가장 비슷한 다른 선수의 시즌 n 개 (선수마다 최고 시즌 하나, 같은 풀만). 점수 높은 순, 같으면 최근 시즌·번호 순 */
export function findSimilar(target: SimilarVector, pool: readonly SimilarVector[], n = SIMILAR_COUNT): SimilarMatch[] {
  const best = new Map<string, SimilarMatch>();
  for (const v of pool) {
    if (v.id === target.id || v.pool !== target.pool) continue;
    if (target.pos && v.pos && target.pos !== v.pos) continue;
    const score = similarityScore(target.axes, v.axes);
    const prev = best.get(v.id);
    if (!prev || score > prev.score) best.set(v.id, { id: v.id, seasonCode: v.seasonCode, score });
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
}

