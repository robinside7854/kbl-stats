"use client";
// 헤더 아래 띠배너 (2026-10-05): 업데이트 소식 맨 위 글(lib/updates latestPost)을 모든 화면에 띄운다.
// 닫으면 이 브라우저가 그 글 번호를 기억해 숨기고, 더 새 글이 올라오면 다시 보인다(localStorage, 저장 못 하면 이번 화면에서만 숨김).
import { useEffect, useState } from "react";
import Link from "next/link";
import { latestPost, shouldShowBanner } from "@/lib/updates";
import { IconChevronRight, IconClose } from "./icons";
import { trackEvent } from "./track";

const STORAGE_KEY = "kbl-stats:update-banner:v1";
const LATEST = latestPost();

export default function UpdateBanner() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      if (!shouldShowBanner(LATEST?.slug ?? null, window.localStorage.getItem(STORAGE_KEY))) setHidden(true);
    } catch {
      // 저장소를 못 쓰면 그냥 보인다
    }
  }, []);

  if (!LATEST || hidden) return null;
  const slug = LATEST.slug;

  function dismiss() {
    setHidden(true);
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
          <span className="min-w-0 truncate font-semibold text-ink">{LATEST.summary}</span>
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
