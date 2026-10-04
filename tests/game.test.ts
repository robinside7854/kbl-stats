// lib/game.ts 검증: 시대 구간·칸·외국 선수 한도·슬롯 돌리기·전력·시즌 시뮬레이션·공유 주소 + 실제 풀로 난이도 (npm run test:game)
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  canPick, decodeLineupParam, emptyLineup, encodeLineupParam, GAME_FOREIGN_MAX, GAME_SEASON_GAMES, isLineupFull, openSlotsFor,
  pickBlockReason, placePick, sortByScore, filterByPositionChip, sortCandidatesBy, nextSort, lineupTotals, respinEra, respinTeam, seededRng, simulateSeason, sortCandidates, spin, spinCandidates, teamsOf, teamOfCandidate, GAME_SPIN_TEAMS, teamRating,
  winProbability, lineupBonuses, schoolChemistryComment, CHEM_SCHOOL_BONUS, CHEM_PRIME_BONUS, CHEM_CHAMP_PER, type GameCandidate, type GamePool, type Lineup, type Spin,
} from "../lib/game";
import type { Position } from "../lib/types";

const c = (id: string, position: Position, foreign = false, score = 50, axes = [50, 50, 50, 50, 50, 50], seasonCode = 47): GameCandidate => ({
  id, nameKo: `선수${id}`, seasonCode, season: "25-26", position, foreign, photoUrl: null, score, axes, ppg: 10, rpg: 5, apg: 3, spg: 1, bpg: 0.5, tpPct: 30,
  span: "25-26", seasonCount: 1,
});

// 칸: 가드 2 · 포워드 2 · 센터 1, GF 는 가드·포워드, FC 는 포워드·센터
let l: Lineup = emptyLineup();
assert.deepEqual(openSlotsFor(l, c("1", "G")), [0, 1]);
assert.deepEqual(openSlotsFor(l, c("1", "GF")), [0, 1, 2, 3]);
assert.deepEqual(openSlotsFor(l, c("1", "FC")), [2, 3, 4]);
assert.deepEqual(openSlotsFor(l, c("1", "C")), [4]);
l = placePick(placePick(l, 0, c("g1", "G")), 1, c("g2", "G"));
assert.equal(canPick(l, c("g3", "G")), false);
assert.equal(pickBlockReason(l, c("g3", "G")), "가드 칸 다 참");
assert.equal(canPick(l, c("gf", "GF")), true);                    // 가드는 찼어도 포워드 칸
assert.equal(canPick(l, c("g1", "F")), false);                    // 같은 선수(다른 시즌이어도) 두 번 금지
assert.equal(pickBlockReason(l, c("g1", "F")), "이미 뽑은 선수");
// 외국 선수 최대 2명
l = placePick(placePick(emptyLineup(), 0, c("f1", "G", true)), 4, c("f2", "C", true));
assert.equal(GAME_FOREIGN_MAX, 2);
assert.equal(canPick(l, c("f3", "F", true)), false);
assert.equal(pickBlockReason(l, c("f3", "F", true)), "외국 선수 2명 다 참");
assert.equal(canPick(l, c("d1", "F")), true);
assert.equal(isLineupFull(l), false);
console.log("game: 칸·외국 선수 한도 통과");

