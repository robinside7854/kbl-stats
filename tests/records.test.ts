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
  filterRecordList,
  recordBarShare,
  recordFilterChips,
  DEFAULT_RECORD_FILTERS,
  type RecordListItem,
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

// 필터 뒤 순위 다시 매기기 (서버 순서는 그대로)
const it = (id: string, num: number, origin: "domestic" | "foreign", active: boolean): RecordListItem => ({ rank: 0, id, num, origin, active, value: String(num), unit: "점", sub: "" });
const list = [it("f1", 50, "foreign", false), it("d1", 40, "domestic", false), it("d2", 40, "domestic", true), it("d3", 30, "domestic", true)];
assert.deepEqual(filterRecordList(list, "all", false).map((r) => [r.id, r.rank]), [["f1", 1], ["d1", 2], ["d2", 2], ["d3", 4]]);
assert.deepEqual(filterRecordList(list, "domestic", false).map((r) => [r.id, r.rank]), [["d1", 1], ["d2", 1], ["d3", 3]]);
assert.deepEqual(filterRecordList(list, "domestic", true).map((r) => [r.id, r.rank]), [["d2", 1], ["d3", 2]]);
assert.deepEqual(filterRecordList(list, "foreign", true), []);
assert.equal(filterRecordList(list, "all", false, 1).length, 1);

// PC 막대 길이 (1위 대비)
assert.equal(recordBarShare(50, 100), 0.5);
assert.equal(recordBarShare(120, 100), 1);
assert.equal(recordBarShare(10, 0), 0);
assert.equal(recordBarShare(-1, 10), 0);

// 필터 요약 칩 (기본값이 아닌 것만, 경기당은 부문에 단위가 있을 때만)
assert.deepEqual(recordFilterChips(DEFAULT_RECORD_FILTERS, true), []);
assert.deepEqual(
  recordFilterChips({ kind: "playoff", mode: "perGame", origin: "domestic", activeOnly: true }, true).map((c) => c.label),
  ["플레이오프", "경기당", "국내", "현역만"],
);
assert.deepEqual(recordFilterChips({ ...DEFAULT_RECORD_FILTERS, mode: "perGame" }, false), []);

console.log("records: 통과");

// 역대 기록 목록 나눠 받기 (2026-10-12): 키·파일 이름 왕복, 목록 하나만 담기
{
  const { pickRecordList, recordListSlug, recordListKeyFromSlug, recordListUrl, gameHighListKey, seasonBestListKey } = await import("../lib/records");
  assert.equal(gameHighListKey("regular", "pts"), "regular:pts");
  assert.equal(seasonBestListKey("playoff", "doubleDoubles", "perGame"), "playoff:doubleDoubles:perGame");
  for (const k of ["regular:pts", "playoff:doubleDoubles:perGame", "finals:tpm:total"]) {
    assert.equal(recordListKeyFromSlug(`${recordListSlug(k)}.json`), k);
  }
  assert.equal(recordListUrl("season", "regular:points:total"), "/records/data/season/regular_points_total.json");
  const item = (id: string, num: number) => ({ rank: 1, id, num, origin: "domestic" as const, active: false, value: String(num), unit: "점", sub: "", note: null, gameHref: null });
  const person = (id: string) => ({ nameKo: id, photoUrl: null, teamShort: "", color: "#000" }) as never;
  const data = { people: { a: person("a"), b: person("b"), c: person("c") }, lists: { x: [item("a", 3), item("b", 2)], y: [item("c", 1)] } };
  const picked = pickRecordList(data, "x");
  assert.deepEqual(Object.keys(picked.lists), ["x"]);
  assert.deepEqual(Object.keys(picked.people).sort(), ["a", "b"]);
  assert.deepEqual(pickRecordList(data, "없음"), { people: {}, lists: { 없음: [] } });
  console.log("records: 목록 나눠 받기 통과");
}

