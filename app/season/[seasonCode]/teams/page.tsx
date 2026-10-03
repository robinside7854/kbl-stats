// 팀 순위 정적 페이지 (2026-10-03 사용자 요청: 모바일 하단 메뉴 "팀"). 시즌마다 경기 목록 결과로 센 순위 — lib/games computeStandings.
// 경기 목록(games.json)이 있는 시즌만 내용이 있고, 없으면 빈 안내.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isSeasonOngoing, listSeasonsWithPlayers, loadSeasonData, loadSeasonGames, toCardTeams } from "@/lib/data";
import { computeStandings } from "@/lib/games";
import { seasonShortLabel } from "@/lib/career";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";
import StandingsView, { type StandingTeam } from "@/app/components/StandingsView";

export const dynamicParams = false;

export function generateStaticParams() {
  return listSeasonsWithPlayers().map((s) => ({ seasonCode: String(s.seasonCode) }));
}

type Params = Promise<{ seasonCode: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { seasonCode } = await params;
  const season = loadSeasonData(Number(seasonCode));
  return {
    title: season ? `${seasonShortLabel(season.seasonLabel)} 팀 순위 · KBL` : "KBL 팀 순위",
    description: "KBL 정규시즌 팀 순위: 승·패·승률·승차·홈/원정·최근 5경기. 비영리 팬 프로젝트.",
  };
}

export default async function TeamsPage({ params }: { params: Params }) {
  const { seasonCode } = await params;
  const code = Number(seasonCode);
  const season = loadSeasonData(code);
  if (!season || season.players.length === 0) notFound();

  const teams: Record<string, StandingTeam> = {};
  for (const t of toCardTeams(season)) teams[t.teamCode] = { shortName: t.shortName, logoUrl: t.logoUrl, color: t.color };

  return (
    <>
      <SiteNav seasons={listSeasonsWithPlayers()} seasonCode={code} view="teams" />
      <StandingsView
        seasonCode={code}
        seasonShort={seasonShortLabel(season.seasonLabel)}
        rows={computeStandings(loadSeasonGames(code))}
        teams={teams}
        championCode={season.champion?.teamCode ?? null}
        ongoing={isSeasonOngoing(code)}
      />
      <SourceFooter fetchedAt={season.fetchedAt} />
    </>
  );
}
