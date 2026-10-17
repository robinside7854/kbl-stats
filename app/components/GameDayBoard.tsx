"use client";
// 홈 "오늘의 경기" (2026-10-03 사용자 요청: 오늘 경기 기록·맞대결·선수 기록).
// 끝난 경기가 있는 가장 최근 날짜의 경기 카드(GameCard: 점수·팀·수훈 선수 → "박스스코어 보기" 팝업) + 다음 경기 대진 + 전체 일정 링크.
// 날짜가 브라우저의 한국 날짜와 같으면 "오늘의 경기", 아니면 "최근 경기". 데이터·계산은 lib/games (서버에서 고른 경기만 받는다).
// 로그인 회원이 응원팀을 골랐으면 그 팀 경기를 맨 앞에 놓고 "내 응원팀" 표시 (2026-10-08, lib/games myTeamsFirst — 정적 HTML 은 기본 순서).
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { gameDayLabel, myTeamsFirst, teamStandouts, type GameDay } from "@/lib/games";
import { kstDateString } from "@/lib/home";
import { teamShortLabel } from "@/lib/images";
import GameCard, { teamInfoOf, type GameTeamInfo } from "./GameCard";
import { IconChevronRight } from "./icons";
import TeamLogo from "./TeamLogo";
import { TeamLink } from "./EntityLinks";
import StreakText from "./StreakText";
import { useMember } from "./useLikes";

export type { GameTeamInfo };

interface Props {
  day: GameDay;
  next: GameDay | null;
  seasonCode: number;
  /** 팀 코드 → 이름·로고 (이 시즌, 없으면 직전 시즌 팀표) */
  teams: Record<string, GameTeamInfo>;
  /** 팀 코드 → 지금 2경기 이상 연승·연패 (lib/games notableStreak) — 다음 경기 줄에 */
  streaks?: Record<string, { label: string; kind: "W" | "L" }>;
}

export default function GameDayBoard({ day, next, seasonCode, teams, streaks = {} }: Props) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(kstDateString(new Date())), []);
  const isToday = today === day.date;
  const member = useMember();
  const myCodes = useMemo(() => member?.teamCodes ?? [], [member]);
  const mySet = useMemo(() => new Set(myCodes), [myCodes]);
  const isMine = (g: { home: { teamCode: string }; away: { teamCode: string } }) => mySet.has(g.home.teamCode) || mySet.has(g.away.teamCode);
  const games = useMemo(() => myTeamsFirst(day.games, myCodes), [day.games, myCodes]);
  const nextGames = useMemo(() => (next ? myTeamsFirst(next.games, myCodes) : []), [next, myCodes]);

  return (
    <section aria-labelledby="games-title" className="mx-auto mt-6 max-w-page px-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="games-title" className="text-h2 font-bold">
          {isToday ? "오늘의 경기" : "최근 경기"}
          <span className="ml-2 text-sub font-medium text-ink-3">{gameDayLabel(day.date)}</span>
        </h2>
        <Link
          href={`/season/${seasonCode}/schedule?date=${day.date}`}
          className="focus-ring link-shortcut shrink-0 px-1 text-sub"
        >
          전체 일정 <IconChevronRight size={16} />
        </Link>
      </div>
      <ul className={`mt-3 grid items-start gap-3 md:grid-cols-2 ${games.length >= 3 ? "xl:grid-cols-3" : ""}`}>
        {games.map((g) => (
          <li key={g.gmkey}>
            <GameCard
              game={g}
              seasonCode={seasonCode}
              teams={teams}
              stars={g.box ? { away: teamStandouts(g.box.away), home: teamStandouts(g.box.home) } : null}
              place="home"
              mine={isMine(g)}
            />
          </li>
        ))}
      </ul>
      {next && nextGames.length > 0 && (
        <div className="surface-card mt-3 rounded-container p-3">
          <p className="flex flex-wrap items-center justify-between gap-x-2 text-sub font-bold text-ink">
            <span className="whitespace-nowrap">다음 경기 · {gameDayLabel(next.date)}</span>
          </p>
          {/* 한 경기 = 두 줄: 시각·경기장 + 내 응원팀 꼬리표 / 홈 vs 원정(연승 꼬리표). 승리 확률 막대는 2026-10-17 사용자 요청으로 홈에서 뺌(일정 화면 카드에는 남음) */}
          <ul className="mt-1 divide-y divide-line md:grid md:grid-cols-2 md:gap-x-6 md:divide-y-0 xl:grid-cols-3">
            {nextGames.map((g) => {
              const away = teamInfoOf(teams, g.away.teamCode, g.away.name);
              const home = teamInfoOf(teams, g.home.teamCode, g.home.name);
              return (
                <li key={g.gmkey} className="tabular py-2.5 text-sub">
                  <p className="flex min-h-5 items-center gap-2 text-caption text-ink-3">
                    <span className="shrink-0 font-semibold text-ink-2">{g.start ?? "시간 미정"}</span>
                    {g.stadium && <span className="min-w-0 truncate">{g.stadium}</span>}
                    {isMine(g) && (
                      <span className="ml-auto shrink-0 rounded-control bg-[color-mix(in_oklab,var(--series-1)_12%,transparent)] px-1.5 py-0.5 font-bold leading-none text-series-1">
                        내 응원팀
                      </span>
                    )}
                  </p>
                  {/* 홈 팀이 늘 왼쪽 (2026-10-05, 경기 카드와 같은 순서) */}
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <TeamLink code={g.home.teamCode} season={seasonCode} place="home_next" className="flex min-h-10 min-w-0 items-center gap-2">
                        <TeamLogo logoUrl={home.logoUrl} shortName={home.shortName} color={home.color} size={24} />
                        <span className="min-w-0 truncate font-semibold text-ink">{teamShortLabel(home.shortName)}</span>
                      </TeamLink>
                      <StreakText streak={streaks[g.home.teamCode]} pill />
                    </div>
                    <span className="text-caption text-ink-3">vs</span>
                    <div className="flex min-w-0 items-center justify-end gap-1.5">
                      <StreakText streak={streaks[g.away.teamCode]} pill />
                      <TeamLink code={g.away.teamCode} season={seasonCode} place="home_next" className="flex min-h-10 min-w-0 items-center gap-2">
                        <span className="min-w-0 truncate font-semibold text-ink">{teamShortLabel(away.shortName)}</span>
                        <TeamLogo logoUrl={away.logoUrl} shortName={away.shortName} color={away.color} size={24} />
                      </TeamLink>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
