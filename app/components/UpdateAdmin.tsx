"use client";
// 업데이트 소식 삭제 (2026-10-05 사용자 요청): 관리자만 글을 지우고 되돌린다. 지운 글은 모두에게 목록·띠배너·글 화면에서 숨는다.
// 관리자에게는 지운 글도 흐리게 보여 '되돌리기'를 둔다. 관리자 판정은 서버(/api/me isAdmin, /api/updates/hidden POST)가 한다.
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { formatPostDate, UPDATE_KIND_LABELS, type UpdatePost } from "@/lib/updates";
import { IconChevronLeft, IconChevronRight } from "./icons";
import { trackEvent } from "./track";
import { saveHiddenUpdate, useHiddenUpdates, useIsAdmin } from "./useHiddenUpdates";

function AdminToggle({ slug, hidden }: { slug: string; hidden: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function toggle() {
    if (!hidden && !window.confirm("이 글을 삭제할까요? 모든 사람에게서 숨겨지고, 관리자는 되돌릴 수 있어요.")) return;
    setBusy(true);
    setError(false);
    const ok = await saveHiddenUpdate(slug, !hidden);
    setBusy(false);
    if (!ok) setError(true);
    else trackEvent(hidden ? "update_post_restore" : "update_post_delete", { post_slug: slug });
  }
  return (
    <span className="flex shrink-0 items-center gap-2">
      {error && <span className="text-caption text-ink-3">실패했어요</span>}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="focus-ring inline-flex h-10 items-center rounded-control border border-line bg-surface px-3 text-sub font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink disabled:opacity-60"
      >
        {busy ? "저장 중" : hidden ? "되돌리기" : "삭제"}
      </button>
    </span>
  );
}

/** 목록 (/updates) — 지운 글은 숨기고, 관리자에게는 흐리게 + 되돌리기 */
export function UpdateList({ posts }: { posts: UpdatePost[] }) {
  const hidden = useHiddenUpdates();
  const admin = useIsAdmin();
  const hiddenSet = new Set(hidden ?? []);
  const shown = admin ? posts : posts.filter((p) => !hiddenSet.has(p.slug));
  if (shown.length === 0) return <p className="surface-card mt-4 rounded-container px-4 py-6 text-center text-sub text-ink-2">아직 올라온 소식이 없어요.</p>;
  return (
    <ul className="surface-card mt-4 divide-y divide-line rounded-container">
      {shown.map((p) => {
        const isHidden = hiddenSet.has(p.slug);
        return (
          <li key={p.slug} className="flex items-center gap-2 pr-3">
            <Link
              href={`/updates/${p.slug}`}
              className={`focus-ring-inset flex min-h-12 min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-surface-2 ${isHidden ? "opacity-50" : ""}`}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-caption text-ink-3">
                  <span className={`rounded-control px-1.5 py-0.5 font-semibold ${p.kind === "guide" ? "bg-surface-2 text-ink-2" : "bg-series-1/15 text-series-1"}`}>
                    {UPDATE_KIND_LABELS[p.kind]}
                  </span>
                  <span className="tabular">{formatPostDate(p.date)}</span>
                  {isHidden && <span className="font-semibold">삭제됨</span>}
                </span>
                <span className="mt-1 block text-body font-bold text-ink">{p.title}</span>
                <span className="mt-0.5 block text-sub text-ink-2">{p.summary}</span>
              </span>
              {!admin && <IconChevronRight size={20} className="shrink-0 text-ink-3" />}
            </Link>
            {admin && <AdminToggle slug={p.slug} hidden={isHidden} />}
          </li>
        );
      })}
    </ul>
  );
}

/** 글 한 편 — 지운 글이면 안내만(관리자는 글 + 되돌리기), 관리자에게는 위에 삭제 버튼 */
export function UpdatePostGuard({ slug, children }: { slug: string; children: ReactNode }) {
  const hidden = useHiddenUpdates();
  const admin = useIsAdmin();
  const isHidden = (hidden ?? []).includes(slug);
  if (isHidden && !admin) {
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
          <span className="text-sub text-ink-2">{isHidden ? "삭제한 글이에요. 관리자에게만 보여요." : "관리자"}</span>
          <AdminToggle slug={slug} hidden={isHidden} />
        </div>
      )}
      {children}
    </>
  );
}
