// 기록 메뉴 · 프로필 (/records/profile, 2026-10-30): 키·몸무게·체격·나이·뛴 시즌·거친 구단 순위와 키 대비 기록(단신 리바운드·장신 3점% 등).
// 기간 = 시즌(처음은 최신 시즌) 또는 역대 전체. 페이지에는 처음 목록 하나만, 나머지는 고를 때 /records/data/profile/… (규칙 lib/profile-ranks, 재료 lib/data loadProfileRankLists).
import type { Metadata } from "next";
import { ogImagePath, shareMetadata } from "@/lib/share";
import { listSeasonsWithPlayers, loadProfileRankLists, loadSeasonData } from "@/lib/data";
import { pickRecordList } from "@/lib/records";
import { PROFILE_RANK_DEFS, profileListKey } from "@/lib/profile-ranks";
import { seasonShortLabel } from "@/lib/career";
import RecordsHeader from "@/app/components/RecordsHeader";
import { ProfileRecordsView } from "@/app/components/RecordTabViews";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = shareMetadata({
  title: "프로필 순위 · KBL - Stats Reference",
  description: "KBL 선수 키·몸무게·나이·뛴 시즌·거친 구단 순위와 키 대비 기록(작은 선수 리바운드, 큰 선수 3점슛). 시즌마다, 역대 전체로. 비영리 팬 프로젝트.",
  path: "/records/profile", image: ogImagePath.records(),
});

export default function RecordsProfilePage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0];
  const scope = latest ? latest.seasonCode : "all";
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest?.seasonCode ?? 0} view="records" wide />
      <main className="mx-auto max-w-page px-4 pt-5">
        <RecordsHeader tab="profile" leadersSeason={latest?.seasonCode ?? 0} />
        <ProfileRecordsView
          data={pickRecordList(loadProfileRankLists(), profileListKey(scope, PROFILE_RANK_DEFS[0].key))}
          seasons={seasons.map((s) => ({ seasonCode: s.seasonCode, seasonShort: seasonShortLabel(s.seasonLabel) }))}
        />
      </main>
      <SourceFooter fetchedAt={latest ? loadSeasonData(latest.seasonCode)?.fetchedAt : undefined} wide />
    </>
  );
}
