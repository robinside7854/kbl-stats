// 선수 마스터 조인·포지션/국적 필터·용어집·비교 탭 카드 파일 검증. 실행: npm run test:roster
import assert from "node:assert/strict";
import {
  buildProfileMap,
  EMPTY_PROFILE,
  isForeignPlayer,
  mapDraft,
  mapNationality,
  mapPosition,
  masterRows,
  toProfile,
} from "../scripts/player-master";
import {
  filterByNationality,
  filterByPosition,
  nationalityOf,
  POSITION_LABELS,
  positionGroupOf,
  positionLabel,
} from "../lib/roster";
import { GLOSSARY, glossaryEntry } from "../lib/glossary";
import { CARD_FIELDS, decodeSeasonCards, encodeSeasonCards } from "../lib/cards";
import { toCardPlayers, toLeaderPlayers } from "../lib/convert";
import { buildCardContext, DEFAULT_QUALIFY } from "../lib/metrics";
import type { CardPlayer, Player, SeasonData } from "../lib/types";

// ── 포지션: KBL 코드 → 우리 값 → 묶음 (첫 글자 기준) ──
assert.equal(mapPosition("GD"), "G");
assert.equal(mapPosition("FD"), "F");
assert.equal(mapPosition("C"), "C");
assert.equal(mapPosition("GF"), "GF");
assert.equal(mapPosition(" fc "), "FC"); // 공백·소문자 허용
assert.equal(mapPosition("X"), null);
assert.equal(mapPosition(null), null);
assert.equal(positionGroupOf("GF"), "G"); // 가드-포워드 → 가드
assert.equal(positionGroupOf("FC"), "F"); // 포워드-센터 → 포워드
assert.equal(positionGroupOf("C"), "C");
assert.equal(positionGroupOf(null), null);
assert.deepEqual(Object.values(POSITION_LABELS), ["가드", "포워드", "센터", "가드-포워드", "포워드-센터"]);
assert.equal(positionLabel("FC"), "포워드-센터");
assert.equal(positionLabel(null), null);

// ── 국적: playerFlagCode2 ──
assert.equal(mapNationality("0"), "domestic");
assert.equal(mapNationality("1"), "foreign");
assert.equal(mapNationality("2"), "asia");
assert.equal(mapNationality(2), "asia"); // 숫자로 와도
assert.equal(mapNationality("9"), null);
assert.equal(mapNationality(undefined), null);

// isForeign: 마스터 국적이 있으면 그것, 없으면 이름 추정
assert.equal(isForeignPlayer("domestic", "라건아"), false);
assert.equal(isForeignPlayer("foreign", "라건아"), true); // 이름 추정이면 국내로 잘못 나오는 경우
assert.equal(isForeignPlayer("asia", "이선 알바노"), true);
assert.equal(isForeignPlayer(null, "자밀 워니"), true);
assert.equal(isForeignPlayer(null, "김선형"), false);

// ── 드래프트·프로필 ──
assert.equal(mapDraft({ yearNo: null, roundNo: null, rankNo: null }), null); // 외국 선수
assert.deepEqual(mapDraft({ yearNo: "2012", roundNo: "1", rankNo: "3" }), { year: 2012, round: 1, pick: 3 });
assert.deepEqual(mapDraft({ yearNo: 2020, roundNo: "", rankNo: 0 }), { year: 2020, round: null, pick: null });
const row = {
  playerNo: "291056", kname: "홍길동", ename: "Hong", teamCode: "55", backNum: "00", pos: "GF",
  pWeight: "88", pHeight: 192.5, playerFlagCode2: "0", yearNo: "2019", monthNo: "11", roundNo: "1", rankNo: "4", rowNo: 1,
};
assert.deepEqual(toProfile(row), {
  position: "GF", positionLabel: "가드-포워드", positionGroup: "G", nationality: "domestic",
  heightCm: 192.5, weightKg: 88, backNumber: "00", draft: { year: 2019, round: 1, pick: 4 },
});
assert.deepEqual(toProfile({}), EMPTY_PROFILE); // 빈 행 → 전부 null
assert.equal(toProfile({ pHeight: 0, backNum: "" }).heightCm, null);

