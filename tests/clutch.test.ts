// 문자중계 수집 규칙(scripts/textcast.ts)·클러치·위닝샷·버저비터 판정(lib/clutch.ts) 검증 (npm run test:clutch)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extraQuarters, hasGameEnd, isTextCastResponse, mergeQuarters, parseTextCast, quarterOf } from "../scripts/textcast";
import {
  analyzeClutch, CLUTCH_MARGIN_MAX, isBuzzerBeater, isClutchMoment, periodLabel, remainingLabel, winningLabel, winningLine,
} from "../lib/clutch";
import type { TextCastEvent } from "../lib/types";

// ── 수집 규칙 ──
assert.equal(isTextCastResponse([]), true);
assert.equal(isTextCastResponse({ shootLog: [] }), false);
assert.equal(isTextCastResponse("<html>"), false);
assert.deepEqual(extraQuarters("Q4"), []);
assert.deepEqual(extraQuarters("X1"), ["Q4"]);
assert.deepEqual(extraQuarters("X3"), ["Q4", "X1", "X2"]);
assert.deepEqual(extraQuarters("Q2"), []);
assert.equal(quarterOf([{ q: "X1", n: 1 }]), "X1");
assert.equal(quarterOf([]), null);
assert.equal(hasGameEnd([{ a: "205" }, { a: "009" }]), true);
assert.equal(hasGameEnd([{ a: "205" }]), false);
// 쿼터 순서대로 이어 붙인다 (받은 순서: 마지막 연장 먼저)
const merged = mergeQuarters([[{ q: "X1", n: 600 }], [{ q: "Q4", n: 500 }, { q: "Q4", n: 501 }]]);
assert.deepEqual(merged.map((x) => x.n), [500, 501, 600]);
console.log("clutch: 수집 규칙 통과");

// ── 문자중계 해석 ──
const ev = parseTextCast([
  { n: 3, q: "Q4", m: 0, s: 0, p: "이정현", t: "66", a: "205" },
  { n: 1, q: "Q4", m: 1, s: 4, p: "허웅", t: "60", a: "201" },
  { n: 2, q: "Q4", m: 0, s: 6, a: "003", t: "66" },
  { n: 4, q: "Q4", m: 0, s: 0, a: "009", t: "" },
]);
assert.deepEqual(ev.map((e) => e.seq), [1, 2, 3, 4]);
assert.equal(ev[0].remaining, 64);
assert.equal(ev[0].action, "made2");
assert.equal(ev[1].action, "timeout");
assert.equal(ev[2].action, "made3");
assert.equal(ev[3].action, "end");
console.log("clutch: 해석 통과");

// ── 표기 ──
assert.equal(periodLabel("Q4"), "4쿼터");
assert.equal(periodLabel("X1"), "연장");
assert.equal(periodLabel("X2"), "2차 연장");
assert.equal(remainingLabel(3), "0:03");
assert.equal(remainingLabel(119), "1:59");
assert.equal(winningLabel({ buzzer: true, kind: "3" }), "버저비터");
assert.equal(winningLabel({ buzzer: false, kind: "ft" }), "결승 자유투");
assert.equal(winningLabel({ buzzer: false, kind: "2" }), "위닝샷");

// ── 클러치 상황 ──
assert.equal(isClutchMoment("Q4", 119, 6), true);
assert.equal(isClutchMoment("Q4", 119, -6), true);
assert.equal(isClutchMoment("Q4", 120, 0), false);        // 2:00 은 아직 아니다 (2분 미만)
assert.equal(isClutchMoment("Q4", 30, CLUTCH_MARGIN_MAX + 1), false);
assert.equal(isClutchMoment("Q3", 10, 0), false);
assert.equal(isClutchMoment("X1", 100, 3), true);         // 연장도
console.log("clutch: 표기·상황 통과");

