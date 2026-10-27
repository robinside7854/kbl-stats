// 54-0 결과 공유 페이지 (2026-10-27): /game/r/{라인업} — 카톡·X 로 보낸 결과 링크가 여기로 온다.
// 받은 사람에게는 54-0 화면이 그 결과로 열리고("나도 해 보기"), 링크 미리보기는 이 결과 그림(/game/og/{라인업}).
// 라인업마다 처음 열릴 때 한 번 그리고 하루 동안 저장해 둔다(ISR) — 검색에는 올리지 않는다(noindex).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { gameResultImagePath, gameResultPath, recordLabel } from "@/lib/game-share";
import { resultVerdict } from "@/lib/game";
import { shareMetadata } from "@/lib/share";
import { listSeasonsWithPlayers, loadSeasonData } from "@/lib/data";
import { loadSharedGameResult } from "@/lib/server/game-result";
import GameView from "@/app/components/GameView";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Params = Promise<{ lineup: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lineup: slug } = await params;
  const shared = await loadSharedGameResult(slug);
  if (!shared) return { title: "54-0 · KBL - Stats Reference", robots: { index: false } };
  const { result, players } = shared;
  const names = players.map((p) => `${p.c.nameKo}(${p.c.season})`).join(" · ");
  return {
    ...shareMetadata({
      title: `54-0 ${recordLabel(result.wins)} · ${resultVerdict(result.wins)}`,
      description: `${names}. 내 라인업으로 이 기록 넘을 수 있을까요?`,
      path: gameResultPath(slug),
      image: gameResultImagePath(slug),
      imageAlt: `54-0 결과 ${recordLabel(result.wins)}`,
    }),
    robots: { index: false, follow: true },
  };
}

export default async function GameResultPage({ params }: { params: Params }) {
  const { lineup: slug } = await params;
  const shared = await loadSharedGameResult(slug);
  if (!shared) notFound();
  const seasons = listSeasonsWithPlayers();
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={seasons[0]?.seasonCode ?? 0} view="game" />
      <GameView sharedLineup={shared.lineup} />
      <SourceFooter fetchedAt={seasons[0] ? loadSeasonData(seasons[0].seasonCode)?.fetchedAt : undefined} />
    </>
  );
}
