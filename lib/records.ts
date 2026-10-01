// 역대 통산 순위 (Basketball-Reference "Career Leaders" 참고, 2026-10-01) — 순수 함수만.
// 재료: 1997 시즌부터 모든 정규시즌 시즌 파일의 선수 합계를 선수 번호로 더한 값(lib/data loadCareerTotals 가 만든다).
// 통산 경기당 = 통산 합계 ÷ 통산 경기. 경기당 순위는 통산 RECORDS_MIN_GAMES 경기 이상만(몇 경기 뛰고 끝난 선수가 위에 오지 않게 — 우리 규칙).
// KBL 이 발표하는 공식 통산 기록과 다를 수 있다(기록 정정 등) → 화면·용어에 안내.

import { perGame } from "./metrics";

export type RecordStatKey = "points" | "reb" | "ast" | "stl" | "blk" | "tpm" | "games" | "minutes";
export type RecordMode = "total" | "perGame";
export type RecordOrigin = "all" | "domestic" | "foreign";

export interface RecordStatDef {
  key: RecordStatKey;
  label: string;
  /** 값 단위 (예: "점") */
  unit: string;
  /** 경기당 모드가 의미 있는가 (경기 수는 아님) */
  perGame: boolean;
}

/** 배열 순서 = 부문 칩 순서 */
export const RECORD_STATS: readonly RecordStatDef[] = [
  { key: "points", label: "득점", unit: "점", perGame: true },
  { key: "reb", label: "리바운드", unit: "개", perGame: true },
  { key: "ast", label: "어시스트", unit: "개", perGame: true },
  { key: "stl", label: "스틸", unit: "개", perGame: true },
  { key: "blk", label: "블록", unit: "개", perGame: true },
  { key: "tpm", label: "3점 성공", unit: "개", perGame: true },
  { key: "games", label: "출전 경기", unit: "경기", perGame: false },
  { key: "minutes", label: "출전 시간", unit: "분", perGame: true },
];

/** 경기당 순위에 들어가는 최소 통산 경기 (정규시즌 54경기 × 약 4시즌) */
export const RECORDS_MIN_GAMES = 200;
/** 첫 화면에 보이는 순위 수 ("더 보기"로 늘린다) */
export const RECORDS_PAGE_SIZE = 50;

/** 선수 한 명의 통산 합계 (정규시즌) */
export interface CareerTotal {
  id: string;
  nameKo: string;
  photoUrl: string | null;
  origin: "domestic" | "foreign";
  /** 뛴 시즌 수 · 첫/마지막 시즌 라벨 ("1997" / "2025-2026") */
  seasons: number;
  firstLabel: string;
  lastLabel: string;
  /** 마지막으로 뛴 시즌 코드 — 현역 판정(isActiveCareer)에 쓴다 */
  lastSeasonCode: number;
  /** 마지막 시즌 팀 한글 약칭·색 */
  lastTeam: string;
  lastTeamColor: string;
  games: number;
  minutes: number;
  points: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tpm: number;
}

