"use client";
// 선수 상세 압축 머리말 + 섹션 탭 (2026-10-08 토스 검토 B-6: 토스증권 종목 상세처럼 위에 이름이 작게 고정).
// 머리말의 이름(#player-name)이 화면 위로 지나가면 맨 위에 고정된다: 사진 작게 · 이름 · 팀 · 즐겨찾기 별 + 탭(카드·추이·슛 차트·슛 변화·타임라인·기록·커리어 하이).
// 탭을 누르면 그 섹션 제목으로 스크롤, 스크롤하면 지금 보고 있는 섹션 탭이 파랗게 바뀐다.
// 섹션은 제목 id 로 찾는다 — 페이지에 없는 섹션(커리어 하이 없는 선수 등)의 탭은 숨긴다.
// GA4: filter_change screen=player filter=section value=키 (새 매개변수 없음).
import { useEffect, useRef, useState } from "react";
import type { TeamColor } from "@/lib/types";
import FavoriteButton from "./FavoriteButton";
import PlayerAvatar from "./PlayerAvatar";
import { trackFilters } from "./track";

export interface SectionTab {
  key: string;
  label: string;
  /** 섹션 제목 요소 id */
  targetId: string;
}

export const PLAYER_SECTION_TABS: SectionTab[] = [
  { key: "card", label: "카드", targetId: "season-cards-title" },
  { key: "trend", label: "추이", targetId: "trend-title" },
  { key: "shots", label: "슛 차트", targetId: "shot-chart-title" },
  { key: "habit", label: "슛 변화", targetId: "shot-habit-title" },
  { key: "timeline", label: "타임라인", targetId: "career-timeline-title" },
  { key: "table", label: "기록", targetId: "career-table-title" },
  { key: "highs", label: "커리어 하이", targetId: "career-highs-title" },
];

interface Props {
  playerId: string;
  nameKo: string;
  photoUrl: string | null;
  teamLabel: string;
  color: TeamColor;
}

export default function PlayerSectionNav({ playerId, nameKo, photoUrl, teamLabel, color }: Props) {
  const [show, setShow] = useState(false);
  const [tabs, setTabs] = useState<SectionTab[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTabs(PLAYER_SECTION_TABS.filter((t) => document.getElementById(t.targetId)));
    // 머리말 전체가 아니라 이름 기준 — 폰은 머리말(수상·이정표·소속 팀 이력)이 길어 이름이 사라진 뒤에도 한참 이어진다
    const hero = document.getElementById("player-name");
    let raf = 0;
    const check = () => {
      raf = 0;
      setShow(hero ? hero.getBoundingClientRect().bottom < 0 : false);
      // 지금 섹션: 제목이 고정 머리말 아래 선을 지난 마지막 섹션
      const line = (barRef.current?.offsetHeight ?? 0) + 24;
      let cur: string | null = null;
      for (const t of PLAYER_SECTION_TABS) {
        const el = document.getElementById(t.targetId);
        if (el && el.getBoundingClientRect().top <= line) cur = t.key;
      }
      setActive(cur);
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  function jump(t: SectionTab) {
    const el = document.getElementById(t.targetId);
    if (!el) return;
    trackFilters("player", { section: t.key });
    // 고정 머리말 높이만큼 덜 내려간다 (머리말이 아직 안 보일 때도 내려가면 나타나므로 같은 높이로 계산)
    const offset = (barRef.current?.offsetHeight ?? 96) + 12;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: reduce ? "auto" : "smooth" });
  }

  if (tabs.length < 2) return null;

  return (
    <div
      ref={barRef}
      role="region"
      aria-label={`${nameKo} 섹션 바로 가기`}
      aria-hidden={!show}
      className={`fixed inset-x-0 top-0 z-30 border-b border-line bg-surface transition-[opacity,transform] duration-200 ${
        show ? "opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
      }`}
      style={{ boxShadow: `inset 0 3px 0 ${color.primary}` }}
    >
      <div className="mx-auto flex max-w-page flex-col px-4 pt-[3px] lg:flex-row lg:items-center lg:gap-6">
        <div className="flex min-w-0 items-center gap-2 py-1.5 lg:shrink-0">
          <PlayerAvatar photoUrl={photoUrl} nameKo={nameKo} color={color} size={32} />
          <p className="min-w-0 flex-1 truncate">
            <span className="text-body font-bold text-ink">{nameKo}</span>
            <span className="ml-1.5 text-sub text-ink-3">{teamLabel}</span>
          </p>
          <span className={show ? "" : "invisible"}>
            <FavoriteButton playerId={playerId} nameKo={nameKo} plain />
          </span>
        </div>
        <nav aria-label="섹션" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <ul className="flex gap-1">
            {tabs.map((t) => {
              const on = active === t.key;
              return (
                <li key={t.key} className="shrink-0">
                  <button
                    type="button"
                    tabIndex={show ? 0 : -1}
                    aria-current={on ? "location" : undefined}
                    onClick={() => jump(t)}
                    className={`focus-ring-inset relative flex h-10 cursor-pointer items-center whitespace-nowrap px-3 text-sub font-semibold transition-colors duration-200 ${
                      on ? "text-[var(--series-1)]" : "text-ink-3 hover:text-ink"
                    }`}
                  >
                    {t.label}
                    {on && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 bg-[var(--series-1)]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
