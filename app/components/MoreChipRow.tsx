"use client";
// 칩이 많은 필터 묶음 (선수 탭 출신교·칭호, 2026-10-06 사용자: 필터가 너무 길다): 처음엔 앞 limit 개만, "더 보기"로 전부.
// 고른 칩이 뒤쪽에 있으면 접혀 있어도 보이게 한 칸 더 붙인다.
import { useState } from "react";
import ChipRow, { type Chip } from "./ChipRow";

export default function MoreChipRow<T extends string | number>({
  label,
  chips,
  value,
  onChange,
  limit = 8,
}: {
  label: string;
  chips: Chip<T>[];
  value: T;
  onChange: (v: T) => void;
  limit?: number;
}) {
  const [open, setOpen] = useState(false);
  const hidden = chips.length - limit;
  let shown = open || hidden <= 0 ? chips : chips.slice(0, limit);
  if (!shown.some((c) => c.value === value)) {
    const cur = chips.find((c) => c.value === value);
    if (cur) shown = [...shown, cur];
  }
  return (
    <div>
      <ChipRow label={label} chips={shown} value={value} onChange={onChange} />
      {hidden > 0 && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="focus-ring link-shortcut mt-1 cursor-pointer text-sub"
        >
          {open ? "접기" : `더 보기 (${hidden}개)`}
        </button>
      )}
    </div>
  );
}
