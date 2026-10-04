"use client";
// 헤더 "랜덤 카드" 버튼 (2026-10-01 재미 요소): 누르면 무작위 선수 한 명의 카드(프라임 시즌이 있으면 그 시즌)로 간다.
// 선수 목록은 우리 정적 파일 /search-index.json (useSearchIndex) — KBL 호출 아님. 뽑기 규칙은 lib/search pickRandomCard.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { pickRandomCard } from "@/lib/search";
import { playerHref } from "@/lib/cardview";
import { IconDice } from "./icons";
import { loadSearchIndex } from "./useSearchIndex";
import { trackEvent } from "./track";

export default function RandomCardButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function draw() {
    setBusy(true);
    try {
      const pick = pickRandomCard(await loadSearchIndex());
      if (pick) trackEvent("random_card", { player_no: pick.id, season_code: pick.seasonCode });
      if (pick) router.push(playerHref(pick.id, pick.seasonCode));
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={draw}
      disabled={busy}
      aria-label="랜덤 카드 뽑기: 무작위 선수의 카드로 이동"
      className={`focus-ring inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-control border border-line bg-surface text-sub min-[400px]:w-auto min-[400px]:px-3 font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink disabled:cursor-wait ${className}`}
    >
      <IconDice size={16} />
      {/* 400px 미만 폰은 공유 버튼과 한 줄에 들어가게 아이콘만 (읽기 이름은 aria-label) */}
      <span className="hidden min-[400px]:inline">랜덤 카드</span>
    </button>
  );
}
