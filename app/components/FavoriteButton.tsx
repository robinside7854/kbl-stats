"use client";
// 즐겨찾기 별 버튼 (선수 상세 머리말). 이 브라우저에만 저장 (useFavorites, lib/favorites).
import { IconStar } from "./icons";
import { useFavorites } from "./useFavorites";
import { trackEvent } from "./Analytics";

export default function FavoriteButton({ playerId, nameKo, className = "" }: { playerId: string; nameKo: string; className?: string }) {
  const { has, toggle, ready } = useFavorites();
  const on = ready && has(playerId);
  return (
    <button
      type="button"
      onClick={() => {
        trackEvent(on ? "favorite_remove" : "favorite_add", { player_no: playerId });
        toggle(playerId);
      }}
      aria-pressed={on}
      aria-label={on ? `${nameKo} 즐겨찾기 해제` : `${nameKo} 즐겨찾기`}
      className={`focus-ring inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-control px-3 text-sub font-bold transition-colors duration-200 ${
        on ? "bg-white text-[#0b0b0b] hover:bg-white/85" : "bg-black/25 hover:bg-black/40"
      } ${className}`}
    >
      <IconStar size={16} filled={on} />
      {on ? "즐겨찾기됨" : "즐겨찾기"}
    </button>
  );
}
