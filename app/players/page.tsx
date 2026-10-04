// 선수 탭 (/players) — 검색 + 시즌별 선수 그리드. 그리드 카드의 칭호 배지(선수당 1순위 1개)는 빌드 시점 lib/badges 결과. 최신 시즌 카드 파일을 정적 HTML에 넣고, 다른 시즌은 브라우저가 /cards 에서 받는다.
import type { Metadata } from "next";
import { shareMetadata } from "@/lib/share";
import { notFound } from "next/navigation";
import { listSeasonsWithPlayers, loadBadgeKeys, loadSchoolGroups, loadSeasonCardsFile, loadSeasonData, loadTopBadgeLabels } from "@/lib/data";
import PlayersView from "@/app/components/PlayersView";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = shareMetadata({
  title: "선수 · KBL - Stats Reference",
  description: "KBL 선수 검색과 시즌별 선수 목록. 포지션·국적·팀으로 거르고 종합 등급 순으로. 비영리 팬 프로젝트.",
  path: "/players",
});

export default function PlayersPage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0];
  const file = latest ? loadSeasonCardsFile(latest.seasonCode) : null;
  if (!latest || !file) notFound();
  return (
    <>
      <PlayersView seasons={seasons} latest={latest.seasonCode} initialFile={file} topBadges={loadTopBadgeLabels()} badgeKeys={loadBadgeKeys()} schools={loadSchoolGroups()} />
      <SourceFooter fetchedAt={loadSeasonData(latest.seasonCode)?.fetchedAt} wide />
    </>
  );
}
