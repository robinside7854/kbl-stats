// 팀 이름·색·의존도 규칙 — 순수 함수만 둔다. scripts/process.ts 가 시즌 파일을 만들 때 쓰고, 테스트(tests/leaders.test.ts)가 검증한다.
import { isQualified, type Grade, type QualifyRule } from "./metrics";

/**
 * KBL 역대 연고지 지명 (1997~ 정규시즌 teamName1 에 나온 것 + 앞으로 쓰일 법한 광역시·도).
 * 팀 코드·시즌 코드가 아니라 "지명"이라 하드코딩 금지 규칙의 예외로 둔다 —
 * 코드표 API 에는 연고지만 따로 담은 필드가 없어서, 붙어 쓴 이름(예: "부산기아")에서 지명을 떼려면 목록이 필요하다.
 * 새 연고지가 생기면 여기에 추가한다 (추가하지 않아도 공백이 있는 이름 "화성 OO"은 공백 규칙으로 처리된다).
 */
export const HOME_CITIES: readonly string[] = [
  "서울", "부산", "인천", "대구", "대전", "광주", "울산", "수원", "창원", "원주",
  "안양", "고양", "전주", "청주", "여수", "경남", "경기", "성남", "화성", "제주",
];

/**
 * 팀 한글 약칭: teamName1(예: "울산 현대모비스", "부산기아")에서 연고지 지명을 떼어낸 나머지.
 *  1) 공백이 있으면 첫 공백 뒤 전부 ("울산 현대모비스" → "현대모비스", "여수 코리아텐더" → "코리아텐더")
 *  2) 공백이 없으면 HOME_CITIES 중 가장 긴 접두어를 뗀다 ("부산기아" → "기아", "원주TG삼보" → "TG삼보")
 *  3) 결과가 비면(지명만 있는 이름 등) teamName1 전체
 * 영문 대문자 약칭(teamName4, 예: "HYUNDAI MOBIS")은 팬이 읽기 어려워 화면에서는 이 값을 쓴다.
 */
export function teamShortNameKo(teamName1: string): string {
  const name = teamName1.trim();
  if (!name) return "";
  let rest: string;
  const sp = name.search(/\s/);
  if (sp >= 0) {
    rest = name.slice(sp).trim();
  } else {
    const city = [...HOME_CITIES].sort((a, b) => b.length - a.length).find((c) => name.startsWith(c));
    rest = city ? name.slice(city.length).trim() : name;
  }
  return rest || name;
}

// ─────────────────────────────────────────────
// 팀 색 배정 (팀별 선수 분포 산점도·범례·팀 요약 카드가 같은 함수를 쓴다)
// ─────────────────────────────────────────────

/**
 * 팀 색 회색 기본값 — data/codes/team-colors.json 의 "default".primary 와 같은 값.
 * 이 색인 팀(주로 옛 구단)은 산점도에서 서로 구분되지 않으므로 범주형 팔레트 색으로 바꾼다.
 * (team-colors.json 기본값을 바꾸면 여기도 같이 바꾼다 — tests/teams.test.ts 가 두 값이 같은지 확인한다)
 */
export const DEFAULT_TEAM_PRIMARY = "#6B7280";

/** 팀을 모를 때 화면이 쓰는 팀 색 (data/codes/team-colors.json "default" 와 같은 값 — 옛 구단 회색과 맞춘다) */
export const FALLBACK_TEAM_COLOR = { primary: DEFAULT_TEAM_PRIMARY, secondary: "#9CA3AF", text: "#fff" } as const;

export const isDefaultTeamColor = (hex: string) => hex.trim().toLowerCase() === DEFAULT_TEAM_PRIMARY.toLowerCase();

