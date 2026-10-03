// 2026-10-01 Basketball-Reference·NBA.com 참고 기능 검증: 30분당 · 허슬·슛 구역 부문 · CSV · 리그 1위 표시 · 비슷한 선수 · 역대 통산 순위.
// 실행: npm run test:reference
import assert from "node:assert/strict";
import {
  availableCategories,
  columnOrder,
  formatStat,
  isRankEligible,
  leaderFilterChips,
  leadersCsv,
  madeAttempts,
  parseLeadersQuery,
  rankMap,
  seasonLeaderMarks,
  statTitle,
  statValue,
  zoneThresholds,
  DEFAULT_LEADERS_STATE,
} from "../lib/leaders";
import { attemptThresholds, DEFAULT_QUALIFY } from "../lib/metrics";
import { combinedSimilarity, findSimilar, similarityScore, toAxisVector, type SimilarVector } from "../lib/similar";
import { formatRecord, isActiveCareer, rankCareerTotals, recordValue, RECORDS_MIN_GAMES, sumCareerTotals, type CareerTotal } from "../lib/records";
import { emptyZoneCounts } from "../lib/shots";
import type { LeaderPlayer } from "../lib/types";

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
const mk = (o: Partial<LeaderPlayer> & { id: string }): LeaderPlayer => ({
  nameKo: o.id, nameEn: "", teamCode: "55", teamShort: "SK", isForeign: false, photoUrl: null, wins: 0, losses: 0,
  position: null, positionGroup: null, nationality: null,
  games: 20, minutes: 400, points: 200, reb: 100, ast: 50, stl: 10, blk: 5, tov: 30, fouls: 40,
  fgm: 72, fga: 160, tpm: 20, tpa: 60, ftm: 30, fta: 40,
  fgPct: 45, tpPct: 33.3, ftPct: 75, tsPct: 55, usgPct: 20, per: 15,
  ...o,
});
const zones = (o: Partial<Record<"rim" | "paint" | "mid" | "corner3" | "arc3", [number, number]>>) => {
  const z = emptyZoneCounts();
  for (const [k, [a, m]] of Object.entries(o)) z[k as keyof typeof z] = { a, m };
  return z;
};

// ── 30분당: 시즌 누적 ÷ 출전 분 × 30, 출전시간 자체는 경기당, 비율은 그대로 ──
const p = mk({ id: "a", points: 200, minutes: 400, games: 20 });
close(statValue(p, "points", "per30"), 15);
close(statValue(p, "minutes", "per30"), 20); // 경기당 출전 20분
assert.equal(statValue(p, "fgPct", "per30"), 45);
assert.ok(Number.isNaN(statValue(mk({ id: "z", minutes: 0 }), "points", "per30")));
assert.equal(statTitle("points", "per30"), "30분당 득점");
assert.equal(parseLeadersQuery("?mode=per30", { teamCodes: [] }).mode, "per30");
assert.equal(parseLeadersQuery("?mode=per40", { teamCodes: [] }).mode, "per30"); // 예전 링크
assert.deepEqual(leaderFilterChips({ ...DEFAULT_LEADERS_STATE, mode: "per30" }, (c) => c).map((c) => c.label), ["30분당"]);

// ── 허슬·슛 구역 부문: 값 없는 시즌이면 칩에서 빠진다 ──
const old = [mk({ id: "o1" }), mk({ id: "o2" })];
assert.ok(!availableCategories(old).includes("defl"));
assert.ok(!availableCategories(old).includes("rimPct"));
const now = [
  mk({ id: "n1", deflections: 60, screenAst: 10, zones: zones({ rim: [100, 70], corner3: [40, 18] }) }),
  mk({ id: "n2", deflections: 20, screenAst: 30, zones: zones({ rim: [10, 10], corner3: [2, 2] }) }),
  mk({ id: "n3", deflections: 0, screenAst: 0, zones: null }),
];
const cats = availableCategories(now);
for (const k of ["defl", "screen", "rimPct", "corner3Pct"] as const) assert.ok(cats.includes(k), k);
close(statValue(now[0], "defl", "perGame"), 3);
close(statValue(now[0], "rimPct", "total"), 70);
assert.deepEqual(madeAttempts(now[0], "corner3Pct"), { made: 18, att: 40 });
assert.ok(Number.isNaN(statValue(now[2], "rimPct", "perGame"))); // 슛 데이터 없음
// 표 기본 열에 없는 부문도 맨 앞 열로
assert.equal(columnOrder("defl")[0], "defl");
assert.equal(columnOrder("corner3Pct")[0], "corner3Pct");
// 구역 시도 기준: 표본 충족 + 슛 데이터 있는 선수의 경기당 그 구역 시도 평균. 10/10(100%)은 시도 부족으로 순위 밖
const zt = zoneThresholds(now, DEFAULT_QUALIFY);
close(zt.rim!, (5 + 0.5) / 2);
const t = { ...attemptThresholds(now, DEFAULT_QUALIFY), zones: zt };
assert.ok(isRankEligible(now[0], "rimPct", t));
assert.ok(!isRankEligible(now[1], "rimPct", t));
assert.deepEqual([...rankMap(now, "rimPct", "perGame", t).entries()], [["n1", 1]]);

