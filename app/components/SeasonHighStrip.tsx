"use client";
// 순위표 "이 시즌 한 경기 최다" 카드 줄 — 부문 7개(lib/highs HERO_HIGH_KEYS: 득점·리바운드·어시스트·스틸·블록·3점·자유투 성공) 각각 선수 사진·이름·기록·날짜·상대.
// 의도된 가로 스크롤 줄: 이 줄(ul)만 옆으로 밀리고 페이지는 밀리지 않는다 (ChipRow 와 같이 음수 여백을 쓰지 않는다).
// 고른 순위표 부문과 대응하는 카드(득점·리바운드·어시스트·스틸·블록)는 테두리로 강조하고, 보이도록 줄을 민다.
// 카드 내용은 서버에서 lib/highs buildSeasonHighCards 로 다 만들어 넘긴다. 카드가 없으면 부르는 쪽이 섹션을 숨긴다.
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { SeasonHighCard } from "@/lib/highs";
import type { CardTeam, SeasonHighLeaderKey } from "@/lib/types";
import { teamShortLabel } from "@/lib/images";
import { IconArrowRight } from "./icons";
import InfoLink from "./InfoLink";
import PlayerAvatar from "./PlayerAvatar";
import TeamLogo from "./TeamLogo";

interface Props {
  cards: SeasonHighCard[];
  teamByCode: ReadonlyMap<string, CardTeam>;
  /** 강조할 부문 (순위표에서 고른 부문과 대응할 때만) */
  activeKey: SeasonHighLeaderKey | null;
}

export default function SeasonHighStrip({ cards, teamByCode, activeKey }: Props) {
  const listRef = useRef<HTMLUListElement>(null);

  // 강조 카드가 줄 밖에 있으면 그 카드가 보이게 줄만 민다 (페이지 세로 위치는 건드리지 않는다)
  useEffect(() => {
    const ul = listRef.current;
    const li = activeKey ? ul?.querySelector<HTMLElement>(`[data-key="${activeKey}"]`) : null;
    if (!ul || !li) return;
    const left = li.offsetLeft;
    const right = left + li.offsetWidth;
    if (left >= ul.scrollLeft && right <= ul.scrollLeft + ul.clientWidth) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ul.scrollTo({ left: Math.max(0, left - 8), behavior: reduce ? "auto" : "smooth" });
  }, [activeKey]);

  return (
    <section aria-labelledby="season-highs-title" className="mt-6">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2">
        <h2 id="season-highs-title" className="flex items-center gap-1 text-h2 font-bold">
          이 시즌 한 경기 최다 <InfoLink term="gameHigh" className="ml-1" />
        </h2>
        <p className="text-sub text-ink-3">정규시즌 · 같은 기록이면 먼저 낸 선수</p>
      </div>
      <ul ref={listRef} className="relative flex snap-x gap-2.5 overflow-x-auto px-0.5 pb-2 pt-1 [scrollbar-width:thin]">
        {cards.map((c) => {
          const team = teamByCode.get(c.teamCode);
          const on = c.key === activeKey;
          return (
            <li
              key={c.key}
              data-key={c.key}
              className={`surface-card tabular w-[11.5rem] shrink-0 snap-start rounded-container p-3 ${on ? "outline-2 -outline-offset-2 outline-ink" : ""}`}
              aria-current={on ? "true" : undefined}
            >
              <p className="flex items-baseline justify-between gap-2 text-sub font-semibold text-ink-2">
                <span className="truncate">{c.label}</span>
                {c.times !== null && c.times > 1 && <span className="shrink-0 text-caption font-medium text-ink-3">{c.times}회</span>}
              </p>
              {/* deslop-ignore-next-line 11 */}
              <p className="mt-1 text-4xl font-black leading-none tracking-tight text-ink">{c.value}</p>
              {c.shot && <p className="mt-1 text-caption font-medium text-ink-3">{c.shot}</p>}
              <Link
                href={`/player/${c.playerNo}`}
                className="focus-ring group mt-2.5 flex min-h-11 min-w-0 items-center gap-2 rounded-control"
                title={`${c.nameKo} 선수 페이지`}
              >
                <PlayerAvatar photoUrl={c.photoUrl} nameKo={c.nameKo} color={team?.color} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-body font-semibold leading-tight text-ink underline-offset-2 group-hover:underline">
                    {c.nameKo}
                  </span>
                  <span className="flex min-w-0 items-center gap-1 text-caption text-ink-3">
                    <TeamLogo logoUrl={team?.logoUrl} shortName={team?.shortName ?? c.teamCode} color={team?.color} size={14} />
                    <span className="truncate">{teamShortLabel(team?.shortName ?? c.teamCode)}</span>
                  </span>
                </span>
              </Link>
              <p className="mt-2 truncate text-caption text-ink-3">
                {c.date}
                {c.opponent ? ` · vs ${teamShortLabel(c.opponent)}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 flex items-center gap-1 text-sub text-ink-3">
        옆으로 밀어 {cards.length}개 부문 보기 <IconArrowRight size={16} />
      </p>
    </section>
  );
}
