// "기록" 메뉴 · 클러치 탭 (/records/clutch, 2026-10-28 사용자 기준): 구분(정규·플옵·챔프전) × 기간(통산·시즌) 위닝샷·버저비터·클러치 득점(야투율 포함) 순위 + 위닝샷 목록.
// 재료는 시즌 games.json·playoff-clutch.json 의 winning·clutch(공홈 문자중계 4쿼터·연장, lib/clutch) → lib/data loadClutchLists·loadWinningShotLists.
import type { Metadata } from "next";
import { ogImagePath, shareMetadata } from "@/lib/share";
import { clutchSeasonOptions, dataAsOfLabel, listSeasonsWithPlayers, loadClutchLists, loadSeasonData, loadWinningShotLists } from "@/lib/data";
import { clutchListKey, pickRecordList } from "@/lib/records";
import RecordsHeader from "@/app/components/RecordsHeader";
import { ClutchRecordsView } from "@/app/components/RecordTabViews";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = shareMetadata({
  title: "클러치·위닝샷 · KBL - Stats Reference",
  description: "KBL 위닝샷·버저비터 횟수와 클러치 득점 순위 — 정규시즌·플레이오프, 통산·시즌별. 4쿼터·연장 남은 2분 미만 6점 차 이내 기준. 비영리 팬 프로젝트.",
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
        {/* 처음 보이는 목록 하나(정규시즌 통산 위닝샷)만 — 다른 구분·기간·부문은 고를 때 /records/data/clutch·winning/… */}
        <ClutchRecordsView
          data={pickRecordList(loadClutchLists(), clutchListKey("regular", "all", "winning"))}
          seasons={clutchSeasonOptions()}
          shots={loadWinningShotLists()[clutchListKey("regular", "all", "shots")] ?? []}
        />
      </main>
      <SourceFooter fetchedAt={latest ? loadSeasonData(latest.seasonCode)?.fetchedAt : undefined} wide />
    </>
  );
}