// ── CSV: BOM·머리글·성공/시도 열, 쉼표는 따옴표로 ──
const csv = leadersCsv([now[0], mk({ id: "쉼,표" })], ["points", "fgPct"], "perGame", new Map([["n1", 1]]), () => "SK");
assert.ok(csv.startsWith("﻿순위,선수,팀,포지션,경기당 득점,야투율,야투% 성공/시도"));
assert.ok(csv.includes("\r\n1,n1,SK,,10.0,45.0,72/160"));
assert.ok(csv.includes(',"쉼,표",SK,'));
assert.equal(formatStat(1234, "points", "total"), "1,234");
assert.ok(!leadersCsv([mk({ id: "x", points: 1234 })], ["points"], "total", new Map(), () => "").includes('"1,234"')); // 숫자 쉼표 제거

// ── 시즌 리그 1위 표시: 기본 표본 기준, 성공률은 시도 기준, 단위별로 다르다 ──
const season = [
  mk({ id: "s1", points: 600, games: 30, minutes: 900 }), // 경기당 20, 30분당 20
  mk({ id: "s2", points: 500, games: 20, minutes: 500 }), // 경기당 25, 30분당 30
  mk({ id: "s3", points: 900, games: 9, minutes: 300 }), // 표본 미달(9경기)
  mk({ id: "s4", fgPct: 80, fga: 10 }), // 야투 시도 부족
];
assert.ok(seasonLeaderMarks(season, "perGame").get("s2")?.includes("points"));
assert.ok(seasonLeaderMarks(season, "total").get("s1")?.includes("points")); // 합계 1위는 s1 (s3 은 표본 미달)
assert.ok(seasonLeaderMarks(season, "per30").get("s2")?.includes("points"));
assert.ok(!(seasonLeaderMarks(season, "perGame").get("s4") ?? []).includes("fgPct"));
assert.ok(!(seasonLeaderMarks(season, "perGame").get("s1") ?? []).includes("tov" as never)); // 턴오버는 표시 안 함

// ── 비슷한 선수 ──
assert.equal(toAxisVector({ offense: 1, defense: 2, rebound: 3, shooting: 4, playmaking: 5, efficiency: 6 })!.length, 6);
assert.equal(toAxisVector({ offense: 1, defense: null, rebound: 3, shooting: 4, playmaking: 5, efficiency: 6 }), null);
close(similarityScore([50, 50, 50, 50, 50, 50], [50, 50, 50, 50, 50, 50]), 100);
close(similarityScore([0, 0, 0, 0, 0, 0], [100, 100, 100, 100, 100, 100]), 0);
const vec = (id: string, seasonCode: number, v: number, pool = "domestic", pos: string | null = "G"): SimilarVector => ({ id, seasonCode, pool, pos, axes: [v, v, v, v, v, v] });
const target = vec("me", 47, 80);
const pool = [target, vec("me", 45, 80), vec("a", 30, 79), vec("a", 31, 60), vec("b", 47, 70), vec("f", 47, 80, "foreign"), vec("c", 40, 80, "domestic", "C"), vec("d", 20, 80, "domestic", null)];
const sim = findSimilar(target, pool, 3);
assert.deepEqual(sim.map((m) => m.id), ["d", "a", "b"]); // 자기 자신·외국인 풀·다른 포지션 제외, 선수마다 최고 시즌 하나, 포지션 모르는 선수는 포함
assert.equal(sim[1].seasonCode, 30);
// 종합 유사도: 레이더가 같아도 역할·공격 유형·종합 평가가 다르면 낮아진다
const base = { id: "x", seasonCode: 47, pool: "domestic", pos: "G", axes: [60, 60, 60, 60, 60, 60] };
close(combinedSimilarity({ ...base, overall: 70, role: "shooter", offense: "three" }, { ...base, id: "y", overall: 70, role: "shooter", offense: "three" }), 100);
close(combinedSimilarity({ ...base, overall: 70, role: "shooter", offense: "three" }, { ...base, id: "y", overall: 70, role: "playmaker", offense: "rim" }), 75);
close(combinedSimilarity({ ...base, overall: 90, role: "shooter" }, { ...base, id: "y", overall: 70, role: "shooter" }), (0.6 * 100 + 0.15 * 80 + 0.15 * 100) / 0.9); // 공격 유형 없으면 빼고 다시 나눔
close(combinedSimilarity(base, { ...base, id: "y" }), 100); // 레이더만 있으면 레이더 유사도
const roleT = { ...vec("me", 47, 80), role: "shooter" };
const roleSim = findSimilar(roleT, [{ ...vec("p", 40, 78), role: "playmaker" }, { ...vec("q", 41, 76), role: "shooter" }], 2);
assert.deepEqual(roleSim.map((m) => [m.id, m.sameRole]), [["q", true], ["p", false]]); // 레이더가 조금 멀어도 같은 유형이 먼저

