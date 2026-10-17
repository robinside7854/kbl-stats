"use client";
// 푸터 "회원 목록" 버튼 (2026-10-17) — 관리자(/api/me isAdmin)에게만 보인다. 판정은 서버, 목록 API 도 관리자만 연다.
// 로그인한 적 없는 브라우저는 /api/me 를 부르지 않는다(useMember). 누르면 nav_click menu=회원 목록 place=footer
import Link from "next/link";
import { trackEvent } from "./track";
import { useMember } from "./useLikes";

export default function AdminFooterLink() {
  const member = useMember();
  if (!member?.isAdmin) return null;
  return (
    <Link
      href="/admin"
      onClick={() => trackEvent("nav_click", { menu: "회원 목록", place: "footer" })}
      className="focus-ring mb-4 ml-2 inline-flex h-10 items-center rounded-control border border-line bg-surface px-3 text-sub font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
    >
      회원 목록
    </Link>
  );
}
