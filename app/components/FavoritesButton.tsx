"use client";
// 헤더 별 버튼 (2026-10-17 사용자: 즐겨찾기를 홈 가운데가 아니라 상단 메뉴로) → /favorites. 즐겨찾기한 선수가 있으면 별을 채운다.
import Link from "next/link";
import { IconStar } from "./icons";
import { trackEvent } from "./track";
import { useFavorites } from "./useFavorites";

export default function FavoritesButton({ active = false }: { active?: boolean }) {
  const { list, ready } = useFavorites();
  const has = ready && list.length > 0;
  return (
    <Link
      href="/favorites"
      onClick={() => trackEvent("nav_click", { menu: "즐겨찾기", place: "top" })}
      aria-label={has ? `즐겨찾기, 선수 ${list.length}명` : "즐겨찾기"}
      title="즐겨찾기"
      aria-current={active ? "page" : undefined}
      className={`focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border transition-colors duration-200 ${
        active ? "border-series-1 bg-series-1/15 text-series-1" : "border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink"
      }`}
    >
      <IconStar size={20} filled={has} className={has && !active ? "text-[var(--grade-s)]" : ""} />
    </Link>
  );
}
