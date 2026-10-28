// 54-0 결과 공유 페이지·미리보기 그림이 같이 쓰는 재료 (2026-10-27): 주소 칸 → 다섯 명 + 팀 + 시즌 성적.
// 성적은 늘 서버가 라인업으로 다시 계산한다(주소에 승수를 넣지 않는다 — 아무 숫자나 적어 자랑하는 것을 막는다).
import "server-only";
import { decodeLineupParam, findCandidateTeam, simulateSeason, type GameCandidate, type GameTeam, type SeasonResult } from "../game";
import { slugToLineup } from "../game-share";
import { SITE_URL } from "../share";
import { loadGamePoolForPage } from "./game-pool";

export interface SharedGameResult {
  lineup: string;
  players: { c: GameCandidate; team: GameTeam | null }[];
  result: SeasonResult;
}

export async function loadSharedGameResult(slug: string): Promise<SharedGameResult | null> {
  const lineup = slugToLineup(slug);
  if (!lineup) return null;
  const pool = await loadGamePoolForPage(SITE_URL);
  if (!pool) return null;
  const players = decodeLineupParam(pool, lineup);
  if (!players) return null;
  return { lineup, players: players.map((c) => ({ c, team: findCandidateTeam(pool, c) })), result: simulateSeason(players) };
}
