// 팀별 선수 분포(/season/[코드]/teams) 산점도 규칙 — 순수 함수만 둔다 (CLAUDE.md 원칙 5).
// 가로축 = 경기당 출전시간, 세로축 = 생산성 지표(PER·TS%·경기당 득점). 점 = 표본 기준 충족 선수.
// 팀 색 배정·의존도는 lib/teams.ts, 경기당 환산은 lib/metrics.ts perGame.
// USG%·PIE 는 쓰지 않는다 (2025-26에만 있고, 사용자가 어려운 지표라 빼 달라고 함 — 2026-09-30).

import { isQualified, perGame, QUALIFY_PRESETS, qualifyShort, type QualifyRule } from "./metrics";
import { positionFilterLabel, positionFromParam, positionParam, type PositionFilter } from "./roster";

export type ScatterYKey = "per" | "tsPct" | "points";

export interface ScatterMetric {
  key: ScatterYKey;
  /** 전환 버튼·축 제목 */
  label: string;
  /** 모바일 축 라벨(짧게) */
  short: string;
  /** 주소 쿼리 값 */
  param: string;
  /** rate: KBL 계산값 그대로 / perGame: 시즌 누적 ÷ 경기 */
  kind: "rate" | "perGame";
  /** 한 줄 설명 */
  note: string;
}

/** 세로축 지표. 첫 번째가 기본값(PER — 30개 시즌 전부 있는 생산성 지수) */
export const SCATTER_METRICS: readonly ScatterMetric[] = [
  { key: "per", label: "PER", short: "PER", param: "per", kind: "rate", note: "PER: 출전 시간 대비 생산성 지수 (KBL 계산값, 리그 평균 약 15)" },
  { key: "tsPct", label: "TS%", short: "TS%", param: "ts", kind: "rate", note: "TS%: 2점·3점·자유투를 모두 반영한 슈팅 효율 (KBL 계산값)" },
  { key: "points", label: "경기당 득점", short: "득점", param: "pts", kind: "perGame", note: "경기당 득점 = 시즌 누적 득점 ÷ 출전 경기" },
];

export const scatterMetric = (key: ScatterYKey) => SCATTER_METRICS.find((m) => m.key === key)!;

export interface ScatterInput {
  id: string;
  teamCode: string;
  games: number;
  minutes: number;  // 시즌 누적 (분)
  points: number;   // 시즌 누적
  per: number;
  tsPct: number;
}

/** 가로축: 경기당 출전시간(분) = 누적 출전 ÷ 경기 */
export const scatterX = (p: ScatterInput) => perGame(p.minutes, p.games);

/** 세로축 값 */
export function scatterY(p: ScatterInput, key: ScatterYKey): number {
  return key === "points" ? perGame(p.points, p.games) : p[key];
}

export interface ScatterPoint<T> {
  player: T;
  x: number;
  y: number;
}

/** 표본 기준 충족 선수만 점으로 (미달 선수는 출전이 적어 값이 튄다). 값이 숫자가 아니면 뺀다 */
export function scatterPoints<T extends ScatterInput>(
  players: readonly T[],
  rule: QualifyRule,
  key: ScatterYKey,
): ScatterPoint<T>[] {
  return players
    .filter((p) => isQualified(p, rule))
    .map((p) => ({ player: p, x: scatterX(p), y: scatterY(p, key) }))
    .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y));
}

// ─────────────────────────────────────────────
// 팀 선택: 전체(0팀) / 한 팀 강조(1팀) / 두 팀 비교(2팀)
// ─────────────────────────────────────────────

export const MAX_SELECTED_TEAMS = 2;

/**
 * 팀 칩을 눌렀을 때 새 선택. 이미 있으면 빼고, 없으면 뒤에 붙인다.
 * 이미 2팀이면 먼저 고른 팀을 빼고 새 팀을 붙인다 (항상 최근 두 팀).
 */
export function toggleTeam(selected: readonly string[], code: string): string[] {
  if (selected.includes(code)) return selected.filter((c) => c !== code);
  const next = [...selected, code];
  return next.slice(Math.max(0, next.length - MAX_SELECTED_TEAMS));
}

/** 점 강조 단계: 선택 없음 → normal, 선택 팀 → focus, 나머지 → dim */
export type Emphasis = "normal" | "focus" | "dim";

export function teamEmphasis(teamCode: string, selected: readonly string[]): Emphasis {
  if (selected.length === 0) return "normal";
  return selected.includes(teamCode) ? "focus" : "dim";
}

// ─────────────────────────────────────────────
// 주소 쿼리 (?teams=55,16&y=ts&q=1&pos=g&p=선수번호) — 기본값 항목은 생략
// ─────────────────────────────────────────────

