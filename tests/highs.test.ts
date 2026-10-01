// 한 경기 최다(시즌 하이·커리어 하이) 검증 — 응답 파싱·수집 대상 선정·시즌 하이 1위·만 나이·커리어 하이 행.
// 실행: npm run test:highs
import assert from "node:assert/strict";
import {
  classifyMostGameKey,
  daysBetween,
  highsTargetSeasons,
  isMostGameResponse,
  parseMostGame,
  pendingPlayers,
  playerNosFromTraditional,
  recordKeyOf,
  RECORD_TXT_TO_KEY,
  todayKst,
  toIsoDate,
  updateFirstSeen,
  PREVIOUS_SEASON_GRACE_DAYS,
} from "../scripts/highs";
import { birthdayIso, isProfileResponse, profileExtraFrom } from "../scripts/player-master";
import { HIGH_KEYS } from "../lib/highs";

// ── 응답 파싱: recordTxt 16개("리바운드"·"전체 리바운드" 둘 다 reb) → 우리 키 15개 ──
assert.equal(Object.keys(RECORD_TXT_TO_KEY).length, 16);
assert.equal(new Set(Object.values(RECORD_TXT_TO_KEY)).size, 15);
assert.deepEqual(new Set(Object.values(RECORD_TXT_TO_KEY)), new Set(HIGH_KEYS));
assert.equal(recordKeyOf("필드골 성공"), "fgm"); // 필드골 = 야투 전체
assert.equal(recordKeyOf("2점슛 성공"), "twoPm");
assert.equal(recordKeyOf(" 3점슛  성공률 "), "tpPct"); // 공백·"률/율" 흔들림
assert.equal(recordKeyOf("덩크"), null);
assert.equal(toIsoDate("20231021"), "2023-10-21");
assert.equal(toIsoDate("2023-10-21"), null);

const item = (recordTxt: string, record: string, extra: Record<string, unknown> = {}) => ({
  seasonCode: 45,
  recordSc: recordTxt.endsWith("율") ? "RATE" : "RECORD",
  recordTxt,
  record,
  awayTeam: "70",
  gameDate: "20231021",
  scoreRankCn: 1,
  orderNo: 1,
  ...extra,
});

const sample = {
  MostGameRegularSeasons: [
    item("득점", "46.000000", { scoreRankCn: 2 }),
    item("3점슛 성공율", "100.000000"),
    item("리바운드", "15.0000", { awayTeam: "", gameDate: "" }),
  ],
  MostGameRegularAllTimes: [
    item("득점", "50.000000", { seasonCode: 41, gameDate: "20230105", awayTeam: "55" }),
    item("득점", "50.000000", { seasonCode: 39, gameDate: "20211231", awayTeam: "60" }), // 같은 값 → 먼저 낸 것
    item("블록", "abc"), // 숫자 아님 → 버림
  ],
  MostGamePlayOffAllTimes: [item("어시스트", "12.0")],
  MostGameChampAllTimes: [],
  MostGameSomethingNew: [item("득점", "1")],
};

const parsed = parseMostGame(sample);
assert.deepEqual(parsed.season!.pts, { value: 46, date: "2023-10-21", opponentTeamCode: "70", times: 2, seasonCode: 45 });
assert.equal(parsed.season!.tpPct!.value, 100);
assert.deepEqual(parsed.season!.reb, { value: 15, date: null, opponentTeamCode: null, times: 1, seasonCode: 45 });
assert.equal(parsed.season!.ast, null); // 응답에 없는 부문
assert.equal(parsed.career.regular!.pts!.value, 50);
assert.equal(parsed.career.regular!.pts!.date, "2021-12-31"); // 동률이면 먼저 달성한 날
assert.equal(parsed.career.regular!.pts!.opponentTeamCode, "60");
assert.equal(parsed.career.regular!.blk, null);
assert.equal(parsed.career.playoff!.ast!.value, 12);
assert.equal(parsed.career.finals, null); // 빈 배열 → 기록 없음
assert.deepEqual(parsed.unknownKeys, ["MostGameSomethingNew"]);
// 문자열로 한 번 더 감싼 응답도 읽는다
assert.equal(parseMostGame(JSON.stringify(sample)).season!.pts!.value, 46);
// 모르는 형태 → 전부 null
assert.deepEqual(parseMostGame(null), { season: null, career: { regular: null, playoff: null, finals: null }, unknownKeys: [] });
assert.deepEqual(parseMostGame("<html>"), { season: null, career: { regular: null, playoff: null, finals: null }, unknownKeys: [] });

