// 외국 선수 명예의 전당 (기록 메뉴 "외국 선수" 탭, /records/foreign) + 수상 칩 공용 — 순수 함수만.
// 재료는 선수 색인(수상·우승)과 통산 합계(lib/data loadCareerTotals) → lib/data-history loadForeignHall.
//
// 헌액 기준 (우리 규칙, KBL 공식 명예의 전당이 아님 — 2026-10-16 데이터로 맞춤: 30명):
//   ① 정규리그 MVP·외국선수 MVP·챔프전 MVP 중 하나라도 1회 이상
//   ② 또는 베스트5 2회 이상
//   ③ 또는 KBL 5시즌 이상 + 통산 5,000점 이상 (오래 꾸준히 뛴 선수)
// 대상: 국적 '외국'만. 아시아쿼터(2020-21~)는 국내 선수 자리를 나눠 쓰는 다른 제도라 뺀다.
import type { AwardKey, PlayerAward } from "./types";

export const HALL_RULE = {
  majorAwards: ["mvp", "foreignMvp", "finalsMvp"] as readonly AwardKey[],
  best5Min: 2,
  longSeasons: 5,
  longPoints: 5000,
} as const;

export type HallReason = "major" | "best5" | "long";

export const HALL_REASON_LABELS: Record<HallReason, string> = {
  major: "MVP 수상",
  best5: "베스트5 2회+",
  long: "5시즌 · 5,000점+",
};

export interface HallCandidate {
  id: string;
  seasons: number;
  games: number;
  points: number;
  awards: readonly PlayerAward[];
}

const countOf = (awards: readonly PlayerAward[], key: AwardKey) => new Set(awards.filter((a) => a.key === key).map((a) => a.seasonCode)).size;

/** 헌액 이유 (없으면 빈 배열 = 헌액 아님) */
export function hallReasons(c: HallCandidate): HallReason[] {
  const out: HallReason[] = [];
  if (HALL_RULE.majorAwards.some((k) => countOf(c.awards, k) > 0)) out.push("major");
  if (countOf(c.awards, "best5") >= HALL_RULE.best5Min) out.push("best5");
  if (c.seasons >= HALL_RULE.longSeasons && c.points >= HALL_RULE.longPoints) out.push("long");
  return out;
}

/** 큰 상 합계 (정규리그 MVP + 외국선수 MVP + 챔프전 MVP) — "수상순" 정렬의 첫 기준 */
export function majorAwardCount(awards: readonly PlayerAward[]): number {
  return HALL_RULE.majorAwards.reduce((n, k) => n + countOf(awards, k), 0);
}

export type HallSort = "points" | "awards" | "ppg";

export const HALL_SORTS: readonly { value: HallSort; label: string }[] = [
  { value: "points", label: "통산 득점" },
  { value: "awards", label: "수상" },
  { value: "ppg", label: "경기당 득점" },
];

export interface HallSortable {
  id: string;
  nameKo: string;
  games: number;
  points: number;
  awards: readonly PlayerAward[];
  championships: readonly number[];
}

/**
 * 정렬: 통산 득점 / 수상(큰 상 → 베스트5 → 우승 → 통산 득점) / 경기당 득점(통산 득점 ÷ 경기).
 * 같으면 통산 득점 → 이름순. 원본은 건드리지 않는다.
 */
export function sortHall<T extends HallSortable>(members: readonly T[], sort: HallSort): T[] {
  const ppg = (m: T) => (m.games > 0 ? m.points / m.games : 0);
  const keys = (m: T): number[] => {
    if (sort === "awards") return [majorAwardCount(m.awards), countOf(m.awards, "best5"), m.championships.length, m.points];
    if (sort === "ppg") return [ppg(m), m.points];
    return [m.points];
  };
  return [...members].sort((a, b) => {
    const ka = keys(a);
    const kb = keys(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i];
    return a.nameKo.localeCompare(b.nameKo, "ko");
  });
}

/** 수상 칩: 우승 → 정규리그 MVP → 외국선수 MVP → 챔프전 MVP → 베스트5 → 신인상. 받은 것만, 2회 이상이면 횟수 */
export interface HonorChip {
  key: AwardKey | "champion";
  label: string;
  /** 금색 강조 (우승·MVP) */
  gold: boolean;
}

const HONOR_ORDER: readonly { key: AwardKey; label: string; gold: boolean }[] = [
  { key: "mvp", label: "MVP", gold: true },
  { key: "foreignMvp", label: "외국선수 MVP", gold: true },
  { key: "finalsMvp", label: "챔프전 MVP", gold: true },
  { key: "best5", label: "베스트5", gold: false },
  { key: "rookie", label: "신인상", gold: false },
];

export function honorChips(awards: readonly PlayerAward[] | undefined, championships: readonly number[] | undefined): HonorChip[] {
  const out: HonorChip[] = [];
  const titles = new Set(championships ?? []).size;
  if (titles > 0) out.push({ key: "champion", label: titles > 1 ? `우승 ${titles}` : "우승", gold: true });
  for (const h of HONOR_ORDER) {
    const n = countOf(awards ?? [], h.key);
    if (n > 0) out.push({ key: h.key, label: n > 1 ? `${h.label} ${n}` : h.label, gold: h.gold });
  }
  return out;
}

// ─────────────────────────────────────────────
// 역대 외국 선수 한 시즌 — 경기당 득점 + 리바운드 + 어시스트 (우리 규칙)
// 카드 종합 점수는 그 시즌 안 백분위라 시즌끼리 비교가 안 된다 → 단순 합으로 세우되, 시대마다 외국 선수 규정(인원·키·출전 쿼터)이
// 달라 숫자를 그대로 비교하기는 어렵다고 화면에 적는다.
// ─────────────────────────────────────────────

export interface ForeignSeasonLine {
  id: string;
  seasonCode: number;
  games: number;
  points: number;
  reb: number;
  ast: number;
  /** 최소 경기 충족 + 끝난 시즌 (lib/records seasonBestMinGames 로 lib/data-history 가 정한다) */
  ok: boolean;
}

export interface RankedForeignSeason extends ForeignSeasonLine {
  rank: number;
  /** 경기당 득점 + 리바운드 + 어시스트 */
  value: number;
}

/** 자격 있는 줄만, 경기당 득+리+어 큰 순 (같은 값 = 같은 순위). 상위 limit 개 (경계 동률 포함) */
export function rankForeignSeasons(lines: readonly ForeignSeasonLine[], limit = 30): RankedForeignSeason[] {
  const rows = lines
    .filter((l) => l.ok && l.games > 0)
    .map((l) => ({ ...l, value: (l.points + l.reb + l.ast) / l.games }))
    .sort((a, b) => b.value - a.value || a.seasonCode - b.seasonCode);
  const out: RankedForeignSeason[] = [];
  rows.forEach((r, i) => {
    const rank = i > 0 && Math.abs(r.value - rows[i - 1].value) < 1e-9 ? out[i - 1].rank : i + 1;
    out.push({ ...r, rank });
  });
  return out.filter((r) => r.rank <= limit);
}
