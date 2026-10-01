// 프라임 시즌 (2026-10-01 사용자 요청: "가장 개인 기록이 좋았던 시즌을 프라임 시즌으로, 시즌 고를 때 잘 보이게") — 순수 함수만.
// 기준: 표본 기준(10경기·100분)을 넘긴 시즌 중 **종합 점수(6축 백분위의 포지션별 가중 평균, radarScore.overallAvg)가 가장 높은 시즌**.
//   - 그 시즌 리그 안에서의 위치라 시대가 달라도 비교된다 (득점 합계처럼 경기 수·리그 템포에 흔들리지 않는다).
//   - 같으면 PER 이 높은 시즌, 그래도 같으면 최근 시즌.
//   - 표본을 넘긴 시즌이 2개 이상인 선수만 붙인다 (한 시즌뿐이면 "가장 좋았던"이 의미 없다).
import { seasonGrading } from "./cardview";
import { isQualified, radarScore } from "./metrics";
import type { SeasonCards } from "./cards";

export interface PrimeCandidate {
  id: string;
  seasonCode: number;
  /** 종합 점수 (6축 가중 평균, 0~100) */
  score: number;
  per: number;
}

/** 한 시즌의 후보: 표본 충족 선수의 종합 점수 */
export function primeCandidatesOf(cards: SeasonCards): PrimeCandidate[] {
  const grading = seasonGrading(cards);
  const out: PrimeCandidate[] = [];
  for (const p of cards.players) {
    if (!isQualified(p, cards.defaults.rule)) continue;
    const s = radarScore(p, grading).overallAvg;
    if (s === null) continue;
    out.push({ id: p.id, seasonCode: cards.seasonCode, score: s, per: p.per });
  }
  return out;
}

/** 선수 번호 → 프라임 시즌 코드. 후보 시즌이 2개 이상인 선수만 */
export function pickPrimeSeasons(candidates: readonly PrimeCandidate[]): Map<string, number> {
  const best = new Map<string, PrimeCandidate>();
  const count = new Map<string, number>();
  for (const c of candidates) {
    count.set(c.id, (count.get(c.id) ?? 0) + 1);
    const b = best.get(c.id);
    if (!b || c.score > b.score || (c.score === b.score && (c.per > b.per || (c.per === b.per && c.seasonCode > b.seasonCode)))) best.set(c.id, c);
  }
  const out = new Map<string, number>();
  for (const [id, c] of best) if ((count.get(id) ?? 0) >= 2) out.set(id, c.seasonCode);
  return out;
}
