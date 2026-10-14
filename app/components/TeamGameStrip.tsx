"use client";
// 팀 페이지 맨 위 경기 띠 (2026-10-14 스포츠 앱 비교 B-3 — KBO STATS 마이팀 날짜 칸): 지난 3경기 결과 + 다음 2경기를 가로로.
// 칸을 누르면 그날 경기 일정(박스스코어·하이라이트는 거기서). 계산은 lib/games teamGameStrip(빌드 때, 선수가 있는 최신 시즌).
// 다음 경기는 빌드 때 "아직 안 끝난 경기"라 하루 한 번 갱신 전까지는 이미 끝난 경기가 다음 경기로 남을 수 있다.
// GA4: game_link_click {game_key, place:"team_strip"}
import Link from "next/link";
import { scheduleDayHref, type OppBrand, type TeamStripGame } from "@/lib/games";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import { ResultTag } from "./StreakText";
import TeamLogo from "./TeamLogo";
import { trackEvent } from "./track";

const shortDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export interface TeamStripData {
  seasonCode: number;
  seasonShort: string;
  past: TeamStripGame[];
  next: TeamStripGame[];
  opps: Record<string, OppBrand>;
}

export default function TeamGameStrip({ strip }: { strip: TeamStripData }) {
  const tiles = [...strip.past.map((g) => ({ g, done: true })), ...strip.next.map((g) => ({ g, done: false }))];
  return (
    <section aria-labelledby="team-strip-title" className="surface-card rounded-container p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="team-strip-title" className="text-h2 font-bold">
          최근·다음 경기
        </h2>
        <p className="text-sub text-ink-3">{strip.seasonShort} 정규시즌</p>
      </div>
      <ol className="tabular mt-3 grid grid-cols-5 gap-1.5 sm:gap-2">
        {tiles.map(({ g, done }, i) => {
          const opp = strip.opps[g.oppCode] ?? { shortName: g.oppName, logoUrl: null, color: FALLBACK_TEAM_COLOR };
          const firstNext = !done && (i === 0 || tiles[i - 1].done);
          return (
            <li key={g.gmkey} className="min-w-0">
              <Link
                href={scheduleDayHref(strip.seasonCode, g.date)}
                onClick={() => trackEvent("game_link_click", { game_key: g.gmkey, place: "team_strip" })}
                aria-label={`${shortDate(g.date)} ${g.home ? "홈" : "원정"} ${opp.shortName}${done ? ` ${g.win ? "승" : "패"} ${g.teamScore}대${g.oppScore}` : g.start ? ` ${g.start} 경기` : " 예정"}`}
                className={`focus-ring flex h-full min-h-24 flex-col items-center gap-1 rounded-card border px-1 py-2 text-center transition-colors duration-200 hover:bg-surface-2 ${
                  firstNext ? "border-ink" : "border-line"
                } ${done ? "" : "bg-surface-2/60"}`}
              >
                <span className={`text-caption ${firstNext ? "font-semibold text-ink" : "text-ink-3"}`}>{shortDate(g.date)}</span>
                <span className="flex items-center gap-0.5">
                  <span className="text-caption text-ink-3">{g.home ? "vs" : "@"}</span>
                  <TeamLogo logoUrl={opp.logoUrl} shortName={opp.shortName} color={opp.color} size={24} />
                </span>
                <span className="w-full truncate text-caption text-ink-2">{opp.shortName}</span>
                {done ? (
                  <span className="whitespace-nowrap text-caption">
                    <ResultTag win={!!g.win} /> <span className="hidden text-ink-2 min-[400px]:inline">{g.teamScore}-{g.oppScore}</span>
                  </span>
                ) : (
                  <span className="whitespace-nowrap text-caption font-semibold text-ink">{g.start ?? "예정"}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
