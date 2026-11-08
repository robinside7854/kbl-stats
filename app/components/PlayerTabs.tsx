"use client";
// 선수 상세 탭 (2026-11-08 사용자: 스크롤이 길면 이탈 → 탭으로). 규칙·탭 목록은 lib/player-tabs.
// - PlayerTabsProvider: 지금 탭(주소 ?tab=)을 들고 있다. 기록표에서 시즌을 누르면(PLAYER_SEASON_EVENT) 시즌 탭으로.
// - PlayerTabBar: 머리말 바로 아래 탭 줄. 머리말 이름이 화면 위로 지나가면 위에 고정되는 압축 머리말(PlayerSectionNav)에도 같은 탭이 있다.
// - TabPanel: 그 탭일 때만 보인다. 한 번 연 탭은 그대로 두고 숨겨서(hidden) 다시 열 때 받은 데이터·고른 값이 남는다.
//   처음 정적 HTML 에는 첫 탭(시즌)만 그린다.
// GA4: filter_change screen=player filter=tab value=season·ability·shots·career·moments (새 매개변수 없음)
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { PLAYER_TABS, firstPlayerTab, mergeQuery, parsePlayerTab, tabQueryPatch, type PlayerTabKey } from "@/lib/player-tabs";
import { trackFilters } from "./track";

/** 시즌별 기록표 등이 카드 시즌을 바꿀 때 보내는 이벤트 (PlayerSeasonCards 가 시즌을, 여기가 탭을 바꾼다) */
export const PLAYER_SEASON_EVENT = "player-season";

/** 탭 내용이 시작하는 곳 — 탭을 바꾸면 여기로 올라온다 */
export const PLAYER_TAB_PANELS_ID = "player-tab-panels";
/** 위에 고정되는 압축 머리말 — 탭을 바꿀 때 그 높이만큼 덜 올라간다 */
export const PLAYER_FIXED_BAR_ID = "player-fixed-bar";

interface TabsCtx {
  tab: PlayerTabKey;
  available: PlayerTabKey[];
  select: (tab: PlayerTabKey, opts?: { scroll?: boolean }) => void;
  /** 한 번이라도 연 탭 */
  seen: ReadonlySet<PlayerTabKey>;
}

const Ctx = createContext<TabsCtx | null>(null);

export function usePlayerTab(): TabsCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("PlayerTabsProvider 밖에서 usePlayerTab");
  return c;
}

/** 탭 내용 시작으로 올라간다 — 이미 그보다 위에 있으면 그대로 */
function scrollToPanels() {
  const el = document.getElementById(PLAYER_TAB_PANELS_ID);
  if (!el) return;
  const bar = document.getElementById(PLAYER_FIXED_BAR_ID);
  const offset = (bar?.offsetHeight ?? 96) + 8;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  if (window.scrollY <= top) return;
  window.scrollTo({ top, behavior: "auto" });
}

export function PlayerTabsProvider({ available, children }: { available: PlayerTabKey[]; children: React.ReactNode }) {
  const first = firstPlayerTab(available);
  const [tab, setTab] = useState<PlayerTabKey>(first);
  const [seen, setSeen] = useState<Set<PlayerTabKey>>(() => new Set([first]));
  const availRef = useRef(available);
  availRef.current = available;

  const show = useCallback((next: PlayerTabKey) => {
    setTab(next);
    setSeen((s) => (s.has(next) ? s : new Set(s).add(next)));
  }, []);

  // 공유 링크의 ?tab= 반영 + 기록표에서 시즌을 누르면 시즌 탭으로
  useEffect(() => {
    const t = parsePlayerTab(window.location.search, availRef.current);
    if (t !== first) show(t);
    const onSeason = () => {
      if (availRef.current.includes("season")) show("season");
    };
    window.addEventListener(PLAYER_SEASON_EVENT, onSeason);
    return () => window.removeEventListener(PLAYER_SEASON_EVENT, onSeason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 주소에는 tab 만 바꿔 쓴다 (season·scope 는 PlayerSeasonCards 몫)
  useEffect(() => {
    const q = mergeQuery(window.location.search, tabQueryPatch(tab, availRef.current));
    window.history.replaceState(null, "", `${window.location.pathname}${q}${window.location.hash}`);
  }, [tab]);

  const select = useCallback(
    (next: PlayerTabKey, opts?: { scroll?: boolean }) => {
      trackFilters("player", { tab: next });
      show(next);
      // 내용이 바뀐 뒤 높이로 계산한다
      if (opts?.scroll !== false) window.requestAnimationFrame(() => scrollToPanels());
    },
    [show],
  );

  return <Ctx.Provider value={{ tab, available, select, seen }}>{children}</Ctx.Provider>;
}

/** 탭 버튼 줄 — 머리말 아래(inline)와 고정 머리말(compact) 두 곳에서 쓴다 */
export function PlayerTabButtons({ compact = false, focusable = true }: { compact?: boolean; focusable?: boolean }) {
  const { tab, available, select } = usePlayerTab();
  const defs = PLAYER_TABS.filter((t) => available.includes(t.key));
  return (
    <ul role="tablist" aria-label="선수 정보" className={`grid ${compact ? "lg:flex lg:gap-1" : ""}`} style={{ gridTemplateColumns: `repeat(${defs.length}, minmax(0, 1fr))` }}>
      {defs.map((t) => {
        const on = tab === t.key;
        return (
          <li key={t.key} role="presentation" className="min-w-0">
            <button
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={PLAYER_TAB_PANELS_ID}
              tabIndex={focusable ? (on ? 0 : -1) : -1}
              onClick={() => select(t.key)}
              onKeyDown={(e) => {
                // 화살표로 옆 탭 (탭 목록 키보드 규칙)
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const i = defs.findIndex((d) => d.key === t.key);
                const n = defs[(i + (e.key === "ArrowRight" ? 1 : -1) + defs.length) % defs.length];
                select(n.key, { scroll: false });
                const btns = e.currentTarget.closest("ul")?.querySelectorAll<HTMLButtonElement>("button[role=tab]");
                btns?.[defs.indexOf(n)]?.focus();
              }}
              className={`focus-ring-inset relative flex w-full cursor-pointer items-center justify-center whitespace-nowrap px-2 font-semibold transition-colors duration-200 ${
                compact ? "h-10 text-sub lg:px-3" : "h-12 text-body"
              } ${on ? "text-[var(--series-1)]" : "text-ink-3 hover:text-ink"}`}
            >
              {t.label}
              {on && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 bg-[var(--series-1)]" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** 머리말 바로 아래 탭 줄 */
export function PlayerTabBar() {
  const { available } = usePlayerTab();
  if (available.length < 2) return null;
  return (
    <nav aria-label="선수 정보 탭" className="mx-auto mt-4 max-w-page px-4">
      <div className="border-b border-line">
        <PlayerTabButtons />
      </div>
    </nav>
  );
}

/** 탭 내용 — 그 탭일 때만 보인다. 한 번 연 탭은 숨겨 두기만 한다 */
export function TabPanel({ tab, children, className }: { tab: PlayerTabKey; children: React.ReactNode; className?: string }) {
  const { tab: cur, seen } = usePlayerTab();
  if (!seen.has(tab)) return null;
  return (
    <div role="tabpanel" hidden={cur !== tab} className={className}>
      {children}
    </div>
  );
}
