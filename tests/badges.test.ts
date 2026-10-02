// 칭호 배지 규칙 검증 (lib/badges). 실행: npm run test:badges
import assert from "node:assert/strict";
import {
  BADGE_DEFS,
  buildBadgeIndex,
  buildBadgeSeasonInfo,
  CLUB_40,
  CLUB_50,
  DD_MACHINE_MIN,
  HERO_BADGE_LIMIT,
  IRON_MAN_MIN_SEASONS,
  LEGEND_MIN_SEASONS,
  ONE_CLUB_MIN_SEASONS,
  playerBadges,
  seasonStartYear,
  splitBadges,
  VETERAN_MIN_SEASONS,
  type BadgeCareer,
  type BadgeIndex,
  type BadgeSeasonRow,
} from "../lib/badges";
import type { LeaderPlayer } from "../lib/types";

// ── 시즌 재료: 최다 경기·부문 1위(기본 표본 기준, 경기당, 공동 1위 포함) ──
function lp(id: string, o: Partial<LeaderPlayer> = {}): LeaderPlayer {
  return {
    id, nameKo: id, nameEn: id, teamCode: "55", teamShort: "SK", isForeign: false, position: null, positionGroup: null, nationality: null,
    photoUrl: null, games: 50, wins: 25, losses: 25, minutes: 1000, points: 500, reb: 200, ast: 100, stl: 40, blk: 10, tov: 50, fouls: 100,
    fgm: 200, fga: 400, tpm: 30, tpa: 90, ftm: 70, fta: 100, fgPct: 50, tpPct: 33, ftPct: 70, tsPct: 55, usgPct: null, per: 15, ...o,
  };
}
const info = buildBadgeSeasonInfo([
  lp("a", { points: 1000 }),                       // 20.0 득점 1위
  lp("b", { points: 800, games: 45, reb: 540 }),   // 12.0 리바 1위 (경기당)
  lp("c", { points: 2000, games: 5, minutes: 90 }), // 경기당 400 이지만 표본 미달 → 1위 아님
  lp("d", { ast: 300, stl: 60 }),
  lp("e", { ast: 300, games: 54 }),                // 어시 경기당 5.56 < d 6.0
  lp("f", { stl: 60 }),                            // 스틸 공동 1위 (d·f 1.2)
]);
assert.deepEqual(info.kings.points, ["a"]);
assert.deepEqual(info.kings.reb, ["b"]);
assert.deepEqual(info.kings.ast, ["d"]);
assert.deepEqual(info.kings.stl, ["d", "f"]);
assert.equal(info.maxGames, 54);
assert.equal(seasonStartYear("2025-2026"), 2025);
assert.equal(seasonStartYear("1997"), 1997);
assert.equal(seasonStartYear("?"), null);

// ── 선수 배지 ──
const EMPTY_KINGS = { points: [], reb: [], ast: [], stl: [], blk: [] };
function idx(extra: Partial<BadgeIndex["seasons"]> = {}): BadgeIndex {
  const seasons: BadgeIndex["seasons"] = {};
  for (let c = 1; c <= 47; c++) seasons[c] = { maxGames: 54, kings: { ...EMPTY_KINGS } };
  return { seasons: { ...seasons, ...extra } as BadgeIndex["seasons"], latestSeasonCode: 47, latestStartYear: 2025 };
}
const row = (seasonCode: number, o: Partial<BadgeSeasonRow> = {}): BadgeSeasonRow => ({ seasonCode, teamCode: "55", games: 40, doubleDoubles: 0, tripleDoubles: 0, ...o });
const career = (seasons: BadgeSeasonRow[], o: Partial<BadgeCareer> = {}): BadgeCareer => ({ playerNo: "p", seasons, draftYear: null, careerHighPoints: null, ...o });
const keys = (c: BadgeCareer, i = idx()) => playerBadges(c, i).map((b) => b.key);
const range = (n: number, f: (i: number) => BadgeSeasonRow) => Array.from({ length: n }, (_, i) => f(i));

// 원클럽맨: 5시즌 이상 + 팀 코드 하나. 4시즌이면 아님, 팀 둘이면 아님
assert.ok(keys(career(range(ONE_CLUB_MIN_SEASONS, (i) => row(i + 1)))).includes("oneClub"));
assert.ok(!keys(career(range(ONE_CLUB_MIN_SEASONS - 1, (i) => row(i + 1)))).includes("oneClub"));
assert.ok(!keys(career(range(5, (i) => row(i + 1, { teamCode: i === 4 ? "60" : "55" })))).includes("oneClub"));
// 출전 0경기 시즌은 "뛴 시즌"으로 세지 않는다
assert.ok(!keys(career(range(5, (i) => row(i + 1, { games: i === 0 ? 0 : 40 })))).includes("oneClub"));

// 베테랑 10~14 / 레전드 15+ (하나만)
assert.deepEqual(keys(career(range(VETERAN_MIN_SEASONS, (i) => row(i + 1, { teamCode: String(i % 2) })))), ["veteran"]);
assert.deepEqual(keys(career(range(VETERAN_MIN_SEASONS - 1, (i) => row(i + 1, { teamCode: String(i % 2) })))), []);
const leg = keys(career(range(LEGEND_MIN_SEASONS, (i) => row(i + 1, { teamCode: String(i % 2) }))));
assert.ok(leg.includes("legend") && !leg.includes("veteran"));
assert.equal(BADGE_DEFS.find((d) => d.key === "legend")!.label, "롱런"); // 2026-10-01: "레전드"는 실력까지 뜻해 이름만 바꿈(키·앵커 유지)

// 저니맨: 팀 코드 4개 이상

