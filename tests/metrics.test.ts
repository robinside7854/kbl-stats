// lib/metrics.ts 간단 검증. 실행: npm run test:metrics
import assert from "node:assert/strict";
import {
  buildReference,
  DEFAULT_QUALIFY,
  isQualified,
  perGame,
  percentileRank,
  playerType,
  radarPercentiles,
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

// 비교 집단은 표본 충족 선수만
const players = [
  { games: 30, minutes: 900, usgPct: 30, tsPct: 50, astPct: 10, rebPct: 5, pie: 10 },
  { games: 30, minutes: 900, usgPct: 20, tsPct: 60, astPct: 30, rebPct: 8, pie: 12 },
  { games: 2, minutes: 10, usgPct: 99, tsPct: 99, astPct: 99, rebPct: 99, pie: 99 }, // 제외
];
const r = buildReference(players, DEFAULT_QUALIFY);
assert.deepEqual(r.usgPct, [30, 20]);
const pct = radarPercentiles(players[0], r);
close(pct.usgPct, 75);
close(pct.tsPct, 25);

// 유형 라벨
assert.equal(playerType({ usgPct: 70, tsPct: 65, astPct: 80, rebPct: 61, pie: 90 }).label, "올라운더");
assert.equal(playerType({ usgPct: 10, tsPct: 20, astPct: 30, rebPct: 39, pie: 5 }).label, "궂은일 담당 롤 플레이어");
assert.equal(playerType({ usgPct: 95, tsPct: 20, astPct: 30, rebPct: 39, pie: 5 }).label, "볼 핸들러형 득점원");
assert.equal(playerType({ usgPct: 50, tsPct: 20, astPct: 30, rebPct: 90, pie: 5 }).label, "리바운더");
assert.equal(playerType({ usgPct: 80, tsPct: 80, astPct: 30, rebPct: 9, pie: 5 }).axis, "usgPct"); // 동점 → 앞 축
assert.equal(playerType({ usgPct: null, tsPct: null, astPct: null, rebPct: null, pie: null }).label, "분석 불가");

console.log("metrics: 모든 검사 통과");
