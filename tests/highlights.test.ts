// 경기 하이라이트 제목 해석·경기 맞추기 (scripts/highlights.ts) — npm run test:highlights
import assert from "node:assert/strict";
import { hasNewHighlight, matchHighlights, parseFeed, parseHighlightTitle, teamMatches } from "../scripts/highlights";
import type { SeasonGame } from "../lib/types";

// 2026-10-04 실제 RSS 제목
const T1 = "[DB vs 소노] 10/4 경기 I 2026-27 KCC 프로농구 I 하이라이트 I TVING";
const T2 = "[소노 vs 한국가스공사] 10/3 경기 I 2026-27 KCC 프로농구 I 하이라이트 I TVING";
assert.deepEqual(parseHighlightTitle(T1, "2026-10-04T13:00:03+00:00"), { home: "DB", away: "소노", date: "2026-10-04" });
assert.deepEqual(parseHighlightTitle(T2, "2026-10-03T13:00:04+00:00"), { home: "소노", away: "한국가스공사", date: "2026-10-03" });
// 해를 넘긴 경기: 시즌 "2026-27" 의 1월은 2027
assert.equal(parseHighlightTitle("[SK vs KT] 1/5 경기 I 2026-27 KCC 프로농구 I 하이라이트 I TVING", "2027-01-05T13:00:00+00:00")?.date, "2027-01-05");
// 야구·쇼츠·모먼트는 아님
assert.equal(parseHighlightTitle("[롯데 vs KT] 10/4 경기 I 2026 신한 SOL KBO 리그 I 하이라이트 I TVING", "2026-10-04T12:00:00Z"), null);
assert.equal(parseHighlightTitle("[2026-2027 KCC 프로농구] TIP:IN MOMENT - 창원 LG 세이커스편ㅣ#shortsㅣTVINGSPORTS", "2026-10-04T09:00:00Z"), null);

assert.ok(teamMatches("원주 DB", "DB"));
assert.ok(teamMatches("대구 한국가스공사", "한국가스공사"));
assert.ok(!teamMatches("수원 KT", "SK"));

const xml = `<feed><entry><yt:videoId>Mt2NqynFuG8</yt:videoId><title>${T1}</title><published>2026-10-04T13:00:03+00:00</published></entry>
<entry><yt:videoId>9w781ZuhNzo</yt:videoId><title>[롯데 vs KT] 10/4 경기 I 2026 신한 SOL KBO 리그 I 하이라이트 I TVING</title><published>2026-10-04T12:34:57+00:00</published></entry>
<entry><yt:videoId>0nEdK8yqggo</yt:videoId><title>${T2.replace("&", "&amp;")}</title><published>2026-10-03T13:00:04+00:00</published></entry></feed>`;
const entries = parseFeed(xml);
assert.equal(entries.length, 3);

const game = (gmkey: string, date: string, home: string, away: string) =>
  ({ gmkey, date, start: null, stadium: null, ended: true, home: { teamCode: "", name: home, score: 1 }, away: { teamCode: "", name: away, score: 0 }, box: null }) as SeasonGame;
const games = [game("S49G01N2", "2026-10-03", "고양 소노", "대구 한국가스공사"), game("S49G01N4", "2026-10-04", "원주 DB", "고양 소노"), game("S49G01N5", "2026-10-04", "수원 KT", "서울 삼성")];
const m = matchHighlights(games, entries);
assert.equal(m.get("S49G01N4"), "Mt2NqynFuG8");
assert.equal(m.get("S49G01N2"), "0nEdK8yqggo");
assert.equal(m.has("S49G01N5"), false); // 영상이 없는 경기
// 홈·원정을 바꿔 쓴 제목도 같은 경기
assert.equal(matchHighlights(games, [{ videoId: "x1", title: "[소노 vs DB] 10/4 경기 I 2026-27 KCC 프로농구 I 하이라이트", published: "2026-10-04T13:00:00Z" }]).get("S49G01N4"), "x1");

assert.equal(hasNewHighlight(entries, new Set(["Mt2NqynFuG8", "0nEdK8yqggo"])), false); // 야구 영상만 새것
assert.equal(hasNewHighlight(entries, new Set(["Mt2NqynFuG8"])), true);
console.log("highlights: 제목 해석·경기 맞추기 통과");

// ── 하이라이트 기다리는 경기 (2026-10-06) ──
{
  const { pendingHighlightGames } = await import("../scripts/highlights");
  const g = (date: string, ended: boolean, highlight?: string) => ({ date, ended, ...(highlight ? { highlight } : {}) });
  const games = [g("2026-10-02", true), g("2026-10-03", true, "abc"), g("2026-10-04", true), g("2026-10-05", true), g("2026-10-06", false), g("2026-10-07", false)];
  assert.deepEqual(pendingHighlightGames(games, "2026-10-06").map((x) => x.date), ["2026-10-04", "2026-10-05"], "끝났고 영상 없고 3일 안");
  assert.deepEqual(pendingHighlightGames(games, "2026-10-05").map((x) => x.date), ["2026-10-02", "2026-10-04", "2026-10-05"], "3일 전까지 포함");
  assert.equal(pendingHighlightGames(games, "2026-10-12").length, 0, "오래된 경기는 더 기다리지 않음");
  console.log("highlights: 기다리는 경기 통과");
}
