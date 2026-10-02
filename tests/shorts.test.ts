// lib/shorts.ts 검증: 득점 출처 나누기(합 = 공식 득점)·특징 고르기·조사·자막 조각 (npm run test:shorts)
import assert from "node:assert/strict";
import { captionChunks, euroRo, iGa, pickCallouts, sampleShots, scoringBreakdown, toSpeech, type ScoringSource } from "../lib/shorts";

// 2025-26 서명진: 2점 134·3점 119·자유투 64, 구역 성공 골밑 38·페인트 46·미드 46 → 공식 득점 689 와 합이 같다
const seo = scoringBreakdown({ games: 54, points: 689, twoPm: 134, tpm: 119, ftm: 64, zoneMade: { rim: 38, paint: 46, mid: 46 } })!;
assert.equal(seo.reduce((a, s) => a + s.points, 0), 689);
assert.deepEqual(seo.map((s) => s.key), ["paint", "mid", "three", "ft"]);
assert.equal(seo.find((s) => s.key === "three")!.share, 51.8);
assert.equal(seo.find((s) => s.key === "paint")!.points, 173); // 268 × 84/130 = 173.2
assert.equal(scoringBreakdown({ games: 10, points: 0, twoPm: 0, tpm: 0, ftm: 0, zoneMade: null }), null); // 슛 차트 없는 시즌
assert.equal(scoringBreakdown({ games: 10, points: 5, twoPm: 0, tpm: 0, ftm: 5, zoneMade: { rim: 0, paint: 0, mid: 0 } }), null);
console.log("shorts: 득점 출처 통과");

// 2025-26 국내 득점 1~5위 비중 (이정현·허웅·안영준·허훈·서명진)
const mk = (paint: number, mid: number, three: number, ft: number, g: number, pts: number): ScoringSource[] =>
  ([["paint", paint], ["mid", mid], ["three", three], ["ft", ft]] as const).map(([key, share]) => ({
    key, label: { paint: "페인트", mid: "미드레인지", three: "3점", ft: "자유투" }[key], share,
    points: Math.round((pts * share) / 100), perGame: Math.round(((pts * share) / 100 / g) * 10) / 10,
  }));
const top5 = [mk(31.2, 5.5, 38.9, 24.3, 49, 909), mk(24.9, 7.6, 51.2, 16.4, 45, 739), mk(45.5, 5.1, 32.2, 17.3, 37, 550), mk(38.6, 8.0, 36.1, 17.2, 40, 523), mk(25.1, 13.8, 51.8, 9.3, 54, 689)];
const c = pickCallouts(top5);
assert.deepEqual(c.map((x) => `${x.kind}:${x.source}`), ["perGameTop:ft", "perGameTop:three", "shareTop:paint", "balanced:null", "shareTop:three"]);
assert.equal(c[0].headline, "자유투로만 4.5점");
assert.equal(c[1].headline, "3점으로만 8.4점");
assert.equal(c[3].headline, "페인트 38.6% · 3점 36.1%");
// 미드레인지 13.8% 1위는 특징으로 내세우지 않는다 (MIN_TRAIT_SHARE)
assert.notEqual(c[4].source, "mid");
console.log("shorts: 특징 고르기 통과");

assert.equal(euroRo("자유투"), "자유투로");
assert.equal(euroRo("3점"), "3점으로");
assert.equal(euroRo("미드레인지"), "미드레인지로");
assert.equal(euroRo("페인트"), "페인트로");
assert.equal(iGa("허웅"), "허웅이");
assert.equal(iGa("허훈"), "허훈이");
assert.equal(iGa("이정현"), "이정현이");
assert.equal(toSpeech("25-26 국내 득점 TOP 5."), "이오 이육 국내 득점 탑 파이브.");
for (const ch of captionChunks("그리고 대망의 1위, 이정현. 경기당 18.6점. 비밀은 자유투. 자유투로만 경기당 4.5점, 성공률 87.4%예요.")) {
  assert.ok(ch.length <= 16, ch);
}
assert.equal(sampleShots([[1, 1, 1], [2, 2, 0], [3, 3, 1], [4, 4, 0]], 2).length, 2);
console.log("shorts: 조사·자막·점 솎기 통과");
