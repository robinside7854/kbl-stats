// 모든 팀 (2026-10-04, 메뉴 "팀"): 지금 리그 팀(이번 시즌 성적, 카드 또는 시즌별 순위 표) + 추억의 팀(매각·해체로 코드가 끝난 팀). 팀 카드 → /team/코드.
import type { Metadata } from "next";
import { shareMetadata } from "@/lib/share";
import { computeStandings, headToHeadWins, notableStreak } from "@/lib/games";
import { seasonShortLabel } from "@/lib/career";
import { loadPredictionRecord, loadPreviousPredictionRecord } from "@/lib/data-predict-extra";
import { dataAsOfLabel, gameTeamInfos, isSeasonOngoing, loadSeasonPredictions, listSeasonsWithPlayers, loadSeasonData, loadSeasonGames, loadTeamIndex, toCardTeams } from "@/lib/data";
import type { StandingsSeason, StandingTeam } from "@/app/components/StandingsTable";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";
import TeamsIndexView from "@/app/components/TeamsIndexView";

export const metadata: Metadata = shareMetadata({
  title: "KBL 팀 · 지금 팀과 추억의 팀",
  description: "KBL 모든 팀의 역대 성적·우승·레전드. 기아·SBS·나래·대우 같은 추억의 팀까지. 비영리 팬 프로젝트.",
  path: "/teams",
});

export default function TeamsPage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0];
  const standings = latest ? computeStandings(loadSeasonGames(latest.seasonCode)) : [];
  const records = Object.fromEntries(standings.map((r) => [r.teamCode, { wins: r.wins, losses: r.losses, rank: r.rank, streak: notableStreak(r) }]));
  // "표로 보기": 시즌마다 순위 표 (2026-10-06 — 따로 있던 팀 순위 화면을 여기로 합침, 최신 시즌 먼저)
  const standingsSeasons: StandingsSeason[] = seasons.flatMap((s) => {
    const season = loadSeasonData(s.seasonCode);
    if (!season) return [];
    const teams: Record<string, StandingTeam> = {};
    for (const t of toCardTeams(season)) teams[t.teamCode] = { shortName: t.shortName, logoUrl: t.logoUrl, color: t.color };
    const rows = s.seasonCode === latest?.seasonCode ? standings : computeStandings(loadSeasonGames(s.seasonCode));
    return [{
      seasonCode: s.seasonCode,
      seasonShort: seasonShortLabel(season.seasonLabel),
      rows,
      h2h: headToHeadWins(rows.map((r) => r.teamCode), loadSeasonGames(s.seasonCode)),
      teams,
      championCode: season.champion?.teamCode ?? null,
      ongoing: isSeasonOngoing(s.seasonCode),
    }];
  });
  // 플레이오프 확률 (진행 중 시즌만, lib/predict — 2026-10-16)
  const pred = latest ? loadSeasonPredictions(latest.seasonCode) : null;
  // 팀 이름·로고는 경기 일정 팀표(아직 경기 없는 팀은 직전 시즌 팀표 — gameTeamInfos)
  const latestTeams = latest ? gameTeamInfos(latest.seasonCode) : {};
  const odds = pred
    ? {
        seasonCode: pred.seasonCode,
        rows: pred.odds,
        teams: latestTeams,
        remaining: Object.keys(pred.winProbs).length,
        record: loadPredictionRecord(pred.seasonCode),
        previousRecord: loadPreviousPredictionRecord(pred.seasonCode),
      }
    : null;
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest?.seasonCode ?? 0} view="team" />
      <TeamsIndexView
        teams={loadTeamIndex()}
        seasonCode={latest?.seasonCode ?? 0}
        seasonShort={latest ? seasonShortLabel(loadSeasonData(latest.seasonCode)?.seasonLabel ?? latest.seasonLabel) : ""}
        records={records}
        standings={standingsSeasons}
        asOf={dataAsOfLabel()}
        odds={odds}
      />
      <SourceFooter />
    </>
  );
}
