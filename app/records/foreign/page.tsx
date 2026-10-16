// 기록 메뉴 · 외국 선수 명예의 전당 (/records/foreign, 2026-10-16): KBL 을 거쳐 간 외국 선수 가운데 헌액 기준(우리 규칙, lib/hall)을 넘은 선수
// + 외국 선수 한 시즌 최고(경기당 득+리+어). 재료는 lib/data-history loadForeignHall (30명 남짓이라 HTML 에 다 넣는다).
import type { Metadata } from "next";
import { ogImagePath, shareMetadata } from "@/lib/share";
import { listSeasonsWithPlayers, loadSeasonData } from "@/lib/data";
import { loadForeignHall } from "@/lib/data-history";
import ForeignHallView from "@/app/components/ForeignHallView";
import RecordsHeader from "@/app/components/RecordsHeader";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = shareMetadata({
  title: "외국 선수 명예의 전당 · KBL - Stats Reference",
  description: "KBL 을 빛낸 외국 선수들. MVP·베스트5·오래 뛴 선수 기준으로 고른 명예의 전당과 외국 선수 한 시즌 최고 기록. 비영리 팬 프로젝트.",
  path: "/records/foreign", image: ogImagePath.records(),
});

export default function RecordsForeignPage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0];
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest?.seasonCode ?? 0} view="records" wide />
      <main className="mx-auto max-w-page px-4 pt-5">
        <RecordsHeader tab="foreign" leadersSeason={latest?.seasonCode ?? 0} />
        <ForeignHallView data={loadForeignHall()} />
      </main>
      <SourceFooter fetchedAt={latest ? loadSeasonData(latest.seasonCode)?.fetchedAt : undefined} wide />
    </>
  );
}