// ── 판정 (가짜 경기) ──
let seq = 0;
const E = (period: string, remaining: number, teamCode: string, action: TextCastEvent["action"], nameKo = ""): TextCastEvent => ({
  seq: ++seq, period, remaining, nameKo, teamCode, action,
});
const ids = (name: string) => (name ? `id-${name}` : null);
const H = "10";
const A = "20";
// 4쿼터 시작 80-80 → 홈 A 3:00 2점(82-80) → 원정 B 1:30 3점(82-83) → 홈 C 0:40 실패 → 홈 C 0:20 2점(84-83) → 원정 D 0:05 3점 실패 → 종료
seq = 0;
const g1 = [
  E("Q4", 180, H, "made2", "A"),
  E("Q4", 90, A, "made3", "B"),
  E("Q4", 40, H, "miss3", "C"),
  E("Q4", 20, H, "made2", "C"),
  E("Q4", 5, A, "miss3", "D"),
  E("Q4", 0, "", "end"),
];
const r1 = analyzeClutch(g1, { teamCode: H, score: 84 }, { teamCode: A, score: 83 }, (n) => ids(n))!;
assert.ok(r1);
assert.equal(r1.winning?.nameKo, "C");
assert.deepEqual(r1.winning?.before, [82, 83]);
assert.deepEqual(r1.winning?.after, [84, 83]);
assert.equal(r1.winning?.remaining, 20);
assert.equal(r1.winning?.buzzer, false);
assert.equal(winningLine(r1.winning!, H), "4쿼터 0:20 2점슛 82-83 → 84-83");
// 클러치: B(3점 성공) · C(2점 1/2, 3점 0/1) · D(3점 0/1). A 의 3:00 득점은 시간 밖
const byName = Object.fromEntries(r1.lines.map((l) => [l.nameKo, l]));
assert.equal(byName.A, undefined);
assert.deepEqual([byName.B.pts, byName.B.tpm, byName.B.tpa], [3, 1, 1]);
assert.deepEqual([byName.C.pts, byName.C.fgm, byName.C.fga, byName.C.tpa], [2, 1, 2, 1]);
assert.equal(byName.D.fga, 1);
assert.equal(r1.lines[0].nameKo, "B");                     // 득점 많은 순
assert.equal(byName.C.id, "id-C");

// 3분 전에 앞서 나가 끝까지 지켰으면 위닝샷 없음 (클러치 기록은 있음)
seq = 0;
const g2 = [E("Q4", 200, H, "made3", "A"), E("Q4", 60, A, "made2", "B"), E("Q4", 0, "", "end")];
const r2 = analyzeClutch(g2, { teamCode: H, score: 90 }, { teamCode: A, score: 88 }, ids)!;
assert.equal(r2.winning, null);
assert.equal(r2.lines.length, 1);

// 버저비터: 0초 3점 역전, 뒤엔 어시스트·종료·교체뿐
seq = 0;
const g3 = [E("Q4", 17, A, "made2", "B"), E("Q4", 0, H, "made3", "C"), E("Q4", 0, H, "assist", "A"), E("Q4", 0, "", "end"), E("Q4", 0, A, "subOut", "B")];
const r3 = analyzeClutch(g3, { teamCode: H, score: 97 }, { teamCode: A, score: 96 }, ids)!;
assert.equal(r3.winning?.buzzer, true);
assert.equal(winningLabel(r3.winning!), "버저비터");
// 0초에 넣었어도 상대가 마지막 슛을 던졌으면(0.x 초가 남아 있었다) 버저비터가 아니다
seq = 0;
const g4 = [E("Q4", 17, A, "made2", "B"), E("Q4", 0, H, "made3", "C"), E("Q4", 0, A, "miss3", "B"), E("Q4", 0, "", "end")];
const r4 = analyzeClutch(g4, { teamCode: H, score: 97 }, { teamCode: A, score: 96 }, ids)!;
assert.equal(r4.winning?.nameKo, "C");
assert.equal(r4.winning?.buzzer, false);
// 리바운드가 이어졌어도 아니다
assert.equal(isBuzzerBeater([E("Q4", 0, H, "made2", "C"), E("Q4", 0, A, "rebound", "B")], 0), false);
// 작전시간도
assert.equal(isBuzzerBeater([E("Q4", 0, H, "made2", "C"), E("Q4", 0, A, "timeout")], 0), false);
// 앤드원 자유투가 뒤따라도 버저비터
assert.equal(isBuzzerBeater([E("Q4", 0, H, "made2", "C"), E("Q4", 0, A, "foul", "B"), E("Q4", 0, H, "madeFt", "C"), E("Q4", 0, "", "end")], 0), true);
// 자유투는 버저비터가 아니다 — 결승 자유투
seq = 0;
const g5 = [E("Q4", 1, A, "made2", "B"), E("Q4", 0, H, "madeFt", "C"), E("Q4", 0, H, "madeFt", "C"), E("Q4", 0, "", "end")];
const r5 = analyzeClutch(g5, { teamCode: H, score: 81 }, { teamCode: A, score: 80 }, ids)!;
assert.equal(r5.winning?.kind, "ft");
assert.equal(r5.winning?.buzzer, false);
// 79-80 → 첫 자유투 동점 80-80 → 둘째 자유투 81-80 이 결승
assert.deepEqual(r5.winning?.before, [80, 80]);
assert.deepEqual(r5.winning?.after, [81, 80]);
assert.equal(winningLabel(r5.winning!), "결승 자유투");

