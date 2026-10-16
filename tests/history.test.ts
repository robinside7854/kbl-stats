// 기록 메뉴 리그 변화·드래프트·외국 선수 명예의 전당 규칙 검증 (2026-10-16).
// 실행: npx tsx tests/history.test.ts
import assert from "node:assert/strict";
import { formatTrendValue, LEAGUE_TREND_METRICS, leagueTrendRow, teamGamesOf, trendTakeaway, type LeagueTrendRow, type TrendPlayerLine } from "../lib/trends";
import { draftClassHonors, draftOrder, draftYearFromParam, draftYearHref, draftYears, hasDuplicatePicks, pickLabel, pickShort, type DraftPick } from "../lib/draft";
import { hallReasons, honorChips, majorAwardCount, rankForeignSeasons, sortHall, type HallSortable } from "../lib/hall";
import type { PlayerAward } from "../lib/types";

// ── 리그 변화 ──
// 팀 경기 = 끝난 경기 × 2, 목록이 없으면 출전 시간 ÷ 200
assert.equal(teamGamesOf(270, 0), 540);
assert.equal(teamGamesOf(null, 108000), 540);
assert.equal(teamGamesOf(0, 2000), 10);

const pl = (o: Partial<TrendPlayerLine>): TrendPlayerLine => ({ points: 0, fga: 0, tpm: 0, tpa: 0, fta: 0, minutes: 0, foreign: false, heightCm: null, ...o });
const row = leagueTrendRow({
  seasonCode: 47,
  seasonLabel: "2025-2026",
  endedGames: 2,
  ongoing: false,
  players: [
    pl({ points: 200, fga: 100, tpa: 40, tpm: 14, fta: 20, minutes: 300, foreign: true, heightCm: 200 }),
    pl({ points: 120, fga: 100, tpa: 20, tpm: 6, fta: 30, minutes: 100, heightCm: 180 }),
  ],
})!;
assert.equal(row.short, "25-26");
assert.equal(row.teamGames, 4);
assert.equal(row.values.teamPoints, 80); // 320 ÷ 4
assert.equal(row.values.threeRate, 30); // 60 ÷ 200
assert.equal(row.values.threePct, (20 / 60) * 100);
assert.equal(row.values.ftRate, 25); // 50 ÷ 200
assert.equal(row.values.foreignShare, 62.5); // 200 ÷ 320
assert.equal(row.values.height, 195); // (200×300 + 180×100) ÷ 400
// 선수가 없으면 null, 키가 있는 출전 시간이 절반 미만이면 키는 null
assert.equal(leagueTrendRow({ seasonCode: 1, seasonLabel: "1997", endedGames: 0, ongoing: false, players: [] }), null);
assert.equal(
  leagueTrendRow({ seasonCode: 1, seasonLabel: "1997", endedGames: 1, ongoing: false, players: [pl({ minutes: 10, heightCm: 190 }), pl({ minutes: 30 })] })!.values.height,
  null,
);
assert.equal(formatTrendValue(39.24, LEAGUE_TREND_METRICS[1]), "39.2%");
assert.equal(formatTrendValue(null, LEAGUE_TREND_METRICS[0]), "–");

// 요약: 첫 시즌 → 마지막 끝난 시즌 (진행 중 제외), 가운데 극값이 끝점보다 2% 넘게 차이 나면 덧붙임
const tr = (short: string, v: number, ongoing = false): LeagueTrendRow => ({
  seasonCode: 0, short, ongoing, teamGames: 540,
  values: { teamPoints: v, threeRate: v, threePct: v, ftRate: v, foreignShare: v, height: v },
});
assert.equal(trendTakeaway([tr("97-98", 18), tr("10-11", 25), tr("25-26", 39), tr("26-27", 50, true)], "threeRate"), "3점 시도 비중 97-98 18.0% → 25-26 39.0%");
assert.equal(trendTakeaway([tr("97", 95.5), tr("13-14", 73.4), tr("25-26", 78.1)], "teamPoints"), "경기당 팀 득점 97 95.5점 → 25-26 78.1점 · 최저 13-14 73.4점");
assert.equal(trendTakeaway([tr("97", 30), tr("07-08", 40), tr("25-26", 32)], "ftRate"), "자유투 시도율 97 30.0% → 25-26 32.0% · 최고 07-08 40.0%");
// 작은 출렁임(2% 이하)은 말하지 않는다
assert.equal(trendTakeaway([tr("97", 190), tr("05-06", 193.1), tr("25-26", 193)], "height"), "평균 키 (출전 시간 가중) 97 190.0cm → 25-26 193.0cm");
assert.equal(trendTakeaway([tr("26-27", 1, true)], "height"), null);
assert.equal(trendTakeaway([tr("97", 30), tr("25-26", 40)], "threePct", false), "97 30.0% → 25-26 40.0%");
console.log("history: 리그 변화 통과");

