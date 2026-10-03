// 역대 기록 하위 탭 순위 규칙 검증 (2026-10-03): 한 경기 최다 · 한 시즌 최다(합계·경기당·최소 경기) · 수상 횟수 · 통산 더블더블.
// 실행: npm run test:records
import assert from "node:assert/strict";
import {
  rankAwardCounts,
  rankCareerTotals,
  rankGameHighs,
  rankSeasonBests,
  seasonBestMinGames,
  sumCareerTotals,
  withRanks,
  type SeasonLineEntry,
} from "../lib/records";

// 같은 값 = 같은 순위
assert.deepEqual(withRanks([5, 4, 4, 2], (x) => x).map((r) => r.rank), [1, 2, 2, 4]);

// 한 경기 최다: 값 큰 순, 같으면 먼저 세운 기록, 날짜 없음은 뒤, 0 은 뺌
const g = rankGameHighs([
  { id: "a", value: 40, date: "2010-01-01" },
  { id: "b", value: 50, date: "2020-01-01" },
  { id: "c", value: 40, date: "2005-01-01" },
  { id: "d", value: 40, date: null },
  { id: "e", value: 0, date: "2001-01-01" },
]);
assert.deepEqual(g.map((r) => [r.id, r.rank]), [["b", 1], ["c", 2], ["a", 2], ["d", 2]]);
// 상위 N 자르기는 순위 기준 (동률이 경계에 걸리면 같이 들어감)
assert.equal(rankGameHighs([{ id: "x", value: 9, date: null }, { id: "y", value: 8, date: null }, { id: "z", value: 8, date: null }], 2).length, 3);

// 최소 경기: 정규시즌 = 최다 출전의 60% 올림, 플옵 5, 챔프전 4
assert.equal(seasonBestMinGames("regular", 54), 33);
assert.equal(seasonBestMinGames("regular", 21), 13);
assert.equal(seasonBestMinGames("playoff", 0), 5);
assert.equal(seasonBestMinGames("finals", 0), 4);

const line = (id: string, seasonCode: number, games: number, points: number, perGameOk = true): SeasonLineEntry => ({
  id, seasonCode, games, perGameOk,
  stats: { points, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0, ftm: 0, doubleDoubles: 0, tripleDoubles: 0 },
});
const lines = [line("a", 10, 54, 1500), line("a", 12, 40, 1200), line("b", 10, 10, 400, false), line("c", 11, 50, 1500)];
// 합계: 같은 선수 여러 시즌 가능, 같은 값이면 경기 적은 쪽이 앞
assert.deepEqual(rankSeasonBests(lines, "points", "total").map((r) => [r.id, r.seasonCode, r.rank]), [["c", 11, 1], ["a", 10, 1], ["a", 12, 3], ["b", 10, 4]]);
// 경기당: 자격 없는 줄(b — 40.0 이지만 10경기) 은 빠진다
const pg = rankSeasonBests(lines, "points", "perGame");
assert.deepEqual(pg.map((r) => r.id), ["c", "a", "a"]);
assert.equal(pg[0].value, 30);
// 경기당이 없는 부문(더블더블)은 경기당을 골라도 합계
const dd = [line("a", 1, 10, 0), line("b", 1, 10, 0)];
dd[0].stats.doubleDoubles = 3;
dd[1].stats.doubleDoubles = 5;
assert.deepEqual(rankSeasonBests(dd, "doubleDoubles", "perGame").map((r) => [r.id, r.value]), [["b", 5], ["a", 3]]);

// 수상: 같은 시즌 중복은 한 번, 같은 횟수면 먼저 받은 선수가 앞, 0 회는 뺌
const aw = rankAwardCounts([
  { id: "late", seasonCodes: [30, 31] },
  { id: "early", seasonCodes: [5, 9, 9] },
  { id: "most", seasonCodes: [1, 2, 3] },
  { id: "none", seasonCodes: [] },
]);
assert.deepEqual(aw.map((r) => [r.id, r.count, r.rank]), [["most", 3, 1], ["early", 2, 2], ["late", 2, 2]]);

// 통산: 더블더블·트리플더블 합계 (경기당 모드여도 합계)
const base = { nameKo: "가", photoUrl: null, origin: "domestic" as const, seasonLabel: "2020-2021", teamShort: "KT", teamColor: "#000", games: 50, minutes: 1000, points: 500, reb: 300, ast: 100, stl: 30, blk: 10, tpm: 20, wins: 25, losses: 25 };
const totals = sumCareerTotals([
  { ...base, id: "p", seasonCode: 37, doubleDoubles: 10, tripleDoubles: 1 },
  { ...base, id: "p", seasonCode: 39, doubleDoubles: 12, tripleDoubles: 0 },
  { ...base, id: "q", seasonCode: 39, doubleDoubles: 30, tripleDoubles: 2 },
]);
const ddRank = rankCareerTotals(totals, "doubleDoubles", "perGame", "all");
assert.deepEqual(ddRank.map((r) => [r.total.id, r.value]), [["q", 30], ["p", 22]]);
assert.deepEqual(rankCareerTotals(totals, "tripleDoubles", "total", "all").map((r) => r.total.id), ["q", "p"]);

console.log("records: 통과");
