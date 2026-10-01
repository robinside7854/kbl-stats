// 팀 색·홈 규칙 검증 (팀 색 배정, 등급 색, 홈 시즌 고르기, 오늘 생일). 실행: npm run test:teams
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  assignTeamColors,
  comparePairColors,
  contrastRatio,
  DEFAULT_TEAM_PRIMARY,
  desaturate,
  ensureMarkContrast,
  gradeTone,
  readableInk,
  oklabDistance,
} from "../lib/teams";
import { pickHomeSeason } from "../lib/home";
import { DEFAULT_QUALIFY, QUALIFY_PRESETS } from "../lib/metrics";

const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a"];

// ── 팀 색 배정 ──
// 회색 기본값은 team-colors.json 의 default 와 같아야 한다
const colorsFile = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "codes", "team-colors.json"), "utf8"));
assert.equal(colorsFile.default.primary.toLowerCase(), DEFAULT_TEAM_PRIMARY.toLowerCase());

const t = (teamCode: string, primary: string) => ({ teamCode, color: { primary } });
const assigned = assignTeamColors(
  [t("10", "#003E7E"), t("15", "#6B7280"), t("20", "#6b7280"), t("35", "#0053A6"), t("40", "#6B7280"), t("45", "#6B7280")],
  PALETTE,
);
assert.equal(assigned.get("10"), "#003E7E"); // 팀 색 있으면 그대로
assert.equal(assigned.get("15"), PALETTE[0]); // 회색 팀은 팀 순서대로 팔레트
assert.equal(assigned.get("20"), PALETTE[1]); // 대소문자 무관
assert.equal(assigned.get("35"), "#0053A6");
assert.equal(assigned.get("40"), PALETTE[2]);
assert.equal(assigned.get("45"), "#6B7280"); // 팔레트가 모자라면 회색 그대로 (순환 금지)
assert.equal(assignTeamColors([], PALETTE).size, 0);

// 대비 보정: 다크 바탕 위 검정 → 밝게, 이미 충분하면 그대로
const dark = "#1a1a19";
assert.ok(contrastRatio("#111111", dark) < 1.8);
const fixed = ensureMarkContrast("#111111", dark);
assert.ok(contrastRatio(fixed, dark) >= 1.8, fixed);
assert.equal(ensureMarkContrast("#E4002B", "#fcfcfb"), "#E4002B");
assert.ok(contrastRatio(ensureMarkContrast("#fafafa", "#fcfcfb"), "#fcfcfb") >= 1.8); // 밝은 바탕 위 흰색 → 어둡게
assert.ok(Math.abs(contrastRatio("#000000", "#ffffff") - 21) < 1e-9);

// 두 팀 비교 색: 비슷하면(SK 빨강 vs 정관장 빨강) 팔레트 1·2번, 다르면 팀 색 그대로
assert.ok(oklabDistance("#E4002B", "#C8102E") < 15);
assert.deepEqual(comparePairColors("#E4002B", "#C8102E", PALETTE), [PALETTE[0], PALETTE[1]]);
assert.deepEqual(comparePairColors("#E4002B", "#00703C", PALETTE), ["#E4002B", "#00703C"]);
assert.equal(oklabDistance("#123456", "#123456"), 0);

// ── 홈 시즌 고르기 ──
const S = (c: number) => ({ seasonCode: c, seasonLabel: `L${c}` });
// 개막 전: 코드표 최신(49)이 선수 0명 → 직전 시즌(47) + 안내
assert.deepEqual(pickHomeSeason([S(45), S(49), S(47)], [S(45), S(47)]), { shown: S(47), upcoming: S(49) });
// 개막 후: 안내 없음
assert.deepEqual(pickHomeSeason([S(45), S(47)], [S(47), S(45)]), { shown: S(47), upcoming: null });
assert.deepEqual(pickHomeSeason([], []), { shown: null, upcoming: null });

