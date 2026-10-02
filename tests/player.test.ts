// 선수 페이지·검색 검증 (lib/metrics careerSummary·buildCardEntry, lib/career, lib/search). 실행: npm run test:player
import assert from "node:assert/strict";
import { championshipSummary, namuWikiSearchUrl, profileFacts } from "../lib/career";
import {
  buildCardContext,
  buildCardEntry,
  careerSummary,
  DEFAULT_QUALIFY,
  type CardInput,
} from "../lib/metrics";
import {
  activeSpanLabel,
  formatTrend,
  TREND_METRICS,
  seasonRangeLabel,
  seasonShortLabel,
  seasonTickLabel,
  teamChangedAt,
  teamStints,
  trendRows,
  trendValue,
} from "../lib/career";
import { buildSearchIndex, matchScore, normalizeName, searchPlayers, searchSpanLabel } from "../lib/search";
import type { PlayerIndexEntry, SearchEntry } from "../lib/types";

// ── 통산: 합계 ÷ 합계 경기 (시즌 평균의 평균이 아님) ──
const z = { stl: 0, blk: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0 };
const sum = careerSummary([
  { games: 50, points: 1000, reb: 500, ast: 100, stl: 50, blk: 25, fgm: 400, fga: 800, tpm: 50, tpa: 150 }, // 20.0 / 10.0 / 2.0 · 50% · 33.3%
  { games: 2, points: 2, reb: 0, ast: 0, stl: 2, blk: 0, fgm: 1, fga: 10, tpm: 0, tpa: 5 },             // 1.0 (몇 경기 안 뛴 시즌) · 10% · 0%
]);
assert.equal(sum.seasons, 2);
assert.equal(sum.games, 52);
assert.equal(sum.points, 1002 / 52);                // ≈ 19.27 (평균의 평균이면 10.5)
assert.equal(sum.reb, 500 / 52);
assert.equal(sum.ast, 100 / 52);
assert.equal(sum.stl, 52 / 52);
assert.equal(sum.blk, 25 / 52);
// 통산 성공률 = 성공 합계 ÷ 시도 합계 (시즌 성공률 평균 (50 + 10) / 2 = 30 이 아니다)
assert.equal(sum.fgPct, (401 / 810) * 100);          // ≈ 49.5
assert.equal(sum.tpPct, (50 / 155) * 100);           // ≈ 32.3 (평균이면 16.7)
// 시도 0 → null (3점을 한 번도 안 던진 센터 등)
assert.equal(careerSummary([{ games: 10, points: 40, reb: 50, ast: 5, ...z, fgm: 20, fga: 40 }]).tpPct, null);
assert.deepEqual(careerSummary([]), { seasons: 0, games: 0, points: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgPct: null, tpPct: null, wins: 0, losses: 0, winPct: null });
// 통산 승패: 뛴 경기의 승·패 합, 승률 = 승 ÷ (승 + 패)
{
  const w = careerSummary([
    { games: 50, points: 0, reb: 0, ast: 0, ...z, fgm: 0, fga: 0, wins: 30, losses: 20 },
    { games: 10, points: 0, reb: 0, ast: 0, ...z, fgm: 0, fga: 0, wins: 2, losses: 8 },
  ]);
  assert.equal(w.wins, 32);
  assert.equal(w.losses, 28);
  assert.ok(Math.abs(w.winPct! - (32 / 60) * 100) < 1e-9);
}
console.log("player: 통산 계산 통과");

// ── 시즌 표기 ──
assert.equal(seasonShortLabel("2025-2026"), "25-26");
assert.equal(seasonShortLabel("1999-2000"), "99-00");
assert.equal(seasonShortLabel("1997"), "97");
assert.equal(seasonShortLabel("25-26"), "25-26"); // 이미 짧은 표기
// 연속 시즌 구간: 첫 시즌 시작 연도 - 마지막 시즌 끝 연도
assert.equal(seasonRangeLabel("2020-2021", "2022-2023"), "20-23");
assert.equal(seasonRangeLabel("2025-2026", "2025-2026"), "25-26");
assert.equal(seasonRangeLabel("1997", "1999-2000"), "97-00");
assert.equal(seasonRangeLabel("19-20", "25-26"), "19-26");
assert.equal(seasonTickLabel("2025-2026"), "25-26");
assert.equal(seasonTickLabel("1997"), "97");
assert.equal(activeSpanLabel("2019-2020", "2025-2026", 7), "19-26 · 7시즌");
assert.equal(activeSpanLabel("2025-2026", "2025-2026", 1), "25-26 · 1시즌");

