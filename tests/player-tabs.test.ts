// 선수 상세 탭 규칙 (2026-11-08): 보일 탭 · ?tab= 해석 · 주소 합치기.
// 실행: npm run test:playertabs
import assert from "node:assert/strict";
import { availablePlayerTabs, isSeasonalTab, mergeQuery, parsePlayerTab, tabQueryPatch } from "../lib/player-tabs";

// 보일 탭: 내용 없는 탭은 빠진다
assert.deepEqual(availablePlayerTabs({ card: true, shots: true, moments: true }), ["season", "ability", "shots", "career", "moments"]);
assert.deepEqual(availablePlayerTabs({ card: true, shots: false, moments: false }), ["season", "ability", "career"]);
assert.deepEqual(availablePlayerTabs({ card: false, shots: true, moments: true }), ["career", "moments"]);

const all = availablePlayerTabs({ card: true, shots: true, moments: true });
assert.equal(parsePlayerTab("", all), "season");
assert.equal(parsePlayerTab("?tab=shots&season=45", all), "shots");
assert.equal(parsePlayerTab("?tab=nope", all), "season");
// 이 선수에게 없는 탭이면 첫 탭
assert.equal(parsePlayerTab("?tab=shots", ["career", "moments"]), "career");

assert.equal(isSeasonalTab("ability"), true);
assert.equal(isSeasonalTab("career"), false);

// 주소: 서로의 키를 지우지 않는다
assert.equal(mergeQuery("?season=45", { tab: "shots" }), "?season=45&tab=shots");
assert.equal(mergeQuery("?season=45&tab=shots", tabQueryPatch("season", all)), "?season=45");
assert.equal(mergeQuery("?tab=career&season=45", { season: null, scope: null }), "?tab=career");
assert.equal(mergeQuery("", { tab: null }), "");

console.log("player-tabs 테스트 통과");
