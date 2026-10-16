// 기록 메뉴 · 드래프트 (/records/draft?year=2015, 2026-10-16): 연도별 지명 선수와 KBL 통산 기록, 그 해 선수들의 우승·수상 합계(lib/draft).
// 재료는 선수 색인 draft(선수 마스터)·수상·우승 + 통산 합계 → lib/data-history loadDraftYear. 처음 연도만 HTML, 나머지는 /records/draft/{연도}.json.
import type { Metadata } from "next";
import { ogImagePath, shareMetadata } from "@/lib/share";
import { listSeasonsWithPlayers, loadSeasonData } from "@/lib/data";
import { loadDraftYear, loadDraftYears } from "@/lib/data-history";
import DraftView from "@/app/components/DraftView";
import RecordsHeader from "@/app/components/RecordsHeader";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = shareMetadata({
  title: "KBL 드래프트 연도별 · KBL - Stats Reference",
  description: "1998년부터 KBL 신인 드래프트 연도별 지명 선수와 통산 기록, 그 해 선수들이 받은 우승·MVP·챔프전 MVP. 비영리 팬 프로젝트.",
  path: "/records/draft", image: ogImagePath.records(),
});

export default function RecordsDraftPage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0];
  const years = loadDraftYears();
  // 처음 보이는 연도: 가장 최근 드래프트
  const first = years[0] !== undefined ? loadDraftYear(years[0]) : null;
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest?.seasonCode ?? 0} view="records" wide />
      <main className="mx-auto max-w-page px-4 pt-5">
        <RecordsHeader tab="draft" leadersSeason={latest?.seasonCode ?? 0} />
        {first ? (
          <DraftView years={years} initial={first} />
        ) : (
          <p className="surface-card rounded-container px-4 py-8 text-center text-body text-ink-2">드래프트 기록이 아직 없어요.</p>
        )}
      </main>
      <SourceFooter fetchedAt={latest ? loadSeasonData(latest.seasonCode)?.fetchedAt : undefined} wide />
    </>
  );
}
