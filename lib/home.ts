// 홈(/) "이번 시즌 한눈에" 규칙 — 순수 함수만 둔다. 부문 순위는 lib/leaders.ts topLeaders 를 그대로 쓴다.
import type { LeaderStatKey } from "./leaders";
import type { SeasonOption } from "./types";

/** 홈 부문별 1~3위 카드 (경기당, 기본 표본 기준). 순서 = 화면 순서 */
export const HOME_CATEGORIES: readonly LeaderStatKey[] = ["points", "reb", "ast", "stl", "blk"];

/** 부문 값 단위 (히어로 "경기당 23.2점"·카드 값 옆) */
export const HOME_UNITS: Partial<Record<LeaderStatKey, string>> = {
  points: "점",
  reb: "개",
  ast: "개",
  stl: "개",
  blk: "개",
};

export interface HomeSeasonPick {
  /** 홈에 보여줄 시즌 (선수가 있는 가장 최근 시즌). 선수 있는 시즌이 하나도 없으면 null */
  shown: SeasonOption | null;
  /** 코드표의 최신 시즌이 아직 선수 0명(개막 전)이면 그 시즌, 아니면 null */
  upcoming: SeasonOption | null;
}

/**
 * 홈 시즌 고르기. 시즌 코드를 박지 않고 코드표(seasons.json)의 최신 시즌과 "선수 있는 시즌" 목록을 비교한다.
 *  - all: 코드표 전체 시즌 (순서 무관), withPlayers: 선수 1명 이상 시즌 (순서 무관)
 *  - 코드표 최신 시즌이 선수 있는 시즌이면 → 그 시즌, 안내 없음
 *  - 아니면(개막 전) → 선수 있는 가장 최근 시즌 + upcoming = 코드표 최신 시즌
 */
export function pickHomeSeason(all: readonly SeasonOption[], withPlayers: readonly SeasonOption[]): HomeSeasonPick {
  const latestOf = (list: readonly SeasonOption[]) =>
    list.reduce<SeasonOption | null>((best, s) => (!best || s.seasonCode > best.seasonCode ? s : best), null);
  const shown = latestOf(withPlayers);
  const latest = latestOf(all);
  const upcoming = latest && (!shown || latest.seasonCode > shown.seasonCode) ? latest : null;
  return { shown, upcoming };
}

/** 시즌 목록을 최신순으로 나눠 앞 n개(기본 6)와 나머지로 */
export function splitRecentSeasons<T extends { seasonCode: number }>(list: readonly T[], n = 6): { recent: T[]; older: T[] } {
  const sorted = [...list].sort((a, b) => b.seasonCode - a.seasonCode);
  return { recent: sorted.slice(0, n), older: sorted.slice(n) };
}
