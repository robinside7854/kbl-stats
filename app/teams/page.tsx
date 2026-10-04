// 모든 팀 (2026-10-04, 메뉴 "팀"): 지금 리그 팀(이번 시즌 성적) + 추억의 팀(매각·해체로 코드가 끝난 팀). 팀 카드 → /team/코드.
import type { Metadata } from "next";
import { shareMetadata } from "@/lib/share";
import { computeStandings } from "@/lib/games";
import { seasonShortLabel } from "@/lib/career";
import { listSeasonsWithPlayers, loadSeasonData, loadSeasonGames, loadTeamIndex } from "@/lib/data";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";
import TeamsIndexView from "@/app/components/TeamsIndexView";

export const metadata: Metadata = shareMetadata({
  title: "KBL 팀 · 지금 팀과 추억의 팀",
  description: "KBL 모든 팀의 역대 성적·우승·레전드. 기아·SBS·나래·대우 같은 추억의 팀까지. 비영리 팬 프로젝트.",
  path: "/teams",
});

export default function TeamsPage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0];
  const standings = latest ? computeStandings(loadSeasonGames(latest.seasonCode)) : [];
  const records = Object.fromEntries(standings.map((r) => [r.teamCode, { wins: r.wins, losses: r.losses, rank: r.rank }]));
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest?.seasonCode ?? 0} view="team" />
      <TeamsIndexView
        teams={loadTeamIndex()}
        seasonCode={latest?.seasonCode ?? 0}
        seasonShort={latest ? seasonShortLabel(loadSeasonData(latest.seasonCode)?.seasonLabel ?? latest.seasonLabel) : ""}
        records={records}
      />
      <SourceFooter />
    </>
  );
}
