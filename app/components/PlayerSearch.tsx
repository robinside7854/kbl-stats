"use client";
// 선수 검색창: 이름(한글·영문, 공백 무시, 부분 일치)으로 선수를 찾는다.
// - 기본: 고르면 선수 페이지로 이동 (상단 SiteNav, 선수 탭의 큰 검색창)
// - onSelect 를 주면 이동하지 않고 고른 선수를 넘긴다 (비교 탭 슬롯)
// 검색 데이터는 우리 사이트의 정적 파일 /search-index.json (useSearchIndex) — KBL 서버 호출 아님.
// 매칭·정렬 규칙은 lib/search.ts searchPlayers.
// 검색어가 비어 있으면(누르기만 해도) 최근 본 선수(이 브라우저, recent-players.ts)와 마지막 경기일 활약 3명(/search-hot.json)을 먼저 보여 준다
// (2026-10-08 토스 검토). GA4: search_select mode=recent·hot (비교 탭 고르기는 그대로 compare).
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SearchEntry } from "@/lib/types";
import { searchPlayers, searchSpanLabel } from "@/lib/search";
import { gameDayLabel } from "@/lib/games";
import { loadRecentPlayers } from "./recent-players";
import { teamShortLabel } from "@/lib/images";
import { IconSearch } from "./icons";
import PlayerAvatar from "./PlayerAvatar";
import Skeleton from "./Skeleton";
import { loadSearchIndex } from "./useSearchIndex";
import { trackEvent } from "./track";

interface HotFile {
  date: string | null;
  players: { id: string; line: string }[];
}
interface Suggestion {
  entry: SearchEntry;
  kind: "result" | "recent" | "hot";
  line?: string;
}

// 마지막 경기일 활약 3명 — 우리 정적 파일(scripts/build-search-index.ts), 한 번만 받는다
let hotPromise: Promise<HotFile> | null = null;
function loadHot(): Promise<HotFile> {
  if (!hotPromise) {
    hotPromise = fetch("/search-hot.json")
      .then((r) => (r.ok ? (r.json() as Promise<HotFile>) : { date: null, players: [] }))
      .catch(() => {
        hotPromise = null;
        return { date: null, players: [] };
      });
  }
  return hotPromise;
}

interface Props {
  className?: string;
  /** sm: 상단 막대(높이 36px) / lg: 선수 탭·비교 탭의 큰 검색창(높이 48px) */
  size?: "sm" | "lg";
  /** 주면 선수 페이지로 이동하지 않고 고른 선수를 넘긴다 */
  onSelect?: (e: SearchEntry) => void;
  /** PC(마우스·키보드 환경, 폭 1024px 이상)에서만 처음에 포커스 — 모바일은 키보드가 화면을 가리므로 하지 않는다 */
  autoFocusDesktop?: boolean;
  placeholder?: string;
  /** 스크린리더 이름 */
  label?: string;
}

