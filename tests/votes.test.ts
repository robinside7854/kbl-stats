// 팬 참여 (2026-10-16): 규칙(lib/votes) + 표 SQL(lib/server/votes) — SQL 은 메모리 Postgres(PGlite)로 실제 실행.
// tests/account.test.ts 끝에서 불러 npm test 에 같이 돈다 (따로: npx tsx tests/votes.test.ts)
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import type { GameBoxRow, SeasonGame } from "../lib/types";
import {
  buildVoteData, buildVoteWeek, candidateLine, fanMvp, highlightText, voteHighlightOf, hitRateLabel, isGmkey, isPickOpen, isVoteCandidate, parsePickSide, pickLockAt, pickShare,
  rankPickRows, settledGames, voteMinGames, voteResults, voteWeekKey, voteWeekLabel, weekKeyOfDate, weekStartOf,
} from "../lib/votes";
import { deleteMember, ensureSchema, linkLogin, resolveMemberId, updateProfile, type Query } from "../lib/server/members";
import { castVote, myPicks, myVotes, pickCounts, pickRanking, setPick, voteTallies } from "../lib/server/votes";

// ── 주 (한국 시간 월~일) ──
// 2026-10-12(월) 00:00 KST = 10-11 15:00 UTC
assert.equal(voteWeekKey(new Date("2026-10-11T15:00:00Z")), "2026-10-12");
assert.equal(voteWeekKey(new Date("2026-10-11T14:59:00Z")), "2026-10-05"); // 일요일 밤 23:59 KST 는 아직 지난주
assert.equal(voteWeekKey(new Date("2026-10-16T03:00:00Z"), -1), "2026-10-05");
assert.equal(weekKeyOfDate("2026-10-18"), "2026-10-12"); // 일요일 경기는 그 주
assert.equal(weekKeyOfDate("2026-10-19"), "2026-10-19");
assert.equal(weekStartOf("2026-10-12").toISOString(), "2026-10-11T15:00:00.000Z");
assert.equal(voteWeekLabel("2026-10-12"), "10.12(월) ~ 10.18(일)");
assert.equal(voteWeekLabel("2026-12-28"), "12.28(월) ~ 1.3(일)");
console.log("votes: 주 통과");

// ── 후보 ──
const row = (id: string, pts: number, reb = 0, ast = 0, sec = 1200): GameBoxRow => ({
  id, nameKo: `선수${id}`, sec, pts, oreb: 0, dreb: reb, reb, ast, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
});
let n = 0;
const game = (date: string, home: string, away: string, h: GameBoxRow[], a: GameBoxRow[], opts: Partial<SeasonGame> = {}): SeasonGame => ({
  gmkey: `S49G01N${++n}`, date, start: "19:00", stadium: null, ended: true,
  home: { teamCode: home, name: home, score: h.reduce((s, r) => s + r.pts, 0) },
  away: { teamCode: away, name: away, score: a.reduce((s, r) => s + r.pts, 0) },
  box: { home: h, away: a }, ...opts,
});
const games: SeasonGame[] = [
  game("2026-10-13", "10", "20", [row("1", 30, 10, 5), row("2", 10)], [row("3", 20, 5, 5), row("9", 0, 0, 0, 0)]),
  game("2026-10-15", "10", "30", [row("1", 10, 2, 2), row("2", 12)], [row("4", 40, 10, 0)]),
  game("2026-10-16", "20", "30", [row("3", 22, 6, 4)], [row("4", 2)]),
  // 지난주
  game("2026-10-07", "10", "20", [row("1", 5)], [row("3", 50)]),
  // 아직 안 한 경기
  game("2026-10-18", "10", "20", [], [], { ended: false, box: null, start: "14:00", home: { teamCode: "10", name: "10", score: null }, away: { teamCode: "20", name: "20", score: null } }),
];
// 팀 경기 수 가운데값: 10=2, 20=2, 30=2 → 2경기 이상만 후보 (출전 0초 선수는 경기에 안 셈)
assert.equal(voteMinGames(new Map([["a", 1], ["b", 2], ["c", 1]])), 1);
assert.equal(voteMinGames(new Map([["a", 2], ["b", 2], ["c", 1]])), 2);
assert.equal(voteMinGames(new Map()), 1);
const wk = buildVoteWeek(games, "2026-10-12", (id) => (id === "1" ? "photo1" : null))!;
assert.equal(wk.minGames, 2);
// 팀마다 한 명, 눈에 띈 정도(경기당 ÷ 문턱 중 가장 큰 값) 순
// 3번(20팀) 득점 21 → 1.05 / 4번(30팀) 득점 21 → 1.05(나머지 합이 3번보다 작아 뒤) / 1번(10팀) 득점 20 → 1.0, 같은 팀 2번(11점)은 빠짐
assert.deepEqual(wk.players.map((p) => [p.id, p.score, p.highlight]), [["3", 1.05, "pts"], ["4", 1.05, "pts"], ["1", 1, "pts"]]);
assert.equal(wk.players[2].photoUrl, "photo1");
assert.equal(wk.players[1].teamCode, "30");
assert.equal(candidateLine(wk.players[0]), "2경기 21.0점 5.5리바 4.5어시");
assert.equal(highlightText(wk.players[0]), "득점 21.0");
// 득점이 아니어도 눈에 띈 부문으로: 리바 14 → 1.4
assert.deepEqual(voteHighlightOf({ pts: 8, reb: 14, ast: 2, tpm: 0, stl: 1, blk: 1 }).key, "reb");
assert.deepEqual(voteHighlightOf({ pts: 6, reb: 3, ast: 2, tpm: 0, stl: 3, blk: 2 }).key, "def");
// 그 주 1경기만 한 팀도 한 명은 나온다 (가운데값 2경기라 다른 팀은 2경기 이상만)
const wk2 = buildVoteWeek([...games, game("2026-10-14", "40", "50", [row("5", 8, 14, 2)], [row("6", 5), row("7", 4, 2, 9)])], "2026-10-12")!;
assert.equal(wk2.minGames, 2);
assert.deepEqual(wk2.players.map((p) => [p.id, p.highlight]), [["5", "reb"], ["7", "ast"], ["3", "pts"], ["4", "pts"], ["1", "pts"]]);
assert.equal(new Set(wk2.players.map((p) => p.teamCode)).size, wk2.players.length);
assert.equal(buildVoteWeek(games, "2026-09-28"), null);

