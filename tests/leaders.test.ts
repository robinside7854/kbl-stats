// lib/leaders.ts 검증 (순위표 정렬·필터·순위·쿼리). 실행: npm run test:leaders
import assert from "node:assert/strict";
import {
  columnOrder,
  DEFAULT_LEADERS_STATE,
  defaultSortDir,
  filterLeaders,
  formatMadeAttempts,
  formatStat,
  isRankEligible,
  LEADER_CATEGORIES,
  leadersQueryString,
  madeAttempts,
  parseLeadersQuery,
  rankMap,
  sortLeaders,
  statTitle,
  statValue,
  topLeaders,
} from "../lib/leaders";
import { attemptThresholds, DEFAULT_QUALIFY, QUALIFY_PRESETS } from "../lib/metrics";
import { teamShortLabel } from "../lib/images";
import { teamShortNameKo } from "../lib/teams";
import type { LeaderPlayer } from "../lib/types";

const mk = (o: Partial<LeaderPlayer> & { id: string }): LeaderPlayer => ({
  nameKo: o.id, nameEn: "", teamCode: "55", teamShort: "SK", isForeign: false, photoUrl: null,
  games: 20, minutes: 400, points: 200, reb: 100, ast: 50, stl: 10, blk: 5, tov: 30,
  fgm: 72, fga: 160, tpm: 20, tpa: 60, ftm: 30, fta: 40,
  fgPct: 45, tpPct: 33.3, ftPct: 75, tsPct: 55, per: 15,
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

// 부문: 3점 성공·USG%·PIE 없음, 턴오버·3점%·자유투% 있음
assert.deepEqual([...LEADER_CATEGORIES], ["points", "reb", "ast", "stl", "blk", "tov", "fgPct", "tpPct", "ftPct", "tsPct", "per"]);

// 열 순서: 출전시간은 경기 바로 오른쪽, 야투% 옆에 3점%·자유투%, 핵심 열 밖의 부문은 맨 앞으로
assert.deepEqual(columnOrder("points").slice(0, 5), ["games", "minutes", "points", "reb", "ast"]);
const cols = columnOrder("points");
assert.deepEqual(cols.slice(cols.indexOf("fgPct"), cols.indexOf("fgPct") + 3), ["fgPct", "tpPct", "ftPct"]);
assert.deepEqual(columnOrder("per").slice(0, 3), ["per", "games", "minutes"]);
assert.equal(columnOrder("per").filter((k) => k === "per").length, 1);
assert.ok(!(columnOrder("points") as string[]).includes("usgPct"));

// 턴오버: 1~3위 카드·순위는 적은 순, 기본 정렬 방향도 오름차순
assert.equal(defaultSortDir("tov"), "asc");
assert.equal(defaultSortDir("points"), "desc");
const tv = [mk({ id: "t-many", tov: 90 }), mk({ id: "t-few", tov: 10 }), mk({ id: "t-mid", tov: 40 }), mk({ id: "t-mid2", tov: 40 })];
assert.deepEqual(topLeaders(tv, "tov", "perGame").map((e) => [e.player.id, e.rank]), [["t-few", 1], ["t-mid", 2], ["t-mid2", 2]]);
assert.equal(rankMap(tv, "tov", "total").get("t-many"), 4);
// 표는 "높은 순"으로도 볼 수 있다 (순위 숫자는 그대로 적은 순 기준)
assert.equal(sortLeaders(tv, "tov", "desc", "total")[0].id, "t-many");

// 성공률 시도 기준 (리그 평균 이상) — 순위표와 카드가 같은 attemptThresholds 를 쓴다
const shooters = [
  mk({ id: "vol", fga: 200, fgPct: 50, tpa: 100, tpPct: 38 }), // 경기당 야투 10, 3점 5
  mk({ id: "low", fga: 40, fgPct: 70, tpa: 0, tpPct: 0 }),     // 경기당 야투 2 → 평균 미달
  mk({ id: "mid", fga: 120, fgPct: 45, tpa: 20, tpPct: 40 }),  // 경기당 야투 6, 3점 1
];
const th = attemptThresholds(shooters, DEFAULT_QUALIFY);
assert.ok(Math.abs(th.fga - 6) < 1e-9); // (10 + 2 + 6) / 3
assert.ok(Math.abs(th.tpa - 2) < 1e-9); // (5 + 0 + 1) / 3
assert.equal(isRankEligible(shooters[1], "fgPct", th), false);
assert.equal(isRankEligible(shooters[2], "fgPct", th), true); // 평균과 같으면 포함
assert.equal(isRankEligible(shooters[1], "points", th), true); // 성공률이 아니면 항상
assert.equal(isRankEligible(shooters[1], "fgPct"), true); // 기준을 안 넘기면 제한 없음
// 1~3위 카드: 야투율 70% 인 low 는 시도 부족이라 빠진다
assert.deepEqual(topLeaders(shooters, "fgPct", "perGame", 3, th).map((e) => e.player.id), ["vol", "mid"]);
// 3점%: mid(40%)는 경기당 3점 1회 < 평균 2회 → vol 만
assert.deepEqual(topLeaders(shooters, "tpPct", "perGame", 3, th).map((e) => e.player.id), ["vol"]);
// 표: 미달 선수는 정렬 방향과 관계없이 뒤, 순위 없음
assert.equal(sortLeaders(shooters, "fgPct", "desc", "total", th).at(-1)!.id, "low");
assert.equal(sortLeaders(shooters, "fgPct", "asc", "total", th).at(-1)!.id, "low");
assert.equal(rankMap(shooters, "fgPct", "total", th).has("low"), false);
// 표본 미달 선수는 평균 계산에서 빠진다
const th2 = attemptThresholds([...shooters, mk({ id: "tiny", games: 2, minutes: 10, fga: 100 })], DEFAULT_QUALIFY);
assert.deepEqual(th2, th);
assert.deepEqual(attemptThresholds([], DEFAULT_QUALIFY), { fga: 0, tpa: 0, fta: 0 });

// 성공/시도 (시즌 합계)
assert.deepEqual(madeAttempts(mk({ id: "m", fgm: 396, fga: 794 }), "fgPct"), { made: 396, att: 794 });
assert.equal(madeAttempts(mk({ id: "m" }), "points"), null);
assert.equal(formatMadeAttempts({ made: 1396, att: 2794 }), "1,396/2,794");

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
const ctx = { teamCodes: ["55", "60"] };
assert.equal(leadersQueryString(DEFAULT_LEADERS_STATE), "");
const st = { category: "reb", mode: "total", origin: "foreign", teamCode: "60", presetIdx: 2 } as const;
assert.deepEqual(parseLeadersQuery(leadersQueryString(st), ctx), st);
assert.deepEqual(parseLeadersQuery("?cat=pie&mode=x&origin=zz&team=99&q=9", ctx), DEFAULT_LEADERS_STATE);
assert.equal(parseLeadersQuery("?cat=tpm", ctx).category, "points"); // 없어진 부문(예전 주소)은 기본값
assert.equal(parseLeadersQuery("?cat=tov", ctx).category, "tov");

// 팀 약칭 줄이기 (TeamLogo 대체 표기와 같은 규칙)
assert.equal(teamShortLabel("SK"), "SK");
assert.equal(teamShortLabel("TG SAMBO"), "TG SAMBO");
assert.equal(teamShortLabel("HYUNDAI MOBIS"), "HM");
assert.equal(teamShortLabel("DAEWOO SECURITIES"), "DS");
assert.equal(teamShortLabel("KOREATENDER"), "KOR");

// 팀 한글 약칭 (lib/teams.ts): 공백이 있으면 첫 공백 뒤, 없으면 연고지 접두어 제거
assert.equal(teamShortNameKo("울산 현대모비스"), "현대모비스");
assert.equal(teamShortNameKo("서울 SK"), "SK");
assert.equal(teamShortNameKo("여수 코리아텐더"), "코리아텐더");
assert.equal(teamShortNameKo("부산기아"), "기아");
assert.equal(teamShortNameKo("인천대우증권"), "대우증권");
assert.equal(teamShortNameKo("원주TG삼보"), "TG삼보");
assert.equal(teamShortNameKo("안양한국인삼공사"), "한국인삼공사");
assert.equal(teamShortNameKo("경남LG"), "LG");
assert.equal(teamShortNameKo("서울"), "서울"); // 지명만 → 전체
assert.equal(teamShortNameKo("KCC이지스"), "KCC이지스"); // 지명 없음 → 그대로
assert.equal(teamShortNameKo("  "), "");

console.log("leaders: 모든 검사 통과");
