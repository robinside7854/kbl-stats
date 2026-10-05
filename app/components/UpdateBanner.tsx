"use client";
// 헤더 아래 띠배너 (2026-10-05): 업데이트 소식 맨 위 글(lib/updates latestPost)을 모든 화면에 띄운다.
// 닫으면 이 브라우저가 그 글 번호를 기억해 숨기고, 더 새 글이 올라오면 다시 보인다(localStorage, 저장 못 하면 이번 화면에서만 숨김).
// 관리자가 지운 글(useHiddenUpdates)은 건너뛰고 그다음 글을 띄운다 — 맨 위 글을 이미 닫은 브라우저는 지운 글 목록을 부르지 않는다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { bannerPost, latestPost, type UpdatePost } from "@/lib/updates";
import { IconChevronRight, IconClose } from "./icons";
import { trackEvent } from "./track";
import { useHiddenUpdates } from "./useHiddenUpdates";

const STORAGE_KEY = "kbl-stats:update-banner:v1";
const LATEST = latestPost();

export default function UpdateBanner() {
  const [dismissed, setDismissed] = useState<string | null | undefined>(undefined); // undefined = 아직 안 읽음
  const hidden = useHiddenUpdates(dismissed !== undefined && dismissed !== LATEST?.slug);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      setDismissed(null); // 저장소를 못 쓰면 그냥 보인다
    }
  }, []);

  // 정적 HTML·불러오는 중에는 맨 위 글 그대로(대부분 그대로라 깜빡임 없게), 지운 글 목록이 오면 다시 고른다
  const post: UpdatePost | null = dismissed === undefined ? LATEST : bannerPost(hidden ?? [], dismissed);
  if (!post) return null;
  const slug = post.slug;

  function dismiss() {
    setDismissed(slug);
    trackEvent("update_banner_dismiss", { post_slug: slug });
    try {
      window.localStorage.setItem(STORAGE_KEY, slug);
    } catch {
      // 이번 화면에서만 숨김
    }
  }

  return (
    <div className="border-t border-line bg-series-1/10">
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-4">
        <Link
          href={`/updates/${slug}`}
          onClick={() => trackEvent("update_banner_click", { post_slug: slug })}
          className="focus-ring-inset flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-control py-1.5 text-sub"
        >
          <span className="shrink-0 rounded-control bg-series-1 px-1.5 py-0.5 text-caption font-bold text-white">새 소식</span>
          <span className="min-w-0 truncate font-semibold text-ink">{post.summary}</span>
          <IconChevronRight size={16} className="shrink-0 text-ink-3" />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="업데이트 알림 닫기"
          className="focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-ink-3 transition-colors duration-200 hover:text-ink"
        >
          <IconClose size={16} />
        </button>
      </div>
    </div>
  );
}
