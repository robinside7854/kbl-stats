// 시즌 경기 일정 정적 페이지 (2026-10-03 사용자 요청, 메뉴 "일정"). 경기 목록(games.json)의 정규시즌 경기 전부를 날짜별로.
// 박스스코어는 HTML 에 넣지 않고(시즌 약 1MB) 수훈 선수만 — 펼칠 때 /games/{시즌}/{날짜}.json 을 받는다(ScheduleView).
import type { Metadata } from "next";
import { shareMetadata } from "@/lib/share";
import { notFound } from "next/navigation";
import { gameTeamInfos, listSeasonsWithPlayers, loadSeasonData, loadSeasonGames } from "@/lib/data";
import { latestGameDay, monthsOf, seasonProgress, teamStandouts } from "@/lib/games";
import { seasonShortLabel } from "@/lib/career";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";
import ScheduleView, { type ScheduleGame } from "@/app/components/ScheduleView";
import { loadMatchups } from "@/lib/data-predict-extra";

export const dynamicParams = false;

export function generateStaticParams() {
  return listSeasonsWithPlayers().map((s) => ({ seasonCode: String(s.seasonCode) }));
}

type Params = Promise<{ seasonCode: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { seasonCode } = await params;
  const season = loadSeasonData(Number(seasonCode));
  return shareMetadata({
    title: season ? `${seasonShortLabel(season.seasonLabel)} 경기 일정 · KBL` : "KBL 경기 일정",
    description: "KBL 정규시즌 날짜별 경기 일정·결과와 경기별 선수 기록(박스스코어). 비영리 팬 프로젝트.",
    path: `/season/${seasonCode}/schedule`,
  });
}

export default async function SchedulePage({ params }: { params: Params }) {
  const { seasonCode } = await params;
  const code = Number(seasonCode);
  const season = loadSeasonData(code);
  if (!season || season.players.length === 0) notFound();

  const all = loadSeasonGames(code);
  const games: ScheduleGame[] = all.map((g) => ({
    ...g,
    box: null,
    hasBox: !!g.box,
    stars: g.box ? { away: teamStandouts(g.box.away), home: teamStandouts(g.box.home) } : null,
  }));
  // 정적 HTML 의 처음 달: 가장 최근 경기일의 달 (브라우저가 오늘 날짜로 다시 고른다)
  const latest = latestGameDay(all);
  const months = monthsOf(all);
  const initialMonth = latest ? latest.date.slice(0, 7) : (months[0] ?? null);

  return (
    <>
      <SiteNav seasons={listSeasonsWithPlayers()} seasonCode={code} view="schedule" wide />
      <ScheduleView
        seasonCode={code}
        seasonShort={seasonShortLabel(season.seasonLabel)}
        games={games}
        progress={seasonProgress(all)}
        teams={gameTeamInfos(code)}
        initialMonth={initialMonth}
        matchups={loadMatchups(code)}
      />
      <SourceFooter fetchedAt={season.fetchedAt} wide />
    </>
  );
}
