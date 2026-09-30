"use client";
// 모든 화면 상단 내비게이션: 사이트 이름 · 선수 검색 · 시즌 선택 · 화면 메뉴(플레이어 카드 / 순위표).
// 시즌을 바꾸면 지금 보는 화면 종류와 주소 쿼리(선택 상태)를 그대로 둔 채 시즌만 바꾼다.
// 새 시즌에 없는 값(선수·팀)은 각 화면이 쿼리를 읽을 때 기본값으로 되돌린다.
// 선수 페이지(view="player")는 시즌에 매이지 않으므로 시즌 선택을 숨기고, 메뉴는 seasonCode(최신 시즌)로 연결한다.
// 검색창: 모바일은 둘째 줄 전체 폭, 640px 이상은 첫 줄 가운데.
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SeasonOption } from "@/lib/types";
import PlayerSearch from "./PlayerSearch";

export type SiteView = "radar" | "leaders" | "player";

const VIEWS: { view: Exclude<SiteView, "player">; label: string; href: (seasonCode: number) => string }[] = [
  { view: "radar", label: "플레이어 카드", href: (c) => `/season/${c}` },
  { view: "leaders", label: "순위표", href: (c) => `/season/${c}/leaders` },
];

interface Props {
  seasons: SeasonOption[];
  seasonCode: number;
  view: SiteView;
  /** 순위표처럼 넓은 화면에 맞출 때 */
  wide?: boolean;
}

export default function SiteNav({ seasons, seasonCode, view, wide = false }: Props) {
  const router = useRouter();
  const current = VIEWS.find((v) => v.view === view);

  function changeSeason(code: string) {
    if (current) router.push(`${current.href(Number(code))}${window.location.search}`);
  }

  return (
    <header className="border-b border-line bg-surface">
      <div className={`mx-auto ${wide ? "max-w-5xl" : "max-w-3xl"} px-4`}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3">
          <Link href="/" className="order-1 shrink-0 text-base font-bold tracking-tight text-ink">
            KBL 팬 스탯
          </Link>
          <PlayerSearch className="order-3 w-full sm:order-2 sm:w-auto sm:max-w-xs sm:flex-1" />
          {current && (
          <label className="order-2 flex min-w-0 items-center gap-2 text-xs font-medium text-ink-2 sm:order-3">
            <span className="shrink-0">시즌</span>
            <select
              aria-label="시즌 선택"
              className="h-9 min-w-0 rounded-lg border border-line bg-surface px-2 text-sm text-ink"
              value={seasonCode}
              onChange={(e) => changeSeason(e.target.value)}
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
        <nav aria-label="화면 메뉴" className="mt-2 flex gap-1">
          {VIEWS.map((v) => {
            const active = v.view === view;
            return (
              <Link
                key={v.view}
                href={v.href(seasonCode)}
                aria-current={active ? "page" : undefined}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
                  active ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink-2"
                }`}
              >
                {v.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
