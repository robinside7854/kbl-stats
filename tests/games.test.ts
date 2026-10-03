// scripts/boxscores.ts·lib/games.ts 검증: 경기 목록 + 경기별 기록 → 박스스코어(득점 합 확인)·최근/다음 경기일·팀 순위 (npm run test:games)
import assert from "node:assert/strict";
import { buildSeasonGames, parseBoxLog } from "../scripts/boxscores";
import { computeStandings, gameDayLabel, gamesBehindLabel, latestGameDay, minutesLabel, nextGameDay, pctLabel, topPerformer } from "../lib/games";

const item = (n: number, date: string, h: string, a: string, sh: number | null, sa: number | null, ended = 1, gameCode = "01") => ({
  gmkey: `S49G${gameCode}N${n}`, seasonCode: 49, gameCode, gameNo: n, gameDate: date, gameStart: "1400", stadiumname: "사직",
  tcodeH: h, tcodeA: a, tnameH: `팀${h}`, tnameA: `팀${a}`, scoreH: sh, scoreA: sa, isEnded: ended,
});
const log = (gameNo: string, date: string, team: string, opp: string, pts: number, extra: Record<string, number> = {}) => ({
  RegularGameRecords: [{ gameNo, gameDate: date, teamCode: team, awayTeam: opp, playSec: 600, pts, rb: 3, aS: 1, threep: 1, threepA: 2, fdg: 3, fdgA: 6, ...extra }],
});

const list = [
  item(1, "20261003", "60", "50", 10, 12),
  item(2, "20261003", "66", "64", 5, 3),
  item(3, "20261004", "50", "66", null, null, 0),
  item(1, "20261003", "60", "50", 10, 12),          // gmkey 중복
  item(9, "20260924", "60", "50", 80, 70, 1, "14"), // 시범 경기는 뺀다
];
const logs = new Map([
  ["a", parseBoxLog(log("1", "20261003", "60", "50", 6))],
  ["b", parseBoxLog(log("1", "20261003", "60", "50", 4, { playSec: 900 }))],
  ["c", parseBoxLog(log("1", "20261003", "50", "60", 12))],
  ["d", parseBoxLog(log("2", "20261003", "66", "64", 5))],
  ["e", parseBoxLog(log("2", "20261003", "64", "66", 2))], // 원정 득점 합 2 ≠ 3 → 박스스코어 없음
]);
const games = buildSeasonGames(list, 49, logs, (id) => ({ a: "가", b: "나", c: "다" } as Record<string, string>)[id] ?? null);
assert.deepEqual(games.map((g) => g.gmkey), ["S49G01N1", "S49G01N2", "S49G01N3"]);
assert.equal(games[0].date, "2026-10-03");
assert.equal(games[0].start, "14:00");
assert.deepEqual(games[0].box?.home.map((r) => r.nameKo), ["나", "가"]); // 출전 시간 긴 순
assert.equal(games[0].box?.away[0].pts, 12);
assert.equal(games[0].box?.home[0].reb, 3);
assert.equal(games[1].box, null);           // 득점 합이 공식 점수와 다름
assert.equal(games[2].box, null);           // 안 끝난 경기
assert.equal(games[2].ended, false);
assert.equal(buildSeasonGames("깨진", 49, logs, () => null).length, 0);
assert.deepEqual(parseBoxLog({ nope: 1 }), []);
console.log("games: 박스스코어 맞추기 통과");

assert.equal(latestGameDay(games)?.date, "2026-10-03");
assert.equal(latestGameDay(games)?.games.length, 2);
assert.equal(nextGameDay(games, "2026-10-03")?.date, "2026-10-04");
assert.equal(latestGameDay([]), null);
assert.equal(gameDayLabel("2026-10-03"), "10월 3일 (토)");
assert.equal(minutesLabel(1958), "32:38");
assert.equal(topPerformer(games[0].box!.home)?.nameKo, "가");
console.log("games: 경기일·표기 통과");

// 팀 순위: A 3승 1패, B 2승 2패, C 1승 3패
const g = (n: number, date: string, h: string, a: string, sh: number, sa: number) => ({
  gmkey: `S1G01N${n}`, date, start: null, stadium: null, ended: true, box: null,
  home: { teamCode: h, name: h, score: sh }, away: { teamCode: a, name: a, score: sa },
});
const rows = computeStandings([
  g(1, "2026-10-01", "A", "B", 80, 70), g(2, "2026-10-02", "B", "C", 80, 70), g(3, "2026-10-03", "C", "A", 80, 70),
  g(4, "2026-10-04", "A", "C", 90, 70), g(5, "2026-10-05", "B", "A", 60, 70), g(6, "2026-10-06", "C", "B", 60, 75),
]);
assert.deepEqual(rows.map((r) => `${r.rank}${r.teamCode}${r.wins}-${r.losses}`), ["1A3-1", "2B2-2", "3C1-3"]);
assert.equal(rows[1].gamesBehind, 1);
assert.deepEqual(rows[0].last5, ["W", "L", "W", "W"]);
assert.equal(rows[0].streak, "2연승");
assert.equal(rows[0].homeWins, 2);
assert.equal(pctLabel(0.75), ".750");
assert.equal(pctLabel(1), "1.000");
assert.equal(gamesBehindLabel(0), "-");
assert.equal(gamesBehindLabel(1.5), "1.5");
console.log("games: 팀 순위 통과");
