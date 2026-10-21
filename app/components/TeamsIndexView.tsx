"use client";
// 모든 팀 화면 (/teams, 2026-10-04 · 2026-10-06 개편): 하위 탭 "지금 팀"(이번 시즌 순위 순) / "추억의 팀"(매각·해체로 코드가 끝난 팀).
// 2026-10-06 사용자: 폰에서도 2열 카드, 우승은 트로피 + 숫자만, 팀 좋아요는 없애고 팬 수만(응원팀으로 고른 회원 수, /api/likes 1분 캐시),
//   지금 팀은 시즌 순위를 카드에 바로(1위부터), 좋아요 순위(선수)는 머리말 링크. 탭은 주소 ?tab=past 로 기억.
// 2026-10-06: 지금 팀 탭에 "카드 / 표" 전환 — 표는 시즌을 골라 보는 팀 순위(따로 있던 /season/코드/teams 화면을 합침, 주소 ?view=table&season=).
// 2026-10-14: 표 보기 순위 표 아래에 팀 간 상대 전적 표(HeadToHeadMatrix, 같은 시즌 고르기를 따름).
// 2026-10-21: 카드 개편 — 팀 색 띠·순위 큰 숫자·득실·플레이오프 막대·득점 1위 사진.
// GA4: 카드 누르기 team_select {team_code, place:"teams"}, 탭 filter_change screen=teams filter=tab value=now|past · view card|table · season 코드
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { TeamIndexEntry } from "@/lib/franchise";
import ChipRow from "./ChipRow";
import Segmented from "./Segmented";
import StandingsTable, { type StandingsSeason } from "./StandingsTable";
import HeadToHeadMatrix from "./HeadToHeadMatrix";
import PlayoffOddsBoard, { type OddsTeam } from "./PlayoffOddsBoard";
import { oddsText, type PlayoffOdds } from "@/lib/predict";
import TeamLogo from "./TeamLogo";
import PlayerAvatar from "./PlayerAvatar";
import type { TeamScoringLeader } from "@/lib/cardview";
import StreakText from "./StreakText";
import { IconHeart, IconMegaphone, IconTrophy } from "./icons";
import { trackEvent, trackFilters } from "./track";
import { useLikeCounts } from "./useLikes";

type Tab = "now" | "past";
type View = "card" | "table";
const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: "card", label: "카드" },
  { value: "table", label: "표" },
];

export interface TeamsOdds {
  seasonCode: number;
  rows: PlayoffOdds[];
  teams: Record<string, OddsTeam>;
  remaining: number;
}

