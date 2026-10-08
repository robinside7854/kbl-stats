// 알림함 (/notifications, 2026-10-08): 즐겨찾기 선수·응원팀의 최근 경기 소식. 헤더 종으로 들어온다(메뉴 없음).
// 정적 페이지 — 내 것 고르기·읽음은 브라우저(NotificationsView, lib/notifications).
import type { Metadata } from "next";
import { listSeasonsWithPlayers } from "@/lib/data";
import NotificationsView from "@/app/components/NotificationsView";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = {
  title: "알림 · KBL - Stats Reference",
  robots: { index: false, follow: false },
};

export default function NotificationsPage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0]?.seasonCode ?? 0;
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest} view="notifications" />
      <main className="mx-auto max-w-3xl px-4 pb-6 pt-5">
        <NotificationsView />
      </main>
      <SourceFooter />
    </>
  );
}