// 배열 이름 분류: 챔프전 판정이 플레이오프보다 먼저
assert.deepEqual(classifyMostGameKey("MostGameRegularSeasons"), { game: "regular", scope: "season" });
assert.deepEqual(classifyMostGameKey("MostGameRegularAllTimes"), { game: "regular", scope: "allTime" });
assert.deepEqual(classifyMostGameKey("MostGamePlayOffSeasons"), { game: "playoff", scope: "season" });
assert.deepEqual(classifyMostGameKey("MostGamePOAllTimes"), { game: "playoff", scope: "allTime" });
assert.deepEqual(classifyMostGameKey("MostGameChampionAllTimes"), { game: "finals", scope: "allTime" });
assert.deepEqual(classifyMostGameKey("MostGamePlayOffFinalAllTimes"), { game: "finals", scope: "allTime" });
assert.equal(classifyMostGameKey("RegularGameRecords"), null);
// 실제 응답 키 (2026-09-30 시즌 47 백필 확인)
assert.deepEqual(classifyMostGameKey("MostGameRegularPlayoffs"), { game: "playoff", scope: "allTime" });
assert.deepEqual(classifyMostGameKey("MostGameRegularChampions"), { game: "finals", scope: "allTime" });
assert.equal(classifyMostGameKey("MostGameDLeagueAlltimes"), null);
assert.equal(recordKeyOf("전체 리바운드"), "reb");

// 저장 전 응답 검사: MostGame… 배열이 있어야 저장
assert.equal(isMostGameResponse(sample), true);
assert.equal(isMostGameResponse({ MostGameRegularSeasons: [] }), true); // 기록이 없는 선수도 정상 응답
assert.equal(isMostGameResponse({}), false);
assert.equal(isMostGameResponse(""), false);
assert.equal(isMostGameResponse([]), false);
console.log("highs: 응답 파싱 통과");

// ── 프로필: 생년월일·국가·출신교 ──
const profile = { playerInfo: [{ birthday: "19940131", country: "미국", countryEng: "USA", univSch: "Stony brook ", pHeight: 200 }], playerScore: [] };
assert.equal(isProfileResponse(profile), true);
assert.equal(isProfileResponse({ playerScore: [] }), false);
assert.deepEqual(profileExtraFrom(profile), { birthday: "1994-01-31", country: "미국", school: "Stony brook" });
assert.deepEqual(profileExtraFrom({ playerInfo: [{ birthday: "", country: "-", univSch: null }] }), { birthday: null, country: null, school: null });
assert.deepEqual(profileExtraFrom(null), { birthday: null, country: null, school: null });
assert.equal(birthdayIso("19941331"), null);
console.log("highs: 프로필 파싱 통과");

