"use client";
// 선수 상세 압축 머리말 (2026-10-08 토스 검토 B-6: 토스증권 종목 상세처럼 위에 이름이 작게 고정).
// 머리말의 이름(#player-name)이 화면 위로 지나가면 맨 위에 고정된다: 사진 작게 · 이름 · 팀 · 즐겨찾기 별 + 탭.
// 2026-11-08: 섹션으로 스크롤하던 바로 가기를 탭(시즌·능력치·슛·커리어·명장면, PlayerTabs)으로 바꿨다 — 머리말 아래 탭 줄과 같은 탭.
// GA4: 탭은 filter_change screen=player filter=tab (PlayerTabs).
import { useEffect, useState } from "react";
import type { TeamColor } from "@/lib/types";
import FavoriteButton from "./FavoriteButton";
import PlayerAvatar from "./PlayerAvatar";
import { PLAYER_FIXED_BAR_ID, PlayerTabButtons, usePlayerTab } from "./PlayerTabs";

interface Props {
  playerId: string;
  nameKo: string;
  photoUrl: string | null;
  teamLabel: string;
  color: TeamColor;
}

export default function PlayerSectionNav({ playerId, nameKo, photoUrl, teamLabel, color }: Props) {
  const [show, setShow] = useState(false);
  const { available } = usePlayerTab();

  useEffect(() => {
    // 머리말 전체가 아니라 이름 기준 — 폰은 머리말(수상·이정표·소속 팀 이력)이 길어 이름이 사라진 뒤에도 한참 이어진다
    const hero = document.getElementById("player-name");
    let raf = 0;
    const check = () => {
      raf = 0;
      setShow(hero ? hero.getBoundingClientRect().bottom < 0 : false);
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

  return (
    <div
      id={PLAYER_FIXED_BAR_ID}
      role="region"
      aria-label={`${nameKo} 탭 바로 가기`}
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
        {available.length >= 2 && (
          <nav aria-label="선수 정보 탭" className="-mx-4 px-4 lg:mx-0 lg:px-0">
            <PlayerTabButtons compact focusable={show} />
          </nav>
        )}
      </div>
    </div>
  );
}
