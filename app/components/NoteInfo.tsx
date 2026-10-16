"use client";
// 화면에 늘 떠 있던 설명 문장을 ⓘ 안으로 (2026-10-16 디자인 정리 M4 — 사용자 결정, "설명은 ⓘ 팝오버에만" 규칙).
// 제목 옆에 두는 작은 ⓘ — 누르면 그 자리 팝오버(HelpPopover). GA4 help_open topic = title.
import HelpPopover from "./HelpPopover";

export default function NoteInfo({ title, text, href = "/glossary", className = "" }: { title: string; text: string; href?: string; className?: string }) {
  return <HelpPopover content={{ title, short: text, formula: null, href }} ariaLabel={`${title} 보기`} className={className} />;
}
