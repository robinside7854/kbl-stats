// 팀 페이지 규칙 (lib/franchise) 검증 — npm run test:franchise
import assert from "node:assert/strict";
import {
  buildTenures, franchiseLeaders, franchiseTotals, isLegend, lineageChain, longestTenures, majorAwardSummary, nameSpans, pctText, pickLegends, playoffStage,
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
assert.ok(isLegend(7, 0));
assert.ok(!isLegend(6, 0));
assert.ok(isLegend(3, 1));
assert.ok(!isLegend(2, 2));
const line = (id: string, seasonCode: number, pts = 100, games = 50): SeasonPlayerLine => ({
  id, name: `선수${id}`, photoUrl: null, seasonCode, games, pts, reb: 10, ast: 5, stl: 1, blk: 1, tpm: 2,
});
const lines: SeasonPlayerLine[] = [
  ...[1, 2, 3, 4, 5, 6, 7].map((s) => line("a", s)), // 7시즌 → 레전드
  ...[1, 2, 3].map((s) => line("b", s, 500)), // 3시즌 + MVP → 레전드
  ...[1, 2, 3, 4].map((s) => line("c", s, 900)), // 4시즌, 상 없음 → 아님
  line("d", 1, 0, 0), // 0경기 → 제외
];
const tenures = buildTenures(lines, [
  { playerNo: "b", key: "mvp", seasonCode: 2 },
  { playerNo: "c", key: "rookie", seasonCode: 1 }, // 큰 상 아님
]);
assert.equal(tenures.length, 3);
assert.deepEqual(pickLegends(tenures).map((t) => t.id), ["a", "b"]);
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
console.log("franchise: 플레이오프 단계·통산·레전드·팀 기록·이름 구간·계보 통과");
