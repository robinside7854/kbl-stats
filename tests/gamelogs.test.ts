// scripts/gamelogs.ts 검증: 경기별 기록 파싱·날짜 매칭·시도 수 붙이기·백필 대상 선정 (npm run test:gamelogs)
import assert from "node:assert/strict";
import {
  attachShotAttempts,
  gamelogTargets,
  groupTargetsBySeason,
  isGameLogResponse,
  parseGameLog,
  shotAttemptsFor,
  type GameLogRow,
} from "../scripts/gamelogs";
import { emptyHighsSet } from "../lib/highs";
import type { HighRecord, HighsSet } from "../lib/types";

// ── 응답 형식·파싱 ──
const game = (patch: Record<string, unknown>) => ({
  gameNo: "101", gameDate: "20260406", awayTeam: "55", playSec: 1800, pts: 30,
  fg: 6, fgA: 10, fgRt: 60, threep: 4, threepA: 9, threepRt: 44.4, fdg: 10, fdgA: 19, fdgRt: 52.6,
  ft: 6, ftA: 8, ftRt: 75, rb: 7, aS: 3, ...patch,
});
const body = { RegularGameRecords: [game({}), game({ gameNo: 102, gameDate: "20260410", threep: "8", threepA: "12", ft: 0, ftA: 0 })], PlayoffGameRecords: [] };

assert.equal(isGameLogResponse(body), true);
assert.equal(isGameLogResponse(JSON.stringify(body)), true);   // 문자열로 한 번 더 감싼 응답
assert.equal(isGameLogResponse({ RegularGameRecords: [] }), true); // 경기 0 (개막 전) 도 정상 응답
assert.equal(isGameLogResponse({}), false);
assert.equal(isGameLogResponse(""), false);
assert.equal(isGameLogResponse("<html>"), false);
assert.equal(isGameLogResponse([]), false);

const rows = parseGameLog(body);
assert.equal(rows.length, 2);
assert.deepEqual(rows[0], { date: "2026-04-06", gameNo: "101", fgm: 10, fga: 19, tpm: 4, tpa: 9, ftm: 6, fta: 8 }); // 야투 = fdg(전체), fg(2점) 아님
assert.equal(rows[1].gameNo, "102");
assert.equal(rows[1].tpm, 8);                                  // 숫자 문자열도 숫자로
assert.deepEqual(parseGameLog(null), []);
assert.deepEqual(parseGameLog({ foo: 1 }), []);
assert.deepEqual(parseGameLog({ RegularGameRecords: [null, 3, game({ gameDate: "bad" })] }).map((r) => r.date), [null]);
console.log("gamelogs: 파싱 통과");

// ── 날짜 매칭 ──
assert.deepEqual(shotAttemptsFor("tpm", { value: 8, date: "2026-04-10" }, rows), { attempts: 12, pct: 66.7 });
assert.deepEqual(shotAttemptsFor("ftm", { value: 6, date: "2026-04-06" }, rows), { attempts: 8, pct: 75 });
assert.deepEqual(shotAttemptsFor("fgm", { value: 10, date: "2026-04-06" }, rows), { attempts: 19, pct: 52.6 });
assert.equal(shotAttemptsFor("tpm", { value: 8, date: "2026-04-11" }, rows), null);  // 같은 날 경기 없음
assert.equal(shotAttemptsFor("tpm", { value: 5, date: "2026-04-10" }, rows), null);  // 성공 개수가 다르면 다른 경기 → 붙이지 않음
assert.equal(shotAttemptsFor("tpm", { value: 8, date: null }, rows), null);
assert.equal(shotAttemptsFor("pts", { value: 30, date: "2026-04-06" }, rows), null); // 득점에는 붙이지 않는다
assert.equal(shotAttemptsFor("ftm", { value: 0, date: "2026-04-10" }, rows), null);  // 시도 0 → 성공률 없음
console.log("gamelogs: 날짜 매칭 통과");

// ── 세트에 붙이기 ──
const rec = (value: number, date: string | null, seasonCode: number | null = 47): HighRecord => ({ value, date, opponentTeamCode: "55", times: 1, seasonCode });
const set: HighsSet = { ...emptyHighsSet(), pts: rec(30, "2026-04-06"), tpm: rec(8, "2026-04-10"), ftm: rec(11, "2026-01-01"), fgm: rec(12, "2024-01-01", 45) };
const logs = new Map<number, GameLogRow[]>([[47, rows]]);
const out = attachShotAttempts(set, (s) => logs.get(s))!;
assert.deepEqual([out.tpm!.attempts, out.tpm!.pct], [12, 66.7]);
assert.deepEqual([out.ftm!.attempts, out.ftm!.pct], [null, null]); // raw 는 있는데 그날 경기 없음 → null
assert.ok(!("attempts" in out.fgm!));                             // 45 시즌 raw 없음 → 손대지 않음
assert.ok(!("attempts" in out.pts!));                             // 득점은 그대로
assert.ok(!("attempts" in set.tpm!));                             // 원본 세트는 바꾸지 않는다
assert.equal(out.tpm!.value, 8);
assert.equal(attachShotAttempts(null, () => rows), null);
// 기록에 시즌 코드가 없으면 fallbackSeason
const noSeason = { ...emptyHighsSet(), tpm: rec(8, "2026-04-10", null) };
assert.equal(attachShotAttempts(noSeason, (s) => logs.get(s), 47)!.tpm!.attempts, 12);
assert.ok(!("attempts" in attachShotAttempts(noSeason, (s) => logs.get(s))!.tpm!));
console.log("gamelogs: 시도 수 붙이기 통과");

// ── 백필 대상 선정 ──
const reg = (patch: Partial<HighsSet>) => ({ regular: { ...emptyHighsSet(), ...patch } });
const targets = gamelogTargets([
  // 득점·3점·자유투가 서로 다른 시즌 → 3개. 리바운드 시즌(41)은 대상 아님
  { id: "100", careerHighs: reg({ pts: rec(40, "2024-01-01", 45), tpm: rec(8, "2022-01-01", 41 + 2), ftm: rec(12, "2020-01-01", 39), reb: rec(20, "2019-01-01", 41) }) },
  // 세 기록이 같은 시즌 → 1개 (중복 제거)
  { id: "200", careerHighs: reg({ pts: rec(30, "2026-01-01", 47), tpm: rec(5, "2026-01-02", 47), ftm: rec(9, "2026-01-03", 47) }) },
  // 값 0·시즌 없음·기록 없음 → 제외
  { id: "300", careerHighs: reg({ pts: rec(0, "2026-01-01", 47), tpm: rec(3, "2026-01-01", null) }) },
  { id: "400", careerHighs: { regular: null } },
  { id: "500", careerHighs: null },
  { id: "600" },
  { id: "700", careerHighs: reg({ ftm: rec(4, "2026-01-01", 47) }) },
]);
assert.deepEqual(
  targets.map((t) => `${t.seasonCode}/${t.playerNo}`),
  ["47/200", "47/700", "45/100", "43/100", "39/100"], // 최신 시즌 먼저, 같은 시즌은 선수 번호 순
);
assert.deepEqual(gamelogTargets([]), []);
const grouped = groupTargetsBySeason(targets);
assert.deepEqual([...grouped.keys()], [47, 45, 43, 39]);
assert.deepEqual(grouped.get(47), ["200", "700"]);
console.log("gamelogs: 백필 대상 통과");
