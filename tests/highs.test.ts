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

// ── 응답 파싱: recordTxt 15개 → 우리 키 15개 (빠짐·중복 없음) ──
assert.equal(Object.keys(RECORD_TXT_TO_KEY).length, 15);
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
