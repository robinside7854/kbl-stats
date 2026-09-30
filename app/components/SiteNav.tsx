"use client";
// 모든 화면 상단 내비게이션: 사이트 이름 · 시즌 선택 · 화면 메뉴(레이더 카드 / 순위표).
// 시즌을 바꾸면 지금 보는 화면 종류와 주소 쿼리(선택 상태)를 그대로 둔 채 시즌만 바꾼다.
// 새 시즌에 없는 값(선수·팀)은 각 화면이 쿼리를 읽을 때 기본값으로 되돌린다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SeasonOption } from "@/lib/types";

export type SiteView = "radar" | "leaders";

const VIEWS: { view: SiteView; label: string; href: (seasonCode: number) => string }[] = [
  { view: "radar", label: "레이더 카드", href: (c) => `/season/${c}` },
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
  const current = VIEWS.find((v) => v.view === view)!;

  function changeSeason(code: string) {
    router.push(`${current.href(Number(code))}${window.location.search}`);
  }

  return (
    <header className="border-b border-line bg-surface">
      <div className={`mx-auto ${wide ? "max-w-5xl" : "max-w-3xl"} px-4`}>
        <div className="flex items-center justify-between gap-3 pt-3">
          <Link href="/" className="shrink-0 text-base font-bold tracking-tight text-ink">
            KBL 팬 스탯
          </Link>
          <label className="flex min-w-0 items-center gap-2 text-xs font-medium text-ink-2">
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