// ── raw 파일 형태: 페이지 배열 / 단일 페이지 / 문자열로 한 번 더 감싼 것 ──
const page1 = { totalCn: "3", playerList: [row, { ...row, playerNo: "2", pos: "C", playerFlagCode2: "1", yearNo: null }] };
const page2 = { totalCn: "3", playerList: [{ ...row, playerNo: "3", pos: "GD", playerFlagCode2: "2" }] };
assert.equal(masterRows([page1, page2]).length, 3);
assert.equal(masterRows(page1).length, 2);
assert.equal(masterRows(JSON.stringify([page1, JSON.stringify(page2)])).length, 3);
assert.deepEqual(masterRows(null), []);
assert.deepEqual(masterRows({ foo: 1 }), []);
const profiles = buildProfileMap([page1, page2]);
assert.equal(profiles.size, 3);
assert.equal(profiles.get("2")!.nationality, "foreign");
assert.equal(profiles.get("2")!.draft, null);
assert.equal(profiles.get("3")!.positionGroup, "G");
console.log("roster: 마스터 매핑 통과");

// ── 비교 집단 필터 ──
type P = { id: string; positionGroup: "G" | "F" | "C" | null; nationality: "domestic" | "foreign" | "asia" | null; isForeign: boolean };
const ps: P[] = [
  { id: "g-dom", positionGroup: "G", nationality: "domestic", isForeign: false },
  { id: "f-for", positionGroup: "F", nationality: "foreign", isForeign: true },
  { id: "c-asia", positionGroup: "C", nationality: "asia", isForeign: true },
  { id: "none-guess-for", positionGroup: null, nationality: null, isForeign: true },
  { id: "none-guess-dom", positionGroup: null, nationality: null, isForeign: false },
];
const ids = (xs: P[]) => xs.map((p) => p.id);
assert.deepEqual(ids(filterByPosition(ps, "all")), ids(ps));
assert.notEqual(filterByPosition(ps, "all"), ps); // 새 배열
assert.deepEqual(ids(filterByPosition(ps, "G")), ["g-dom"]);
assert.deepEqual(ids(filterByPosition(ps, "C")), ["c-asia"]); // 포지션 모름(null)은 빠진다
assert.deepEqual(ids(filterByNationality(ps, "domestic")), ["g-dom", "none-guess-dom"]);
assert.deepEqual(ids(filterByNationality(ps, "foreign")), ["f-for", "none-guess-for"]); // 마스터 없으면 이름 추정
assert.deepEqual(ids(filterByNationality(ps, "asia")), ["c-asia"]);
assert.equal(ids(filterByNationality(ps, "all")).length, 5);
assert.equal(nationalityOf({ nationality: null, isForeign: true }), "foreign");
console.log("roster: 필터 통과");

// ── 용어집 ──
const keys = GLOSSARY.map((g) => g.key);
assert.equal(new Set(keys).size, keys.length); // 중복 없음
for (const k of ["per", "tsPct", "efgPct", "usgPct", "astPct", "rebPct", "tovPct", "astTo", "per30", "percentileGrade", "qualify", "attempts"] as const) {
  const g = glossaryEntry(k);
  assert.ok(g, k);
  assert.ok(g.name && g.short, k);
  assert.ok(g.source === null || g.source.startsWith("https://"), k);
}
// 쉬운 글 규칙: 한 문장 설명 70자 안팎, 알아 둘 점 120자 이하, 코드 파일 이름 없음, 긴 대시 없음
for (const g of GLOSSARY) {
  assert.ok(g.short.length <= 80, `${g.key} short ${g.short.length}`);
  assert.ok(!g.note || g.note.length <= 120, `${g.key} note ${g.note?.length}`);
  for (const t of [g.short, g.note ?? "", g.formula ?? ""]) {
    assert.ok(!/lib\/|\.ts\b/.test(t), `${g.key} 코드 이름`);
    assert.ok(!t.includes("—"), `${g.key} 긴 대시`);
  }
}
// 옛 시즌 USG%·AST%·REB% 는 직접 계산했다는 안내
for (const k of ["usgPct", "astPct", "rebPct"] as const) assert.match(glossaryEntry(k)!.note!, /계산/);
assert.ok(GLOSSARY.filter((g) => g.source).every((g) => g.source!.includes("basketball-reference.com") || g.key === "percentileGrade"));
assert.ok(!keys.includes("pie" as never)); // PIE 는 쓰지 않는다
console.log("roster: 용어집 통과");

