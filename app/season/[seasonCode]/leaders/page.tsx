// 시즌 순위표 (PLAN.md §2-1). 빌드 시점에 JSON을 읽어 순위표에 필요한 필드만 클라이언트로 넘긴다.
// 시즌 어워즈는 2026-10-06 "기록" 메뉴 수상 탭(/records/awards)으로 옮김. "이 시즌 한 경기 최다" 카드도 여기서 만들어 넘긴다 (lib/data loadSeasonHighCards — 데이터 없으면 빈 배열 → 숨김).
import { seasonShortLabel } from "@/lib/career";
import type { Metadata } from "next";
import { ogImagePath, shareMetadata } from "@/lib/share";
import { notFound } from "next/navigation";
import { listSeasonsWithPlayers, loadSeasonData, loadSeasonHighCards, toCardTeams, toLeaderPlayers, isSeasonOngoing } from "@/lib/data";
import LeadersView from "@/app/components/LeadersView";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

// 빌드 때 만든 시즌 외에는 404 (선수 0명 시즌 포함)
export const dynamicParams = false;

export function generateStaticParams() {
  return listSeasonsWithPlayers().map((s) => ({ seasonCode: String(s.seasonCode) }));
}

type Params = Promise<{ seasonCode: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { seasonCode } = await params;
  const season = loadSeasonData(Number(seasonCode));
  return shareMetadata({
    title: season ? `${seasonShortLabel(season.seasonLabel)} 시즌 리더보드 · KBL` : "KBL 시즌 리더보드",
    description: "KBL 정규시즌 부문별 1~3위와 전체 순위. 경기당/합계, 포지션·국적(국내/외국/아시아쿼터), 팀별로 나눠 봅니다. 비영리 팬 프로젝트.",
    path: `/season/${seasonCode}/leaders`,
    image: ogImagePath.leaders(Number(seasonCode)),
  });
}

export default async function LeadersPage({ params }: { params: Params }) {
  const { seasonCode } = await params;
  const season = loadSeasonData(Number(seasonCode));
  if (!season || season.players.length === 0) notFound();

  const teams = toCardTeams(season);

  return (
    <>
      <SiteNav seasons={listSeasonsWithPlayers()} seasonCode={season.seasonCode} view="leaders" wide />
      <LeadersView
        seasonCode={season.seasonCode}
        seasonLabel={season.seasonLabel}
        players={toLeaderPlayers(season)}
        teams={teams}
        seasonHighs={loadSeasonHighCards(season)}
        ongoing={isSeasonOngoing(season.seasonCode)}
      />
      <SourceFooter fetchedAt={season.fetchedAt} wide />
    </>
  );
}
