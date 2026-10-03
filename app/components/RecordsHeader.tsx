"use client";
// 역대 기록 머리말 + 하위 탭 (2026-10-03 사용자 요청: 누적 / 한 경기 최다 / 한 시즌 최다 / 수상·우승).
// 탭은 각자 주소(/records, /records/game, /records/season, /records/awards)라 링크로 옮긴다. GA4: filter_change screen=records filter=tab.
import Link from "next/link";
import InfoLink from "./InfoLink";
import { trackFilters } from "./track";

export type RecordsTab = "career" | "game" | "season" | "awards";

const TABS: { key: RecordsTab; label: string; href: string }[] = [
  { key: "career", label: "누적", href: "/records" },
  { key: "game", label: "한 경기 최다", href: "/records/game" },
  { key: "season", label: "한 시즌 최다", href: "/records/season" },
  { key: "awards", label: "수상·우승", href: "/records/awards" },
];

/** scope: 제목 위 범위 한 줄(누적 탭의 "KBL 정규시즌 · 97-26"). 없으면 안 그린다 */
export default function RecordsHeader({ tab, scope }: { tab: RecordsTab; scope?: string }) {
  return (
    <header className="mb-3">
      {scope && <p className="text-sub font-medium text-ink-3">{scope}</p>}
      <h1 className="mt-0.5 flex items-center gap-1 text-h1 font-bold">
        역대 기록 <InfoLink term="records" className="ml-1" />
      </h1>
      <nav aria-label="역대 기록 종류" className="mt-3 border-b border-line">
        <ul className="-mb-px flex overflow-x-auto [scrollbar-width:none]">
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <li key={t.key} className="shrink-0">
                <Link
                  href={t.href}
                  aria-current={on ? "page" : undefined}
                  onClick={() => !on && trackFilters("records", { tab: t.key })}
                  className={`focus-ring-inset flex h-11 items-center whitespace-nowrap border-b-2 px-3 text-body transition-colors duration-200 ${
                    on ? "border-ink font-bold text-ink" : "border-transparent font-medium text-ink-3 hover:text-ink"
                  }`}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
