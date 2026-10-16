"use client";
// 선수 상세 "최근 경기" (2026-10-14 스포츠 앱 비교 5 — NBA·ESPN 선수 화면의 최근 경기 표): 카드 시즌의 최근 5경기
// 날짜·상대(홈 vs / 원정 @)·결과·출전·득점·리바·어시. 박스스코어가 있는 시즌만(25-26·26-27). 계산은 lib/games playerRecentGames(빌드 때).
// 줄을 누르면 그날 경기 일정(박스스코어는 거기서). GA4: game_link_click {game_key, place:"player_recent"}
import Link from "next/link";
import { minutesLabel, scheduleDayHref, type OppBrand, type PlayerRecentGame } from "@/lib/games";
import { ResultTag } from "./StreakText";
import TeamLogo from "./TeamLogo";
import { trackEvent } from "./track";

// 폰은 상대 = 로고만(이름은 sm 부터), 결과 칸이 남는 폭을 쓴다
const COLS = "grid grid-cols-[2.5rem_3rem_minmax(0,1fr)_2.25rem_2.25rem_2.25rem] items-center gap-x-2 sm:grid-cols-[3.5rem_minmax(0,1fr)_6rem_3rem_3rem_3rem_3rem_4rem]";

const shortDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export default function PlayerRecentGames({
  games,
  seasonCode,
  seasonShort,
}: {
  games: (PlayerRecentGame & { opp: OppBrand })[];
  seasonCode: number;
  seasonShort: string;
}) {
  return (
    <section aria-labelledby="recent-games-title" className="surface-card rounded-container p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="recent-games-title" className="text-h2 font-bold">
          최근 경기
        </h2>
        <p className="text-sub text-ink-3">{seasonShort} · 최근 {games.length}경기</p>
      </div>
      <ul className="tabular mt-3 divide-y divide-line">
        <li className={`${COLS} pb-2 text-caption font-semibold text-ink-3`}>
          <span>날짜</span>
          <span>상대</span>
          <span>결과</span>
          <span className="hidden text-right sm:block">출전</span>
          <span className="text-right">득점</span>
          <span className="text-right">리바</span>
          <span className="text-right">어시</span>
          <span className="hidden text-right sm:block">야투</span>
        </li>
        {games.map((g) => (
          <li key={g.gmkey}>
            <Link
              href={scheduleDayHref(seasonCode, g.date)}
              onClick={() => trackEvent("game_link_click", { game_key: g.gmkey, place: "player_recent" })}
              className={`focus-ring-inset ${COLS} min-h-12 py-1.5 text-sub transition-colors duration-200 hover:bg-surface-2`}
            >
              <span className="text-ink-2">{shortDate(g.date)}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="w-3 shrink-0 text-caption text-ink-3" aria-label={g.home ? "홈" : "원정"}>
                  {g.home ? "vs" : "@"}
                </span>
                <TeamLogo logoUrl={g.opp.logoUrl} shortName={g.opp.shortName} color={g.opp.color} size={20} />
                <span className="sr-only sm:not-sr-only sm:truncate sm:text-ink">{g.opp.shortName}</span>
              </span>
              <span className="whitespace-nowrap">
                <ResultTag win={g.win} /> <span className="text-ink-2">{g.teamScore}-{g.oppScore}</span>
              </span>
              <span className="hidden text-right text-ink-2 sm:block">{minutesLabel(g.sec)}</span>
              <span className="text-right font-bold text-ink">{g.pts}</span>
              <span className="text-right text-ink-2">{g.reb}</span>
              <span className="text-right text-ink-2">{g.ast}</span>
              <span className="hidden text-right text-ink-2 sm:block">
                {g.fgm}/{g.fga}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
