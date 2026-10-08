// scripts/boxscores.ts·lib/games.ts 검증: 경기 목록 + 경기별 기록 → 박스스코어(득점 합 확인)·최근/다음 경기일·팀 순위 (npm run test:games)
import assert from "node:assert/strict";
import type { GameBoxRow } from "../lib/types";
import { buildSeasonGames, parseBoxLog } from "../scripts/boxscores";
import { seasonProgress, seasonTitle, standoutLine, teamStandouts } from "../lib/games";
import { asOfLabel, computeStandings, dayTopPerformers, gameDayLabel, gamesBehindLabel, latestGameDay, minutesLabel, nextGameDay, pctLabel, topPerformer } from "../lib/games";

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
{
  const top = dayTopPerformers(latestGameDay(games)!, 2);
  assert.equal(top.length, 2);
  assert.ok(top.every((t) => /득점/.test(t.line)));
}
assert.equal(gameDayLabel("2026-10-03"), "10월 3일 (토)");
assert.equal(asOfLabel("2026-10-07"), "10월 7일 경기까지 반영");
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

{
  const { groupByDate, monthsOf, pickMonth, sortBoxRows, monthLabel } = await import("../lib/games");
  const gs = [{ date: "2026-10-04" }, { date: "2026-10-03" }, { date: "2026-10-03" }, { date: "2027-01-02" }];
  assert.deepEqual(groupByDate(gs).map((d) => `${d.date}:${d.games.length}`), ["2026-10-03:2", "2026-10-04:1", "2027-01-02:1"]);
  const ms = monthsOf(gs);
  assert.deepEqual(ms, ["2026-10", "2027-01"]);
  assert.equal(monthLabel("2027-01"), "1월");
  assert.equal(pickMonth(ms, "2026-10-20"), "2026-10");
  assert.equal(pickMonth(ms, "2026-11-20"), "2027-01");  // 경기 없는 달 → 다음 달
  assert.equal(pickMonth(ms, "2027-05-01"), "2027-01");  // 시즌 뒤 → 마지막 달
  assert.equal(pickMonth(ms, "2026-09-01"), "2026-10");  // 시즌 앞 → 첫 달
  assert.equal(pickMonth([], "2026-09-01"), null);
  const r = (nameKo: string, pts: number, fgm: number, fga: number, tov = 0) => ({ id: nameKo, nameKo, sec: 600, pts, oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov, pf: 0, fgm, fga, tpm: 0, tpa: 0, ftm: 0, fta: 0 });
  const rows = [r("가", 10, 4, 8), r("나", 20, 8, 20, 3), r("다", 0, 0, 0, 1)];
  assert.deepEqual(sortBoxRows(rows, "pts").map((x) => x.nameKo), ["나", "가", "다"]);
  assert.deepEqual(sortBoxRows(rows, "fgPct").map((x) => x.nameKo), ["가", "나", "다"]); // 시도 0 은 뒤로
  assert.deepEqual(sortBoxRows(rows, "tov").map((x) => x.nameKo), ["나", "다", "가"]);
  const t = [{ ...r("가", 3, 1, 1), tpm: 1, tpa: 3, ftm: 2, fta: 2 }, { ...r("나", 3, 1, 1), tpm: 2, tpa: 4, ftm: 0, fta: 0 }];
  assert.deepEqual(sortBoxRows(t, "tpPct").map((x) => x.nameKo), ["나", "가"]);
  assert.deepEqual(sortBoxRows(t, "ftPct").map((x) => x.nameKo), ["가", "나"]); // 시도 0 은 뒤로
  // 시즌 진행률·홈 제목 (2026-10-04)
  {
    const mk = (ended: boolean) => ({ ended }) as unknown as Parameters<typeof seasonProgress>[0][number];
    assert.equal(seasonProgress([]), null);
    assert.deepEqual(seasonProgress([...Array(5)].map(() => mk(true)).concat([...Array(265)].map(() => mk(false)))), { ended: 5, total: 270, pct: 1.9 });
    assert.equal(seasonProgress([mk(true), mk(true)])!.pct, 100);
    assert.equal(seasonTitle("2026-2027"), "KBL 2026-2027 시즌");
  }
  // 팀별 주요 선수 2명 (2026-10-05)
  {
    const p = (id: string, o: Partial<GameBoxRow>) => ({ id, nameKo: id, sec: 1000, pts: 0, oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, ...o }) as GameBoxRow;
    const rows = [p("A", { pts: 26, reb: 6, ast: 9 }), p("B", { pts: 14, tpm: 4 }), p("C", { pts: 9, ast: 8 }), p("D", { pts: 4, reb: 7 })];
    // 득점 1위 A, 그 밖에서 어시 8/5=1.6 > 3점 4/3=1.33 → C(어시)
    assert.deepEqual(teamStandouts(rows).map((x) => [x.kind, x.row.id]), [["points", "A"], ["ast", "C"]]);
    assert.equal(standoutLine(teamStandouts(rows)[1]), "8어시 · 9득점");
    // 문턱을 넘는 부문이 없으면 득점 2위
    const quiet = [p("A", { pts: 20 }), p("B", { pts: 12, ast: 3 }), p("C", { pts: 6, reb: 5 })];
    assert.deepEqual(teamStandouts(quiet).map((x) => [x.kind, x.row.id]), [["points", "A"], ["points", "B"]]);
    // 수비: 스틸+블록
    const def = [p("A", { pts: 20 }), p("B", { pts: 5, stl: 3, blk: 1 })];
    assert.equal(standoutLine(teamStandouts(def)[1]), "스틸 3·블록 1 · 5득점");
    assert.deepEqual(teamStandouts([]), []);
    assert.equal(teamStandouts([p("A", { pts: 3 })]).length, 1);
  }
  console.log("games: 일정·박스스코어 정렬 통과");
}

