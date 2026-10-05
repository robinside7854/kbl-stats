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

// ─────────────────────────────────────────────
// 주소 쿼리 값 (순위표 ?pos=&origin=, 선수 탭, 팀 분포가 같은 표기를 쓴다)
// ─────────────────────────────────────────────

const POSITION_PARAM: Record<PositionFilter, string> = { all: "all", G: "g", F: "f", C: "c" };
const NATIONALITY_PARAM: Record<NationalityFilter, string> = { all: "all", domestic: "dom", foreign: "for", asia: "asia" };

/** 포지션 필터 → 쿼리 값 (g/f/c, 전체는 "all") */
export const positionParam = (f: PositionFilter) => POSITION_PARAM[f];
/** 국적 필터 → 쿼리 값 (dom/for/asia, 전체는 "all") */
export const nationalityParam = (f: NationalityFilter) => NATIONALITY_PARAM[f];

/** 쿼리 값 → 포지션 필터. 모르는 값·없음이면 "all" */
export function positionFromParam(v: string | null | undefined): PositionFilter {
  return POSITION_FILTERS.find((k) => POSITION_PARAM[k] === v) ?? "all";
}

/** 쿼리 값 → 국적 필터. 모르는 값·없음이면 "all" */
export function nationalityFromParam(v: string | null | undefined): NationalityFilter {
  return NATIONALITY_FILTERS.find((k) => NATIONALITY_PARAM[k] === v) ?? "all";
}

/** 필터 버튼 표기: "all" → "전체", 나머지는 한글 이름 */
export const positionFilterLabel = (f: PositionFilter) => (f === "all" ? "전체" : POSITION_GROUP_LABELS[f]);
export const nationalityFilterLabel = (f: NationalityFilter) => (f === "all" ? "전체" : NATIONALITY_LABELS[f]);

// ─────────────────────────────────────────────
// 출신교 (선수 탭 "출신교" 필터, 2026-10-02 사용자 요청) — 프로필 API univSch 원문은 표기가 제각각이라 묶어서 쓴다
// ─────────────────────────────────────────────

/** 해외 학교 묶음 이름 (외국·아시아쿼터 선수, 또는 영문 학교명) */
export const SCHOOL_ABROAD = "해외";

/**
 * 출신교 원문 → 묶음 이름. 공백 제거, "○○대학교" → "○○대", 뒤에 붙은 "중퇴"·"2군" 제거.
 * 예: "중앙 대학교"·"중앙대학교" → "중앙대", "명지대중퇴" → "명지대". 외국인이거나 영문이면 SCHOOL_ABROAD. 없으면 null.
 */
export function schoolGroupOf(raw: string | null | undefined, foreign: boolean): string | null {
  const s = (raw ?? "").replace(/\s+/g, "").replace(/(중퇴|2군)$/u, "").replace(/대학교$/u, "대");
  if (!s) return null;
  if (foreign || /[A-Za-z]/.test(s)) return SCHOOL_ABROAD;
  return s;
}

// ─────────────────────────────────────────────
// 현역·미등록·은퇴 (2026-10-06 사용자 결정)
// ─────────────────────────────────────────────
// 재료: KBL 현역 등록 명단(서버 B 선수 마스터 regSc=Y, data/raw/players/active.json — 매일 수집 안에서 주 1회 확인).
// 명단에 없다고 은퇴는 아니다(2026-10-05 조사: 25-26 에 뛰고 미등록 44명 — 군 복무·FA·부상 등, 반대로 3~4시즌 쉬다 다시
// 등록된 선수 14명). 그래서 "최근 3시즌(기록 있는 최신 시즌 포함) 동안 기록이 없고 명단에도 없음"일 때만 은퇴로 본다.

/** 현역(명단에 있음) · 미등록(명단에 없고 최근에 뛰었음) · 은퇴(국내) · KBL 떠남(외국 선수) */
export type RosterStatus = "active" | "unregistered" | "retired" | "left";

/** 이 시즌 수 동안(기록 있는 최신 시즌 포함) 기록이 없고 명단에도 없으면 은퇴 */
export const ROSTER_RETIRE_SEASONS = 3;

export const ROSTER_STATUS_LABELS: Record<RosterStatus, string> = {
  active: "현역",
  unregistered: "미등록",
  retired: "은퇴",
  left: "KBL 떠남",
};

/**
 * 한 선수의 상태.
 * @param registered 지금 등록 명단에 있는지
 * @param lastSeasonCode 마지막으로 뛴 시즌 코드
 * @param seasonCodes 선수가 있는 시즌 코드 전부 (순서 무관 — 시즌 코드는 홀수로 띄엄띄엄 늘어서 차이 대신 순번으로 센다)
 */
export function rosterStatusOf(
  registered: boolean,
  lastSeasonCode: number,
  seasonCodes: readonly number[],
  nationality: Nationality,
): RosterStatus {
  if (registered) return "active";
  const recent = [...seasonCodes].sort((a, b) => b - a).slice(0, ROSTER_RETIRE_SEASONS);
  if (recent.length === 0 || lastSeasonCode >= recent[recent.length - 1]) return "unregistered";
  return nationality === "domestic" ? "retired" : "left";
}