// ── 소속 팀 이력: 연속 구간, 돌아오면 새 구간 ──
const stints = teamStints([
  { teamCode: "55", seasonLabel: "A" },
  { teamCode: "55", seasonLabel: "B" },
  { teamCode: "35", seasonLabel: "C" },
  { teamCode: "55", seasonLabel: "D" },
]);
assert.deepEqual(stints.map((s) => [s.teamCode, s.fromLabel, s.toLabel, s.seasons]), [
  ["55", "A", "B", 2],
  ["35", "C", "C", 1],
  ["55", "D", "D", 1],
]);
assert.equal(teamChangedAt([{ teamCode: "1" }, { teamCode: "2" }], 1), true);
assert.equal(teamChangedAt([{ teamCode: "1" }, { teamCode: "2" }], 0), false);

// ── 추이: 경기당 환산·빈 시즌 null·이적 표시 ──
const base = { fgPct: 45, tpPct: 35, per: 15, reb: 100, ast: 50, stl: 30, blk: 10 };
const career = [
  { seasonCode: 43, seasonLabel: "2023-2024", teamCode: "55", games: 50, points: 1000, ...base },
  { seasonCode: 47, seasonLabel: "2025-2026", teamCode: "35", games: 40, points: 400, ...base },
];
const all = [41, 43, 45, 47, 49].map((c) => ({ seasonCode: c, seasonLabel: `S${c}` }));
const rows = trendRows(career, all, "points");
assert.deepEqual(rows.map((r) => r.seasonCode), [43, 45, 47]); // 첫~마지막 시즌 사이만, 빈 시즌 포함
assert.deepEqual(rows.map((r) => r.value), [20, null, 10]);
assert.deepEqual(rows.map((r) => r.teamChanged), [false, false, true]);
assert.equal(rows[0].seasonLabel, "2023-2024"); // 선수 기록의 라벨 우선
assert.equal(trendValue(career[0], "fgPct"), 45); // 비율은 그대로
assert.equal(trendValue(career[0], "tpPct"), 35);
assert.equal(trendValue(career[0], "stl"), 0.6); // 30 / 50경기
assert.equal(trendValue(career[1], "blk"), 0.25);
// 추이 지표 8개: 득점·리바·어시·스틸·블록·야투%·3점%·PER (TS% 대신 3점%)
assert.deepEqual(TREND_METRICS.map((m) => m.key), ["points", "reb", "ast", "stl", "blk", "fgPct", "tpPct", "per"]);
assert.equal(formatTrend(35, "tpPct"), "35.0%");
assert.equal(trendValue({ ...career[0], games: 0 }, "points"), 0);
assert.equal(formatTrend(45, "fgPct"), "45.0%");
assert.equal(formatTrend(20, "points"), "20.0");
assert.deepEqual(trendRows([], all, "points"), []);
console.log("player: 시즌 표기·팀 이력·추이 통과");

