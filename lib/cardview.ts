// 시즌 카드 데이터(lib/cards.ts SeasonCards) → 화면용 카드·선수 그리드·비교표 — 순수 함수만 둔다 (CLAUDE.md 원칙 5).
// 선수 탭(/players)·선수 상세(/player/[번호])·비교 탭(/compare)이 같은 함수를 쓴다.
// 서버(빌드 시점, lib/data.ts)와 브라우저(public/cards/{코드}.json 을 받아서)가 같은 입력 → 같은 결과가 되도록
// 서버도 public/cards 와 똑같이 encode → decode 한 데이터를 넘긴다(소수 넷째 자리 반올림까지 같게).
// 순위·백분위·등급 계산은 lib/metrics.ts, 비교 집단 필터는 lib/roster.ts 를 부르기만 한다.

import type { SeasonCards } from "./cards";
import { HERO_HIGH_KEYS } from "./highs";
import {
  attemptsNote,
  buildCardContext,
  buildCardEntry,
  buildGradingContext,
  CARD_STATS,
  missingComponentLabels,
  gradeScore,
  overallWeightNote,
  RADAR_AXES,
  RADAR_AXIS_LABELS,
  RADAR_COMPONENTS,
  perGame,
  qualifyLabel,
  type CardContext,
  type CardEntryOf,
  type CardStatEntry,
  type CardStatKey,
  type CardStatRank,
  type Grade,
  type GradingContext,
  type RadarAxis,
  type RadarComponentKey,
  type RadarScore,
} from "./metrics";
import {
  filterByNationality,
  filterByPosition,
  nationalityFilterLabel,
  nationalityFromParam,
  nationalityParam,
  positionFilterLabel,
  positionFromParam,
  positionParam,
  POSITION_GROUP_LABELS,
  type NationalityFilter,
  type PositionFilter,
} from "./roster";
import type { CardPlayer, CardTeam, SeasonCoverage } from "./types";

// ─────────────────────────────────────────────
// 카드 한 장 (시즌 + 순위 범위)
// ─────────────────────────────────────────────

/**
 * 순위 비교 집단: 리그 전체 / 같은 포지션(가드·포워드·센터 묶음, lib/roster positionGroupOf).
 * 포지션을 모르는 선수(선수 마스터에 없음)는 "position" 을 골라도 전체로 계산하고 view.scope 는 "all" 이 된다.
 * 등급(레이더 6축·종합)은 범위와 관계없이 항상 같은 국적 집단(국내/외국/아시아쿼터) 안에서 매긴다 (lib/metrics buildGradingContext).
 */
export type CardScope = "all" | "position";

export interface SeasonCardView {
  entry: CardEntryOf<CardPlayer>;
  team: CardTeam | null;
  seasonCode: number;
  seasonLabel: string;
  /** 시즌 항목별 커버리지 (USG% 등) */
  coverage: SeasonCoverage;
  /** 표본 기준 표기, 예: "10경기·100분 이상" */
  ruleLabel: string;
  /** 순위 집단 중 표본 기준 충족 선수 수 */
  qualifiedCount: number;
  /** 등급 기준 표기, 예: "국내 선수 109명 중" / "외국인 선수(아시아쿼터 포함) 31명 중" */
  gradeLabel: string;
  /** 이 시즌 기록이 없어 레이더에서 빠진 구성 요소, 예: ["USG%", "경기당 디플렉션"] */
  missingComponents: string[];
  /** 포지션별 종합 가중치 안내 (lib/metrics overallWeightNote), 예: "센터라 3점 축은 종합에 넣지 않음". 가드 등은 null */
  overallNote: string | null;
  /** 성공률 시도 기준 표기 (리그 전체 기준 — 집단을 좁혀도 같다) */
  attemptsLabel: string;
  /** 실제로 적용된 범위 (포지션을 모르면 "position" 요청도 "all") */
  scope: CardScope;
  /** 비교 집단 이름: 전체면 null, 같은 포지션이면 "가드" 등 — 카드에 "가드 중 3위"로 쓴다 */
  groupLabel: string | null;
}

// 같은 시즌·같은 집단의 비교 재료는 한 번만 만든다 (선수 페이지 1,329개 빌드·그리드 200명)
const ctxCache = new WeakMap<SeasonCards, Map<string, CardContext>>();
const gradingCache = new WeakMap<SeasonCards, GradingContext>();

