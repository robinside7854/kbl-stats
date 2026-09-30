"use client";
// 모든 화면 상단 내비게이션: 사이트 이름 · 선수 검색 · (시즌 화면에서만) 시즌 선택 · 화면 메뉴.
// 메뉴 = 홈 / 선수 / 순위표 / 팀 분포 / 비교 (2026-09-30 사용자 피드백으로 재구성, PLAN.md §6-4).
// "용어"는 메뉴에서 뺐다(피드백 5차, PLAN.md §13) — 설명은 각 화면 ⓘ 팝오버(HelpPopover)에서, /glossary 페이지는 "자세히" 링크로만.
// 시즌 선택은 시즌이 있는 화면(순위표·팀 분포·선수 탭)에서만 보인다.
// - 순위표·팀 분포: 시즌을 바꾸면 지금 화면 종류와 주소 쿼리(선택 상태)를 그대로 둔 채 시즌 주소로 이동.
//   새 시즌에 없는 값(선수·팀)은 각 화면이 쿼리를 읽을 때 기본값으로 되돌린다.
// - 선수 탭: 한 페이지 안에서 시즌을 바꾸므로 onSeasonChange 로 화면에 알린다 (PlayersView 가 이 막대를 직접 그린다).
// 순위표·팀 분포 메뉴는 seasonCode(그 화면의 시즌, 없으면 최신 시즌)로 연결한다.
// 검색창: 모바일은 둘째 줄 전체 폭, 640px 이상은 첫 줄 가운데.
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SeasonOption } from "@/lib/types";
import PlayerSearch from "./PlayerSearch";

export type SiteView = "home" | "players" | "player" | "leaders" | "teams" | "compare" | "glossary";

const MENU: { views: SiteView[]; label: string; href: (seasonCode: number) => string }[] = [
  { views: ["home"], label: "홈", href: () => "/" },
  { views: ["players", "player"], label: "선수", href: () => "/players" },
  { views: ["leaders"], label: "순위표", href: (c) => `/season/${c}/leaders` },
  { views: ["teams"], label: "팀 분포", href: (c) => `/season/${c}/teams` },
  { views: ["compare"], label: "비교", href: () => "/compare" },
];

/** 시즌 주소가 있는 화면 (시즌을 바꾸면 그 주소로 이동) */
const SEASON_ROUTES: Partial<Record<SiteView, (c: number) => string>> = {
  leaders: (c) => `/season/${c}/leaders`,
  teams: (c) => `/season/${c}/teams`,
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
    if (onSeasonChange) onSeasonChange(code);
    else if (route) router.push(`${route(code)}${window.location.search}`);
  }

  return (
    <header className="border-b border-line bg-surface">
      <div className={`mx-auto ${wide ? "max-w-5xl" : "max-w-3xl"} px-4`}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3">
          <Link href="/" className="focus-ring order-1 inline-flex h-10 shrink-0 items-center rounded-control text-body font-bold tracking-tight text-ink">
            KBL 팬 스탯
          </Link>
          {!hideSearch && <PlayerSearch className="order-3 w-full sm:order-2 sm:w-auto sm:max-w-xs sm:flex-1" />}
          {showSeason && (
            <label className="order-2 flex min-w-0 items-center gap-2 text-sub font-medium text-ink-2 sm:order-3">
              <span className="shrink-0">시즌</span>
              <select
                aria-label="시즌 선택"
                className="focus-ring h-10 min-w-0 cursor-pointer rounded-control border border-line bg-surface px-2 text-base text-ink"
                value={seasonCode}
                onChange={(e) => changeSeason(Number(e.target.value))}
              >
                {seasons.map((s) => (
                  <option key={s.seasonCode} value={s.seasonCode}>
                    {s.seasonLabel}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {/* 6개 메뉴 — 390px 폭에 한 줄로 들어가게 좁은 여백, 더 좁은 화면에서는 메뉴 줄만 옆으로 민다 */}
        <nav aria-label="화면 메뉴" className="-mx-1 mt-2 flex overflow-x-auto [scrollbar-width:none]">
          {MENU.map((m) => {
            const active = m.views.includes(view);
            return (
              <Link
                key={m.label}
                href={m.href(seasonCode)}
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
      </div>
    </header>
  );
}
