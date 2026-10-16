"use client";
// 시즌 순위표 화면 (PLAN.md §2-1, §5-4): 부문 1~3위 "표지" 카드 + 전체 순위.
// 전체 순위는 RowList — 모바일(<1024px)은 행 카드(누르면 전 항목 펼침, 정렬은 "정렬 기준" 드롭다운), PC는 표(열 제목 정렬).
// 1차 컨트롤은 많이 보는 부문 칩 한 줄 + "다른 부문" 펼침(2026-10-06 — 묶음 단계 없앰, 표 머리글을 눌러도 부문이 바뀜), 나머지(경기당/합계·포지션·국적·팀·표본 기준)는 FilterSheet.
// 머리말·탭은 "기록" 메뉴 공용 RecordsHeader(시즌별 탭). 시즌 어워즈는 수상 탭으로 옮김(2026-10-06).
// 정렬·필터·순위·표기는 전부 lib/leaders.ts 순수 함수 — 이 파일은 상태와 배치만 맡는다.
// 포지션(전체/가드/포워드/센터)·국적(전체/국내/외국/아시아쿼터) 칩으로 집단을 좁히면 1~3위·순위도 그 집단 안 순위다
// (lib/leaders filterLeaders → rankMap). 성공률 시도 기준은 집단과 관계없이 리그 전체 값.
// 열 머리글의 ⓘ 는 용어 탭 해당 항목으로 (lib/glossary LEADER_COLUMN_GLOSSARY).
// 1~3위 표지 아래 "이 시즌 한 경기 최다" 카드 줄(SeasonHighStrip) — 시즌 파일에 seasonHighLeaders 가 있을 때만.
// 고른 부문이 득점·리바운드·어시스트·스틸·블록이면 대응 카드 강조 (lib/highs LEADER_CATEGORY_HIGH).
// 선택 상태는 주소 쿼리(?cat=&mode=&origin=&pos=&team=&q=)에 남긴다. useSearchParams 대신 window.location 을 읽어
// 정적 HTML에 기본 상태(경기당 득점)의 카드·표가 그대로 렌더링되게 한다 (CardExplorer 와 같은 방식).
import { seasonShortLabel } from "@/lib/career";
import { useEffect, useMemo, useState } from "react";
import type { CardTeam, LeaderPlayer } from "@/lib/types";
import { attemptsNote, attemptThresholds, qualifyLabel, qualifyPresetsFor } from "@/lib/metrics";
import {
  attemptName,
  availableCategories,
  categoryChipLabel,
  primaryCategories,
  secondaryCategoryGroups,
  columnOrder,
  DEFAULT_LEADERS_STATE,
  clearLeaderFilter,
  defaultSortDir,
  filterLeaders,
  formatMadeAttempts,
  formatStat,
  formatSummaryStat,
  isModeIndependent,
  isRankEligible,
  LEADER_STATS,
  LEADERS_PAGE_SIZE,
  leaderFilterChips,
  leadersCsv,
  leadersQueryString,
  madeAttempts,
  parseLeadersQuery,
  rankChanges,
  rankMap,
  RANK_CHANGE_KEYS,
  resetLeaderFilters,
  rowSummaryKeys,
  sortLeaders,
  withPrevious,
  statTitle,
  statValue,
  topLeaders,
  zoneThresholds,
  type LeaderEntry,
  type PrevLine,
  type RankChange,
  type LeaderStatKey,
  type LeaderThresholds,
  type LeadersState,
  type OriginFilter,
  type SortDir,
  type StatMode,
} from "@/lib/leaders";
import { teamShortLabel } from "@/lib/images";
import { gameDayLabel } from "@/lib/games";
import { LEADER_COLUMN_GLOSSARY } from "@/lib/glossary";
import { LEADER_CATEGORY_HIGH, type SeasonHighCard } from "@/lib/highs";
import {
  NATIONALITY_FILTERS,
  nationalityFilterLabel,
  nationalityOf,
  NATIONALITY_LABELS,
  POSITION_FILTERS,
  positionFilterLabel,
  positionLabel,
  type PositionFilter,
} from "@/lib/roster";
import Link from "next/link";
import { PlayerLink, TeamLink } from "./EntityLinks";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import ChipRow from "./ChipRow";
import FilterSheet, { FilterGroup } from "./FilterSheet";
import { IconArrowUp, IconChevronDown, IconChevronRight, IconChevronUp } from "./icons";
import InfoLink from "./InfoLink";
import PlayerAvatar from "./PlayerAvatar";
import RecordsHeader from "./RecordsHeader";
import RowList, { type RowColumn } from "./RowList";
import SeasonHighStrip from "./SeasonHighStrip";
import ScoringRace from "./ScoringRace";
import type { ScoringRaces } from "@/lib/data-race";
import Segmented from "./Segmented";
import TeamLogo from "./TeamLogo";
import { trackEvent, trackFilters } from "./track";

