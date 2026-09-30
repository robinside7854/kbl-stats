// lib/metrics.ts 간단 검증. 실행: npm run test:metrics
import assert from "node:assert/strict";
import {
  activeRadarComponents,
  buildGradingContext,
  componentValue,
  coverageFlag,
  DEFAULT_QUALIFY,
  isQualified,
  per40,
  perGame,
  percentileRank,
  gradeGroupOf,
  MIN_GRADE_GROUP,
  missingComponentLabels,
  overallScore,
  percentileRankLow,
  playerType,
  QUALIFY_PRESETS,
  qualifyLabel,
  qualifyShort,
  radarAttemptThresholds,
  RADAR_AXES,
  RADAR_AXIS_COMPONENTS,
  RADAR_AXIS_LABELS,
  RADAR_COMPONENTS,
  radarScore,
  shouldMergeAsia,
  seasonCoverage,
  type GradeInput,
  usgFromKbl,
  USG_KBL_SCALE,
} from "../lib/metrics";

const close = (a: number | null, b: number) => assert.ok(a !== null && Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

// 백분위: 1~10 중에서
const ref = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
close(percentileRank(10, ref), 95); // 1위: (9 + 0.5) / 10
close(percentileRank(1, ref), 5); // 꼴찌
close(percentileRank(5.5, ref), 50); // 집단 밖 값: 5개 아래
close(percentileRank(100, ref), 100); // 집단 최대보다 큼
close(percentileRank(0, ref), 0);
close(percentileRank(3, [3, 3, 3, 3]), 50); // 전원 동점 → 50
assert.equal(percentileRank(1, []), null);
assert.equal(percentileRank(NaN, ref), null);

// 경기당
assert.equal(perGame(100, 10), 10);
assert.equal(perGame(5, 0), 0);

// 표본 기준
assert.equal(isQualified({ games: 10, minutes: 100 }, DEFAULT_QUALIFY), true);
assert.equal(isQualified({ games: 9, minutes: 500 }, DEFAULT_QUALIFY), false);
assert.equal(isQualified({ games: 30, minutes: 99 }, DEFAULT_QUALIFY), false);

// 40분당 환산
assert.equal(per40(100, 400), 10); // 400분에 100점 → 40분당 10점
close(per40(15, 20), 30);
assert.equal(per40(50, 0), 0); // 출전 0분
assert.equal(per40(0, 300), 0);

// 커버리지 판정: 0이 아닌 값 비율 ≥ threshold
assert.equal(coverageFlag([1, 2, 0, 0]), true); // 정확히 50% → true
assert.equal(coverageFlag([1, 0, 0]), false); // 33%
assert.equal(coverageFlag([0, 0, 0]), false);
assert.equal(coverageFlag([]), false); // 선수 0명 시즌
assert.equal(coverageFlag([-3, NaN, 0, 0]), false); // 음수는 값 있음, NaN은 없음 → 25%
assert.equal(coverageFlag([1, 0, 0, 0], 0.25), true);
assert.equal(coverageFlag([1, 0, 0, 0], 0.3), false);

// 시즌 커버리지: advanced는 USG%·AST%·REB% 셋 모두 통과해야 true (PIE 는 판정에서 뺌)
const cov = (o: Partial<Record<string, number>>) => ({
  usgPct: 1, pie: 1, astPct: 1, rebPct: 1, plusMinus: 1, goodDef: 1, screenAst: 1, deflections: 1, ...o,
});
assert.deepEqual(seasonCoverage([cov({}), cov({})]), { advanced: true, plusMinus: true, goodDef: true, hustle: true });
assert.equal(seasonCoverage([cov({ pie: 0 }), cov({ pie: 0 })]).advanced, true); // PIE 가 비어도 영향 없음
assert.equal(seasonCoverage([cov({ astPct: 0 }), cov({ astPct: 0 })]).advanced, false); // AST% 가 비면 false
assert.equal(seasonCoverage([cov({ usgPct: 0 }), cov({ usgPct: 0 })]).advanced, false);
assert.equal(seasonCoverage([cov({ deflections: 0 }), cov({ deflections: 0 })]).hustle, false);
assert.deepEqual(seasonCoverage([]), { advanced: false, plusMinus: false, goodDef: false, hustle: false });

// USG% 표준 척도: KBL 원값 × 5
assert.equal(USG_KBL_SCALE, 5);
close(usgFromKbl(3.5), 17.5);
close(usgFromKbl(7.2396748061173195), 36.198374030586598);
assert.equal(usgFromKbl(0), 0);
assert.equal(usgFromKbl(NaN), 0);

// 반전 백분위 (낮을수록 좋음): 100 − percentileRank
close(percentileRankLow(1, ref), 95); // 가장 낮은 값이 상위
close(percentileRankLow(10, ref), 5);
assert.equal(percentileRankLow(1, []), null);

// ── 레이더 5축 정의 ──
assert.deepEqual([...RADAR_AXES], ["offense", "defense", "three", "hustle", "efficiency"]);
assert.deepEqual(RADAR_AXES.map((a) => RADAR_AXIS_LABELS[a]), ["공격", "수비", "3점", "허슬", "효율"]);
assert.deepEqual([...RADAR_AXIS_COMPONENTS.offense], ["pts40", "ast40", "usgPct", "twoPPct"]);
assert.deepEqual([...RADAR_AXIS_COMPONENTS.defense], ["stl40", "blk40", "dreb40", "gd40", "fouls40"]);
assert.deepEqual([...RADAR_AXIS_COMPONENTS.three], ["tpm40", "tpPct", "tpa40"]);
assert.deepEqual([...RADAR_AXIS_COMPONENTS.hustle], ["oreb40", "stl40", "defl40", "screen40", "pmPerGame"]);
assert.deepEqual([...RADAR_AXIS_COMPONENTS.efficiency], ["tsPct", "efgPct", "tovPct", "astTo", "per"]);
assert.equal(RADAR_COMPONENTS.fouls40.better, "low"); // 파울·TOV% 는 반전
assert.equal(RADAR_COMPONENTS.tovPct.better, "low");
assert.ok(!Object.keys(RADAR_COMPONENTS).includes("pie")); // PIE 없음

// 가짜 선수 (시즌 누적). 기본값: 20경기 400분
const rp = (o: Partial<GradeInput> = {}): GradeInput => ({
  games: 20, minutes: 400, points: 200, ast: 40, stl: 20, blk: 10, fouls: 40, oreb: 20, dreb: 60,
  tpm: 20, tpa: 60, twoPa: 100, goodDef: 10, deflections: 20, screenAst: 10, plusMinus: 40,
  twoPPct: 50, tpPct: 33, usgPct: 20, tsPct: 55, efgPct: 50, tovPct: 12, astTo: 1.5, per: 15,
  nationality: "domestic", isForeign: false,
  ...o,
});
// 구성 요소 값: 40분당 = 누적 ÷ 분 × 40, +/- 는 경기당
close(componentValue(rp(), "pts40"), 20);
close(componentValue(rp(), "gd40"), 1);
close(componentValue(rp(), "fouls40"), 4);
close(componentValue(rp(), "pmPerGame"), 2);
assert.equal(componentValue(rp(), "tsPct"), 55);

// 시즌 커버리지로 빠지는 구성 요소
const full = { advanced: true, plusMinus: true, goodDef: true, hustle: true };
const old = { advanced: false, plusMinus: true, goodDef: false, hustle: false };
const pool = [rp(), rp({ points: 300 }), rp({ points: 100 })];
assert.equal(activeRadarComponents(pool, DEFAULT_QUALIFY, full).length, 21);
const oldActive = activeRadarComponents(pool, DEFAULT_QUALIFY, old);
for (const k of ["usgPct", "gd40", "defl40", "screen40"] as const) assert.ok(!oldActive.includes(k), k);
assert.ok(oldActive.includes("pmPerGame") && oldActive.includes("per"));
assert.deepEqual(missingComponentLabels({ active: oldActive }), ["USG%", "40분당 굿디펜스", "40분당 디플렉션", "40분당 스크린 어시스트"]);
// KBL 계산값이 절반 이상 0 이면(기록 없음) 빠진다 — 커버리지 플래그가 없어도
const noEfg = pool.map((p) => ({ ...p, efgPct: 0 }));
assert.ok(!activeRadarComponents(noEfg, DEFAULT_QUALIFY, full).includes("efgPct"));

// 성공률 시도 기준 (레이더): 표본 충족 선수의 경기당 2점·3점 시도 평균
const rt = radarAttemptThresholds([rp({ tpa: 20 }), rp({ tpa: 100 }), rp({ games: 2, minutes: 10, tpa: 99 })], DEFAULT_QUALIFY);
close(rt.tpa, 3); // (1 + 5) / 2, 표본 미달 제외
close(rt.twoPa, 5);

// ── 국적 집단: 등급은 같은 국적 집단 안 ──
// 국내 3명(득점 100·200·300) + 외국 3명(득점 600·700·800) → 국내 1위도 공격 축이 집단 안 최고
const dom = [rp({ points: 100 }), rp({ points: 200 }), rp({ points: 300 })];
const forn = [600, 700, 800].map((pts) => rp({ points: pts, nationality: "foreign", isForeign: true }));
const g = buildGradingContext([...dom, ...forn], DEFAULT_QUALIFY, full);
assert.equal(g.groups.domestic?.count, 3);
assert.equal(g.groups.foreign?.count, 3);
assert.equal(g.mergeAsia, false); // 아시아쿼터가 없는 시즌은 합치지 않는다 ("외국 선수" 그대로)
const topDom = radarScore(dom[2], g);
const topFor = radarScore(forn[2], g);
assert.ok(topDom.axes.offense! > 80, `국내 득점 1위 공격 ${topDom.axes.offense}`); // 리그 전체였다면 외국 3명 아래
assert.ok(Math.abs(topDom.axes.offense! - topFor.axes.offense!) < 1e-9); // 각자 집단 1위 → 같은 백분위
// 구성 요소 pts40: 국내 집단 안 3명 중 1위 → (2 + 0.5) / 3
close(topDom.components.offense.find((c) => c.key === "pts40")!.pct, (2.5 / 3) * 100);
// 반전: 파울 적은 선수가 수비 파울 항목 상위
const lowFoul = radarScore(rp({ fouls: 10 }), buildGradingContext([rp({ fouls: 10 }), rp({ fouls: 40 }), rp({ fouls: 80 })], DEFAULT_QUALIFY, full));
close(lowFoul.components.defense.find((c) => c.key === "fouls40")!.pct, (2.5 / 3) * 100);
// 시도 기준 미달이면 그 선수의 3점 성공률 항목은 제외(pct null), 축은 남은 항목으로
const noThree = radarScore(rp({ tpa: 2, tpm: 1, tpPct: 50 }), buildGradingContext([rp(), rp({ tpa: 2, tpm: 1, tpPct: 50 }), rp({ tpa: 80 })], DEFAULT_QUALIFY, full));
assert.equal(noThree.components.three.find((c) => c.key === "tpPct")!.pct, null);
assert.ok(noThree.raw.three !== null);
// 커버리지 없는 항목은 구성 요소 목록에서 빠진다
const gOld = buildGradingContext(pool, DEFAULT_QUALIFY, old);
assert.ok(!radarScore(pool[0], gOld).components.offense.some((c) => c.key === "usgPct"));
assert.ok(!radarScore(pool[0], gOld).components.hustle.some((c) => c.key === "defl40"));

// 소집단 합산: 표본 충족 아시아쿼터가 MIN_GRADE_GROUP(8) 미만이면 외국과 한 집단
assert.equal(MIN_GRADE_GROUP, 8);
const asia = (n: number) => Array.from({ length: n }, (_, i) => rp({ points: 300 + i, nationality: "asia", isForeign: true }));
assert.equal(shouldMergeAsia([...dom, ...forn, ...asia(7)], DEFAULT_QUALIFY), true);
assert.equal(shouldMergeAsia([...dom, ...forn, ...asia(8)], DEFAULT_QUALIFY), false);
assert.equal(shouldMergeAsia([...dom, ...asia(7), rp({ games: 1, nationality: "asia" })], DEFAULT_QUALIFY), true); // 표본 미달은 세지 않음
assert.equal(shouldMergeAsia([...dom, ...forn], DEFAULT_QUALIFY), false); // 아시아쿼터 0명
assert.equal(shouldMergeAsia([...dom, rp({ games: 1, nationality: "asia" })], DEFAULT_QUALIFY), true); // 있지만 표본 충족 0명
assert.equal(gradeGroupOf({ nationality: "asia", isForeign: true }, true), "foreignAsia");
assert.equal(gradeGroupOf({ nationality: "foreign", isForeign: true }, true), "foreignAsia");
assert.equal(gradeGroupOf({ nationality: "asia", isForeign: true }, false), "asia");
assert.equal(gradeGroupOf({ nationality: null, isForeign: true }, false), "foreign"); // 마스터 없음 → isForeign
assert.equal(gradeGroupOf({ nationality: null, isForeign: false }, true), "domestic");
const gm = buildGradingContext([...dom, ...forn, ...asia(3)], DEFAULT_QUALIFY, full);
assert.equal(gm.groups.foreignAsia?.count, 6);
assert.equal(gm.groups.asia, undefined);
const gs = buildGradingContext([...dom, ...forn, ...asia(8)], DEFAULT_QUALIFY, full);
assert.equal(gs.groups.asia?.count, 8);
assert.equal(gs.groups.foreign?.count, 3);

// 종합 원점수 = 5축 평균 (null 제외)
assert.equal(overallScore({ offense: 90, defense: 80, three: 70, hustle: 60, efficiency: 50 }), 70);
assert.equal(overallScore({ offense: 90, defense: null, three: 70, hustle: null, efficiency: 50 }), 70);
assert.equal(overallScore({}), null);
// 종합 백분위: 집단 안에서 다시 순위 → 같은 선수가 모든 축 1위면 집단 최고
assert.ok(radarScore(rp({ points: 900, ast: 200, stl: 60, blk: 40, dreb: 200, oreb: 80, tpm: 80, tpa: 160, per: 30, tsPct: 70, efgPct: 65, astTo: 4, tovPct: 5, fouls: 10, twoPPct: 70, tpPct: 50, plusMinus: 200, goodDef: 40, deflections: 60, screenAst: 40, usgPct: 35 }), g).overall! >= 99.9);

// 유형 라벨 (5축)
assert.equal(playerType({ offense: 70, defense: 65, three: 80, hustle: 61, efficiency: 90 }).label, "올라운더");
assert.equal(playerType({ offense: 10, defense: 20, three: 30, hustle: 39, efficiency: 5 }).label, "궂은일 담당 롤 플레이어");
assert.equal(playerType({ offense: 95, defense: 20, three: 30, hustle: 39, efficiency: 5 }).label, "득점원");
assert.equal(playerType({ offense: 50, defense: 90, three: 30, hustle: 39, efficiency: 5 }).label, "수비수");
assert.equal(playerType({ offense: 50, defense: 20, three: 90, hustle: 39, efficiency: 5 }).label, "슈터");
assert.equal(playerType({ offense: 50, defense: 20, three: 30, hustle: 90, efficiency: 5 }).label, "허슬 플레이어");
assert.equal(playerType({ offense: 10, defense: 20, three: 30, hustle: 9, efficiency: 88 }).label, "효율형");
assert.equal(playerType({ offense: 80, defense: 80, three: 30, hustle: 9, efficiency: 5 }).axis, "offense"); // 동점 → 앞 축
assert.equal(playerType({ offense: 70, defense: null, three: 95, hustle: 61, efficiency: 90 }).label, "슈터"); // null 축 있으면 올라운더 아님
assert.equal(playerType({ offense: null, defense: null, three: null, hustle: null, efficiency: null }).label, "분석 불가");

console.log("metrics: 모든 검사 통과");

// 표본 기준 프리셋: 첫 번째가 기본값 (레이더·순위표 공용)
assert.equal(QUALIFY_PRESETS[0], DEFAULT_QUALIFY);
assert.equal(qualifyLabel(DEFAULT_QUALIFY), "10경기·100분 이상");
assert.equal(qualifyShort(DEFAULT_QUALIFY), "10경기·100분+");
console.log("metrics: 표본 프리셋 검사 통과");
