// 비교 탭 (/compare?a=번호:코드&b=번호:코드) — 정적 1페이지. 다른 선수·다른 시즌·같은 선수 두 시즌 모두 가능.
// 정적 HTML에는 기본 비교(최신 시즌 PER 1위 vs 직전 시즌 PER 1위 — 카드 파일 defaults.defaultPlayerId)를 서버가 계산해 넣고,
// 주소에 다른 선수가 있으면 브라우저가 /cards/{코드}.json·/search-index.json(우리 정적 파일)을 받아 다시 그린다.
import type { Metadata } from "next";
import { findPlayerIndexEntry, listSeasonsWithPlayers, loadPrimeSeason, loadSeasonCards, loadSeasonData } from "@/lib/data";
import { buildSeasonCardView } from "@/lib/cardview";
import CompareView, { type SlotInit } from "@/app/components/CompareView";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = {
  title: "선수 비교 · KBL - Stats Reference",
  description: "KBL 두 선수(또는 한 선수의 두 시즌) 플레이어 카드를 나란히 놓고 스탯·등급 비교. 비영리 팬 프로젝트.",
};

/** 시즌의 기본 선수(PER 1위) 슬롯 — 없으면 null */
function defaultSlot(seasonCode: number | undefined): SlotInit | null {
  if (seasonCode === undefined) return null;
  const cards = loadSeasonCards(seasonCode);
  const id = cards?.defaults.defaultPlayerId;
  const view = cards && id ? buildSeasonCardView(cards, id, "all") : null;
  const entry = id ? findPlayerIndexEntry(id) : null;
  if (!view || !entry) return null;
  return { id: entry.id, nameKo: entry.nameKo, seasons: entry.seasons.map((s) => s.seasonCode), view, prime: loadPrimeSeason(entry.id) ?? undefined };
}

export default function ComparePage() {
  const seasons = listSeasonsWithPlayers();
  const a = defaultSlot(seasons[0]?.seasonCode);
  const b = defaultSlot(seasons[1]?.seasonCode) ?? a;
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={seasons[0]?.seasonCode ?? 0} view="compare" wide />
      <CompareView seasons={seasons} initialA={a} initialB={b} />
      <SourceFooter fetchedAt={seasons[0] ? loadSeasonData(seasons[0].seasonCode)?.fetchedAt : undefined} wide />
    </>
  );
}
