// 드래프트 연도별 결과 + "다시 뽑는다면" (기록 메뉴 "드래프트" 탭, /records/draft?year=2015) — 순수 함수만.
// 재료: 선수 색인의 draft {year, round, pick}(선수 마스터)·수상·우승 + 통산 합계(lib/data loadCareerTotals) → lib/data-history.
//
// 다시 뽑기 규칙 (우리 규칙): 통산 정규시즌 득점 + 리바운드 + 어시스트 + 스틸 + 블록 합계가 큰 순.
// 같으면 경기 많은 순 → 실제 지명 순. 누적 합이라 오래 뛴 선수가 앞선다(전성기 길이도 지명 가치라고 본다).
// 한계: 선수 색인은 KBL 정규시즌에 한 경기라도 뛴 선수만 있다 → 지명됐지만 못 뛴 선수는 목록에 없다.
import type { DraftInfo } from "./types";

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

/** 다시 뽑기 점수 = 통산 득점 + 리바운드 + 어시스트 + 스틸 + 블록 */
export function redraftScore(p: Pick<DraftPick, "points" | "reb" | "ast" | "stl" | "blk">): number {
  return p.points + p.reb + p.ast + p.stl + p.blk;
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

export interface RedraftRow<T> {
  row: T;
  /** 실제 지명 순서 (이 목록 안, 1부터) */
  actual: number;
  /** 다시 뽑으면 몇 번째 (1부터) */
  redraft: number;
  /** 실제 → 다시 뽑기 이동 (+ 면 위로 올라감) */
  move: number;
  score: number;
}

/** 다시 뽑기 순서: 점수 큰 순 → 경기 많은 순 → 실제 지명 순 */
export function redraftOrder<T extends DraftPick>(rows: readonly T[]): RedraftRow<T>[] {
  const actualOrder = draftOrder(rows);
  const actualOf = new Map(actualOrder.map((r, i) => [r, i + 1]));
  const sorted = [...actualOrder].sort((a, b) => redraftScore(b) - redraftScore(a) || b.games - a.games || actualOf.get(a)! - actualOf.get(b)!);
  return sorted.map((row, i) => {
    const actual = actualOf.get(row)!;
    return { row, actual, redraft: i + 1, move: actual - (i + 1), score: redraftScore(row) };
  });
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