// ── processed 시즌 → 화면용 변환 (lib/convert) · 비교 탭 카드 파일 ──
const mkPlayer = (o: Partial<Player> & { playerNo: string }): Player => ({
  ...EMPTY_PROFILE,
  nameKo: o.playerNo, nameEn: "", teamCode: "55", teamName: "서울 SK", teamShort: "SK", isForeign: false,
  games: 20, wins: 10, losses: 10, minutes: 400,
  points: 200, fgm: 80, fga: 160, fgPct: 50, tpm: 20, tpa: 60, tpPct: 33.3333333, twoPm: 60, twoPa: 100, twoPPct: 60,
  ftm: 20, fta: 40, ftPct: 50, dunks: 0, oreb: 20, dreb: 80, reb: 100, ast: 50, stl: 10, blk: 5, tov: 30,
  goodDef: 0, fouls: 44, doubleDoubles: 0, tripleDoubles: 0, plusMinus: 0, screenAst: 0, deflections: 0,
  per: 15.123456789, offRtg: 0, defRtg: 0, netRtg: 0, efgPct: 0, tsPct: 55.5555555, astPct: 10, astTo: 0, astRatio: 0,
  orebPct: 0, drebPct: 0, rebPct: 8, usgPct: 20, usgPctRaw: 4, pace: 0, tovPct: 0, toRatio: 0, pie: 9, poss: 0,
  ...o,
});
const season: SeasonData = {
  seasonCode: 47, seasonLabel: "2025-2026", gameType: "regular", fetchedAt: "",
  coverage: { advanced: true, plusMinus: true, goodDef: true, hustle: true },
  teams: [{
    teamCode: "55", name: "서울 SK", shortName: "SK", shortNameKo: "SK", fullName: "", nameEn: "", logoName: "sk", order: 1,
    logoUrl: "logo", color: { primary: "#e4002b", secondary: "#000", text: "#fff" },
  }],
  players: [
    mkPlayer({ playerNo: "1", per: 25, position: "GF", positionGroup: "G", positionLabel: "가드-포워드", nationality: "asia", isForeign: true }),
    mkPlayer({ playerNo: "2" }),
    mkPlayer({ playerNo: "3", games: 2, minutes: 10 }),
  ],
};
const cards = toCardPlayers(season, (no) => `photo-${no}`);
assert.equal(cards[0].photoUrl, "photo-1");
assert.equal(cards[0].fouls, 44);
assert.equal(cards[0].positionGroup, "G");
assert.equal(cards[0].nationality, "asia");
assert.equal(cards[0].usgPct, 20); // processed 값(이미 ×5) 그대로
assert.ok(!("pie" in cards[0])); // 화면용 타입에는 PIE 없음
assert.deepEqual(Object.keys(cards[0]).sort(), [...CARD_FIELDS].sort()); // 파일 열 = CardPlayer 전 필드
const leaders = toLeaderPlayers(season);
assert.equal(leaders[1].fouls, 44);
assert.equal(leaders[1].photoUrl, null);
assert.equal(leaders[0].position, "GF");

const file = encodeSeasonCards({ seasonCode: 47, seasonLabel: "2025-2026", coverage: season.coverage, teams: [] }, cards);
assert.ok(!("axisSet" in file)); // 레이더 축 세트 개념은 없앴다 (구성 요소 단위 커버리지)
assert.equal(file.defaults.qualifiedCount, 2);
assert.equal(file.defaults.defaultPlayerId, "1"); // 기준 충족 선수 중 PER 1위
assert.equal(file.rows.length, 3);
assert.equal(file.rows[0][file.fields.indexOf("per")], 25);
assert.equal(file.rows[1][file.fields.indexOf("tsPct")], 55.5556); // 소수 넷째 자리
const decoded = decodeSeasonCards(JSON.parse(JSON.stringify(file)));
assert.equal(decoded.players.length, 3);
assert.deepEqual(decoded.players[0], { ...cards[0], tpPct: 33.3333, per: 25, tsPct: 55.5556 });
assert.deepEqual(decoded.defaults, file.defaults);
// 옛 파일에 없는 열은 기본값으로
const partial = decodeSeasonCards({ ...file, fields: ["id", "games"], rows: [["x", 3]] });
assert.equal((partial.players[0] as CardPlayer).positionGroup, null);
assert.equal(partial.players[0].fouls, 0);
assert.equal(partial.players[0].nameKo, "");
assert.throws(() => decodeSeasonCards({ ...file, v: 1 as 3 }));
// 파일로 만든 카드 비교 재료 = 서버에서 만든 것과 같은 선수 집단 크기
const ctx = buildCardContext(decoded.players, file.defaults.rule, file.coverage, { thresholds: file.defaults.thresholds });
assert.equal(ctx.qualifiedCount, 2);
assert.deepEqual(ctx.thresholds, file.defaults.thresholds);
// 포지션으로 좁힌 집단 + 리그 시도 기준 유지
const guards = filterByPosition(decoded.players, "G");
const gctx = buildCardContext(guards, DEFAULT_QUALIFY, file.coverage, { thresholds: file.defaults.thresholds, grading: ctx.grading });
assert.equal(gctx.qualifiedCount, 1);
assert.deepEqual(gctx.thresholds, file.defaults.thresholds);
console.log("roster: 카드 파일·변환 통과");

