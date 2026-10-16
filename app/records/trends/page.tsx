// 기록 메뉴 · 리그 변화 (/records/trends, 2026-10-16): 1997 시즌부터 지금까지 리그 전체 흐름 — 팀 득점·3점 비중·3점 성공률·
// 자유투 시도율·외국 선수 득점 비중·평균 키. 숫자는 빌드 때 lib/data-history loadLeagueTrends(시즌 수 30개 남짓, 작다).
import type { Metadata } from "next";
import { ogImagePath, shareMetadata } from "@/lib/share";
import { dataAsOfLabel, listSeasonsWithPlayers, loadSeasonData } from "@/lib/data";
import { loadLeagueTrends } from "@/lib/data-history";
import LeagueTrendsView from "@/app/components/LeagueTrendsView";
import RecordsHeader from "@/app/components/RecordsHeader";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = shareMetadata({
  title: "KBL 30년 리그 변화 · KBL - Stats Reference",
  description: "1997 시즌부터 KBL 경기당 팀 득점, 3점슛 비중과 성공률, 자유투, 외국 선수 득점 비중, 평균 키가 어떻게 바뀌었는지. 비영리 팬 프로젝트.",
  path: "/records/trends", image: ogImagePath.records(),
});

export default function RecordsTrendsPage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0];
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest?.seasonCode ?? 0} view="records" wide />
      <main className="mx-auto max-w-page px-4 pt-5">
        <RecordsHeader tab="trends" leadersSeason={latest?.seasonCode ?? 0} asOf={dataAsOfLabel()} />
        <LeagueTrendsView rows={loadLeagueTrends()} />
      </main>
      <SourceFooter fetchedAt={latest ? loadSeasonData(latest.seasonCode)?.fetchedAt : undefined} wide />
    </>
  );
}
