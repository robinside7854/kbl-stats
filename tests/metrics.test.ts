// lib/metrics.ts 간단 검증. 실행: npm run test:metrics
import assert from "node:assert/strict";
import {
  axisSetFor,
  axisValue,
  buildReference,
  coverageFlag,
  DEFAULT_QUALIFY,
  isQualified,
  per40,
  perGame,
  percentileRank,
  playerType,
  radarAxes,
  radarPercentiles,
  seasonCoverage,
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

// 시즌 커버리지: advanced는 USG%·PIE·AST%·REB% 넷 모두 통과해야 true
const cov = (o: Partial<Record<string, number>>) => ({
  usgPct: 1, pie: 1, astPct: 1, rebPct: 1, plusMinus: 1, goodDef: 1, screenAst: 1, deflections: 1, ...o,
});
assert.deepEqual(seasonCoverage([cov({}), cov({})]), { advanced: true, plusMinus: true, goodDef: true, hustle: true });
assert.equal(seasonCoverage([cov({ pie: 0 }), cov({ pie: 0 })]).advanced, false); // PIE만 비어도 false
assert.equal(seasonCoverage([cov({ deflections: 0 }), cov({ deflections: 0 })]).hustle, false);
assert.deepEqual(seasonCoverage([]), { advanced: false, plusMinus: false, goodDef: false, hustle: false });
assert.equal(axisSetFor({ advanced: true }), "modern");
assert.equal(axisSetFor({ advanced: false }), "classic");

// 축 세트
assert.deepEqual([...radarAxes("modern")], ["usgPct", "tsPct", "astPct", "rebPct", "pie"]);
assert.deepEqual([...radarAxes("classic")], ["pts40", "tsPct", "ast40", "reb40", "per"]);

// 비교 집단은 표본 충족 선수만 (modern 세트)
const base = { points: 0, reb: 0, ast: 0, per: 0 };
const players = [
  { ...base, games: 30, minutes: 900, usgPct: 30, tsPct: 50, astPct: 10, rebPct: 5, pie: 10 },
  { ...base, games: 30, minutes: 900, usgPct: 20, tsPct: 60, astPct: 30, rebPct: 8, pie: 12 },
  { ...base, games: 2, minutes: 10, usgPct: 99, tsPct: 99, astPct: 99, rebPct: 99, pie: 99 }, // 제외
];
const r = buildReference(players, DEFAULT_QUALIFY, "modern");
assert.deepEqual(r.usgPct, [30, 20]);
assert.equal(r.pts40, undefined); // 세트 밖 축은 없음
const pct = radarPercentiles(players[0], r, "modern");
close(pct.usgPct!, 75);
close(pct.tsPct!, 25);
assert.equal(pct.per, undefined);

// classic 세트: 40분당 값으로 백분위 (2차 스탯이 0인 옛 시즌 가정)
const old = { usgPct: 0, astPct: 0, rebPct: 0, pie: 0 };
const classicPlayers = [
  // 400분 200점 → 40분당 20점, 40분당 AST 4, REB 8
  { ...old, games: 20, minutes: 400, points: 200, ast: 40, reb: 80, tsPct: 55, per: 20 },
  // 800분 200점 → 40분당 10점, AST 8, REB 4
  { ...old, games: 20, minutes: 800, points: 200, ast: 160, reb: 80, tsPct: 50, per: 12 },
  // 표본 미달 (5경기) → 비교 집단에서 제외
  { ...old, games: 5, minutes: 40, points: 40, ast: 0, reb: 0, tsPct: 70, per: 30 },
];
close(axisValue(classicPlayers[0], "pts40"), 20);
close(axisValue(classicPlayers[1], "ast40"), 8);
assert.equal(axisValue(classicPlayers[0], "per"), 20);
const rc = buildReference(classicPlayers, DEFAULT_QUALIFY, "classic");
assert.deepEqual(rc.pts40, [20, 10]);
assert.deepEqual(rc.reb40, [8, 4]);
assert.equal(rc.usgPct, undefined);
const pc0 = radarPercentiles(classicPlayers[0], rc, "classic");
close(pc0.pts40!, 75); // 2명 중 1위 → (1 + 0.5) / 2
close(pc0.ast40!, 25);
close(pc0.reb40!, 75);
close(pc0.per!, 75);
assert.equal(pc0.usgPct, undefined); // modern 축은 계산하지 않음
const pc2 = radarPercentiles(classicPlayers[2], rc, "classic"); // 표본 미달 선수: 집단에 대어 계산
close(pc2.pts40!, 100); // 40분당 40점 > 집단 전원
close(pc2.ast40!, 0);
assert.equal(playerType(pc0, "classic").label, "득점원"); // 동점(pts40·reb40·per 75) → 앞 축
assert.equal(playerType(pc0, "classic").axis, "pts40");

// 유형 라벨 (modern)
assert.equal(playerType({ usgPct: 70, tsPct: 65, astPct: 80, rebPct: 61, pie: 90 }, "modern").label, "올라운더");
assert.equal(playerType({ usgPct: 10, tsPct: 20, astPct: 30, rebPct: 39, pie: 5 }, "modern").label, "궂은일 담당 롤 플레이어");
assert.equal(playerType({ usgPct: 95, tsPct: 20, astPct: 30, rebPct: 39, pie: 5 }, "modern").label, "볼 핸들러형 득점원");
assert.equal(playerType({ usgPct: 50, tsPct: 20, astPct: 30, rebPct: 90, pie: 5 }, "modern").label, "리바운더");
assert.equal(playerType({ usgPct: 80, tsPct: 80, astPct: 30, rebPct: 9, pie: 5 }, "modern").axis, "usgPct"); // 동점 → 앞 축
assert.equal(playerType({ usgPct: null, tsPct: null, astPct: null, rebPct: null, pie: null }, "modern").label, "분석 불가");

// 유형 라벨 (classic) — 세트 밖 축 값은 무시
assert.equal(playerType({ pts40: 20, tsPct: 30, ast40: 90, reb40: 10, per: 50 }, "classic").label, "플레이메이커");
assert.equal(playerType({ pts40: 20, tsPct: 30, ast40: 10, reb40: 85, per: 50 }, "classic").label, "리바운더");
assert.equal(playerType({ pts40: 20, tsPct: 30, ast40: 10, reb40: 5, per: 88 }, "classic").label, "코트 위 임팩트형");
assert.equal(playerType({ pts40: 95, tsPct: 30, ast40: 10, reb40: 5, per: 50 }, "classic").label, "득점원");
assert.equal(playerType({ pts40: 60, tsPct: 70, ast40: 61, reb40: 80, per: 99 }, "classic").label, "올라운더");
assert.equal(playerType({ pts40: 10, tsPct: 20, ast40: 30, reb40: 39, per: 5 }, "classic").label, "궂은일 담당 롤 플레이어");
assert.equal(playerType({ usgPct: 99, pie: 99, pts40: 10, tsPct: 20, ast40: 30, reb40: 39, per: 5 }, "classic").label, "궂은일 담당 롤 플레이어");
assert.equal(playerType({ usgPct: 90, pie: 90 }, "classic").label, "분석 불가"); // classic 축이 하나도 없음

console.log("metrics: 모든 검사 통과");
