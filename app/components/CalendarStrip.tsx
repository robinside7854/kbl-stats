"use client";
// 일정 위 달력 띠 (2026-10-14 스포츠 앱 비교 2번 — 레사모 달력): 고른 달의 1일~말일 칸, 경기 있는 날은 점(경기 수),
// "내 응원팀" 보기에서는 상대 팀 로고 + 승(빨강)·패(파랑) 테두리. 칸을 누르면 아래 그날 경기로 내려간다(ScheduleView 가 스크롤).
// 폰은 옆으로 밀고(처음엔 오늘 또는 첫 경기일이 가운데), PC(1024px 이상)는 한 줄에 다 들어간다. 규칙은 lib/games monthCalendar.
import { useEffect, useRef } from "react";
import type { CalendarDay } from "@/lib/games";
import type { GameTeamInfo } from "./GameCard";
import TeamLogo from "./TeamLogo";

interface Props {
  days: CalendarDay[];
  teams: Record<string, GameTeamInfo>;
  today: string | null;
  /** 내 응원팀 보기 — 칸에 상대 팀 로고 */
  mine: boolean;
  onPick: (date: string) => void;
  className?: string;
}

const RESULT_RING: Record<"win" | "loss", string> = { win: "var(--div-hot)", loss: "var(--div-cold)" };

export default function CalendarStrip({ days, teams, today, mine, onPick, className = "" }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const month = days[0]?.date.slice(0, 7);

  // 처음 보일 칸: 오늘(그 달이면) → 첫 경기일
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const focus = days.find((d) => d.date === today) ?? days.find((d) => d.games > 0);
    const cell = focus ? el.querySelector<HTMLElement>(`[data-date="${focus.date}"]`) : null;
    el.scrollLeft = cell ? Math.max(0, cell.offsetLeft - el.clientWidth / 2 + cell.clientWidth / 2) : 0;
  }, [month, today, days]);

  if (days.length === 0) return null;
  return (
    <div ref={box} className={`-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0 ${className}`}>
      <ol aria-label="날짜 고르기" className="flex gap-1 lg:gap-0.5">
        {days.map((d) => {
          const isToday = d.date === today;
          const weekendTone = d.weekdayIndex === 0 ? "text-[var(--div-hot)]" : d.weekdayIndex === 6 ? "text-[var(--series-1)]" : "text-ink-3";
          const label = (
            <>
              <span className={`text-caption leading-none ${isToday ? "" : weekendTone}`}>{d.weekday}</span>
              <span className="text-sub font-bold leading-tight tabular">{d.day}</span>
            </>
          );
          const base = "flex w-10 shrink-0 flex-col items-center justify-start gap-1 rounded-control pb-1.5 pt-1.5 lg:w-auto lg:min-w-0 lg:flex-1";
          if (d.games === 0) {
            return (
              <li key={d.date} data-date={d.date} className={`${base} min-h-16 text-ink-3 opacity-60`}>
                {label}
              </li>
            );
          }
          const opp = mine && d.mine ? teams[d.mine.oppCode] : null;
          return (
            <li key={d.date} data-date={d.date} className="flex shrink-0 lg:min-w-0 lg:flex-1">
              <button
                type="button"
                onClick={() => onPick(d.date)}
                aria-label={`${d.date.slice(5, 7).replace(/^0/, "")}월 ${d.day}일 ${d.games}경기${opp ? ` · 상대 ${opp.shortName}${d.mine?.result ? (d.mine.result === "win" ? " 승" : " 패") : ""}` : ""}`}
                className={`focus-ring ${base} min-h-16 cursor-pointer transition-colors duration-200 ${isToday ? "bg-ink text-bg" : "bg-surface-2 text-ink hover:bg-line"}`}
              >
                {label}
                {opp && d.mine ? (
                  <span
                    // deslop-ignore-next-line 19
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white"
                    style={d.mine.result ? { boxShadow: `0 0 0 2px ${RESULT_RING[d.mine.result]}` } : undefined}
                  >
                    <TeamLogo logoUrl={opp.logoUrl} shortName={opp.shortName} color={opp.color} size={18} />
                  </span>
                ) : (
                  <span aria-hidden className="flex h-6 items-center gap-0.5">
                    {Array.from({ length: Math.min(d.games, 3) }, (_, i) => (
                      <span
                        key={i}
                        // deslop-ignore-next-line 19
                        className={`h-1.5 w-1.5 rounded-full ${isToday ? "bg-bg" : "bg-[var(--series-1)]"}`}
                      />
                    ))}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