// ── 수집 대상 시즌 (매일) ──
assert.equal(PREVIOUS_SEASON_GRACE_DAYS, 30);
assert.equal(daysBetween("2026-10-01", "2026-10-31"), 30);
const seasons = (latestCount: number) => [
  { seasonCode: 43, playerCount: 190 },
  { seasonCode: 45, playerCount: 195 },
  { seasonCode: 47, playerCount: 193 },
  { seasonCode: 49, playerCount: latestCount },
];
// 개막 전(최신 49 가 0명): 직전 시즌 47 하나 — 아직 "현재"
assert.deepEqual(highsTargetSeasons({ seasons: seasons(0), firstSeen: { "47": "2025-10-03" }, today: "2026-09-30" }), [47]);
// 개막 첫날: 첫 수집일 = 오늘 → 49 + 직전 47
assert.deepEqual(highsTargetSeasons({ seasons: seasons(150), firstSeen: { "49": "2026-10-03" }, today: "2026-10-03" }), [49, 47]);
// 첫 수집일 기록이 없으면 오늘로 본다
assert.deepEqual(highsTargetSeasons({ seasons: seasons(150), firstSeen: {}, today: "2026-10-03" }), [49, 47]);
// 29일째까지 포함, 30일째부터 직전 시즌 제외 (첫 수집일 포함 30일간)
assert.deepEqual(highsTargetSeasons({ seasons: seasons(150), firstSeen: { "49": "2026-10-03" }, today: "2026-11-01" }), [49, 47]);
assert.deepEqual(highsTargetSeasons({ seasons: seasons(150), firstSeen: { "49": "2026-10-03" }, today: "2026-11-02" }), [49]);
// 입력 순서와 무관, 선수 없는 시즌만이면 빈 목록
assert.deepEqual(highsTargetSeasons({ seasons: [...seasons(0)].reverse(), firstSeen: {}, today: "2026-09-30" }), [47]);
assert.deepEqual(highsTargetSeasons({ seasons: [{ seasonCode: 49, playerCount: 0 }], firstSeen: {}, today: "2026-09-30" }), []);
// 직전 시즌이 0명이면 그 전 선수 있는 시즌 (중간 빈 코드 건너뜀)
assert.deepEqual(
  highsTargetSeasons({ seasons: [{ seasonCode: 45, playerCount: 190 }, { seasonCode: 47, playerCount: 0 }, { seasonCode: 49, playerCount: 10 }], firstSeen: {}, today: "2026-10-03" }),
  [49, 45],
);

// 첫 수집일: 선수가 생긴 첫날만 기록, 이미 있으면 그대로
assert.deepEqual(updateFirstSeen({}, 49, 0, "2026-09-30"), {});
assert.deepEqual(updateFirstSeen({}, 49, 150, "2026-10-03"), { "49": "2026-10-03" });
assert.deepEqual(updateFirstSeen({ "49": "2026-10-03" }, 49, 190, "2026-10-20"), { "49": "2026-10-03" });
assert.equal(todayKst(new Date("2026-09-30T19:10:00Z")), "2026-10-01"); // 04:10 KST 는 다음 날
console.log("highs: 수집 대상 선정 통과");

// ── 선수 목록·백필 이어받기 ──
assert.deepEqual(playerNosFromTraditional({ data: [{ playerNo: 291248 }, { playerNo: "290100" }, { playerNo: 291248 }, {}] }), ["291248", "290100"]);
assert.deepEqual(playerNosFromTraditional({ resultCode: 200 }), []);
assert.deepEqual(playerNosFromTraditional(null), []);
assert.deepEqual(pendingPlayers(["1", "2", "3"], ["2.json", "x.txt"]), ["1", "3"]);
assert.deepEqual(pendingPlayers(["1"], []), ["1"]);
console.log("highs: 백필 대상 통과");

// ── 시즌 하이 1위 (lib/highs computeSeasonHighLeaders) ──
import { buildSeasonHighCards, computeSeasonHighLeaders, emptyHighsSet, formatHighDate, formatHighValue, HERO_HIGH_KEYS, LEADER_CATEGORY_HIGH, SEASON_HIGH_LEADER_KEYS } from "../lib/highs";
import type { HighRecord, HighsSet } from "../lib/types";