// ── 현역·미등록·은퇴 (2026-10-06) ──
{
  const { rosterStatusOf } = await import("../lib/roster");
  const codes = [41, 43, 45, 47, 49];
  assert.equal(rosterStatusOf(true, 41, codes, "domestic"), "active", "명단에 있으면 오래 쉬었어도 현역 (상무 복귀 등)");
  assert.equal(rosterStatusOf(false, 49, codes, "foreign"), "unregistered", "이번 시즌 뛰고 빠짐 (외국 선수 교체 등)");
  assert.equal(rosterStatusOf(false, 47, codes, "domestic"), "unregistered", "지난 시즌까지 뛰고 미등록 = 군 복무·FA 일 수 있음");
  assert.equal(rosterStatusOf(false, 45, codes, "domestic"), "unregistered", "최근 3시즌 안(45·47·49)");
  assert.equal(rosterStatusOf(false, 43, codes, "domestic"), "retired", "최근 3시즌 기록 없음 → 은퇴");
  assert.equal(rosterStatusOf(false, 43, codes, "foreign"), "left", "외국 선수는 KBL 떠남");
  assert.equal(rosterStatusOf(false, 43, codes, "asia"), "left", "아시아쿼터도 KBL 떠남");
  assert.equal(rosterStatusOf(false, 43, [49, 41, 47, 43, 45], "domestic"), "retired", "시즌 순서 무관");
}
{
  const { rosterCheckDue, rosterChange, applyRosterCheck, EMPTY_ROSTER_LOG } = await import("../scripts/active-roster");
  assert.equal(rosterCheckDue(null, "2026-10-06"), true, "확인한 적 없으면 확인");
  assert.equal(rosterCheckDue("2026-10-05", "2026-10-11"), false, "6일 뒤는 아직");
  assert.equal(rosterCheckDue("2026-10-05", "2026-10-12"), true, "7일 뒤 확인");
  assert.equal(rosterCheckDue("2026-12-28", "2027-01-04"), true, "해 넘김");
  const a = { playerNo: 1, teamCode: "16", backNum: "3", rowNo: 1 };
  const b = { playerNo: 2, teamCode: "55", backNum: "7", rowNo: 2 };
  assert.equal(rosterChange([a, b], [{ ...b, rowNo: 1 }, { ...a, rowNo: 2 }], "2026-10-12"), null, "순서·rowNo 만 바뀌면 같은 명단");
  const moved = rosterChange([a, b], [{ ...a, teamCode: "60" }, { playerNo: 3, teamCode: "10" }], "2026-10-12");
  assert.deepEqual(moved, { date: "2026-10-12", count: 2, added: ["3"], removed: ["2"], updated: 1 }, "들어옴·빠짐·이적");
  const first = applyRosterCheck(EMPTY_ROSTER_LOG, null, [a], "2026-10-05");
  assert.equal(first.changed?.added.length, 1, "처음 받은 명단은 바뀜으로 저장");
  const same = applyRosterCheck(first.log, [a], [a], "2026-10-12");
  assert.equal(same.changed, null);
  assert.equal(same.log.checkedAt, "2026-10-12", "안 바뀌어도 확인 날짜는 갱신");
  assert.equal(same.log.changes.length, 1);
}
console.log("현역 상태·명단 확인 규칙 통과");
