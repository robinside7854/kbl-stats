// lib/leaders.ts 검증 (순위표 정렬·필터·순위·쿼리). 실행: npm run test:leaders
import assert from "node:assert/strict";
import {
  availableStats,
  columnOrder,
  DEFAULT_LEADERS_STATE,
  filterLeaders,
  formatStat,
  LEADER_CATEGORIES,
  leadersQueryString,
  parseLeadersQuery,
  rankMap,
  sortLeaders,
  statTitle,
  statValue,
  topLeaders,
} from "../lib/leaders";
import { DEFAULT_QUALIFY, QUALIFY_PRESETS } from "../lib/metrics";
import { teamShortLabel } from "../lib/images";
import type { LeaderPlayer } from "../lib/types";

const mk = (o: Partial<LeaderPlayer> & { id: string }): LeaderPlayer => ({
  nameKo: o.id, nameEn: "", teamCode: "55", teamShort: "SK", isForeign: false, photoUrl: null,
  games: 20, minutes: 400, points: 200, reb: 100, ast: 50, stl: 10, blk: 5, tpm: 20,
  fgPct: 45, tsPct: 55, per: 15, usgPct: 3, pie: 10,
  ...o,
});

// 값: count 지표는 경기당 모드에서 perGame, 비율·경기 수는 그대로
const a = mk({ id: "a", games: 10, points: 250 });
assert.equal(statValue(a, "points", "perGame"), 25);
assert.equal(statValue(a, "points", "total"), 250);
assert.equal(statValue(a, "games", "perGame"), 10);
assert.equal(statValue(a, "tsPct", "perGame"), 55);
assert.equal(statValue(mk({ id: "z", games: 0, points: 0 }), "points", "perGame"), 0); // 0경기

// 필터: 국내/외국인, 팀, 표본 기준
const players = [
  mk({ id: "d1", isForeign: false, teamCode: "55" }),
  mk({ id: "f1", isForeign: true, teamCode: "60" }),
  mk({ id: "d2", isForeign: false, teamCode: "60", games: 5, minutes: 60 }), // 표본 미달(기본 기준)
];
const ids = (xs: LeaderPlayer[]) => xs.map((p) => p.id);
assert.deepEqual(ids(filterLeaders(players, { origin: "all", teamCode: null, rule: DEFAULT_QUALIFY })), ["d1", "f1"]);
assert.deepEqual(ids(filterLeaders(players, { origin: "domestic", teamCode: null, rule: DEFAULT_QUALIFY })), ["d1"]);
assert.deepEqual(ids(filterLeaders(players, { origin: "foreign", teamCode: null, rule: DEFAULT_QUALIFY })), ["f1"]);
assert.deepEqual(ids(filterLeaders(players, { origin: "all", teamCode: "60", rule: QUALIFY_PRESETS[3] })), ["f1", "d2"]);

// 정렬: 경기당/합계에 따라 순서가 달라진다
const p1 = mk({ id: "p1", games: 10, points: 200 }); // 경기당 20, 합계 200
const p2 = mk({ id: "p2", games: 40, points: 600 }); // 경기당 15, 합계 600
assert.deepEqual(ids(sortLeaders([p1, p2], "points", "desc", "perGame")), ["p1", "p2"]);
assert.deepEqual(ids(sortLeaders([p1, p2], "points", "desc", "total")), ["p2", "p1"]);
assert.deepEqual(ids(sortLeaders([p1, p2], "points", "asc", "total")), ["p1", "p2"]);
// 동점 → 경기 수 많은 순 → 이름순 → 번호순 (동명이인도 순서 고정)
const t1 = mk({ id: "t1", nameKo: "김", per: 10, games: 30 });
const t2 = mk({ id: "t2", nameKo: "김", per: 10, games: 40 });
const t3 = mk({ id: "t0", nameKo: "김", per: 10, games: 30 });
assert.deepEqual(ids(sortLeaders([t1, t2, t3], "per", "desc", "total")), ["t2", "t0", "t1"]);
// NaN 은 방향과 관계없이 맨 뒤
const n = mk({ id: "nan", per: NaN });
assert.equal(sortLeaders([n, t1], "per", "asc", "total")[1].id, "nan");
assert.equal(sortLeaders([n, t1], "per", "desc", "total")[1].id, "nan");

