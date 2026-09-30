"use client";
// 선수 탭 (/players): 큰 검색창 → 필터 버튼(포지션·국적·팀, FilterSheet) → 그 시즌 선수 그리드(작은 카드, 20장씩 "더 보기").
// 시즌은 상단 SiteNav 시즌 선택만(본문 시즌 칩 없음), 상단 검색은 숨긴다 — 디자인 점검 A2~A5.
// - 정적 HTML은 최신 시즌으로 그린다(서버가 넣어 준 시즌 카드 파일 initialFile).
// - 다른 시즌을 고르면 우리 정적 파일 /cards/{코드}.json 을 받아 같은 계산으로 다시 그린다 (useSeasonCards —
//   KBL 서버가 아니라 우리 public/ 파일이므로 원칙 1 위반 아님).
// - 종합 등급·정렬·필터는 lib/cardview(buildGridEntries·sortGridEntries·filterGridEntries) — 여기서는 계산하지 않는다.
// - 상태는 주소 ?season=&pos=&origin=&team= 에 남긴다. 시즌은 상단 SiteNav 의 시즌 선택이 onSeasonChange 로 바꾼다.
// - 카드에 칭호 배지 1개(통산 기준 우선순위 1번, 서버가 넘긴 topBadges — lib/badges).
// - 카드를 누르면 그 선수 상세의 그 시즌 카드로 (/player/번호?season=코드).
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SeasonCardsFile } from "@/lib/cards";
import type { CardTeam, SeasonOption } from "@/lib/types";
import {
  buildGridEntries,
  clearGridFilter,
  filterGridEntries,
  formatCardValue,
  GRID_PAGE_SIZE,
  gridFilterChips,
  parsePlayersQuery,
  playerHref,
  playersQueryString,
  sortGridEntries,
  type GridEntry,
  type PlayersState,
} from "@/lib/cardview";
import { seasonShortLabel } from "@/lib/career";
import { qualifyLabel, type Grade } from "@/lib/metrics";
import { teamShortLabel } from "@/lib/images";
import { takeFirst } from "@/lib/leaders";
import {
  NATIONALITY_FILTERS,
  nationalityFilterLabel,
  nationalityOf,
  NATIONALITY_LABELS,
  POSITION_FILTERS,
  positionFilterLabel,
  positionLabel,
} from "@/lib/roster";
import { BADGE_CHIP, badgeStyle } from "./BadgeRow";
import ChipRow from "./ChipRow";
import FilterSheet, { FilterGroup } from "./FilterSheet";
import { IconChevronDown } from "./icons";
import InfoLink from "./InfoLink";
import PlayerAvatar from "./PlayerAvatar";
import PlayerSearch from "./PlayerSearch";
import Skeleton from "./Skeleton";
import Segmented from "./Segmented";
import SiteNav from "./SiteNav";
import TeamLogo from "./TeamLogo";
import { primeSeasonCards, useSeasonCards } from "./useSeasonCards";
import { useThemeColors, type ThemeColors } from "./useThemeColors";
import { FALLBACK_TEAM_COLOR, gradeTone } from "@/lib/teams";

interface Props {
  /** 선수가 있는 시즌 (최신이 먼저) */
  seasons: SeasonOption[];
  latest: number;
  /** 최신 시즌 카드 파일 (public/cards 와 같은 내용) — 정적 HTML용 */
  initialFile: SeasonCardsFile;
  /** 선수 번호 → 우선순위 1번 칭호 배지 라벨 (배지 없는 선수는 없음). 통산 기준이라 어느 시즌 그리드든 같다 */
  topBadges: Record<string, string>;
}

/** 종합 등급 배지 — 플레이어 카드와 같은 색 규칙(lib/teams gradeTone: S 금색, A·B 팀 색, C 이하 무채색). 글자가 곧 등급 */
function GradeBadge({ grade, team, colors }: { grade: Grade | "-"; team?: CardTeam; colors: ThemeColors }) {
  if (grade === "-") {
    return <span className="rounded-control bg-surface-2 px-1.5 py-0.5 text-caption font-semibold text-ink-2">표본 미달</span>;
  }
  const tone = gradeTone(grade, team?.color ?? FALLBACK_TEAM_COLOR, colors);
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-control border-[1.5px] text-base font-black"
      style={{ background: tone.bg, color: tone.ink, borderColor: tone.border }}
      aria-label={`종합 등급 ${grade}`}
    >
      {grade}
    </span>
  );
}

