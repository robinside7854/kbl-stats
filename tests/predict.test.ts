// 플레이오프 확률·경기 승률 (lib/predict) 검증 — npm run test:predict
import assert from "node:assert/strict";
import type { SeasonGame } from "../lib/types";
import { certainSpot, homeWinProb, normalCdf, oddsSeed, oddsText, playoffOdds, PREDICT, priorFromSeason, teamRatings, upcomingWinProbs } from "../lib/predict";

let n = 0;
const g = (date: string, h: string, a: string, hs: number | null, as: number | null): SeasonGame => ({
  gmkey: `G${++n}`, date, start: null, stadium: null, ended: hs !== null,
  home: { teamCode: h, name: h, score: hs }, away: { teamCode: a, name: a, score: as }, box: null,
});

// 정규분포
assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-6);
assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 1e-3);

// 능력치: A 가 늘 10점 차로 이기면 A > B, 출발점 쪽으로 당겨져 10 보다 작다
const two = [g("2026-10-01", "A", "B", 90, 80), g("2026-10-02", "B", "A", 80, 90)];
const r2 = teamRatings(two);
assert.ok(r2.get("A")!.rating > 0 && r2.get("B")!.rating < 0);
assert.ok(r2.get("A")!.rating - r2.get("B")!.rating < 10);
assert.equal(r2.get("A")!.games, 2);
// 같은 팀끼리 홈 이점: 능력치가 같으면 홈이 50% 보다 조금 높다
const even = teamRatings([]);
const pHome = homeWinProb(even, "X", "Y");
assert.ok(pHome > 0.5 && pHome < 0.56);
assert.ok(homeWinProb(r2, "A", "B") > 0.5 && homeWinProb(r2, "B", "A") < 0.5);
// 출발점: 지난 시즌 강팀은 PRIOR_KEEP 만큼만 남는다
const prior = priorFromSeason(two);
assert.ok(prior.A > 0 && prior.A < r2.get("A")!.rating + 5);
assert.ok(Math.abs(prior.A + prior.B) < 1e-6);

// 남은 경기 승률: 끝난 경기는 빠진다
const sched = [...two, g("2026-10-05", "A", "B", null, null)];
const up = upcomingWinProbs(sched, r2);
assert.deepEqual(Object.keys(up), [sched[2].gmkey]);
assert.ok(up[sched[2].gmkey] > 0.5);

// 시뮬레이션: 8팀 리그, 1번 팀이 가장 강하게
const teams = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];
const season: SeasonGame[] = [];
let day = 1;
for (let round = 0; round < 4; round++)
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++) {
      const d = `2026-11-${String((day++ % 28) + 1).padStart(2, "0")}`;
      const played = round < 1;
      const [h, a] = round % 2 ? [teams[j], teams[i]] : [teams[i], teams[j]];
      // 앞 번호 팀이 이긴다 (점수 차 = 번호 차 × 3)
      const hi = teams.indexOf(h), ai = teams.indexOf(a);
      season.push(g(d, h, a, played ? 80 + (ai - hi) * 3 + (hi < ai ? 1 : -1) : null, played ? 80 : null));
    }
const ratings = teamRatings(season);
const odds = playoffOdds(season, ratings, { sims: 3000, seed: oddsSeed(season) });
const sum = (k: "first" | "top2" | "top6") => odds.reduce((s, o) => s + o[k], 0);
assert.ok(Math.abs(sum("first") - 1) < 0.01);
assert.ok(Math.abs(sum("top2") - 2) < 0.01);
assert.ok(Math.abs(sum("top6") - 6) < 0.01);
const t1 = odds.find((o) => o.teamCode === "T1")!;
const t8 = odds.find((o) => o.teamCode === "T8")!;
assert.ok(t1.top6 > t8.top6 && t1.first > t8.first);
assert.equal(t1.wins + t1.losses, 7);
assert.ok(Math.abs(t1.expWins + t1.expLosses - 28) < 0.11);
// 같은 입력 → 같은 결과
assert.deepEqual(playoffOdds(season, ratings, { sims: 500, seed: 3 }), playoffOdds(season, ratings, { sims: 500, seed: 3 }));
// 시즌이 끝나면(한 바퀴만 도는 리그, 승수가 7·6·…·0 으로 다 다름) 확률은 0 또는 1, 확정·탈락이 다 정해진다
const done = season.filter((x) => x.ended);
const fin = playoffOdds(done, teamRatings(done), { sims: 200 });
// 시즌이 끝나면 정해진 팀은 확률도 0·1 (동률 팀만 무작위로 갈려 남는다)
for (const o of fin) {
  if (o.playoff === "in") assert.equal(o.top6, 1);
  if (o.playoff === "out") assert.equal(o.top6, 0);
}
assert.equal(fin.filter((o) => o.playoff !== null).length, 8);
assert.deepEqual(fin.map((o) => o.top6), [1, 1, 1, 1, 1, 1, 0, 0]);

