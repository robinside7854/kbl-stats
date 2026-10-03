"use client";
// 시즌 경기 일정 (2026-10-03 사용자: 날짜별 경기 일정·박스스코어, 메뉴 "일정" — 비교 탭 자리).
// 월 칩 → 그 달 날짜별 경기 카드(GameCard). 끝난 경기는 점수·수훈 선수, "선수 기록"을 누르면 그 날짜 박스스코어 파일
// /games/{시즌}/{날짜}.json(scripts/build-games.ts, 우리 정적 파일)을 받아 펼친다.
// 처음 달 = 주소 ?date= 또는 ?month=, 없으면 오늘(한국 날짜)이 든 달(lib/games pickMonth). 오늘·그 날짜로 스크롤.
// GA4: filter_change screen=schedule filter=month, boxscore_open place=schedule.
import { useEffect, useMemo, useState } from "react";
import type { GameBoxRow, SeasonGame } from "@/lib/types";
import { gameDayLabel, groupByDate, monthLabel, monthsOf, pickMonth } from "@/lib/games";
import { kstDateString } from "@/lib/home";
import ChipRow from "./ChipRow";
import GameCard, { type GameTeamInfo } from "./GameCard";
import { trackFilters } from "./track";

export interface ScheduleGame extends SeasonGame {
  /** 박스스코어 파일이 있는 경기 */
  hasBox: boolean;
  stars: { away: GameBoxRow | null; home: GameBoxRow | null } | null;
}

interface Props {
  seasonCode: number;
  seasonShort: string;
  games: ScheduleGame[];
  teams: Record<string, GameTeamInfo>;
  /** 서버가 고른 처음 달 (정적 HTML) — 브라우저가 오늘 날짜로 다시 고른다 */
  initialMonth: string | null;
}

type Box = NonNullable<SeasonGame["box"]>;
const dayCache = new Map<string, Promise<Record<string, Box> | null>>();
function loadDay(seasonCode: number, date: string) {
  const key = `${seasonCode}/${date}`;
  let p = dayCache.get(key);
  if (!p) {
    p = fetch(`/games/${key}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, Box>>) : null))
      .catch(() => null);
    dayCache.set(key, p);
  }
  return p;
}

export default function ScheduleView({ seasonCode, seasonShort, games, teams, initialMonth }: Props) {
  const months = useMemo(() => monthsOf(games), [games]);
  const [month, setMonth] = useState<string | null>(initialMonth);
  const [today, setToday] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const t = kstDateString(new Date());
    setToday(t);
    const qs = new URLSearchParams(window.location.search);
    const date = qs.get("date");
    const m = qs.get("month");
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && months.includes(date.slice(0, 7))) {
      setMonth(date.slice(0, 7));
      setTarget(date);
    } else if (m && months.includes(m)) {
      setMonth(m);
    } else {
      const pm = pickMonth(months, t);
      setMonth(pm);
      if (pm === t.slice(0, 7)) setTarget(t);
    }
  }, [months]);

  const days = useMemo(() => groupByDate(games.filter((g) => g.date.slice(0, 7) === month)), [games, month]);

  // 고른 날짜(없으면 오늘 이후 첫 경기일)로 스크롤
  useEffect(() => {
    if (!target) return;
    const first = days.find((d) => d.date >= target) ?? days[days.length - 1];
    if (!first) return;
    document.getElementById(`d-${first.date}`)?.scrollIntoView({ block: "start" });
    setTarget(null);
  }, [target, days]);

  function changeMonth(m: string) {
    trackFilters("schedule", { month: m });
    setMonth(m);
    window.history.replaceState(null, "", `${window.location.pathname}?month=${m}`);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-6 pt-5">
      <h1 className="text-h1 font-black">{seasonShort} 경기 일정</h1>
      <p className="mt-0.5 text-sub text-ink-3">정규시즌 · 끝난 경기는 "선수 기록"으로 박스스코어</p>
      {months.length === 0 ? (
        <p className="surface-card mt-4 rounded-container p-4 text-sub text-ink-3">이 시즌 경기 일정이 없습니다</p>
      ) : (
        <>
          <ChipRow
            label="달 고르기"
            scroll
            className="mt-4"
            chips={months.map((m) => ({ value: m, label: monthLabel(m) }))}
            value={month ?? months[0]}
            onChange={changeMonth}
          />
          {days.map((d) => (
            <section key={d.date} id={`d-${d.date}`} aria-labelledby={`h-${d.date}`} className="mt-5 scroll-mt-4">
              <h2 id={`h-${d.date}`} className="flex items-center gap-2 text-body font-bold text-ink">
                {gameDayLabel(d.date)}
                {today === d.date && (
                  <span className="rounded-control bg-ink px-1.5 py-0.5 text-caption font-bold text-bg">오늘</span>
                )}
                <span className="text-sub font-medium text-ink-3">{d.games.length}경기</span>
              </h2>
              <ul className="mt-2 grid items-start gap-3 md:grid-cols-2">
                {d.games.map((g) => (
                  <li key={g.gmkey}>
                    <GameCard
                      game={g}
                      seasonCode={seasonCode}
                      teams={teams}
                      stars={g.stars}
                      loadBox={g.hasBox ? async () => (await loadDay(seasonCode, g.date))?.[g.gmkey] ?? null : undefined}
                      place="schedule"
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
