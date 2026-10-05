// 업데이트 소식 목록 (/updates, 2026-10-05). 글은 lib/updates UPDATE_POSTS, 새 글 먼저. 들어오는 길: 헤더 아래 띠배너·푸터 링크.
import type { Metadata } from "next";
import Link from "next/link";
import { shareMetadata } from "@/lib/share";
import { listSeasonsWithPlayers } from "@/lib/data";
import { formatPostDate, sortedPosts, UPDATE_KIND_LABELS } from "@/lib/updates";
import { IconChevronRight } from "@/app/components/icons";
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
        <ul className="surface-card mt-4 divide-y divide-line rounded-container">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/updates/${p.slug}`}
                className="focus-ring-inset flex min-h-12 items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-caption text-ink-3">
                    <span className={`rounded-control px-1.5 py-0.5 font-semibold ${p.kind === "guide" ? "bg-surface-2 text-ink-2" : "bg-series-1/15 text-series-1"}`}>
                      {UPDATE_KIND_LABELS[p.kind]}
                    </span>
                    <span className="tabular">{formatPostDate(p.date)}</span>
                  </span>
                  <span className="mt-1 block text-body font-bold text-ink">{p.title}</span>
                  <span className="mt-0.5 block text-sub text-ink-2">{p.summary}</span>
                </span>
                <IconChevronRight size={20} className="shrink-0 text-ink-3" />
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SourceFooter />
    </>
  );
}
