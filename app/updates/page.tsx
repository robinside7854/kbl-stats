// 업데이트 소식 목록 (/updates, 2026-10-05). 글은 lib/updates UPDATE_POSTS, 새 글 먼저. 들어오는 길: 헤더 아래 띠배너·푸터 링크. 관리자가 지운 글은 UpdateList 가 빼고, 10개씩 쪽을 나눈다(?page=).
import type { Metadata } from "next";
import { shareMetadata } from "@/lib/share";
import { listSeasonsWithPlayers } from "@/lib/data";
import { sortedPosts } from "@/lib/updates";
import { Suspense } from "react";
import { UpdateList, UpdateListView } from "@/app/components/UpdateAdmin";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = shareMetadata({
  title: "업데이트 소식 · KBL - Stats Reference",
  description: "새로 생긴 기능과 이용 가이드. 비영리 팬 프로젝트.",
  path: "/updates",
});

export default function UpdatesPage() {
  const seasons = listSeasonsWithPlayers();
  const posts = sortedPosts();
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={seasons[0]?.seasonCode ?? 0} view="updates" />
      <main className="mx-auto max-w-3xl px-4 pb-6 pt-5">
        <h1 className="text-h1 font-black">업데이트 소식</h1>
        {/* ?page= 는 브라우저에서 읽는다 — 정적 HTML 은 첫 쪽 */}
        <Suspense fallback={<UpdateListView posts={posts} page={1} />}>
          <UpdateList posts={posts} />
        </Suspense>
      </main>
      <SourceFooter />
    </>
  );
}
