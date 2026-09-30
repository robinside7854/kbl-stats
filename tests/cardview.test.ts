// 선수 탭·선수 상세·비교 탭 공용 계산 검증 (lib/cardview.ts). 실행: npm run test:cardview
import assert from "node:assert/strict";
import { decodeSeasonCards, encodeSeasonCards } from "../lib/cards";
import {
  GRID_PAGE_SIZE,
  gridFilterChips,
  clearGridFilter,
  buildGridEntries,
  buildSeasonCardView,
  cardFootStats,
  compareCardEntries,
  compareHref,
  compareQueryString,
  defaultVsSeason,
  filterGridEntries,
  formatDelta,
  parseCompareQuery,
  parsePlayerQuery,
  parsePlayersQuery,
  parseSlot,
  playerQueryString,
  playersQueryString,
  rankHeading,
  rankPhrase,
  rankShort,
  sortGridEntries,
} from "../lib/cardview";
import { glossaryHref, GLOSSARY, GLOSSARY_ANCHORS, LEADER_COLUMN_GLOSSARY, RADAR_AXIS_GLOSSARY } from "../lib/glossary";
import { TABLE_COLUMNS } from "../lib/leaders";
import { RADAR_AXIS_SETS } from "../lib/metrics";
import { nationalityFromParam, positionFromParam } from "../lib/roster";
import type { CardPlayer, PositionGroup } from "../lib/types";

// ── 가짜 시즌: 가드 3명, 센터 3명, 포지션 모름 1명, 표본 미달 1명 ──
let n = 0;
const mk = (o: Partial<CardPlayer> & { positionGroup: PositionGroup | null }): CardPlayer => {
  n++;
  return {
    id: String(100 + n), nameKo: `선수${n}`, nameEn: `P${n}`, teamName: "서울 SK", teamShort: "SK", teamCode: "55",
    isForeign: false, position: o.positionGroup, nationality: "domestic", photoUrl: null,
    games: 20, minutes: 500, points: 200, reb: 100, ast: 40, stl: 10, blk: 5, tov: 30, fouls: 40,
    fga: 160, tpa: 60, fta: 40, fgPct: 45, tpPct: 33, ftPct: 75,
    per: 12, usgPct: 20, tsPct: 52, astPct: 15, rebPct: 10,
    ...o,
  };
};
const players: CardPlayer[] = [
  mk({ positionGroup: "G", points: 400, ast: 160, per: 20 }), // 101 가드 득점 1위
  mk({ positionGroup: "G", points: 300, ast: 120, per: 16 }), // 102
  mk({ positionGroup: "G", points: 100, ast: 80, per: 9 }), //   103
  mk({ positionGroup: "C", points: 360, reb: 240, per: 22, teamCode: "16", nationality: "foreign", isForeign: true }), // 104
  mk({ positionGroup: "C", points: 340, reb: 200, per: 18, teamCode: "16", nationality: "asia", isForeign: true }), //   105
  mk({ positionGroup: "C", points: 120, reb: 180, per: 10, teamCode: "16" }), // 106
  mk({ positionGroup: null, points: 250, per: 14 }), // 107 포지션 모름
  mk({ positionGroup: "G", games: 3, minutes: 20, points: 90, per: 30 }), // 108 표본 미달
];
const teams = [
  { teamCode: "55", shortName: "SK", logoUrl: null, color: { primary: "#E4002B", secondary: "#000", text: "#fff" } },
  { teamCode: "16", shortName: "DB", logoUrl: null, color: { primary: "#006633", secondary: "#fff", text: "#fff" } },
];
const coverage = { advanced: true, plusMinus: true, goodDef: true, hustle: true };
const cards = decodeSeasonCards(encodeSeasonCards({ seasonCode: 47, seasonLabel: "2025-2026", coverage, teams }, players));

// ── 카드 한 장: 전체 / 같은 포지션 ──
const all = buildSeasonCardView(cards, "102", "all")!;
assert.equal(all.scope, "all");
assert.equal(all.groupLabel, null);
assert.equal(all.qualifiedCount, 7); // 표본 미달 108 제외
assert.equal(all.team?.shortName, "SK");
assert.equal(all.seasonLabel, "2025-2026");
const pts = (v: typeof all) => v.entry.stats.find((s) => s.def.key === "points")!.rank;
assert.deepEqual(pts(all), { rank: 4, of: 7, reason: null }); // 400, 360, 340, 300
const pos = buildSeasonCardView(cards, "102", "position")!;
assert.equal(pos.scope, "position");
assert.equal(pos.groupLabel, "가드");
assert.equal(pos.qualifiedCount, 3); // 가드 101·102·103 (108 은 표본 미달)
assert.deepEqual(pts(pos), { rank: 2, of: 3, reason: null }); // 가드 중 2위
// 집단을 좁혀도 성공률 시도 기준은 리그 전체 값 그대로
assert.equal(pos.attemptsLabel, all.attemptsLabel);
// 포지션 모르는 선수는 "같은 포지션"을 골라도 전체로
const unknown = buildSeasonCardView(cards, "107", "position")!;
assert.equal(unknown.scope, "all");
assert.equal(unknown.qualifiedCount, 7);
assert.equal(buildSeasonCardView(cards, "999"), null);
assert.equal(rankHeading(null), "시즌 순위");
assert.equal(rankHeading("가드"), "가드 중 순위");
assert.equal(rankPhrase(3, 34, "가드"), "가드 중 3위, 34명 중");
assert.equal(rankPhrase(3, 142, null), "시즌 3위, 142명 중");
// 파울·출전시간 줄 (경기당)
assert.deepEqual(cardFootStats({ games: 20, minutes: 500, fouls: 40 }), { fouls: 2, minutes: 25 });
assert.deepEqual(cardFootStats({ games: 0, minutes: 0, fouls: 0 }), { fouls: 0, minutes: 0 });

