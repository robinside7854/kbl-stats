// 업데이트 소식 글 한 편 (/updates/{slug}, 정적). 글은 lib/updates.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { shareMetadata } from "@/lib/share";
import { listSeasonsWithPlayers } from "@/lib/data";
import { formatPostDate, postBySlug, UPDATE_KIND_LABELS, UPDATE_POSTS } from "@/lib/updates";
import { IconChevronLeft } from "@/app/components/icons";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";
import UpdatePostBody from "@/app/components/UpdatePostBody";
import { UpdateAuthor, UpdatePostGuard } from "@/app/components/UpdateAdmin";

export const dynamicParams = false;

export function generateStaticParams() {
  return UPDATE_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = postBySlug((await params).slug);
  if (!post) return {};
  return shareMetadata({ title: `${post.title} · KBL - Stats Reference`, description: post.summary, path: `/updates/${post.slug}` });
}

export default async function UpdatePostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = postBySlug((await params).slug);
  if (!post) notFound();
  const seasons = listSeasonsWithPlayers();
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={seasons[0]?.seasonCode ?? 0} view="updates" />
      <main className="mx-auto max-w-3xl px-4 pb-6 pt-5">
        <Link
          href="/updates"
          className="focus-ring inline-flex h-10 items-center gap-1 rounded-control border border-line bg-surface pl-2 pr-3 text-sub font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
        >
          <IconChevronLeft size={16} />
          목록
        </Link>
        <UpdatePostGuard slug={post.slug}>
          <article className="mt-4">
            <p className="flex items-center gap-2 text-caption text-ink-3">
              <span className="font-semibold">{UPDATE_KIND_LABELS[post.kind]}</span>
              <span className="tabular">{formatPostDate(post.date)}</span>
              <UpdateAuthor />
            </p>
            <h1 className="mt-1 text-h1 font-black">{post.title}</h1>
            <div className="surface-card mt-4 rounded-container px-4 py-4">
              <UpdatePostBody blocks={post.blocks} />
            </div>
          </article>
        </UpdatePostGuard>
        {/* 글 끝에서도 목록으로 (2026-10-05 사용자: 위 글자 링크는 누르는 곳인지 애매) */}
        <Link
          href="/updates"
          className="focus-ring mt-4 flex h-11 w-full items-center justify-center gap-1 rounded-control border border-line bg-surface text-body font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
        >
          <IconChevronLeft size={16} />
          목록으로
        </Link>
      </main>
      <SourceFooter />
    </>
  );
}