// 동점 뒤 다시 앞서면 마지막 것이 위닝샷 (연장 포함)
seq = 0;
const g6 = [
  E("Q4", 30, H, "made2", "A"),   // 홈 앞섬
  E("Q4", 2, A, "made2", "B"),    // 동점 → 연장
  E("Q4", 0, "", "end"),
  E("X1", 100, H, "made3", "C"),  // 연장 1:40 앞섬 (클러치 시간)
  E("X1", 50, A, "made2", "D"),
  E("X1", 0, "", "end"),
];
const r6 = analyzeClutch(g6, { teamCode: H, score: 100 }, { teamCode: A, score: 99 }, ids)!;
assert.equal(r6.winning?.nameKo, "C");
assert.equal(r6.winning?.period, "X1");
// 점수가 안 맞으면(빠진 기록) null
assert.equal(analyzeClutch(g6, { teamCode: H, score: 2 }, { teamCode: A, score: 99 }, ids), null);
assert.equal(analyzeClutch([], { teamCode: H, score: 2 }, { teamCode: A, score: 1 }, ids), null);
console.log("clutch: 판정 통과");

// ── 실제 경기 (2026-10-28 조사로 받은 raw — 레포에 있다) ──
const real = (season: number, gmkey: string) => parseTextCast(JSON.parse(readFileSync(`data/raw/textcast/${season}/${gmkey}.json`, "utf8")));
// 26-27 10/24 소노(홈 66) 97-96 KCC(60): 이정현 4쿼터 0초 3점 94-96 → 97-96 버저비터
const n36 = analyzeClutch(real(49, "S49G01N36"), { teamCode: "66", score: 97 }, { teamCode: "60", score: 96 }, () => null)!;
assert.equal(n36.winning?.nameKo, "이정현");
assert.equal(n36.winning?.kind, "3");
assert.equal(n36.winning?.remaining, 0);
assert.equal(n36.winning?.buzzer, true);
assert.deepEqual(n36.winning?.before, [94, 96]);
// 26-27 10/26 소노 107-109 LG(50): 윤원상 4쿼터 0:03 2점 107-107 → 107-109, 그 뒤 소노가 3점을 던졌다 → 버저비터 아님
const n40 = analyzeClutch(real(49, "S49G01N40"), { teamCode: "66", score: 107 }, { teamCode: "50", score: 109 }, () => null)!;
assert.equal(n40.winning?.nameKo, "윤원상");
assert.equal(n40.winning?.remaining, 3);
assert.equal(n40.winning?.buzzer, false);
assert.equal(winningLine(n40.winning!, "66"), "4쿼터 0:03 2점슛 107-107 → 109-107");
// 25-26 개막전 SK 연장 승: 앞서 나간 득점이 연장 3:36 → 위닝샷 없음
const n1 = analyzeClutch(real(47, "S47G01N1"), { teamCode: "50", score: 81 }, { teamCode: "55", score: 89 }, () => null)!;
assert.equal(n1.winning, null);
assert.ok(n1.lines.length > 0);
console.log("clutch: 실제 경기 통과");

// ── 알림·홈 "새로 나온 기록" ──
import { buildNotifItems, featGroups, homeFeatItems } from "../lib/notifications";
import { collectPlayerClutch, sumClutchTotals } from "../lib/clutch";
import type { SeasonGame } from "../lib/types";
const shot = n36.winning!;
const game: SeasonGame = {
  gmkey: "S49G01N36", date: "2026-10-24", start: "16:30", stadium: null, ended: true,
  home: { teamCode: "66", name: "고양 소노", score: 97 }, away: { teamCode: "60", name: "부산 KCC", score: 96 },
  box: null, winning: { ...shot, id: "291488" }, clutch: [{ id: "291488", nameKo: "이정현", teamCode: "66", pts: 5, fgm: 2, fga: 2, tpm: 1, tpa: 1, ftm: 0, fta: 0 }],
};
const items = buildNotifItems([game], { seasonCode: 49, teamShort: { "66": "소노", "60": "KCC" }, careerHighs: {}, careerSums: {} });
const w = items.find((it) => it.kind === "winning_shot")!;
assert.ok(w);
assert.equal(w.player, "291488");
assert.deepEqual(w.teams, ["66"]);
assert.equal(w.title, "이정현 버저비터");
assert.equal(w.body, "소노 97 : 96 KCC · 4쿼터 0:00 3점슛 94-96 → 97-96");
const home = featGroups(homeFeatItems(items, []));
assert.equal(home[0].lines[0].level, "buzzer");
// 선수별 모으기
const idx = collectPlayerClutch([{ seasonCode: 49, games: [game] }]);
const p = idx.get("291488")!;
assert.equal(p.shots.length, 1);
assert.equal(p.shots[0].oppCode, "60");
const tot = sumClutchTotals(p.seasons.values());
assert.deepEqual([tot.pts, tot.winning, tot.buzzer, tot.games], [5, 1, 1, 1]);
console.log("clutch: 알림·홈·선수별 모으기 통과");
