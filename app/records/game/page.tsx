// 역대 기록 · 한 경기 최다 (/records/game, 2026-10-03): 부문별 역대 한 경기 최다 기록 — 정규시즌·플레이오프·챔프전 따로.
// 재료는 선수별 통산 한 경기 최다(색인 careerHighs, KBL 공홈 선수 기록) → lib/data loadGameHighLists.
import type { Metadata } from "next";
import { ogImagePath, shareMetadata } from "@/lib/share";
import { listSeasonsWithPlayers, loadGameHighLists, loadSeasonData } from "@/lib/data";
import RecordsHeader from "@/app/components/RecordsHeader";
import { GameHighsView } from "@/app/components/RecordTabViews";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = shareMetadata({
  title: "역대 한 경기 최다 · KBL - Stats Reference",
  description: "KBL 역대 한 경기 최다 득점·리바운드·어시스트·스틸·블록·3점 기록. 정규시즌·플레이오프·챔프전 따로. 비영리 팬 프로젝트.",
  path: "/records/game", image: ogImagePath.records(),
});

export default function RecordsGamePage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0];
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest?.seasonCode ?? 0} view="records" wide />
      <main className="mx-auto max-w-page px-4 pt-5">
        <RecordsHeader tab="game" />
        <GameHighsView data={loadGameHighLists()} />
      </main>
      <SourceFooter fetchedAt={latest ? loadSeasonData(latest.seasonCode)?.fetchedAt : undefined} wide />
    </>
  );
}