// ── 카드 한 장 계산 (CardExplorer·선수 페이지 공용) ──
const mkCard = (o: Partial<CardInput> & { id: string }): CardInput & { id: string } => ({
  games: 20, minutes: 400, points: 200, reb: 100, ast: 50, stl: 10, blk: 5, tov: 30,
  fga: 160, tpa: 60, fta: 40, fgPct: 45, tpPct: 35, ftPct: 75,
  fgm: 80, tpm: 21, oreb: 20, dreb: 80, goodDef: 0, deflections: 0, midA: 0, midM: 0, rebPct: 0, astPct: 0,
  per: 15, usgPct: 0, tsPct: 55, efgPct: 50, tovPct: 12, astTo: 1.7, fouls: 40,
  nationality: null, isForeign: false, ...o,
});
const players = [mkCard({ id: "a", points: 400, per: 25 }), mkCard({ id: "b" }), mkCard({ id: "c", games: 2, minutes: 10 })];
const ctx = buildCardContext(players, DEFAULT_QUALIFY, { advanced: false, plusMinus: false, goodDef: false, hustle: false });
assert.equal(ctx.qualifiedCount, 2);
const ea = buildCardEntry(players[0], ctx);
assert.equal(ea.player.id, "a");
assert.equal(ea.qualified, true);
assert.equal(ea.stats[0].rank.rank, 1); // 경기당 득점 1위
assert.equal(ea.stats.length, 10); // 9개 + 파울
assert.deepEqual(ea.stats[9].rank, { rank: null, of: 0, reason: "unranked" }); // 파울은 순위 없음
assert.equal(ea.stats[9].value, 2); // 경기당 파울 40 / 20
const ec = buildCardEntry(players[2], ctx);
assert.equal(ec.qualified, false);
assert.equal(ec.stats[0].rank.reason, "sample");
assert.equal(ea.usgPct, null); // USG% 없는 시즌
assert.equal(ea.gradeGroup.label, "국내 선수"); // 마스터 없음 + isForeign false → 국내
assert.equal(ea.gradeGroup.count, 2);
console.log("player: 카드 계산 통과");

// ── 검색 ──
assert.equal(normalizeName(" Guy Terrance. Rucker "), "guyterrancerucker");
const mkS = (id: string, nameKo: string, nameEn: string, last: number): SearchEntry => ({
  id, nameKo, nameEn, team: "SK", from: "2019-20", to: "2025-26", last, seasons: [last], photoUrl: "", positionGroup: null, positionLabel: null,
  color: { primary: "#000", text: "#fff" },
});
const idx: SearchEntry[] = [
  mkS("1", "자밀 워니", "Jameel Warney", 47),
  mkS("2", "김민수", "Kim Min Soo", 20),
  mkS("3", "김민수", "Kim Min Su", 45), // 동명이인
  mkS("4", "민수호", "Min Soo Ho", 30),
  mkS("5", "이워니", "Lee Wonee", 10),
];
assert.equal(matchScore(idx[0], "자밀워니"), 0);       // 공백 무시, 전체 일치
assert.equal(matchScore(idx[0], "자밀"), 1);            // 앞부분
assert.equal(matchScore(idx[0], "워니"), 3);            // 중간 부분
assert.equal(matchScore(idx[0], "warney"), 2);          // 영문 성으로 시작
assert.equal(matchScore(idx[0], "JAMEEL WARNEY"), 0);   // 대소문자·공백 무시
assert.equal(matchScore(idx[0], "  "), null);
assert.equal(matchScore(idx[0], "없는이름"), null);
// 워니: "자밀 워니"(중간 일치)와 "이워니"(중간 일치) → 같은 점수면 최근 선수 먼저
assert.deepEqual(searchPlayers(idx, "워니").map((e) => e.id), ["1", "5"]);
// 동명이인 둘 다 나오고 최근에 뛴 선수 먼저, 앞부분 일치가 중간 일치(민수호 ×, "김민수" 앞부분)보다 먼저
assert.deepEqual(searchPlayers(idx, "김민수").map((e) => e.id), ["3", "2"]);
assert.deepEqual(searchPlayers(idx, "민수").map((e) => e.id), ["4", "3", "2"]);
assert.equal(searchPlayers(idx, "", 10).length, 0);
assert.equal(searchPlayers(Array.from({ length: 30 }, (_, i) => mkS(String(i), `김${i}`, "", i)), "김", 10).length, 10);
assert.equal(searchSpanLabel({ from: "25-26", to: "25-26" }), "25-26");
assert.equal(searchSpanLabel({ from: "19-20", to: "25-26" }), "19-26");

