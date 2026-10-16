// 플레이오프 확률 (2026-10-16, "공홈에 없는 우리만의 기능" 1번): 팀 화면 지금 팀 탭(카드·표 보기 둘 다) 아래.
// 줄 = 팀(6강 확률 순), 칸 = 플레이오프(6위 안) 막대 + 숫자 · 4강 직행(2위 안) · 1위 · 시즌 끝 예상 승패.
// 숫자는 lib/predict 가 빌드 때 남은 일정을 1만 번 돌린 우리 추정(KBL 공식 아님) — 제목 옆 ⓘ 가 방법을 설명한다.
// 팀을 누르면 팀 페이지(GA4 team_select place=playoff_odds). 새 이벤트 없음(ⓘ 는 help_open topic=playoffOdds).
import type { PlayoffOdds } from "@/lib/predict";
import { oddsText } from "@/lib/predict";
import { teamShortLabel } from "@/lib/images";
import type { TeamColor } from "@/lib/types";
import InfoLink from "./InfoLink";
import PredictionRecordLine from "./PredictionRecordLine";
import type { SeasonPredictionRecord } from "@/lib/data-predict-extra";
import TeamLogo from "./TeamLogo";
import { TeamLink } from "./EntityLinks";

export interface OddsTeam {
  shortName: string;
  logoUrl: string | null;
  color: TeamColor;
}

export default function PlayoffOddsBoard({
  odds,
  teams,
  seasonCode,
  remaining,
  asOf = null,
  record = null,
  previousRecord = null,
}: {
  odds: PlayoffOdds[];
  teams: Record<string, OddsTeam>;
  seasonCode: number;
  /** 남은 경기 수 */
  remaining: number;
  asOf?: string | null;
  /** 올 시즌 경기 전 예측 적중 (lib/data-predict-extra, 2026-10-16) */
  record?: SeasonPredictionRecord | null;
  previousRecord?: SeasonPredictionRecord | null;
}) {
  if (odds.length === 0) return null;
  return (
    <section aria-labelledby="po-odds-title" className="mt-6">
      <h2 id="po-odds-title" className="flex items-center text-h2 font-bold">
        플레이오프 확률
        <InfoLink term="playoffOdds" className="ml-1" />
      </h2>
      <p className="mt-1 text-sub text-ink-3">
        남은 {remaining}경기를 1만 번 돌려 본 우리 추정이에요{asOf ? ` · ${asOf}` : ""}
      </p>
      <div className="surface-card tabular mt-3 rounded-container px-3 py-1 sm:px-4">
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_2.75rem_2.5rem] items-center gap-x-2 border-b border-line py-2 text-caption font-semibold text-ink-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_4.5rem_3.5rem_6rem]">
          <span>팀</span>
          <span>플레이오프</span>
          <span className="text-right">
            <span className="sm:hidden">직행</span>
            <span className="hidden sm:inline">4강 직행</span>
          </span>
          <span className="text-right">1위</span>
          <span className="hidden text-right sm:block">예상 성적</span>
        </div>
        <ul className="divide-y divide-line">
          {odds.map((o) => {
            const t = teams[o.teamCode];
            const name = t?.shortName ?? o.teamCode;
            const width = o.playoff === "in" ? 1 : o.playoff === "out" ? 0 : o.top6;
            return (
              <li
                key={o.teamCode}
                className="grid min-h-12 grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_2.75rem_2.5rem] items-center gap-x-2 py-1.5 text-sub sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_4.5rem_3.5rem_6rem]"
              >
                <TeamLink code={o.teamCode} season={seasonCode} place="playoff_odds" className="flex min-h-10 min-w-0 items-center gap-2">
                  <TeamLogo logoUrl={t?.logoUrl ?? null} shortName={name} color={t?.color} size={24} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{teamShortLabel(name)}</span>
                    <span className="block whitespace-nowrap text-caption text-ink-3">
                      {o.wins}승 {o.losses}패
                    </span>
                  </span>
                </TeamLink>
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-surface-2">
                    <span className="block h-full rounded-sm bg-[var(--series-1)]" style={{ width: `${Math.round(width * 100)}%` }} />
                  </span>
                  <span className="w-10 shrink-0 text-right font-bold text-ink">{oddsText(o.top6, o.playoff)}</span>
                </span>
                <span className="text-right text-ink-2">{oddsText(o.top2)}</span>
                <span className="text-right text-ink-2">{oddsText(o.first)}</span>
                <span className="hidden text-right text-ink-2 sm:block">
                  {Math.round(o.expWins)}승 {Math.round(o.expLosses)}패
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <PredictionRecordLine record={record} previous={previousRecord} className="mt-1" />
    </section>
  );
}