// 슬롯: 시즌 하나 + 팀 3개, 시즌 반복 가능, 고를 선수가 있는 팀만, 다시 돌리기
const team = (teamCode: string, cands: GameCandidate[]) => ({ teamCode, name: `팀${teamCode}`, logoUrl: null, color: { primary: "#000", secondary: "#fff" } as never, candidates: cands });
const season = (index: number, teams: ReturnType<typeof team>[]) => ({ index, label: `S${index}`, seasonCodes: [index], teams });
const pool5: GamePool = {
  eras: [
    season(0, [team("10", [c("a", "G")]), team("20", [c("b", "C", true)]), team("30", [c("c0", "F")]), team("40", [c("d0", "F")]), team("50", [c("e0", "G")])]),
    season(1, [team("10", [c("c", "F")]), team("30", [c("d", "G")]), team("60", [c("e", "C")])]),
  ],
};
assert.equal(GAME_SPIN_TEAMS, 3);
// 팀 3개, 서로 다르고 그 시즌 팀
for (let seed = 1; seed < 40; seed++) {
  const s = spin(pool5, emptyLineup(), seededRng(seed))!;
  assert.equal(s.teamCodes.length, 3);
  assert.equal(new Set(s.teamCodes).size, 3);
  for (const t of s.teamCodes) assert.ok(pool5.eras[s.era].teams.some((x) => x.teamCode === t));
  assert.equal(spinCandidates(pool5, s).length, 3);
}
// 두 시즌 다 나온다 (앞 라운드와 같은 시즌도 가능)
assert.deepEqual(new Set(Array.from({ length: 50 }, (_, i) => spin(pool5, emptyLineup(), seededRng(i + 1))!.era)), new Set([0, 1]));
// 고를 선수가 없는 팀은 안 나온다: 가드 칸이 차고 외국 선수가 다 차면 시즌 0 은 팀 30·40 둘만
const gFull = placePick(placePick(placePick(placePick(emptyLineup(), 0, c("g1", "G")), 1, c("g2", "G")), 2, c("x", "F", true)), 4, c("y", "C", true));
for (let seed = 1; seed < 50; seed++) {
  const s = spin(pool5, gFull, seededRng(seed))!;
  const allowed = s.era === 0 ? ["30", "40"] : ["10"];
  assert.deepEqual([...s.teamCodes].sort(), allowed);
}
// 팀 다시: 같은 시즌, 지금 팀은 빼고 새로 (남는 팀이 모자라면 지금 팀으로 채움)
const s0: Spin = { era: 0, teamCodes: ["10", "20", "30"] };
for (let seed = 1; seed < 30; seed++) {
  const r = respinTeam(pool5, s0, emptyLineup(), seededRng(seed))!;
  assert.equal(r.era, 0);
  assert.equal(r.teamCodes.length, 3);
  assert.ok(r.teamCodes.includes("40") && r.teamCodes.includes("50")); // 새 팀 둘은 반드시, 한 자리는 지금 팀에서
}
assert.equal(respinTeam({ eras: [season(0, [team("10", [c("a", "G")])])] }, { era: 0, teamCodes: ["10"] }, emptyLineup(), seededRng(1)), null); // 바꿀 팀이 없으면 null
// 시즌 다시: 다른 시즌, 지금 팀이 그 시즌에도 있으면 그대로 두고 없는 자리만 채움
for (let seed = 1; seed < 30; seed++) {
  const r = respinEra(pool5, s0, emptyLineup(), seededRng(seed))!;
  assert.equal(r.era, 1);
  assert.deepEqual(r.teamCodes.slice(0, 2), ["10", "30"]); // 시즌 1 에 있는 지금 팀(10·30)은 유지
  assert.equal(r.teamCodes[2], "60");
}
assert.equal(respinEra({ eras: [pool5.eras[0]] }, s0, emptyLineup(), seededRng(3)), null); // 시즌이 하나뿐이면 못 바꿈
// 겹치는 팀이 가장 많은 시즌을 고른다
const pool3: GamePool = { eras: [...pool5.eras, season(2, [team("10", [c("f", "G")]), team("20", [c("g", "F")]), team("30", [c("h", "C")])])] };
for (let seed = 1; seed < 30; seed++) assert.equal(respinEra(pool3, s0, emptyLineup(), seededRng(seed))!.era, 2);
// 후보 → 그 선수의 팀
const sp: Spin = { era: 1, teamCodes: ["10", "30", "60"] };
assert.deepEqual(teamsOf(pool5, sp).map((t) => t.teamCode), ["10", "30", "60"]);
assert.equal(teamOfCandidate(pool5, sp, pool5.eras[1].teams[1].candidates[0])?.teamCode, "30");
// 같은 선수는 시즌이 달라도 한 번만 (선수 번호로 판단)
const sameA = c("p1", "G", false, 80, undefined, 45);
const sameB = c("p1", "F", false, 90, undefined, 47);
const withA = placePick(emptyLineup(), 0, sameA);
assert.equal(canPick(withA, sameB), false);
assert.equal(pickBlockReason(withA, sameB), "이미 뽑은 선수");
// 화면 정렬은 득점순(점수 무관), 시뮬레이션 정렬은 점수순
assert.deepEqual(sortCandidates([{ ...c("1", "G", false, 90), ppg: 8 }, { ...c("2", "G", false, 60), ppg: 20 }]).map((x) => x.id), ["2", "1"]);
assert.deepEqual(sortByScore([{ ...c("1", "G", false, 90), ppg: 8 }, { ...c("2", "G", false, 60), ppg: 20 }]).map((x) => x.id), ["1", "2"]);
// 포지션 칩: 겸업은 두 칩에 / 정렬 칩: 내림·오름, 같으면 득점
const mix = [{ ...c("g", "G"), rpg: 2 }, { ...c("gf", "GF"), rpg: 4 }, { ...c("f", "F"), rpg: 6 }, { ...c("fc", "FC"), rpg: 8, ppg: 12 }, { ...c("cc", "C"), rpg: 8, ppg: 15 }];
assert.deepEqual(filterByPositionChip(mix, "G").map((x) => x.id), ["g", "gf"]);
assert.deepEqual(filterByPositionChip(mix, "F").map((x) => x.id), ["gf", "f", "fc"]);
assert.deepEqual(filterByPositionChip(mix, "C").map((x) => x.id), ["fc", "cc"]);
assert.equal(filterByPositionChip(mix, "all").length, 5);
assert.deepEqual(sortCandidatesBy(mix, "rpg", "desc").map((x) => x.id), ["cc", "fc", "f", "gf", "g"]); // 8·8 은 득점 높은 cc 먼저
assert.deepEqual(sortCandidatesBy(mix, "rpg", "asc").map((x) => x.id), ["g", "gf", "f", "cc", "fc"]);
// 머리글 정렬: 포지션 G→GF→F→FC→C, 팀 이름, 3P% 없는 선수는 방향과 관계없이 맨 뒤
assert.deepEqual(sortCandidatesBy(mix, "pos", "asc").map((x) => x.id), ["g", "gf", "f", "fc", "cc"]);
assert.deepEqual(sortCandidatesBy(mix, "pos", "desc").map((x) => x.id), ["cc", "fc", "f", "gf", "g"]);
const teamName: Record<string, string> = { g: "SK", gf: "KCC", f: "LG", fc: "DB", cc: "KT" };
assert.deepEqual(sortCandidatesBy(mix, "team", "asc", (x) => teamName[x.id]).map((x) => teamName[x.id]), ["DB", "KCC", "KT", "LG", "SK"]);
const tp = [{ ...c("a", "G"), tpPct: 40 }, { ...c("b", "G"), tpPct: null }, { ...c("d", "G"), tpPct: 25 }];
assert.deepEqual(sortCandidatesBy(tp, "tpPct", "desc").map((x) => x.id), ["a", "d", "b"]);
assert.deepEqual(sortCandidatesBy(tp, "tpPct", "asc").map((x) => x.id), ["d", "a", "b"]);
// 같은 열 다시 → 방향 전환, 다른 열 → 글자 열은 오름·숫자 열은 내림
assert.deepEqual(nextSort({ key: "ppg", dir: "desc" }, "ppg"), { key: "ppg", dir: "asc" });
assert.deepEqual(nextSort({ key: "ppg", dir: "desc" }, "name"), { key: "name", dir: "asc" });
assert.deepEqual(nextSort({ key: "name", dir: "asc" }, "tpPct"), { key: "tpPct", dir: "desc" });
assert.deepEqual(lineupTotals([c("1", "G"), c("2", "G")]), { ppg: 20, rpg: 10, apg: 6, spg: 2, bpg: 1 });
console.log("game: 슬롯 돌리기 통과");

