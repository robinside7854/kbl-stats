// 역대 기록 · 수상·우승 (/records/awards, 2026-10-03): 우승·MVP·베스트5 등 받은 횟수 순위.
// 재료는 선수 색인 awards(KBL 역대수상현황)·championships(챔프전 4승 팀) → lib/data loadAwardLists.
import type { Metadata } from "next";
import { AWARD_RANK_DEFS, listSeasonsWithPlayers, loadAwardLists, loadSeasonData } from "@/lib/data";
import RecordsHeader from "@/app/components/RecordsHeader";
import { AwardRecordsView } from "@/app/components/RecordTabViews";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = {
  title: "역대 수상·우승 · KBL - Stats Reference",
  description: "KBL 최다 우승·정규리그 MVP·챔프전 MVP·베스트5 등 선수별 수상 횟수 순위. 비영리 팬 프로젝트.",
};

export default function RecordsAwardsPage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0];
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest?.seasonCode ?? 0} view="records" wide />
      <main className="mx-auto max-w-5xl px-4 pt-5">
        <RecordsHeader tab="awards" />
        <AwardRecordsView data={loadAwardLists()} categories={AWARD_RANK_DEFS.map((d) => ({ value: d.key, label: d.label }))} />
      </main>
      <SourceFooter fetchedAt={latest ? loadSeasonData(latest.seasonCode)?.fetchedAt : undefined} wide />
    </>
  );
}
