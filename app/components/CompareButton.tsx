"use client";
// 선수 상세 "비교" 버튼 (2026-10-03 사용자: 비교 탭을 메뉴에서 빼고, 선수 상세에서 비교할 선수를 검색해 비교).
// 누르면 검색 창(PlayerSearch 선택 모드)이 열리고, 고른 선수와 비교 화면(/compare?a=&b=)으로 이동한다.
//  - A = 이 선수의 지금 보고 있는 시즌(주소 ?season=, 없으면 최근 시즌)
//  - B = 고른 선수가 같은 시즌에 뛰었으면 그 시즌, 아니면 그 선수의 마지막 시즌
// GA4: compare_open {player_no} (검색에서 고르는 것은 PlayerSearch 의 search_select mode=compare).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchEntry } from "@/lib/types";
import { compareHref } from "@/lib/cardview";
import { IconClose, IconCompare } from "./icons";
import PlayerSearch from "./PlayerSearch";
import { trackEvent } from "./track";

interface Props {
  playerId: string;
  nameKo: string;
  /** 이 선수가 뛴 시즌 코드 (오름차순) */
  seasonCodes: number[];
  className?: string;
  /** 폰에서는 아이콘만 (선수 머리말 버튼 한 줄, 2026-10-16 디자인 정리 M3) */
  compact?: boolean;
}

export default function CompareButton({ playerId, nameKo, seasonCodes, className = "", compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function pick(e: SearchEntry) {
    const s = Number(new URLSearchParams(window.location.search).get("season"));
    const aSeason = seasonCodes.includes(s) ? s : seasonCodes[seasonCodes.length - 1];
    const bSeason = e.seasons.includes(aSeason) ? aSeason : e.last;
    setOpen(false);
    router.push(compareHref({ id: playerId, seasonCode: aSeason }, { id: e.id, seasonCode: bSeason }));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          trackEvent("compare_open", { player_no: playerId });
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-label={`${nameKo} 다른 선수와 비교`}
        className={`focus-ring inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-control bg-black/25 px-3 text-sub font-bold transition-colors duration-200 hover:bg-black/40 ${className}`}
      >
        <IconCompare size={16} />
        <span className={compact ? "sr-only sm:not-sr-only" : undefined}>비교</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 text-ink" role="dialog" aria-modal="true" aria-label={`${nameKo}와 비교할 선수 검색`}>
          <div aria-hidden className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} />
          <div className="surface-card relative mx-auto mt-16 w-[calc(100%-2rem)] max-w-lg rounded-container p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-body font-bold">{nameKo}와 비교할 선수</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-control text-ink-2 transition-colors duration-200 hover:bg-surface-2"
              >
                <IconClose size={20} />
              </button>
            </div>
            <PlayerSearch size="lg" className="mt-2 w-full" onSelect={pick} autoFocusDesktop placeholder="비교할 선수 이름" label="비교할 선수 검색" />
          </div>
        </div>
      )}
    </>
  );
}
