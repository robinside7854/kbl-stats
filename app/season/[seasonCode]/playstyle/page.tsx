// 플레이스타일 (2026-10-01 — 팀 분포 탭 자리). 유형별 선수 풀과 유형 안 순위.
// 빌드 때 시즌 카드 데이터(public/cards 와 같은 값)로 표본 충족 선수의 유형·종합 점수를 계산해 결과만 넘긴다 (lib/playstyle).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listSeasonsWithPlayers, loadSeasonCards, loadSeasonData, toCardTeams } from "@/lib/data";
import { buildStyleRows } from "@/lib/playstyle";
import PlaystyleView from "@/app/components/PlaystyleView";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const dynamicParams = false;

export function generateStaticParams() {
  return listSeasonsWithPlayers().map((s) => ({ seasonCode: String(s.seasonCode) }));
}

type Params = Promise<{ seasonCode: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { seasonCode } = await params;
  const season = loadSeasonData(Number(seasonCode));
  return {
    title: season ? `${season.seasonLabel} 플레이스타일 · KBL` : "KBL 플레이스타일",
    description: "득점원·슈터·플레이메이커 같은 선수 유형별로 KBL 선수를 모아 유형 안 순위를 봅니다. 비영리 팬 프로젝트.",
  };
}

export default async function PlaystylePage({ params }: { params: Params }) {
  const { seasonCode } = await params;
  const season = loadSeasonData(Number(seasonCode));
  const cards = season ? loadSeasonCards(season.seasonCode) : null;
  if (!season || !cards || season.players.length === 0) notFound();

  return (
    <>
      <SiteNav seasons={listSeasonsWithPlayers()} seasonCode={season.seasonCode} view="playstyle" wide />
      <PlaystyleView
        seasonCode={season.seasonCode}
        seasonLabel={season.seasonLabel}
        rows={buildStyleRows(cards)}
        teams={toCardTeams(season)}
        hasShots={!!season.coverage.shots}
      />
      <SourceFooter fetchedAt={season.fetchedAt} wide />
    </>
  );
}