/** 시즌 등급 재료 (리그 전체 선수 → 국적 집단별). 순위 범위와 관계없이 하나 */
export function seasonGrading(cards: SeasonCards): GradingContext {
  let g = gradingCache.get(cards);
  if (!g) {
    g = buildGradingContext(cards.players, cards.defaults.rule, cards.coverage);
    gradingCache.set(cards, g);
  }
  return g;
}

/**
 * 시즌 카드 데이터의 비교 재료. group 이 "all" 이면 리그 전체, 아니면 그 포지션 묶음(순위만 — 등급은 seasonGrading).
 * 표본 기준은 파일의 기본값(defaults.rule), 성공률 시도 기준은 **항상 리그 전체 값**(defaults.thresholds) —
 * 센터 집단만으로 3점 시도 평균을 내면 기준이 너무 낮아지기 때문 (lib/metrics buildCardContext opts).
 */
export function seasonContext(cards: SeasonCards, group: PositionFilter = "all"): CardContext {
  let byGroup = ctxCache.get(cards);
  if (!byGroup) {
    byGroup = new Map();
    ctxCache.set(cards, byGroup);
  }
  let ctx = byGroup.get(group);
  if (!ctx) {
    ctx = buildCardContext(filterByPosition(cards.players, group), cards.defaults.rule, cards.coverage, {
      thresholds: cards.defaults.thresholds,
      grading: seasonGrading(cards),
    });
    byGroup.set(group, ctx);
  }
  return ctx;
}

/** 등급 기준 한 줄, 예: "국내 선수 109명 중" (집단 이름 + 표본 충족 인원) */
export function gradeBasisLabel(g: { label: string; count: number }): string {
  return `${g.label} ${g.count}명 중`;
}

/** 한 선수의 시즌 카드. 그 시즌에 없는 선수면 null */
export function buildSeasonCardView(cards: SeasonCards, playerId: string, scope: CardScope = "all"): SeasonCardView | null {
  const p = cards.players.find((x) => x.id === playerId);
  if (!p) return null;
  const group: PositionFilter = scope === "position" && p.positionGroup ? p.positionGroup : "all";
  const ctx = seasonContext(cards, group);
  const entry = buildCardEntry(p, ctx);
  return {
    entry,
    team: cards.teams.find((t) => t.teamCode === p.teamCode) ?? null,
    seasonCode: cards.seasonCode,
    seasonLabel: cards.seasonLabel,
    coverage: cards.coverage,
    ruleLabel: qualifyLabel(ctx.rule),
    qualifiedCount: ctx.qualifiedCount,
    gradeLabel: gradeBasisLabel(entry.gradeGroup),
    missingComponents: missingComponentLabels(ctx.grading),
    overallNote: overallWeightNote(p.position),
    attemptsLabel: attemptsNote(ctx.thresholds),
    scope: group === "all" ? "all" : "position",
    groupLabel: group === "all" ? null : POSITION_GROUP_LABELS[group],
  };
}

/** 카드 격자 아래 작은 줄: 경기당 파울·출전시간 (순위 없음) */
export function cardFootStats(p: { games: number; minutes: number; fouls: number }): { fouls: number; minutes: number } {
  return { fouls: perGame(p.fouls, p.games), minutes: perGame(p.minutes, p.games) };
}

/** 순위 칸 앞 머리말: 전체면 "시즌 순위", 같은 포지션이면 "가드 중 순위" */
export function rankHeading(groupLabel: string | null): string {
  return groupLabel ? `${groupLabel} 중 순위` : "시즌 순위";
}

/** 스크린리더·툴팁용 순위 문장, 예: "가드 중 3위, 34명 중" / "시즌 3위, 142명 중" */
export function rankPhrase(rank: number, of: number, groupLabel: string | null): string {
  return `${groupLabel ? `${groupLabel} 중` : "시즌"} ${rank}위, ${of}명 중`;
}

// ─────────────────────────────────────────────
// 선수 탭 그리드 (/players)
// ─────────────────────────────────────────────

export interface GridEntry {
  player: CardPlayer;
  /** 종합 등급 (국적 집단 기준 — 선수 상세 카드와 같다). 표본 미달이면 "-" */
  overall: Grade | "-";
  /** 종합 점수 1~99 (gradeScore). 표본 미달이면 null */
  score: number | null;
  qualified: boolean;
  /** 경기당 득점 */
  ppg: number;
}

/** 등급 정렬 순서 (앞이 위) */
export const GRADE_ORDER: readonly (Grade | "-")[] = ["S", "A", "B", "C", "D", "F", "-"];

