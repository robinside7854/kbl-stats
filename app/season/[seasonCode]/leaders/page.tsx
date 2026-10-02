// 시즌 순위표 (PLAN.md §2-1). 빌드 시점에 JSON을 읽어 순위표에 필요한 필드만 클라이언트로 넘긴다.
// 마감된 시즌은 맨 위에 그 시즌 어워즈(SeasonAwardsBoard). "이 시즌 한 경기 최다" 카드도 여기서 만들어 넘긴다 (lib/data loadSeasonHighCards — 데이터 없으면 빈 배열 → 숨김).
import { seasonShortLabel } from "@/lib/career";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findPlayerIndexEntry, listSeasonsWithPlayers, loadSeasonData, loadSeasonHighCards, toCardTeams, toLeaderPlayers } from "@/lib/data";
import { buildSeasonAwardsView } from "@/lib/awards";
import SeasonAwardsBoard from "@/app/components/SeasonAwardsBoard";
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
  return {
    title: season ? `${seasonShortLabel(season.seasonLabel)} 시즌 리더보드 · KBL` : "KBL 시즌 리더보드",
    description: "KBL 정규시즌 부문별 1~3위와 전체 순위. 경기당/합계, 포지션·국적(국내/외국/아시아쿼터), 팀별로 나눠 봅니다. 비영리 팬 프로젝트.",
  };
}

export default async function LeadersPage({ params }: { params: Params }) {
  const { seasonCode } = await params;
  const season = loadSeasonData(Number(seasonCode));
  if (!season || season.players.length === 0) notFound();

  // 마감된 시즌(수상 기록이 있는 시즌)만 맨 위에 어워즈 — lib/awards
  const teams = toCardTeams(season);
  const awards = buildSeasonAwardsView(season.seasonAwards, season.seasonCode, teams, (id) => findPlayerIndexEntry(id));

  return (
    <>
      <SiteNav seasons={listSeasonsWithPlayers()} seasonCode={season.seasonCode} view="leaders" wide />
      <LeadersView
        seasonLabel={season.seasonLabel}
        players={toLeaderPlayers(season)}
        teams={teams}
        seasonHighs={loadSeasonHighCards(season)}
        awards={awards ? <SeasonAwardsBoard view={awards} seasonShort={seasonShortLabel(season.seasonLabel)} /> : null}
      />
      <SourceFooter fetchedAt={season.fetchedAt} wide />
    </>
  );
}
