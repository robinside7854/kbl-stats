// lib/game.ts 검증: 시대 구간·칸·외국 선수 한도·슬롯 돌리기·전력·시즌 시뮬레이션·공유 주소 + 실제 풀로 난이도 (npm run test:game)
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  canPick, decodeLineupParam, emptyLineup, encodeLineupParam, GAME_FOREIGN_MAX, GAME_SEASON_GAMES, isLineupFull, openSlotsFor,
  pickBlockReason, placePick, sortByScore, lineupTotals, respinEra, respinTeam, seededRng, simulateSeason, sortCandidates, spin, splitEras, teamOf, teamRating,
  winProbability, type GameCandidate, type GamePool, type Lineup, type Spin,
} from "../lib/game";
import type { Position } from "../lib/types";

// 시대 구간: 30개 → 4·4·4·4·4·5·5, 남는 시즌은 최근 구간
assert.deepEqual(splitEras(Array.from({ length: 30 }, (_, i) => i)).map((e) => e.length), [4, 4, 4, 4, 4, 5, 5]);
assert.deepEqual(splitEras([1, 2, 3, 4, 5, 6, 7]).map((e) => e.length), [1, 1, 1, 1, 1, 1, 1]);
assert.deepEqual(splitEras([1, 2, 3]), [[1], [2], [3]]);
assert.deepEqual(splitEras([]), []);
assert.deepEqual(splitEras(Array.from({ length: 30 }, (_, i) => i)).flat(), Array.from({ length: 30 }, (_, i) => i));
console.log("game: 시대 구간 통과");

const c = (id: string, position: Position, foreign = false, score = 50, axes = [50, 50, 50, 50, 50, 50], seasonCode = 47): GameCandidate => ({
  id, nameKo: `선수${id}`, seasonCode, season: "25-26", position, foreign, photoUrl: null, score, axes, ppg: 10, rpg: 5, apg: 3, spg: 1, bpg: 0.5,
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

// 슬롯: 구간은 반복 가능, 고를 선수가 있는 팀만, 다시 돌리기
const team = (teamCode: string, cands: GameCandidate[]) => ({ teamCode, name: `팀${teamCode}`, logoUrl: null, color: { primary: "#000", secondary: "#fff" } as never, candidates: cands });
const tiny: GamePool = {
  eras: [
    { index: 0, label: "A", seasonCodes: [1], teams: [team("10", [c("a", "G")]), team("20", [c("b", "C", true)])] },
    { index: 1, label: "B", seasonCodes: [2], teams: [team("10", [c("c", "F")]), team("30", [c("d", "G")])] },
  ],
};
// 구간 두 개 다 나온다 (앞 라운드와 같은 구간도 가능)
assert.deepEqual(new Set(Array.from({ length: 50 }, (_, i) => spin(tiny, emptyLineup(), seededRng(i + 1))!.era)), new Set([0, 1]));
// 고를 선수가 없는 구간은 안 나온다: 가드 칸이 차면 가드만 있는 팀(10·30)·외국 센터만 있는 팀은 빠진다
const gFull = placePick(placePick(placePick(emptyLineup(), 0, c("g1", "G")), 1, c("g2", "G")), 4, c("cc", "C"));
for (let seed = 1; seed < 50; seed++) assert.deepEqual(spin(tiny, gFull, seededRng(seed)), { era: 1, teamCode: "10" });
// 외국 선수가 다 찼으면 외국 선수만 있는 팀은 안 나온다
const full2 = placePick(placePick(emptyLineup(), 2, c("x", "F", true)), 3, c("y", "F", true));
for (let seed = 1; seed < 50; seed++) assert.notEqual(spin(tiny, full2, seededRng(seed))!.teamCode, "20");
const s0: Spin = { era: 0, teamCode: "10" };
assert.deepEqual(respinTeam(tiny, s0, emptyLineup(), seededRng(3)), { era: 0, teamCode: "20" });
assert.deepEqual(respinEra(tiny, s0, emptyLineup(), seededRng(3)), { era: 1, teamCode: "10" }); // 다른 구간, 같은 팀이 있으면 팀 유지
assert.equal(respinEra({ eras: [tiny.eras[0]] }, s0, emptyLineup(), seededRng(3)), null); // 구간이 하나뿐이면 못 바꿈
assert.equal(teamOf(tiny, { era: 1, teamCode: "30" })?.candidates[0].id, "d");
// 화면 정렬은 득점순(점수 무관), 시뮬레이션 정렬은 점수순
assert.deepEqual(sortCandidates([{ ...c("1", "G", false, 90), ppg: 8 }, { ...c("2", "G", false, 60), ppg: 20 }]).map((x) => x.id), ["2", "1"]);
assert.deepEqual(sortByScore([{ ...c("1", "G", false, 90), ppg: 8 }, { ...c("2", "G", false, 60), ppg: 20 }]).map((x) => x.id), ["1", "2"]);
assert.deepEqual(lineupTotals([c("1", "G"), c("2", "G")]), { ppg: 20, rpg: 10, apg: 6, spg: 2, bpg: 1 });
console.log("game: 슬롯 돌리기 통과");

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
assert.ok(winProbability(99) < 0.96 && winProbability(96) >= 0.9);
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
  assert.equal(pool.eras.length, 7);
  type Strategy = "random" | "ppg" | "score";
  function lineupOf(kind: Strategy, seed: number): GameCandidate[] {
    const rng = seededRng(seed);
    let lu = emptyLineup();
    for (let i = 0; i < 5; i++) {
      const s = spin(pool, lu, rng)!;
      const opts = teamOf(pool, s)!.candidates.filter((x) => canPick(lu, x));
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
  assert.ok(ppg.perfect > 0.001 && ppg.perfect < 0.004, "득점 1위만 고르면 전승 0.2% 안팎");
  assert.ok(score.perfect > ppg.perfect && score.perfect < 0.04, "숨은 점수까지 알면 더 높지만 3% 미만");
}
console.log("game: 전부 통과");