export default function TeamsIndexView({ teams, seasonCode, seasonShort, records, standings, asOf = null, odds = null, leaders = {} }: {
  teams: TeamIndexEntry[];
  seasonCode: number;
  seasonShort: string;
  /** diff = 경기당 득실차 (경기 없으면 null) */
  records: Record<string, { wins: number; losses: number; rank: number; diff: number | null; streak?: { label: string; kind: "W" | "L" } | null }>;
  /** 시즌별 순위 표 (최신 시즌 먼저) */
  standings: StandingsSeason[];
  /** "10월 7일 경기까지 반영" — 지금 시즌 카드에만 붙인다 */
  asOf?: string | null;
  /** 진행 중 시즌의 플레이오프 확률 (lib/predict, 2026-10-16) — 마감 시즌이면 null */
  odds?: TeamsOdds | null;
  /** 팀마다 이번 시즌 경기당 득점 1위 (lib/cardview teamScoringLeaders, 2026-10-21) */
  leaders?: Record<string, TeamScoringLeader>;
}) {
  const counts = useLikeCounts();
  const [tab, setTab] = useState<Tab>("now");
  const [view, setView] = useState<View>("card");
  // 표로 볼 시즌: 경기 결과가 있는 시즌만 (최신 시즌은 개막 전이어도 둔다)
  const tableSeasons = useMemo(() => standings.filter((s, i) => i === 0 || s.rows.length > 0), [standings]);
  const [tableSeason, setTableSeason] = useState(seasonCode);
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("tab") === "past") setTab("past");
    if (qs.get("view") === "table") setView("table");
    const sc = Number(qs.get("season"));
    if (tableSeasons.some((s) => s.seasonCode === sc)) setTableSeason(sc);
  }, [tableSeasons]);

  // 지금 팀: 이번 시즌 순위 순(같은 순위는 원래 순서), 아직 경기 없는 팀은 뒤
  const active = useMemo(
    () =>
      teams
        .filter((t) => t.active)
        .sort((a, b) => (records[a.brand.teamCode]?.rank ?? 99) - (records[b.brand.teamCode]?.rank ?? 99) || a.order - b.order),
    [teams, records],
  );
  const memories = useMemo(() => teams.filter((t) => !t.active), [teams]);

  // 주소: ?tab=past / ?view=table&season= (기본값은 뺀다)
  function writeUrl(next: { tab: Tab; view: View; season: number }) {
    const qs = new URLSearchParams();
    if (next.tab === "past") qs.set("tab", "past");
    else if (next.view === "table") {
      qs.set("view", "table");
      if (next.season !== seasonCode) qs.set("season", String(next.season));
    }
    const q = qs.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
  }
  function changeTab(v: Tab) {
    setTab(v);
    trackFilters("teams", { tab: v });
    writeUrl({ tab: v, view, season: tableSeason });
  }
  function changeView(v: View) {
    setView(v);
    trackFilters("teams", { view: v });
    writeUrl({ tab, view: v, season: tableSeason });
  }
  function changeTableSeason(v: number) {
    setTableSeason(v);
    trackFilters("teams", { season: v });
    writeUrl({ tab, view, season: v });
  }
  const shownStandings = tableSeasons.find((s) => s.seasonCode === tableSeason) ?? tableSeasons[0];

  const oddsBy = useMemo(() => new Map((odds?.rows ?? []).map((o) => [o.teamCode, o])), [odds]);
  /**
   * 팀 카드 (2026-10-21 디자인 개편): 위 = 팀 색 옅은 띠(로고 · 순위 큰 숫자 · 팀 이름),
   * 아래 = 성적·득실 → 플레이오프 확률 막대 → 득점 1위 선수(사진·이름·경기당 득점) → 우승·팬 수.
   * 가운데 정렬로 비던 양옆을 기록으로 채운다.
   */
  const card = (t: TeamIndexEntry) => {
    const rec = t.active ? records[t.brand.teamCode] : undefined;
    const po = t.active ? oddsBy.get(t.brand.teamCode) : undefined;
    const fans = t.active && counts ? (counts.fans?.[t.brand.teamCode] ?? 0) : undefined;
    const leader = t.active ? leaders[t.brand.teamCode] : undefined;
    const color = t.brand.color;
    const poShare = po ? (po.playoff === "in" ? 1 : po.playoff === "out" ? 0 : po.top6) : 0;
    return (
      <li key={t.brand.teamCode} className="min-w-0">
        <Link
          href={`/team/${t.brand.teamCode}`}
          onClick={() => trackEvent("team_select", { team_code: t.brand.teamCode, place: "teams" })}
          className="focus-ring surface-card tabular flex h-full min-w-0 flex-col overflow-hidden rounded-container transition-colors duration-200 hover:bg-surface-2"
        >
          <span
            className="block shrink-0 border-b-[3px] px-3 pb-2.5 pt-3"
            style={{ background: `color-mix(in srgb, ${color.primary} 15%, var(--surface))`, borderColor: color.primary }}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="inline-flex rounded-card bg-white p-1.5 shadow-card">
                <TeamLogo logoUrl={t.brand.logoUrl} shortName={t.brand.shortName} color={color} size={40} />
              </span>
              {rec && (
                <span className="flex items-baseline leading-none text-ink" aria-label={`${rec.rank}위`}>
                  {/* deslop-ignore-next-line 11 */}
                  <span className="text-[30px] font-black tracking-tight lg:text-[34px]">{rec.rank}</span>
                  <span className="ml-0.5 text-sub font-bold text-ink-2">위</span>
                </span>
              )}
            </span>
            <span className="mt-2 block truncate text-body font-bold leading-tight text-ink">{t.brand.name}</span>
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-2 px-3 pb-2 pt-2.5">
            <span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-sub">
              <span className="min-w-0 whitespace-nowrap font-semibold text-ink">
                {t.active ? (
                  rec ? (
                    <>
                      {`${rec.wins}승 ${rec.losses}패`}
                      {rec.streak && (
                        <>
                          <span className="font-normal text-ink-3"> · </span>
                          <StreakText streak={rec.streak} />
                        </>
                      )}
                    </>
                  ) : (
                    <span className="font-normal text-ink-3">아직 경기 없음</span>
                  )
                ) : (
                  `${t.spanLabel} · ${t.seasons}시즌`
                )}
              </span>
              {rec && rec.diff !== null && (
                <span className="shrink-0 text-caption text-ink-3" title="경기당 득실차">
                  득실 <b className="font-semibold text-ink-2">{rec.diff > 0 ? "+" : ""}{rec.diff.toFixed(1)}</b>
                </span>
              )}
            </span>

            {po && (
              <span className="block" aria-label={`플레이오프 확률 ${oddsText(po.top6, po.playoff)}`}>
                <span className="flex items-baseline justify-between text-caption">
                  <span className="text-ink-3">플레이오프</span>
                  <b className="font-bold text-ink">{oddsText(po.top6, po.playoff)}</b>
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-sm bg-surface-2" aria-hidden>
                  <span className="block h-full rounded-sm" style={{ width: `${Math.round(poShare * 100)}%`, background: color.primary }} />
                </span>
              </span>
            )}

            {leader && (
              <span className="flex min-w-0 items-center gap-2" aria-label={`득점 1위 ${leader.nameKo} 경기당 ${leader.ppg.toFixed(1)}점`}>
                <PlayerAvatar photoUrl={leader.photoUrl} nameKo={leader.nameKo} color={color} size={34} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sub font-semibold text-ink">{leader.nameKo}</span>
                  <span className="block whitespace-nowrap text-caption text-ink-3">
                    득점 1위 <b className="font-bold text-ink">{leader.ppg.toFixed(1)}</b>
                  </span>
                </span>
              </span>
            )}

            {!t.active && t.successorName && <span className="truncate text-caption text-ink-3">이어진 팀 · {t.successorName}</span>}

            <span className="mt-auto flex items-center gap-3 border-t border-line pt-2 text-sub font-semibold text-ink">
              <span className={`inline-flex items-center gap-1 ${t.championships > 0 ? "" : "text-ink-3"}`} aria-label={`우승 ${t.championships}회`}>
                <IconTrophy size={16} aria-hidden />
                {t.championships}
              </span>
              {fans !== undefined && (
                <span className={`inline-flex items-center gap-1 ${fans > 0 ? "" : "text-ink-3"}`} aria-label={`팬 ${fans}명`}>
                  <IconMegaphone size={16} filled={fans > 0} aria-hidden />
                  {fans}
                </span>
              )}
            </span>
          </span>
        </Link>
      </li>
    );
  };

  return (
    <main className="mx-auto max-w-page px-4 pb-6 pt-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-h1 font-black">팀</h1>
          <p className="mt-0.5 text-sub text-ink-3">팀을 누르면 역대 성적·로스터·레전드가 나와요.</p>
        </div>
        <Link
          href="/likes"
          className="focus-ring inline-flex h-10 shrink-0 items-center gap-1.5 rounded-control border border-line bg-surface px-3 text-sub font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
        >
          <IconHeart size={16} />
          좋아요 순위
        </Link>
      </div>

      <ChipRow
        label="팀 보기"
        className="mt-4"
        chips={[
          { value: "now", label: `지금 팀 ${active.length}` },
          { value: "past", label: `추억의 팀 ${memories.length}` },
        ]}
        value={tab}
        onChange={changeTab}
      />

      {tab === "now" ? (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            {view === "card" || !shownStandings ? (
              <p className="text-sub text-ink-2">
                {seasonShort} 시즌 순위 · 승률 순{asOf && <span className="text-ink-3"> · {asOf}</span>}
              </p>
            ) : (
              <label className="flex items-center gap-2 text-sub font-medium text-ink-2">
                <span className="shrink-0">시즌</span>
                <select
                  aria-label="순위 시즌 선택"
                  className="focus-ring h-10 min-w-0 cursor-pointer rounded-control border border-line bg-surface px-2 text-base text-ink"
                  value={shownStandings.seasonCode}
                  onChange={(e) => changeTableSeason(Number(e.target.value))}
                >
                  {tableSeasons.map((s) => (
                    <option key={s.seasonCode} value={s.seasonCode}>
                      {s.seasonShort}
                    </option>
                  ))}
                </select>
                {shownStandings.ongoing && <span className="text-ink-3">진행 중</span>}
              </label>
            )}
            <Segmented label="카드 또는 표로 보기" options={VIEW_OPTIONS} value={view} onChange={changeView} />
          </div>
          {view === "table" && shownStandings ? (
            <div className="mt-2">
              <StandingsTable season={shownStandings} />
              {odds && odds.seasonCode === shownStandings.seasonCode && (
                <PlayoffOddsBoard odds={odds.rows} teams={odds.teams} seasonCode={odds.seasonCode} remaining={odds.remaining} asOf={asOf} />
              )}
              <HeadToHeadMatrix season={shownStandings} />
            </div>
          ) : (
            <>
              <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{active.map(card)}</ul>
              {odds && <PlayoffOddsBoard odds={odds.rows} teams={odds.teams} seasonCode={odds.seasonCode} remaining={odds.remaining} asOf={asOf} />}
            </>
          )}
        </>
      ) : (
        <>
          <p className="mt-3 text-sub text-ink-2">구단이 팔리거나 사라져 지금은 없는 팀이에요. 기록은 그 시절 이름 그대로 남아 있어요.</p>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{memories.map(card)}</ul>
        </>
      )}
    </main>
  );
}
