// 업데이트 소식 글 본문 (lib/updates 블록 → 글자). HTML 을 넣지 않고 글자·사이트 안 링크만 그린다.
import Link from "next/link";
import { itemHref, itemText, type UpdateBlock, type UpdateItem } from "@/lib/updates";
import { IconChevronRight } from "./icons";

function Item({ item }: { item: UpdateItem }) {
  const href = itemHref(item);
  if (!href) return <>{itemText(item)}</>;
  // 문장은 그대로 읽히게 두고, 끝에 작은 "보기" 버튼
  return (
    <>
      {itemText(item)}{" "}
      <Link
        href={href}
        className="focus-ring link-shortcut ml-0.5 whitespace-nowrap text-sub"
      >
        보기
        <IconChevronRight size={16} />
      </Link>
    </>
  );
}

export default function UpdatePostBody({ blocks }: { blocks: UpdateBlock[] }) {
  return (
    <div className="space-y-3 text-body leading-relaxed text-ink-2">
      {blocks.map((b, i) => {
        if (b.kind === "h")
          return (
            <h2 key={i} className="pt-3 text-h2 font-bold text-ink">
              {b.text}
            </h2>
          );
        if (b.kind === "p") return <p key={i}>{b.text}</p>;
        const Tag = b.kind === "steps" ? "ol" : "ul";
        return (
          <Tag key={i} className={`space-y-1.5 pl-5 ${b.kind === "steps" ? "list-decimal" : "list-disc"} marker:text-ink-3`}>
            {b.items.map((it, j) => (
              <li key={j}>
                <Item item={it} />
              </li>
            ))}
          </Tag>
        );
      })}
    </div>
  );
}
