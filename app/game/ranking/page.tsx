// 54-0 주간 순위 (2026-10-05): 한국 시간 월~일 한 주, 회원마다 가장 좋은 판 하나. 순위는 브라우저가 /api/game/ranking 에서 받는다.
// 주소 ?week=last 면 지난주.
import type { Metadata } from "next";
import { ogImagePath, shareMetadata } from "@/lib/share";
import { listSeasonsWithPlayers, loadAccountTeams, loadSeasonData } from "@/lib/data";
import GameRankingView from "@/app/components/GameRankingView";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = shareMetadata({
  title: "54-0 주간 순위 · KBL - Stats Reference",
  description: "이번 주 54-0 최고 성적을 낸 팬들. 시대와 팀을 뽑아 주전 5명으로 54전 전승에 도전하세요.",
  path: "/game/ranking", image: ogImagePath.game(),
});

export default function GameRankingPage() {
  const seasons = listSeasonsWithPlayers();
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={seasons[0]?.seasonCode ?? 0} view="game" />
      <GameRankingView teams={loadAccountTeams()} />
      <SourceFooter fetchedAt={seasons[0] ? loadSeasonData(seasons[0].seasonCode)?.fetchedAt : undefined} />
    </>
  );
}
