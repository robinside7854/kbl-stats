"use client";
// 팀 화면 "팀 순위" (2026-10-03 사용자 요청: 모바일 하단 메뉴에 "팀"). 경기 결과(경기 목록 점수)로 센 순위 — lib/games computeStandings.
// 줄을 누르면 선수 탭의 그 시즌·그 팀 선수 목록(/players?season=&team=). GA4: team_select {team_code, season_code}.
// 폰 360px: 순위·팀·승-패·승률·승차 + 최근 5경기(점), PC 는 홈/원정·득실도.
import Link from "next/link";
import type { TeamColor } from "@/lib/types";
import { gamesBehindLabel, pctLabel, type StandingRow } from "@/lib/games";
import TeamLogo from "./TeamLogo";
import { trackEvent } from "./track";

export interface StandingTeam {
  shortName: string;
  logoUrl: string | null;
  color: TeamColor;
}

interface Props {
  seasonCode: number;
  seasonShort: string;
  rows: StandingRow[];
  teams: Record<string, StandingTeam>;
  /** 우승팀 코드 (마감 시즌만) */
  championCode: string | null;
  ongoing: boolean;
}

// 승패 점은 색 점이라 완전한 원 (디자인 토큰 규칙의 예외: 아바타·색 점)
// deslop-ignore-next-line 19
const DOT = "inline-block h-2 w-2 rounded-full";

export default function StandingsView({ seasonCode, seasonShort, rows, teams, championCode, ongoing }: Props) {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-6 pt-5">
      <h1 className="text-h1 font-black">{seasonShort} 팀 순위</h1>
      <p className="mt-0.5 text-sub text-ink-3">
        정규시즌 경기 결과로 센 순위{ongoing ? " · 진행 중" : ""} · 팀을 누르면 그 팀 선수
      </p>
      {rows.length === 0 ? (
        <p className="surface-card mt-4 rounded-container p-4 text-sub text-ink-3">이 시즌 경기 결과가 없습니다</p>
      ) : (
        <div className="surface-card tabular mt-4 rounded-container px-3 py-1">
          <table className="w-full table-fixed text-sub">
            <colgroup>
              <col className="w-7" />
              <col />
              <col className="w-12 sm:w-16" />
              <col className="w-11 sm:w-14" />
              <col className="w-9 sm:w-12" />
              <col className="hidden w-16 sm:table-column" />
              <col className="hidden w-16 sm:table-column" />
              <col className="w-12 sm:w-20" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-caption text-ink-3">
                <th scope="col" className="py-2 text-left font-medium">순위</th>
                <th scope="col" className="py-2 text-left font-medium">팀</th>
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
                const href = `/players?season=${seasonCode}&team=${r.teamCode}`;
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
                      <span className="hidden pl-1 text-caption text-ink-3 sm:inline">{r.streak}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-caption text-ink-3">
        승률이 같으면 승 수·득실차 순 (KBL 공식 동률 규정인 상대 전적은 반영하지 않음) · 최근 5: 채운 점 승, 빈 점 패
      </p>
    </main>
  );
}