/** 시즌 선수 전원의 그리드 값 (종합 등급은 국적 집단 기준 — 선수 상세 카드와 같다) */
export function buildGridEntries(cards: SeasonCards): GridEntry[] {
  const ctx = seasonContext(cards, "all");
  return cards.players.map((p) => {
    const e = buildCardEntry(p, ctx);
    return { player: p, overall: e.qualified ? e.overall : "-", score: e.qualified ? gradeScore(e.overallPct) : null, qualified: e.qualified, ppg: perGame(p.points, p.games) };
  });
}

/**
 * 그리드 정렬: 종합 등급(S → F, 표본 미달 "-" 은 맨 뒤) → PER 높은 순 → 한글 이름순 → 선수 번호순.
 * 같은 등급 안에서는 PER(전 시즌에 있는 생산성 지수)로 줄 세운다.
 */
export function sortGridEntries(list: readonly GridEntry[]): GridEntry[] {
  const g = (e: GridEntry) => GRADE_ORDER.indexOf(e.overall);
  return [...list].sort(
    (a, b) =>
      g(a) - g(b) ||
      b.player.per - a.player.per ||
      a.player.nameKo.localeCompare(b.player.nameKo, "ko") ||
      a.player.id.localeCompare(b.player.id),
  );
}

export interface GridFilter {
  position: PositionFilter;
  origin: NationalityFilter;
  /** null 이면 전체 팀 */
  teamCode: string | null;
  /** 칭호 배지 키 (lib/badges BadgeKey, 2026-10-01 "칭호로 선수 찾기"). 없거나 null 이면 전체 */
  badge?: string | null;
  /** 출신교 묶음 이름 (lib/roster schoolGroupOf, 2026-10-02). 없거나 null 이면 전체 */
  school?: string | null;
}

/** 선수 탭 그리드 첫 화면 카드 수. "더 보기"를 누를 때마다 이만큼 더 (디자인 점검 A3) */
export const GRID_PAGE_SIZE = 20;

/** 선수 탭 "필터" 시트 항목 (시즌은 상단 시즌 선택이 맡는다) */
export type GridFilterField = keyof GridFilter;

/**
 * 적용 중 필터 요약 칩 (기본값 아닌 것만, 시트 안 순서). teamLabel: 팀 코드 → 표시 이름.
 * 형식은 lib/leaders leaderFilterChips 와 같다 ({ field, label }).
 */
export function gridFilterChips(
  f: GridFilter,
  teamLabel: (code: string) => string,
  badgeLabel: (key: string) => string = (k) => k,
): { field: GridFilterField; label: string }[] {
  const out: { field: GridFilterField; label: string }[] = [];
  if (f.position !== "all") out.push({ field: "position", label: positionFilterLabel(f.position) });
  if (f.origin !== "all") out.push({ field: "origin", label: nationalityFilterLabel(f.origin) });
  if (f.teamCode !== null) out.push({ field: "teamCode", label: teamLabel(f.teamCode) });
  if (f.badge) out.push({ field: "badge", label: badgeLabel(f.badge) });
  if (f.school) out.push({ field: "school", label: f.school });
  return out;
}

/** 칩의 ✕: 그 항목만 기본값(전체)으로 */
export function clearGridFilter<T extends GridFilter>(f: T, field: GridFilterField): T {
  return { ...f, [field]: field === "teamCode" || field === "badge" || field === "school" ? null : "all" };
}

/** 포지션·국적(lib/roster)·팀·칭호로 거른다. badgesOf: 선수 번호 → 그 선수의 칭호 배지 키 (통산 기준) */
export function filterGridEntries(
  list: readonly GridEntry[],
  f: GridFilter,
  badgesOf: (id: string) => readonly string[] = () => [],
  schoolOf: (id: string) => string | null = () => null,
): GridEntry[] {
  const players = filterByNationality(filterByPosition(list.map((e) => e.player), f.position), f.origin);
  const keep = new Set(
    players
      .filter((p) => f.teamCode === null || p.teamCode === f.teamCode)
      .filter((p) => !f.badge || badgesOf(p.id).includes(f.badge))
      .filter((p) => !f.school || schoolOf(p.id) === f.school)
      .map((p) => p.id),
  );
  return list.filter((e) => keep.has(e.player.id));
}

// ─────────────────────────────────────────────
// 두 카드 비교표 (비교 탭)
// ─────────────────────────────────────────────

export type CompareSide = "a" | "b" | "tie" | null;