/**
 * 팀 코드 → 점·범례 색.
 *  - 팀 색(color.primary)이 회색 기본값이 아니면 그 색 그대로.
 *  - 회색 기본값인 팀은 teams 배열 순서(= KBL 공홈 표시 순서)대로 palette 의 범주형 색을 하나씩 배정한다.
 *    palette 는 dataviz 범주형 팔레트(globals.css --cat-1…8, 라이트/다크 각각)를 고정 순서로 넘긴다.
 *  - 팔레트 색이 모자라면(회색 팀이 palette.length 보다 많으면) 남은 팀은 회색 그대로 — 색을 돌려 쓰지 않는다
 *    (dataviz 규칙: 범주형 색은 고정 순서, 순환 금지).
 * 색은 팀(엔티티)에 붙는다 — 필터로 보이는 팀이 바뀌어도 같은 팀은 같은 색(배정은 시즌 팀 전체 기준).
 */
export function assignTeamColors(
  teams: readonly { teamCode: string; color: { primary: string } }[],
  palette: readonly string[],
): Map<string, string> {
  const out = new Map<string, string>();
  let slot = 0;
  for (const t of teams) {
    if (!isDefaultTeamColor(t.color.primary)) out.set(t.teamCode, t.color.primary);
    else out.set(t.teamCode, slot < palette.length ? palette[slot++] : t.color.primary);
  }
  return out;
}

// ── 색 계산 도우미 (sRGB hex → 상대 휘도·OKLab) ──

function hexRgb(hex: string): [number, number, number] | null {
  let s = hex.trim().replace(/^#/, "");
  if (s.length === 3) s = [...s].map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255) as [number, number, number];
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** WCAG 상대 휘도 (0~1). 잘못된 hex 면 0 */
export function relativeLuminance(hex: string): number {
  const rgb = hexRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 대비율 (1~21). 출처: WCAG 2.1 "contrast ratio" 정의 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  return "#" + a.map((v, i) => Math.round((v + (b[i] - v) * t) * 255).toString(16).padStart(2, "0")).join("");
}

/**
 * 점 색이 차트 바탕에서 안 보일 때(예: KT 검정 #111111 을 다크 바탕 #1a1a19 위에) 바탕 반대쪽으로 조금씩 섞어
 * 대비율 minRatio(기본 1.8) 이상이 되게 한다. 이미 충분하면 그대로. 결과 hex 는 소문자.
 * 팀 색 자체를 바꾸는 게 아니라 "이 바탕 위의 점"만 보정한다 (범례 스와치도 같은 값을 써 둘이 어긋나지 않게).
 */
export function ensureMarkContrast(hex: string, surface: string, minRatio = 1.8): string {
  const c = hexRgb(hex);
  if (!c || contrastRatio(hex, surface) >= minRatio) return hex;
  const target: [number, number, number] = relativeLuminance(surface) < 0.5 ? [1, 1, 1] : [0, 0, 0];
  for (let t = 0.1; t <= 1.0001; t += 0.1) {
    const m = mix(c, target, t);
    if (contrastRatio(m, surface) >= minRatio) return m;
  }
  return mix(c, target, 1);
}

/**
 * 두 색의 OKLab 거리 ×100 (dataviz 검증기와 같은 척도, 15 미만이면 정상 시각으로도 구분이 어렵다).
 * 출처: Björn Ottosson, "A perceptual color space for image processing" (2020) OKLab 변환식.
 */
export function oklabDistance(a: string, b: string): number {
  const lab = (hex: string) => {
    const rgb = hexRgb(hex) ?? [0, 0, 0];
    const [r, g, bl] = rgb.map(toLinear);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675703 * s,
    ];
  };
  const p = lab(a);
  const q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * 100;
}

// ── OKLab ↔ sRGB (채도 낮추기용). 출처: Björn Ottosson OKLab 변환식 (oklabDistance 와 같은 행렬) ──

function toOklab(hex: string): [number, number, number] | null {
  const rgb = hexRgb(hex);
  if (!rgb) return null;
  const [r, g, bl] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675703 * s,
  ];
}

function fromOklab([L, a, b]: [number, number, number]): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const enc = (c: number) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return "#" + lin.map(enc).join("");
}

