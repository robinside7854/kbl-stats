// 홈 "이번 시즌 한눈에" (PLAN.md §2-4, §3 ⑤). 빌드 시점에 lib/ 함수로 전부 계산해 결과만 HomeView 에 넘긴다.
// 개막 전(코드표 최신 시즌이 선수 0명)이면 직전 시즌으로 만들고 안내를 붙인다 — 시즌 코드는 코드표에서 비교(lib/home pickHomeSeason).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findPlayerIndexEntry, listAllSeasons, listSeasonsWithPlayers, loadSeasonData, toCardTeams, toLeaderPlayers } from "@/lib/data";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import type { BirthdayPlayer } from "./components/BirthdayStrip";
import { filterLeaders, topLeaders } from "@/lib/leaders";
import { DEFAULT_QUALIFY, qualifyLabel } from "@/lib/metrics";
import { HOME_CATEGORIES, pickHomeSeason, splitRecentSeasons } from "@/lib/home";
import HomeView from "./components/HomeView";
import SiteNav from "./components/SiteNav";
import SourceFooter, { formatFetchedAt } from "./components/SourceFooter";

export const metadata: Metadata = {
  title: "KBL - Stats Reference · 이번 시즌 한눈에",
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

  // 오늘 생일 후보: 홈 시즌 명단(= 현역) 중 생년월일이 있는 선수. "오늘" 판정은 브라우저(BirthdayStrip)가 한다
  const teams = toCardTeams(season);
  const birthdays: BirthdayPlayer[] = toLeaderPlayers(season).flatMap((p) => {
    const birthday = findPlayerIndexEntry(p.id)?.birthday ?? null;
    if (!birthday) return [];
    const team = teams.find((t) => t.teamCode === p.teamCode);
    return [{ id: p.id, nameKo: p.nameKo, birthday, photoUrl: p.photoUrl, teamName: team?.shortName ?? p.teamShort, color: team?.color ?? FALLBACK_TEAM_COLOR }];
  });

  return (
    <>
      <SiteNav seasons={withPlayers} seasonCode={shown.seasonCode} view="home" wide />
      <HomeView
        season={shown}
        fetchedLabel={formatFetchedAt(season.fetchedAt)}
        upcoming={upcoming}
        categories={categories}
        teams={teams}
        birthdays={birthdays}
        qualifyText={qualifyLabel(DEFAULT_QUALIFY)}
        recentSeasons={recent}
        olderSeasons={older}
      />
      <SourceFooter fetchedAt={season.fetchedAt} wide />
    </>
  );
}
