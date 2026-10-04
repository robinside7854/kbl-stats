"use client";
// 모든 화면 상단 내비게이션: 사이트 이름 · 선수 검색 · (시즌 화면에서만) 시즌 선택 · 화면 메뉴.
// 메뉴 = 홈 / 선수 / 팀 / 리더보드 / 일정 / 역대 기록 / 54-0 (팀 순위·모바일 하단 홈 가운데는 2026-10-03) (2026-09-30 재구성, 역대 기록은 2026-10-01, 54-0 게임은 2026-10-02, 플레이스타일은 2026-10-02 폐지).
// "용어"는 메뉴에서 뺐다(피드백 5차, PLAN.md §13) — 설명은 각 화면 ⓘ 팝오버(HelpPopover)에서, /glossary 페이지는 "자세히" 링크로만.
// 시즌 선택은 시즌이 있는 화면(순위표·팀 분포·선수 탭)에서만 보인다.
// - 순위표·팀 분포: 시즌을 바꾸면 지금 화면 종류와 주소 쿼리(선택 상태)를 그대로 둔 채 시즌 주소로 이동.
//   새 시즌에 없는 값(선수·팀)은 각 화면이 쿼리를 읽을 때 기본값으로 되돌린다.
// - 선수 탭: 한 페이지 안에서 시즌을 바꾸므로 onSeasonChange 로 화면에 알린다 (PlayersView 가 이 막대를 직접 그린다).
// 순위표·팀 분포 메뉴는 seasonCode(그 화면의 시즌, 없으면 최신 시즌)로 연결한다.
// 검색창: 모바일은 아래 줄 전체 폭, 640px 이상은 첫 줄 가운데. "랜덤 카드"(RandomCardButton)·공유(ShareButton)는 모바일 첫 줄 오른쪽·PC 맨 끝.
import { seasonShortLabel } from "@/lib/career";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SeasonOption } from "@/lib/types";
import PlayerSearch from "./PlayerSearch";
import AccountButton from "./AccountButton";
import RandomCardButton from "./RandomCardButton";
import ShareButton from "./ShareButton";
import { IconBall, IconCalendar, IconHome, IconLeaders, IconPlayer, IconTeam, IconTrophy } from "./icons";
import SiteLogo, { SITE_HEADER_NAME } from "./SiteLogo";
import { trackEvent, trackFilters } from "./track";

export type SiteView = "home" | "players" | "player" | "teams" | "team" | "leaders" | "schedule" | "compare" | "glossary" | "records" | "game" | "privacy" | "me";

type MenuItem = { views: SiteView[]; label: string; short?: string; icon: (p: { size: 24 }) => React.ReactNode; href: (seasonCode: number) => string };
const HOME: MenuItem = { views: ["home"], label: "홈", icon: IconHome, href: () => "/" };
/** 홈 왼쪽 / 오른쪽 메뉴 (2026-10-03 사용자: 모바일 하단은 홈을 가운데, 왼쪽 선수·팀·리더보드, 오른쪽 일정·역대 기록·54-0 — 비교는 2026-10-03 메뉴에서 빼고 선수 상세 "비교" 버튼으로) */
const LEFT: MenuItem[] = [
  { views: ["players", "player", "compare"], label: "선수", icon: IconPlayer, href: () => "/players" },
  { views: ["teams", "team"], label: "팀", icon: IconTeam, href: () => "/teams" },
  { views: ["leaders"], label: "리더보드", icon: IconLeaders, href: (c) => `/season/${c}/leaders` },
];
const RIGHT: MenuItem[] = [
  { views: ["schedule"], label: "일정", icon: IconCalendar, href: (c) => `/season/${c}/schedule` },
  { views: ["records"], label: "역대 기록", short: "기록", icon: IconTrophy, href: () => "/records" },
  { views: ["game"], label: "54-0", icon: IconBall, href: () => "/game" },
];
/** PC 상단 메뉴 순서 (홈 먼저) */
const MENU: MenuItem[] = [HOME, ...LEFT, ...RIGHT];
/** 모바일 하단 탭 순서 (홈 가운데) */
const BOTTOM_MENU: MenuItem[] = [...LEFT, HOME, ...RIGHT];

/** 시즌 주소가 있는 화면 (시즌을 바꾸면 그 주소로 이동) */
const SEASON_ROUTES: Partial<Record<SiteView, (c: number) => string>> = {
  leaders: (c) => `/season/${c}/leaders`,
  teams: (c) => `/season/${c}/teams`,
  schedule: (c) => `/season/${c}/schedule`,
};

interface Props {
  seasons: SeasonOption[];
  seasonCode: number;
  view: SiteView;
  /** 선수 탭처럼 한 페이지 안에서 시즌을 바꾸는 화면: 주면 시즌 선택을 보이고 바꿀 때 부른다 */
  onSeasonChange?: (seasonCode: number) => void;
  /** 순위표처럼 넓은 화면에 맞출 때 */
  wide?: boolean;
  /** 본문에 큰 검색창이 있는 화면(선수 탭)에서 상단 검색을 숨긴다 (디자인 점검 A4: 검색창 중복) */
  hideSearch?: boolean;
}