const data = buildVoteData(49, games, () => null, new Date("2026-10-16T00:00:00Z"));
assert.deepEqual(data.weeks.map((w) => w.week), ["2026-10-12", "2026-10-05"]);
assert.equal(data.weeks[1].minGames, 1); // 지난주는 한 경기씩
assert.equal(data.games.length, 5);
assert.equal(data.games[0].winner, "home");
assert.equal(data.games[4].winner, null);
assert.ok(isVoteCandidate(data.weeks, "2026-10-12", "4"));
assert.ok(!isVoteCandidate(data.weeks, "2026-10-12", "9")); // 출전 0초
assert.ok(!isVoteCandidate(data.weeks, "2026-10-19", "4")); // 다른 주
assert.ok(!isVoteCandidate(data.weeks, "2026-10-12", 4));
assert.ok(!isVoteCandidate(data.weeks, "2026-10-12", "4' OR 1=1"));

// 표 결과: 표 많은 순, 같으면 기록 순
const res = voteResults(wk, { week: wk.week, counts: { "4": 3, "1": 3, "3": 1 }, total: 7 });
assert.deepEqual(res.map((r) => [r.candidate.id, r.votes, r.pct]), [["4", 3, 43], ["1", 3, 43], ["3", 1, 14]]);
assert.equal(fanMvp(wk, null), null);
assert.equal(fanMvp(wk, { week: wk.week, counts: {}, total: 0 }), null);
assert.equal(fanMvp(wk, { week: wk.week, counts: { "1": 1 }, total: 1 })?.candidate.id, "1");
console.log("votes: 후보·표 결과 통과");

// ── 승부 예측 규칙 ──
assert.equal(pickLockAt({ date: "2026-10-16", start: "19:00" }).toISOString(), "2026-10-16T10:00:00.000Z");
assert.equal(pickLockAt({ date: "2026-10-17", start: null }).toISOString(), "2026-10-17T05:00:00.000Z"); // 모르면 14시
assert.equal(pickLockAt({ date: "2026-10-17", start: "9:30" }).toISOString(), "2026-10-17T00:30:00.000Z");
const up = { date: "2026-10-16", start: "19:00", ended: false };
assert.ok(isPickOpen(up, new Date("2026-10-16T09:59:59Z")));
assert.ok(!isPickOpen(up, new Date("2026-10-16T10:00:00Z"))); // 시작 시각에 마감
assert.ok(!isPickOpen({ ...up, ended: true }, new Date("2026-10-10T00:00:00Z"))); // 끝난 경기
assert.equal(parsePickSide("home"), "home");
assert.equal(parsePickSide("HOME"), null);
assert.ok(isGmkey("S49G01N12"));
assert.ok(!isGmkey("S49G01N12;"));
assert.ok(!isGmkey(12));
assert.deepEqual(pickShare([3, 1]), { side: "home", pct: 75, total: 4 });
assert.deepEqual(pickShare([1, 2]), { side: "away", pct: 67, total: 3 });
assert.equal(pickShare([0, 0]), null);
assert.equal(pickShare(undefined), null);
assert.equal(hitRateLabel({ hits: 7, total: 10 }), "70%");
assert.equal(hitRateLabel({ hits: 0, total: 0 }), "–");
assert.deepEqual(
  rankPickRows([
    { nickname: "a", teamCode: null, hits: 8, total: 10 },
    { nickname: "b", teamCode: null, hits: 7, total: 10 },
    { nickname: "c", teamCode: null, hits: 7, total: 10 },
    { nickname: "d", teamCode: null, hits: 7, total: 12 },
  ]).map((r) => r.rank),
  [1, 2, 2, 4],
);
const settled = settledGames(data.games);
assert.equal(settled.gmkeys.length, 4);
console.log("votes: 승부 예측 규칙 통과");