// ── 선수 탭 그리드: 종합 등급 → PER, 표본 미달은 맨 뒤 ──
const grid = sortGridEntries(buildGridEntries(cards));
assert.equal(grid[grid.length - 1].player.id, "108"); // PER 30 이지만 표본 미달 → 맨 뒤, 등급 "-"
assert.equal(grid[grid.length - 1].overall, "-");
const order = ["S", "A", "B", "C", "D", "F", "-"];
for (let i = 1; i < grid.length; i++) {
  const [a, b] = [grid[i - 1], grid[i]];
  const d = order.indexOf(a.overall) - order.indexOf(b.overall);
  assert.ok(d < 0 || (d === 0 && a.player.per >= b.player.per), `정렬 ${a.player.id} → ${b.player.id}`);
}
assert.equal(grid.find((e) => e.player.id === "101")!.ppg, 20);
// 필터: 포지션·국적·팀
const ids = (l: typeof grid) => l.map((e) => e.player.id).sort();
assert.deepEqual(ids(filterGridEntries(grid, { position: "C", origin: "all", teamCode: null })), ["104", "105", "106"]);
assert.deepEqual(ids(filterGridEntries(grid, { position: "all", origin: "asia", teamCode: null })), ["105"]);
assert.deepEqual(ids(filterGridEntries(grid, { position: "all", origin: "foreign", teamCode: "16" })), ["104"]);
assert.deepEqual(ids(filterGridEntries(grid, { position: "G", origin: "domestic", teamCode: "16" })), []);
assert.equal(filterGridEntries(grid, { position: "all", origin: "all", teamCode: null }).length, 8);

// ── 비교표: 10개 스탯 + 종합 등급, 턴오버·파울은 낮은 쪽 ──
const va = buildSeasonCardView(cards, "101")!.entry;
const vb = buildSeasonCardView(cards, "104")!.entry;
const rows = compareCardEntries(va, vb);
assert.deepEqual(rows.map((r) => r.key), ["points", "reb", "ast", "stl", "blk", "tov", "fgPct", "tpPct", "ftPct", "fouls", "overall"]);
const row = (k: string) => rows.find((r) => r.key === k)!;
assert.equal(row("points").better, "a"); // 20.0 > 18.0
assert.equal(row("points").aText, "20.0");
assert.equal(row("points").deltaText, "−2.0"); // b − a
assert.equal(row("reb").better, "b");
assert.equal(row("tov").better, "tie");
assert.equal(row("tov").lowerIsBetter, true);
assert.equal(row("fouls").lowerIsBetter, true);
assert.equal(row("fgPct").aText, "45.0%");
assert.equal(row("fgPct").deltaText, "0.0%p");
assert.deepEqual(row("points").aRank, { rank: 1, of: 7, reason: null });
assert.equal(rankShort(row("points").aRank), "1위");
assert.equal(rankShort(row("fouls").aRank), ""); // 파울은 순위 없음
assert.equal(rankShort({ rank: null, of: 3, reason: "sample" }), "표본 미달");
// 파울: 적은 쪽이 낫다
const lowFoul = compareCardEntries(
  buildSeasonCardView(cards, "101")!.entry,
  buildSeasonCardView(decodeSeasonCards(encodeSeasonCards({ seasonCode: 45, seasonLabel: "2024-2025", coverage, teams }, [{ ...players[0], fouls: 20 }])), "101")!.entry,
).find((r) => r.key === "fouls")!;
assert.equal(lowFoul.better, "b");
assert.equal(lowFoul.deltaText, "−1.0");
// 종합 등급: 표본 미달이면 비교하지 않는다
const vsLow = compareCardEntries(va, buildSeasonCardView(cards, "108")!.entry);
assert.equal(vsLow.find((r) => r.key === "overall")!.bText, "표본 미달");
assert.equal(vsLow.find((r) => r.key === "overall")!.better, null);
assert.equal(formatDelta(1.25, false), "+1.3");
assert.equal(formatDelta(-0.04, true), "0.0%p");
assert.equal(formatDelta(null, false), "–");

