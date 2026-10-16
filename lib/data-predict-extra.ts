// 우리 예측 적중률·관전 포인트 재료 (2026-10-16) — 빌드 때 data/processed 를 읽는다(서버 전용). 규칙은 lib/predict backtestSeason · lib/games upcomingMatchups.
// lib/data.ts 를 크게 고치지 않으려고 따로 둔 파일. 출발점(지난 시즌 능력치)은 loadSeasonPredictions 와 같다.
import { isSeasonOngoing, listSeasonsWithPlayers, loadSeasonData, loadSeasonGames } from "./data";
import { seasonShortLabel } from "./career";
import { teamGameAverages, upcomingMatchups, type MatchupEdge } from "./games";
import { backtestSeason, priorFromSeason, type PredictionRecord } from "./predict";

export interface SeasonPredictionRecord {
  seasonCode: number;
  /** "25-26" */
  seasonShort: string;
  ongoing: boolean;
  games: number;
  hits: number;
}

const recordCache = new Map<number, PredictionRecord | null>();

/** 시즌 전체를 "그날 전 정보만으로" 다시 예측한 결과. 끝난 경기가 없으면 null */
export function loadPredictionBacktest(seasonCode: number): PredictionRecord | null {
  if (recordCache.has(seasonCode)) return recordCache.get(seasonCode)!;
  const games = loadSeasonGames(seasonCode);
  let out: PredictionRecord | null = null;
  if (games.some((g) => g.ended)) {
    const prev = listSeasonsWithPlayers()
      .map((s) => s.seasonCode)
      .find((c) => c < seasonCode);
    const prior = prev !== undefined ? priorFromSeason(loadSeasonGames(prev)) : {};
    const r = backtestSeason(games, prior);
    out = r.games > 0 ? r : null;
  }
  recordCache.set(seasonCode, out);
  return out;
}

/** 적중 수만 (화면 한 줄용) */
export function loadPredictionRecord(seasonCode: number): SeasonPredictionRecord | null {
  const r = loadPredictionBacktest(seasonCode);
  const season = loadSeasonData(seasonCode);
  if (!r || !season) return null;
  return { seasonCode, seasonShort: seasonShortLabel(season.seasonLabel), ongoing: isSeasonOngoing(seasonCode), games: r.games, hits: r.hits };
}

/** 바로 전 시즌(선수 있는 시즌 순서) 적중 — 진행 중 시즌 옆에 참고로 */
export function loadPreviousPredictionRecord(seasonCode: number): SeasonPredictionRecord | null {
  const prev = listSeasonsWithPlayers()
    .map((s) => s.seasonCode)
    .find((c) => c < seasonCode);
  return prev !== undefined ? loadPredictionRecord(prev) : null;
}

/** 끝난 경기 gmkey → 경기 전 홈 승률 (일정 박스스코어 팝업 "경기 전 우리 예측") */
export function loadPastPicks(seasonCode: number): Record<string, number> {
  const r = loadPredictionBacktest(seasonCode);
  if (!r) return {};
  return Object.fromEntries(Object.entries(r.picks).map(([k, v]) => [k, v.homeProb]));
}

/** 아직 안 한 경기의 관전 포인트 (진행 중 시즌만) */
export function loadMatchups(seasonCode: number): Record<string, MatchupEdge> {
  if (!isSeasonOngoing(seasonCode)) return {};
  const games = loadSeasonGames(seasonCode);
  return upcomingMatchups(games, teamGameAverages(games));
}