// ── 일정 내 응원팀만 (2026-10-06) ──
{
  const { gamesOfTeams, initialScheduleScope } = await import("../lib/games");
  const g = (h: string, a: string) => ({ home: { teamCode: h }, away: { teamCode: a } });
  const list = [g("16", "55"), g("60", "50"), g("10", "16"), g("66", "70")];
  assert.equal(gamesOfTeams(list, ["16"]).length, 2, "홈·원정 모두");
  assert.equal(gamesOfTeams(list, ["16", "70"]).length, 3, "응원팀 여러 개");
  assert.equal(gamesOfTeams(list, []).length, 0);
  assert.equal(initialScheduleScope(null, true), "mine", "처음엔 내 응원팀");
  assert.equal(initialScheduleScope("all", true), "all", "전체를 골랐으면 기억");
  assert.equal(initialScheduleScope("mine", false), "all", "이 시즌 응원팀 경기가 없으면 전체");
  assert.equal(initialScheduleScope("엉뚱", true), "mine");
  console.log("games: 내 응원팀 일정 통과");
}

// 이 경기 포인트 (2026-10-08 B-8)
{
  const { gameKeyPoints } = await import("../lib/games");
  const p = (id: string, o: Partial<GameBoxRow>) => ({ id, nameKo: id, sec: 1000, pts: 0, oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, ...o }) as GameBoxRow;
  const g = (hs: number, as: number, home: GameBoxRow[], away: GameBoxRow[]) =>
    ({ gmkey: "S1G01N1", date: "2026-10-08", start: null, stadium: null, ended: true, home: { teamCode: "1", name: "H", score: hs }, away: { teamCode: "2", name: "A", score: as }, box: { home, away } }) as const;
  const names = { home: "홈", away: "원정" };
  // 2점 차 접전 + 트리플더블 + 리바운드 12개 더
  const close = g(80, 78, [p("가", { pts: 15, reb: 20, ast: 10 }), p("나", { pts: 31, fgm: 12, fga: 20 })], [p("다", { pts: 20, reb: 8 })]);
  assert.deepEqual(gameKeyPoints(close, names), ["홈 2점 차 접전 끝에 승리", "가(홈) 트리플더블 · 15점 20리바 10어시", "홈 리바운드 12개 더 (20-8)"]);
  // 대승 + 30점(3점 3개 이상) · 팀 차이 없음
  const blow = g(70, 95, [p("가", { pts: 10, reb: 5 })], [p("다", { pts: 33, fgm: 11, fga: 18, tpm: 4, reb: 3 })]);
  assert.deepEqual(gameKeyPoints(blow, names), ["원정 25점 차 대승", "다(원정) 33점 · 야투 11/18 · 3점 4개"]);
  // 진 팀이 턴오버 적음
  const tov = g(85, 80, [p("가", { pts: 20, tov: 15 })], [p("다", { pts: 20, tov: 8 })]);
  assert.deepEqual(gameKeyPoints(tov, names), ["원정 턴오버 7개 적음 (8-15)"]);
  // 박스스코어가 없거나 안 끝난 경기는 없음
  assert.deepEqual(gameKeyPoints({ ...close, box: null }, names), []);
  assert.deepEqual(gameKeyPoints({ ...close, ended: false }, names), []);
  console.log("games: 이 경기 포인트 통과");
}

// 응원팀 경기 먼저 (2026-10-08 C-11)
{
  const { myTeamsFirst } = await import("../lib/games");
  const m = (h: string, a: string) => ({ home: { teamCode: h }, away: { teamCode: a } });
  const games = [m("10", "16"), m("50", "60"), m("55", "70"), m("66", "50")];
  const key = (list: { home: { teamCode: string }; away: { teamCode: string } }[]) => list.map((g) => `${g.home.teamCode}-${g.away.teamCode}`);
  assert.deepEqual(key(myTeamsFirst(games, ["70", "50"])), ["55-70", "50-60", "66-50", "10-16"], "첫 응원팀 경기가 맨 앞, 나머지는 원래 순서");
  assert.deepEqual(key(myTeamsFirst(games, [])), key(games));
  assert.deepEqual(key(myTeamsFirst(games, ["99"])), key(games));
  console.log("games: 응원팀 경기 먼저 통과");
}
