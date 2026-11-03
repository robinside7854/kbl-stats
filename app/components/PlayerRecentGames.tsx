"use client";
// 선수 상세 "최근 경기" (2026-10-14 스포츠 앱 비교 5 — NBA·ESPN 선수 화면의 최근 경기 표): 카드 시즌의 최근 5경기
// 날짜·상대(홈 vs / 원정 @)·결과·출전·득점·리바·어시. 박스스코어가 있는 시즌만(25-26·26-27). 계산은 lib/games playerRecentGames(빌드 때).
// 위닝샷·버저비터를 넣은 경기는 결과 옆 꼬리표(2026-10-28). 줄을 누르면 그날 경기 일정(박스스코어는 거기서). GA4: game_link_click {game_key, place:"player_recent"}
// 2026-11-03 사용자 "PC 에서 여백이 많다 — 지표를 더": 표가 든 상자가 넓으면(64rem 이상, container query) 스틸·블록·턴오버·파울·3점·자유투 열을 더 보이고
// 숫자 열이 남는 폭을 나눠 쓴다. 폰은 그대로(상대 = 로고만), 그 사이 폭은 출전·야투까지.
import Link from "next/link";
import { minutesLabel, scheduleDayHref, type OppBrand, type PlayerRecentGame } from "@/lib/games";
import { WinningTag } from "./BoxScore";
import { ResultTag } from "./StreakText";
import TeamLogo from "./TeamLogo";
import { trackEvent } from "./track";

// 폰 6열 → 중간 8열 → 넓은 상자 14열(숫자 열은 fr 로 남는 폭을 나눔)
const COLS =
  "grid grid-cols-[2.5rem_3rem_minmax(0,1fr)_2.25rem_2.25rem_2.25rem] items-center gap-x-2 " +
  "@lg:grid-cols-[3.5rem_minmax(0,1fr)_6rem_3rem_3rem_3rem_3rem_4rem] " +
  "@5xl:grid-cols-[4rem_minmax(8rem,1.6fr)_8rem_repeat(11,minmax(3rem,1fr))] @5xl:gap-x-3";

/** 넓은 상자에서만 보이는 칸 */
const WIDE = "hidden text-right text-ink-2 @5xl:block";
/** 중간 폭부터 보이는 칸 */
const MID = "hidden text-right text-ink-2 @lg:block";

const shortDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const made = (m: number, a: number) => `${m}/${a}`;

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
    <section aria-labelledby="recent-games-title" className="@container surface-card rounded-container p-4">
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
          <span className="hidden text-right @lg:block">출전</span>
          <span className="text-right">득점</span>
          <span className="text-right">리바</span>
          <span className="text-right">어시</span>
          <span className="hidden text-right @5xl:block">스틸</span>
          <span className="hidden text-right @5xl:block">블록</span>
          <span className="hidden text-right @5xl:block">턴오버</span>
          <span className="hidden text-right @5xl:block">파울</span>
          <span className="hidden text-right @lg:block">야투</span>
          <span className="hidden text-right @5xl:block">3점</span>
          <span className="hidden text-right @5xl:block">자유투</span>
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
                <span className="sr-only @lg:not-sr-only @lg:truncate @lg:text-ink">{g.opp.shortName}</span>
              </span>
              <span className="whitespace-nowrap">
                <ResultTag win={g.win} /> <span className="text-ink-2">{g.teamScore}-{g.oppScore}</span>
                {g.winning && <WinningTag shot={g.winning} className="ml-1" />}
              </span>
              <span className={MID}>{minutesLabel(g.sec)}</span>
              <span className="text-right font-bold text-ink">{g.pts}</span>
              <span className="text-right text-ink-2">{g.reb}</span>
              <span className="text-right text-ink-2">{g.ast}</span>
              <span className={WIDE}>{g.stl}</span>
              <span className={WIDE}>{g.blk}</span>
              <span className={WIDE}>{g.tov}</span>
              <span className={WIDE}>{g.pf}</span>
              <span className={MID}>{made(g.fgm, g.fga)}</span>
              <span className={WIDE}>{made(g.tpm, g.tpa)}</span>
              <span className={WIDE}>{made(g.ftm, g.fta)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
