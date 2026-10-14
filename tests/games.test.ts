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
assert.equal(rows[0].streakKind, "W");
assert.equal(rows[0].streakCount, 2);
{
  const { notableStreak } = await import("../lib/games");
  assert.deepEqual(notableStreak(rows[0]), { label: "2연승", kind: "W" });
  // C: L W L L → 2연패
  assert.deepEqual(notableStreak(rows[2]), { label: "2연패", kind: "L" });
  // 1연승은 안 보임
  assert.equal(notableStreak({ streakKind: "W", streakCount: 1 }), null);
  assert.equal(notableStreak({ streakKind: null, streakCount: 0 }), null);
}
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

// 일정 지난 경기 접기 (2026-10-09)
{
  const { splitPastDays } = await import("../lib/games");
  const d = (date: string) => ({ date });
  const days = [d("2026-10-03"), d("2026-10-04"), d("2026-10-05"), d("2026-10-07"), d("2026-10-09"), d("2026-10-11")];
  const r = splitPastDays(days, "2026-10-09");
  assert.deepEqual(r.hidden.map((x) => x.date), ["2026-10-03", "2026-10-04"], "지난 4일 중 최근 2일만 보임");
  assert.deepEqual(r.visible.map((x) => x.date), ["2026-10-05", "2026-10-07", "2026-10-09", "2026-10-11"], "오늘·앞으로는 보임");
  assert.equal(splitPastDays(days, "2026-10-01").hidden.length, 0, "시즌 전이면 접을 것 없음");
  assert.deepEqual(splitPastDays(days, "2026-12-01").visible.map((x) => x.date), ["2026-10-09", "2026-10-11"], "지난 달은 마지막 2일만");
  assert.equal(splitPastDays(days, null).hidden.length, 0, "오늘을 모르면 접지 않음");
  console.log("games: 일정 지난 경기 접기 통과");
}

// 2026-10-14 스포츠 앱 비교: 팀 간 상대 전적·팀 경기 띠·선수 최근 경기
{
  const { headToHead, headToHeadWins, teamGameStrip, playerRecentGames } = await import("../lib/games");
  const mk = (n: number, date: string, h: string, a: string, sh: number | null, sa: number | null, box: SeasonGameBox = null) => ({
    gmkey: `S1G01N${n}`, date, start: "19:00", stadium: null, ended: sh !== null, box,
    home: { teamCode: h, name: `팀${h}`, score: sh }, away: { teamCode: a, name: `팀${a}`, score: sa },
  });
  type SeasonGameBox = { home: GameBoxRow[]; away: GameBoxRow[] } | null;
  const row = (id: string, pts: number, sec = 600): GameBoxRow => ({ id, nameKo: id, sec, pts, oreb: 0, dreb: 2, reb: 2, ast: 1, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 2, fga: 4, tpm: 1, tpa: 2, ftm: 0, fta: 0 });
  const list = [
    mk(1, "2026-10-01", "A", "B", 80, 70, { home: [row("p", 20)], away: [row("q", 10)] }),
    mk(2, "2026-10-02", "B", "A", 75, 70, { home: [row("q", 15)], away: [row("p", 8)] }),
    mk(3, "2026-10-03", "A", "C", 90, 60),
    mk(4, "2026-10-04", "C", "A", 85, 80, { home: [], away: [row("p", 0, 0)] }), // 출전 안 함
    mk(5, "2026-10-05", "A", "B", null, null),
    mk(6, "2026-10-06", "C", "A", null, null),
    mk(7, "2026-10-07", "A", "C", null, null),
  ];
  const h = headToHead(list);
  assert.deepEqual(h.get("A")?.get("B"), { wins: 1, losses: 1, pointsFor: 150, pointsAgainst: 145 });
  assert.deepEqual(h.get("C")?.get("A"), { wins: 1, losses: 1, pointsFor: 145, pointsAgainst: 170 });
  assert.equal(h.get("B")?.get("C"), undefined, "맞붙지 않은 팀은 없음");
  assert.deepEqual(headToHeadWins(["A", "B", "C"], list), [[0, 1, 1], [1, 0, 0], [1, 0, 0]]);

  const s = teamGameStrip(list, "A");
  assert.deepEqual(s.past.map((x) => x.gmkey), ["S1G01N2", "S1G01N3", "S1G01N4"], "지난 3경기 오래된 → 최근");
  assert.deepEqual(s.next.map((x) => x.gmkey), ["S1G01N5", "S1G01N6"], "다음 2경기");
  assert.deepEqual([s.past[0].win, s.past[0].home, s.past[0].teamScore, s.past[0].oppScore, s.past[0].oppCode], [false, false, 70, 75, "B"]);
  assert.equal(s.next[0].win, null);
  assert.equal(teamGameStrip(list, "Z").past.length, 0);

  const r = playerRecentGames(list, "p");
  assert.deepEqual(r.map((x) => `${x.gmkey}:${x.pts}:${x.win ? "W" : "L"}:${x.home ? "H" : "A"}`), ["S1G01N2:8:L:A", "S1G01N1:20:W:H"], "최근 먼저, 안 뛴 경기·박스 없는 경기 제외");
  assert.equal(playerRecentGames(list, "p", 1).length, 1);
  console.log("games: 상대 전적·경기 띠·최근 경기 통과");
}