// 가산점: 동문 케미(같은 학교 3명+)·프라임 타임(프라임 시즌 2명+)·우승 DNA(정규리그 1위 팀 1명당)
{
  const p = (id: string, extra: Partial<GameCandidate>) => ({ ...c(id, "G"), ...extra });
  const two = [p("a", { school: "연세대" }), p("b", { school: "연세대" }), p("c", { school: "고려대" }), p("d", {}), p("e", {})];
  assert.deepEqual(lineupBonuses(two), []); // 2명은 아님
  const three = [p("a", { school: "연세대", prime: true }), p("b", { school: "연세대" }), p("c", { school: "연세대", regularChamp: true }), p("d", { prime: true, regularChamp: true }), p("e", {})];
  const bs = lineupBonuses(three);
  assert.deepEqual(bs.map((b) => [b.key, b.points, b.detail]), [
    ["school", CHEM_SCHOOL_BONUS, "연세대 3명"],
    ["prime", CHEM_PRIME_BONUS, "프라임 시즌 2명"],
    ["champion", CHEM_CHAMP_PER * 2, "정규리그 1위 팀 2명"],
  ]);
  assert.ok(schoolChemistryComment(bs[0]).includes("연세대"));
  assert.ok(lineupBonuses([p("a", { prime: true })]).length === 0); // 프라임 1명은 아님
  // 전력 = 가산점 전 + 가산점, 100 상한
  const r3 = teamRating(three);
  assert.ok(Math.abs(r3.rating - (r3.base + CHEM_SCHOOL_BONUS + CHEM_PRIME_BONUS + CHEM_CHAMP_PER * 2)) < 1e-9);
  const top = [1, 2, 3, 4, 5].map((i) => p(String(i), { score: 99, axes: [100, 100, 100, 100, 100, 100], school: "중앙대", prime: true }));
  assert.equal(teamRating(top).rating, 100);
  console.log("game: 가산점 통과");
}