/**
 * 채도(OKLCH 의 C)를 amount 만큼 낮춘다 (0.2 = 20% 낮춤). 밝기(L)·색상(h)은 그대로. 잘못된 hex 면 그대로.
 * 등급 배지·순위 강조의 팀 색·금색이 팔레트처럼 튀지 않게 쓴다 (디자인 점검 B5).
 */
export function desaturate(hex: string, amount = 0.2): string {
  const lab = toOklab(hex);
  if (!lab) return hex;
  const k = 1 - Math.min(1, Math.max(0, amount));
  return fromOklab([lab[0], lab[1] * k, lab[2] * k]);
}

/** 본문 글자 대비 기준 (WCAG AA 일반 글자) */
export const TEXT_CONTRAST = 4.5;

/**
 * bg 위 글자 색: preferred 가 4.5:1 이상이면 그대로, 아니면 light·dark 중 대비가 큰 쪽.
 * 팀 색 배지(등급 A·1~10위 칸) 글자에 쓴다 — 팀 색 text 값이 채도를 낮춘 바탕에서 모자랄 때 대비.
 */
export function readableInk(bg: string, preferred: string, light = "#ffffff", dark = "#0b0b0b"): string {
  if (hexRgb(preferred) && contrastRatio(preferred, bg) >= TEXT_CONTRAST) return preferred;
  return contrastRatio(light, bg) >= contrastRatio(dark, bg) ? light : dark;
}

/** 등급 배지 색 입력: 화면 테마 색(hex) */
export interface GradeThemeColors {
  surface: string;
  ink: string;
  ink3: string;
  grid: string;
  gradeS: string;
  gradeSInk: string;
  gradeC: string;
  gradeCInk: string;
  gradeD: string;
  gradeDInk: string;
  gradeF: string;
  gradeFInk: string;
}

export interface GradeTone {
  bg: string;
  ink: string;
  border: string;
}

/**
 * 등급 S~F 배지 색 (플레이어 카드 레이더 꼭짓점·종합 등급·선수 탭 그리드 공용, 디자인 점검 B5).
 *  - S = 금색(테마 --grade-s, 이미 채도 20% 낮춘 값), A = 팀 색(채도 20% 낮춤), B = 그 팀 색을 표면에 옅게 섞은 면 + 팀 색 테두리,
 *    C·D·F = 무채색(--grade-c/d/f). 글자는 항상 등급 글자라 색만으로 뜻을 전하지 않는다.
 *  - 글자 색은 바탕과 4.5:1 이상 (readableInk).
 */
export function gradeTone(grade: Grade | "-", team: { primary: string; text: string }, c: GradeThemeColors): GradeTone {
  const teamBg = desaturate(team.primary, 0.2);
  switch (grade) {
    case "S":
      // 테두리는 금색을 30% 어둡게 — 밝은 바탕에서 금색 면(대비 약 1.8:1)의 경계가 보이게 (3:1 이상)
      return { bg: c.gradeS, ink: readableInk(c.gradeS, c.gradeSInk), border: mixHexLinear(c.gradeS, "#000000", 0.3) };
    case "A":
      return { bg: teamBg, ink: readableInk(teamBg, team.text), border: teamBg };
    case "B": {
      const bg = mixHexLinear(teamBg, c.surface, 0.72);
      return { bg, ink: readableInk(bg, c.ink), border: teamBg };
    }
    case "C":
      return { bg: c.gradeC, ink: readableInk(c.gradeC, c.gradeCInk), border: c.gradeC };
    case "D":
      return { bg: c.gradeD, ink: readableInk(c.gradeD, c.gradeDInk), border: c.gradeD };
    case "F":
      return { bg: c.gradeF, ink: readableInk(c.gradeF, c.gradeFInk), border: c.gradeF };
    default:
      return { bg: c.surface, ink: c.ink3, border: c.grid };
  }
}

/** sRGB 선형 보간 (lib/images mixHex 와 같은 규칙, 순환 import 를 피하려고 여기 둔다) */
function mixHexLinear(a: string, b: string, t: number): string {
  const ca = hexRgb(a);
  const cb = hexRgb(b);
  if (!ca || !cb) return a;
  return mix(ca, cb, Math.min(1, Math.max(0, t)));
}

