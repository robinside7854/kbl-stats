// 시상 레이스 (lib/award-race) — MVP 자격(팀 6위·출전 2/3·출전 시간·기록 합·종합 하한)·묶음(국내+아시아쿼터 / 외국)·팀 가중 점수, MIP 조건, 머리말 칩
import assert from "node:assert/strict";
import { buildAwardRace, gradeSteps, MVP_GROUP_RULES, mvpScore, raceRankText, raceTagsOf } from "../lib/award-race";
import { decodeSeasonCards, encodeSeasonCards } from "../lib/cards";
import type { StandingRow } from "../lib/games";
import type { CardPlayer, Nationality, PositionGroup } from "../lib/types";

let n = 0;
const mk = (o: Partial<CardPlayer> & { id: string; teamCode: string }): CardPlayer => {
  n++;
  const nat: Nationality = o.nationality ?? "domestic";
  return {
    nameKo: `선수${o.id}`, nameEn: `P${n}`, teamName: "팀", teamShort: "팀",
    isForeign: nat !== "domestic", position: (o.positionGroup ?? "G") as PositionGroup, positionGroup: "G", nationality: nat, photoUrl: null,
    games: 10, minutes: 250, points: 80, reb: 30, ast: 20, stl: 5, blk: 2, tov: 15, fouls: 20,
    fga: 70, tpa: 25, fta: 15, fgPct: 40, tpPct: 30, ftPct: 70,
    fgm: 28, twoPa: 45, twoPPct: 44, tpm: 8, oreb: 6, dreb: 24, goodDef: 3, deflections: 4, screenAst: 2, plusMinus: 0, midA: 15, midM: 5,
    per: 10, usgPct: 18, rebPct: 8, astPct: 12, tsPct: 48, efgPct: 46, tovPct: 14, astTo: 1.3,
    ...o,
  };
};
const star = (o: Partial<CardPlayer>) => ({ points: 220, reb: 70, ast: 60, stl: 18, blk: 6, fgm: 80, fga: 160, fgPct: 50, tpPct: 38, tpm: 20, tpa: 52, per: 22, tsPct: 60, efgPct: 56, usgPct: 26, rebPct: 12, astPct: 25, astTo: 2.5, tovPct: 10, minutes: 320, ...o });

// 국내 약한 선수 24 + 스타 5, 외국 4명, 아시아쿼터 2명
const weak = Array.from({ length: 24 }, (_, i) => mk({ id: `w${i}`, teamCode: i % 2 ? "A" : "B" }));
const cur = [
  ...weak,
  mk({ id: "d1", teamCode: "A", ...star({}) }), // 1위 팀 스타
  mk({ id: "d2", teamCode: "B", ...star({ points: 260, per: 26 }) }), // 더 잘하지만 팀이 7위 → 빠짐
  mk({ id: "d3", teamCode: "A", ...star({ games: 5, minutes: 160 }) }), // 팀 10경기 중 5경기 → 빠짐 (표본 기준 10경기도 못 채움)
  mk({ id: "d4", teamCode: "C", ...star({ points: 200 }) }), // 4위 팀
  mk({ id: "d5", teamCode: "A", ...star({ minutes: 220 }) }), // 기록은 좋지만 경기당 22분 → 빠짐
  mk({ id: "f1", teamCode: "A", nationality: "foreign", ...star({ points: 250, reb: 110 }) }),
  mk({ id: "f2", teamCode: "C", nationality: "foreign", ...star({ points: 200, reb: 90 }) }),
  mk({ id: "f3", teamCode: "B", nationality: "foreign" }),
  mk({ id: "f4", teamCode: "C", nationality: "foreign" }),
  mk({ id: "a1", teamCode: "A", nationality: "asia", ...star({ points: 280, per: 28 }) }),
  mk({ id: "a2", teamCode: "B", nationality: "asia" }),
];
// 지난 시즌: d4 는 약했다(MIP 후보), w0 는 효율만 떨어진 채 출전·볼륨만 올라 MIP 아님
const prev = cur.map((p) =>
  p.id === "d4" ? { ...p, ...mk({ id: "d4", teamCode: "C", minutes: 150 }) } :
  p.id === "w0" ? { ...p, minutes: 200, points: 40, tsPct: 60, per: 14 } : p,
);
const teams = ["A", "B", "C"].map((c) => ({ teamCode: c, shortName: c, logoUrl: null, color: { primary: "#333333", secondary: "#000000", text: "#ffffff" } }));
const coverage = { advanced: true, plusMinus: true, goodDef: true, hustle: true, shots: true };
const enc = (code: number, label: string, players: CardPlayer[]) => decodeSeasonCards(encodeSeasonCards({ seasonCode: code, seasonLabel: label, coverage, teams }, players));
const row = (teamCode: string, rank: number, wins: number, losses: number): StandingRow => ({
  teamCode, name: teamCode, rank, games: wins + losses, wins, losses, pct: wins / (wins + losses), gamesBehind: 0,
  homeWins: 0, homeLosses: 0, awayWins: 0, awayLosses: 0, pointsFor: 0, pointsAgainst: 0, last5: [], streak: "", streakKind: null, streakCount: 0,
});
const standings = [row("A", 1, 9, 1), row("C", 4, 6, 4), row("B", 7, 5, 5)];
const race = buildAwardRace(enc(49, "2026-2027", cur), enc(47, "2025-2026", prev), standings);