export default function PlayerSearch({
  className = "",
  size = "sm",
  onSelect,
  autoFocusDesktop = false,
  placeholder = "선수 이름 검색 (예: 워니)",
  label = "선수 검색",
}: Props) {
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
    loadSearchIndex()
      .then((list) => {
        setEntries(list);
        setStatus("idle");
      })
      .catch(() => setStatus("error"));
  }

  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [hot, setHot] = useState<HotFile | null>(null);
  const results = useMemo(() => (entries && query.trim() ? searchPlayers(entries, query, 10) : []), [entries, query]);
  // 검색어가 없을 때 목록: 최근 본 선수 → 경기 활약 (같은 선수는 위에만)
  const suggestions = useMemo<Suggestion[]>(() => {
    if (!entries) return [];
    const byId = new Map(entries.map((e) => [e.id, e]));
    const out: Suggestion[] = [];
    for (const id of recentIds) {
      const e = byId.get(id);
      if (e) out.push({ entry: e, kind: "recent" });
    }
    for (const p of hot?.players ?? []) {
      const e = byId.get(p.id);
      if (e && !out.some((x) => x.entry.id === p.id)) out.push({ entry: e, kind: "hot", line: p.line });
    }
    return out;
  }, [entries, recentIds, hot]);
  const empty = query.trim().length === 0;
  const list: Suggestion[] = empty ? suggestions : results.map((e) => ({ entry: e, kind: "result" }));

  useEffect(() => {
    if (autoFocusDesktop && window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches) {
      inputRef.current?.focus({ preventScroll: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onOpen() {
    ensureIndex();
    setRecentIds(loadRecentPlayers());
    if (!hot) loadHot().then(setHot, () => {});
    setOpen(true);
  }

  function modeOf(kind: Suggestion["kind"]): string {
    if (onSelect) return "compare";
    return kind === "result" ? "go" : kind;
  }

  function go(e: SearchEntry, kind: Suggestion["kind"] = "result") {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    trackEvent("search_select", { player_no: e.id, mode: modeOf(kind) });
    if (onSelect) onSelect(e);
    else router.push(`/player/${e.id}`);
  }

  function onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, list.length - 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (ev.key === "Enter" && list[active]) {
      ev.preventDefault();
      go(list[active].entry, list[active].kind);
    } else if (ev.key === "Escape") {
      setOpen(false);
    }
  }

  const lg = size === "lg";
  const listId = `${id}-list`;
  // 검색어가 없으면 보여 줄 추천이 있을 때만 연다
  const showList = open && (!empty || suggestions.length > 0);

  // 결과 한 줄: 사진 · 이름 · 최근 팀 · 포지션 · 활동 기간 (동명이인 구분)
  const option = (e: SearchEntry, line?: string) => (
    <>
      <PlayerAvatar
        photoUrl={e.photoUrl}
        nameKo={e.nameKo}
        color={{ primary: e.color.primary, secondary: e.color.primary, text: e.color.text }}
        size={28}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body">
          <span className="font-semibold text-ink">{e.nameKo}</span>{" "}
          <span className="text-sub text-ink-3">{e.nameEn}</span>
        </span>
        {/* 동명이인 구분: 최근 팀 · 활동 기간 */}
        <span className="block truncate text-sub text-ink-2">
          {line ? (
            <>
              {teamShortLabel(e.team)} · <span className="tabular font-semibold text-ink">{line}</span>
            </>
          ) : (
            <>
              {teamShortLabel(e.team)}
              {e.positionLabel ? ` · ${e.positionLabel}` : ""} · {searchSpanLabel(e)}
            </>
          )}
        </span>
      </span>
    </>
  );

  return (
    <div className={`relative ${className}`} role="search">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span aria-hidden className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-3 ${lg ? "left-3.5" : "left-2.5"}`}>
        <IconSearch size={lg ? 20 : 16} />
      </span>
      <input
        ref={inputRef}
        id={id}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && list[active] ? `${id}-opt-${list[active].entry.id}` : undefined}
        autoComplete="off"
        enterKeyHint="search"
        placeholder={placeholder}
        className={`w-full min-w-0 border border-line bg-surface text-base text-ink placeholder:text-ink-3 focus-visible:outline-offset-0 ${
          lg ? "h-12 rounded-control pl-11 pr-3 shadow-card" : "h-10 rounded-control pl-8 pr-2"
        }`}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          onOpen();
        }}
        onFocus={() => {
          setActive(0);
          onOpen();
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={empty ? "최근 본 선수와 경기 활약" : "검색 결과"}
          className="absolute right-0 z-40 mt-1 max-h-[70vh] w-full min-w-[17rem] overflow-y-auto surface-card rounded-control py-1"
        >
          {status === "loading" && !entries && (
            <li role="status" className="px-3 py-2">
              <span className="sr-only">선수 목록 불러오는 중</span>
              {[0, 1, 2].map((i) => (
                <span key={i} className="flex items-center gap-2 py-1.5">
                  {/* deslop-ignore-next-line 19 */}
                  <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </span>
              ))}
            </li>
          )}
          {status === "error" && <li className="px-3 py-2 text-body text-ink-2">선수 목록을 불러오지 못했습니다. 검색창을 다시 눌러 주세요.</li>}
          {entries && !empty && results.length === 0 && (
            <li className="px-3 py-2.5 text-body text-ink-2">
              ‘{query.trim()}’와 맞는 선수가 없습니다.
              <span className="mt-0.5 block text-sub text-ink-3">이름 일부(한글·영문)로 찾아 보세요. 띄어쓰기는 무시합니다.</span>
            </li>
          )}
          {list.map((item, i) => {
            const e = item.entry;
            // 묶음 제목: 최근 본 선수 / ○월 ○일 경기 활약 (검색어가 없을 때만)
            const head =
              item.kind !== "result" && (i === 0 || list[i - 1].kind !== item.kind) ? (
                <li role="presentation" className="px-3 pb-1 pt-2 text-caption font-semibold text-ink-3">
                  {item.kind === "recent" ? "최근 본 선수" : hot?.date ? `${gameDayLabel(hot.date)} 경기 활약` : "최근 경기 활약"}
                </li>
              ) : null;
            const cls = `focus-ring-inset flex min-h-12 w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-200 ${i === active ? "bg-surface-2" : ""}`;
            return (
              <Fragment key={`${item.kind}-${e.id}`}>
                {head}
                <li role="presentation">
                  {onSelect ? (
                    <button
                      type="button"
                      id={`${id}-opt-${e.id}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => go(e, item.kind)}
                      onMouseEnter={() => setActive(i)}
                      className={cls}
                    >
                      {option(e, item.line)}
                    </button>
                  ) : (
                    <Link
                      id={`${id}-opt-${e.id}`}
                      role="option"
                      aria-selected={i === active}
                      href={`/player/${e.id}`}
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => {
                        trackEvent("search_select", { player_no: e.id, mode: modeOf(item.kind) });
                        setOpen(false);
                        setQuery("");
                      }}
                      onMouseEnter={() => setActive(i)}
                      className={cls}
                    >
                      {option(e, item.line)}
                    </Link>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ul>
      )}
    </div>
  );
}
