// 좋아요 순위 (2026-10-04 사용자 요청: 어떤 선수·팀이 좋아요가 많은지). 수는 브라우저가 /api/likes 로 받는다(1분 캐시).
import type { Metadata } from "next";
import { shareMetadata } from "@/lib/share";
import { listSeasonsWithPlayers, loadTeamIndex } from "@/lib/data";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";
import LikesView from "@/app/components/LikesView";

export const metadata: Metadata = shareMetadata({
  title: "팬 좋아요 순위 · KBL",
  description: "KBL 팬들이 좋아요를 가장 많이 누른 선수와 팀. 비영리 팬 프로젝트.",
  path: "/likes",
});

export default function LikesPage() {
  const seasons = listSeasonsWithPlayers();
  const teams = loadTeamIndex().map((t) => ({ ...t.brand, active: t.active }));
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={seasons[0]?.seasonCode ?? 0} view="team" />
      <LikesView teams={teams} />
      <SourceFooter />
    </>
  );
}