export interface CompareRow {
  key: CardStatKey | "usgPct" | "overall";
  label: string;
  /** 표시 값 (경기당·성공률, lib/metrics cardStatValue). 등급 줄은 null */
  a: number | null;
  b: number | null;
  aText: string;
  bText: string;
  /** 각자 자기 시즌(자기 비교 집단) 안 순위 — 등급 줄은 null */
  aRank: CardStatRank | null;
  bRank: CardStatRank | null;
  /** 더 나은 쪽 (턴오버·파울은 낮은 쪽). 비교할 수 없으면 null */
  better: CompareSide;
  /** b − a (같은 선수 두 시즌 비교의 증감). 등급 줄은 null */
  delta: number | null;
  deltaText: string;
  /** 낮을수록 좋은 지표 (턴오버·파울) — 증감 색·문구에 쓴다 */
  lowerIsBetter: boolean;
}

const NF1 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 값 표기: 소수 1자리, 성공률은 "%" */
export function formatCardValue(v: number | null, pct: boolean): string {
  if (v === null || !Number.isFinite(v)) return "–";
  return `${NF1.format(v)}${pct ? "%" : ""}`;
}

/** 증감 표기: "+1.2" / "−0.4" / "0.0" (성공률은 "%p") */
export function formatDelta(d: number | null, pct: boolean): string {
  if (d === null || !Number.isFinite(d)) return "–";
  const r = Math.round(d * 10) / 10;
  const unit = pct ? "%p" : "";
  if (r === 0) return `0.0${unit}`;
  return `${r > 0 ? "+" : "−"}${NF1.format(Math.abs(r))}${unit}`;
}

function betterOf(a: number | null, b: number | null, lower: boolean): CompareSide {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a === b) return "tie";
  return (lower ? a < b : a > b) ? "a" : "b";
}

/** 등급 비교: S 가 가장 좋다. "-"(표본 미달)는 비교하지 않는다 */
function betterGrade(a: Grade | "-", b: Grade | "-"): CompareSide {
  if (a === "-" || b === "-") return null;
  const ia = GRADE_ORDER.indexOf(a);
  const ib = GRADE_ORDER.indexOf(b);
  return ia === ib ? "tie" : ia < ib ? "a" : "b";
}

type EntryLike = Pick<CardEntryOf<CardPlayer>, "stats" | "overall" | "qualified" | "usgPct" | "overallPct">;

/**
 * 두 카드의 비교표: 카드 스탯 10개(득점 … 자유투 성공률 + 파울, lib/metrics CARD_STATS 순서) + USG% + 종합 등급.
 * 순위·등급은 각 카드가 자기 시즌·자기 집단 안에서 매긴 값 그대로다 (서로 다른 시즌이면 직접 비교가 아니라 "각자 시즌 안 위치").
 * 더 나은 쪽: 대부분 높은 값, 턴오버·파울(better: "low")은 낮은 값.
 * USG%(공격 점유율)는 많고 적음이 곧 좋고 나쁨이 아니라 더 나은 쪽을 표시하지 않는다(better null). 없는 시즌은 "–".
 */
export function compareCardEntries(a: EntryLike, b: EntryLike): CompareRow[] {
  const rows: CompareRow[] = CARD_STATS.map((def) => {
    const sa = a.stats.find((s) => s.def.key === def.key);
    const sb = b.stats.find((s) => s.def.key === def.key);
    const va = sa ? sa.value : null;
    const vb = sb ? sb.value : null;
    const pct = def.kind === "pct";
    const lower = def.better === "low";
    const delta = va !== null && vb !== null && Number.isFinite(va) && Number.isFinite(vb) ? vb - va : null;
    return {
      key: def.key,
      label: def.label,
      a: va,
      b: vb,
      aText: formatCardValue(va, pct),
      bText: formatCardValue(vb, pct),
      aRank: sa?.rank ?? null,
      bRank: sb?.rank ?? null,
      better: betterOf(va, vb, lower),
      delta,
      deltaText: formatDelta(delta, pct),
      lowerIsBetter: lower,
    };
  });
  const ua = a.usgPct;
  const ub = b.usgPct;
  const usgDelta = ua !== null && ub !== null ? ub - ua : null;
  rows.push({
    key: "usgPct",
    label: "USG%",
    a: ua,
    b: ub,
    aText: formatCardValue(ua, true),
    bText: formatCardValue(ub, true),
    aRank: null,
    bRank: null,
    better: null,
    delta: usgDelta,
    deltaText: formatDelta(usgDelta, true),
    lowerIsBetter: false,
  });
  const ga = a.qualified ? a.overall : "-";
  const gb = b.qualified ? b.overall : "-";
  rows.push({
    key: "overall",
    label: "종합 등급",
    a: null,
    b: null,
    aText: ga === "-" ? "표본 미달" : `${ga} · ${gradeScore(a.overallPct) ?? "–"}점`,
    bText: gb === "-" ? "표본 미달" : `${gb} · ${gradeScore(b.overallPct) ?? "–"}점`,
    aRank: null,
    bRank: null,
    better: betterGrade(ga, gb),
    delta: null,
    deltaText: "–",
    lowerIsBetter: false,
  });
  return rows;
}

