// 홈 "이번 시즌 한눈에" (PLAN.md §2-4, §3 ⑤). 빌드 시점에 lib/ 함수로 전부 계산해 결과만 HomeView 에 넘긴다.
// 개막 전(코드표 최신 시즌이 선수 0명)이면 직전 시즌으로 만들고 안내를 붙인다 — 시즌 코드는 코드표에서 비교(lib/home pickHomeSeason).
import type { Metadata } from "next";
import { shareMetadata } from "@/lib/share";
import { notFound } from "next/navigation";
import { findPlayerIndexEntry, loadRecentFeats, loadSeasonPredictions, listAllSeasons, listSeasonsWithPlayers, loadSeasonData, loadSeasonGames, gameTeamInfos, seasonQualify, toCardTeams, toLeaderPlayers } from "@/lib/data";
import { latestGameDay, nextGameDay, seasonProgress, asOfLabel, computeStandings, notableStreak } from "@/lib/games";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import type { BirthdayPlayer } from "./components/BirthdayStrip";
import { filterLeaders, topLeaders } from "@/lib/leaders";
import { qualifyLabel } from "@/lib/metrics";
import { HOME_CATEGORIES, pickHomeSeason } from "@/lib/home";
import HomeView from "./components/HomeView";
import SiteNav from "./components/SiteNav";
import SourceFooter, { formatFetchedAt } from "./components/SourceFooter";

export const metadata: Metadata = shareMetadata({
  title: "KBL - Stats Reference · 이번 시즌",
  description: "오늘의 경기·부문별 1~3위·선수 카드·리더보드·역대 기록까지, 1997년부터 모든 KBL 선수 기록을 한눈에. 비영리 팬 프로젝트.",
  path: "/",
});

export default function HomePage() {
  const withPlayers = listSeasonsWithPlayers();
  const { shown, upcoming } = pickHomeSeason(listAllSeasons(), withPlayers);
  const season = shown ? loadSeasonData(shown.seasonCode) : null;
  if (!shown || !season) notFound();

  // 부문별 1~3위: 경기당, 그 시즌 기본 표본 기준 (순위표 기본 화면과 같은 값 — 진행 중 시즌은 팀 경기 절반 이상)
  const rule = seasonQualify(shown.seasonCode);
  const qualified = filterLeaders(toLeaderPlayers(season), { origin: "all", teamCode: null, rule });
  const categories = HOME_CATEGORIES.map((key) => ({ key, entries: topLeaders(qualified, key, "perGame", 3) }));

  // 오늘 생일 후보: 홈 시즌 명단(= 현역) 중 생년월일이 있는 선수. "오늘" 판정은 브라우저(BirthdayStrip)가 한다
  const teams = toCardTeams(season);
  const birthdays: BirthdayPlayer[] = toLeaderPlayers(season).flatMap((p) => {
    const birthday = findPlayerIndexEntry(p.id)?.birthday ?? null;
    if (!birthday) return [];
    const team = teams.find((t) => t.teamCode === p.teamCode);
    return [{ id: p.id, nameKo: p.nameKo, birthday, photoUrl: p.photoUrl, teamName: team?.shortName ?? p.teamShort, color: team?.color ?? FALLBACK_TEAM_COLOR }];
  });

  // 최근 경기일·다음 경기일 (data/processed/{시즌}/games.json, lib/games). 팀 이름·로고는 이 시즌 팀표, 아직 안 뛴 팀은 직전 시즌 팀표
  const games = loadSeasonGames(shown.seasonCode);
  const gameDay = latestGameDay(games);
  const nextDay = nextGameDay(games, gameDay?.date ?? null);
  const gameTeams = gameTeamInfos(shown.seasonCode);
  // 진행률은 진행 중인 시즌만 (개막 전이라 직전 시즌을 보여 줄 때는 안 보임)
  const seasonProgressNow = upcoming ? null : seasonProgress(games);
  // 새로 나온 기록(최근 7일 대기록)·다음 경기 팀 연승/연패 — 2026-10-11 (개막 전 직전 시즌을 보일 땐 안 보임)
  const feats = upcoming ? [] : loadRecentFeats(shown.seasonCode);
  const streaks = upcoming
    ? {}
    : Object.fromEntries(computeStandings(games).flatMap((r) => {
        const s = notableStreak(r);
        return s ? [[r.teamCode, s]] : [];
      }));

  return (
    <>
      <SiteNav seasons={withPlayers} seasonCode={shown.seasonCode} view="home" wide />
      <HomeView
        season={shown}
        fetchedLabel={formatFetchedAt(season.fetchedAt)}
        asOf={gameDay ? asOfLabel(gameDay.date) : null}
        upcoming={upcoming}
        categories={categories}
        teams={teams}
        birthdays={birthdays}
        gameDay={gameDay}
        progress={seasonProgressNow}
        nextGameDay={nextDay}
        gameTeams={gameTeams}
        feats={feats}
        streaks={streaks}
        winProbs={upcoming ? {} : (loadSeasonPredictions(shown.seasonCode)?.winProbs ?? {})}
        qualifyText={qualifyLabel(rule)}
      />
      <SourceFooter fetchedAt={season.fetchedAt} wide />
    </>
  );
}
