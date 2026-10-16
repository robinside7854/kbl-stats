// 2026-10-16 "우리만의 기능" 규칙 검증: 커리어 타임라인(lib/timeline) · 슛 습관의 변화(lib/shot-habit) · 팀 올타임 베스트 5(lib/team-best)
// 실행: npx tsx tests/career-extra.test.ts
import assert from "node:assert/strict";
import { careerTimeline, draftText, withRo, TIMELINE_MILESTONE_STEPS, type TimelineSeasonInput } from "../lib/timeline";
import { shotHabitRows, shotHabitTakeaway, SHOT_HABIT_MIN_ATTEMPTS } from "../lib/shot-habit";
import {
  bestBlockReason, bestOpenSlots, bestTotals, buildTeamBest, decodeBestParam, emptyBestLineup, encodeBestParam, filterBestByPos, isBestFull,
  placeBest, TEAM_BEST_MIN_GAMES, type BestCandidate, type TeamBestSeasonRow,
} from "../lib/team-best";
import type { HighRecord, HighsSet } from "../lib/types";
import type { ShotZoneSummary } from "../lib/shots";

// ── 조사 ──
assert.equal(withRo("삼성"), "삼성으로");
assert.equal(withRo("모비스"), "모비스로");
assert.equal(withRo("KCC"), "KCC로");
assert.equal(withRo("오리온"), "오리온으로");
assert.equal(withRo("전자랜드"), "전자랜드로"); // ㄹ 받침은 "로"
assert.equal(draftText({ year: 2004, round: 1, pick: 1 }), "2004 드래프트 1라운드 1순위");
assert.equal(draftText({ year: 2010, round: null, pick: null }), "2010 드래프트");
assert.equal(draftText(null), null);

// ── 커리어 타임라인 ──
const season = (code: number, teamCode: string, teamName: string, add: Partial<TimelineSeasonInput> = {}): TimelineSeasonInput => ({
  seasonCode: code, seasonLabel: `${2000 + code}-${2001 + code}`, teamCode, teamName, games: 54, points: 600, reb: 200, ast: 150, stl: 50, blk: 10, tpm: 60, ...add,
});
const high = (value: number, seasonCode: number, date: string, opp: string): HighRecord => ({ value, date, opponentTeamCode: opp, times: 1, seasonCode });
const highs = { pts: high(42, 3, "2003-12-01", "55"), reb: high(15, 3, "2003-12-01", "55"), ast: high(12, 5, "2006-01-02", "60"), tpm: null } as unknown as HighsSet;
{
  const rows = careerTimeline({
    seasons: [season(1, "10", "모비스"), season(3, "10", "모비스"), season(5, "70", "정관장"), season(7, "73", "오리온")],
    allSeasonCodes: [1, 3, 5, 7, 9, 11].map((c) => c), // 1 → 3 은 바로 다음 시즌, 7 다음은 없음
    draft: { year: 2001, round: 1, pick: 3 },
    awards: [{ key: "best5", seasonCode: 3 }, { key: "mvp", seasonCode: 3 }],
    championships: [5],
    primeSeason: 3,
    careerHighs: highs,
    isSuccessor: (a, b) => a === "70" && b === "73",
    opponentName: (code) => (code === "55" ? "SK" : "KCC"),
  });
  assert.deepEqual(rows.map((r) => r.season), ["01-02", "03-04", "05-06", "07-08"]);
  const first = rows[0];
  assert.equal(first.items[0].kind, "debut");
  assert.equal(first.items[0].text, "모비스에서 데뷔");
  assert.equal(first.items[0].sub, "2001 드래프트 1라운드 3순위");
  // 3: 수상(AWARD_LABELS 순서 — MVP 먼저)·프라임·같은 경기 커리어 하이 한 줄·이정표(1,000득점·100경기)
  const s3 = rows[1].items;
  assert.deepEqual(s3.map((i) => i.kind), ["award", "prime", "high", "milestone"]);
  assert.equal(s3[0].text, "정규리그 MVP · 베스트5");
  assert.equal(s3[2].text, "42득점 · 15리바운드"); // 칸 이름이 "커리어 하이"
  assert.equal(s3[2].sub, "vs SK 2003.12.01");
  assert.equal(s3[3].text, "통산 1,000득점 · 100경기 · 3점슛 100개");
  // 5: 이적 + 우승 + 다른 날 커리어 하이 + 이정표
  const s5 = rows[2].items;
  assert.equal(s5[0].kind, "move");
  assert.equal(s5[0].text, "정관장으로 이적");
  assert.equal(s5[1].kind, "champion");
  // 7: 구단 매각(70 → 73)은 이적이 아니라 구단 바뀜
  assert.equal(rows[3].items[0].kind, "rename");
  assert.equal(rows[3].items[0].text, "구단이 오리온으로 바뀜");
}
{
  // 쉬었다 복귀: 코드표에서 사이 시즌 수를 센다 (1 → 7 사이에 3·5 두 시즌)
  const rows = careerTimeline({
    seasons: [season(1, "10", "모비스", { points: 10, games: 5, tpm: 0 }), season(7, "10", "모비스", { points: 10, games: 5, tpm: 0 })],
    allSeasonCodes: [1, 3, 5, 7],
    draft: null, primeSeason: null, careerHighs: null,
  });
  assert.equal(rows[1].items[0].kind, "return");
  assert.equal(rows[1].items[0].text, "2시즌 쉬고 복귀");
  assert.equal(rows[1].items[0].sub, null); // 같은 팀
}
{
  // 한 시즌에 이정표를 여러 번 넘으면 가장 큰 값 하나 · 아무 일 없는 시즌은 빠진다
  const rows = careerTimeline({
    seasons: [season(1, "10", "A", { points: 2500, games: 30, reb: 0, ast: 0, tpm: 0 }), season(3, "10", "A", { points: 100, games: 10, reb: 0, ast: 0, tpm: 0 })],
    allSeasonCodes: [1, 3], draft: null, primeSeason: null, careerHighs: null,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].items[1].text, "통산 2,000득점");
  assert.ok(TIMELINE_MILESTONE_STEPS.every((m) => m.step > 0));
}
assert.deepEqual(careerTimeline({ seasons: [], allSeasonCodes: [], draft: null, primeSeason: null, careerHighs: null }), []);

