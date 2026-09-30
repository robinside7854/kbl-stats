// scripts/shots.ts 검증: 월 구간·경기 목록 파싱/거르기·슛 차트 형식·이어받기 (npm run test:shots)
import assert from "node:assert/strict";
import {
  endedRegularGmkeys, isEndedGame, isListFinal, isMatchListResponse, isShotChartResponse, mergeMatchLists,
  monthRange, pendingGames, regularGamesOf, seasonLabelOf, seasonMonthRanges, seasonWindowClosed, shotChartHasLogs,
} from "../scripts/shots";

// ── 월 구간 ──
assert.deepEqual(monthRange(2026, 2), { fromDate: "20260201", toDate: "20260228" });
assert.deepEqual(monthRange(2024, 2), { fromDate: "20240201", toDate: "20240229" });   // 윤년
assert.deepEqual(monthRange(2025, 12), { fromDate: "20251201", toDate: "20251231" });
const r47 = seasonMonthRanges("2025-2026");
assert.equal(r47.length, 10);
assert.deepEqual(r47[0], { fromDate: "20250901", toDate: "20250930" });
assert.deepEqual(r47[9], { fromDate: "20260601", toDate: "20260630" });
assert.equal(seasonMonthRanges("1997").length, 12);                                     // 한 해 시즌
assert.equal(seasonMonthRanges(" 1997 - 1998 ").length, 10);
assert.deepEqual(seasonMonthRanges("2025-2027"), []);                                   // 두 해가 이어지지 않음
assert.deepEqual(seasonMonthRanges("1군시즌"), []);
// 매일 수집: 오늘 뒤에 시작하는 달은 뺀다
assert.equal(seasonMonthRanges("2026-2027", "2026-09-30").length, 1);
assert.equal(seasonMonthRanges("2026-2027", "2026-10-01").length, 2);
assert.equal(seasonMonthRanges("2026-2027", "2026-08-31").length, 0);
assert.equal(seasonMonthRanges("2025-2026", "2026-09-30").length, 10);
assert.equal(seasonWindowClosed("2025-2026", "2026-09-30"), true);
assert.equal(seasonWindowClosed("2025-2026", "2026-06-30"), false);
assert.equal(seasonWindowClosed("2026-2027", "2026-09-30"), false);
console.log("shots: 월 구간 통과");

// ── 경기 목록 ──
const g = (patch: Record<string, unknown>) => ({
  gmkey: "S47G01N1", seasonCode: "47", gameCode: "01", gameNo: 1, gameDate: "20251003",
  tcodeH: "55", tcodeA: "60", scoreH: 80, scoreA: 75, isEnded: true, seasonCategory: "정규", ...patch,
});
const month1 = [g({}), g({ gmkey: "S47G14N1", gameCode: "14" }), g({ gmkey: "S47G01N2", isEnded: "Y" })];
const month2 = [g({ gmkey: "S47G01N3", isEnded: false }), g({ gmkey: "S47G01N2", isEnded: "Y" }), g({ gmkey: "S45G01N9", seasonCode: 45 })];
assert.equal(isMatchListResponse(month1), true);
assert.equal(isMatchListResponse([]), true);                                           // 경기 없는 달
assert.equal(isMatchListResponse(JSON.stringify(month1)), true);                       // 문자열로 감싼 배열
assert.equal(isMatchListResponse({ data: [] }), false);
assert.equal(isMatchListResponse("<html>"), false);
assert.equal(isMatchListResponse(""), false);
assert.equal(isMatchListResponse(null), false);

const merged = mergeMatchLists([month1, [], JSON.stringify(month2)]);
assert.equal(merged.length, 6);
assert.deepEqual(merged[0], month1[0]);                                                // 항목 원본 그대로

const games = regularGamesOf(merged, 47);
assert.deepEqual(games.map((x) => x.gmkey), ["S47G01N1", "S47G01N2", "S47G01N3"]);    // 정규만·중복 제거·다른 시즌 제외
assert.deepEqual(games.map((x) => x.ended), [true, true, false]);
assert.equal(games[0].gameDate, "20251003");
assert.deepEqual(endedRegularGmkeys(merged, 47), ["S47G01N1", "S47G01N2"]);
assert.deepEqual(endedRegularGmkeys(merged, 45), ["S45G01N9"]);
assert.deepEqual(regularGamesOf(null, 47), []);
assert.deepEqual(regularGamesOf([null, 3, { gameCode: "01" }], 47), []);               // gmkey 없음
// seasonCode 가 없으면 gmkey 앞머리로, gameCode 가 숫자 1 이어도 "01"
assert.deepEqual(endedRegularGmkeys([{ gmkey: "S47G01N7", gameCode: 1, isEnded: 1 }], 47), ["S47G01N7"]);

// 끝남 판정
assert.equal(isEndedGame({ isEnded: "N" }), false);
assert.equal(isEndedGame({ isEnded: "1" }), true);
assert.equal(isEndedGame({ isEnded: 0 }), false);
assert.equal(isEndedGame({ gameDate: "20251003" }, "2025-10-04"), true);               // isEnded 없음 → 날짜로
assert.equal(isEndedGame({ gameDate: "20251004" }, "2025-10-04"), false);              // 오늘 경기는 아직
assert.equal(isEndedGame({ gameDate: "20251003" }), false);

// 목록 마감
assert.equal(isListFinal(merged, 47), false);                                         // N3 가 아직
assert.equal(isListFinal(month1, 47), true);
assert.equal(isListFinal([], 47), false);                                             // 경기 0 은 마감 아님(다시 받는다)
console.log("shots: 경기 목록 통과");

// ── 슛 차트 ──
const chart = { shootLog: [{ pcode: "290681", pname: "김선형", ename: "KIM", tcode: "55", logs: [{ q: "Q1", x: 120, y: 200, o: "O", d: "1" }] }], other: 1 };
assert.equal(isShotChartResponse(chart), true);
assert.equal(isShotChartResponse(JSON.stringify(chart)), true);
assert.equal(isShotChartResponse({ shootLog: [] }), true);                             // 형식은 맞음 (빈 차트)
assert.equal(isShotChartResponse({}), false);
assert.equal(isShotChartResponse({ shootLog: "x" }), false);
assert.equal(isShotChartResponse([]), false);
assert.equal(isShotChartResponse("<!doctype html>"), false);
assert.equal(isShotChartResponse(""), false);
assert.equal(shotChartHasLogs(chart), true);
assert.equal(shotChartHasLogs({ shootLog: [] }), false);
assert.equal(shotChartHasLogs({ shootLog: [{ pcode: "1", logs: [] }, { pcode: "2" }] }), false);
assert.equal(shotChartHasLogs({}), false);
console.log("shots: 슛 차트 형식 통과");

// ── 이어받기·라벨 ──
assert.deepEqual(pendingGames(["S47G01N1", "S47G01N2", "S47G01N3"], ["S47G01N2.json", "S47G01N9.json"]), ["S47G01N1", "S47G01N3"]);
assert.deepEqual(pendingGames([], ["a.json"]), []);
const codes = { code: 200, data: [{ seasonCode: 49, seasonName1: "2026-2027", seasonName2: "1군시즌" }] };
assert.equal(seasonLabelOf(49, codes, {}), "2026-2027");
assert.equal(seasonLabelOf(47, codes, { 47: "2025-2026" }), "2025-2026");              // 코드표에 없으면 백업
assert.equal(seasonLabelOf(47, null, {}), null);
console.log("shots: 이어받기·라벨 통과");