interface Props {
  seasonCode: number;
  seasonLabel: string;
  players: LeaderPlayer[];
  teams: CardTeam[];
  /** 이 시즌 한 경기 최다 카드 (서버에서 계산). 빈 배열이면 섹션을 숨긴다 */
  seasonHighs?: SeasonHighCard[];
  /** 진행 중 시즌이면 기본 표본 기준이 "팀 경기 절반 이상" (lib/metrics qualifyPresetsFor, 2026-10-14) */
  ongoing?: boolean;
  /** 진행 중 시즌의 기준 한 줄 ("10월 7일 경기까지 반영") — 마감 시즌은 null */
  asOf?: string | null;
  /** 순위 변동 재료 — 그 전 경기일까지 합계 (lib/data loadLeaderPrevious, 진행 중 시즌만) */
  previous?: { date: string; lines: Record<string, PrevLine> } | null;
  /** 득점왕 레이스 재료 (lib/data-race, 박스스코어가 있는 시즌만 — 없으면 섹션을 숨긴다) */
  race?: ScoringRaces | null;
}

/** 순위 옆 작은 변동 표시 (▲2 · ▼1 · 새로) */
function RankDelta({ change }: { change?: RankChange }) {
  if (!change) return null;
  if (change.kind === "new")
    return (
      <span className={`whitespace-nowrap text-caption font-bold text-[var(--div-hot)]`} aria-label="새로 10위 안에 들어옴">
        새로
      </span>
    );
  const up = change.kind === "up";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap text-caption font-bold ${up ? "text-[var(--div-hot)]" : "text-[var(--div-cold)]"}`}
      aria-label={`${change.delta}계단 ${up ? "오름" : "내림"}`}
    >
      <IconArrowUp size={16} className={`h-3 w-3 ${up ? "" : "rotate-180"}`} aria-hidden />
      {change.delta}
    </span>
  );
}

const MODE_OPTIONS: { value: StatMode; label: string }[] = [
  { value: "perGame", label: "경기당" },
  { value: "per30", label: "30분당" },
  { value: "total", label: "시즌 합계" },
];
const ORIGIN_OPTIONS: { value: OriginFilter; label: string }[] = NATIONALITY_FILTERS.map((f) => ({ value: f, label: nationalityFilterLabel(f) }));
const POSITION_OPTIONS: { value: PositionFilter; label: string }[] = POSITION_FILTERS.map((f) => ({ value: f, label: positionFilterLabel(f) }));

/** 이름 옆 작은 포지션 배지 (G·F·C·GF·FC). 모르면 그리지 않는다 */
function PosBadge({ p }: { p: LeaderPlayer }) {
  if (!p.position) return null;
  return (
    <span
      className="shrink-0 rounded border border-line px-1 text-caption font-semibold leading-[1.35] text-ink-2"
      title={positionLabel(p.position) ?? undefined}
      aria-label={positionLabel(p.position) ?? undefined}
    >
      {p.position}
    </span>
  );
}

/** 1~3위 한 줄 (2026-10-16 디자인 정리 M1 — 사용자 결정): 팀 색 큰 상자·배경 큰 순위 숫자 대신 흰 목록 하나.
 * 1위 줄만 크게. 폰은 세로 목록, PC(lg+)는 세 칸 나란히(1위 칸이 넓다) — 큰 세로 사진은 1위 lg·2·3위 xl 부터 칸 오른쪽 아래. */
function CoverItem({
  entry,
  team,
  category,
  mode,
  hero,
  change,
  seasonCode,
}: {
  change?: RankChange;
  seasonCode: number;
  entry: LeaderEntry<LeaderPlayer>;
  team?: CardTeam;
  category: LeaderStatKey;
  mode: StatMode;
  hero: boolean;
}) {
  const p = entry.player;
  const color = team?.color ?? FALLBACK_TEAM_COLOR;
  const teamLabel = teamShortLabel(team?.shortName ?? p.teamShort);
  const showPortrait = hero ? "hidden lg:block" : "hidden xl:block";
  const hideCircle = hero ? "lg:hidden" : "xl:hidden";
  const pos = positionLabel(p.position);
  return (
    <li
      className={`tabular flex min-w-0 items-center gap-3 lg:items-end ${hero ? "px-4 py-4 sm:px-5 lg:pb-0 lg:pl-6 lg:pt-5" : "px-4 py-3 lg:pb-0 lg:pt-4 xl:pl-5"}`}
      aria-label={`${entry.rank}위 ${p.nameKo} ${teamLabel} ${statTitle(category, mode)} ${formatStat(entry.value, category, mode)}`}
    >
      {/* 사진도 선수 페이지로 (2026-10-14) — 이름 링크와 같은 곳이라 키보드 순서에서는 뺀다 */}
      {/* deslop-ignore-next-line 19 */}
      <PlayerLink id={p.id} season={seasonCode} tabIndex={-1} aria-label={`${p.nameKo} 선수 페이지`} className={`${hideCircle} shrink-0 rounded-full`}>
        <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={color} size={hero ? 64 : 44} />
      </PlayerLink>
      <div className={`min-w-0 flex-1 ${hero ? "lg:pb-5" : "lg:pb-4"}`}>
        <p className="flex items-center gap-1.5 text-caption font-semibold text-ink-2 lg:text-sub">
          {entry.rank}위 <RankDelta change={change} />
        </p>
        {/* deslop-ignore-next-line 11 */}
        <h3 className={`truncate font-bold leading-tight text-ink ${hero ? "text-xl lg:text-4xl" : "text-body lg:text-xl xl:text-2xl"}`} title={p.nameKo}>
          <Link href={`/player/${p.id}?season=${seasonCode}`} className="focus-ring rounded-control underline-offset-4 hover:underline">
            {p.nameKo}
          </Link>
        </h3>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-ink-2 lg:mt-1 lg:text-sub">
          <TeamLink code={p.teamCode} season={seasonCode} place="leaders_cover" className="flex min-w-0 items-center gap-1.5">
            <TeamLogo logoUrl={team?.logoUrl} shortName={team?.shortName ?? p.teamShort} color={team?.color} size={16} />
            <span className="truncate">{teamLabel}</span>
          </TeamLink>
          {pos && <span className="shrink-0">· {pos}</span>}
          {hero && <span className="hidden shrink-0 sm:inline">· {NATIONALITY_LABELS[nationalityOf(p)]}</span>}
        </p>
        {/* PC: 숫자는 이름 아래 (칸 안 세로 배치) */}
        {/* deslop-ignore-next-line 11 */}
        <p className={`mt-3 hidden font-bold leading-none tracking-tight text-ink lg:block ${hero ? "text-6xl" : "text-4xl"}`}>
          {formatStat(entry.value, category, mode)}
        </p>
      </div>
      {/* 폰: 숫자는 오른쪽 끝 */}
      {/* deslop-ignore-next-line 11 */}
      <p className={`shrink-0 font-bold leading-none tracking-tight text-ink lg:hidden ${hero ? "text-4xl" : "text-2xl"}`}>
        {formatStat(entry.value, category, mode)}
      </p>
      <PlayerLink id={p.id} season={seasonCode} tabIndex={-1} aria-label={`${p.nameKo} 선수 페이지`} className={`${showPortrait} shrink-0 self-end rounded-none`}>
        <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={color} variant="portrait" size={hero ? 210 : 150} />
      </PlayerLink>
    </li>
  );
}

export default function LeadersView({ seasonCode, seasonLabel, players, teams, seasonHighs = [], ongoing = false, asOf = null, previous = null, race = null }: Props) {
  const presets = useMemo(() => qualifyPresetsFor(ongoing, players), [ongoing, players]);
  const [state, setState] = useState<LeadersState>(DEFAULT_LEADERS_STATE);
  // 표 정렬 (null 이면 선택한 부문의 "상위" 방향 — 턴오버는 적은 순)
  const [sort, setSort] = useState<{ key: LeaderStatKey; dir: SortDir } | null>(null);
  const teamByCode = useMemo(() => new Map(teams.map((t) => [t.teamCode, t])), [teams]);
  const teamCodes = useMemo(() => teams.map((t) => t.teamCode), [teams]);

  // 공유 링크로 들어온 상태 반영 (이 시즌에 없는 팀·부문은 기본값)
  useEffect(() => {
    setState(parseLeadersQuery(window.location.search, { teamCodes, presetCount: presets.length }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 선택 상태를 주소에 남긴다 (재렌더링 없이)
  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${leadersQueryString(state)}`);
  }, [state]);

  const update = (patch: Partial<LeadersState>) => {
    trackFilters("leaders", patch);
    setState((s) => ({ ...s, ...patch }));
  };
  const { mode, origin, position, teamCode, presetIdx } = state;
  // 이 시즌에 기록이 있는 부문만 칩으로 (허슬은 2025-26, 슛 구역은 슛 차트 있는 시즌). 공유 링크의 부문이 없으면 기본 부문
  const categories = useMemo(() => availableCategories(players), [players]);
  const category = categories.includes(state.category) ? state.category : DEFAULT_LEADERS_STATE.category;
  const primary = useMemo(() => primaryCategories(categories), [categories]);
  const moreGroups = useMemo(() => secondaryCategoryGroups(categories), [categories]);
  const inPrimary = primary.includes(category);
  // "다른 부문" 펼침: 지금 부문이 칩 한 줄에 없으면 처음부터 펼쳐 둔다
  const [moreOpen, setMoreOpen] = useState(false);
  const rule = presets[presetIdx] ?? presets[0];
  const columns = columnOrder(category);
  const sortKey = sort?.key ?? category;
  const sortDir = sort?.dir ?? defaultSortDir(category);

  // 성공률 시도 기준: 이 시즌 표본 충족 선수(포지션·국적·팀 필터 전 리그 전체)의 경기당 시도 평균 — 플레이어 카드와 같은 함수
  const thresholds = useMemo<LeaderThresholds>(
    () => ({ ...attemptThresholds(players, rule), zones: zoneThresholds(players, rule) }),
    [players, rule],
  );

  const filtered = useMemo(
    () => filterLeaders(players, { origin, position, teamCode, rule }),
    [players, origin, position, teamCode, rule],
  );
  const top = useMemo(
    () => topLeaders(filtered, category, mode, 3, thresholds),
    [filtered, category, mode, thresholds],
  );
  const rows = useMemo(
    () => sortLeaders(filtered, sortKey, sortDir, mode, thresholds),
    [filtered, sortKey, sortDir, mode, thresholds],
  );
  const ranks = useMemo(() => rankMap(filtered, sortKey, mode, thresholds), [filtered, sortKey, mode, thresholds]);
  // 순위 변동: 그 전 경기일까지 합계로 같은 필터·같은 단위 순위를 다시 매겨 비교 (누적 부문만, lib/leaders rankChanges)
  const prevFiltered = useMemo(
    () => (previous ? filterLeaders(withPrevious(players, previous.lines), { origin, position, teamCode, rule }) : null),
    [previous, players, origin, position, teamCode, rule],
  );
  const changesFor = (key: LeaderStatKey, cur: Map<string, number>) =>
    prevFiltered && RANK_CHANGE_KEYS.includes(key) ? rankChanges(cur, rankMap(prevFiltered, key, mode, thresholds)) : null;
  const tableChanges = useMemo(
    () => (sortDir === defaultSortDir(sortKey) ? changesFor(sortKey, ranks) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prevFiltered, sortKey, sortDir, ranks, mode, thresholds],
  );
  const coverChanges = useMemo(
    () => changesFor(category, rankMap(filtered, category, mode, thresholds)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prevFiltered, category, filtered, mode, thresholds],
  );
  const note = attemptsNote(thresholds);
  const teamName = (code: string) => teamShortLabel(teamByCode.get(code)?.shortName ?? code);

  /** 지금 순위표를 CSV 로 (lib/leaders leadersCsv — 엑셀에서 바로 열린다) */
  function downloadCsv() {
    trackEvent("csv_download", { season: seasonShortLabel(seasonLabel), category: sortKey, mode });
    const csv = leadersCsv(rows, columns, mode, ranks, (p) => teamName(p.teamCode));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kbl-${seasonLabel}-${LEADER_STATS[sortKey].label}-${mode}.csv`.replace(/\s+/g, "");
    document.body.appendChild(a);
    a.click();
    a.remove();
    // 바로 지우면 일부 브라우저가 파일 이름을 잃는다 — 다운로드가 시작된 뒤에 정리
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function chooseCategory(key: LeaderStatKey) {
    update({ category: key });
    setSort(null);
  }

  function clickHeader(key: LeaderStatKey) {
    // 부문으로 고를 수 있는 열이면 위 1~3위 카드도 그 기록으로 (2026-10-06 사용자: 고르는 길을 하나로)
    if (key !== category && categories.includes(key)) {
      chooseCategory(key);
      return;
    }
    setSort(key === sortKey ? { key, dir: sortDir === "desc" ? "asc" : "desc" } : { key, dir: defaultSortDir(key) });
  }

  const selectedTeam = teamCode ? teamByCode.get(teamCode) : undefined;
  const chips = leaderFilterChips(state, teamName, presets).map((c) => ({
    key: c.field,
    label: c.label,
    onClear: () => setState((s) => clearLeaderFilter(s, c.field)),
  }));
  const summaryKeys = rowSummaryKeys(sortKey);
  const sortedLabel = `${statTitle(sortKey, mode)} ${sortDir === defaultSortDir(sortKey) ? "상위 순" : "하위 순"}`;

  // 표 열: 순위 · 선수 · 지표들 (PC 표)
  const tableColumns: RowColumn<LeaderPlayer>[] = [
    {
      key: "rank",
      header: "순위",
      align: "center",
      headerClassName: "w-10",
      className: (p) => {
        const r = ranks.get(p.id);
        return r !== undefined && r <= 3 ? "font-bold text-ink" : "";
      },
      cell: (p) => (
        <span className="inline-flex flex-col items-center leading-tight">
          {ranks.get(p.id) ?? "–"}
          <RankDelta change={tableChanges?.get(p.id)} />
        </span>
      ),
    },
    {
      key: "player",
      header: "선수",
      align: "left",
      rowHeader: true,
      headerClassName: "w-36 xl:w-48",
      className: "font-normal",
      cell: (p) => {
        const team = teamByCode.get(p.teamCode);
        return (
          // 사진·이름은 선수 페이지, 팀 줄은 팀 페이지 (2026-10-14) — 누르는 영역 40px 이상 (디자인 점검 C1)
          <span className="flex min-h-10 min-w-0 items-center gap-2">
            {/* deslop-ignore-next-line 19 */}
            <Link href={`/player/${p.id}?season=${seasonCode}`} tabIndex={-1} aria-hidden className="shrink-0 rounded-full">
              <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={team?.color} size={28} />
            </Link>
            <span className="min-w-0">
              <Link
                href={`/player/${p.id}?season=${seasonCode}`}
                className="focus-ring block max-w-24 truncate rounded-md font-semibold leading-tight text-ink underline-offset-2 hover:underline xl:max-w-36"
                title={`${p.nameKo} 선수 페이지`}
              >
                {p.nameKo}
              </Link>
              <span className="flex min-w-0 items-center gap-1 text-caption text-ink-3">
                <TeamLink code={p.teamCode} season={seasonCode} place="leaders_table" className="flex min-w-0 items-center gap-1">
                  <TeamLogo logoUrl={team?.logoUrl} shortName={team?.shortName ?? p.teamShort} color={team?.color} size={16} />
                  <span className="max-w-16 truncate">{teamShortLabel(team?.shortName ?? p.teamShort)}</span>
                </TeamLink>
                <PosBadge p={p} />
              </span>
            </span>
          </span>
        );
      },
    },
    ...columns.map((key): RowColumn<LeaderPlayer> => {
      const active = key === sortKey;
      // 성공률 세 열은 같은 "시도 기준" 풀이라 ⓘ 는 첫 열(야투%)에만 (표 아래 안내문에도 링크가 있다 — 열 폭 절약)
      const term = key === "tpPct" || key === "ftPct" ? undefined : LEADER_COLUMN_GLOSSARY[key];
      return {
        key,
        active,
        ariaSort: active ? (sortDir === "desc" ? "descending" : "ascending") : "none",
        headerClassName: "p-0",
        header: (
          <span className="flex items-center justify-end">
            {term && <InfoLink term={term} compact />}
            <button
              type="button"
              onClick={() => clickHeader(key)}
              title={`${statTitle(key, mode)}${key === "minutes" ? "(분)" : ""}로 정렬`}
              className="focus-ring flex h-10 cursor-pointer items-center justify-end gap-0.5 whitespace-nowrap rounded-control px-0.5 font-semibold transition-colors duration-200 hover:text-ink"
            >
              {LEADER_STATS[key].th ?? LEADER_STATS[key].short}
              {/* 정렬 방향 표시는 지금 정렬 중인 열에만 (빈 자리를 두지 않아 17개 열이 992px 안에 들어간다) */}
              {active && (sortDir === "desc" ? <IconChevronDown size={16} className="-mx-0.5" /> : <IconChevronUp size={16} className="-mx-0.5" />)}
            </button>
          </span>
        ),
        className: (p) => `whitespace-nowrap ${active && !isRankEligible(p, sortKey, thresholds) ? "opacity-60" : ""}`,
        cell: (p) => {
          const ma = madeAttempts(p, key);
          return (
            <>
              <span className="block leading-tight">{formatStat(statValue(p, key, mode), key, mode)}</span>
              {ma && <span className="block text-caption font-normal leading-tight text-ink-3">{formatMadeAttempts(ma)}</span>}
            </>
          );
        },
      };
    }),
  ];

  return (
    <main className="mx-auto max-w-page px-4 pt-5">
      <RecordsHeader tab="leaders" leadersSeason={seasonCode} scope={`${seasonShortLabel(seasonLabel)} KBL 정규시즌`} asOf={asOf} />

      {/* 1차 컨트롤: 많이 보는 부문 칩 한 줄 + "다른 부문" (슈팅·슛 구역·고급·허슬은 펼쳐서). 표 머리글을 눌러도 부문이 바뀐다 */}
      <div className="flex flex-wrap items-center gap-2">
        <ChipRow
          label="부문 선택"
          chips={[
            ...primary.map((key) => ({ value: key, label: categoryChipLabel(key) })),
            // 다른 부문을 골랐으면 그 부문을 칩 한 줄 끝에 보여 준다 (지금 무엇을 보는지)
            ...(inPrimary ? [] : [{ value: category, label: LEADER_STATS[category].label }]),
          ]}
          value={category}
          onChange={chooseCategory}
        />
        {moreGroups.length > 0 && (
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="leaders-more"
            onClick={() => {
              trackFilters("leaders", { more_categories: moreOpen ? "close" : "open" });
              setMoreOpen((v) => !v);
            }}
            className="focus-ring inline-flex h-10 shrink-0 cursor-pointer items-center gap-1 rounded-control border border-line bg-surface px-3 text-body font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2"
          >
            다른 부문
            {moreOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </button>
        )}
      </div>
      {moreOpen && (
        <div id="leaders-more" className="surface-card mt-2 grid gap-3 rounded-container p-3 sm:grid-cols-2 xl:grid-cols-4">
          {moreGroups.map((g) => (
            <div key={g.key} className="min-w-0">
              <p className="text-sub font-semibold text-ink-3">{g.label}</p>
              <ChipRow
                label={`${g.label} 부문`}
                className="mt-1"
                chips={g.categories.map((key) => ({ value: key, label: categoryChipLabel(key) }))}
                value={category}
                onChange={(k) => {
                  chooseCategory(k);
                  setMoreOpen(false);
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* 나머지 필터: 버튼 → 시트(모바일) / 패널(PC). 적용 중인 것은 요약 칩 */}
      <section aria-label="필터" className="mt-3">
        <FilterSheet
          chips={chips}
          onReset={() => setState((s) => resetLeaderFilters(s))}
          resultText={`${filtered.length}명 보기`}
          trailing={`${filtered.length}명`}
        >
          <FilterGroup label="기록 단위" hint={isModeIndependent(category) ? "지금 부문은 비율 지표라 단위와 관계없습니다" : undefined}>
            <Segmented label="경기당, 30분당 또는 시즌 합계" options={MODE_OPTIONS} value={mode} onChange={(v) => update({ mode: v })} />
          </FilterGroup>
          <FilterGroup label="포지션" hint="GF는 가드, FC는 포워드로 묶습니다">
            <Segmented label="포지션" options={POSITION_OPTIONS} value={position} onChange={(v) => update({ position: v })} />
          </FilterGroup>
          <FilterGroup label="국적">
            <Segmented label="국적" options={ORIGIN_OPTIONS} value={origin} onChange={(v) => update({ origin: v })} />
          </FilterGroup>
          <FilterGroup label="팀">
            <span className="relative flex max-w-xs items-center">
              {selectedTeam && (
                <span className="pointer-events-none absolute left-2">
                  <TeamLogo logoUrl={selectedTeam.logoUrl} shortName={selectedTeam.shortName} color={selectedTeam.color} size={20} />
                </span>
              )}
              <select
                aria-label="팀"
                className={`focus-ring h-11 w-full min-w-0 cursor-pointer rounded-control border border-line bg-surface pr-2 text-base text-ink ${
                  selectedTeam ? "pl-9" : "pl-2"
                }`}
                value={teamCode ?? ""}
                onChange={(e) => update({ teamCode: e.target.value || null })}
              >
                <option value="">전체 팀</option>
                {teams.map((t) => (
                  <option key={t.teamCode} value={t.teamCode}>
                    {teamShortLabel(t.shortName)}
                  </option>
                ))}
              </select>
            </span>
          </FilterGroup>
          <FilterGroup label="표본 기준 (고급)" hint={<>이 기준을 넘긴 선수만 순위에 넣습니다 <InfoLink term="qualify" /></>}>
            <select
              aria-label="표본 기준"
              className="focus-ring h-11 w-full min-w-0 max-w-xs cursor-pointer rounded-control border border-line bg-surface px-2 text-base text-ink"
              value={presetIdx}
              onChange={(e) => update({ presetIdx: Number(e.target.value) })}
            >
              {presets.map((r, i) => (
                <option key={i} value={i}>
                  {qualifyLabel(r)}
                </option>
              ))}
            </select>
          </FilterGroup>
        </FilterSheet>
        {(position !== "all" || origin !== "all" || LEADER_STATS[category].better === "low" || attemptName(category)) && (
          <p className="mt-2 text-sub text-ink-3">
            {[
              (position !== "all" || origin !== "all") && "순위는 고른 집단 안 순위",
              LEADER_STATS[category].better === "low" && "적을수록 상위",
              attemptName(category) &&
                (LEADER_STATS[category].kind === "zone"
                  ? `${attemptName(category)} 경기당 시도 리그 평균(${(thresholds.zones?.[LEADER_STATS[category].zone!] ?? 0).toFixed(1)}) 이상만 순위 · 슛 차트 좌표로 센 값`
                  : `경기당 시도 리그 평균(${note}) 이상만 순위`),
              mode === "per30" && LEADER_STATS[category].kind === "count" && "30분당 = 시즌 누적 ÷ 출전 분 × 30 (3쿼터를 뛰었다면)",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </section>

      {/* 선택 부문 1~3위 */}
      <section aria-label={`${statTitle(category, mode)} 1~3위`} className="mt-4">
        {top.length > 0 ? (
          <>
            <p className="text-sub text-ink-2">
              {statTitle(category, mode)}
              {LEADER_STATS[category].better === "low" && " · 적을수록 상위"}
            </p>
            <ol className="surface-card mt-2 grid divide-y divide-line overflow-hidden rounded-container lg:grid-cols-[1.4fr_1fr_1fr] lg:divide-x lg:divide-y-0">
              {top.map((e, i) => (
                <CoverItem
                  key={e.player.id}
                  entry={e}
                  team={teamByCode.get(e.player.teamCode)}
                  category={category}
                  mode={mode}
                  hero={i === 0}
                  change={coverChanges?.get(e.player.id)}
                  seasonCode={seasonCode}
                />
              ))}
            </ol>
          </>
        ) : (
          <div className="surface-card rounded-container px-4 py-8 text-center">
            <p className="text-body font-semibold text-ink">조건에 맞는 선수가 없습니다</p>
            <p className="mt-1 text-sub text-ink-2">필터를 줄이거나 표본 기준을 낮춰 보세요.</p>
            <button
              type="button"
              onClick={() => {
                trackEvent("filter_reset", { screen: "leaders" });
                setState((s) => resetLeaderFilters(s));
              }}
              className="focus-ring mt-4 h-11 rounded-control border border-line bg-surface px-4 text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
            >
              필터 초기화
            </button>
          </div>
        )}
      </section>

      {/* 레이스: 고른 부문(레이스 부문이 아니면 득점) 상위 5명의 경기당 평균 흐름 (박스스코어 있는 시즌만) */}
      {race && <ScoringRace data={race} category={category} teams={teamByCode} seasonCode={seasonCode} ongoing={ongoing} />}

      {/* 이 시즌 한 경기 최다 (데이터 있는 시즌만) */}
      {seasonHighs.length > 0 && (
        <SeasonHighStrip cards={seasonHighs} teamByCode={teamByCode} activeKey={LEADER_CATEGORY_HIGH[category] ?? null} seasonCode={seasonCode} />
      )}

      {/* 전체 순위: 모바일 행 카드 / PC 표 */}
      {rows.length > 0 && (
        <section aria-labelledby="all-ranks" className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 id="all-ranks" className="flex items-center gap-2 text-h2 font-bold">
              전체 순위
              <button
                type="button"
                onClick={downloadCsv}
                className="focus-ring inline-flex h-10 items-center rounded-control border border-line bg-surface px-3 text-sub font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
                title="지금 보이는 리더보드(필터·정렬·단위 그대로)를 CSV 파일로 받기"
              >
                CSV 내려받기
              </button>
            </h2>
            {/* 모바일 정렬: 드롭다운 하나 (PC 는 열 제목을 누른다) */}
            <label className="flex items-center gap-2 text-sub font-medium text-ink-2 lg:hidden">
              정렬 기준
              <select
                className="focus-ring h-10 cursor-pointer rounded-control border border-line bg-surface px-2 text-base text-ink"
                value={`${sortKey}:${sortDir}`}
                onChange={(e) => {
                  const [k, d] = e.target.value.split(":") as [LeaderStatKey, SortDir];
                  setSort({ key: k, dir: d });
                }}
              >
                {columns.map((key) => (
                  <option key={key} value={`${key}:${defaultSortDir(key)}`}>
                    {LEADER_STATS[key].label}
                  </option>
                ))}
                {sortDir !== defaultSortDir(sortKey) && (
                  <option value={`${sortKey}:${sortDir}`}>{LEADER_STATS[sortKey].label} (역순)</option>
                )}
              </select>
            </label>
          </div>
          <RowList
            rows={rows}
            rowKey={(p) => p.id}
            caption={`${seasonShortLabel(seasonLabel)} ${sortedLabel}`}
            columns={tableColumns}
            pageSize={LEADERS_PAGE_SIZE}
            resetKey={`${leadersQueryString(state)}|${sortKey}|${sortDir}`}
            emphasize={(p) => (ranks.get(p.id) ?? 99) <= 3}
            dense
            rowLabel={(p) => `${ranks.get(p.id) ?? "순위 없음"}${ranks.has(p.id) ? "위" : ""} ${p.nameKo}, ${statTitle(sortKey, mode)} ${formatStat(statValue(p, sortKey, mode), sortKey, mode)}, 자세히`}
            summary={(p) => {
              const team = teamByCode.get(p.teamCode);
              const rank = ranks.get(p.id);
              const ma = madeAttempts(p, sortKey);
              const eligible = isRankEligible(p, sortKey, thresholds);
              return (
                <>
                  <span
                    className={`tabular flex w-7 shrink-0 flex-col items-center text-center text-body leading-tight ${rank !== undefined && rank <= 3 ? "font-black text-ink" : "font-semibold text-ink-3"}`}
                  >
                    {rank ?? "–"}
                    <RankDelta change={tableChanges?.get(p.id)} />
                  </span>
                  <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={team?.color} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-body font-semibold leading-tight text-ink">{p.nameKo}</span>
                      <PosBadge p={p} />
                    </span>
                    <span className="tabular mt-0.5 flex min-w-0 items-center gap-1 text-sub text-ink-3">
                      <TeamLogo logoUrl={team?.logoUrl} shortName={team?.shortName ?? p.teamShort} color={team?.color} size={16} />
                      <span className="truncate">
                        {teamShortLabel(team?.shortName ?? p.teamShort)} · {summaryKeys.slice(0, 2).map((k) => formatSummaryStat(p, k, mode)).join(" · ")}
                        <span className="hidden sm:inline"> · {formatSummaryStat(p, summaryKeys[2], mode)}</span>
                      </span>
                    </span>
                  </span>
                  <span className={`shrink-0 text-right ${eligible ? "" : "opacity-60"}`}>
                    <span className="tabular block text-lg font-bold leading-tight tracking-tight text-ink">
                      {formatStat(statValue(p, sortKey, mode), sortKey, mode)}
                    </span>
                    <span className="tabular block text-caption leading-tight text-ink-3">
                      {ma ? formatMadeAttempts(ma) : LEADER_STATS[sortKey].short}
                    </span>
                  </span>
                </>
              );
            }}
            details={(p) =>
              columns.map((key) => {
                const ma = madeAttempts(p, key);
                return {
                  key,
                  label: LEADER_STATS[key].short,
                  strong: key === sortKey,
                  value: (
                    <>
                      {formatStat(statValue(p, key, mode), key, mode)}
                      {ma && <span className="ml-1 text-caption font-normal text-ink-3">{formatMadeAttempts(ma)}</span>}
                    </>
                  ),
                };
              })
            }
            detailFooter={(p) => (
              <span className="flex flex-wrap gap-x-4">
                <Link href={`/player/${p.id}?season=${seasonCode}`} className="focus-ring link-shortcut px-1 text-body">
                  {p.nameKo} 선수 페이지 <IconChevronRight size={16} />
                </Link>
                {p.teamCode && (
                  <TeamLink code={p.teamCode} season={seasonCode} place="leaders_row" className="link-shortcut px-1 text-body">
                    {teamShortLabel(teamByCode.get(p.teamCode)?.shortName ?? p.teamShort)} 팀 페이지 <IconChevronRight size={16} />
                  </TeamLink>
                )}
              </span>
            )}
          />
          {previous && (tableChanges || coverChanges) && (
            <p className="mt-2 text-sub leading-relaxed text-ink-3">
              순위 옆 화살표는 {gameDayLabel(previous.date)} 경기까지 순위와 비교한 거예요. "새로"는 처음 10위 안에 든 선수.
            </p>
          )}
          <p className="mt-2 text-sub leading-relaxed text-ink-3">
            성공률 아래 작은 숫자는 시즌 합계 성공/시도. 경기당 시도가 리그 평균({note})보다 적으면 순위 칸에 - 표시
            {" "}<InfoLink term="attempts" />
          </p>
        </section>
      )}
    </main>
  );
}