function GridCard({ e, team, seasonCode, colors, badge }: { e: GridEntry; team?: CardTeam; seasonCode: number; colors: ThemeColors; badge?: string }) {
  const p = e.player;
  const pos = positionLabel(p.position);
  return (
    <Link
      href={playerHref(p.id, seasonCode)}
      className="focus-ring surface-card tabular flex h-full min-w-0 flex-col rounded-container p-3 transition-colors duration-200 hover:bg-surface-2"
      aria-label={`${p.nameKo}, ${team?.shortName ?? p.teamShort}${pos ? `, ${pos}` : ""}${badge ? `, 칭호 ${badge}` : ""}, 종합 등급 ${e.overall === "-" ? "표본 미달" : e.overall}, 경기당 ${formatCardValue(e.ppg, false)}점`}
    >
      <span className="flex items-start justify-between gap-2">
        <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={team?.color} size={52} />
        <GradeBadge grade={e.overall} team={team} colors={colors} />
      </span>
      <span className="mt-2 line-clamp-2 text-body font-bold leading-tight text-ink break-keep">{p.nameKo}</span>
      <span className="mt-1 flex min-w-0 items-center gap-1 text-caption text-ink-2">
        <TeamLogo logoUrl={team?.logoUrl} shortName={team?.shortName ?? p.teamShort} color={team?.color} size={16} />
        <span className="truncate">
          {teamShortLabel(team?.shortName ?? p.teamShort)}
          {pos ? ` · ${pos}` : ""}
        </span>
      </span>
      {badge && (
        <span className="mt-1.5">
          <span className={`${BADGE_CHIP} h-6 px-1.5 text-caption`} style={badgeStyle(team?.color.primary ?? FALLBACK_TEAM_COLOR.primary)}>
            {badge}
          </span>
        </span>
      )}
      <span className="mt-auto pt-2 text-caption text-ink-3">
        경기당 <b className="text-base font-bold tracking-tight text-ink">{formatCardValue(e.ppg, false)}</b>점
        {p.nationality && p.nationality !== "domestic" && <span className="ml-1">· {NATIONALITY_LABELS[nationalityOf(p)]}</span>}
      </span>
    </Link>
  );
}