export default function SiteNav({ seasons, seasonCode, view, onSeasonChange, wide = false, hideSearch = false }: Props) {
  const router = useRouter();
  const route = SEASON_ROUTES[view];
  const showSeason = !!route || !!onSeasonChange;

  function changeSeason(code: number) {
    trackFilters(view, { season: code });
    if (onSeasonChange) onSeasonChange(code);
    else if (route) router.push(`${route(code)}${window.location.search}`);
  }

  return (
    <header className="border-b border-line bg-surface">
      <div className={`mx-auto ${wide ? "max-w-5xl" : "max-w-3xl"} px-4`}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3">
          <Link href="/" className="focus-ring order-1 inline-flex h-10 shrink-0 items-center gap-2 rounded-control text-body font-bold tracking-tight text-ink">
            <SiteLogo />
            <span className="sr-only">KBL </span>
            {SITE_HEADER_NAME}
          </Link>
          {/* 랜덤 카드·공유: 모바일은 첫 줄 오른쪽, PC 는 맨 끝 */}
          <div className="order-2 flex shrink-0 items-center gap-2 sm:order-4">
            <RandomCardButton />
            <ShareButton />
            <AccountButton active={view === "me"} />
          </div>
          {!hideSearch && <PlayerSearch className="order-4 w-full sm:order-2 sm:w-auto sm:max-w-xs sm:flex-1" />}
          {showSeason && (
            <label className="order-3 flex min-w-0 items-center gap-2 text-sub font-medium text-ink-2 sm:order-3">
              <span className="shrink-0">시즌</span>
              <select
                aria-label="시즌 선택"
                className="focus-ring h-10 min-w-0 cursor-pointer rounded-control border border-line bg-surface px-2 text-base text-ink"
                value={seasonCode}
                onChange={(e) => changeSeason(Number(e.target.value))}
              >
                {seasons.map((s) => (
                  <option key={s.seasonCode} value={s.seasonCode}>
                    {seasonShortLabel(s.seasonLabel)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {/* 7개 메뉴 — 390px 폭에 한 줄로 들어가게 좁은 여백, 더 좁은 화면에서는 메뉴 줄만 옆으로 민다 */}
        {/* PC(768px 이상) 상단 메뉴. 모바일은 아래 하단 탭 바 */}
        <nav aria-label="화면 메뉴" className="-mx-1 mt-2 hidden overflow-x-auto [scrollbar-width:none] md:flex">
          {MENU.map((m) => {
            const active = m.views.includes(view);
            return (
              <Link
                key={m.label}
                href={m.href(seasonCode)}
                onClick={() => trackEvent("nav_click", { menu: m.label, place: "top" })}
                aria-current={active ? "page" : undefined}
                className={`focus-ring-inset -mb-px flex h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-2 text-body font-semibold transition-colors duration-200 sm:px-3 ${
                  active ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>
        <div className="h-3 md:hidden" />
      </div>
      {/* 모바일 하단 탭 바 (앱처럼, 2026-10-01). 본문 아래 여백은 globals.css --bottom-nav-h */}
      <nav
        aria-label="화면 메뉴"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {BOTTOM_MENU.map((m) => {
          const active = m.views.includes(view);
          const Icon = m.icon;
          // 가운데 홈은 다른 칸보다 크게·위로 띄운 둥근 버튼 (2026-10-03 사용자: 더 누르기 쉽게)
          if (m === HOME) {
            return (
              <Link
                key={m.label}
                href={m.href(seasonCode)}
                onClick={() => trackEvent("nav_click", { menu: m.label, place: "bottom" })}
                aria-current={active ? "page" : undefined}
                aria-label={m.label}
                className="focus-ring-inset group relative flex h-14 flex-col items-center justify-center gap-0.5 text-caption font-bold text-ink"
              >
                {/* 아이콘 자리(24px)는 비워 두고 원을 위로 띄운다 — 글자 줄이 다른 칸과 같은 높이 */}
                <span aria-hidden className="h-6" />
                {/* deslop-ignore-next-line 19 */}
                <span className={`absolute -top-6 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border-4 border-surface shadow-card transition-colors duration-200 ${active ? "bg-ink text-bg" : "bg-series-1 text-white group-hover:bg-ink"}`}>
                  <Icon size={24} />
                </span>
                <span className="whitespace-nowrap leading-none tracking-tight">{m.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={m.label}
              href={m.href(seasonCode)}
              onClick={() => trackEvent("nav_click", { menu: m.label, place: "bottom" })}
              aria-current={active ? "page" : undefined}
              aria-label={m.label}
              className={`focus-ring-inset relative flex h-14 flex-col items-center justify-center gap-0.5 text-caption transition-colors duration-200 ${
                active ? "font-bold text-series-1" : "font-medium text-ink-3 hover:text-ink"
              }`}
            >
              {/* 지금 있는 화면 (2026-10-05 사용자: 어느 탭인지 또렷하게) — 위쪽 파란 막대 + 아이콘 뒤 옅은 파란 바탕 + 파란 글자 */}
              {active && <span aria-hidden className="absolute inset-x-3 top-0 h-[3px] rounded-b-sm bg-series-1" />}
              <span className={`flex h-7 w-11 items-center justify-center rounded-control ${active ? "bg-series-1/15" : ""}`}>
                <Icon size={24} />
              </span>
              <span className="whitespace-nowrap leading-none tracking-tight">{m.short ?? m.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