// 전력: 평균 75% + 축 최고값 평균 25%, 약점 축
const lineup5 = [c("1", "G", false, 80, [90, 10, 10, 90, 90, 90]), c("2", "G", false, 80, [10, 10, 10, 10, 10, 10]), c("3", "F", false, 80, [10, 10, 10, 10, 10, 10]), c("4", "F", false, 80, [10, 10, 10, 10, 10, 10]), c("5", "C", false, 80, [10, 10, 10, 10, 10, 10])];
const r = teamRating(lineup5);
assert.equal(r.avgScore, 80);
assert.ok(Math.abs(r.balance - (90 * 4 + 20) / 6) < 1e-9);
assert.ok(Math.abs(r.rating - (0.75 * 80 + 0.25 * r.balance)) < 1e-9);
assert.equal(r.weakest, "defense");
// 승리 확률: 오를수록 커지고, 99 이상이면 1
let prev = -1;
for (let x = 0; x <= 100; x += 0.5) {
  const p = winProbability(x);
  assert.ok(p >= prev && p >= 0 && p <= 1, `단조 ${x}`);
  prev = p;
}
assert.equal(winProbability(100), 1);
assert.ok(winProbability(99) < 0.995 && winProbability(96) >= 0.9); // 99 점이어도 54전 전승은 보장 안 됨(0.988^54 ≈ 52%)
// 시즌: 54경기, 같은 라인업 = 같은 성적
const res = simulateSeason(lineup5);
assert.equal(res.games.length, GAME_SEASON_GAMES);
assert.equal(res.wins + res.losses, GAME_SEASON_GAMES);
assert.deepEqual(simulateSeason(lineup5).games, res.games);
// 최고 점수(99) 다섯 명도 전승이 보장되지는 않는다 (전력 99.25 → 경기당 패배 약 3.5%)
const allStars = simulateSeason(lineup5.map((p) => ({ ...p, score: 99, axes: [100, 100, 100, 100, 100, 100] })));
assert.ok(allStars.rating.rating < 100 && allStars.wins >= 45);
// 전력 100 이면 전승 (곡선 끝점 확인용 가상 라인업)
const perfect = simulateSeason(lineup5.map((p) => ({ ...p, score: 100, axes: [100, 100, 100, 100, 100, 100] })));
assert.equal(perfect.wins, 54);
assert.equal(perfect.longestStreak, 54);
console.log("game: 전력·시즌 통과");

// 공유 주소
const pool2: GamePool = { eras: [{ index: 0, label: "A", seasonCodes: [47], teams: [team("10", lineup5)] }] };
let full: Lineup = emptyLineup();
lineup5.forEach((p, i) => (full = placePick(full, i, p)));
const param = encodeLineupParam(full);
assert.equal(param, "1:47,2:47,3:47,4:47,5:47");
assert.deepEqual(decodeLineupParam(pool2, param)?.map((p) => p.id), ["1", "2", "3", "4", "5"]);
assert.equal(decodeLineupParam(pool2, "2:47,1:47,3:47,5:47,4:47"), null);   // 센터 칸에 포워드
assert.equal(decodeLineupParam(pool2, "1:47,2:47,3:47"), null);
assert.equal(decodeLineupParam(pool2, "1:47,1:47,3:47,4:47,5:47"), null);
assert.equal(decodeLineupParam(pool2, null), null);
console.log("game: 공유 주소 통과");

