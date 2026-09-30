// 시즌 페이지 공통 서버 컴포넌트: 빌드 시점에 JSON을 읽고, 필요한 필드만 클라이언트로 넘긴다.
import { notFound } from "next/navigation";
import { listSeasonsWithPlayers, loadSeasonData, toCardPlayers, toCardTeams } from "@/lib/data";
import CardExplorer from "./CardExplorer";
import SiteNav from "./SiteNav";
import SourceFooter from "./SourceFooter";

export default function SeasonView({ seasonCode }: { seasonCode: number }) {
  const season = loadSeasonData(seasonCode);
  if (!season || season.players.length === 0) notFound();
  const seasons = listSeasonsWithPlayers();
  const players = toCardPlayers(season);
  const teams = toCardTeams(season);

  return (
    <>
      <SiteNav seasons={seasons} seasonCode={season.seasonCode} view="radar" />
      <CardExplorer
        seasonLabel={season.seasonLabel}
        players={players}
        teams={teams}
        coverage={season.coverage}
      />
      <SourceFooter fetchedAt={season.fetchedAt} />
    </>
  );
}
