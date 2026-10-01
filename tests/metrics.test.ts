// lib/metrics.ts 간단 검증. 실행: npm run test:metrics
import assert from "node:assert/strict";
import type { Position } from "../lib/types";
import { PLAYER_TYPES, TYPE_ALLROUNDER_MIN, TYPE_ROLE_MAX } from "../lib/glossary";
import {
  percentileGrade,
  overallGrade,
  OVERALL_GRADE_CUTS,
  activeRadarComponents,
  buildGradingContext,
  componentValue,
  coverageFlag,
  DEFAULT_QUALIFY,
  isQualified,
  per30,
  perGame,
  percentileRank,
  gradeGroupOf,
  MIN_GRADE_GROUP,
  missingComponentLabels,
  overallScore,
  overallPercentile,
  topShareLabel,
  overallWeightNote,
  axisWeights,
  ROLE_AXIS_WEIGHTS,
  roleGroupOf,
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

// 30분당 환산 (KBL 10분 쿼터 × 3 = NBA per-36 과 같은 뜻)
assert.equal(per30(100, 300), 10); // 300분에 100점 → 30분당 10점
close(per30(15, 20), 22.5);
assert.equal(per30(50, 0), 0); // 출전 0분
assert.equal(per30(0, 300), 0);

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

// ── 레이더 6축 정의 (2026-10-01 피드백 7차) ──
assert.deepEqual([...RADAR_AXES], ["offense", "defense", "rebound", "shooting", "playmaking", "efficiency"]);
assert.deepEqual(RADAR_AXES.map((a) => RADAR_AXIS_LABELS[a]), ["공격", "수비", "리바운드", "슈팅", "리딩", "효율"]);
assert.deepEqual([...RADAR_AXIS_COMPONENTS.offense], ["ptsPerGame", "fgmPerGame", "fgaPerGame", "ftaPerGame", "usgPct"]);
assert.deepEqual([...RADAR_AXIS_COMPONENTS.defense], ["stlPerGame", "blkPerGame", "gdPerGame", "deflPerGame"]);
assert.deepEqual([...RADAR_AXIS_COMPONENTS.rebound], ["orebPerGame", "drebPerGame", "rebPct"]);
assert.deepEqual([...RADAR_AXIS_COMPONENTS.shooting], ["tpmPerGame", "tpaPerGame", "tpPct", "midAPerGame", "midPct", "ftPct"]); // 자유투% 2026-10-01 추가
assert.equal(RADAR_COMPONENTS.ftPct.attempt, "fta");
assert.deepEqual([...RADAR_AXIS_COMPONENTS.playmaking], ["astPerGame", "astTo", "tovPct", "astPct"]); // 경기당 턴오버는 벤치 편향이라 뺌
assert.deepEqual([...RADAR_AXIS_COMPONENTS.efficiency], ["per", "tsPct", "efgPct"]);
assert.equal(RADAR_COMPONENTS.tovPct.better, "low"); // TOV% 는 반전
assert.equal(RADAR_COMPONENTS.midPct.requires, "shots"); // 미드레인지는 슛 차트 있는 시즌만
assert.ok(!Object.keys(RADAR_COMPONENTS).includes("pie")); // PIE 없음
assert.ok(!Object.keys(RADAR_COMPONENTS).includes("foulsPerGame")); // 파울·+/-·스크린 어시스트·2점% 는 축에서 뺌
assert.ok(!Object.keys(RADAR_COMPONENTS).includes("pmPerGame"));

// 가짜 선수 (시즌 누적). 기본값: 20경기 400분
const rp = (o: Partial<GradeInput> = {}): GradeInput => ({
  games: 20, minutes: 400, points: 200, ast: 40, stl: 20, blk: 10, tov: 30, fgm: 80, fga: 160, fta: 40, oreb: 20, dreb: 60,
  tpm: 20, tpa: 60, goodDef: 10, deflections: 20, midA: 40, midM: 16,
  tpPct: 33, ftPct: 75, usgPct: 20, rebPct: 10, astPct: 15, tsPct: 55, efgPct: 50, tovPct: 12, astTo: 1.5, per: 15,
  nationality: "domestic", isForeign: false,
  ...o,
});
// 구성 요소 값: 누적 기록은 경기당 = 시즌 합계 ÷ 경기 수 (40분 환산 아님, PLAN.md §13)
close(componentValue(rp(), "ptsPerGame"), 10);
close(componentValue(rp(), "gdPerGame"), 0.5);
close(componentValue(rp(), "tpaPerGame"), 3);
close(componentValue(rp(), "midAPerGame"), 2);
close(componentValue(rp(), "midPct"), 40); // 우리 계산: 성공 ÷ 시도
assert.equal(componentValue(rp({ midA: 0, midM: 0 }), "midPct"), 0);
// 출전 시간은 값에 영향 없음: 같은 경기·같은 득점이면 100분을 뛰든 400분을 뛰든 경기당 득점은 같다
// (40분당이었다면 100분 선수가 40점으로 4배 부풀었다 — 벤치 선수 등급이 뛰던 원인)
close(componentValue(rp({ minutes: 100 }), "ptsPerGame"), componentValue(rp(), "ptsPerGame"));
assert.ok(!Object.keys(RADAR_COMPONENTS).some((k) => k.endsWith("40"))); // 40분당 구성 요소 없음
assert.equal(componentValue(rp(), "tsPct"), 55);

// 시즌 커버리지로 빠지는 구성 요소
const full = { advanced: true, plusMinus: true, goodDef: true, hustle: true, shots: true };
const old = { advanced: false, plusMinus: true, goodDef: false, hustle: false };
const pool = [rp(), rp({ points: 300 }), rp({ points: 100 })];
assert.equal(activeRadarComponents(pool, DEFAULT_QUALIFY, full).length, 25);
const oldActive = activeRadarComponents(pool, DEFAULT_QUALIFY, old);
for (const k of ["usgPct", "rebPct", "astPct", "gdPerGame", "deflPerGame", "midAPerGame", "midPct"] as const) assert.ok(!oldActive.includes(k), k);
assert.ok(oldActive.includes("stlPerGame") && oldActive.includes("per"));
assert.deepEqual(missingComponentLabels({ active: oldActive }), ["USG%", "경기당 굿디펜스", "경기당 디플렉션", "REB%", "경기당 미드레인지 시도", "미드레인지 성공률", "AST%"]);
// KBL 계산값이 절반 이상 0 이면(기록 없음) 빠진다 — 커버리지 플래그가 없어도
const noEfg = pool.map((p) => ({ ...p, efgPct: 0 }));
assert.ok(!activeRadarComponents(noEfg, DEFAULT_QUALIFY, full).includes("efgPct"));

// 성공률 시도 기준 (레이더): 표본 충족 선수의 경기당 3점·미드레인지 시도 평균
const rt = radarAttemptThresholds([rp({ tpa: 20, midA: 20 }), rp({ tpa: 100, midA: 60 }), rp({ games: 2, minutes: 10, tpa: 99, midA: 99 })], DEFAULT_QUALIFY);
close(rt.tpa, 3); // (1 + 5) / 2, 표본 미달 제외
close(rt.midA, 2); // (1 + 3) / 2
close(rt.fta, 2);  // 기본 fta 40 / 20경기
// 자유투 성공률도 시도 기준: 경기당 자유투 시도가 평균 미만이면 그 선수만 항목 제외
{
  const fewFt = radarScore(rp({ fta: 4, ftPct: 100 }), buildGradingContext([rp(), rp({ fta: 4, ftPct: 100 }), rp({ fta: 60 })], DEFAULT_QUALIFY, full));
  assert.equal(fewFt.components.shooting.find((c) => c.key === "ftPct")!.pct, null);
}

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
// 구성 요소 ptsPerGame: 국내 집단 안 3명 중 1위 → (2 + 0.5) / 3
close(topDom.components.offense.find((c) => c.key === "ptsPerGame")!.pct, (2.5 / 3) * 100);
// 반전: TOV% 낮은 선수가 리딩 TOV% 항목 상위
const lowTov = radarScore(rp({ tovPct: 5 }), buildGradingContext([rp({ tovPct: 5 }), rp({ tovPct: 12 }), rp({ tovPct: 20 })], DEFAULT_QUALIFY, full));
close(lowTov.components.playmaking.find((c) => c.key === "tovPct")!.pct, (2.5 / 3) * 100);
// 시도 기준 미달이면 그 선수의 3점 성공률 항목은 제외(pct null), 축은 남은 항목으로
const noThree = radarScore(rp({ tpa: 2, tpm: 1, tpPct: 50 }), buildGradingContext([rp(), rp({ tpa: 2, tpm: 1, tpPct: 50 }), rp({ tpa: 80 })], DEFAULT_QUALIFY, full));
assert.equal(noThree.components.shooting.find((c) => c.key === "tpPct")!.pct, null);
assert.ok(noThree.raw.shooting !== null);
// 커버리지 없는 항목은 구성 요소 목록에서 빠진다
const gOld = buildGradingContext(pool, DEFAULT_QUALIFY, old);
assert.ok(!radarScore(pool[0], gOld).components.offense.some((c) => c.key === "usgPct"));
assert.ok(!radarScore(pool[0], gOld).components.defense.some((c) => c.key === "deflPerGame"));
assert.ok(!radarScore(pool[0], gOld).components.shooting.some((c) => c.key === "midPct"));

// 두 풀 고정(2026-10-01): 아시아쿼터가 한 명이라도 있으면 인원과 관계없이 외국과 한 집단
assert.equal(MIN_GRADE_GROUP, 8);
const asia = (n: number) => Array.from({ length: n }, (_, i) => rp({ points: 300 + i, nationality: "asia", isForeign: true }));
assert.equal(shouldMergeAsia([...dom, ...forn, ...asia(7)], DEFAULT_QUALIFY), true);
assert.equal(shouldMergeAsia([...dom, ...forn, ...asia(8)], DEFAULT_QUALIFY), true); // 8명 이상이어도 합산
assert.equal(shouldMergeAsia([...dom, ...forn, ...asia(20)], DEFAULT_QUALIFY), true);
assert.equal(shouldMergeAsia([...dom, ...forn], DEFAULT_QUALIFY), false); // 아시아쿼터 0명
assert.equal(shouldMergeAsia([...dom, rp({ games: 1, nationality: "asia" })], DEFAULT_QUALIFY), true); // 표본 미달이어도 있으면 합산
assert.equal(gradeGroupOf({ nationality: "asia", isForeign: true }, true), "foreignAsia");
assert.equal(gradeGroupOf({ nationality: "foreign", isForeign: true }, true), "foreignAsia");
assert.equal(gradeGroupOf({ nationality: "asia", isForeign: true }, false), "asia");
assert.equal(gradeGroupOf({ nationality: null, isForeign: true }, false), "foreign"); // 마스터 없음 → isForeign
assert.equal(gradeGroupOf({ nationality: null, isForeign: false }, true), "domestic");
const gm = buildGradingContext([...dom, ...forn, ...asia(3)], DEFAULT_QUALIFY, full);
assert.equal(gm.groups.foreignAsia?.count, 6);
assert.equal(gm.groups.asia, undefined);
const gs = buildGradingContext([...dom, ...forn, ...asia(8)], DEFAULT_QUALIFY, full);
assert.equal(gs.groups.asia, undefined);           // 아시아쿼터 따로 집단을 만들지 않는다
assert.equal(gs.groups.foreign, undefined);
assert.equal(gs.groups.foreignAsia?.count, 11);    // 외국 3 + 아시아쿼터 8

// 종합 원점수 = 6축 평균 (null 제외)
assert.equal(overallScore({ offense: 90, defense: 80, rebound: 70, shooting: 60, playmaking: 50, efficiency: 70 }), 70);
assert.equal(overallScore({ offense: 90, defense: null, rebound: 70, shooting: null, playmaking: 50, efficiency: 70 }), 70);
assert.equal(overallScore({}), null);
// 포지션별 축 가중치 (2026-10-01): 가드 리딩 1.5·리바운드 0.5, 포워드 전부 1, 빅맨 리바운드 1.5·슈팅 0.5·리딩 0.5, 포지션 모르면 1
assert.deepEqual(ROLE_AXIS_WEIGHTS, { guard: { playmaking: 1.5, rebound: 0.5 }, forward: {}, big: { rebound: 1.5, shooting: 0.5, playmaking: 0.5 } });
assert.equal(roleGroupOf("G"), "guard");
assert.equal(roleGroupOf("GF"), "guard");
assert.equal(roleGroupOf("F"), "forward");
assert.equal(roleGroupOf("FC"), "big");
assert.equal(roleGroupOf("C"), "big");
assert.equal(roleGroupOf(null), null);
assert.equal(axisWeights(null).rebound, 1);
assert.equal(axisWeights("C").rebound, 1.5);
assert.equal(axisWeights("C").shooting, 0.5);
assert.equal(axisWeights("C").offense, 1);
assert.equal(axisWeights("G").playmaking, 1.5);
const bigAxes = { offense: 80, defense: 60, rebound: 90, shooting: 10, playmaking: 20, efficiency: 70 };
close(overallScore(bigAxes, axisWeights("C")), (80 + 60 + 90 * 1.5 + 10 * 0.5 + 20 * 0.5 + 70) / 5.5); // 빅맨: 리바운드 1.5, 슈팅·리딩 0.5
close(overallScore(bigAxes, axisWeights("G")), (80 + 60 + 90 * 0.5 + 10 + 20 * 1.5 + 70) / 6);          // 가드: 리딩 1.5, 리바운드 0.5
close(overallScore(bigAxes, axisWeights("F")), 55);                                                      // 포워드: 6축 그대로
assert.ok(overallScore(bigAxes, axisWeights("C"))! > overallScore(bigAxes, axisWeights("G"))!);        // 같은 기록이면 빅맨 쪽이 높다
assert.equal(overallScore({ shooting: 90 }, { ...axisWeights("C"), shooting: 0 }), null);                // 세는 축이 없으면 null
assert.equal(overallWeightNote("C"), "빅맨이라 리바운드 ×1.5 · 슈팅 ×0.5 · 리딩 ×0.5");
assert.equal(overallWeightNote("FC"), "빅맨이라 리바운드 ×1.5 · 슈팅 ×0.5 · 리딩 ×0.5");
assert.equal(overallWeightNote("G"), "가드라 리바운드 ×0.5 · 리딩 ×1.5");
assert.equal(overallWeightNote("F"), null);
assert.equal(overallWeightNote(null), null);
// 종합 점수(overallAvg) = 6축 백분위 가중 평균, 종합(overall) = 그 값의 집단 안 백분위 (2026-10-01)
for (const p of pool) {
  const r = radarScore(p, g);
  assert.equal(r.overallAvg, overallScore(r.axes, axisWeights(p.position)));
  assert.equal(r.overall, overallPercentile(r.overallAvg, g.groups.domestic!.overallRaw));
}
// 같은 기록이라도 포지션에 따라 종합 가중치가 다르다 (레이더 축 값은 같다)
{
  const base = pool[0];
  const asC = radarScore({ ...base, position: "C" }, g);
  const asG = radarScore({ ...base, position: "G" }, g);
  assert.deepEqual(asC.axes, asG.axes);
  assert.equal(asC.overallAvg, overallScore(asG.axes, axisWeights("C")));
  assert.equal(asG.overallAvg, overallScore(asG.axes, axisWeights("G")));
  // 종합 등급의 값은 종합 점수(가중 평균)를 같은 집단 종합 점수 배열에 대어 다시 매긴 백분위
  assert.equal(asC.overall, overallPercentile(asC.overallAvg, g.groups.domestic!.overallRaw));
}
// 종합 백분위: 집단 종합 점수에 대어 순위 (mid-rank), 비교 대상이 없거나 점수가 없으면 null
assert.equal(overallPercentile(80, [10, 20, 30, 80]), 87.5);
assert.equal(overallPercentile(null, [10, 20]), null);
assert.equal(overallPercentile(50, []), null);
// 종합 컷 경계 (종합 백분위): S ≥ 95(상위 5%), A ≥ 80, B ≥ 55, C ≥ 30, D ≥ 10, F < 10
assert.deepEqual(OVERALL_GRADE_CUTS.map(([g, c]) => [g, c]), [["S", 95], ["A", 80], ["B", 55], ["C", 30], ["D", 10], ["F", -Infinity]]);
assert.deepEqual(
  [100, 95, 94.99, 80, 79.9, 55, 54.9, 30, 29.9, 10, 9.9, 0].map((v) => overallGrade(v)),
  ["S", "S", "A", "A", "B", "B", "C", "C", "D", "D", "F", "F"],
);
// 100명 집단이면 종합 S 는 5명 (상위 5%)
{
  const ref = Array.from({ length: 100 }, (_, i) => i);
  assert.equal(ref.filter((v) => overallGrade(overallPercentile(v, ref)) === "S").length, 5);
}
assert.equal(overallGrade(null), "-");
assert.equal(percentileGrade(86), "A"); // 축 등급은 그대로 90 컷
// 모든 축 1위(집단 밖 선수라 백분위 100)면 종합도 100
assert.ok(radarScore(rp({ points: 900, fgm: 350, fga: 600, fta: 200, ast: 200, stl: 60, blk: 40, dreb: 200, oreb: 80, tpm: 80, tpa: 160, midA: 100, midM: 60, per: 30, tsPct: 70, efgPct: 65, astTo: 4, tovPct: 5, tov: 5, tpPct: 50, goodDef: 40, deflections: 60, usgPct: 35, rebPct: 30, astPct: 40 }), g).overall! >= 99.9);

// 유형 라벨 (6축)
const ax = (o: Partial<Record<string, number | null>>) => ({ offense: 50, defense: 20, rebound: 30, shooting: 30, playmaking: 39, efficiency: 5, ...o });
assert.equal(playerType(ax({ offense: 70, defense: 65, rebound: 80, shooting: 61, playmaking: 90, efficiency: 60 })).label, "올라운더");
assert.equal(playerType(ax({ offense: 10 })).label, "궂은일 담당 롤 플레이어");
assert.equal(playerType(ax({ offense: 95 })).label, "득점원");
assert.equal(playerType(ax({ defense: 90 })).label, "수비수");
assert.equal(playerType(ax({ rebound: 90 })).label, "리바운더");
assert.equal(playerType(ax({ shooting: 90 })).label, "슈터");
assert.equal(playerType(ax({ playmaking: 90 })).label, "플레이메이커");
assert.equal(playerType(ax({ offense: 10, efficiency: 88 })).label, "효율형");
assert.equal(playerType(ax({ offense: 80, defense: 80 })).axis, "offense"); // 동점 → 앞 축
assert.equal(playerType(ax({ offense: 70, defense: null, rebound: 80, shooting: 95, playmaking: 61, efficiency: 90 })).label, "슈터"); // null 축 있으면 올라운더 아님
assert.equal(playerType({ offense: null, defense: null, rebound: null, shooting: null, playmaking: null, efficiency: null }).label, "분석 불가");
// 포지션 세분 유형 (2026-10-01): 포지션을 넘겨야 붙는다
assert.equal(playerType(ax({ playmaking: 75, rebound: 60 }), axisWeights("C"), "C").label, "플레이메이킹 빅맨");
assert.equal(playerType(ax({ shooting: 75, rebound: 60 }), axisWeights("FC"), "FC").label, "스트레치 빅맨");
assert.equal(playerType(ax({ playmaking: 75, rebound: 60 }), axisWeights("C")).label, "플레이메이커"); // 포지션 없으면 일반 규칙
assert.equal(playerType(ax({ playmaking: 69, rebound: 60 }), axisWeights("C"), "C").label, "플레이메이커"); // 문턱 70 미만
assert.equal(playerType(ax({ playmaking: 75, rebound: 90 }), axisWeights("C"), "C").label, "리바운더"); // 가장 높은 축이 아니면 세분 유형 아님
assert.equal(playerType(ax({ defense: 85, shooting: 40 }), axisWeights("G"), "G").label, "락다운 디펜더");
assert.equal(playerType(ax({ defense: 85, shooting: 40 }), axisWeights("F"), "F").label, "락다운 디펜더");
assert.equal(playerType(ax({ defense: 85, shooting: 60 }), axisWeights("G"), "G").label, "수비수"); // 슛도 좋으면 그냥 수비수
assert.equal(playerType(ax({ defense: 85, shooting: 40, offense: 75 }), axisWeights("G"), "G").label, "수비수"); // 득점도 좋으면 그냥 수비수
assert.equal(playerType(ax({ defense: 85, shooting: 40 }), axisWeights("C"), "C").label, "수비수"); // 빅맨에겐 락다운 없음
assert.equal(playerType(ax({ rebound: 75 }), axisWeights("GF"), "GF").label, "리바운딩 가드");
assert.equal(playerType(ax({ rebound: 75 }), axisWeights("F"), "F").label, "리바운더"); // 포워드에겐 없음
// 올라운더가 세분 유형보다 먼저
assert.equal(playerType(ax({ offense: 70, defense: 65, rebound: 80, shooting: 61, playmaking: 90, efficiency: 60 }), axisWeights("C"), "C").label, "올라운더");
// 라벨은 lib/glossary PLAYER_TYPES 한 곳에서 읽는다: 모든 키가 판정 결과로 나올 수 있고, 라벨이 표와 같다
{
  const seen = new Map<string, string>();
  const samples: [Partial<Record<string, number | null>>, Position | null][] = [
    [{ offense: 70, defense: 65, rebound: 80, shooting: 61, playmaking: 90, efficiency: 60 }, null],
    [{ playmaking: 75 }, "C"],
    [{ shooting: 75 }, "C"],
    [{ defense: 85, shooting: 40 }, "G"],
    [{ rebound: 75 }, "G"],
    [{ offense: 10 }, null],
    [{ offense: 95 }, null],
    [{ defense: 90 }, null],
    [{ rebound: 90 }, null],
    [{ shooting: 90 }, null],
    [{ playmaking: 90 }, null],
    [{ offense: 10, efficiency: 88 }, null],
  ];
  for (const [o, pos] of samples) {
    const t = playerType(ax(o), axisWeights(pos), pos);
    seen.set(t.key, t.label);
  }
  const t0 = playerType({});
  seen.set(t0.key, t0.label);
  assert.equal(seen.size, PLAYER_TYPES.length);
  for (const d of PLAYER_TYPES) assert.equal(seen.get(d.key), d.label);
  // 문턱 경계: 6축 모두 정확히 60 → 올라운더, 최고 축 정확히 40 → 롤 플레이어 아님
  assert.equal(playerType({ offense: TYPE_ALLROUNDER_MIN, defense: 60, rebound: 60, shooting: 60, playmaking: 60, efficiency: 60 }).key, "allRounder");
  assert.equal(playerType({ offense: TYPE_ROLE_MAX, defense: 10, rebound: 10, shooting: 10, playmaking: 10, efficiency: 10 }).key, "scorer");
  assert.equal(playerType({ offense: 39.9, defense: 10, rebound: 10, shooting: 10, playmaking: 10, efficiency: 10 }).key, "role");
}

console.log("metrics: 모든 검사 통과");

// 표본 기준 프리셋: 첫 번째가 기본값 (레이더·순위표 공용)
assert.equal(QUALIFY_PRESETS[0], DEFAULT_QUALIFY);
assert.equal(qualifyLabel(DEFAULT_QUALIFY), "10경기·100분 이상");
assert.equal(qualifyShort(DEFAULT_QUALIFY), "10경기·100분+");
console.log("metrics: 표본 프리셋 검사 통과");

// 상위 N% 표기
assert.equal(topShareLabel(99.5), "상위 1%");
assert.equal(topShareLabel(95), "상위 5%");
assert.equal(topShareLabel(80.2), "상위 20%");
assert.equal(topShareLabel(null), null);

// ── 표준식 USG%·AST%·REB% (KBL 이 주지 않은 시즌용, computeTeamShareStats) ──
{
  const { computeTeamShareStats } = await import("../lib/metrics");
  const mkp = (teamCode: string, minutes: number, o: Partial<{ fga: number; fgm: number; fta: number; tov: number; oreb: number; dreb: number; ast: number }>) => {
    const v = { fga: 0, fgm: 0, fta: 0, tov: 0, oreb: 0, dreb: 0, ast: 0, ...o };
    return { teamCode, minutes, ...v, reb: v.oreb + v.dreb };
  };
  // 팀 A 2명(각 200분 → 팀 400분, 팀 출전/5 = 80), 팀 B 1명 400분
  const ps = [
    mkp("A", 200, { fga: 100, fgm: 50, fta: 50, tov: 28, oreb: 20, dreb: 40, ast: 30 }),
    mkp("A", 200, { fga: 100, fgm: 40, fta: 0, tov: 0, oreb: 0, dreb: 20 }),
    mkp("B", 400, { fga: 150, fgm: 60, fta: 0, tov: 0, oreb: 30, dreb: 90 }),
    mkp("B", 0, {}),
  ];
  const [a1, a2, , b0] = computeTeamShareStats(ps);
  // USG: (100 + 22 + 28) × 80 ÷ (200 × (200 + 22 + 28)) × 100 = 24
  close(a1.usgPct, 24);
  // AST: 30 ÷ ((200/80) × 90 − 50) × 100 = 30 ÷ 175 × 100
  close(a1.astPct, (30 / 175) * 100);
  // REB: 60 × 80 ÷ (200 × (팀 80 + 상대 120)) × 100 = 12 (상대 = 팀 B 합 120 ÷ 400분 × 400분)
  close(a1.rebPct, 12);
  // OREB: 20 × 80 ÷ (200 × (팀 OREB 20 + 상대 DREB 90)) × 100
  close(a1.orebPct, (20 * 80 * 100) / (200 * 110));
  assert.equal(a2.astPct, 0);
  assert.deepEqual(b0, { usgPct: 0, astPct: 0, rebPct: 0, orebPct: 0, drebPct: 0 }); // 출전 0분
}
