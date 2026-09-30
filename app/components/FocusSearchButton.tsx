"use client";
// 홈의 "선수 검색" 큰 버튼: 상단 SiteNav 검색창(data-site-search)으로 포커스를 옮긴다.
// 검색창은 SiteNav 가 이미 갖고 있으므로 홈에 검색창을 하나 더 두지 않는다.
export default function FocusSearchButton({ className = "", children }: { className?: string; children: React.ReactNode }) {
  function focus() {
    const input = document.querySelector<HTMLInputElement>("input[data-site-search]");
    if (!input) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    input.focus({ preventScroll: true });
  }
  return (
    <button type="button" onClick={focus} className={className}>
      {children}
    </button>
  );
}