// ── 슛 습관의 변화 ──
const zones = (rim: number, paint: number, mid: number, c3: number, a3: number): ShotZoneSummary => ({
  total: { attempts: rim + paint + mid + c3 + a3, made: 0 },
  zones: { rim: { a: rim, m: 0 }, paint: { a: paint, m: 0 }, mid: { a: mid, m: 0 }, corner3: { a: c3, m: 0 }, arc3: { a: a3, m: 0 } },
  offenseType: null,
});
{
  const rows = shotHabitRows([
    { seasonCode: 47, seasonLabel: "2025-2026", shotZones: zones(132, 434, 214, 1, 310) },
    { seasonCode: 35, seasonLabel: "2019-2020", shotZones: zones(234, 393, 89, 0, 12) },
    { seasonCode: 37, seasonLabel: "2020-2021", shotZones: zones(10, 10, 10, 0, 0) }, // 50개 미만 — 빠짐
    { seasonCode: 39, seasonLabel: "2021-2022", shotZones: null },
  ]);
  assert.deepEqual(rows.map((r) => r.season), ["19-20", "25-26"]); // 오래된 시즌 먼저
  const sum = Object.values(rows[0].shares).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 100) < 0.5); // 소수 1자리로 반올림
  // 워니: 골밑·페인트 86% → 52% 가 가장 큰 변화
  assert.equal(shotHabitTakeaway(rows), "골밑·페인트 비중 86% → 52%로 줄었어요 (19-20 → 25-26)");
  assert.equal(shotHabitTakeaway(rows.slice(0, 1)), null);
  const same = shotHabitRows([
    { seasonCode: 1, seasonLabel: "1997", shotZones: zones(20, 20, 20, 20, 20) },
    { seasonCode: 3, seasonLabel: "1998-1999", shotZones: zones(21, 20, 19, 20, 20) },
  ]);
  assert.equal(shotHabitTakeaway(same), "97 → 98-99, 슛 던지는 곳이 거의 그대로예요");
  const grow = shotHabitRows([
    { seasonCode: 1, seasonLabel: "2010-2011", shotZones: zones(30, 30, 20, 5, 15) },
    { seasonCode: 3, seasonLabel: "2011-2012", shotZones: zones(10, 10, 20, 20, 40) },
  ]);
  assert.equal(shotHabitTakeaway(grow), "3점 비중 20% → 60%로 늘었어요 (10-11 → 11-12)");
  assert.equal(SHOT_HABIT_MIN_ATTEMPTS, 50);
}

