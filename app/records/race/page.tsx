// "기록" 메뉴 · 시상 레이스 탭 (/records/race, 2026-11-05 사용자): 이번 시즌 MVP 후보(국내 / 외국·아시아쿼터 각 3명) + MIP 후보 3명.
// 규칙 lib/award-race, 재료 lib/data loadAwardRace(진행 중 시즌만 — 시즌이 끝났거나 개막 전이면 안내 한 줄).
import type { Metadata } from "next";
import Link from "next/link";
import { ogImagePath, shareMetadata } from "@/lib/share";
import { dataAsOfLabel, listSeasonsWithPlayers, loadAwardRace, loadSeasonData } from "@/lib/data";
import AwardRaceView from "@/app/components/AwardRaceView";
import { IconChevronRight } from "@/app/components/icons";
import RecordsHeader from "@/app/components/RecordsHeader";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = shareMetadata({
  title: "시상 레이스 · KBL - Stats Reference",
  description: "이번 시즌 KBL MVP·MIP 후보 — 국내 선수·외국·아시아쿼터 MVP 레이스와 기량 발전 후보, 지표별 순위. 기록이 들어올 때마다 바뀌는 우리 기준. 비영리 팬 프로젝트.",
  path: "/records/race", image: ogImagePath.records(),
});

export default function RecordsRacePage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0];
  const race = loadAwardRace();
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest?.seasonCode ?? 0} view="records" wide />
      <main className="mx-auto max-w-page px-4 pt-5">
        <RecordsHeader tab="race" leadersSeason={latest?.seasonCode ?? 0} asOf={race ? dataAsOfLabel() : null} />
        {race ? (
          <AwardRaceView race={race} />
        ) : (
          <div className="surface-card rounded-container p-4 text-sub text-ink-2">
            <p>시즌이 진행 중일 때 MVP·MIP 후보를 보여 줘요. 지난 시즌 수상은 수상 탭에서 볼 수 있어요.</p>
            <Link href="/records/awards" className="link-shortcut mt-1">
              수상 보기 <IconChevronRight size={16} aria-hidden />
            </Link>
          </div>
        )}
      </main>
      <SourceFooter fetchedAt={latest ? loadSeasonData(latest.seasonCode)?.fetchedAt : undefined} wide />
    </>
  );
}
