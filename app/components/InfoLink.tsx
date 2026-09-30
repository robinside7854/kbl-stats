// ⓘ 아이콘 → 용어 탭의 해당 항목 (/glossary#앵커). 앵커는 lib/glossary GLOSSARY_ANCHORS.
// 누르는 영역은 40×40(C1), 음수 여백으로 글줄 높이·간격은 아이콘(16px) 크기만큼만 차지한다.
// compact: 표 머리글처럼 옆 칸이 붙어 있는 곳 — 높이 40, 폭 20.
import Link from "next/link";
import { glossaryEntry, glossaryHref, type GlossaryKey } from "@/lib/glossary";
import { IconInfo } from "./icons";

export default function InfoLink({ term, className = "", compact = false }: { term: GlossaryKey; className?: string; compact?: boolean }) {
  const name = glossaryEntry(term)?.name ?? "용어";
  return (
    <Link
      href={glossaryHref(term)}
      aria-label={`${name} 설명 보기`}
      title={`${name}: ${glossaryEntry(term)?.short ?? ""}`}
      className={`focus-ring inline-flex shrink-0 items-center justify-center rounded-control align-middle text-ink-3 transition-colors duration-200 hover:text-ink ${
        compact ? "h-10 w-5" : "-mx-3 -my-3 h-10 w-10"
      } ${className}`}
    >
      <IconInfo size={16} />
    </Link>
  );
}
