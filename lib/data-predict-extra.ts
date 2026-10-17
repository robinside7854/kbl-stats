// 관전 포인트 재료 (2026-10-16) — 빌드 때 data/processed 를 읽는다(서버 전용). 규칙은 lib/games upcomingMatchups.
// 2026-10-17 사용자 결정으로 경기 승리 확률·예측 적중률 화면을 없앰(계산 lib/predict backtestSeason 은 테스트용으로 남김).
import { isSeasonOngoing, loadSeasonGames } from "./data";
import { teamGameAverages, upcomingMatchups, type MatchupEdge } from "./games";

/** 아직 안 한 경기의 관전 포인트 (진행 중 시즌만) */
export function loadMatchups(seasonCode: number): Record<string, MatchupEdge> {
  if (!isSeasonOngoing(seasonCode)) return {};
  const games = loadSeasonGames(seasonCode);
  return upcomingMatchups(games, teamGameAverages(games));
}