// ── 팀 올타임 베스트 5 ──
const srow = (p: Partial<TeamBestSeasonRow>): TeamBestSeasonRow => ({
  teamCode: "10", id: "1", name: "가", photoUrl: null, position: "G", foreign: false, seasonCode: 1, seasonLabel: "1997",
  games: 40, points: 400, reb: 100, ast: 200, score: 50, ...p,
});
{
  const map = buildTeamBest([
    srow({ id: "1", seasonCode: 1, score: 80 }),
    srow({ id: "1", seasonCode: 3, seasonLabel: "1998-1999", score: 90, points: 800 }),
    srow({ id: "1", seasonCode: 5, seasonLabel: "1999-2000", score: 90, points: 600 }), // 같은 점수면 최근
    srow({ id: "2", games: 20, score: 99 }), // 30경기 미만 — 빠짐
    srow({ id: "3", position: null, score: 99 }), // 포지션 없음 — 빠짐
    srow({ id: "4", games: 35, score: null }), // 점수 있는 시즌 없음 — 빠짐
    srow({ id: "5", teamCode: "16", games: 40, score: 70 }),
    srow({ id: "1", teamCode: "16", games: 40, score: 95 }), // 다른 팀 기록은 따로
  ]);
  const t10 = map.get("10")!;
  assert.deepEqual(t10.map((c) => c.id), ["1"]);
  assert.equal(t10[0].seasonCode, 5);
  assert.equal(t10[0].season, "99-00");
  assert.equal(t10[0].games, 120);
  assert.equal(t10[0].seasons, 3);
  assert.equal(t10[0].span, "97-00");
  assert.equal(t10[0].ppg, 15);
  assert.deepEqual(map.get("16")!.map((c) => c.id), ["1", "5"]); // 점수 높은 순
  assert.equal(TEAM_BEST_MIN_GAMES, 30);
}
const cand = (id: string, position: BestCandidate["position"], foreign = false, score = 80): BestCandidate => ({
  id, name: `선수${id}`, photoUrl: null, position, foreign, seasonCode: 47, season: "25-26", score, ppg: 10, rpg: 5, apg: 3, games: 100, seasons: 2, span: "24-26",
});
{
  const g1 = cand("g1", "G"), g2 = cand("g2", "GF"), f1 = cand("f1", "F", true), f2 = cand("f2", "FC", true), c1 = cand("c1", "C"), c2 = cand("c2", "C", true);
  let l = emptyBestLineup();
  assert.deepEqual(bestOpenSlots(l, g2), [0, 1, 2, 3]); // GF 는 가드·포워드 칸
  l = placeBest(l, g1);
  l = placeBest(l, g2); // 두 번째 가드 칸
  assert.equal(l[1]?.id, "g2");
  assert.equal(bestBlockReason(l, g1), "이미 뽑음");
  l = placeBest(l, f1);
  l = placeBest(l, f2); // FC → 포워드 칸이 먼저
  assert.equal(l[3]?.id, "f2");
  assert.equal(bestBlockReason(l, c2), "외국 선수 2명 다 참");
  assert.equal(placeBest(l, c2), l); // 못 넣으면 그대로
  assert.equal(encodeBestParam(l), ""); // 아직 4명
  l = placeBest(l, c1);
  assert.ok(isBestFull(l));
  assert.equal(bestBlockReason(l, cand("x", "G")), "자리 다 참");
  const param = encodeBestParam(l);
  assert.equal(param, "g1:47,g2:47,f1:47,f2:47,c1:47");
  const all = [g1, g2, f1, f2, c1, c2];
  assert.deepEqual(decodeBestParam(all, param)?.map((p) => p?.id), ["g1", "g2", "f1", "f2", "c1"]);
  assert.deepEqual(decodeBestParam(all, "g1:1,g2:1,f1:1,f2:1,c1:1")?.map((p) => p?.id), ["g1", "g2", "f1", "f2", "c1"]); // 시즌이 달라도 번호로
  assert.equal(decodeBestParam(all, "g1:47,g2:47,f1:47,f2:47"), null); // 4명
  assert.equal(decodeBestParam(all, "c1:47,g2:47,f1:47,f2:47,g1:47"), null); // 센터를 가드 칸에
  assert.equal(decodeBestParam(all, "g1:47,g1:47,f1:47,f2:47,c1:47"), null); // 같은 선수 두 번
  assert.equal(decodeBestParam(all, "g1:47,g2:47,f1:47,f2:47,c2:47"), null); // 외국 선수 3명
  assert.equal(decodeBestParam(all, "g1:47,g2:47,f1:47,f2:47,zz:47"), null); // 없는 선수
  assert.equal(decodeBestParam(all, null), null);
  assert.deepEqual(filterBestByPos(all, "F").map((c) => c.id), ["g2", "f1", "f2"]);
  assert.deepEqual(filterBestByPos(all, "C").map((c) => c.id), ["f2", "c1", "c2"]);
  assert.deepEqual(bestTotals([g1, g2, f1, f2, c1]), { ppg: 50, rpg: 25, apg: 15, avgScore: 80 });
}

console.log("career-extra: 커리어 타임라인·슛 습관의 변화·팀 올타임 베스트 5 통과");