// ── MVP 국내: 5위 팀 d2·출전 부족 d3 는 빠지고, 1위 팀 d1 이 앞 ──
const dom = race.mvp.domestic.map((c) => c.id);
assert.ok(!dom.includes("d2"), "팀이 6위 밖이면 후보가 아님");
assert.ok(!dom.includes("d5"), "경기당 출전이 짧으면 후보가 아님");
assert.ok(!dom.includes("d3"), "팀 경기 2/3 미만 출전은 후보가 아님");
assert.ok(dom.includes("d1"), "1위 팀 스타는 후보");
for (const c of race.mvp.domestic) {
  assert.ok(c.team.rank <= MVP_GROUP_RULES.domestic.teamRankMax!);
  assert.equal(c.stats.length, 9, "지표 7개 + PER + 기록 합");
}
// ── 아시아쿼터는 국내 묶음, 외국 묶음은 외국 선수만 ──
const fr = race.mvp.foreign.map((c) => c.id);
assert.ok(dom.includes("a1"), "아시아쿼터는 국내 묶음 후보");
assert.ok(fr.includes("f1") && !fr.includes("a1"), "외국 묶음엔 아시아쿼터가 없음");
assert.ok(race.mvp.foreign.every((c) => c.nationality === "foreign"));
assert.equal(fr[0], "f1", "외국 1위 = 1위 팀 + 기록 합 1위");
assert.equal(race.mvp.domestic.find((c) => c.id === "a1")?.nationality, "asia", "국적 표시는 원래 값");
assert.ok(race.mvp.foreign.length <= 3 && race.mvp.domestic.length <= 3);
// 점수: 국내 기록 합 70% + 팀 승률 20% + 종합 10% / 외국 팀 승률 60% + 기록 합 40%
assert.equal(mvpScore("domestic", 80, 0.9, 1), 96);
assert.equal(mvpScore("foreign", 100, 0.5, 0.5), 50);
// 순위 글자
assert.equal(raceRankText("domestic", { rank: 2 }), "국내 2위");
assert.equal(raceRankText("foreign", { rank: null }), "");

// ── MIP: d4 는 출전·볼륨·효율·등급 모두 올라 후보, w0 는 TS%·PER 이 떨어져 빠짐 ──
assert.equal(gradeSteps("D", "B"), 2);
assert.equal(gradeSteps("-", "A"), 0);
const mip = race.mip.map((m) => m.id);
assert.ok(mip.includes("d4"), "모두 오른 선수는 MIP 후보");
assert.ok(!mip.includes("w0"), "효율이 떨어지면 MIP 아님");
for (const m of race.mip) {
  assert.ok(m.cur.mpg > m.prev.mpg && m.cur.tsPct > m.prev.tsPct && m.cur.per > m.prev.per && m.gain >= 15);
  assert.ok(m.prev.score < 55 && m.cur.score >= 55, "지난 시즌 C 이하 → 이번 시즌 B 이상");
}
// 그 전 시즌들엔 잘했던 선수(반등)는 최근 3시즌 평균이 높아 MIP 아님
const older = cur.map((p) => (p.id === "d4" ? { ...p, ...star({}) } : p));
const race2 = buildAwardRace(enc(49, "2026-2027", cur), enc(47, "2025-2026", prev), standings, [enc(45, "2024-2025", older), enc(43, "2023-2024", older)]);
assert.ok(!race2.mip.some((m) => m.id === "d4"), "최근 3시즌 평균이 C 위면 MIP 아님");

// ── 머리말 칩 ──
assert.deepEqual(raceTagsOf(race, race.mvp.domestic[0].id), ["MVP 후보 1위"]);
assert.deepEqual(raceTagsOf(null, "d1"), []);
assert.deepEqual(raceTagsOf(race, "w5"), []);
console.log("award-race: MVP·MIP 후보 규칙 통과");
