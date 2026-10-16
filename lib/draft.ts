// 드래프트 연도별 결과 + 그 해 지명 선수들의 수상 합계 (기록 메뉴 "드래프트" 탭, /records/draft?year=2015) — 순수 함수만.
// 재료: 선수 색인의 draft {year, round, pick}(선수 마스터)·수상·우승 + 통산 합계(lib/data loadCareerTotals) → lib/data-history.
// 2026-10-16 사용자: "다시 뽑는다면" 순서는 없애고 그 해의 우승 횟수·챔프전 MVP 같은 수상 내용을 아이콘과 함께.
// 한계: 선수 색인은 KBL 정규시즌에 한 경기라도 뛴 선수만 있다 → 지명됐지만 못 뛴 선수는 목록에 없다.
import { AWARD_LABELS } from "./career";
import type { AwardKey, DraftInfo, PlayerAward } from "./types";

export interface DraftPick {
  id: string;
  round: number | null;
  pick: number | null;
  games: number;
  points: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
}

/** 지명 표기: "1라운드 3순위" (없는 쪽은 뺀다, 둘 다 없으면 "순위 미상") */
export function pickLabel(round: number | null, pick: number | null): string {
  const parts: string[] = [];
  if (round) parts.push(`${round}라운드`);
  if (pick) parts.push(`${pick}순위`);
  return parts.length ? parts.join(" ") : "순위 미상";
}

/** 짧은 지명 표기: "1-3" (라운드-순위, 폰 목록 왼쪽 칸) */
export function pickShort(round: number | null, pick: number | null): string {
  return round && pick ? `${round}-${pick}` : "–";
}

/** 실제 지명 순: 라운드 → 순위 (없으면 뒤) → 같은 칸(한 해 드래프트가 두 번 열린 경우)은 그대로 */
export function draftOrder<T extends Pick<DraftPick, "round" | "pick">>(rows: readonly T[]): T[] {
  const big = (v: number | null) => v ?? 999;
  return [...rows].sort((a, b) => big(a.round) - big(b.round) || big(a.pick) - big(b.pick));
}

export interface DraftHonorRow {
  key: AwardKey | "champion";
  label: string;
  /** 그 해 지명 선수들이 받은 횟수 합 (우승은 우승 시즌 수 합) */
  times: number;
  /** 받은 선수 (많이 받은 순 → 이름) */
  players: { id: string; nameKo: string; times: number }[];
}

/**
 * 그 해 드래프트 선수들의 수상 합계: 우승 → 정규리그 MVP → 챔프전 MVP → … (lib/career AWARD_LABELS 순서), 받은 것만.
 * 외국선수 MVP·올스타전 MVP 는 뺀다(드래프트 선수는 국내 선수, 올스타는 이벤트).
 */
export function draftClassHonors(
  entries: readonly { id: string; nameKo: string; awards?: readonly PlayerAward[] | null; championships?: readonly number[] | null }[],
): DraftHonorRow[] {
  const defs: { key: AwardKey | "champion"; label: string }[] = [
    { key: "champion", label: "우승" },
    ...AWARD_LABELS.filter((d) => d.key !== "foreignMvp" && d.key !== "allStarMvp").map((d) => ({ key: d.key, label: d.label })),
  ];
  const out: DraftHonorRow[] = [];
  for (const d of defs) {
    const players = entries
      .map((e) => ({
        id: e.id,
        nameKo: e.nameKo,
        times: d.key === "champion" ? new Set(e.championships ?? []).size : new Set((e.awards ?? []).filter((a) => a.key === d.key).map((a) => a.seasonCode)).size,
      }))
      .filter((p) => p.times > 0)
      .sort((a, b) => b.times - a.times || a.nameKo.localeCompare(b.nameKo, "ko"));
    if (players.length === 0) continue;
    out.push({ key: d.key, label: d.label, times: players.reduce((s, p) => s + p.times, 0), players });
  }
  return out;
}

/** 같은 라운드·순위가 둘 이상 있는가 (2012 처럼 한 해 드래프트가 두 번 열린 해) */
export function hasDuplicatePicks(rows: readonly Pick<DraftPick, "round" | "pick">[]): boolean {
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.round || !r.pick) continue;
    const k = `${r.round}-${r.pick}`;
    if (seen.has(k)) return true;
    seen.add(k);
  }
  return false;
}

/** 드래프트 기록이 있는 연도 (최신 먼저) */
export function draftYears(entries: readonly { draft: DraftInfo | null }[]): number[] {
  return [...new Set(entries.flatMap((e) => (e.draft ? [e.draft.year] : [])))].sort((a, b) => b - a);
}

/** 주소 ?year= → 연도. 목록에 없으면 기본값(최신) */
export function draftYearFromParam(raw: string | null, years: readonly number[]): number | null {
  const n = raw ? Number(raw) : NaN;
  if (Number.isInteger(n) && years.includes(n)) return n;
  return years[0] ?? null;
}

/** 그 해 드래프트 화면 주소 (선수 머리말 "드래프트" 글자가 여기로) */
export const draftYearHref = (year: number) => `/records/draft?year=${year}`;

/** 연도별 데이터 파일 주소 (app/records/draft/[file]/route.ts) */
export const draftYearUrl = (year: number) => `/records/draft/${year}.json`;
