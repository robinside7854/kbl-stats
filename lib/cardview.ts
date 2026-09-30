// 시즌 카드 데이터(lib/cards.ts SeasonCards) → 화면용 카드·선수 그리드·비교표 — 순수 함수만 둔다 (CLAUDE.md 원칙 5).
// 선수 탭(/players)·선수 상세(/player/[번호])·비교 탭(/compare)이 같은 함수를 쓴다.
// 서버(빌드 시점, lib/data.ts)와 브라우저(public/cards/{코드}.json 을 받아서)가 같은 입력 → 같은 결과가 되도록
// 서버도 public/cards 와 똑같이 encode → decode 한 데이터를 넘긴다(소수 넷째 자리 반올림까지 같게).
// 순위·백분위·등급 계산은 lib/metrics.ts, 비교 집단 필터는 lib/roster.ts 를 부르기만 한다.

import type { SeasonCards } from "./cards";
import {
  attemptsNote,
  buildCardContext,
  buildCardEntry,
  CARD_STATS,
  perGame,
  qualifyLabel,
  type CardContext,
  type CardEntryOf,
  type CardStatKey,
  type CardStatRank,
  type Grade,
  type RadarAxisSet,
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
import type { CardPlayer, CardTeam } from "./types";

// ─────────────────────────────────────────────
// 카드 한 장 (시즌 + 순위 범위)
// ─────────────────────────────────────────────

/**
 * 순위·등급 비교 집단: 리그 전체 / 같은 포지션(가드·포워드·센터 묶음, lib/roster positionGroupOf).
 * 포지션을 모르는 선수(선수 마스터에 없음)는 "position" 을 골라도 전체로 계산하고 view.scope 는 "all" 이 된다.
 */
export type CardScope = "all" | "position";

export interface SeasonCardView {
  entry: CardEntryOf<CardPlayer>;
  team: CardTeam | null;
  seasonCode: number;
  seasonLabel: string;
  axisSet: RadarAxisSet;
  /** 표본 기준 표기, 예: "10경기·100분 이상" */
  ruleLabel: string;
  /** 비교 집단 중 표본 기준 충족 선수 수 */
  qualifiedCount: number;
  /** 성공률 시도 기준 표기 (리그 전체 기준 — 집단을 좁혀도 같다) */
  attemptsLabel: string;
  /** 실제로 적용된 범위 (포지션을 모르면 "position" 요청도 "all") */
  scope: CardScope;
  /** 비교 집단 이름: 전체면 null, 같은 포지션이면 "가드" 등 — 카드에 "가드 중 3위"로 쓴다 */
  groupLabel: string | null;
}

// 같은 시즌·같은 집단의 비교 재료는 한 번만 만든다 (선수 페이지 1,329개 빌드·그리드 200명)
const ctxCache = new WeakMap<SeasonCards, Map<string, CardContext>>();

/**
 * 시즌 카드 데이터의 비교 재료. group 이 "all" 이면 리그 전체, 아니면 그 포지션 묶음.
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
    ctx = buildCardContext(filterByPosition(cards.players, group), cards.defaults.rule, cards.axisSet, {
      thresholds: cards.defaults.thresholds,
    });
    byGroup.set(group, ctx);
  }
  return ctx;
}

/** 한 선수의 시즌 카드. 그 시즌에 없는 선수면 null */
export function buildSeasonCardView(cards: SeasonCards, playerId: string, scope: CardScope = "all"): SeasonCardView | null {
  const p = cards.players.find((x) => x.id === playerId);
  if (!p) return null;
  const group: PositionFilter = scope === "position" && p.positionGroup ? p.positionGroup : "all";
  const ctx = seasonContext(cards, group);
  return {
    entry: buildCardEntry(p, ctx),
    team: cards.teams.find((t) => t.teamCode === p.teamCode) ?? null,
    seasonCode: cards.seasonCode,
    seasonLabel: cards.seasonLabel,
    axisSet: cards.axisSet,
    ruleLabel: qualifyLabel(ctx.rule),
    qualifiedCount: ctx.qualifiedCount,
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
  /** 종합 등급 (리그 전체 기준). 표본 미달이면 "-" */
  overall: Grade | "-";
  qualified: boolean;
  /** 경기당 득점 */
  ppg: number;
}

/** 등급 정렬 순서 (앞이 위) */
export const GRADE_ORDER: readonly (Grade | "-")[] = ["S", "A", "B", "C", "D", "F", "-"];

/** 시즌 선수 전원의 그리드 값 (종합 등급은 리그 전체 집단 기준 — 선수 상세 카드의 "전체" 범위와 같다) */
export function buildGridEntries(cards: SeasonCards): GridEntry[] {
  const ctx = seasonContext(cards, "all");
  return cards.players.map((p) => {
    const e = buildCardEntry(p, ctx);
    return { player: p, overall: e.qualified ? e.overall : "-", qualified: e.qualified, ppg: perGame(p.points, p.games) };
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
}

/** 선수 탭 그리드 첫 화면 카드 수. "더 보기"를 누를 때마다 이만큼 더 (디자인 점검 A3) */
export const GRID_PAGE_SIZE = 20;

/** 선수 탭 "필터" 시트 항목 (시즌은 상단 시즌 선택이 맡는다) */
export type GridFilterField = keyof GridFilter;

/**
 * 적용 중 필터 요약 칩 (기본값 아닌 것만, 시트 안 순서). teamLabel: 팀 코드 → 표시 이름.
 * 형식은 lib/leaders leaderFilterChips 와 같다 ({ field, label }).
 */
export function gridFilterChips(f: GridFilter, teamLabel: (code: string) => string): { field: GridFilterField; label: string }[] {
  const out: { field: GridFilterField; label: string }[] = [];
  if (f.position !== "all") out.push({ field: "position", label: positionFilterLabel(f.position) });
  if (f.origin !== "all") out.push({ field: "origin", label: nationalityFilterLabel(f.origin) });
  if (f.teamCode !== null) out.push({ field: "teamCode", label: teamLabel(f.teamCode) });
  return out;
}

/** 칩의 ✕: 그 항목만 기본값(전체)으로 */
export function clearGridFilter<T extends GridFilter>(f: T, field: GridFilterField): T {
  return { ...f, [field]: field === "teamCode" ? null : "all" };
}

/** 포지션·국적(lib/roster)·팀으로 거른다 */
export function filterGridEntries(list: readonly GridEntry[], f: GridFilter): GridEntry[] {
  const players = filterByNationality(filterByPosition(list.map((e) => e.player), f.position), f.origin);
  const keep = new Set(players.filter((p) => f.teamCode === null || p.teamCode === f.teamCode).map((p) => p.id));
  return list.filter((e) => keep.has(e.player.id));
}

// ─────────────────────────────────────────────
// 두 카드 비교표 (비교 탭 · 선수 상세 "시즌 비교")
// ─────────────────────────────────────────────

export type CompareSide = "a" | "b" | "tie" | null;

export interface CompareRow {
  key: CardStatKey | "overall";
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
  /** b − a (같은 선수 시즌 비교의 증감). 등급 줄은 null */
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

type EntryLike = Pick<CardEntryOf<CardPlayer>, "stats" | "overall" | "qualified">;

/**
 * 두 카드의 비교표: 카드 스탯 10개(득점 … 자유투 성공률 + 파울, lib/metrics CARD_STATS 순서) + 종합 등급.
 * 순위·등급은 각 카드가 자기 시즌·자기 집단 안에서 매긴 값 그대로다 (서로 다른 시즌이면 직접 비교가 아니라 "각자 시즌 안 위치").
 * 더 나은 쪽: 대부분 높은 값, 턴오버·파울(better: "low")은 낮은 값.
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
  const ga = a.qualified ? a.overall : "-";
  const gb = b.qualified ? b.overall : "-";
  rows.push({
    key: "overall",
    label: "종합 등급",
    a: null,
    b: null,
    aText: ga === "-" ? "표본 미달" : ga,
    bText: gb === "-" ? "표본 미달" : gb,
    aRank: null,
    bRank: null,
    better: betterGrade(ga, gb),
    delta: null,
    deltaText: "–",
    lowerIsBetter: false,
  });
  return rows;
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

/** 비교 탭 링크, 예: "/compare?a=291248:47&b=291248:45" */
export const compareHref = (a: CompareSlot, b: CompareSlot) => `/compare${compareQueryString(a, b)}`;

/** 선수 상세 화면 상태: 고른 시즌 · 시즌 비교(두 번째 시즌) · 순위 범위 */
export interface PlayerViewState {
  season: number;
  /** 시즌 비교가 켜져 있으면 두 번째 시즌, 꺼져 있으면 null */
  vs: number | null;
  scope: CardScope;
}

/**
 * 시즌 비교를 켰을 때 두 번째 시즌 기본값: 고른 시즌 바로 전에 뛴 시즌, 없으면 바로 다음에 뛴 시즌, 한 시즌뿐이면 null.
 * seasons 는 그 선수가 뛴 시즌 코드 (순서 무관).
 */
export function defaultVsSeason(seasons: readonly number[], season: number): number | null {
  const sorted = [...new Set(seasons)].sort((x, y) => x - y);
  const i = sorted.indexOf(season);
  if (i < 0) return sorted.length ? sorted[sorted.length - 1] : null;
  if (i > 0) return sorted[i - 1];
  return sorted.length > 1 ? sorted[1] : null;
}

/** 그 선수가 뛴 시즌 중 가장 최근 (없으면 null) */
export const latestSeason = (seasons: readonly number[]) => (seasons.length ? Math.max(...seasons) : null);

/**
 * 선수 상세 쿼리 ?season=45&vs=43&scope=pos → 상태. 그 선수가 뛰지 않은 시즌은 버린다.
 * season 이 없거나 틀리면 가장 최근 시즌. vs 가 season 과 같으면 버린다.
 */
export function parsePlayerQuery(search: string, seasons: readonly number[]): PlayerViewState {
  const qs = new URLSearchParams(search);
  const valid = (v: string | null) => (v && DIGITS.test(v) && seasons.includes(Number(v)) ? Number(v) : null);
  const season = valid(qs.get("season")) ?? latestSeason(seasons) ?? 0;
  const vs = valid(qs.get("vs"));
  return { season, vs: vs !== null && vs !== season ? vs : null, scope: qs.get("scope") === "pos" ? "position" : "all" };
}

/** 상태 → 쿼리 ("" 또는 "?..."). 가장 최근 시즌·전체 범위·비교 꺼짐은 생략 */
export function playerQueryString(s: PlayerViewState, seasons: readonly number[]): string {
  const qs = new URLSearchParams();
  if (s.season !== latestSeason(seasons)) qs.set("season", String(s.season));
  if (s.vs !== null) qs.set("vs", String(s.vs));
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
 * 선수 탭 쿼리 ?season=45&pos=g&origin=for&team=55 → 상태. 목록에 없는 시즌이면 latest.
 * 팀은 형식만 본다(시즌마다 팀이 달라 그 시즌 파일을 받은 뒤 화면이 없는 팀을 버린다).
 */
export function parsePlayersQuery(search: string, ctx: { seasons: readonly number[]; latest: number }): PlayersState {
  const qs = new URLSearchParams(search);
  const s = qs.get("season");
  const team = qs.get("team");
  return {
    season: s && DIGITS.test(s) && ctx.seasons.includes(Number(s)) ? Number(s) : ctx.latest,
    position: positionFromParam(qs.get("pos")),
    origin: nationalityFromParam(qs.get("origin")),
    teamCode: team && DIGITS.test(team) ? team : null,
  };
}

/** 선수 탭 상태 → 쿼리. 기본값(최신 시즌·전체)은 생략 */
export function playersQueryString(s: PlayersState, latest: number): string {
  const qs = new URLSearchParams();
  if (s.season !== latest) qs.set("season", String(s.season));
  if (s.position !== "all") qs.set("pos", positionParam(s.position));
  if (s.origin !== "all") qs.set("origin", nationalityParam(s.origin));
  if (s.teamCode) qs.set("team", s.teamCode);
  const str = qs.toString();
  return str ? `?${str}` : "";
}
