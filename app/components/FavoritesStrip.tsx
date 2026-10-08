"use client";
// 홈 "즐겨찾기" (2026-10-01): 이 브라우저에 저장한 선수(useFavorites) — 최근에 추가한 5명, 나머지는 "더 보기".
// 이름·사진·팀 색은 우리 정적 파일 /search-index.json 에서 찾는다. 즐겨찾기가 없으면 아무것도 그리지 않는다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { FAVORITES_VISIBLE } from "@/lib/favorites";
import { playerHref } from "@/lib/cardview";
import { searchSpanLabel } from "@/lib/search";
import { teamShortLabel } from "@/lib/images";
import type { SearchEntry } from "@/lib/types";
import { IconStar } from "./icons";
import PlayerAvatar from "./PlayerAvatar";
import { useFavorites } from "./useFavorites";
import { loadSearchIndex } from "./useSearchIndex";

export default function FavoritesStrip() {
  const { list, ready, toggle } = useFavorites();
  const [index, setIndex] = useState<Map<string, SearchEntry> | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    if (!ready || list.length === 0 || index) return;
    loadSearchIndex()
      .then((l) => setIndex(new Map(l.map((e) => [e.id, e]))))
      .catch(() => setIndex(new Map()));
  }, [ready, list.length, index]);

  if (!ready || list.length === 0 || !index) return null;
  const entries = list.map((id) => index.get(id)).filter((e): e is SearchEntry => !!e);
  if (entries.length === 0) return null;
  const shown = all ? entries : entries.slice(0, FAVORITES_VISIBLE);

  return (
    <section aria-labelledby="fav-title" className="mx-auto mb-5 mt-8 max-w-page px-4">
      <h2 id="fav-title" className="flex items-center gap-1.5 text-h2 font-bold">
        <IconStar size={20} filled className="text-[var(--grade-s)]" />
        즐겨찾기
        <span className="text-sub font-medium text-ink-3">{entries.length}명 · 이 브라우저에만 저장</span>
      </h2>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((e) => (
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
              onClick={() => toggle(e.id)}
              aria-label={`${e.nameKo} 즐겨찾기 해제`}
              className="focus-ring mr-1 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-control text-[var(--grade-s)] transition-colors duration-200 hover:bg-surface-2"
            >
              <IconStar size={20} filled />
            </button>
          </li>
        ))}
      </ul>
      {entries.length > FAVORITES_VISIBLE && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className="focus-ring mt-2 h-11 w-full cursor-pointer rounded-control border border-line bg-surface text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
        >
          {all ? "접기" : `더 보기 (${entries.length - FAVORITES_VISIBLE}명)`}
        </button>
      )}
    </section>
  );
}