// ── 프로필 탭 (2026-10-30): 키·몸무게·나이·시즌·구단 + 키 대비 기록 ──
import {
  ageInDays, attachRebResiduals, bmiOf, formatProfileRank, franchiseRootOf, linearFit, profileRankSub, profileRankValue, rankProfile,
  seasonMinTpa, seasonOpeningDate, teamPathOf, yearsOf, type ProfileRankInput,
} from "../lib/profile-ranks";
{
  assert.equal(seasonOpeningDate("2025-2026"), "2025-10-01");
  assert.equal(seasonOpeningDate("1997"), "1997-02-01");
  assert.equal(seasonOpeningDate("엉뚱"), null);
  assert.equal(yearsOf(ageInDays("1985-08-05", "2026-10-01")!), 41);
  assert.equal(yearsOf(ageInDays("1985-10-02", "2026-10-01")!), 40, "생일 전날이면 한 살 적게");
  assert.equal(ageInDays("2030-01-01", "2026-10-01"), null);
  assert.equal(bmiOf(199, 118), 29.8);
  assert.equal(bmiOf(null, 118), null);
  // 매각 구단은 한 팀: SBS(40) → KT&G(70)
  const succ = { "40": "70", "45": "60" };
  assert.equal(franchiseRootOf("40", succ), "70");
  assert.equal(franchiseRootOf("55", succ), "55");
  const path = teamPathOf(["40", "70", "55", "70", "45"], succ);
  assert.deepEqual(path, { stints: [0, 2, 3, 4], teams: 3 }, "같은 구단으로 돌아오면 칸은 새로, 구단 수는 그대로");
  assert.equal(seasonMinTpa(54), 32);
  assert.equal(seasonMinTpa(8), 10);
  const fit = linearFit([{ x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 }])!;
  assert.ok(Math.abs(fit.a - 1) < 1e-9 && Math.abs(fit.b - 2) < 1e-9);
  assert.equal(linearFit([{ x: 1, y: 1 }, { x: 1, y: 2 }]), null);

  const mk = (id: string, h: number | null, reb: number, o: "domestic" | "foreign" = "domestic", extra: Partial<ProfileRankInput> = {}): ProfileRankInput => ({
    id, origin: o, heightCm: h, weightKg: 90, birthday: "1995-01-01", oldOn: "2025-10-01", youngOn: "2025-10-01",
    seasons: 3, teams: 1, teamPath: ["SK"], positionLabel: "가드", teamShort: "SK", span: "23-26",
    stat: { games: 10, reb, blk: 2, tpm: 20, tpa: 50 }, minTpa: 32, ...extra,
  });
  const pool = attachRebResiduals([mk("a", 180, 30), mk("b", 190, 50), mk("c", 200, 70), mk("d", 185, 60), mk("e", 195, 40), mk("f", 205, 150, "foreign")]);
  // 국내 다섯 명 직선 위의 d(185cm 경기당 6개)가 같은 키 평균보다 많다 / 외국인은 한 명뿐이라 셈하지 않음
  const ranked = rankProfile(pool, "rebOverHeight");
  assert.equal(ranked[0].id, "d");
  assert.ok(!ranked.some((r) => r.id === "f"));
  // 단신(185cm 이하)·장신(200cm 이상)
  assert.deepEqual(rankProfile(pool, "smallReb").map((r) => r.id), ["d", "a"]);
  assert.deepEqual(rankProfile(pool, "bigTp").map((r) => r.id).sort(), ["c", "f"]);
  assert.equal(profileRankValue(mk("g", 205, 10, "domestic", { stat: { games: 10, reb: 10, blk: 0, tpm: 5, tpa: 20 } }), "bigTp"), null, "시도가 적으면 빠짐");
  // 키 작은 순: 작은 쪽이 위, 같은 키는 같은 순위 재료(num 같음)
  const short = rankProfile([mk("x", 180, 1), mk("y", 175, 1), mk("z", 175, 1, "domestic", { seasons: 9 }), mk("n", null, 1)], "short");
  assert.deepEqual(short.map((r) => r.id), ["z", "y", "x"]);
  assert.equal(short[0].num, short[1].num);
  // 최연소: 생일이 늦을수록 위
  const young = rankProfile([mk("p", 190, 1, "domestic", { birthday: "2006-11-01" }), mk("q", 190, 1, "domestic", { birthday: "2007-05-03" })], "young");
  assert.equal(young[0].id, "q");
  assert.equal(formatProfileRank(young[0], "young", young[0].value).value, "18");
  assert.equal(formatProfileRank(mk("r", 200, 1), "rebOverHeight", -0.04).value, "0.0");
  assert.equal(formatProfileRank(mk("r", 200, 1), "rebOverHeight", -1.26).value, "-1.3");
  assert.equal(formatProfileRank(mk("r", 200, 1), "rebOverHeight", 9.06).value, "+9.1");
  assert.equal(profileRankSub(mk("s", 182, 38), "smallReb"), "가드 · SK · 182cm · 10경기");
  assert.equal(profileRankSub(mk("t", 182, 1, "domestic", { teamPath: ["KCC", "SK"] }), "teams"), "KCC → SK");
  console.log("records: 프로필 순위 통과");
}
