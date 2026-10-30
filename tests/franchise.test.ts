// 팀 페이지 규칙 (lib/franchise) 검증 — npm run test:franchise
import assert from "node:assert/strict";
import {
  bestRegularSeason, buildTenures, franchiseLeaders, franchiseTotals, isLegend, lineageChain, longestTenures, majorAwardSummary, nameSpans, pctText, pickLegends, playoffStage,
  type SeasonPlayerLine, type TeamSeasonRow,
} from "../lib/franchise";

// ── 플레이오프 단계 ──
assert.equal(playoffStage(undefined, false, 1), null); // 못 나감
assert.equal(playoffStage({ series: 1, finals: true }, true, 1), "champion");
assert.equal(playoffStage({ series: 0, finals: true }, false, 2), "runnerUp");
assert.equal(playoffStage({ series: 2, finals: false }, false, 4), "semi"); // 6강 이기고 4강에서 짐
assert.equal(playoffStage({ series: 1, finals: false }, false, 1), "semi"); // 1위는 4강부터
assert.equal(playoffStage({ series: 1, finals: false }, false, 5), "quarter");
assert.equal(playoffStage(undefined, true, null), "champion");

// ── 통산 ──
const row = (p: Partial<TeamSeasonRow>): TeamSeasonRow => ({
  seasonCode: 1, label: "97", name: "팀", shortName: "팀", logoUrl: null, wins: 0, losses: 0, pct: null, rank: null, teamCount: 10,
  regularFirst: false, stage: null, ongoing: false, topScorer: null, ...p,
});
const totals = franchiseTotals([
  row({ seasonCode: 3, wins: 40, losses: 14, regularFirst: true, stage: "champion" }),
  row({ seasonCode: 2, wins: 30, losses: 24, stage: "runnerUp" }),
  row({ seasonCode: 1, wins: 20, losses: 34, stage: "quarter" }),
  row({ seasonCode: 4, wins: 1, losses: 0, ongoing: true }),
]);
assert.deepEqual(totals, { seasons: 4, wins: 91, losses: 72, pct: 91 / 163, regularFirsts: 1, championships: 1, runnerUps: 1, doubles: 1, playoffs: 3 });
assert.equal(pctText(0.6666), ".667");
assert.equal(pctText(1), "1.000");
assert.equal(pctText(null), "–");

// ── 레전드 ──
assert.ok(isLegend(10));
assert.ok(!isLegend(9));
const line = (id: string, seasonCode: number, pts = 100, games = 50): SeasonPlayerLine => ({
  id, name: `선수${id}`, photoUrl: null, seasonCode, games, pts, reb: 10, ast: 5, stl: 1, blk: 1, tpm: 2,
});
const lines: SeasonPlayerLine[] = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => line("a", s, 10)), // 10시즌 → 레전드
  ...[1, 2, 3].map((s) => line("b", s, 500)), // 3시즌 + MVP → 아님 (상은 카드에만)
  ...[1, 2, 3, 4].map((s) => line("c", s, 900)), // 4시즌 → 아님
  line("d", 1, 0, 0), // 0경기 → 제외
];
const tenures = buildTenures(lines, [
  { playerNo: "b", key: "mvp", seasonCode: 2 },
  { playerNo: "c", key: "rookie", seasonCode: 1 }, // 큰 상 아님
]);
assert.equal(tenures.length, 3);
assert.deepEqual(pickLegends(tenures).map((t) => t.id), ["a"]);
assert.equal(tenures.find((t) => t.id === "b")!.majorAwards.length, 1);
assert.deepEqual(longestTenures(tenures, 2).map((t) => t.id), ["a", "c"]);
assert.deepEqual(franchiseLeaders(tenures, "pts", 2).map((l) => [l.id, l.value]), [["c", 3600], ["b", 1500]]);
assert.equal(majorAwardSummary([{ key: "finalsMvp" }, { key: "mvp" }, { key: "mvp" }]), "MVP 2회 · 챔프전 MVP 1회");
assert.equal(majorAwardSummary([]), "");

// ── 이름 구간·계보 ──
assert.deepEqual(nameSpans([{ seasonCode: 3, name: "B" }, { seasonCode: 1, name: "A" }, { seasonCode: 2, name: "A" }]), [
  { name: "A", from: 1, to: 2 },
  { name: "B", from: 3, to: 3 },
]);
const succ = { "25": "37", "37": "65", "65": "64", "40": "70", x: "y", y: "x" };
assert.deepEqual(lineageChain("65", succ), ["25", "37", "65", "64"]);
assert.deepEqual(lineageChain("70", succ), ["40", "70"]);
assert.deepEqual(lineageChain("55", succ), ["55"]);
assert.deepEqual(lineageChain("x", succ), ["y", "x"]); // 고리가 있어도 멈춘다
// ── 가장 좋은 정규시즌 ──
assert.equal(bestRegularSeason([]), null);
{
  const a = row({ seasonCode: 3, wins: 30, losses: 24, pct: 30 / 54 });
  const b = row({ seasonCode: 5, wins: 40, losses: 14, pct: 40 / 54 });
  const c = row({ seasonCode: 7, wins: 2, losses: 0, pct: 1, ongoing: true }); // 진행 중은 뺀다
  const d = row({ seasonCode: 9, wins: 40, losses: 14, pct: 40 / 54 }); // 같으면 최근
  assert.equal(bestRegularSeason([a, b, c])?.seasonCode, 5);
  assert.equal(bestRegularSeason([a, b, c, d])?.seasonCode, 9);
}
console.log("franchise: 플레이오프 단계·통산·레전드·팀 기록·이름 구간·계보 통과");

// ── 로스터 표 정렬 (2026-10-30: 머리글 정렬·반대 순서·성공률 시도 기준) ──
import { ROSTER_PCT_MIN_ATTEMPTS, rosterPct, sortRoster, type RosterRow } from "../lib/franchise";
{
  const r = (id: string, ppg: number, tpm: number, tpa: number, extra: Partial<RosterRow> = {}): RosterRow => ({
    id, name: id, pos: "G", foreign: false, gp: 10, mpg: 20, ppg, rpg: 3, apg: 2, spg: 1, bpg: 0, tpg: 1, tpmPg: tpm / 10,
    fgm: 40, fga: 90, tpm, tpa, ftm: 10, fta: 12, photoUrl: null, ...extra,
  });
  const rows = [r("a", 20, 10, 40), r("b", 12, 3, 4), r("c", 8, 20, 45), r("d", 15, 0, 0)];
  assert.deepEqual(sortRoster(rows, "ppg").map((x) => x.id), ["a", "d", "b", "c"]);
  assert.deepEqual(sortRoster(rows, "ppg", true).map((x) => x.id), ["c", "b", "d", "a"]);
  // 3점%: 시도 10개 미만(b 3/4, d 0/0)은 어느 방향이든 뒤
  assert.deepEqual(sortRoster(rows, "tpPct").map((x) => x.id).slice(0, 2), ["c", "a"]);
  assert.deepEqual(sortRoster(rows, "tpPct", true).map((x) => x.id).slice(0, 2), ["a", "c"]);
  assert.ok(ROSTER_PCT_MIN_ATTEMPTS > 4);
  assert.equal(rosterPct(rows[3], "tpPct"), null);
  assert.equal(Math.round(rosterPct(rows[0], "tpPct")!), 25);
  console.log("franchise: 로스터 표 정렬 통과");
}
