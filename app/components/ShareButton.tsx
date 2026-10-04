"use client";
// 헤더 공유 버튼 (2026-10-04 사용자 요청: 카카오톡·외부 공유). 지금 보고 있는 주소(필터·시즌 쿼리 포함)를 공유한다.
// 폰: 기기 공유 창(navigator.share — 카카오톡·메시지 등이 뜬다). 공유 창이 없는 PC 브라우저: 주소를 복사하고 "복사했습니다" 안내.
// 링크 카드(제목·설명·썸네일)는 받는 쪽 앱이 페이지의 Open Graph 메타를 읽어 그린다 (lib/share, scripts/build-og.tsx).
// GA4: share_click {method: native|copy, page}. 공유 창을 닫기만 한 경우(AbortError)도 누른 것으로 센다.
import { useEffect, useState } from "react";
import { sharePageOf } from "@/lib/share";
import { IconShare } from "./icons";
import { trackEvent } from "./track";

export default function ShareButton({ className = "" }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function share() {
    const url = window.location.href;
    const page = sharePageOf(window.location.pathname);
    if (typeof navigator.share === "function") {
      trackEvent("share_click", { method: "native", page });
      try {
        await navigator.share({ title: document.title, url });
      } catch {
        // 사용자가 공유 창을 닫음 — 할 일 없음
      }
      return;
    }
    trackEvent("share_click", { method: "copy", page });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("이 주소를 복사해 공유하세요", url);
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={share}
        aria-label="이 화면 공유하기"
        title="공유"
        className={`focus-ring inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-control border border-line bg-surface text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink ${className}`}
      >
        <IconShare size={20} />
      </button>
      <span
        role="status"
        aria-live="polite"
        className={`pointer-events-none absolute right-0 top-full z-50 mt-1 whitespace-nowrap rounded-control bg-ink px-2.5 py-1.5 text-caption font-semibold text-bg ${copied ? "" : "hidden"}`}
      >
        {copied ? "링크를 복사했습니다" : ""}
      </span>
    </span>
  );
}