/** 시즌 합계 행들을 선수별로 더한다 (같은 선수의 여러 시즌 → 하나). 순서 무관 */
export function sumCareerTotals<T extends Omit<CareerTotal, "seasons" | "firstLabel" | "lastLabel" | "lastSeasonCode" | "lastTeam" | "lastTeamColor"> & { seasonCode: number; seasonLabel: string; teamShort: string; teamColor: string }>(
  rows: readonly T[],
): CareerTotal[] {
  const by = new Map<string, CareerTotal & { firstCode: number; lastCode: number }>();
  const add = ["games", "minutes", "points", "reb", "ast", "stl", "blk", "tpm"] as const;
  for (const r of rows) {
    const cur = by.get(r.id);
    if (!cur) {
      by.set(r.id, {
        id: r.id, nameKo: r.nameKo, photoUrl: r.photoUrl, origin: r.origin,
        seasons: 1, firstLabel: r.seasonLabel, lastLabel: r.seasonLabel, lastSeasonCode: r.seasonCode, lastTeam: r.teamShort, lastTeamColor: r.teamColor,
        firstCode: r.seasonCode, lastCode: r.seasonCode,
        games: r.games, minutes: r.minutes, points: r.points, reb: r.reb, ast: r.ast, stl: r.stl, blk: r.blk, tpm: r.tpm,
      });
      continue;
    }
    cur.seasons += 1;
    for (const k of add) cur[k] += r[k];
    if (r.seasonCode < cur.firstCode) {
      cur.firstCode = r.seasonCode;
      cur.firstLabel = r.seasonLabel;
    }
    if (r.seasonCode > cur.lastCode) {
      cur.lastCode = r.seasonCode;
      cur.lastLabel = r.seasonLabel;
      cur.lastSeasonCode = r.seasonCode;
      cur.lastTeam = r.teamShort;
      cur.lastTeamColor = r.teamColor;
      cur.nameKo = r.nameKo;
      cur.origin = r.origin;
    }
  }
  return [...by.values()].map(({ firstCode: _f, lastCode: _l, ...t }) => t);
}

/**
 * 현역 판정: 기록이 있는 가장 최근 시즌(latestSeasonCode — 코드표에서 선수 있는 최신 시즌)에 뛰었으면 현역.
 * 개막 전에는 직전 시즌 선수가 현역이다(은퇴 발표는 KBL 기록에 없어 다음 시즌 첫 경기 전까지는 구분하지 못한다).
 */
export function isActiveCareer(t: Pick<CareerTotal, "lastSeasonCode">, latestSeasonCode: number): boolean {
  return t.lastSeasonCode === latestSeasonCode;
}

/** 화면 값: 합계 그대로, 경기당은 통산 합계 ÷ 통산 경기 (경기 수 부문은 항상 합계) */
export function recordValue(t: CareerTotal, key: RecordStatKey, mode: RecordMode): number {
  if (mode === "perGame" && key !== "games") return perGame(t[key], t.games);
  return t[key];
}

export interface RecordRow {
  rank: number;
  total: CareerTotal;
  value: number;
}

/**
 * 통산 순위: 국적·현역 필터 → (경기당이면 RECORDS_MIN_GAMES 경기 이상) → 값 큰 순.
 * 같은 값은 같은 순위(1, 2, 2, 4), 같은 값 안에서는 경기 많은 순 → 이름순.
 */
export function rankCareerTotals(
  totals: readonly CareerTotal[],
  key: RecordStatKey,
  mode: RecordMode,
  origin: RecordOrigin,
  /** 주면 그 시즌에 뛴 선수(현역, isActiveCareer)만 — 순위도 현역끼리 다시 매긴다 */
  activeSeasonCode?: number,
): RecordRow[] {
  const effMode: RecordMode = key === "games" ? "total" : mode;
  const pool = totals.filter(
    (t) =>
      (origin === "all" || t.origin === origin) &&
      (activeSeasonCode === undefined || isActiveCareer(t, activeSeasonCode)) &&
      (effMode === "total" || t.games >= RECORDS_MIN_GAMES) &&
      t[key] > 0,
  );
  const sorted = pool
    .map((t) => ({ total: t, value: recordValue(t, key, effMode) }))
    .sort((a, b) => b.value - a.value || b.total.games - a.total.games || a.total.nameKo.localeCompare(b.total.nameKo, "ko") || a.total.id.localeCompare(b.total.id));
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || r.value !== sorted[i - 1].value) rank = i + 1;
    return { rank, ...r };
  });
}

const NF0 = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 표기: 합계는 정수(천 단위 쉼표), 경기당은 소수 1자리 */
export function formatRecord(value: number, key: RecordStatKey, mode: RecordMode): string {
  return mode === "perGame" && key !== "games" ? NF1.format(value) : NF0.format(Math.round(value));
}