/**
 * 모바일 좌우 비교(A값 | 항목 | B값)의 막대 길이: 두 값 중 큰 쪽을 1 로 한 비율 (0~1).
 * 값이 없거나 둘 다 0 이하·등급 줄이면 null(막대 없음). 음수(+/- 같은 값)는 막대로 그리지 않는다.
 * 턴오버·파울처럼 낮을수록 좋은 항목도 막대는 값 크기 그대로 — 어느 쪽이 나은지는 굵은 글자·화살표(better)로 전한다.
 */
export function compareBarShares(row: Pick<CompareRow, "a" | "b">): { a: number; b: number } | null {
  const { a, b } = row;
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  const max = Math.max(a, b);
  if (!(max > 0) || a < 0 || b < 0) return null;
  return { a: a / max, b: b / max };
}

/** 순위 칸 짧은 표기: "3위" / "표본 미달" / "시도 부족" / "" (순위 없는 스탯) */
export function rankShort(r: CardStatRank | null): string {
  if (!r) return "";
  if (r.rank !== null) return `${r.rank}위`;
  return r.reason === "sample" ? "표본 미달" : r.reason === "attempts" ? "시도 부족" : "";
}

// ─────────────────────────────────────────────
// 주소 쿼리
// ─────────────────────────────────────────────

const DIGITS = /^\d+$/;

/** 비교 슬롯: 선수 번호 + 시즌 코드 */
export interface CompareSlot {
  id: string;
  seasonCode: number;
}

/** "291248:47" → { id: "291248", seasonCode: 47 }. 형식이 틀리면 null */
export function parseSlot(v: string | null | undefined): CompareSlot | null {
  if (!v) return null;
  const [id, code, ...rest] = v.split(":");
  if (rest.length || !id || !code || !DIGITS.test(id) || !DIGITS.test(code)) return null;
  return { id, seasonCode: Number(code) };
}

export const formatSlot = (s: CompareSlot) => `${s.id}:${s.seasonCode}`;

/** 비교 탭 주소 ?a=번호:코드&b=번호:코드 → 두 슬롯 (없거나 틀리면 null) */
export function parseCompareQuery(search: string): { a: CompareSlot | null; b: CompareSlot | null } {
  const qs = new URLSearchParams(search);
  return { a: parseSlot(qs.get("a")), b: parseSlot(qs.get("b")) };
}

