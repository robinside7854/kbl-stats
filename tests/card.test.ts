// 플레이어 카드 메인 스탯·시즌 순위 검증 (lib/metrics.ts CARD_STATS 등). 실행: npm run test:card
import assert from "node:assert/strict";
import {
  buildCardStatPools,
  attemptsNote,
  CARD_STATS,
  cardStats,
  cardStatValue,
  competitionRank,
  DEFAULT_QUALIFY,
  meetsAttempts,
  rankTier,
  type CardStatInput,
  type CardStatKey,
} from "../lib/metrics";
import { mixHex } from "../lib/images";

const mk = (o: Partial<CardStatInput> = {}): CardStatInput => ({
  games: 20, minutes: 400,
  points: 200, reb: 100, ast: 50, stl: 10, blk: 5, tov: 40,
  fgPct: 45, tpPct: 35, ftPct: 75,
  fga: 160, tpa: 60, fta: 40,
  ...o,
});
const def = (k: CardStatKey) => CARD_STATS.find((d) => d.key === k)!;
const byKey = (entries: ReturnType<typeof cardStats>) => Object.fromEntries(entries.map((e) => [e.def.key, e]));

// 9개 스탯, 격자 순서 고정
assert.deepEqual(CARD_STATS.map((d) => d.key), ["points", "reb", "ast", "stl", "blk", "tov", "fgPct", "tpPct", "ftPct"]);

// 값: 누적은 경기당, 성공률은 그대로
assert.equal(cardStatValue(mk(), def("points")), 10);
assert.equal(cardStatValue(mk(), def("tov")), 2);
assert.equal(cardStatValue(mk(), def("fgPct")), 45);
assert.equal(cardStatValue(mk({ games: 0 }), def("points")), 0);

// 경쟁 순위: 동점은 같은 순위, 다음 순위는 건너뜀 (1, 2, 2, 4)
const pool = [30, 25, 25, 20];
assert.deepEqual(pool.map((v) => competitionRank(v, pool, "high")), [1, 2, 2, 4]);
// 턴오버처럼 적을수록 좋은 스탯은 오름차순 (20 이 1위)
assert.deepEqual(pool.map((v) => competitionRank(v, pool, "low")), [4, 2, 2, 1]);
assert.equal(competitionRank(10, [NaN, 5], "high"), 1); // 숫자가 아닌 값은 무시

// 시도 기준: 야투 경기당 4회
assert.equal(meetsAttempts(mk({ fga: 80 }), def("fgPct")), true); // 4.0
assert.equal(meetsAttempts(mk({ fga: 79 }), def("fgPct")), false);
assert.equal(meetsAttempts(mk({ fga: 0 }), def("points")), true); // 시도 기준 없는 스탯
assert.equal(meetsAttempts(mk({ games: 0, fga: 0 }), def("fgPct")), false);

// 시즌 순위: 표본 기준 충족 선수 집단
const a = mk({ points: 400, tov: 20, fgPct: 50 });           // 경기당 20점, 턴오버 1.0
const b = mk({ points: 300, tov: 60, fgPct: 60 });           // 15점, 턴오버 3.0
const c = mk({ points: 300, tov: 40, fgPct: 99, fga: 10 });  // 15점(b와 동점), 야투 시도 부족
const d = mk({ games: 5, minutes: 50, points: 500, tov: 0 }); // 표본 미달 (경기당 100점이지만 집단에서 빠짐)
const players = [a, b, c, d];
const pools = buildCardStatPools(players, DEFAULT_QUALIFY);
assert.deepEqual(pools.points, [20, 15, 15]); // d 제외
assert.deepEqual(pools.fgPct, [50, 60]); // c 는 시도 부족으로 성공률 집단에서 제외

const ra = byKey(cardStats(a, pools, DEFAULT_QUALIFY));
const rb = byKey(cardStats(b, pools, DEFAULT_QUALIFY));
const rc = byKey(cardStats(c, pools, DEFAULT_QUALIFY));
const rd = byKey(cardStats(d, pools, DEFAULT_QUALIFY));
assert.deepEqual(ra.points.rank, { rank: 1, of: 3, reason: null });
assert.deepEqual(rb.points.rank, { rank: 2, of: 3, reason: null }); // 동점
assert.deepEqual(rc.points.rank, { rank: 2, of: 3, reason: null }); // 동점
// 턴오버 오름차순: 가장 적은 a 가 1위, 가장 많은 b 가 3위
assert.equal(ra.tov.rank.rank, 1);
assert.equal(rc.tov.rank.rank, 2);
assert.equal(rb.tov.rank.rank, 3);
// 성공률: 시도 부족이면 순위 대신 attempts
assert.equal(rb.fgPct.rank.rank, 1);
assert.equal(ra.fgPct.rank.rank, 2);
assert.deepEqual(rc.fgPct.rank, { rank: null, of: 2, reason: "attempts" });
// 표본 미달이면 모든 스탯이 sample (값은 그대로 보여 준다)
assert.ok(Object.values(rd).every((e) => e.rank.rank === null && e.rank.reason === "sample"));
assert.equal(rd.points.value, 100);

assert.equal(attemptsNote(), "경기당 야투 4·3점 1.5·자유투 1회");

// 강조 단계
assert.deepEqual([1, 2, 3, 4, 10, 11, null].map(rankTier), ["gold", "silver", "bronze", "top10", "top10", null, null]);

// 색 섞기 (카드 배경 그라데이션)
assert.equal(mixHex("#ffffff", "#000000", 0.5), "#808080");
assert.equal(mixHex("#E4002B", "#000000", 0), "#e4002b");
assert.equal(mixHex("#E4002B", "#000000", 1), "#000000");
assert.equal(mixHex("#fff", "#000", 1), "#000000"); // 3자리 hex

console.log("card: 카드 스탯·순위 검사 통과");
