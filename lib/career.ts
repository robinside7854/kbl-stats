// 선수 페이지(/player/[선수번호])의 표기·추이 규칙 — 순수 함수만 둔다 (CLAUDE.md 원칙 5).
// 통산 경기당 계산은 lib/metrics.ts careerSummary, 경기당 환산은 metrics.perGame 을 쓴다.

import { perGame } from "./metrics";

// ─────────────────────────────────────────────
// 시즌 표기
// ─────────────────────────────────────────────

/**
 * 시즌 짧은 표기: "2025-2026" → "2025-26", "1997" → "1997".
 * 시즌 라벨은 코드표(seasons.json)에서 온 값이라 형식만 바꾼다 (시즌 코드로 연도를 추측하지 않는다).
 */
export function seasonShortLabel(label: string): string {
  const m = /^(\d{4})-(\d{4})$/.exec(label.trim());
  return m ? `${m[1]}-${m[2].slice(2)}` : label.trim();
}

/** 그래프 가로축용 더 짧은 표기: "2025-2026" → "25-26", "1997" → "97" */
export function seasonTickLabel(label: string): string {
  const m = /^(\d{4})(?:-(\d{4}))?$/.exec(label.trim());
  if (!m) return label.trim();
  return m[2] ? `${m[1].slice(2)}-${m[2].slice(2)}` : m[1].slice(2);
}

/** 활동 기간: "2019-20 ~ 2025-26 · 7시즌" (한 시즌이면 "2025-26 · 1시즌"). 라벨은 짧은 표기로 바꿔 쓴다 */
export function activeSpanLabel(firstLabel: string, lastLabel: string, seasonCount: number): string {
  const a = seasonShortLabel(firstLabel);
  const b = seasonShortLabel(lastLabel);
  return `${a === b ? a : `${a} ~ ${b}`} · ${seasonCount}시즌`;
}

// ─────────────────────────────────────────────
// 소속 팀 이력
// ─────────────────────────────────────────────

export interface TeamStint {
  teamCode: string;
  /** 첫·마지막 시즌 라벨 (원래 표기) */
  fromLabel: string;
  toLabel: string;
  seasons: number;
}

/**
 * 시즌 오름차순 목록 → 연속으로 같은 팀이었던 구간. 팀이 바뀌었다가 돌아오면 별도 구간.
 * 예: SK, SK, 삼성, SK → [SK 2시즌, 삼성 1시즌, SK 1시즌]
 */
export function teamStints(seasons: readonly { teamCode: string; seasonLabel: string }[]): TeamStint[] {
  const out: TeamStint[] = [];
  for (const s of seasons) {
    const last = out[out.length - 1];
    if (last && last.teamCode === s.teamCode) {
      last.toLabel = s.seasonLabel;
      last.seasons++;
    } else {
      out.push({ teamCode: s.teamCode, fromLabel: s.seasonLabel, toLabel: s.seasonLabel, seasons: 1 });
    }
  }
  return out;
}

/** 이전 시즌과 팀이 다른 시즌인가 (첫 시즌은 false). 추이 그래프에서 "이적" 표시에 쓴다 */
export function teamChangedAt(seasons: readonly { teamCode: string }[], i: number): boolean {
  return i > 0 && seasons[i].teamCode !== seasons[i - 1].teamCode;
}

// ─────────────────────────────────────────────
// 시즌별 추이 그래프 지표
// ─────────────────────────────────────────────

export type TrendKey = "points" | "reb" | "ast" | "stl" | "blk" | "fgPct" | "tpPct" | "per";

export interface TrendMetric {
  key: TrendKey;
  /** 전환 버튼 표기 */
  label: string;
  /** 그래프 제목·툴팁 표기 */
  title: string;
  /** perGame: 시즌 누적 ÷ 경기 / pct: KBL 계산 비율(%) 그대로 / index: KBL 계산 지수(PER) 그대로 */
  kind: "perGame" | "pct" | "index";
}

/**
 * 전환 버튼 순서 = 배열 순서. 첫 번째가 기본값.
 * 2026-09-30 사용자 피드백: 스틸·블록 추가, TS% 대신 3점% (팬이 바로 읽는 기록 위주).
 */
export const TREND_METRICS: readonly TrendMetric[] = [
  { key: "points", label: "득점", title: "경기당 득점", kind: "perGame" },
  { key: "reb", label: "리바운드", title: "경기당 리바운드", kind: "perGame" },
  { key: "ast", label: "어시스트", title: "경기당 어시스트", kind: "perGame" },
  { key: "stl", label: "스틸", title: "경기당 스틸", kind: "perGame" },
  { key: "blk", label: "블록", title: "경기당 블록", kind: "perGame" },
  { key: "fgPct", label: "야투%", title: "야투 성공률", kind: "pct" },
  { key: "tpPct", label: "3점%", title: "3점 성공률", kind: "pct" },
  { key: "per", label: "PER", title: "PER (생산성 지수)", kind: "index" },
];

