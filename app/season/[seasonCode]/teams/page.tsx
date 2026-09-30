// 팀별 선수 분포 (PLAN.md §2-3, §3 ④). 빌드 시점에 JSON을 읽어 순위표와 같은 최소 필드(LeaderPlayer)만 넘긴다.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listSeasonsWithPlayers, loadSeasonData, toCardTeams, toLeaderPlayers } from "@/lib/data";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";
import TeamsView from "@/app/components/TeamsView";

// 빌드 때 만든 시즌 외에는 404 (선수 0명 시즌 포함)
export const dynamicParams = false;

export function generateStaticParams() {
  return listSeasonsWithPlayers().map((s) => ({ seasonCode: String(s.seasonCode) }));
}

type Params = Promise<{ seasonCode: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { seasonCode } = await params;
  const season = loadSeasonData(Number(seasonCode));
  return {
    title: season ? `${season.seasonLabel} 팀별 선수 분포 · KBL` : "KBL 팀별 선수 분포",
    description: "KBL 정규시즌 선수들의 출전시간과 생산성(PER·TS%·득점)을 팀별로 한 장의 산점도에. 팀별 핵심 의존도. 비영리 팬 프로젝트.",
  };
}

export default async function TeamsPage({ params }: { params: Params }) {
  const { seasonCode } = await params;
  const season = loadSeasonData(Number(seasonCode));
  if (!season || season.players.length === 0) notFound();

  return (
    <>
      <SiteNav seasons={listSeasonsWithPlayers()} seasonCode={season.seasonCode} view="teams" wide />
      <TeamsView seasonLabel={season.seasonLabel} players={toLeaderPlayers(season)} teams={toCardTeams(season)} />
      <SourceFooter fetchedAt={season.fetchedAt} wide />
    </>
  );
}
