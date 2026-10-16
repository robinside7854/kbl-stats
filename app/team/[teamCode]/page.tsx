// 팀 페이지 (2026-10-04 사용자 요청): 팀 코드마다 정적 1쪽 — 지금 팀과 추억의 팀(매각·해체로 코드가 끝난 팀) 모두.
// 재료 lib/data loadFranchises, 화면 TeamView, 주소 ?season= 으로 그 시즌 로스터.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { shareMetadata } from "@/lib/share";
import { listSeasonsWithPlayers, loadFranchises, loadSeasonPredictions, loadTeamHeadToHead, loadTeamStrip } from "@/lib/data";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";
import TeamView from "@/app/components/TeamView";

export const dynamicParams = false;

export function generateStaticParams() {
  return [...loadFranchises().keys()].map((teamCode) => ({ teamCode }));
}

type Params = Promise<{ teamCode: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { teamCode } = await params;
  const t = loadFranchises().get(teamCode);
  if (!t) return {};
  const titles = t.totals.championships > 0 ? ` · 우승 ${t.totals.championships}회` : "";
  return shareMetadata({
    title: `${t.brand.name} · KBL 팀 기록`,
    description: `${t.brand.name} ${t.spanLabel} · 통산 ${t.totals.wins}승 ${t.totals.losses}패${titles}. 시즌별 성적·로스터·레전드·팀 통산 기록. 비영리 팬 프로젝트.`,
    path: `/team/${teamCode}`,
  });
}

export default async function TeamPage({ params }: { params: Params }) {
  const { teamCode } = await params;
  const data = loadFranchises().get(teamCode);
  if (!data) notFound();
  const seasons = listSeasonsWithPlayers();
  const strip = data.active ? loadTeamStrip(teamCode) : null;
  // 플레이오프 확률 (지금 팀·진행 중 시즌만, lib/predict — 2026-10-16)
  const pred = data.active && strip ? loadSeasonPredictions(strip.seasonCode) : null;
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={seasons[0]?.seasonCode ?? 0} view="team" />
      <TeamView
        data={data}
        strip={strip}
        h2h={loadTeamHeadToHead(teamCode, data.rows.map((r) => r.seasonCode))}
        odds={pred?.odds.find((o) => o.teamCode === teamCode) ?? null}
        oddsSeason={pred ? strip?.seasonShort ?? null : null}
      />
      <SourceFooter />
    </>
  );
}