// ── 비교 탭 주소 ──
assert.deepEqual(parseSlot("291248:47"), { id: "291248", seasonCode: 47 });
for (const bad of ["", "291248", "abc:47", "1:2:3", ":47", "291248:x"]) assert.equal(parseSlot(bad), null, bad);
assert.deepEqual(parseCompareQuery("?a=291248:47&b=255032:13"), {
  a: { id: "291248", seasonCode: 47 },
  b: { id: "255032", seasonCode: 13 },
});
assert.deepEqual(parseCompareQuery("?a=zz"), { a: null, b: null });
assert.equal(compareQueryString({ id: "1", seasonCode: 47 }, null), "?a=1:47");
assert.equal(compareQueryString(null, null), "");
assert.equal(compareHref({ id: "1", seasonCode: 47 }, { id: "1", seasonCode: 45 }), "/compare?a=1:47&b=1:45");

// ── 선수 상세 주소 (시즌 칩·시즌 비교·순위 범위) ──
const played = [35, 37, 39, 47];
assert.deepEqual(parsePlayerQuery("", played), { season: 47, vs: null, scope: "all" });
assert.deepEqual(parsePlayerQuery("?season=37&vs=47&scope=pos", played), { season: 37, vs: 47, scope: "position" });
assert.deepEqual(parsePlayerQuery("?season=13&vs=37", played), { season: 47, vs: 37, scope: "all" }); // 안 뛴 시즌 → 최신
assert.deepEqual(parsePlayerQuery("?season=37&vs=37", played), { season: 37, vs: null, scope: "all" }); // 같은 시즌끼리는 비교 안 함
assert.equal(playerQueryString({ season: 47, vs: null, scope: "all" }, played), "");
assert.equal(playerQueryString({ season: 37, vs: 35, scope: "position" }, played), "?season=37&vs=35&scope=pos");
for (const st of [{ season: 39, vs: 47, scope: "position" as const }, { season: 47, vs: 35, scope: "all" as const }]) {
  assert.deepEqual(parsePlayerQuery(playerQueryString(st, played), played), st); // 왕복
}
assert.equal(defaultVsSeason(played, 47), 39); // 바로 전 시즌
assert.equal(defaultVsSeason(played, 35), 37); // 첫 시즌이면 다음 시즌
assert.equal(defaultVsSeason([47], 47), null); // 한 시즌뿐
assert.equal(defaultVsSeason(played, 99), 47);

// ── 선수 탭 주소 ──
const pctx = { seasons: [45, 47], latest: 47 };
assert.deepEqual(parsePlayersQuery("", pctx), { season: 47, position: "all", origin: "all", teamCode: null });
const ps = { season: 45, position: "G" as const, origin: "asia" as const, teamCode: "55" };
assert.equal(playersQueryString(ps, 47), "?season=45&pos=g&origin=asia&team=55");
assert.deepEqual(parsePlayersQuery(playersQueryString(ps, 47), pctx), ps);
assert.deepEqual(parsePlayersQuery("?season=13&pos=q&origin=x&team=a", pctx), { season: 47, position: "all", origin: "all", teamCode: null });
assert.equal(positionFromParam("c"), "C");
assert.equal(nationalityFromParam("for"), "foreign");

// ── 용어 탭 앵커 ──
assert.equal(glossaryHref("tsPct"), "/glossary#ts");
assert.equal(new Set(Object.values(GLOSSARY_ANCHORS)).size, GLOSSARY.length); // 앵커 중복 없음
for (const k of Object.keys(LEADER_COLUMN_GLOSSARY)) assert.ok((TABLE_COLUMNS as readonly string[]).includes(k), k);
for (const set of Object.values(RADAR_AXIS_SETS)) for (const a of set) assert.ok(RADAR_AXIS_GLOSSARY[a], a); // 모든 레이더 축에 풀이

// ── 선수 탭 필터 칩 · 더 보기 ──
assert.equal(GRID_PAGE_SIZE, 20);
assert.deepEqual(gridFilterChips({ position: "all", origin: "all", teamCode: null }, String), []);
assert.deepEqual(
  gridFilterChips({ position: "C", origin: "foreign", teamCode: "60" }, (c) => `팀${c}`).map((c) => `${c.field}:${c.label}`),
  ["position:센터", "origin:외국", "teamCode:팀60"],
);
assert.deepEqual(clearGridFilter({ season: 47, position: "C" as const, origin: "foreign" as const, teamCode: "60" }, "teamCode"), {
  season: 47, position: "C", origin: "foreign", teamCode: null,
});
assert.equal(clearGridFilter({ position: "C" as const, origin: "foreign" as const, teamCode: "60" }, "origin").origin, "all");

console.log("cardview: 카드 범위·그리드·비교표·주소·용어 앵커·필터 칩 통과");
