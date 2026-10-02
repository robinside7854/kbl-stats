// 54-0 게임 (2026-10-02 — 82-0.com 의 KBL 판, 규칙은 lib/game.ts). 정적 1페이지.
// 후보 풀은 빌드 전에 만든 우리 정적 파일 /game/pool.json 을 브라우저가 받는다 (scripts/build-game.ts).
// 공유 주소 ?l=번호:시즌,… 이면 그 라인업 결과를 바로 보여 준다 (같은 라인업 = 같은 성적).
import type { Metadata } from "next";
import { listSeasonsWithPlayers, loadSeasonData } from "@/lib/data";
import GameView from "@/app/components/GameView";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = {
  title: "54-0 · KBL - Stats Reference",
  description: "시대와 팀을 무작위로 뽑아 KBL 역대 주전 5명을 꾸리고 54전 전승에 도전하세요. 비영리 팬 프로젝트.",
};

export default function GamePage() {
  const seasons = listSeasonsWithPlayers();
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={seasons[0]?.seasonCode ?? 0} view="game" />
      <GameView />
      <SourceFooter fetchedAt={seasons[0] ? loadSeasonData(seasons[0].seasonCode)?.fetchedAt : undefined} />
    </>
  );
}
