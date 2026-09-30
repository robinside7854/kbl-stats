// 홈 "이번 시즌 한눈에" (PLAN.md §2-4, §3 ⑤). 빌드 시점에 lib/ 함수로 전부 계산해 결과만 HomeView 에 넘긴다.
// 개막 전(코드표 최신 시즌이 선수 0명)이면 직전 시즌으로 만들고 안내를 붙인다 — 시즌 코드는 코드표에서 비교(lib/home pickHomeSeason).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listAllSeasons, listSeasonsWithPlayers, loadSeasonData, toCardTeams, toLeaderPlayers } from "@/lib/data";
import { filterLeaders, topLeaders } from "@/lib/leaders";
import { DEFAULT_QUALIFY, qualifyLabel } from "@/lib/metrics";
import { HOME_CATEGORIES, pickHomeSeason, splitRecentSeasons } from "@/lib/home";
import HomeView from "./components/HomeView";
import SiteNav from "./components/SiteNav";
import SourceFooter, { formatFetchedAt } from "./components/SourceFooter";

export const metadata: Metadata = {
  title: "KBL 팬 스탯 · 이번 시즌 한눈에",
  description: "KBL 정규시즌 부문별 1~3위, 플레이어 카드, 순위표, 팀별 선수 분포, 1997년부터 모든 선수 기록. 비영리 팬 프로젝트.",
};

export default function HomePage() {
  const withPlayers = listSeasonsWithPlayers();
  const { shown, upcoming } = pickHomeSeason(listAllSeasons(), withPlayers);
  const season = shown ? loadSeasonData(shown.seasonCode) : null;
  if (!shown || !season) notFound();

  // 부문별 1~3위: 경기당, 기본 표본 기준 (순위표 기본 화면과 같은 값)
  const qualified = filterLeaders(toLeaderPlayers(season), { origin: "all", teamCode: null, rule: DEFAULT_QUALIFY });
  const categories = HOME_CATEGORIES.map((key) => ({ key, entries: topLeaders(qualified, key, "perGame", 3) }));
  const { recent, older } = splitRecentSeasons(withPlayers, 6);

  return (
    <>
      <SiteNav seasons={withPlayers} seasonCode={shown.seasonCode} view="home" wide />
      <HomeView
        season={shown}
        fetchedLabel={formatFetchedAt(season.fetchedAt)}
        upcoming={upcoming}
        categories={categories}
        teams={toCardTeams(season)}
        qualifyText={qualifyLabel(DEFAULT_QUALIFY)}
        recentSeasons={recent}
        olderSeasons={older}
      />
      <SourceFooter fetchedAt={season.fetchedAt} wide />
    </>
  );
}
