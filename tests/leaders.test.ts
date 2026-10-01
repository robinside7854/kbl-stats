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
  takeFirst,
  rowSummaryKeys,
  formatSummaryStat,
  leaderFilterChips,
  clearLeaderFilter,
  resetLeaderFilters,
  LEADERS_PAGE_SIZE,
} from "../lib/leaders";
import { attemptThresholds, DEFAULT_QUALIFY, QUALIFY_PRESETS } from "../lib/metrics";
import { teamShortLabel } from "../lib/images";
import { teamShortNameKo } from "../lib/teams";
import type { LeaderPlayer } from "../lib/types";

const mk = (o: Partial<LeaderPlayer> & { id: string }): LeaderPlayer => ({
  nameKo: o.id, nameEn: "", teamCode: "55", teamShort: "SK", isForeign: false, photoUrl: null,
  position: null, positionGroup: null, nationality: null,
  games: 20, minutes: 400, points: 200, reb: 100, ast: 50, stl: 10, blk: 5, tov: 30, fouls: 40,
  fgm: 72, fga: 160, tpm: 20, tpa: 60, ftm: 30, fta: 40,
  fgPct: 45, tpPct: 33.3, ftPct: 75, tsPct: 55, usgPct: 20, per: 15,
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
// 마스터 국적이 있으면 nationality 기준 (이름 추정 isForeign 보다 우선) — 아시아쿼터는 외국과 따로
const natPlayers = [
  mk({ id: "n-dom", nationality: "domestic", isForeign: true }), // 이름은 외국인처럼 보여도 마스터가 국내(귀화 등)
  mk({ id: "n-for", nationality: "foreign", isForeign: true }),
  mk({ id: "n-asia", nationality: "asia", isForeign: true, position: "G", positionGroup: "G" }),
  mk({ id: "n-none", nationality: null, isForeign: false, position: "C", positionGroup: "C" }), // 마스터 없음 → 이름 추정
];
const f = (o: Partial<Parameters<typeof filterLeaders>[1]>) =>
  ids(filterLeaders(natPlayers, { origin: "all", teamCode: null, rule: DEFAULT_QUALIFY, ...o }));
assert.deepEqual(f({ origin: "domestic" }), ["n-dom", "n-none"]);
assert.deepEqual(f({ origin: "foreign" }), ["n-for"]);
assert.deepEqual(f({ origin: "asia" }), ["n-asia"]);
assert.deepEqual(f({ position: "G" }), ["n-asia"]);
assert.deepEqual(f({ position: "C", origin: "domestic" }), ["n-none"]);
assert.deepEqual(f({ position: "F" }), []);
assert.deepEqual(f({ position: "all" }), ["n-dom", "n-for", "n-asia", "n-none"]);

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
assert.deepEqual([...LEADER_CATEGORIES], ["points", "reb", "ast", "stl", "blk", "tpm", "tov", "fgPct", "tpPct", "ftPct", "tsPct", "per", "defl", "screen", "rimPct", "midPct", "corner3Pct", "arc3Pct"]); // 허슬·슛 구역 2026-10-01
// 3점 성공(2026-10-01 홈 부문 추가): 경기당 성공 개수, 열은 3점% 바로 앞
assert.equal(columnOrder("points").indexOf("tpm"), columnOrder("points").indexOf("tpPct") - 1);
assert.deepEqual(columnOrder("tpm").slice(0, 3), ["tpm", "games", "minutes"]);
assert.equal(statValue(mk({ id: "t", tpm: 90, games: 30 }), "tpm", "perGame"), 3);
assert.equal(formatStat(statValue(mk({ id: "t", tpm: 90, games: 30 }), "tpm", "total"), "tpm", "total"), "90");
assert.equal(defaultSortDir("tpm"), "desc");

// 열 순서: 출전시간은 경기 바로 오른쪽, 야투% 옆에 3점%·자유투%, 핵심 열 밖의 부문은 맨 앞으로
assert.deepEqual(columnOrder("points").slice(0, 5), ["games", "minutes", "points", "reb", "ast"]);
const cols = columnOrder("points");
assert.deepEqual(cols.slice(cols.indexOf("fgPct"), cols.indexOf("fgPct") + 4), ["fgPct", "tpm", "tpPct", "ftPct"]); // 3점 성공은 3점% 바로 앞
assert.deepEqual(columnOrder("per").slice(0, 3), ["per", "games", "minutes"]);
assert.equal(columnOrder("per").filter((k) => k === "per").length, 1);
assert.ok((columnOrder("points") as string[]).includes("usgPct")); // 2026-09-30 등급 체계 2차: USG% 열 다시 추가 (부문 카드에는 없음)
// 파울: 표 열(턴오버 바로 뒤)에는 있고 부문에는 없다. 경기당 환산, 적은 순이 기본 방향
assert.equal(cols[cols.indexOf("tov") + 1], "fouls");
assert.ok(!(LEADER_CATEGORIES as readonly string[]).includes("fouls"));
assert.equal(statValue(mk({ id: "pf", games: 20, fouls: 50 }), "fouls", "perGame"), 2.5);
assert.equal(defaultSortDir("fouls"), "asc");

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
const st = { category: "reb", mode: "total", origin: "foreign", position: "C", teamCode: "60", presetIdx: 2 } as const;
assert.deepEqual(parseLeadersQuery(leadersQueryString(st), ctx), st);
assert.equal(leadersQueryString({ ...DEFAULT_LEADERS_STATE, origin: "asia", position: "G" }), "?origin=asia&pos=g");
assert.equal(parseLeadersQuery("?pos=x", ctx).position, "all");
assert.deepEqual(parseLeadersQuery("?cat=pie&mode=x&origin=zz&team=99&q=9", ctx), DEFAULT_LEADERS_STATE);
assert.equal(parseLeadersQuery("?cat=pie", ctx).category, "points"); // 없어진 부문(예전 주소)은 기본값
assert.equal(parseLeadersQuery("?cat=tpm", ctx).category, "tpm"); // 3점 성공은 2026-10-01 부문으로 복귀
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

// 더 보기: 앞 n개 + 남은 수
assert.equal(LEADERS_PAGE_SIZE, 25);
assert.deepEqual(takeFirst([1, 2, 3, 4], 3), { shown: [1, 2, 3], remaining: 1 });
assert.deepEqual(takeFirst([1, 2], 25), { shown: [1, 2], remaining: 0 });
assert.deepEqual(takeFirst([1, 2], 0), { shown: [], remaining: 2 });
// 행 카드 보조값: 경기·출전·득점, 정렬 기준은 빼고 다음 핵심으로 채운다
assert.deepEqual(rowSummaryKeys("reb"), ["games", "minutes", "points"]);
assert.deepEqual(rowSummaryKeys("points"), ["games", "minutes", "reb"]);
assert.deepEqual(rowSummaryKeys("games"), ["minutes", "points", "reb"]);
const sp = mk({ id: "s", games: 10, minutes: 321, points: 250 });
assert.equal(formatSummaryStat(sp, "games", "perGame"), "10경기");
assert.equal(formatSummaryStat(sp, "minutes", "perGame"), "32.1분");
assert.equal(formatSummaryStat(sp, "points", "perGame"), "득점 25.0");
assert.equal(formatSummaryStat(sp, "points", "total"), "득점 250");
// 적용 중 필터 칩: 기본값이 아닌 것만, 시트 순서대로. ✕ 는 그 항목만 기본값으로, 초기화는 부문 유지
const fs0 = { ...DEFAULT_LEADERS_STATE, category: "reb" as const, mode: "total" as const, position: "G" as const, origin: "domestic" as const, teamCode: "55", presetIdx: 1 };
assert.deepEqual(
  leaderFilterChips(fs0, (c) => (c === "55" ? "SK" : c)).map((c) => `${c.field}:${c.label}`),
  ["mode:시즌 합계", "position:가드", "origin:국내", "teamCode:SK", "presetIdx:20경기·300분+"],
);
assert.deepEqual(leaderFilterChips(DEFAULT_LEADERS_STATE, String), []);
assert.equal(clearLeaderFilter(fs0, "teamCode").teamCode, null);
assert.equal(clearLeaderFilter(fs0, "position").position, "all");
assert.equal(clearLeaderFilter(fs0, "position").origin, "domestic");
assert.deepEqual(resetLeaderFilters(fs0), { ...DEFAULT_LEADERS_STATE, category: "reb" });

console.log("leaders: 모든 검사 통과");

// ── USG% 열: 표 열로만(부문 카드 아님), 없는 시즌(null)은 "–"·순위 없음 ──
{
  const { TABLE_COLUMNS: cols, LEADER_CATEGORIES: cats, LEADER_STATS: defs } = await import("../lib/leaders");
  assert.ok(cols.includes("usgPct"));
  assert.equal(cols.indexOf("usgPct"), cols.indexOf("tsPct") + 1); // TS% 바로 뒤
  assert.ok(!cats.includes("usgPct"));
  assert.equal(defs.usgPct.short, "USG%");
  const noUsg = mk({ id: "nu", usgPct: null });
  assert.ok(Number.isNaN(statValue(noUsg, "usgPct", "perGame")));
  assert.equal(formatStat(statValue(noUsg, "usgPct", "perGame"), "usgPct", "perGame"), "–");
  assert.equal(formatStat(statValue(mk({ id: "u", usgPct: 26.73 }), "usgPct", "total"), "usgPct", "total"), "26.7"); // 모드 무관
  const r = rankMap([mk({ id: "u1", usgPct: 30 }), mk({ id: "u2", usgPct: 20 }), noUsg], "usgPct", "perGame");
  assert.deepEqual([...r.entries()], [["u1", 1], ["u2", 2]]); // 값 없는 선수는 순위 없음
  console.log("leaders: USG% 열 통과");
}