const rec = (value: number, date: string | null, extra: Partial<HighRecord> = {}): HighRecord => ({
  value, date, opponentTeamCode: "55", times: 1, seasonCode: 47, ...extra,
});
const hs = (patch: Partial<HighsSet>): HighsSet => ({ ...emptyHighsSet(), ...patch });

assert.equal(SEASON_HIGH_LEADER_KEYS.length, 11);
// 화면 부문 7개 (사용자 요청 순서) — 모두 1위 계산 부문 안에 있어야 한다
assert.deepEqual([...HERO_HIGH_KEYS], ["pts", "reb", "ast", "stl", "blk", "tpm", "ftm"]);
for (const k of HERO_HIGH_KEYS) assert.ok(SEASON_HIGH_LEADER_KEYS.includes(k), `${k} 는 1위 계산 부문`);
for (const k of ["fgPct", "twoPPct", "tpPct", "ftPct"]) assert.ok(!(SEASON_HIGH_LEADER_KEYS as readonly string[]).includes(k), `${k} 는 순위표 제외`);

const leaders = computeSeasonHighLeaders([
  { playerNo: "10", seasonHighs: hs({ pts: rec(40, "2025-12-01"), tpPct: rec(100, "2025-10-05"), blk: rec(0, "2025-10-05") }) },
  { playerNo: "20", seasonHighs: hs({ pts: rec(40, "2025-11-02", { opponentTeamCode: "60" }), reb: rec(18, "2026-01-01"), fgm: rec(15, "2025-11-02") }) }, // 동률 → 먼저 낸 20
  { playerNo: "30", seasonHighs: hs({ pts: rec(38, "2025-10-04"), reb: rec(18, "2026-01-01") }) },          // 리바 같은 날 동률 → 번호 작은 20
  { playerNo: "40", seasonHighs: null },
])!;
assert.equal(leaders.pts!.playerNo, "20");
assert.equal(leaders.pts!.value, 40);
assert.equal(leaders.pts!.opponentTeamCode, "60");
assert.equal(leaders.reb!.playerNo, "20");
assert.equal(leaders.blk, null);                   // 0 은 1위로 치지 않는다
assert.equal(leaders.ast, null);
assert.ok(!("tpPct" in leaders));                  // 성공률(RATE) 은 넣지 않는다
assert.equal(computeSeasonHighLeaders([{ playerNo: "1", seasonHighs: null }, { playerNo: "2" }]), null); // raw 없음
// 날짜 없는 기록은 날짜 있는 동률 기록 뒤
assert.equal(
  computeSeasonHighLeaders([
    { playerNo: "1", seasonHighs: hs({ ast: rec(12, null) }) },
    { playerNo: "2", seasonHighs: hs({ ast: rec(12, "2026-02-02") }) },
  ])!.ast!.playerNo,
  "2",
);

