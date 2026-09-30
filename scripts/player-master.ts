// 선수 마스터(서버 B /api/v1/players) raw → 우리 프로필 필드 변환 — 순수 함수만 (process.ts·테스트가 쓴다).
// KBL 원본 필드명(pos, playerFlagCode2, pHeight …)은 이 파일에서만 다룬다 (CLAUDE.md 코딩 규칙).
// raw 파일 형태: fetch.ts 가 저장한 "페이지 응답 배열" [{ totalCn, playerList: [...] }, ...]
//   (응답이 JSON 문자열로 한 번 더 감싸져 있어도 풀어 읽는다 — teams.json 에서 실제로 있었던 일)

import { positionGroupOf, positionLabel } from "../lib/roster.js";
import type { DraftInfo, Nationality, PlayerProfile, Position } from "../lib/types.js";

type Raw = Record<string, any>;

/** 모든 프로필 필드가 null 인 값 — 마스터 파일이 없거나 마스터에 없는 선수 */
export const EMPTY_PROFILE: PlayerProfile = {
  position: null,
  positionLabel: null,
  positionGroup: null,
  nationality: null,
  heightCm: null,
  weightKg: null,
  backNumber: null,
  draft: null,
};

const unwrap = (v: unknown): unknown => {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

/**
 * raw 파일 내용(JSON.parse 결과) → 선수 행 배열.
 * 페이지 배열 / 단일 페이지 객체 / 문자열로 감싼 것 모두 받는다. 모르는 형태면 빈 배열.
 */
export function masterRows(parsed: unknown): Raw[] {
  const top = unwrap(parsed);
  const pages = Array.isArray(top) ? top : [top];
  const rows: Raw[] = [];
  for (const page of pages.map(unwrap)) {
    const list = (page as Raw | null)?.playerList;
    if (Array.isArray(list)) rows.push(...list.filter((r) => r && typeof r === "object"));
  }
  return rows;
}

/** KBL pos 코드 → 우리 포지션 (GD 가드, FD 포워드, C 센터, GF 가드-포워드, FC 포워드-센터). 모르는 값은 null */
const POS_CODES: Record<string, Position> = { GD: "G", FD: "F", C: "C", GF: "GF", FC: "FC" };
export function mapPosition(code: unknown): Position | null {
  return POS_CODES[String(code ?? "").trim().toUpperCase()] ?? null;
}

/** KBL playerFlagCode2 → 국적 구분 ("0" 국내, "1" 외국, "2" 아시아쿼터). 모르는 값은 null */
const FLAG_CODES: Record<string, Nationality> = { "0": "domestic", "1": "foreign", "2": "asia" };
export function mapNationality(code: unknown): Nationality | null {
  return FLAG_CODES[String(code ?? "").trim()] ?? null;
}

/** 양수만 숫자로 (0·빈 값·숫자 아님 → null) */
function positive(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 드래프트: 연도가 없으면(외국 선수 등) null */
export function mapDraft(r: Raw): DraftInfo | null {
  const year = positive(r.yearNo);
  if (year === null) return null;
  return { year, round: positive(r.roundNo), pick: positive(r.rankNo) };
}

/** 마스터 한 행 → 프로필 */
export function toProfile(r: Raw): PlayerProfile {
  const position = mapPosition(r.pos);
  const back = r.backNum === null || r.backNum === undefined ? "" : String(r.backNum).trim();
  return {
    position,
    positionLabel: positionLabel(position),
    positionGroup: positionGroupOf(position),
    nationality: mapNationality(r.playerFlagCode2),
    heightCm: positive(r.pHeight),
    weightKg: positive(r.pWeight),
    backNumber: back || null,
    draft: mapDraft(r),
  };
}

/** raw 파일 내용 → playerNo(문자열) → 프로필. 같은 번호가 여러 번 나오면 먼저 나온 행 */
export function buildProfileMap(parsed: unknown): Map<string, PlayerProfile> {
  const out = new Map<string, PlayerProfile>();
  for (const r of masterRows(parsed)) {
    const no = String(r.playerNo ?? "").trim();
    if (no && !out.has(no)) out.set(no, toProfile(r));
  }
  return out;
}

/**
 * 외국 선수 여부. 마스터 국적이 있으면 nationality !== "domestic" (외국·아시아쿼터 모두 true),
 * 없으면 이름으로 추정 — 한글 2~4자이고 공백이 없으면 국내, 그 외(공백 포함 음역 이름)는 외국.
 * 이름 추정의 예외: 귀화·혼혈 선수(라건아 등)는 한글 3자라 국내로 분류된다 → 마스터가 생기면 해결.
 */
export function isForeignPlayer(nationality: Nationality | null, nameKo: string): boolean {
  if (nationality) return nationality !== "domestic";
  return !/^[가-힣]{2,4}$/.test(nameKo.trim());
}
