"use client";
// 시즌 경기 일정 (2026-10-03 사용자: 날짜별 경기 일정·박스스코어, 메뉴 "일정" — 비교 탭 자리).
// 월 칩 → 그 달 날짜별 경기 카드(GameCard). 끝난 경기는 점수·수훈 선수, "박스스코어 보기"를 누르면 그 날짜 박스스코어 파일
// /games/{시즌}/{날짜}.json(scripts/build-games.ts, 우리 정적 파일)을 받아 팝업으로 보인다.
// 처음 달 = 주소 ?date= 또는 ?month=, 없으면 오늘(한국 날짜)이 든 달(lib/games pickMonth). 오늘·그 날짜로 스크롤.
// GA4: filter_change screen=schedule filter=month, boxscore_open place=schedule.
// 내 응원팀만 (2026-10-06 사용자 요청): 로그인한 회원은 응원팀(여러 팀) 경기만 보는 게 기본, "전체"로 바꿀 수 있다(고른 것은 이 브라우저에 기억).
//   응원팀을 안 골랐으면 고르러 가는 안내, 로그인 안 했으면 "로그인하면 우리 팀 경기만 볼 수 있다" 안내(로그인이 꺼진 빌드는 둘 다 없음).
//   GA4: filter_change screen=schedule filter=scope value=mine|all, login_prompt_click place=schedule.
import { useEffect, useMemo, useState } from "react";
import type { GameBoxRow, SeasonGame } from "@/lib/types";
import { gameDayLabel, gamesOfTeams, groupByDate, initialScheduleScope, monthLabel, monthsOf, pickMonth, type ScheduleScope, type SeasonProgress, type Standout } from "@/lib/games";
import { enabledLoginProviders } from "@/lib/account";
import Link from "next/link";
import Segmented from "./Segmented";
import { IconChevronRight } from "./icons";
import { useMember } from "./useLikes";
import { kstDateString } from "@/lib/home";
import ChipRow from "./ChipRow";
import GameCard, { type GameTeamInfo } from "./GameCard";
import SeasonProgressBar from "./SeasonProgressBar";
import { trackEvent, trackFilters } from "./track";

const SCOPE_KEY = "kbl-stats:schedule-scope:v1";
function readScope(): string | null {
  try {
    return window.localStorage.getItem(SCOPE_KEY);
  } catch {
    return null;
  }
}
function saveScope(v: ScheduleScope) {
  try {
    window.localStorage.setItem(SCOPE_KEY, v);
  } catch {
    // 저장 못 해도 이번 방문은 그대로
  }
}

export interface ScheduleGame extends SeasonGame {
  /** 박스스코어 파일이 있는 경기 */
  hasBox: boolean;
  stars: { away: Standout[]; home: Standout[] } | null;
}

interface Props {
  seasonCode: number;
  seasonShort: string;
  games: ScheduleGame[];
  teams: Record<string, GameTeamInfo>;
  /** 서버가 고른 처음 달 (정적 HTML) — 브라우저가 오늘 날짜로 다시 고른다 */
  initialMonth: string | null;
  /** 정규시즌 진행률 (lib/games seasonProgress) */
  progress: SeasonProgress | null;
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

export default function ScheduleView({ seasonCode, seasonShort, games, teams, initialMonth, progress }: Props) {
  const months = useMemo(() => monthsOf(games), [games]);
  const [month, setMonth] = useState<string | null>(initialMonth);
  const [today, setToday] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const member = useMember();
  const [loginOn, setLoginOn] = useState(false);
  useEffect(() => setLoginOn(enabledLoginProviders().length > 0), []);
  const myCodes = useMemo(() => member?.teamCodes ?? [], [member]);
  const myGames = useMemo(() => gamesOfTeams(games, myCodes), [games, myCodes]);
  const [scope, setScope] = useState<ScheduleScope>("all");
  useEffect(() => {
    if (member === undefined) return;
    setScope(initialScheduleScope(readScope(), myGames.length > 0));
  }, [member, myGames.length]);
  const mine = scope === "mine" && myGames.length > 0;
  const teamNames = myCodes.map((c) => teams[c]?.shortName).filter(Boolean).join(" · ");

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

  const shown = mine ? myGames : games;
  const days = useMemo(() => groupByDate(shown.filter((g) => g.date.slice(0, 7) === month)), [shown, month]);

  // 고른 날짜(없으면 오늘 이후 첫 경기일)로 스크롤
  useEffect(() => {
    if (!target) return;
    const first = days.find((d) => d.date >= target) ?? days[days.length - 1];
    if (!first) return;
    document.getElementById(`d-${first.date}`)?.scrollIntoView({ block: "start" });
    setTarget(null);
  }, [target, days]);

  function changeScope(v: ScheduleScope) {
    trackFilters("schedule", { scope: v });
    saveScope(v);
    setScope(v);
  }

  function changeMonth(m: string) {
    trackFilters("schedule", { month: m });
    setMonth(m);
    window.history.replaceState(null, "", `${window.location.pathname}?month=${m}`);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-6 pt-5">
      <h1 className="text-h1 font-black">{seasonShort} 경기 일정</h1>
      <p className="mt-0.5 text-sub text-ink-3">정규시즌 · 끝난 경기는 "박스스코어 보기"</p>
      {progress && <SeasonProgressBar progress={progress} className="mt-3 max-w-md" />}
      {months.length === 0 ? (
        <p className="surface-card mt-4 rounded-container p-4 text-sub text-ink-3">이 시즌 경기 일정이 없습니다</p>
      ) : (
        <>
          {loginOn && member && myGames.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Segmented
                label="보기 범위"
                options={[
                  { value: "mine", label: "내 응원팀" },
                  { value: "all", label: "전체 일정" },
                ]}
                value={scope}
                onChange={changeScope}
              />
              {mine && teamNames && <span className="text-sub text-ink-3">{teamNames} · {myGames.length}경기</span>}
            </div>
          )}
          {loginOn && member && myGames.length === 0 && (
            <p className="mt-4 text-sub text-ink-2">
              {myCodes.length === 0 ? "응원팀을 고르면 우리 팀 경기만 모아 볼 수 있어요. " : "이 시즌엔 응원팀 경기가 없어요. "}
              {myCodes.length === 0 && (
                <Link href="/me" className="focus-ring link-shortcut">
                  응원팀 고르기
                  <IconChevronRight size={16} aria-hidden />
                </Link>
              )}
            </p>
          )}
          {loginOn && member === null && (
            <p className="surface-card mt-4 flex flex-wrap items-center gap-x-2 rounded-card px-3 py-2 text-sub text-ink-2">
              로그인하고 응원팀을 고르면 우리 팀 경기만 모아 볼 수 있어요.
              <Link href="/me" className="focus-ring link-shortcut" onClick={() => trackEvent("login_prompt_click", { place: "schedule" })}>
                로그인하기
                <IconChevronRight size={16} aria-hidden />
              </Link>
            </p>
          )}
          <ChipRow
            label="달 고르기"
            scroll
            className="mt-4"
            chips={months.map((m) => ({ value: m, label: monthLabel(m) }))}
            value={month ?? months[0]}
            onChange={changeMonth}
          />
          {days.length === 0 && mine && (
            <p className="surface-card mt-4 rounded-container p-4 text-sub text-ink-3">
              이 달엔 응원팀 경기가 없어요.{" "}
              <button type="button" onClick={() => changeScope("all")} className="focus-ring link-shortcut cursor-pointer">
                전체 일정 보기
              </button>
            </p>
          )}
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