export interface DistributionState {
  teams: string[];
  yKey: ScatterYKey;
  /** QUALIFY_PRESETS 번호 */
  presetIdx: number;
  /** 눌러서 고른 선수 (하단 카드) */
  playerId: string | null;
  /** 포지션 묶음 (쿼리 pos=g|f|c) — 점만 거른다. 팀 의존도 카드는 팀 전체 기준 그대로 */
  position: PositionFilter;
}

export const DEFAULT_DISTRIBUTION_STATE: DistributionState = { teams: [], yKey: "per", presetIdx: 0, playerId: null, position: "all" };

/** 쿼리 → 상태. 이 시즌에 없는 팀·선수, 모르는 지표는 버리거나 기본값으로 */
export function parseDistributionQuery(
  search: string,
  ctx: { teamCodes: readonly string[]; playerIds: ReadonlySet<string> },
): DistributionState {
  const qs = new URLSearchParams(search);
  const d = DEFAULT_DISTRIBUTION_STATE;
  const teams: string[] = [];
  for (const c of (qs.get("teams") ?? "").split(",")) {
    const code = c.trim();
    if (code && ctx.teamCodes.includes(code) && !teams.includes(code)) teams.push(code);
  }
  const metric = SCATTER_METRICS.find((m) => m.param === qs.get("y"));
  const q = Number(qs.get("q"));
  const p = qs.get("p");
  return {
    teams: teams.slice(0, MAX_SELECTED_TEAMS),
    yKey: metric?.key ?? d.yKey,
    presetIdx: qs.has("q") && Number.isInteger(q) && q >= 0 && q < QUALIFY_PRESETS.length ? q : d.presetIdx,
    playerId: p && ctx.playerIds.has(p) ? p : null,
    position: positionFromParam(qs.get("pos")),
  };
}

/** 상태 → 쿼리 문자열 ("" 또는 "?...") */
export function distributionQueryString(s: DistributionState): string {
  const d = DEFAULT_DISTRIBUTION_STATE;
  const qs = new URLSearchParams();
  if (s.teams.length) qs.set("teams", s.teams.join(","));
  if (s.yKey !== d.yKey) qs.set("y", scatterMetric(s.yKey).param);
  if (s.presetIdx !== d.presetIdx) qs.set("q", String(s.presetIdx));
  if (s.position !== d.position) qs.set("pos", positionParam(s.position));
  if (s.playerId) qs.set("p", s.playerId);
  const str = qs.toString().replace(/%2C/g, ",");
  return str ? `?${str}` : "";
}

// ─────────────────────────────────────────────
// 표기
// ─────────────────────────────────────────────

const NF1 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 세로축 값 표기: 소수 1자리, TS% 는 "%" */
export function formatScatterY(v: number, key: ScatterYKey): string {
  if (!Number.isFinite(v)) return "–";
  return `${NF1.format(v)}${key === "tsPct" ? "%" : ""}`;
}

/** 경기당 출전시간 표기, 예: "31.2분" */
export function formatMinutes(v: number): string {
  return Number.isFinite(v) ? `${NF1.format(v)}분` : "–";
}

/** 의존도 비중 표기, 예: "62%" (null → "–") */
export function formatShare(v: number | null): string {
  return v === null || !Number.isFinite(v) ? "–" : `${Math.round(v)}%`;
}

// ─────────────────────────────────────────────
// 적용 중 필터 요약 칩 (디자인 점검 A2). 지표·팀은 항상 보이는 1차 컨트롤이라 칩에 넣지 않는다
// ─────────────────────────────────────────────

export type DistributionFilterField = "position" | "presetIdx";

/** 기본값 아닌 필터만 { field, label } 로 (lib/leaders leaderFilterChips 와 같은 형식) */
export function distributionFilterChips(s: DistributionState): { field: DistributionFilterField; label: string }[] {
  const d = DEFAULT_DISTRIBUTION_STATE;
  const out: { field: DistributionFilterField; label: string }[] = [];
  if (s.position !== d.position) out.push({ field: "position", label: positionFilterLabel(s.position) });
  if (s.presetIdx !== d.presetIdx) out.push({ field: "presetIdx", label: qualifyShort(QUALIFY_PRESETS[s.presetIdx]) });
  return out;
}

/** 칩의 ✕: 그 항목만 기본값으로 */
export function clearDistributionFilter(s: DistributionState, field: DistributionFilterField): DistributionState {
  return { ...s, [field]: DEFAULT_DISTRIBUTION_STATE[field] };
}