// ── 드래프트 ──
const dp = (id: string, round: number | null, pick: number | null, points: number, games = 100): DraftPick => ({ id, round, pick, games, points, reb: 0, ast: 0, stl: 0, blk: 0 });
assert.equal(pickLabel(1, 3), "1라운드 3순위");
assert.equal(pickLabel(null, null), "순위 미상");
assert.equal(pickShort(2, 6), "2-6");
assert.equal(pickShort(null, 1), "–");
assert.deepEqual(draftOrder([dp("c", 2, 1, 0), dp("x", null, null, 0), dp("a", 1, 2, 0), dp("b", 1, 1, 0)]).map((r) => r.id), ["b", "a", "c", "x"]);
// 그 해 수상 합계: 우승 → 정규리그 MVP → 챔프전 MVP … 받은 것만, 같은 시즌 중복은 한 번, 많이 받은 선수 먼저
const honors = draftClassHonors([
  { id: "a", nameKo: "가", championships: [11, 13, 13], awards: [{ key: "mvp", seasonCode: 11 }, { key: "finalsMvp", seasonCode: 13 }, { key: "rookie", seasonCode: 9 }] },
  { id: "b", nameKo: "나", championships: [11], awards: [{ key: "foreignMvp", seasonCode: 11 }, { key: "allStarMvp", seasonCode: 11 }] },
  { id: "c", nameKo: "다" },
]);
assert.deepEqual(honors.map((h) => [h.key, h.times, h.players.map((p) => `${p.nameKo}${p.times}`).join(",")]), [
  ["champion", 3, "가2,나1"],
  ["mvp", 1, "가1"],
  ["finalsMvp", 1, "가1"],
  ["rookie", 1, "가1"],
]);
assert.deepEqual(draftClassHonors([{ id: "c", nameKo: "다" }]), []);
assert.equal(hasDuplicatePicks([dp("a", 1, 1, 0), dp("b", 1, 1, 0)]), true);
assert.equal(hasDuplicatePicks([dp("a", 1, 1, 0), dp("b", 1, 2, 0), dp("c", null, null, 0), dp("d", null, null, 0)]), false);
assert.deepEqual(draftYears([{ draft: { year: 2015, round: 1, pick: 1 } }, { draft: null }, { draft: { year: 2020, round: 1, pick: 1 } }, { draft: { year: 2015, round: 1, pick: 2 } }]), [2020, 2015]);
assert.equal(draftYearFromParam("2015", [2020, 2015]), 2015);
assert.equal(draftYearFromParam("1990", [2020, 2015]), 2020);
assert.equal(draftYearFromParam(null, []), null);
assert.equal(draftYearHref(2015), "/records/draft?year=2015");
console.log("history: 드래프트 통과");

// ── 외국 선수 명예의 전당 ──
const aw = (key: PlayerAward["key"], ...codes: number[]): PlayerAward[] => codes.map((seasonCode) => ({ key, seasonCode }));
assert.deepEqual(hallReasons({ id: "a", seasons: 1, games: 50, points: 1000, awards: aw("foreignMvp", 11) }), ["major"]);
assert.deepEqual(hallReasons({ id: "b", seasons: 3, games: 150, points: 3000, awards: aw("best5", 11) }), []); // 베스트5 1회는 부족
assert.deepEqual(hallReasons({ id: "c", seasons: 3, games: 150, points: 3000, awards: aw("best5", 11, 13) }), ["best5"]);
assert.deepEqual(hallReasons({ id: "d", seasons: 5, games: 250, points: 5000, awards: [] }), ["long"]);
assert.deepEqual(hallReasons({ id: "e", seasons: 4, games: 250, points: 9000, awards: [] }), []); // 5시즌 미만
// 같은 시즌 중복 수상은 한 번
assert.equal(majorAwardCount([...aw("foreignMvp", 11, 11), ...aw("finalsMvp", 11), ...aw("best5", 11)]), 2);

const hm = (id: string, points: number, games: number, awards: PlayerAward[] = [], championships: number[] = []): HallSortable => ({ id, nameKo: id, points, games, awards, championships });
const members = [hm("가", 10000, 600), hm("나", 7000, 300, aw("foreignMvp", 1, 3, 5)), hm("다", 3000, 100, aw("finalsMvp", 2), [2, 4])];
assert.deepEqual(sortHall(members, "points").map((m) => m.id), ["가", "나", "다"]);
assert.deepEqual(sortHall(members, "awards").map((m) => m.id), ["나", "다", "가"]);
assert.deepEqual(sortHall(members, "ppg").map((m) => m.id), ["다", "나", "가"]);
assert.equal(members[0].id, "가"); // 원본 그대로

assert.deepEqual(
  honorChips([...aw("foreignMvp", 11, 13), ...aw("best5", 11), ...aw("defense5", 11)], [11, 13]).map((c) => [c.label, c.gold]),
  [["우승 2", true], ["외국선수 MVP 2", true], ["베스트5", false]],
);
assert.deepEqual(honorChips(undefined, undefined), []);

// 한 시즌 순위: 자격 있는 줄만, 경기당 득+리+어, 같은 값 = 같은 순위
const fl = (id: string, games: number, points: number, ok = true) => ({ id, seasonCode: 1, games, points, reb: 0, ast: 0, ok });
const fs = rankForeignSeasons([fl("a", 10, 300), fl("b", 20, 600), fl("c", 10, 400, false), fl("d", 10, 200)], 2);
assert.deepEqual(fs.map((r) => [r.id, r.rank, r.value]), [["a", 1, 30], ["b", 1, 30]]);
console.log("history: 외국 선수 명예의 전당 통과");