// 카드 줄: 선수 목록에 없는 선수·빈 부문은 빠지고, 상대는 약칭 → 코드
const cards = buildSeasonHighCards(
  leaders,
  [
    { id: "20", nameKo: "선수이십", photoUrl: null, teamCode: "55" },
  ],
  (code) => (code === "55" ? "SK" : null),
);
assert.equal(leaders.fgm!.playerNo, "20");         // 데이터(1위)는 11개 다 계산
assert.deepEqual(cards.map((c) => c.key), ["pts", "reb"]); // 카드는 HERO_HIGH_KEYS 만 (야투 성공 제외)
assert.equal(cards[0].opponent, "60");              // 팀 목록에 없으면 코드
assert.equal(cards[1].opponent, "SK");
assert.equal(cards[0].value, "40");
assert.equal(cards[0].date, "2025.11.02");
assert.deepEqual(buildSeasonHighCards(null, [], () => null), []);
assert.equal(LEADER_CATEGORY_HIGH.points, "pts");
assert.equal(LEADER_CATEGORY_HIGH.tpPct, undefined);
assert.equal(formatHighValue(46, "pts"), "46");
assert.equal(formatHighValue(66.6667, "fgPct"), "66.7%");
assert.equal(formatHighValue(100, "ftPct"), "100%");
assert.equal(formatHighDate("2023-10-21"), "2023.10.21");
assert.equal(formatHighDate(null), "–");
// 슛 부문 성공/시도 표기
import { formatHighShot } from "../lib/highs";
assert.equal(formatHighShot(rec(5, "2026-01-01", { attempts: 8, pct: 62.5 }), "tpm"), "5/8 · 62.5%");
assert.equal(formatHighShot(rec(10, "2026-01-01", { attempts: 10 }), "ftm"), "10/10 · 100%");   // pct 없으면 계산
assert.equal(formatHighShot(rec(2, "2026-01-01", { attempts: 3 }), "ftm"), "2/3 · 66.7%");
assert.equal(formatHighShot(rec(5, "2026-01-01"), "tpm"), null);                                // 시도 모름 → 개수만
assert.equal(formatHighShot(rec(5, "2026-01-01", { attempts: null, pct: null }), "tpm"), null);
assert.equal(formatHighShot(rec(40, "2026-01-01", { attempts: 20 }), "pts"), null);              // 득점에는 붙이지 않는다
assert.equal(formatHighShot(null, "tpm"), null);
const shotCards = buildSeasonHighCards(
  computeSeasonHighLeaders([{ playerNo: "20", seasonHighs: hs({ tpm: rec(8, "2026-01-01", { attempts: 12, pct: 66.7 }), ftm: rec(9, "2026-01-02") }) }]),
  [{ id: "20", nameKo: "선수이십", photoUrl: null, teamCode: "55" }],
  () => null,
);
assert.deepEqual(shotCards.map((c) => [c.key, c.shot]), [["tpm", "8/12 · 66.7%"], ["ftm", null]]);
console.log("highs: 시즌 하이 1위 통과");

// ── 만 나이·히어로 추가 항목 (lib/career) ──
import { ageOn, careerHighRows, careerHighTabs, personalFacts, seoulDateIso } from "../lib/career";

assert.equal(ageOn("1994-01-31", "2026-09-30"), 32);
assert.equal(ageOn("1994-10-01", "2026-09-30"), 31);   // 생일 전
assert.equal(ageOn("1994-09-30", "2026-09-30"), 32);   // 생일 당일
assert.equal(ageOn("2000-02-29", "2026-02-28"), 25);   // 윤일생: 2/28 은 아직 전
assert.equal(ageOn(null, "2026-09-30"), null);
assert.equal(ageOn("19940131", "2026-09-30"), null);
assert.equal(ageOn("2030-01-01", "2026-09-30"), null);
assert.equal(seoulDateIso(new Date("2026-09-30T15:30:00Z")), "2026-10-01");
assert.deepEqual(personalFacts({ birthday: "1994-01-31", country: "미국", school: "Stony brook" }, "2026-09-30"), [
  { label: "나이", value: "만 32세" },
  { label: "국적", value: "미국" },
  { label: "출신교", value: "Stony brook" },
]);
assert.deepEqual(personalFacts({}, "2026-09-30"), []);
console.log("highs: 만 나이 통과");

