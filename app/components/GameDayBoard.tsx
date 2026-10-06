"use client";
// 홈 "오늘의 경기" (2026-10-03 사용자 요청: 오늘 경기 기록·맞대결·선수 기록).
// 끝난 경기가 있는 가장 최근 날짜의 경기 카드(GameCard: 점수·팀·수훈 선수 → "박스스코어 보기" 팝업) + 다음 경기 대진 + 전체 일정 링크.
// 날짜가 브라우저의 한국 날짜와 같으면 "오늘의 경기", 아니면 "최근 경기". 데이터·계산은 lib/games (서버에서 고른 경기만 받는다).
import Link from "next/link";
import { useEffect, useState } from "react";
import { gameDayLabel, teamStandouts, type GameDay } from "@/lib/games";
import { kstDateString } from "@/lib/home";
import { teamShortLabel } from "@/lib/images";
import GameCard, { teamInfoOf, type GameTeamInfo } from "./GameCard";
import { IconChevronRight } from "./icons";
import TeamLogo from "./TeamLogo";

export type { GameTeamInfo };

interface Props {
  day: GameDay;
  next: GameDay | null;
  seasonCode: number;
  /** 팀 코드 → 이름·로고 (이 시즌, 없으면 직전 시즌 팀표) */
  teams: Record<string, GameTeamInfo>;
}

export default function GameDayBoard({ day, next, seasonCode, teams }: Props) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(kstDateString(new Date())), []);
  const isToday = today === day.date;

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
      <ul className={`mt-3 grid items-start gap-3 md:grid-cols-2 ${day.games.length >= 3 ? "xl:grid-cols-3" : ""}`}>
        {day.games.map((g) => (
          <li key={g.gmkey}>
            <GameCard
              game={g}
              seasonCode={seasonCode}
              teams={teams}
              stars={g.box ? { away: teamStandouts(g.box.away), home: teamStandouts(g.box.home) } : null}
              place="home"
            />
          </li>
        ))}
      </ul>
      {next && next.games.length > 0 && (
        <div className="surface-card mt-3 rounded-container p-3">
          <p className="text-sub font-bold text-ink">다음 경기 · {gameDayLabel(next.date)}</p>
          <ul className="mt-1 divide-y divide-line md:grid md:grid-cols-2 md:gap-x-6 md:divide-y-0 xl:grid-cols-3">
            {next.games.map((g) => {
              const away = teamInfoOf(teams, g.away.teamCode, g.away.name);
              const home = teamInfoOf(teams, g.home.teamCode, g.home.name);
              return (
                <li key={g.gmkey} className="tabular flex min-h-10 items-center gap-2 py-1.5 text-sub">
                  <span className="w-12 shrink-0 text-ink-3">{g.start ?? ""}</span>
                  {/* 홈 팀이 늘 왼쪽 (2026-10-05, 경기 카드와 같은 순서) */}
                  <TeamLogo logoUrl={home.logoUrl} shortName={home.shortName} color={home.color} size={20} />
                  <span className="min-w-0 truncate font-semibold text-ink">{teamShortLabel(home.shortName)}</span>
                  <span className="text-ink-3">vs</span>
                  <TeamLogo logoUrl={away.logoUrl} shortName={away.shortName} color={away.color} size={20} />
                  <span className="min-w-0 truncate font-semibold text-ink">{teamShortLabel(away.shortName)}</span>
                  {g.stadium && <span className="ml-auto hidden min-w-0 truncate text-caption text-ink-3 sm:inline md:ml-2">{g.stadium}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
