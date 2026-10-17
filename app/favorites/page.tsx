// 즐겨찾기 (/favorites, 2026-10-17): 헤더 별 버튼으로 들어온다(아래 메뉴 없음). 정적 페이지 — 목록은 브라우저(FavoritesView).
import type { Metadata } from "next";
import { listSeasonsWithPlayers } from "@/lib/data";
import FavoritesView from "@/app/components/FavoritesView";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = {
  title: "즐겨찾기 · KBL - Stats Reference",
  robots: { index: false, follow: false },
};

export default function FavoritesPage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0]?.seasonCode ?? 0;
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest} view="favorites" />
      <main className="mx-auto max-w-page px-4 pb-6 pt-5">
        <FavoritesView />
      </main>
      <SourceFooter />
    </>
  );
}