/** 두 팀 비교 때 색이 이 거리(OKLab ×100)보다 가까우면 팀 색 대신 팔레트 1·2번(파랑·주황)으로 바꾼다 */
export const MIN_PAIR_DISTANCE = 15;

/**
 * 두 팀 비교 색. 두 팀 색이 너무 비슷하면(예: SK 빨강 vs 정관장 빨강) 둘 다 팔레트 1·2번 색으로 바꾼다.
 * 색 대비만으로는 색각 이상 사용자가 구분하기 어려울 수 있어, 화면은 두 번째 팀 점을 네모로 그려 모양으로도 구분한다.
 */
export function comparePairColors(a: string, b: string, palette: readonly string[]): [string, string] {
  if (oklabDistance(a, b) >= MIN_PAIR_DISTANCE || palette.length < 2) return [a, b];
  return [palette[0], palette[1]];
}

// ─────────────────────────────────────────────
// 팀 "핵심 의존도" — 상위 3명 득점 비중 (팀 분포 화면 팀 요약 줄)
// ─────────────────────────────────────────────

export interface DependencyInput {
  id: string;
  nameKo: string;
  teamCode: string;
  games: number;
  minutes: number;
  points: number;   // 시즌 누적 득점
}

export interface TeamDependency {
  teamCode: string;
  /** 팀 선수 전원(표본 기준과 무관)의 시즌 누적 득점 합 */
  teamPoints: number;
  /** 득점 상위 3명 (누적 득점 많은 순, 3명 미만이면 있는 만큼) */
  top: { id: string; nameKo: string; points: number }[];
  /** 상위 3명 누적 득점 합 ÷ 팀 합계 × 100. 팀 합계가 0이면 null */
  topShare: number | null;
  /** 표본 기준(rule) 충족 선수 수 */
  qualifiedCount: number;
  /** 시즌 기록이 있는 선수 수 */
  rosterCount: number;
}

/**
 * 팀 핵심 의존도:
 *   topShare = (그 팀 선수 중 시즌 누적 득점 상위 3명의 득점 합) ÷ (그 팀 선수 전원의 시즌 누적 득점 합) × 100
 * - 분모·분자 모두 선수 기록(시즌 누적 득점)을 우리가 합친 값이다. KBL 공식 팀 득점이 아니다.
 *   시즌 중 이적한 선수는 KBL 시즌 기록에 한 팀으로만 나오므로(그 팀에 시즌 전체 득점이 잡힌다) 실제와 조금 다를 수 있다.
 * - 상위 3명은 표본 기준과 무관하게 누적 득점으로 고른다 (득점 비중은 "얼마나 많이 넣었나"라서 경기 수 필터가 필요 없다).
 *   동점이면 경기 수 많은 순 → 선수 번호순.
 * - 높을수록 소수 선수에게 득점을 기대는 팀, 낮을수록 고르게 나눠 넣는 팀.
 * - qualifiedCount 는 rule(QUALIFY_PRESETS 중 선택값) 충족 선수 수 — "쓸 만한 선수층" 참고치.
 */
export function teamDependency(
  players: readonly DependencyInput[],
  teamCode: string,
  rule: QualifyRule,
): TeamDependency {
  const roster = players.filter((p) => p.teamCode === teamCode);
  const pts = (p: DependencyInput) => (Number.isFinite(p.points) ? p.points : 0);
  const teamPoints = roster.reduce((s, p) => s + pts(p), 0);
  const top = [...roster]
    .sort((a, b) => pts(b) - pts(a) || b.games - a.games || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map((p) => ({ id: p.id, nameKo: p.nameKo, points: pts(p) }));
  const topPoints = top.reduce((s, p) => s + p.points, 0);
  return {
    teamCode,
    teamPoints,
    top,
    topShare: teamPoints > 0 ? (topPoints / teamPoints) * 100 : null,
    qualifiedCount: roster.filter((p) => isQualified(p, rule)).length,
    rosterCount: roster.length,
  };
}
