"use client";
// 팀 순위 표 (2026-10-03, 2026-10-06 부터 "팀" 화면 지금 팀 탭의 "표로 보기" — TeamsIndexView). 경기 결과(경기 목록 점수)로 센 순위 — lib/games computeStandings.
// 줄을 누르면 그 팀 페이지의 그 시즌 로스터(/team/코드?season=, 2026-10-04). GA4: team_select {team_code, season_code}.
// 폰 360px: 순위·팀·승-패·승률·승차 + 최근 5경기(점), PC 는 홈/원정·득실도.
import Link from "next/link";
import type { TeamColor } from "@/lib/types";
import { gamesBehindLabel, notableStreak, pctLabel, type StandingRow } from "@/lib/games";
import TeamLogo from "./TeamLogo";
import StreakText from "./StreakText";
import { trackEvent } from "./track";

export interface StandingTeam {
  shortName: string;
  logoUrl: string | null;
  color: TeamColor;
}

/** 한 시즌 순위 (서버가 시즌마다 만들어 넘긴다) */
export interface StandingsSeason {
  seasonCode: number;
  seasonShort: string;
  rows: StandingRow[];
  teams: Record<string, StandingTeam>;
  /** 우승팀 코드 (마감 시즌만) */
  championCode: string | null;
  ongoing: boolean;
  /** 팀 간 상대 전적 승 수 — h2h[i][j] = rows[i] 팀이 rows[j] 팀에게 이긴 수 (lib/games headToHeadWins, 2026-10-14) */
  h2h?: number[][];
}

// 승패 점은 색 점이라 완전한 원 (디자인 토큰 규칙의 예외: 아바타·색 점)
// deslop-ignore-next-line 19
const DOT = "inline-block h-2 w-2 rounded-full";

export default function StandingsTable({ season }: { season: StandingsSeason }) {
  const { seasonCode, rows, teams, championCode } = season;
  if (rows.length === 0) return <p className="surface-card rounded-container p-4 text-sub text-ink-3">이 시즌 경기 결과가 없습니다</p>;
  return (
    <>
      <div className="surface-card tabular rounded-container px-3 py-1">
          <table className="w-full table-fixed text-sub lg:text-body">
            <colgroup>
              <col className="w-7 lg:w-10" />
              <col className="lg:w-64" />
              {/* PC: 팀 이름과 숫자 사이를 승률 막대로 (2026-10-06 사용자: 넓은 빈칸) */}
              <col className="hidden lg:table-column" />
              <col className="w-12 sm:w-16 lg:w-24" />
              <col className="w-[3.25rem] sm:w-14 lg:w-20" />
              <col className="w-9 sm:w-12 lg:w-16" />
              <col className="hidden w-16 sm:table-column lg:w-20" />
              <col className="hidden w-16 sm:table-column lg:w-20" />
              <col className="w-12 sm:w-20 lg:w-36" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-caption text-ink-3">
                <th scope="col" className="py-2 text-left font-medium">순위</th>
                <th scope="col" className="py-2 text-left font-medium">팀</th>
                <td aria-hidden className="hidden lg:table-cell" />
                <th scope="col" className="py-2 text-right font-medium">승-패</th>
                <th scope="col" className="py-2 text-right font-medium">승률</th>
                <th scope="col" className="py-2 text-right font-medium">승차</th>
                <th scope="col" className="hidden py-2 text-right font-medium sm:table-cell">홈</th>
                <th scope="col" className="hidden py-2 text-right font-medium sm:table-cell">원정</th>
                <th scope="col" className="py-2 text-right font-medium">최근 5</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const t = teams[r.teamCode];
                const name = t?.shortName ?? r.name;
                // 선수 탭 쿼리 (lib/cardview parsePlayersQuery: season·team)
                const href = `/team/${r.teamCode}?season=${seasonCode}`;
                return (
                  <tr key={r.teamCode} className="border-b border-line last:border-b-0">
                    <td className="font-bold text-ink">{r.rank}</td>
                    <th scope="row" className="min-w-0 text-left font-semibold">
                      <Link
                        href={href}
                        onClick={() => trackEvent("team_select", { team_code: r.teamCode, season_code: seasonCode })}
                        className="focus-ring-inset -ml-1 flex min-h-12 min-w-0 items-center gap-2 rounded-md px-1 text-ink transition-colors duration-200 hover:bg-surface-2"
                      >
                        <TeamLogo logoUrl={t?.logoUrl ?? null} shortName={name} color={t?.color} size={24} />
                        <span className="truncate">{name}</span>
                        {championCode === r.teamCode && (
                          <span className="shrink-0 rounded-control px-1.5 py-0.5 text-caption font-bold" style={{ background: "var(--grade-s)", color: "var(--grade-s-ink)" }}>
                            우승
                          </span>
                        )}
                      </Link>
                    </th>
                    <td aria-hidden className="hidden pl-4 lg:table-cell">
                      <span className="block h-2.5 rounded-sm opacity-80" style={{ width: `${Math.round(r.pct * 1000) / 10}%`, background: t?.color?.primary ?? "#6b7280" }} />
                    </td>
                    <td className="text-right text-ink">{`${r.wins}-${r.losses}`}</td>
                    <td className="text-right font-semibold text-ink">{pctLabel(r.pct)}</td>
                    <td className="text-right text-ink-2">{gamesBehindLabel(r.gamesBehind)}</td>
                    <td className="hidden text-right text-ink-2 sm:table-cell">{`${r.homeWins}-${r.homeLosses}`}</td>
                    <td className="hidden text-right text-ink-2 sm:table-cell">{`${r.awayWins}-${r.awayLosses}`}</td>
                    <td className="text-right">
                      <span className="inline-flex items-center gap-0.5" aria-label={`최근 ${r.last5.length}경기 ${r.last5.filter((x) => x === "W").length}승 ${r.last5.filter((x) => x === "L").length}패${r.streak ? `, ${r.streak}` : ""}`}>
                        {r.last5.map((x, i) => (
                          <span key={i} aria-hidden className={`${DOT} ${x === "W" ? "bg-ink" : "border border-ink-3"}`} />
                        ))}
                      </span>
                      {/* 2연승·2연패 이상만, 폰에서도 (2026-10-11 사용자 결정 B) */}
                      {notableStreak(r) && <StreakText streak={notableStreak(r)!} className="block pt-0.5 sm:inline sm:pl-1 sm:pt-0" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      <p className="mt-2 text-caption text-ink-3">
        승률이 같으면 승 수·득실차 순 (KBL 공식 동률 규정인 상대 전적은 반영하지 않음) · 최근 5: 채운 점 승, 빈 점 패
      </p>
    </>
  );
}
