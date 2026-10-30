"use client";
// "기록" 메뉴 머리말 + 탭 한 줄 (2026-10-06 사용자 결정: 리더보드와 역대 기록을 한 메뉴로 — 탭 안에 탭을 두지 않는다).
// 시즌별(시즌 리더보드 /season/{코드}/leaders) · 통산(/records) · 한 경기 최다 · 한 시즌 최다 · 수상(/records/awards, 시즌 어워즈 + 수상 횟수).
// 2026-10-16 탭 셋 추가: 리그 변화(/records/trends) · 드래프트(/records/draft) · 외국 선수 명예의 전당(/records/foreign). 2026-10-28 클러치(/records/clutch). 2026-10-30 프로필(/records/profile — 키·몸무게·나이 순위, 키 대비 기록).
// 탭이 열 개라 폰에서는 이 줄만 옆으로 밀린다(페이지는 밀리지 않음) — 지금 탭이 처음부터 보이게 줄을 그 탭까지 옮겨 둔다.
// 탭은 각자 주소라 링크로 옮긴다. GA4: filter_change screen=records filter=tab.
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { GlossaryKey } from "@/lib/glossary";
import InfoLink from "./InfoLink";
import { trackFilters } from "./track";

export type RecordsTab = "leaders" | "career" | "game" | "season" | "clutch" | "awards" | "trends" | "draft" | "foreign" | "profile";

// short: 폰(640px 미만)에서 줄인 이름 (탭이 많아 폰에서는 줄이 옆으로 밀린다)
const TABS: { key: RecordsTab; label: string; short?: string; href: (leadersSeason: number) => string }[] = [
  { key: "leaders", label: "시즌별", href: (c) => `/season/${c}/leaders` },
  { key: "career", label: "통산", href: () => "/records" },
  { key: "game", label: "한 경기 최다", short: "한 경기", href: () => "/records/game" },
  { key: "season", label: "한 시즌 최다", short: "한 시즌", href: () => "/records/season" },
  { key: "clutch", label: "클러치", href: () => "/records/clutch" },
  { key: "awards", label: "수상", href: () => "/records/awards" },
  { key: "draft", label: "드래프트", href: () => "/records/draft" },
  { key: "foreign", label: "외국 선수 전당", short: "외국 선수", href: () => "/records/foreign" },
  { key: "profile", label: "프로필", href: () => "/records/profile" },
  { key: "trends", label: "리그 변화", href: () => "/records/trends" },
];

/** 제목 옆 ⓘ 가 풀이하는 용어 (없는 탭은 "역대 통산 순위") */
const HEADER_TERM: Partial<Record<RecordsTab, GlossaryKey>> = { trends: "leagueTrends", draft: "draftClass", foreign: "foreignHall", clutch: "clutch", profile: "profileRanks" };

/**
 * scope: 제목 위 범위 한 줄(예: "25-26 KBL 정규시즌"). 없으면 안 그린다.
 * leadersSeason: "시즌별" 탭이 갈 시즌 (보통 선수가 있는 최신 시즌)
 * asOf: 기준 한 줄("10월 7일 경기까지 반영", lib/games asOfLabel) — 지난 시즌 리더보드처럼 상관없는 화면은 안 넘긴다
 */
export default function RecordsHeader({ tab, scope, leadersSeason, asOf }: { tab: RecordsTab; scope?: string; leadersSeason: number; asOf?: string | null }) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    // 지금 탭이 줄 밖(오른쪽)에 있으면 줄만 옆으로 옮긴다 (scrollIntoView 는 페이지 세로 위치까지 건드려서 쓰지 않는다)
    const ul = listRef.current;
    const on = ul?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!ul || !on) return;
    const right = on.offsetLeft + on.offsetWidth;
    if (right > ul.clientWidth) ul.scrollLeft = right - ul.clientWidth + 16;
  }, [tab]);
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
        기록 {tab !== "leaders" && <InfoLink term={HEADER_TERM[tab] ?? "records"} className="ml-1" />}
      </h1>
      <nav aria-label="기록 종류" className="mt-3 border-b border-line">
        <ul ref={listRef} className="relative -mb-px flex overflow-x-auto [scrollbar-width:none]">
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