// ── 커리어 하이 행 ──
const teamName = (code: string, season: number | null) => (code === "70" && season === 45 ? "정관장" : null);
const rows = careerHighRows(
  hs({
    pts: rec(46, "2023-10-21", { opponentTeamCode: "70", times: 2, seasonCode: 45 }),
    fgPct: rec(100, "2024-01-01", { opponentTeamCode: "70", seasonCode: 43 }),
    ftm: rec(12, "2024-01-01", { opponentTeamCode: "70", seasonCode: 43 }),
    blk: rec(0, null),
    ast: rec(9, null, { opponentTeamCode: null, times: null }),
  }),
  teamName,
);
assert.deepEqual(rows.map((r) => r.key), ["pts", "ast", "ftm"]); // HERO_HIGH_KEYS 순서, 0·null·화면 밖 부문(fgPct) 제외
assert.deepEqual(rows[0], { key: "pts", label: "득점", value: "46", opponent: "정관장", date: "2023.10.21", times: "2회", rate: false, shot: null });
assert.equal(rows[2].opponent, "70");                // 그 시즌 팀 목록에 없으면 코드
assert.deepEqual([rows[1].opponent, rows[1].date, rows[1].times], ["–", "–", "–"]);
assert.deepEqual(careerHighRows(null, teamName), []);
const tabs = careerHighTabs({ regular: hs({ pts: rec(30, "2020-01-01") }), playoff: null, finals: hs({}) }, teamName);
assert.deepEqual(tabs.map((t) => t.key), ["regular"]); // 행 없는 탭은 빠진다
assert.deepEqual(careerHighTabs(null, teamName), []);
assert.deepEqual(careerHighTabs(undefined, teamName), []);
console.log("highs: 커리어 하이 행 통과");

// ── 커리어 하이 업적 카드 (피드백 5차 #3) ──
{
  const { careerHighAchievements, isSeasonBest } = await import("../lib/career");
  const leader = (value: number) => ({ ...rec(value, "2023-10-01"), playerNo: "999" });
  // 45 시즌 득점 1위 46점(동률 → 우리도 "시즌 최다"), 리바운드 1위는 20개(우리 15개 → 아님)
  const leaderOf = (code: number, key: string) => (code === 45 ? (key === "pts" ? leader(46) : key === "reb" ? leader(20) : null) : null);
  const label = (code: number) => (code === 45 ? "2023-2024" : null);
  const cards = careerHighAchievements(
    {
      regular: hs({
        pts: rec(46, "2023-10-21", { opponentTeamCode: "70", times: 2, seasonCode: 45 }),
        reb: rec(15, "2023-11-01", { seasonCode: 45 }),
        blk: rec(0, null),
      }),
      playoff: hs({ pts: rec(32, "2024-04-01"), stl: rec(4, "2024-04-02") }),
      finals: hs({ pts: rec(28, "2024-05-01") }),
    },
    teamName,
    leaderOf,
    label,
  );
  assert.deepEqual(cards.map((c) => c.key), ["pts", "reb", "stl"]); // HERO 순서, 세 구분 모두 없는 부문·0 은 빠짐
  assert.deepEqual(cards[0], {
    key: "pts", label: "득점", value: "46", shot: null, opponent: "정관장", date: "2023.10.21", times: 2,
    seasonBest: "2023-24", milestone: "club40", playoff: "32", finals: "28",
  });
  assert.equal(cards[1].seasonBest, null); // 1위(20) 보다 낮음
  assert.equal(cards[1].milestone, null); // 배지 조건은 득점만
  assert.deepEqual([cards[2].value, cards[2].playoff, cards[2].date, cards[2].opponent], [null, "4", "–", null]); // PO 만 있는 부문
  assert.equal(careerHighAchievements({ regular: hs({ pts: rec(52, "2020-01-01", { seasonCode: 1 }) }), playoff: null, finals: null }, teamName, leaderOf, label)[0].milestone, "club50");
  assert.deepEqual(careerHighAchievements(null, teamName, leaderOf, label), []);
  assert.equal(isSeasonBest(rec(10, null), null), false);
  assert.equal(isSeasonBest(rec(10, null), leader(10)), true);
  assert.equal(isSeasonBest(rec(0, null), leader(0)), false);
  console.log("highs: 커리어 하이 업적 카드 통과");
}

// ── 용어 앵커 ──
import { glossaryEntry, glossaryHref } from "../lib/glossary";
assert.equal(glossaryHref("gameHigh"), "/glossary#game-high");
assert.match(glossaryEntry("gameHigh")!.note!, /성공률/);
console.log("highs: 용어 통과");
