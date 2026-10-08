"use client";
// "기록" 메뉴 머리말 + 탭 한 줄 (2026-10-06 사용자 결정: 리더보드와 역대 기록을 한 메뉴로 — 탭 안에 탭을 두지 않는다).
// 시즌별(시즌 리더보드 /season/{코드}/leaders) · 통산(/records) · 한 경기 최다 · 한 시즌 최다 · 수상(/records/awards, 시즌 어워즈 + 수상 횟수).
// 탭은 각자 주소라 링크로 옮긴다. GA4: filter_change screen=records filter=tab.
import Link from "next/link";
import InfoLink from "./InfoLink";
import { trackFilters } from "./track";

export type RecordsTab = "leaders" | "career" | "game" | "season" | "awards";

// short: 폰(640px 미만)에서 다섯 탭이 한 줄에 들어가게 줄인 이름
const TABS: { key: RecordsTab; label: string; short?: string; href: (leadersSeason: number) => string }[] = [
  { key: "leaders", label: "시즌별", href: (c) => `/season/${c}/leaders` },
  { key: "career", label: "통산", href: () => "/records" },
  { key: "game", label: "한 경기 최다", short: "한 경기", href: () => "/records/game" },
  { key: "season", label: "한 시즌 최다", short: "한 시즌", href: () => "/records/season" },
  { key: "awards", label: "수상", href: () => "/records/awards" },
];

/**
 * scope: 제목 위 범위 한 줄(예: "25-26 KBL 정규시즌"). 없으면 안 그린다.
 * leadersSeason: "시즌별" 탭이 갈 시즌 (보통 선수가 있는 최신 시즌)
 * asOf: 기준 한 줄("10월 7일 경기까지 반영", lib/games asOfLabel) — 지난 시즌 리더보드처럼 상관없는 화면은 안 넘긴다
 */
export default function RecordsHeader({ tab, scope, leadersSeason, asOf }: { tab: RecordsTab; scope?: string; leadersSeason: number; asOf?: string | null }) {
  return (
    <header className="mb-3">
      {(scope || asOf) && (
        <p className="text-sub font-medium text-ink-3">
          {scope}
          {scope && asOf && " · "}
          {asOf}
        </p>
      )}
      <h1 className="mt-0.5 flex items-center gap-1 text-h1 font-bold">
        기록 {tab !== "leaders" && <InfoLink term="records" className="ml-1" />}
      </h1>
      <nav aria-label="기록 종류" className="mt-3 border-b border-line">
        <ul className="-mb-px flex overflow-x-auto [scrollbar-width:none]">
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <li key={t.key} className="shrink-0">
                <Link
                  href={t.href(leadersSeason)}
                  aria-current={on ? "page" : undefined}
                  onClick={() => !on && trackFilters("records", { tab: t.key })}
                  className={`focus-ring-inset flex h-11 items-center whitespace-nowrap border-b-2 px-2.5 text-body transition-colors duration-200 sm:px-3 lg:px-4 ${
                    on ? "border-ink font-bold text-ink" : "border-transparent font-medium text-ink-3 hover:text-ink"
                  }`}
                >
                  {t.short ? (
                    <>
                      <span className="sm:hidden">{t.short}</span>
                      <span className="hidden sm:inline">{t.label}</span>
                    </>
                  ) : (
                    t.label
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