// 실제 풀이 있으면 (빌드 후) 난이도 확인: 아무나 뽑기 / 매번 그 팀 득점 1위(화면에서 보이는 정보) / 숨은 점수 1위
// 전승 확률은 굴린 결과를 세지 않고 라인업마다 (경기 승리 확률)^54 를 평균 낸다 — 표본이 적어도 흔들리지 않게
const POOL = "public/game/pool.json";
if (existsSync(POOL)) {
  const pool: GamePool = JSON.parse(readFileSync(POOL, "utf8"));
  assert.ok(pool.eras.length >= 30); // 시즌마다 하나 (새 시즌이 생기면 늘어난다)
  type Strategy = "random" | "ppg" | "score";
  function lineupOf(kind: Strategy, seed: number): GameCandidate[] {
    const rng = seededRng(seed);
    let lu = emptyLineup();
    for (let i = 0; i < 5; i++) {
      const s = spin(pool, lu, rng)!;
      const opts = spinCandidates(pool, s).filter((x) => canPick(lu, x));
      const pick = kind === "random" ? opts[Math.floor(rng() * opts.length)] : kind === "ppg" ? sortCandidates(opts)[0] : sortByScore(opts)[0];
      lu = placePick(lu, openSlotsFor(lu, pick)[0], pick);
    }
    assert.ok(isLineupFull(lu));
    assert.ok(lu.filter((p) => p!.foreign).length <= GAME_FOREIGN_MAX);
    return lu as GameCandidate[];
  }
  const N = 5000;
  function measure(kind: Strategy) {
    const lineups = Array.from({ length: N }, (_, i) => lineupOf(kind, i + 1));
    const wins = lineups.map((l) => simulateSeason(l).wins).sort((x, y) => x - y);
    const perfect = lineups.reduce((sum, l) => sum + winProbability(teamRating(l).rating) ** GAME_SEASON_GAMES, 0) / N;
    return { median: wins[N / 2], perfect };
  }
  const rand = measure("random");
  const ppg = measure("ppg");
  const score = measure("score");
  console.log(
    `game: 실제 풀 — 아무나 중앙 ${rand.median}승 · 득점 1위만 중앙 ${ppg.median}승·전승 ${(ppg.perfect * 100).toFixed(2)}% · 점수 1위만 중앙 ${score.median}승·전승 ${(score.perfect * 100).toFixed(2)}%`,
  );
  assert.ok(rand.median >= 10 && rand.median <= 30, "아무나 뽑으면 20승 안팎");
  assert.ok(ppg.median >= 40, "득점 1위만 골라도 40승 이상");
  assert.ok(ppg.perfect > 0.004 && ppg.perfect < 0.012, "득점 1위만 고르면 전승 0.7% 안팎");
  assert.ok(score.perfect > ppg.perfect && score.perfect < 0.18, "숨은 점수까지 알면 더 높지만 18% 미만");
  // S급(종합 점수 95 이상) 5명 라인업: 전승 약 20% (2026-10-03 사용자 결정)
  const sCands = pool.eras.flatMap((e) => e.teams.flatMap((t) => t.candidates)).filter((x) => x.score >= 95);
  const srng = seededRng(7);
  const sLineups: GameCandidate[][] = [];
  while (sLineups.length < 2000) {
    let lu = emptyLineup();
    for (let t = 0; t < 200 && !isLineupFull(lu); t++) {
      const x = sCands[Math.floor(srng() * sCands.length)];
      if (canPick(lu, x)) lu = placePick(lu, openSlotsFor(lu, x)[0], x);
    }
    if (isLineupFull(lu)) sLineups.push(lu as GameCandidate[]);
  }
  const sPerfect = sLineups.reduce((sum, l) => sum + winProbability(teamRating(l).rating) ** GAME_SEASON_GAMES, 0) / sLineups.length;
  console.log(`game: S급 5명 전승 ${(sPerfect * 100).toFixed(1)}%`);
  assert.ok(sPerfect > 0.14 && sPerfect < 0.26, "S급 5명이면 전승 20% 안팎");
}

// 정규리그 1위 고르기 (우승 DNA 재료): 동률이면 공식 1위 이름으로, 공동 1위는 둘 다
{
  const { pickRegularChampions } = await import("../lib/game-pool");
  assert.deepEqual(pickRegularChampions([{ teamCode: "45", names: ["현대"] }], "현대"), ["45"]);
  assert.deepEqual(pickRegularChampions([{ teamCode: "10", names: ["현대모비스", "울산 모비스"] }, { teamCode: "06", names: ["KT", "부산 KT"] }], "모비스"), ["10"]);
  assert.deepEqual(pickRegularChampions([{ teamCode: "55", names: ["SK", "서울 SK"] }, { teamCode: "16", names: ["DB", "원주 DB"] }], "공동1위\n원주DB 서울SK"), ["55", "16"]);
  assert.deepEqual(pickRegularChampions([{ teamCode: "50", names: ["LG"] }], null), []); // 진행 중 시즌
  console.log("game: 정규리그 1위 통과");
}
console.log("game: 전부 통과");