// 색인 → 검색용 경량 색인
const noProfile = {
  position: null, positionLabel: null, positionGroup: null, nationality: null,
  heightCm: null, weightKg: null, backNumber: null, draft: null,
} as const;
const pIdx: PlayerIndexEntry[] = [
  { id: "9", nameKo: "가", nameEn: "Ga", isForeign: false, photoUrl: "p9", ...noProfile, position: "GF", positionLabel: "가드-포워드", positionGroup: "G", seasons: [
    { seasonCode: 43, teamCode: "55", teamShort: "SK", games: 1 },
    { seasonCode: 47, teamCode: "35", teamShort: "삼성", games: 2 },
  ] },
  { id: "8", nameKo: "나", nameEn: "Na", isForeign: true, photoUrl: "p8", ...noProfile, seasons: [] },
];
const built = buildSearchIndex(pIdx, (c) => (c === 43 ? "2023-2024" : "2025-2026"), (t) => (t === "35" ? { primary: "#00f", text: "#fff" } : undefined));
assert.equal(built.length, 1); // 시즌 없는 선수는 제외
assert.deepEqual(built[0], {
  id: "9", nameKo: "가", nameEn: "Ga", team: "삼성", from: "23-24", to: "25-26", last: 47, seasons: [43, 47], photoUrl: "p9",
  positionGroup: "G", positionLabel: "가드-포워드",
  color: { primary: "#00f", text: "#fff" },
});
console.log("player: 검색 매칭·색인 통과");

// 프로필 한 줄 (히어로)
assert.deepEqual(
  profileFacts({ positionLabel: "센터", heightCm: 199, weightKg: 118, backNumber: "00", draft: { year: 2015, round: 1, pick: 3 } }),
  [
    { label: "포지션", value: "센터" },
    { label: "키", value: "199cm" },
    { label: "몸무게", value: "118kg" },
    { label: "등번호", value: "#00" },
    { label: "드래프트", value: "2015 1라운드 3순위" },
  ],
);
assert.deepEqual(profileFacts({ positionLabel: null, heightCm: null, weightKg: null, backNumber: null, draft: { year: 1998, round: null, pick: null } }), [
  { label: "드래프트", value: "1998" },
]);
console.log("player: 프로필 표기 통과");

// 랜덤 카드 뽑기: 프라임 시즌이 있으면 그 시즌, 없으면 뛴 시즌 중 하나
{
  const { pickRandomCard } = await import("../lib/search");
  const list = [
    { id: "a", seasons: [43, 45, 47], prime: 45 },
    { id: "b", seasons: [47] },
    { id: "c", seasons: [] },
  ];
  assert.deepEqual(pickRandomCard(list, () => 0), { id: "a", seasonCode: 45 });
  assert.deepEqual(pickRandomCard(list, () => 0.99), { id: "b", seasonCode: 47 });
  assert.equal(pickRandomCard([], () => 0), null);
}

// 즐겨찾기 (lib/favorites): 깨진 값은 빈 목록, 토글은 맨 앞에 넣고 다시 누르면 뺀다
{
  const { parseFavorites, toggleFavorite } = await import("../lib/favorites");
  assert.deepEqual(parseFavorites(null), []);
  assert.deepEqual(parseFavorites("not json"), []);
  assert.deepEqual(parseFavorites('["1","1","x",3,"2"]'), ["1", "2"]);
  assert.deepEqual(toggleFavorite(["1"], "2"), ["2", "1"]);
  assert.deepEqual(toggleFavorite(["2", "1"], "2"), ["1"]);
}

// ── 우승 횟수 (lib/career championshipSummary) ──
{
  const ss = [
    { seasonCode: 25, seasonLabel: "2014-2015", teamShort: "모비스", team: { shortName: "현대모비스" } },
    { seasonCode: 11, seasonLabel: "2006-2007", teamShort: "모비스", team: null },
  ];
  assert.deepEqual(championshipSummary([25, 11], ss), { count: 2, items: ["06-07 모비스", "14-15 현대모비스"] });
  assert.equal(championshipSummary([], ss), null);
  assert.equal(championshipSummary(undefined, ss), null);
  assert.equal(championshipSummary([99], ss), null);                    // 뛴 시즌에 없는 코드는 뺀다
  console.log("player: 우승 횟수 통과");
}
assert.equal(namuWikiSearchUrl(" 양동근 "), "https://namu.wiki/Search?q=%EC%96%91%EB%8F%99%EA%B7%BC%20%EB%86%8D%EA%B5%AC");
console.log("player: 나무위키 링크 통과");