// 등급 색 (디자인 점검 B5): 채도 20% 낮춤은 밝기를 거의 유지하고 색 거리를 줄인다, 회색은 그대로
assert.equal(desaturate("#808080", 0.2), "#808080");
assert.ok(oklabDistance(desaturate("#CE0E2D", 0.2), "#CE0E2D") > 3);
assert.ok(Math.abs(contrastRatio(desaturate("#CE0E2D", 0.2), "#ffffff") - contrastRatio("#CE0E2D", "#ffffff")) < 0.6);
assert.equal(desaturate("잘못된 값"), "잘못된 값");
// 글자 색: 대비가 모자라면 흰색/검정 중 대비 큰 쪽
assert.equal(readableInk("#111111", "#ffffff"), "#ffffff");
assert.equal(readableInk("#f5f5f5", "#ffffff"), "#0b0b0b");
// 등급 배지: 모든 팀 색·라이트/다크에서 글자 대비 4.5:1 이상
const teamColorFile = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/codes/team-colors.json"), "utf8")) as Record<string, { primary?: string; text?: string }>;
const gradeThemes = [
  { surface: "#fcfcfb", ink: "#0b0b0b", ink3: "#6b6a66", grid: "#dcdbd6", gradeS: "#e1b95a", gradeSInk: "#3a2900", gradeC: "#e4e2dc", gradeCInk: "#2f2e2b", gradeD: "#d2d1cb", gradeDInk: "#4a4946", gradeF: "#ecebe7", gradeFInk: "#6b6a66" },
  { surface: "#1a1a19", ink: "#ffffff", ink3: "#9a998f", grid: "#3a3a37", gradeS: "#ebcb6f", gradeSInk: "#2e2100", gradeC: "#3b3b37", gradeCInk: "#f0efe8", gradeD: "#2f2f2c", gradeDInk: "#b9b8ae", gradeF: "#252523", gradeFInk: "#92918a" },
];
for (const theme of gradeThemes)
  for (const tc of Object.values(teamColorFile))
    if (tc && tc.primary && tc.text)
      for (const g of ["S", "A", "B", "C", "D", "F"] as const) {
        const tone = gradeTone(g, { primary: tc.primary, text: tc.text }, theme);
        assert.ok(contrastRatio(tone.ink, tone.bg) >= 4.5, `${g} ${tc.primary} ${tone.ink}/${tone.bg}`);
      }

console.log("teams.test.ts: 모든 테스트 통과");

// ── 오늘 생일 (lib/home birthdaysOn·kstDateString) ──
{
  const { birthdaysOn, kstDateString } = await import("../lib/home");
  // 한국 시간: UTC 2026-09-30 15:30 = KST 10-01 00:30
  assert.equal(kstDateString(new Date("2026-09-30T15:30:00Z")), "2026-10-01");
  assert.equal(kstDateString(new Date("2026-09-30T14:59:00Z")), "2026-09-30");
  const ps = [
    { id: "1", nameKo: "나", birthday: "1994-10-01" },
    { id: "2", nameKo: "가", birthday: "1990-10-01" },
    { id: "3", nameKo: "다", birthday: "1994-10-02" },
    { id: "4", nameKo: "라", birthday: null },
    { id: "5", nameKo: "마", birthday: "1996-02-29" },
    { id: "1", nameKo: "나", birthday: "1994-10-01" }, // 같은 선수 두 번(이적) → 한 번
  ];
  assert.deepEqual(birthdaysOn(ps, "2026-10-01").map((b) => [b.player.id, b.age]), [["2", 36], ["1", 32]]);
  assert.deepEqual(birthdaysOn(ps, "2026-02-28").map((b) => b.player.id), ["5"]); // 윤년 아님 → 2월 28일
  assert.deepEqual(birthdaysOn(ps, "2028-02-28").map((b) => b.player.id), []);
  assert.deepEqual(birthdaysOn(ps, "2028-02-29").map((b) => [b.player.id, b.age]), [["5", 32]]);
  assert.deepEqual(birthdaysOn(ps, "엉터리"), []);
}
