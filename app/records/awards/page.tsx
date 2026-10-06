// "기록" 메뉴 · 수상 탭 (/records/awards): 위 = 시즌을 골라 그 시즌 어워즈(2026-10-06 리더보드 맨 위에서 옮김, SeasonAwardsPicker),
// 아래 = 우승·MVP·베스트5 등 받은 횟수 순위 (2026-10-03).
// 재료는 선수 색인 awards(KBL 역대수상현황)·championships(챔프전 4승 팀) → lib/data loadAwardLists.
import type { Metadata } from "next";
import { ogImagePath, shareMetadata } from "@/lib/share";
import { AWARD_RANK_DEFS, findPlayerIndexEntry, listSeasonsWithPlayers, loadAwardLists, loadSeasonData, toCardTeams } from "@/lib/data";
import { buildSeasonAwardsView } from "@/lib/awards";
import { seasonShortLabel } from "@/lib/career";
import SeasonAwardsPicker, { type SeasonAwardsOption } from "@/app/components/SeasonAwardsPicker";
import RecordsHeader from "@/app/components/RecordsHeader";
import { AwardRecordsView } from "@/app/components/RecordTabViews";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = shareMetadata({
  title: "시즌 어워즈·역대 수상 · KBL - Stats Reference",
  description: "KBL 시즌별 MVP·베스트5·신인상 등 어워즈와 최다 우승·정규리그 MVP·챔프전 MVP·베스트5 등 선수별 수상 횟수 순위. 비영리 팬 프로젝트.",
  path: "/records/awards", image: ogImagePath.records(),
});

export default function RecordsAwardsPage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0];
  // 수상 기록이 있는 시즌만 (최신 먼저) — 진행 중 시즌은 아직 없다
  const awardSeasons: SeasonAwardsOption[] = seasons.flatMap((s) => {
    const season = loadSeasonData(s.seasonCode);
    if (!season) return [];
    const view = buildSeasonAwardsView(season.seasonAwards, season.seasonCode, toCardTeams(season), (id) => findPlayerIndexEntry(id));
    return view ? [{ seasonCode: s.seasonCode, seasonShort: seasonShortLabel(s.seasonLabel), view }] : [];
  });
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest?.seasonCode ?? 0} view="records" wide />
      <main className="mx-auto max-w-page px-4 pt-5">
        <RecordsHeader tab="awards" leadersSeason={latest?.seasonCode ?? 0} />
        <SeasonAwardsPicker seasons={awardSeasons} />
        <h2 className="mb-3 mt-8 text-h2 font-bold">역대 수상 횟수</h2>
        <AwardRecordsView data={loadAwardLists()} categories={AWARD_RANK_DEFS.map((d) => ({ value: d.key, label: d.label }))} />
      </main>
      <SourceFooter fetchedAt={latest ? loadSeasonData(latest.seasonCode)?.fetchedAt : undefined} wide />
    </>
  );
}
