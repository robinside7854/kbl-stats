"use client";
// 즐겨찾기 (/favorites, 2026-10-17 사용자: 홈 가운데 줄 대신 헤더 별 버튼으로 따로 보기). 옛 홈 FavoritesStrip.
// 목록은 useFavorites(이 브라우저 + 로그인하면 계정), 이름·사진·팀 색은 우리 정적 파일 /search-index.json 에서 찾는다.
// GA4: 별 해제 favorite_remove(player_no), 들어오는 길은 헤더 nav_click menu=즐겨찾기 place=top
import { useEffect, useState } from "react";
import Link from "next/link";
import { playerHref } from "@/lib/cardview";
import { searchSpanLabel } from "@/lib/search";
import { teamShortLabel } from "@/lib/images";
import type { SearchEntry } from "@/lib/types";
import { IconChevronRight, IconStar } from "./icons";
import PlayerAvatar from "./PlayerAvatar";
import Skeleton from "./Skeleton";
import { useFavorites } from "./useFavorites";
import { loadSearchIndex } from "./useSearchIndex";
import { trackEvent } from "./track";

export default function FavoritesView() {
  const { list, ready, toggle } = useFavorites();
  const [index, setIndex] = useState<Map<string, SearchEntry> | null>(null);
  useEffect(() => {
    if (!ready || list.length === 0 || index) return;
    loadSearchIndex()
      .then((l) => setIndex(new Map(l.map((e) => [e.id, e]))))
      .catch(() => setIndex(new Map()));
  }, [ready, list.length, index]);

  const loading = !ready || (list.length > 0 && !index);
  const entries = index ? list.map((id) => index.get(id)).filter((e): e is SearchEntry => !!e) : [];

  return (
    <>
      <h1 className="flex items-center gap-2 text-h1 font-black">
        <IconStar size={24} filled className="text-[var(--grade-s)]" />
        즐겨찾기
        {entries.length > 0 && <span className="text-body font-medium text-ink-3">{entries.length}명</span>}
      </h1>
      {loading ? (
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <Skeleton className="h-16 w-full" />
            </li>
          ))}
        </ul>
      ) : entries.length === 0 ? (
        <div className="surface-card mt-4 rounded-container p-4">
          <p className="text-body text-ink">아직 즐겨찾기한 선수가 없어요.</p>
          <p className="mt-1 text-sub text-ink-3">선수 페이지 이름 옆 별을 누르면 여기 모여요.</p>
          <Link href="/players" className="focus-ring link-shortcut mt-1">
            선수 찾아보기
            <IconChevronRight size={16} />
          </Link>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((e) => (
            <li key={e.id} className="surface-card flex min-h-16 items-center rounded-container">
              <Link href={playerHref(e.id)} className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-container py-2 pl-3 transition-colors duration-200 hover:bg-surface-2">
                <PlayerAvatar photoUrl={e.photoUrl} nameKo={e.nameKo} color={{ primary: e.color.primary, secondary: e.color.primary, text: e.color.text }} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-bold text-ink">{e.nameKo}</span>
                  <span className="block truncate text-sub text-ink-3">
                    {teamShortLabel(e.team)} · {searchSpanLabel(e)}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  toggle(e.id);
                  trackEvent("favorite_remove", { player_no: e.id });
                }}
                aria-label={`${e.nameKo} 즐겨찾기 해제`}
                className="focus-ring mr-1 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-control text-[var(--grade-s)] transition-colors duration-200 hover:bg-surface-2"
              >
                <IconStar size={20} filled />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