// ── 역대 통산 순위 ──
const row = (id: string, seasonCode: number, games: number, points: number, origin: "domestic" | "foreign" = "domestic") => ({
  id, nameKo: id, photoUrl: null, origin, seasonCode, seasonLabel: `${2000 + seasonCode}`, teamShort: `T${seasonCode}`, teamColor: "#000",
  games, minutes: games * 30, points, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0, doubleDoubles: 0, tripleDoubles: 0, wins: Math.floor(games / 2), losses: games - Math.floor(games / 2),
});
const totals: CareerTotal[] = sumCareerTotals([row("a", 1, 150, 3000), row("a", 3, 100, 1000), row("b", 2, 54, 1500), row("c", 2, 210, 4000, "foreign")]);
const a = totals.find((x) => x.id === "a")!;
assert.equal(a.games, 250);
assert.equal(a.points, 4000);
assert.equal(a.seasons, 2);
assert.equal(a.firstLabel, "2001");
assert.equal(a.lastLabel, "2003");
assert.equal(a.lastTeam, "T3");
// 현역 = 가장 최근 시즌(여기선 3)에 뛴 선수
assert.equal(a.lastSeasonCode, 3);
assert.equal(isActiveCareer(a, 3), true);
assert.equal(isActiveCareer(totals.find((x) => x.id === "b")!, 3), false);
// 현역만: 시즌 3에 뛴 a 만, 순위는 현역끼리 1위
assert.deepEqual(rankCareerTotals(totals, "points", "total", "all", 3).map((r) => [r.total.id, r.rank]), [["a", 1]]);
close(recordValue(a, "points", "perGame"), 16);
// 합계: a·c 동점(4000) → 같은 순위, 경기 많은 a(250) 먼저
assert.deepEqual(rankCareerTotals(totals, "points", "total", "all").map((r) => [r.total.id, r.rank]), [["a", 1], ["c", 1], ["b", 3]]);
// 경기당: 200경기 미만(b) 제외
assert.equal(RECORDS_MIN_GAMES, 200);
assert.deepEqual(rankCareerTotals(totals, "points", "perGame", "all").map((r) => r.total.id), ["c", "a"]);
assert.deepEqual(rankCareerTotals(totals, "points", "total", "domestic").map((r) => r.total.id), ["a", "b"]);
// 출전 경기 부문은 항상 합계
assert.equal(rankCareerTotals(totals, "games", "perGame", "all")[0].value, 250);
assert.equal(formatRecord(4000, "points", "total"), "4,000");
assert.equal(formatRecord(16, "points", "perGame"), "16.0");

console.log("reference: 30분당·허슬/슛 구역·CSV·리그 1위·비슷한 선수·역대 통산 통과");

// ── 통산 이정표 ──
import { MILESTONE_STEPS, nextMilestones } from "../lib/records";
{
  const me = { ...totals.find((x) => x.id === "a")!, points: 4877, reb: 1490, ast: 120, stl: 5, blk: 0, tpm: 0, games: 250, wins: 199 };
  const others = [me, { ...me, id: "z", points: 6000, reb: 100, ast: 10, wins: 50 }, { ...me, id: "y", points: 4877, reb: 100 }];
  const ms = nextMilestones(me, others);
  // 남은 양 ÷ 간격이 작은 순: 승리 199→200 (1/100), 리바 1490→1500 (10/500), 득점 4877→5000 (123/1000)
  assert.deepEqual(ms.map((m) => [m.key, m.target, m.remaining]), [["wins", 200, 1], ["reb", 1500, 10], ["points", 5000, 123]]);
  assert.equal(ms.find((m) => m.key === "points")!.rank, 2); // 6000 한 명 위, 같은 4877 은 같은 순위
  assert.equal(nextMilestones({ ...me, blk: 0 }, others, 20).some((m) => m.key === "blk"), false); // 0 인 부문 제외
  assert.equal(MILESTONE_STEPS.points, 1000);
}
console.log("reference: 통산 이정표 통과");