export interface TrendInput {
  games: number;
  points: number; reb: number; ast: number; stl: number; blk: number; // 시즌 누적
  fgPct: number; tpPct: number; per: number; // KBL 계산값
}

/** 그 시즌의 지표 값: 누적은 경기당(perGame), 비율·지수는 그대로 */
export function trendValue(s: TrendInput, key: TrendKey): number {
  const m = TREND_METRICS.find((t) => t.key === key)!;
  return m.kind === "perGame" ? perGame(s[key], s.games) : s[key];
}

const NF1 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 추이 값 표기: 소수 한 자리, 비율은 "%" */
export function formatTrend(value: number, key: TrendKey): string {
  if (!Number.isFinite(value)) return "–";
  const m = TREND_METRICS.find((t) => t.key === key)!;
  return `${NF1.format(value)}${m.kind === "pct" ? "%" : ""}`;
}

export interface TrendRow {
  seasonCode: number;
  seasonLabel: string;
  /** 그 시즌 값. 그 시즌에 뛰지 않았으면 null (선이 끊긴다) */
  value: number | null;
  /** 그 시즌 팀 코드 (뛰지 않은 시즌은 null) */
  teamCode: string | null;
  games: number;
  /** 직전에 뛴 시즌과 팀이 다르면 true */
  teamChanged: boolean;
}

/**
 * 추이 그래프 행: 첫 시즌부터 마지막 시즌까지 코드표 시즌을 빠짐없이 깔고(군 복무 등 빈 시즌은 value=null),
 * 뛴 시즌에는 지표 값을 넣는다. allSeasons 는 코드표 시즌 목록(순서 무관), career 는 선수 시즌 기록(순서 무관).
 */
export function trendRows<T extends TrendInput & { seasonCode: number; seasonLabel: string; teamCode: string }>(
  career: readonly T[],
  allSeasons: readonly { seasonCode: number; seasonLabel: string }[],
  key: TrendKey,
): TrendRow[] {
  if (career.length === 0) return [];
  const played = new Map(career.map((s) => [s.seasonCode, s]));
  const codes = career.map((s) => s.seasonCode);
  const first = Math.min(...codes);
  const last = Math.max(...codes);
  const labels = new Map(allSeasons.map((s) => [s.seasonCode, s.seasonLabel]));
  for (const s of career) labels.set(s.seasonCode, s.seasonLabel);
  const span = [...labels.keys()].filter((c) => c >= first && c <= last).sort((a, b) => a - b);
  let prevTeam: string | null = null;
  return span.map((code) => {
    const s = played.get(code);
    const teamChanged = !!s && prevTeam !== null && s.teamCode !== prevTeam;
    if (s) prevTeam = s.teamCode;
    return {
      seasonCode: code,
      seasonLabel: labels.get(code)!,
      value: s ? trendValue(s, key) : null,
      teamCode: s ? s.teamCode : null,
      games: s ? s.games : 0,
      teamChanged,
    };
  });
}

// ─────────────────────────────────────────────
// 선수 프로필 (히어로의 포지션·키·몸무게·등번호·드래프트) — 값은 선수 마스터(lib/types PlayerProfile)
// ─────────────────────────────────────────────

export interface ProfileFact {
  label: string;
  value: string;
}

/**
 * 프로필 한 줄씩: 포지션 · 키 · 몸무게 · 등번호 · 드래프트. 값이 없는 항목은 뺀다.
 * 드래프트 표기: "2015 1라운드 3순위" (라운드·순위가 없으면 있는 것만). 등번호는 "0"과 "00"을 구분하려고 문자열 그대로.
 */
export function profileFacts(p: {
  positionLabel: string | null;
  heightCm: number | null;
  weightKg: number | null;
  backNumber: string | null;
  draft: { year: number; round: number | null; pick: number | null } | null;
}): ProfileFact[] {
  const out: ProfileFact[] = [];
  if (p.positionLabel) out.push({ label: "포지션", value: p.positionLabel });
  if (p.heightCm) out.push({ label: "키", value: `${p.heightCm}cm` });
  if (p.weightKg) out.push({ label: "몸무게", value: `${p.weightKg}kg` });
  if (p.backNumber) out.push({ label: "등번호", value: `#${p.backNumber}` });
  if (p.draft) {
    const parts = [`${p.draft.year}`];
    if (p.draft.round) parts.push(`${p.draft.round}라운드`);
    if (p.draft.pick) parts.push(`${p.draft.pick}순위`);
    out.push({ label: "드래프트", value: parts.join(" ") });
  }
  return out;
}
