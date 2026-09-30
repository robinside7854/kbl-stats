// 선수 포지션·국적 구분 규칙과 비교 집단 필터 — 순수 함수만 둔다 (CLAUDE.md 원칙 5).
// 값의 출처는 서버 B 선수 마스터(data/raw/players/players.json) → scripts/player-master.ts 가 우리 값으로 바꾸고
// scripts/process.ts 가 players-index.json·시즌 players[] 에 넣는다. 화면은 여기 함수로 집단을 고른다.
// 마스터 파일이 없으면 포지션·국적은 null — 필터는 "전체" 외에는 그 선수를 빼고, 국적은 isForeign(이름 추정)으로 대신한다.

import type { Nationality, Position, PositionGroup } from "./types";

/** 포지션 한글 표기 (KBL 공홈 표기와 같다) */
export const POSITION_LABELS: Record<Position, string> = {
  G: "가드",
  F: "포워드",
  C: "센터",
  GF: "가드-포워드",
  FC: "포워드-센터",
};

/** 포지션 묶음 한글 표기 (필터 버튼) */
export const POSITION_GROUP_LABELS: Record<PositionGroup, string> = {
  G: "가드",
  F: "포워드",
  C: "센터",
};

/** 국적 구분 한글 표기 */
export const NATIONALITY_LABELS: Record<Nationality, string> = {
  domestic: "국내",
  foreign: "외국",
  asia: "아시아쿼터",
};

/** 포지션 → 한글 표기. null 이면 null */
export function positionLabel(pos: Position | null | undefined): string | null {
  return pos ? POSITION_LABELS[pos] : null;
}

/**
 * 포지션 → 비교용 묶음 (가드/포워드/센터 3개).
 * 규칙: **첫 글자 기준** — GF(가드-포워드) → G, FC(포워드-센터) → F.
 * 겸업 포지션은 KBL 표기에서 앞에 쓰인 쪽이 주 포지션이라 보고 그쪽 집단에 넣는다 (우리 규칙, KBL 공식 분류 아님).
 */
export function positionGroupOf(pos: Position | null | undefined): PositionGroup | null {
  if (!pos) return null;
  return pos[0] as PositionGroup;
}

// ─────────────────────────────────────────────
// 비교 집단 필터 — 순위·백분위·등급 함수(lib/metrics buildCardContext, lib/leaders rankMap 등)는
// "넘겨받은 선수 목록"을 집단으로 쓰므로, 화면은 이 필터 결과를 넘기기만 하면 된다.
// ─────────────────────────────────────────────

/** 포지션 필터 값: 전체 / 가드 / 포워드 / 센터 */
export type PositionFilter = "all" | PositionGroup;
/** 국적 필터 값: 전체 / 국내 / 외국 / 아시아쿼터 */
export type NationalityFilter = "all" | Nationality;

export const POSITION_FILTERS: readonly PositionFilter[] = ["all", "G", "F", "C"];
export const NATIONALITY_FILTERS: readonly NationalityFilter[] = ["all", "domestic", "foreign", "asia"];

/** "all" 이면 전 선수, 아니면 positionGroup 이 같은 선수만 (포지션 모름=null 인 선수는 빠진다) */
export function filterByPosition<T extends { positionGroup: PositionGroup | null }>(
  players: readonly T[],
  group: PositionFilter,
): T[] {
  if (group === "all") return [...players];
  return players.filter((p) => p.positionGroup === group);
}

/**
 * 선수의 국적 구분. 마스터 값(nationality)이 있으면 그대로,
 * 없으면(마스터 파일 없음·마스터에 없는 선수) 이름 추정 isForeign 으로 국내/외국 둘 중 하나 (아시아쿼터는 구분 불가).
 */
export function nationalityOf(p: { nationality: Nationality | null; isForeign: boolean }): Nationality {
  return p.nationality ?? (p.isForeign ? "foreign" : "domestic");
}

/** "all" 이면 전 선수, 아니면 nationalityOf 가 같은 선수만 */
export function filterByNationality<T extends { nationality: Nationality | null; isForeign: boolean }>(
  players: readonly T[],
  kind: NationalityFilter,
): T[] {
  if (kind === "all") return [...players];
  return players.filter((p) => nationalityOf(p) === kind);
}