// ── 표 SQL (PGlite) ──
{
  const db = new PGlite();
  const q: Query = async (text, params) => (await db.query(text, params ?? [])).rows as Record<string, unknown>[];
  await ensureSchema(q);
  await ensureSchema(q); // 두 번 돌려도 그대로

  // 팬 MVP: 한 주 한 표, 바꾸면 덮어씀
  await castVote(q, "google:a", "2026-10-12", "4");
  await castVote(q, "google:b", "2026-10-12", "4");
  await castVote(q, "google:c", "2026-10-12", "1");
  await castVote(q, "google:a", "2026-10-12", "3"); // 바꾸기
  await castVote(q, "google:a", "2026-10-05", "3"); // 지난주는 따로
  let [cur, last] = await voteTallies(q, ["2026-10-12", "2026-10-05"]);
  assert.deepEqual(cur, { week: "2026-10-12", counts: { "4": 1, "1": 1, "3": 1 }, total: 3 });
  assert.equal(last.total, 1);
  assert.deepEqual(await myVotes(q, "google:a", ["2026-10-12", "2026-10-05"]), { "2026-10-12": "3", "2026-10-05": "3" });
  assert.deepEqual(await myVotes(q, "google:new", ["2026-10-12"]), {});

  // 승부 예측: 경기마다 한 번, 바꾸면 덮어씀
  await setPick(q, "google:a", "S49G01N1", "home");
  await setPick(q, "google:a", "S49G01N2", "away");
  await setPick(q, "google:a", "S49G01N2", "home"); // 바꾸기 (N2 는 홈 10번 22점 vs 원정 40점 → 원정 승)
  await setPick(q, "google:b", "S49G01N1", "away");
  await setPick(q, "google:b", "S48G01N1", "home"); // 다른 시즌
  assert.deepEqual(await pickCounts(q, "S49G"), { S49G01N1: [1, 1], S49G01N2: [1, 0] });
  assert.deepEqual(await pickCounts(q, "S49G%"), { S49G01N1: [1, 1], S49G01N2: [1, 0] }); // LIKE 특수 문자는 버림
  const mine = await myPicks(q, "google:a", "S49G", settled);
  assert.deepEqual(mine, { picks: { S49G01N1: "home", S49G01N2: "home" }, hits: 1, total: 2 });

  // 순위: 닉네임 회원·채점 minPicks 이상
  await updateProfile(q, "google:a", { nickname: "에이", teamCodes: ["55"] });
  await updateProfile(q, "google:c", { nickname: "씨" });
  await setPick(q, "google:c", "S49G01N1", "home");
  await setPick(q, "google:c", "S49G01N2", "away");
  let rk = await pickRanking(q, settled, 2);
  assert.deepEqual(rk.rows.map((r) => [r.rank, r.nickname, r.hits, r.total, r.teamCode]), [[1, "씨", 2, 2, null], [2, "에이", 1, 2, "55"]]);
  assert.equal(rk.members, 2);
  assert.equal((await pickRanking(q, settled)).rows.length, 0); // 기본 10경기 미만
  assert.equal((await pickRanking(q, { gmkeys: [], winners: [] }, 1)).rows.length, 0);
  // 닉네임 없는 b(1경기)는 minPicks 1 이어도 순위 밖
  rk = await pickRanking(q, settled, 1);
  assert.deepEqual(rk.rows.map((r) => r.nickname), ["씨", "에이"]);

  // 계정 합치기: 표·예측이 옮겨지고 같은 주·같은 경기는 지금 회원 것
  await castVote(q, "naver:a2", "2026-10-12", "1");
  await castVote(q, "naver:a2", "2026-09-28", "7");
  await setPick(q, "naver:a2", "S49G01N1", "away");
  await setPick(q, "naver:a2", "S49G01N3", "home");
  assert.deepEqual(await linkLogin(q, "google:a", "naver:a2"), { ok: true, merged: true });
  assert.deepEqual(await myVotes(q, "naver:a2", ["2026-10-12", "2026-09-28"]), { "2026-10-12": "3", "2026-09-28": "7" });
  const merged = await myPicks(q, "google:a", "S49G", settled);
  assert.deepEqual(merged.picks, { S49G01N1: "home", S49G01N2: "home", S49G01N3: "home" });
  [cur] = await voteTallies(q, ["2026-10-12"]);
  assert.equal(cur.total, 3); // 합친 쪽 표는 사라짐 (한 사람 한 표)

  // 탈퇴하면 표·예측도 지워진다
  const id = await resolveMemberId(q, "google:a");
  await deleteMember(q, "google:a");
  assert.equal((await q("SELECT count(*)::int AS n FROM member_votes WHERE member_id = $1", [id]))[0].n, 0);
  assert.equal((await q("SELECT count(*)::int AS n FROM member_picks WHERE member_id = $1", [id]))[0].n, 0);
  [cur] = await voteTallies(q, ["2026-10-12"]);
  assert.equal(cur.total, 2);
  await db.close();
  console.log("votes: 표 SQL(한 주 한 표·바꾸기·예측 덮어쓰기·수·적중·순위·합치기·탈퇴) 통과");
}