export default function PlayersView({ seasons, latest, initialFile, topBadges }: Props) {
  const colors = useThemeColors();
  const initialCards = useMemo(() => primeSeasonCards(initialFile), [initialFile]);
  const [state, setState] = useState<PlayersState>({ season: latest, position: "all", origin: "all", teamCode: null });
  const [limit, setLimit] = useState(GRID_PAGE_SIZE);
  const seasonCodes = useMemo(() => seasons.map((s) => s.seasonCode), [seasons]);

  useEffect(() => {
    setState(parsePlayersQuery(window.location.search, { seasons: seasonCodes, latest }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${playersQueryString(state, latest)}`);
    // 시즌·필터가 바뀌면 처음 20장으로
    setLimit(GRID_PAGE_SIZE);
  }, [state, latest]);

  const { cards, status } = useSeasonCards(state.season, initialCards);
  const shownSeason = cards?.seasonCode ?? state.season;
  const teams = cards?.teams ?? [];
  const teamByCode = useMemo(() => new Map(teams.map((t) => [t.teamCode, t])), [teams]);
  // 이 시즌에 없는 팀이면 전체로 본다 (시즌을 바꿨을 때)
  const teamCode = state.teamCode && teamByCode.has(state.teamCode) ? state.teamCode : null;

  const all = useMemo(() => (cards ? sortGridEntries(buildGridEntries(cards)) : []), [cards]);
  const filtered = useMemo(
    () => filterGridEntries(all, { position: state.position, origin: state.origin, teamCode }),
    [all, state.position, state.origin, teamCode],
  );
  const { shown, remaining } = takeFirst(filtered, limit);
  const update = (patch: Partial<PlayersState>) => setState((s) => ({ ...s, ...patch }));
  // 불러오는 동안 제목은 고른 시즌으로 (그리드는 스켈레톤)
  const headSeason = status === "loading" ? state.season : shownSeason;
  const seasonLabel = seasons.find((s) => s.seasonCode === headSeason)?.seasonLabel ?? String(headSeason);
  const chips = gridFilterChips({ position: state.position, origin: state.origin, teamCode }, (c) =>
    teamShortLabel(teamByCode.get(c)?.shortName ?? c),
  ).map((c) => ({ key: c.field, label: c.label, onClear: () => setState((s) => clearGridFilter(s, c.field)) }));

  return (
    <>
      {/* 시즌은 상단 시즌 선택이 맡는다(본문 시즌 칩 없음), 검색은 본문 큰 검색창 하나 (디자인 점검 A4·A5) */}
      <SiteNav seasons={seasons} seasonCode={state.season} view="players" onSeasonChange={(c) => update({ season: c })} wide hideSearch />
      <main className="mx-auto max-w-5xl px-4 pt-5">
        <h1 className="mb-3 text-h1 font-bold">선수</h1>

        <PlayerSearch size="lg" autoFocusDesktop label="선수 이름으로 찾기" placeholder="선수 이름 (한글·영문, 예: 워니)" className="w-full" />

        <section aria-label="필터" className="mt-4">
          <FilterSheet
            chips={chips}
            onReset={() => update({ position: "all", origin: "all", teamCode: null })}
            resultText={`${filtered.length}명 보기`}
            trailing={`${filtered.length}명`}
          >
            <FilterGroup label="포지션" hint="GF는 가드, FC는 포워드로 묶습니다">
              <Segmented
                label="포지션"
                options={POSITION_FILTERS.map((f) => ({ value: f, label: positionFilterLabel(f) }))}
                value={state.position}
                onChange={(v) => update({ position: v })}
              />
            </FilterGroup>
            <FilterGroup label="국적">
              <Segmented
                label="국적"
                options={NATIONALITY_FILTERS.map((f) => ({ value: f, label: nationalityFilterLabel(f) }))}
                value={state.origin}
                onChange={(v) => update({ origin: v })}
              />
            </FilterGroup>
            <FilterGroup label="팀">
              <ChipRow
                label="팀"
                chips={[
                  { value: "", label: "전체" },
                  ...teams.map((t) => ({
                    value: t.teamCode,
                    label: (
                      <>
                        <TeamLogo logoUrl={t.logoUrl} shortName={t.shortName} color={t.color} size={20} />
                        {teamShortLabel(t.shortName)}
                      </>
                    ),
                    aria: t.shortName,
                  })),
                ]}
                value={teamCode ?? ""}
                onChange={(v) => update({ teamCode: v || null })}
              />
            </FilterGroup>
          </FilterSheet>
        </section>

        <section aria-labelledby="grid-title" className="mt-5" aria-busy={status === "loading" || undefined}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="grid-title" className="text-h2 font-bold">
              {seasonShortLabel(seasonLabel)} 시즌 선수 {status !== "loading" && <span className="font-normal text-ink-3">{filtered.length}명</span>}
            </h2>
            <p className="text-sub text-ink-3">
              종합 등급 순, 같은 등급은 PER 순 <InfoLink term="percentileGrade" />
            </p>
          </div>
          {status === "loading" && (
            <p role="status" className="sr-only">
              시즌 기록 불러오는 중
            </p>
          )}
          {status === "error" && (
            <p role="alert" className="mb-2 text-body text-ink-2">
              시즌 기록을 불러오지 못했습니다. 시즌을 다시 골라 주세요.
            </p>
          )}
          {status === "loading" ? (
            // 다른 시즌을 받는 동안: 그리드 모양 그대로 스켈레톤 (디자인 점검 C3)
            <ul aria-hidden className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: Math.min(GRID_PAGE_SIZE, Math.max(shown.length, 10)) }, (_, i) => (
                <li key={i} className="surface-card flex h-[168px] flex-col rounded-container p-3">
                  <span className="flex items-start justify-between">
                    {/* deslop-ignore-next-line 19 */}
                    <Skeleton className="h-[52px] w-[52px] rounded-full" />
                    <Skeleton className="h-7 w-7" />
                  </span>
                  <Skeleton className="mt-2 h-4 w-20" />
                  <Skeleton className="mt-1.5 h-3.5 w-24" />
                  <Skeleton className="mt-auto h-4 w-16" />
                </li>
              ))}
            </ul>
          ) : shown.length > 0 ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {shown.map((e) => (
                <li key={e.player.id} className="min-w-0">
                  <GridCard e={e} team={teamByCode.get(e.player.teamCode)} seasonCode={shownSeason} colors={colors} badge={topBadges[e.player.id]} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="surface-card rounded-container px-4 py-8 text-center">
              <p className="text-body font-semibold text-ink">조건에 맞는 선수가 없습니다</p>
              <p className="mt-1 text-sub text-ink-2">포지션·국적·팀 중 하나를 풀어 보세요.</p>
              <button
                type="button"
                onClick={() => update({ position: "all", origin: "all", teamCode: null })}
                className="focus-ring mt-4 h-11 rounded-control border border-line bg-surface px-4 text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
              >
                필터 초기화
              </button>
            </div>
          )}
          {remaining > 0 && status !== "loading" && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + GRID_PAGE_SIZE)}
              className="focus-ring mt-3 flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-control border border-line bg-surface text-body font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
            >
              더 보기 <span className="font-normal text-ink-3">(남은 {remaining}명)</span>
              <IconChevronDown size={16} />
            </button>
          )}
          <p className="mt-3 text-sub leading-relaxed text-ink-3">
            종합 등급은 그 시즌 {cards ? qualifyLabel(cards.defaults.rule) : "표본 기준"} 선수 중 같은 국적 집단(국내·외국·아시아쿼터) 안에서
            레이더 5축(공격·수비·3점·허슬·효율)을 종합한 위치입니다 <InfoLink term="radarAxes" />. 기준에 못 미친 선수는 맨 뒤에 둡니다.
          </p>
        </section>
      </main>
    </>
  );
}
