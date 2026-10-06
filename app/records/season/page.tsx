// 역대 기록 · 한 시즌 최다 (/records/season, 2026-10-03): 한 시즌 합계·경기당 최다 — 정규시즌·플레이오프·챔프전 따로.
// 정규시즌은 시즌 파일, 플레이오프·챔프전은 postseason.json(서버 A gameCode 03,04 / 04) → lib/data loadSeasonBestLists.
import type { Metadata } from "next";
import { ogImagePath, shareMetadata } from "@/lib/share";
import { hasPostseasonData, listSeasonsWithPlayers, loadSeasonBestLists, loadSeasonData } from "@/lib/data";
import RecordsHeader from "@/app/components/RecordsHeader";
import { SeasonBestsView } from "@/app/components/RecordTabViews";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = shareMetadata({
  title: "역대 한 시즌 최다 · KBL - Stats Reference",
  description: "KBL 역대 한 시즌 최다 득점·리바운드·어시스트·3점·더블더블. 합계와 경기당, 정규시즌·플레이오프·챔프전 따로. 비영리 팬 프로젝트.",
  path: "/records/season", image: ogImagePath.records(),
});

export default function RecordsSeasonPage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0];
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest?.seasonCode ?? 0} view="records" wide />
      <main className="mx-auto max-w-page px-4 pt-5">
        <RecordsHeader tab="season" leadersSeason={latest?.seasonCode ?? 0} />
        <SeasonBestsView data={loadSeasonBestLists()} hasPostseason={hasPostseasonData()} />
      </main>
      <SourceFooter fetchedAt={latest ? loadSeasonData(latest.seasonCode)?.fetchedAt : undefined} wide />
    </>
  );
}