// 부문 1위 횟수 → "득점왕 ×2" (1회는 숫자 없이)
const kingIdx = idx({
  10: { maxGames: 54, kings: { ...EMPTY_KINGS, points: ["p"], blk: ["p", "q"] } },
  11: { maxGames: 54, kings: { ...EMPTY_KINGS, points: ["p"] } },
});
const kb = playerBadges(career([row(10), row(11), row(12)]), kingIdx);
assert.deepEqual(kb.map((b) => b.label), ["득점왕 ×2", "블록왕"]);
assert.equal(kb[0].count, 2);

// 철인: 그 시즌 최다 경기를 뛴 시즌 3개 이상
assert.ok(keys(career(range(IRON_MAN_MIN_SEASONS, (i) => row(i + 1, { games: 54, teamCode: String(i) })))).includes("ironMan"));
assert.ok(!keys(career(range(IRON_MAN_MIN_SEASONS, (i) => row(i + 1, { games: i === 0 ? 53 : 54, teamCode: String(i) })))).includes("ironMan"));
// 시즌마다 최다 경기가 다르다 (옛 시즌 45경기)
const shortIdx = idx({ 1: { maxGames: 21, kings: EMPTY_KINGS }, 2: { maxGames: 45, kings: EMPTY_KINGS } });
assert.ok(keys(career([row(1, { games: 21 }), row(2, { games: 45, teamCode: "1" }), row(3, { games: 54, teamCode: "2" })]), shortIdx).includes("ironMan"));

// 40·50득점 클럽: 높은 쪽 하나만
assert.deepEqual(keys(career([row(47)], { careerHighPoints: CLUB_40 })), ["club40"]);
assert.deepEqual(keys(career([row(47)], { careerHighPoints: CLUB_50 })), ["club50"]);
assert.deepEqual(keys(career([row(47)], { careerHighPoints: CLUB_40 - 1 })), []);

// 트리플더블 통산 ×n, 더블더블 머신 한 시즌 20+
assert.deepEqual(playerBadges(career([row(1, { tripleDoubles: 1 }), row(2, { tripleDoubles: 2 })]), idx()).map((b) => b.label), ["트리플더블 ×3"]);
assert.deepEqual(playerBadges(career([row(1, { tripleDoubles: 1 })]), idx()).map((b) => b.label), ["트리플더블"]);
assert.deepEqual(keys(career([row(1, { doubleDoubles: DD_MACHINE_MIN })])), ["ddMachine"]);
assert.deepEqual(keys(career([row(1, { doubleDoubles: 12 }), row(2, { doubleDoubles: 12 })])), []); // 합계가 아니라 한 시즌

// 신인: 최신 시즌 하나뿐 + 드래프트 연도 = 그 시즌 시작 연도
assert.deepEqual(keys(career([row(47)], { draftYear: 2025 })), ["rookie"]);
assert.deepEqual(keys(career([row(47)], { draftYear: 2024 })), []);  // 지난해 드래프트 → 신인 아님
assert.deepEqual(keys(career([row(45)], { draftYear: 2025 })), []);  // 최신 시즌이 아님
assert.deepEqual(keys(career([row(45), row(47)], { draftYear: 2025 })), []);
assert.deepEqual(keys(career([row(47)], { draftYear: null })), []);  // 외국 선수 등 드래프트 없음

// 우선순위 = BADGE_DEFS 순서, 히어로는 5개 + "+n"
const many = playerBadges(
  career(range(16, (i) => row(i + 1, { games: 54, teamCode: String(i % 4), doubleDoubles: 25, tripleDoubles: 1 })), { careerHighPoints: 52 }),
  idx({ 3: { maxGames: 54, kings: { points: ["p"], reb: ["p"], ast: ["p"], stl: ["p"], blk: ["p"] } } }),
);
const order = BADGE_DEFS.map((d) => d.key);
assert.deepEqual(many.map((b) => b.key), [...many.map((b) => b.key)].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
assert.equal(many[0].key, "scoringKing");
const { shown, hidden } = splitBadges(many);
assert.equal(shown.length, HERO_BADGE_LIMIT);
assert.equal(hidden, many.length - HERO_BADGE_LIMIT);
assert.deepEqual(splitBadges([1, 2]), { shown: [1, 2], hidden: 0 });

// 조건 문장은 상수와 같은 숫자를 쓴다 (용어 탭 표)
const cond = (k: string) => BADGE_DEFS.find((d) => d.key === k)!.condition;
assert.ok(cond("oneClub").includes(String(ONE_CLUB_MIN_SEASONS)));
assert.ok(cond("legend").includes(String(LEGEND_MIN_SEASONS)));
assert.ok(cond("ddMachine").includes(String(DD_MACHINE_MIN)));
assert.equal(new Set(BADGE_DEFS.map((d) => d.key)).size, BADGE_DEFS.length);

// buildBadgeIndex: 최신 시즌·시작 연도, 선수 0명 시즌은 뺀다
const bi = buildBadgeIndex([
  { seasonCode: 45, seasonLabel: "2024-2025", players: [lp("a")] },
  { seasonCode: 47, seasonLabel: "2025-2026", players: [lp("a")] },
  { seasonCode: 49, seasonLabel: "2026-2027", players: [] },
]);
assert.equal(bi.latestSeasonCode, 47);
assert.equal(bi.latestStartYear, 2025);
assert.equal(bi.seasons[49], undefined);

console.log("badges: 배지 규칙 통과");

// 저니맨 칭호는 2026-10-02 사용자 요청으로 삭제 — 여러 팀을 거쳐도 칭호 없음
assert.deepEqual(keys(career(range(6, (i) => row(i + 1, { teamCode: String(i) })))), []);