// 순위: 동점 같은 순위, 다음 순위 건너뜀
const r = rankMap(
  [mk({ id: "x", reb: 100 }), mk({ id: "y", reb: 80 }), mk({ id: "w", reb: 100 }), mk({ id: "v", reb: 50 })],
  "reb",
  "total",
);
assert.equal(r.get("x"), 1);
assert.equal(r.get("w"), 1);
assert.equal(r.get("y"), 3);
assert.equal(r.get("v"), 4);

// 상위 3명
const top = topLeaders([p1, p2, mk({ id: "p3", games: 20, points: 500 })], "points", "perGame");
assert.deepEqual(top.map((e) => [e.player.id, e.value, e.rank]), [["p3", 25, 1], ["p1", 20, 2], ["p2", 15, 3]]);
assert.equal(topLeaders([], "points", "perGame").length, 0);

// 커버리지: advanced 지표(USG%·PIE)는 coverage.advanced 일 때만
assert.ok(!availableStats(LEADER_CATEGORIES, { advanced: false }).includes("usgPct"));
assert.ok(!availableStats(LEADER_CATEGORIES, { advanced: false }).includes("pie"));
assert.ok(availableStats(LEADER_CATEGORIES, { advanced: true }).includes("pie"));

// 열 순서: 핵심 열 밖의 부문은 맨 앞으로
assert.deepEqual(columnOrder("points", { advanced: false }).slice(0, 4), ["games", "points", "reb", "ast"]);
assert.deepEqual(columnOrder("per", { advanced: false }).slice(0, 3), ["per", "games", "points"]);
assert.equal(columnOrder("per", { advanced: false }).filter((k) => k === "per").length, 1);
assert.ok(!columnOrder("points", { advanced: false }).includes("usgPct"));

// 표기
assert.equal(formatStat(1234, "points", "total"), "1,234");
assert.equal(formatStat(25, "points", "perGame"), "25.0");
assert.equal(formatStat(54, "games", "perGame"), "54");
assert.equal(formatStat(55.55, "tsPct", "total"), "55.6");
assert.equal(formatStat(NaN, "per", "total"), "–");
assert.equal(statTitle("points", "perGame"), "경기당 득점");
assert.equal(statTitle("reb", "total"), "시즌 합계 리바운드");
assert.equal(statTitle("tsPct", "total"), "TS%");

// 쿼리: 왕복, 잘못된 값은 기본값
const ctx = { teamCodes: ["55", "60"], coverage: { advanced: false } };
assert.equal(leadersQueryString(DEFAULT_LEADERS_STATE), "");
const st = { category: "reb", mode: "total", origin: "foreign", teamCode: "60", presetIdx: 2 } as const;
assert.deepEqual(parseLeadersQuery(leadersQueryString(st), ctx), st);
assert.deepEqual(parseLeadersQuery("?cat=pie&mode=x&origin=zz&team=99&q=9", ctx), DEFAULT_LEADERS_STATE);
assert.equal(parseLeadersQuery("?cat=pie", { ...ctx, coverage: { advanced: true } }).category, "pie");

// 팀 약칭 줄이기 (TeamLogo 대체 표기와 같은 규칙)
assert.equal(teamShortLabel("SK"), "SK");
assert.equal(teamShortLabel("TG SAMBO"), "TG SAMBO");
assert.equal(teamShortLabel("HYUNDAI MOBIS"), "HM");
assert.equal(teamShortLabel("DAEWOO SECURITIES"), "DS");
assert.equal(teamShortLabel("KOREATENDER"), "KOR");

console.log("leaders: 모든 검사 통과");
