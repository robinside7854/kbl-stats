// ⓘ 아이콘 → 용어 탭의 해당 항목 (/glossary#앵커). 앵커는 lib/glossary GLOSSARY_ANCHORS.
import Link from "next/link";
import { glossaryEntry, glossaryHref, type GlossaryKey } from "@/lib/glossary";

export default function InfoLink({ term, className = "" }: { term: GlossaryKey; className?: string }) {
  const name = glossaryEntry(term)?.name ?? "용어";
  return (
    <Link
      href={glossaryHref(term)}
      aria-label={`${name} 설명 보기`}
      title={`${name}: ${glossaryEntry(term)?.short ?? ""}`}
      className={`inline-flex items-center justify-center font-normal text-ink-3 hover:text-ink ${className}`}
    >
      ⓘ
    </Link>
  );
}