/** 두 슬롯 → "?a=…&b=…" (빈 슬롯은 뺀다, 둘 다 없으면 "") */
export function compareQueryString(a: CompareSlot | null, b: CompareSlot | null): string {
  const parts: string[] = [];
  if (a) parts.push(`a=${formatSlot(a)}`);
  if (b) parts.push(`b=${formatSlot(b)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

/** 비교 탭 링크, 예: "/compare?a=291248:47&b=291248:45" (b 를 비우면 A 슬롯만 채운 비교 탭) */
export const compareHref = (a: CompareSlot, b: CompareSlot | null = null) => `/compare${compareQueryString(a, b)}`;

/**
 * 선수 상세 화면 상태: 고른 시즌 · 순위 범위.
 * (같은 선수 "시즌 비교"는 2026-09-30 사용자 피드백으로 없앴다 — 두 시즌 비교는 비교 탭 /compare 에서.
 *  예전 주소의 ?vs= 는 읽지 않고, 다음 주소 갱신 때 지워진다.)
 */
export interface PlayerViewState {
  season: number;
  scope: CardScope;
}

/** 그 선수가 뛴 시즌 중 가장 최근 (없으면 null) */
export const latestSeason = (seasons: readonly number[]) => (seasons.length ? Math.max(...seasons) : null);

/**
 * 선수 상세 쿼리 ?season=45&scope=pos → 상태. 그 선수가 뛰지 않은 시즌은 버린다.
 * season 이 없거나 틀리면 가장 최근 시즌.
 */
export function parsePlayerQuery(search: string, seasons: readonly number[]): PlayerViewState {
  const qs = new URLSearchParams(search);
  const v = qs.get("season");
  const season = v && DIGITS.test(v) && seasons.includes(Number(v)) ? Number(v) : (latestSeason(seasons) ?? 0);
  return { season, scope: qs.get("scope") === "pos" ? "position" : "all" };
}

/** 상태 → 쿼리 ("" 또는 "?..."). 가장 최근 시즌·전체 범위는 생략 */
export function playerQueryString(s: PlayerViewState, seasons: readonly number[]): string {
  const qs = new URLSearchParams();
  if (s.season !== latestSeason(seasons)) qs.set("season", String(s.season));
  if (s.scope === "position") qs.set("scope", "pos");
  const str = qs.toString();
  return str ? `?${str}` : "";
}

/** 선수 상세 링크, 예: playerHref("291248", 45) → "/player/291248?season=45" (시즌 생략 가능) */
export const playerHref = (id: string, season?: number) => `/player/${id}${season === undefined ? "" : `?season=${season}`}`;

/** 선수 탭 상태 */
export interface PlayersState extends GridFilter {
  season: number;
}

/**
 * 선수 탭 쿼리 ?season=45&pos=g&origin=for&team=55&badge=scoringKing → 상태. 칭호는 형식만 본다(목록에 없는 키면 화면이 버린다). 목록에 없는 시즌이면 latest.
 * 팀은 형식만 본다(시즌마다 팀이 달라 그 시즌 파일을 받은 뒤 화면이 없는 팀을 버린다).
 */
export function parsePlayersQuery(search: string, ctx: { seasons: readonly number[]; latest: number }): PlayersState {
  const qs = new URLSearchParams(search);
  const s = qs.get("season");
  const team = qs.get("team");
  const badge = qs.get("badge");
  const school = qs.get("school");
  return {
    season: s && DIGITS.test(s) && ctx.seasons.includes(Number(s)) ? Number(s) : ctx.latest,
    position: positionFromParam(qs.get("pos")),
    origin: nationalityFromParam(qs.get("origin")),
    teamCode: team && DIGITS.test(team) ? team : null,
    badge: badge && /^[a-zA-Z0-9]{1,30}$/.test(badge) ? badge : null,
    school: school && school.length <= 40 ? school : null,
  };
}

/** 선수 탭 상태 → 쿼리. 기본값(최신 시즌·전체)은 생략 */
export function playersQueryString(s: PlayersState, latest: number): string {
  const qs = new URLSearchParams();
  if (s.season !== latest) qs.set("season", String(s.season));
  if (s.position !== "all") qs.set("pos", positionParam(s.position));
  if (s.origin !== "all") qs.set("origin", nationalityParam(s.origin));
  if (s.teamCode) qs.set("team", s.teamCode);
  if (s.badge) qs.set("badge", s.badge);
  if (s.school) qs.set("school", s.school);
  const str = qs.toString();
  return str ? `?${str}` : "";
}

// ─────────────────────────────────────────────
// 선수 상세 하이라이트 카드 (PC 오른쪽 열 아래, 피드백 3차 #6)
// ─────────────────────────────────────────────

export interface Highlight {
  key: string;
  /** 예: "득점 1위" / "가드 중 득점 1위" / "커리어 하이 · 득점" */
  title: string;
  /** 큰 숫자, 예: "25.3" / "46" */
  value: string;
  /** 숫자 뒤 작은 단위, 예: "경기당" / "%" / "점" */
  unit: string;
  /** 아래 작은 줄, 예: "142명 중" / "2023.10.21 · 상대 KCC" */
  note: string;
  /** 순위 (시즌 하이라이트만, 커리어 하이는 null) */
  rank: number | null;
}

/** 하이라이트 카드 최대 수 */
export const HIGHLIGHT_LIMIT = 3;
/** 하이라이트에 넣는 시즌 순위 한계 (1~10위) */
export const HIGHLIGHT_MAX_RANK = 10;

/**
 * 그 시즌 카드 스탯 중 순위 1~10위인 부문, 순위 높은 순(같으면 CARD_STATS 순서) 최대 3개.
 * 턴오버는 뺀다 — "적을수록 상위"라 출전이 적은 선수가 1위가 되기 쉬워 하이라이트로 읽히지 않는다. 파울(순위 없음)도 뺀다.
 * groupLabel: 같은 포지션 범위면 "가드" → "가드 중 득점 1위".
 */
export function seasonHighlights(
  stats: readonly CardStatEntry[],
  groupLabel: string | null,
  limit = HIGHLIGHT_LIMIT,
): Highlight[] {
  const order = CARD_STATS.map((d) => d.key);
  return stats
    .filter((s) => s.def.ranked && s.def.key !== "tov" && s.rank.rank !== null && s.rank.rank <= HIGHLIGHT_MAX_RANK)
    .sort((a, b) => a.rank.rank! - b.rank.rank! || order.indexOf(a.def.key) - order.indexOf(b.def.key))
    .slice(0, limit)
    .map((s) => ({
      key: s.def.key,
      title: `${groupLabel ? `${groupLabel} 중 ` : ""}${s.def.label} ${s.rank.rank}위`,
      value: formatCardValue(s.value, false),
      unit: s.def.kind === "pct" ? "%" : "경기당",
      note: `${s.rank.of}명 중`,
      rank: s.rank.rank,
    }));
}

/** 하이라이트 카드 대체 목록 = 화면에 보여 주는 한 경기 최다 7개 (lib/highs HERO_HIGH_KEYS) 순서 */
export const CAREER_HIGHLIGHT_KEYS = HERO_HIGH_KEYS;

/**
 * 시즌 순위 1~10위가 하나도 없을 때 대신 보여 줄 정규시즌 커리어 하이 최대 3개 (CAREER_HIGHLIGHT_KEYS = HERO_HIGH_KEYS 순서).
 * rows = lib/career careerHighRows 결과 (값·날짜·상대가 이미 표기된 문자열).
 */
export function careerHighlights(
  rows: readonly { key: string; label: string; value: string; opponent: string; date: string; rate: boolean; shot?: string | null }[],
  limit = HIGHLIGHT_LIMIT,
): Highlight[] {
  const byKey = new Map(rows.filter((r) => !r.rate).map((r) => [r.key, r]));
  return CAREER_HIGHLIGHT_KEYS.flatMap((k) => {
    const r = byKey.get(k);
    return r ? [r] : [];
  })
    .slice(0, limit)
    .map((r) => ({
      key: r.key,
      title: `커리어 하이 · ${r.label}`,
      value: r.value,
      unit: r.key === "pts" ? "점" : "개",
      note: [r.shot ?? "", r.date, r.opponent !== "–" ? `상대 ${r.opponent}` : ""].filter(Boolean).join(" · "),
      rank: null,
    }));
}

// ─────────────────────────────────────────────
// 레이더 차트 배치 (2026-09-30 피드백 5차 #6: 모바일에서 위 꼭짓점 "공격" 등급 칩이 잘렸다 / 2026-10-01 6축 일반화)
// ─────────────────────────────────────────────

/** Recharts PolarAngleAxis 가 꼭짓점 라벨을 그리는 위치 = 꼭짓점에서 바깥으로 tickSize(기본 8px) 더 나간 곳 */
export const RADAR_TICK_GAP = 8;

export interface RadarGeometry {
  /** 레이더 반지름 (px) */
  outer: number;
  /** 중심 세로 위치 (px, 차트 위에서부터) */
  cy: number;
}

/**
 * n각형 레이더(첫 축이 위 꼭짓점, 시계 방향 — Recharts 기본) + 꼭짓점 바깥 라벨 상자(block: 폭·높이 px)가
 * width × height 안에 모두 들어가는 가장 큰 반지름과 중심 높이. 라벨 상자는 PlayerCard GradeTick 처럼
 * "라벨 기준점에서 바깥으로 반 칸 + 2px" 밀어 그린다고 본다(가로·세로 따로).
 * 꼭짓점 k 의 바깥 단위 벡터 (ux, uy): 가로 끝 = |ux|·(R + gap + 반폭) + block.w/2, 세로 끝 = |uy|·(R + gap + 반높이) + block.h/2.
 * - 세로: 위로 가장 멀리 나간 상자 위끝 ~ 아래로 가장 멀리 나간 상자 아래끝이 height − 2·margin 안.
 * - 가로: 좌우로 가장 멀리 나간 상자 바깥끝이 width − 2·margin 안.
 * 5축 시절(2026-09-30)에는 오각형 상수(cos 18°·sin 54°)를 박았고, 6축(2026-10-01)부터 축 수로 계산한다.
 */
export function radarGeometry(
  width: number,
  height: number,
  block: { w: number; h: number },
  margin = 8,
  tickGap = RADAR_TICK_GAP,
  axes = RADAR_AXES.length,
): RadarGeometry {
  const halfW = block.w / 2 + 2;
  const halfH = block.h / 2 + 2;
  // 각 꼭짓점의 반지름 배수(|u|)와 상수 부분을 모아, 위·아래·옆 각각 "R·k + c ≤ 한도" 를 푼다
  let upK = 0, upC = 0, downK = 0, downC = 0, sideK = 0, sideC = 0;
  for (let i = 0; i < axes; i++) {
    const rad = ((90 - (360 * i) / axes) * Math.PI) / 180;
    const ux = Math.abs(Math.cos(rad));
    const uyRaw = Math.sin(rad); // + 위
    const uy = Math.abs(uyRaw);
    const xc = ux * (tickGap + halfW) + block.w / 2;
    const yc = uy * (tickGap + halfH) + block.h / 2;
    if (ux > sideK || (ux === sideK && xc > sideC)) { sideK = ux; sideC = xc; }
    if (uyRaw >= 0 && (uy > upK || (uy === upK && yc > upC))) { upK = uy; upC = yc; }
    if (uyRaw <= 0 && (uy > downK || (uy === downK && yc > downC))) { downK = uy; downC = yc; }
  }
  const rByH = (height - 2 * margin - upC - downC) / (upK + downK);
  const rByW = sideK > 0 ? (width / 2 - margin - sideC) / sideK : Infinity;
  const outer = Math.max(30, Math.floor(Math.min(rByH, rByW)));
  // 남는 세로 공간은 위아래로 똑같이 나눈다
  const used = outer * (upK + downK) + upC + downC;
  const cy = Math.round((height - used) / 2 + outer * upK + upC);
  return { outer, cy };
}

// ─────────────────────────────────────────────
// 세부 능력치 백분위 막대 (선수 상세 카드 아래, 2026-10-01 — Baseball Savant "Percentile Rankings" 참고)
// 레이더 6축의 구성 요소 하나하나를 같은 국적 집단 안 백분위로. 색은 낮음 파랑 · 50 회색 · 높음 빨강(lib/teams divergingFill).
// ─────────────────────────────────────────────

export interface PercentileBarRow {
  key: RadarComponentKey;
  /** 표시 이름 ("경기당 " 은 뗀다 — 묶음 머리에 "누적 기록은 경기당"이 있다) */
  label: string;
  /** 그 선수 값 표기 (예: "23.2", "38.5%", "1.82") */
  valueText: string;
  /** 0~100 (시도 기준 미달 등으로 없으면 null — 막대 없이 "–") */
  pct: number | null;
}

export interface PercentileBarGroup {
  axis: RadarAxis;
  label: string;
  /** 축 백분위 (레이더 값) */
  axisPct: number | null;
  rows: PercentileBarRow[];
}

const RATE_COMPONENTS = new Set<RadarComponentKey>(["usgPct", "rebPct", "tpPct", "midPct", "ftPct", "tovPct", "astPct", "tsPct", "efgPct"]);

/** 구성 요소 값 표기: 성공률·% 지표는 "38.5%", AST/TO 는 소수 2자리, 나머지 소수 1자리 */
export function componentValueText(key: RadarComponentKey, value: number): string {
  if (!Number.isFinite(value)) return "–";
  if (RATE_COMPONENTS.has(key)) return `${value.toFixed(1)}%`;
  if (key === "astTo") return value.toFixed(2);
  return value.toFixed(1);
}

/** 레이더 점수 → 축별 막대 묶음 (그 시즌에 기록이 있는 구성 요소만, 순서 = RADAR_AXIS_COMPONENTS) */
export function percentileBarGroups(radar: Pick<RadarScore, "axes" | "components">): PercentileBarGroup[] {
  return RADAR_AXES.map((axis) => ({
    axis,
    label: RADAR_AXIS_LABELS[axis],
    axisPct: radar.axes[axis],
    rows: radar.components[axis].map((c) => ({
      key: c.key,
      label: RADAR_COMPONENTS[c.key].label.replace(/^경기당 /, ""),
      valueText: componentValueText(c.key, c.value),
      pct: c.pct === null ? null : Math.round(c.pct),
    })),
  })).filter((g) => g.rows.length > 0);
}

/** 백분위 → 발산형 색 위치 -1(0, 파랑) ~ 0(50, 회색) ~ 1(100, 빨강) */
export function percentileTone(pct: number): number {
  return Math.max(-1, Math.min(1, (pct - 50) / 50));
}
