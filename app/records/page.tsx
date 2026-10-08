// 역대 기록 (/records): 1997 시즌부터 모든 정규시즌 선수 기록을 더한 통산 순위 (Basketball-Reference "Career Leaders" 참고, 2026-10-01).
// 합계는 lib/data loadCareerTotals(빌드 때 한 번), 순위·표기는 lib/records — 화면은 RecordsView 가 부문·단위·국적만 고른다.
import { seasonRangeLabel } from "@/lib/career";
import type { Metadata } from "next";
import { ogImagePath, shareMetadata } from "@/lib/share";
import { dataAsOfLabel, listSeasonsWithPlayers, loadCareerTotals, loadSeasonData } from "@/lib/data";
import RecordsView from "@/app/components/RecordsView";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = shareMetadata({
  title: "역대 기록 · KBL - Stats Reference",
  description: "1997 시즌부터 KBL 정규시즌 통산 득점·리바운드·어시스트·스틸·블록·3점 순위. 합계와 경기당, 국내·외국인 선수별로. 비영리 팬 프로젝트.",
  path: "/records", image: ogImagePath.records(),
});

export default function RecordsPage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0];
  const oldest = seasons[seasons.length - 1];
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest?.seasonCode ?? 0} view="records" wide />
      <RecordsView totals={loadCareerTotals()} spanLabel={oldest && latest ? seasonRangeLabel(oldest.seasonLabel, latest.seasonLabel) : ""} latestSeasonCode={latest?.seasonCode ?? 0} asOf={dataAsOfLabel()} />
      <SourceFooter fetchedAt={latest ? loadSeasonData(latest.seasonCode)?.fetchedAt : undefined} wide />
    </>
  );
}
