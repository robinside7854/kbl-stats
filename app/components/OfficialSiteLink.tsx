"use client";
// 푸터 "KBL 공식 홈페이지" 버튼 (2026-10-17) — 누르면 GA4 official_link_click place=footer
import { officialHomeUrl } from "@/lib/official";
import { IconExternal } from "./icons";
import { trackEvent } from "./track";

export default function OfficialSiteLink() {
  return (
    <a
      href={officialHomeUrl()}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("official_link_click", { place: "footer" })}
      className="focus-ring mb-4 ml-2 inline-flex h-10 items-center gap-1 rounded-control border border-line bg-surface px-3 text-sub font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
    >
      KBL 공식 홈페이지 <IconExternal size={16} />
    </a>
  );
}
