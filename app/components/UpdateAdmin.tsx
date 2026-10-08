"use client";
// 업데이트 소식 목록·삭제 (2026-10-05, 2026-10-08 개편): 10개씩 쪽 나눔(?page=), 글쓴이 "로방 · 운영자".
// 관리자만 삭제 — 누르면 바로 영구 삭제(되돌리기 없음, 관리자에게도 안 보임). 지운 글 번호는 DB hidden_updates 에 남아 모두에게서 빠진다.
// 관리자 판정은 서버(/api/me isAdmin, /api/updates/hidden POST)가 한다.
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatPostDate, paginate, parsePageParam, UPDATE_AUTHOR, UPDATE_KIND_LABELS, type UpdatePost } from "@/lib/updates";
import { IconChevronLeft, IconChevronRight } from "./icons";
import { trackEvent } from "./track";
import { saveHiddenUpdate, useHiddenUpdates, useIsAdmin } from "./useHiddenUpdates";

function DeleteButton({ slug }: { slug: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function remove() {
    if (!window.confirm("이 글을 영구 삭제할까요? 되돌릴 수 없어요.")) return;
    setBusy(true);
    setError(false);
    const ok = await saveHiddenUpdate(slug, true);
    setBusy(false);
    if (!ok) setError(true);
    else trackEvent("update_post_delete", { post_slug: slug });
  }
  return (
    <span className="flex shrink-0 items-center gap-2">
      {error && <span className="text-caption text-ink-3">실패했어요</span>}
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="focus-ring inline-flex h-10 items-center rounded-control border border-line bg-surface px-3 text-sub font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink disabled:opacity-60"
      >
        {busy ? "삭제 중" : "삭제"}
      </button>
    </span>
  );
}

/** 글쓴이 표시: "로방 · 운영자" */
export function UpdateAuthor() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-semibold text-ink-2">{UPDATE_AUTHOR}</span>
      <span className="rounded-control bg-surface-2 px-1.5 py-0.5 font-semibold text-ink-2">운영자</span>
    </span>
  );
}

/** 쪽 번호 줄: ‹ 1 2 3 › (주소 /updates?page=N) */
function Pager({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const href = (n: number) => (n === 1 ? "/updates" : `/updates?page=${n}`);
  const cls = "focus-ring inline-flex h-10 min-w-10 items-center justify-center rounded-control border px-2 text-sub font-semibold transition-colors duration-200";
  const idle = "border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink";
  return (
    <nav aria-label="업데이트 소식 쪽" className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={href(page - 1)} className={`${cls} ${idle}`} aria-label="이전 쪽">
          <IconChevronLeft size={16} />
        </Link>
      )}
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <Link
          key={n}
          href={href(n)}
          aria-current={n === page ? "page" : undefined}
          className={`${cls} tabular ${n === page ? "border-ink bg-ink text-bg" : idle}`}
        >
          {n}
        </Link>
      ))}
      {page < totalPages && (
        <Link href={href(page + 1)} className={`${cls} ${idle}`} aria-label="다음 쪽">
          <IconChevronRight size={16} />
        </Link>
      )}
    </nav>
  );
}

/** 목록 한 쪽 — 지운 글은 모두에게서 빠진다(영구 삭제, 2026-10-08 사용자). page 는 1부터 */
export function UpdateListView({ posts, page }: { posts: UpdatePost[]; page: number }) {
  const hidden = useHiddenUpdates();
  const admin = useIsAdmin();
  const hiddenSet = new Set(hidden ?? []);
  const shown = posts.filter((p) => !hiddenSet.has(p.slug));
  if (shown.length === 0) return <p className="surface-card mt-4 rounded-container px-4 py-6 text-center text-sub text-ink-2">아직 올라온 소식이 없어요.</p>;
  const pg = paginate(shown, page);
  return (
    <>
      <ul className="surface-card mt-4 divide-y divide-line rounded-container">
        {pg.items.map((p) => (
          <li key={p.slug} className="flex items-center gap-2 pr-3">
            <Link
              href={`/updates/${p.slug}`}
              className="focus-ring-inset flex min-h-12 min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-3">
                  <span className={`rounded-control px-1.5 py-0.5 font-semibold ${p.kind === "guide" ? "bg-surface-2 text-ink-2" : "bg-series-1/15 text-series-1"}`}>
                    {UPDATE_KIND_LABELS[p.kind]}
                  </span>
                  <span className="tabular">{formatPostDate(p.date)}</span>
                  <UpdateAuthor />
                </span>
                <span className="mt-1 block text-body font-bold text-ink">{p.title}</span>
                <span className="mt-0.5 block text-sub text-ink-2">{p.summary}</span>
              </span>
              {!admin && <IconChevronRight size={20} className="shrink-0 text-ink-3" />}
            </Link>
            {admin && <DeleteButton slug={p.slug} />}
          </li>
        ))}
      </ul>
      <Pager page={pg.page} totalPages={pg.totalPages} />
    </>
  );
}

/** 주소의 ?page= 를 읽는 목록 (정적 페이지라 Suspense 안에서 쓴다 — app/updates/page.tsx) */
export function UpdateList({ posts }: { posts: UpdatePost[] }) {
  const page = parsePageParam(useSearchParams().get("page"));
  return <UpdateListView posts={posts} page={page} />;
}

/** 글 한 편 — 지운 글이면 모두에게 안내만, 관리자에게는 위에 삭제 버튼 */
export function UpdatePostGuard({ slug, children }: { slug: string; children: ReactNode }) {
  const hidden = useHiddenUpdates();
  const admin = useIsAdmin();
  const isHidden = (hidden ?? []).includes(slug);
  if (isHidden) {
    return (
      <div className="surface-card mt-4 rounded-container px-4 py-8 text-center">
        <p className="text-body font-semibold text-ink">삭제된 글이에요.</p>
        <Link href="/updates" className="link-shortcut mt-2 inline-flex items-center gap-1 text-sub">
          <IconChevronLeft size={16} />
          다른 소식 보기
        </Link>
      </div>
    );
  }
  return (
    <>
      {admin && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-container border border-line px-4 py-2">
          <span className="text-sub text-ink-2">관리자 · 삭제하면 바로 영구 삭제돼요</span>
          <DeleteButton slug={slug} />
        </div>
      )}
      {children}
    </>
  );
}
