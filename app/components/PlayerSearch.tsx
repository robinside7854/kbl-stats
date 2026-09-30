"use client";
// 상단 검색창: 이름(한글·영문, 공백 무시, 부분 일치)으로 선수를 찾아 선수 페이지로 이동.
// 검색 데이터는 우리 사이트의 정적 파일 /search-index.json (빌드 전 scripts/build-search-index.ts 가 생성).
// 검색창에 처음 포커스가 갈 때 한 번만 받아 모듈 변수에 둔다 — KBL 서버 호출이 아니므로 원칙 1·3 위반 아님.
// 매칭·정렬 규칙은 lib/search.ts searchPlayers.
// 입력창의 data-site-search 속성은 홈의 "선수 검색" 버튼이 포커스를 옮길 때 찾는 표시다 (FocusSearchButton).
import { useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SearchEntry } from "@/lib/types";
import { searchPlayers, searchSpanLabel } from "@/lib/search";
import { teamShortLabel } from "@/lib/images";
import PlayerAvatar from "./PlayerAvatar";

let indexPromise: Promise<SearchEntry[]> | null = null;

function loadIndex(): Promise<SearchEntry[]> {
  if (!indexPromise) {
    indexPromise = fetch("/search-index.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<SearchEntry[]>;
      })
      .catch((e) => {
        indexPromise = null; // 실패하면 다음 포커스 때 다시 시도
        throw e;
      });
  }
  return indexPromise;
}

export default function PlayerSearch({ className = "" }: { className?: string }) {
  const id = useId();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  function ensureIndex() {
    if (entries || status === "loading") return;
    setStatus("loading");
    loadIndex()
      .then((list) => {
        setEntries(list);
        setStatus("idle");
      })
      .catch(() => setStatus("error"));
  }

  const results = useMemo(() => (entries && query.trim() ? searchPlayers(entries, query, 10) : []), [entries, query]);

  function go(e: SearchEntry) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(`/player/${e.id}`);
  }

  function onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (ev.key === "Enter" && results[active]) {
      ev.preventDefault();
      go(results[active]);
    } else if (ev.key === "Escape") {
      setOpen(false);
    }
  }

  const listId = `${id}-list`;
  const showList = open && query.trim().length > 0;

  return (
    <div className={`relative ${className}`} role="search">
      <label htmlFor={id} className="sr-only">
        선수 검색
      </label>
      <span aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="7" cy="7" r="4.75" />
          <path d="M10.5 10.5 14 14" />
        </svg>
      </span>
      <input
        ref={inputRef}
        id={id}
        data-site-search=""
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${id}-opt-${results[active].id}` : undefined}
        autoComplete="off"
        enterKeyHint="search"
        placeholder="선수 이름 검색 (예: 워니)"
        className="h-9 w-full min-w-0 rounded-lg border border-line bg-surface pl-8 pr-2 text-base text-ink placeholder:text-ink-3 focus:outline-2 focus:outline-focus sm:text-sm"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
          ensureIndex();
        }}
        onFocus={() => {
          ensureIndex();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="검색 결과"
          className="absolute right-0 z-40 mt-1 max-h-[70vh] w-full min-w-[17rem] overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
        >
          {status === "loading" && !entries && <li className="px-3 py-2 text-sm text-ink-3">선수 목록을 불러오는 중…</li>}
          {status === "error" && <li className="px-3 py-2 text-sm text-ink-3">선수 목록을 불러오지 못했습니다. 다시 눌러 주세요.</li>}
          {entries && results.length === 0 && <li className="px-3 py-2 text-sm text-ink-3">검색 결과가 없습니다</li>}
          {results.map((e, i) => (
            <li key={e.id} role="presentation">
              <Link
                id={`${id}-opt-${e.id}`}
                role="option"
                aria-selected={i === active}
                href={`/player/${e.id}`}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex items-center gap-2 px-3 py-2 ${i === active ? "bg-surface-2" : ""}`}
              >
                <PlayerAvatar
                  photoUrl={e.photoUrl}
                  nameKo={e.nameKo}
                  color={{ primary: e.color.primary, secondary: e.color.primary, text: e.color.text }}
                  size={28}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    <span className="font-semibold text-ink">{e.nameKo}</span>{" "}
                    <span className="text-xs text-ink-3">{e.nameEn}</span>
                  </span>
                  {/* 동명이인 구분: 최근 팀 · 활동 기간 */}
                  <span className="block truncate text-xs text-ink-2">
                    {teamShortLabel(e.team)} · {searchSpanLabel(e)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