// 확정·탈락 (6강 칸 하나 기준을 k=1 로 작게)
assert.equal(certainSpot(0, [10, 5, 4], [2, 2, 2], 1), "in"); // 다른 팀은 다 이겨도 7승
assert.equal(certainSpot(2, [10, 5, 4], [2, 2, 2], 1), "out");
assert.equal(certainSpot(1, [10, 9, 4], [2, 2, 2], 1), null); // 9+2 ≥ 10 … 아직 모름
assert.equal(certainSpot(0, [10, 8, 4], [2, 2, 2], 1), null); // 8+2 = 10 동률 가능 → 확정 아님
assert.equal(certainSpot(1, [10, 8, 4], [0, 2, 2], 1), null); // 다 이기면 10 동률 → 탈락 아님

// 표기
assert.equal(oddsText(0.734), "73%");
assert.equal(oddsText(0), "<1%");
assert.equal(oddsText(1), ">99%");
assert.equal(oddsText(1, "in"), "확정");
assert.equal(oddsText(0, "out"), "탈락");
assert.ok(PREDICT.SIMS >= 1000);
console.log("predict: 능력치·경기 승률·플레이오프 확률·확정/탈락·표기 통과");

// 적중률 (backtestSeason, 2026-10-16): 그날 전 경기만 보고 예측
{
  const { backtestSeason, recordText } = await import("../lib/predict");
  // 첫날: 출발점 없음 → 홈 이점만으로 홈 쪽(>50%) — 홈 A 승 = 적중, 같은 날 홈 C 패 = 빗나감
  // 둘째 날: A 가 강해졌으니 원정 A 를 고름 → A 승 = 적중
  const games = [
    g("2026-11-01", "A", "B", 90, 70),
    g("2026-11-01", "C", "D", 70, 80),
    g("2026-11-02", "B", "A", 70, 90),
    g("2026-11-03", "B", "A", null, null), // 안 끝난 경기는 세지 않음
  ];
  const r = backtestSeason(games);
  assert.equal(r.games, 3);
  assert.equal(r.hits, 2);
  const [k1, k2, k3] = games.map((x) => x.gmkey);
  assert.ok(r.picks[k1].homeProb > 0.5 && r.picks[k1].hit === true);
  // 같은 날 경기는 서로 결과를 모른다: 둘째 경기도 홈 이점만
  assert.equal(r.picks[k2].homeProb, r.picks[k1].homeProb);
  assert.equal(r.picks[k2].hit, false);
  assert.ok(r.picks[k3].homeProb < 0.5 && r.picks[k3].hit === true);
  assert.equal(r.picks[games[3].gmkey], undefined);
  // 출발점이 있으면 첫날부터 반영 (지난 시즌 강팀 D 원정 승 → 적중)
  const withPrior = backtestSeason(games.slice(1, 2), { D: 8 });
  assert.equal(withPrior.hits, 1);
  assert.equal(recordText({ games: 21, hits: 14 }), "21경기 중 14경기 맞힘 (67%)");
  assert.equal(recordText({ games: 0, hits: 0 }), "0경기 중 0경기 맞힘 (0%)");
  console.log("predict: 적중률 통과");
}
