// 업데이트 소식 글 한 편 (/updates/{slug}, 정적). 글은 lib/updates.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { shareMetadata } from "@/lib/share";
import { listSeasonsWithPlayers } from "@/lib/data";
import { formatPostDate, postBySlug, UPDATE_KIND_LABELS, UPDATE_POSTS } from "@/lib/updates";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";
import UpdatePostBody from "@/app/components/UpdatePostBody";

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
        <Link href="/updates" className="focus-ring inline-flex h-10 items-center rounded-control text-sub font-semibold text-ink-2 hover:text-ink">
          업데이트 소식
        </Link>
        <article className="mt-1">
          <p className="flex items-center gap-2 text-caption text-ink-3">
            <span className="font-semibold">{UPDATE_KIND_LABELS[post.kind]}</span>
            <span className="tabular">{formatPostDate(post.date)}</span>
          </p>
          <h1 className="mt-1 text-h1 font-black">{post.title}</h1>
          <div className="surface-card mt-4 rounded-container px-4 py-4">
            <UpdatePostBody blocks={post.blocks} />
          </div>
        </article>
      </main>
      <SourceFooter />
    </>
  );
}
