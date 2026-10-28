// "기록" 메뉴 · 클러치 탭 (/records/clutch, 2026-10-28 사용자 기준): 위닝샷·버저비터·클러치 득점·클러치 야투율 통산 순위 + 최근 위닝샷.
// 재료는 시즌 games.json 의 winning·clutch(공홈 문자중계 4쿼터·연장, lib/clutch) → lib/data loadClutchLists·loadRecentWinningShots.
import type { Metadata } from "next";
import { ogImagePath, shareMetadata } from "@/lib/share";
import { dataAsOfLabel, listSeasonsWithPlayers, loadClutchLists, loadRecentWinningShots, loadSeasonData } from "@/lib/data";
import RecordsHeader from "@/app/components/RecordsHeader";
import { ClutchRecordsView } from "@/app/components/RecordTabViews";
import RecentWinningShots from "@/app/components/RecentWinningShots";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = shareMetadata({
  title: "클러치·위닝샷 · KBL - Stats Reference",
  description: "KBL 역대 위닝샷·버저비터 횟수와 클러치 득점 순위, 최근 위닝샷. 4쿼터·연장 남은 2분 미만 6점 차 이내 기준. 비영리 팬 프로젝트.",
  path: "/records/clutch", image: ogImagePath.records(),
});

export default function RecordsClutchPage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0];
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest?.seasonCode ?? 0} view="records" wide />
      <main className="mx-auto max-w-page px-4 pt-5">
        <RecordsHeader tab="clutch" leadersSeason={latest?.seasonCode ?? 0} asOf={dataAsOfLabel()} />
        <ClutchRecordsView data={loadClutchLists()} />
        <RecentWinningShots rows={loadRecentWinningShots()} />
      </main>
      <SourceFooter fetchedAt={latest ? loadSeasonData(latest.seasonCode)?.fetchedAt : undefined} wide />
    </>
  );
}
