// 기록 맥락 꼬리표 (lib/feat-context) 검증 — npm run test:featctx
import assert from "node:assert/strict";
import { allTimeStanding, attachFeatContexts, domesticFromIndex, featContext, milestoneOrdinal, performancesFromGames, seasonOrdinal, type FeatContextEnv } from "../lib/feat-context";
import type { NotifItem } from "../lib/notifications";

const perf = (date: string, player: string, pts: number) => ({ date, player, stats: { pts } });
const highs: Record<string, { pts: { value: number } }> = {};
for (let i = 0; i < 100; i++) highs[`d${i}`] = { pts: { value: 10 + i * 0.4 } }; // 국내 100명: 10 ~ 49.6
highs.f1 = { pts: { value: 60 } };
const domestic: Record<string, boolean> = {};
for (let i = 0; i < 100; i++) domestic[`d${i}`] = true;
domestic.f1 = false;
domestic.me = true;
domestic.you = false;
const env: FeatContextEnv = {
  performances: [perf("2026-10-03", "a", 40), perf("2026-10-05", "b", 42), perf("2026-10-07", "me", 45), perf("2026-10-07", "c", 46)],
  careerHighs: { ...highs, me: { pts: { value: 45 } } },
  careerSums: { me: { points: 5000 }, d1: { points: 9000 }, f1: { points: 6000 }, d2: { points: 4000 } },
  domestic,
};

// 올 시즌 순번: 날짜 순, 같은 날은 같은 순번
assert.equal(seasonOrdinal(env, "pts", 45, "2026-10-07"), 1);
assert.equal(seasonOrdinal(env, "pts", 41, "2026-10-07"), 2);
assert.equal(seasonOrdinal(env, "pts", 40, "2026-10-07"), 3);

// 역대: 국내 선수면 국내 묶음, 자기 자신 뺌
const a = allTimeStanding(env, "pts", 45, "me");
assert.equal(a.domestic, true);
assert.equal(a.pool, 100);
assert.equal(a.above, 12); // 45.2 ~ 49.6
assert.equal(allTimeStanding(env, "pts", 45, "you").pool, 102); // 외국 선수 → 전체 (국내 100 + f1 + me)
assert.equal(allTimeStanding(env, "pts", 70, "you").above, 0);

// 이정표: 이 선수 포함 몇 명째, 같은 묶음 따로
assert.deepEqual(milestoneOrdinal(env, "points", 5000, "me"), { all: 3, group: 2, domestic: true });

const item = (level: "career" | "league" | "milestone" | "season", key: string, value: number, player = "me", date = "2026-10-07"): Pick<NotifItem, "date" | "player" | "feat"> => ({
  date, player, feat: { level, text: "", game: "", won: true, stat: "", name: "", key, value },
});
assert.deepEqual(featContext(env, item("career", "pts", 45)), ["올 시즌 리그 첫 45득점 이상", "이보다 많이 한 국내 선수는 역대 12명뿐"]);
assert.deepEqual(featContext(env, item("career", "pts", 70, "you")), ["올 시즌 리그 첫 70득점 이상", "역대 선수 한 경기 최고 기록"]);
assert.deepEqual(featContext(env, item("career", "pts", 60, "you")), ["올 시즌 리그 첫 60득점 이상", "역대 선수 한 경기 최고 타이"]);
// 시즌 최다 갱신(league)은 "첫"을 다시 말하지 않는다
assert.equal(featContext(env, item("league", "pts", 70, "you"))[0], "역대 선수 한 경기 최고 기록");
// 흔한 기록은 꼬리표 없음 (올 시즌 6번째 이상 · 역대 상위 20% 넘음)
const busy: FeatContextEnv = { ...env, performances: Array.from({ length: 8 }, (_, i) => perf("2026-10-01", `x${i}`, 30)) };
assert.deepEqual(featContext(busy, item("career", "pts", 20)), []);
// 30명 이하로 높으면 "N명뿐"
assert.deepEqual(featContext(busy, item("career", "pts", 39)).slice(-1), ["이보다 많이 한 국내 선수는 역대 27명뿐"]);
// 30명 넘게 높으면 비율 — 국내 300명(1~300점), 250점: 높은 선수 50명, 같은 선수 1명 → (50+1+1)/301 = 17.3% → 18%
const big: FeatContextEnv = { performances: busy.performances, careerSums: {}, careerHighs: {}, domestic: { me: true } };
for (let i = 1; i <= 300; i++) {
  (big.careerHighs as Record<string, unknown>)[`p${i}`] = { pts: { value: i } };
  (big.domestic as Record<string, boolean>)[`p${i}`] = true;
}
assert.deepEqual(featContext(big, item("career", "pts", 250)).slice(-1), ["역대 국내 선수 상위 18%만 해 본 기록"]);
assert.equal(featContext(big, item("career", "pts", 200)).filter((t) => t.startsWith("역대")).length, 0); // 34% — 흔해서 없음
// 이정표
assert.deepEqual(featContext(env, item("milestone", "points", 5000)), ["역대 3번째 · 국내 선수 2번째"]);
assert.deepEqual(featContext(env, item("milestone", "points", 9000, "d1")), ["역대 1번째"]);
// 붙이기: 원본은 그대로
const items: NotifItem[] = [{ id: "x", kind: "high", date: "2026-10-07", player: "me", title: "", body: "", href: "", feat: item("career", "pts", 45).feat }];
const out = attachFeatContexts(items, env);
assert.equal(items[0].feat!.context, undefined);
assert.equal(out[0].feat!.context!.length, 2);

// 홈 칸: 같은 경기 커리어 하이·시즌 최다 두 줄이면 겹치는 꼬리표는 앞 줄에만
{
  const { featGroups } = await import("../lib/notifications");
  const mk = (id: string, level: "career" | "league", context: string[]): NotifItem => ({
    id, kind: "high", date: "2026-10-07", player: "me", title: "", body: "", href: "",
    feat: { level, text: "45득점", game: "", won: true, stat: "", name: "", key: "pts", value: 45, context },
  });
  const [g] = featGroups([mk("h:G1:me:pts", "career", ["올 시즌 리그 첫 45득점 이상", "역대 A"]), mk("l:G1:me:pts", "league", ["역대 A"])]);
  assert.deepEqual(g.lines.map((l) => l.context ?? []), [["올 시즌 리그 첫 45득점 이상", "역대 A"], []]);
}

// 재료 만들기
const games = [{ date: "2026-10-03", ended: true, box: { home: [{ id: "a", sec: 100, pts: 10 }], away: [{ id: "b", sec: 0, pts: 0 }] } }];
assert.equal(performancesFromGames(games).length, 1);
assert.deepEqual(domesticFromIndex([{ id: "1", nationality: "asia" }, { id: "2", nationality: null, isForeign: false }]), { "1": false, "2": true });
console.log("feat-context: 올 시즌 순번·역대 위치·이정표 순번·문구 통과");
