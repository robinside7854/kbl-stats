"use client";
// 시즌 순위표 화면 (PLAN.md §2-1, §5-4): 부문 1~3위 "표지" 카드 + 전체 순위.
// 전체 순위는 RowList — 모바일(<1024px)은 행 카드(누르면 전 항목 펼침, 정렬은 "정렬 기준" 드롭다운), PC는 표(열 제목 정렬).
// 1차 컨트롤은 부문 칩 한 줄, 나머지(경기당/합계·포지션·국적·팀·표본 기준)는 FilterSheet (디자인 점검 A1·A2·A3).
// 정렬·필터·순위·표기는 전부 lib/leaders.ts 순수 함수 — 이 파일은 상태와 배치만 맡는다.
// 포지션(전체/가드/포워드/센터)·국적(전체/국내/외국/아시아쿼터) 칩으로 집단을 좁히면 1~3위·순위도 그 집단 안 순위다
// (lib/leaders filterLeaders → rankMap). 성공률 시도 기준은 집단과 관계없이 리그 전체 값.
// 열 머리글의 ⓘ 는 용어 탭 해당 항목으로 (lib/glossary LEADER_COLUMN_GLOSSARY).
// 선택 상태는 주소 쿼리(?cat=&mode=&origin=&pos=&team=&q=)에 남긴다. useSearchParams 대신 window.location 을 읽어
// 정적 HTML에 기본 상태(경기당 득점)의 카드·표가 그대로 렌더링되게 한다 (CardExplorer 와 같은 방식).
import { useEffect, useMemo, useState } from "react";
import type { CardTeam, LeaderPlayer } from "@/lib/types";
import { attemptsNote, attemptThresholds, QUALIFY_PRESETS, qualifyLabel } from "@/lib/metrics";
import {
  attemptName,
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
  LEADER_CATEGORIES,
  LEADER_STATS,
  LEADERS_PAGE_SIZE,
  leaderFilterChips,
  leadersQueryString,
  madeAttempts,
  parseLeadersQuery,
  rankMap,
  resetLeaderFilters,
  rowSummaryKeys,
  sortLeaders,
  statTitle,
  statValue,
  topLeaders,
  type LeaderEntry,
  type LeaderStatKey,
  type LeadersState,
  type OriginFilter,
  type SortDir,
  type StatMode,
} from "@/lib/leaders";
import { teamShortLabel } from "@/lib/images";
import { LEADER_COLUMN_GLOSSARY } from "@/lib/glossary";
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
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import ChipRow from "./ChipRow";
import FilterSheet, { FilterGroup } from "./FilterSheet";
import { IconChevronDown, IconChevronRight, IconChevronUp } from "./icons";
import InfoLink from "./InfoLink";
import PlayerAvatar from "./PlayerAvatar";
import RowList, { type RowColumn } from "./RowList";
import Segmented from "./Segmented";
import TeamLogo from "./TeamLogo";

interface Props {
  seasonLabel: string;
  players: LeaderPlayer[];
  teams: CardTeam[];
}

const MODE_OPTIONS: { value: StatMode; label: string }[] = [
  { value: "perGame", label: "경기당" },
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

/** 팀 색 배경 위에 올리는 로고 — 로고 색이 배경과 겹치지 않게 흰 칩 위에 */
function LogoChip({ team, fallback, size }: { team?: CardTeam; fallback: string; size: number }) {
  return (
    <span className="inline-flex shrink-0 rounded-lg bg-white p-0.5">
      <TeamLogo logoUrl={team?.logoUrl} shortName={team?.shortName ?? fallback} color={team?.color} size={size} />
    </span>
  );
}

/** 1~3위 표지 카드. 1위는 크게(hero), 2·3위는 반 폭 */
function CoverCard({
  entry,
  team,
  category,
  mode,
  hero,
}: {
  entry: LeaderEntry<LeaderPlayer>;
  team?: CardTeam;
  category: LeaderStatKey;
  mode: StatMode;
  hero: boolean;
}) {
  const p = entry.player;
  const color = team?.color ?? FALLBACK_TEAM_COLOR;
  const teamLabel = teamShortLabel(team?.shortName ?? p.teamShort);
  const lowerIsBetter = LEADER_STATS[category].better === "low";
  return (
    <article
      className={`tabular relative overflow-hidden rounded-2xl ${hero ? "col-span-2 p-4 sm:p-5" : "p-3"}`}
      style={{ background: color.primary, color: color.text }}
      aria-label={`${entry.rank}위 ${p.nameKo} ${teamLabel} ${statTitle(category, mode)} ${formatStat(entry.value, category, mode)}`}
    >
      {/* 배경의 큰 순위 숫자 (장식) */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -bottom-4 right-1 select-none font-black leading-none opacity-15 ${
          hero ? "text-[9rem]" : "text-[5.5rem]"
        }`}
      >
        {entry.rank}
      </span>
      <div className={`relative flex items-center ${hero ? "gap-4" : "gap-2.5"}`}>
        <PlayerAvatar
          photoUrl={p.photoUrl}
          nameKo={p.nameKo}
          color={color}
          size={hero ? 88 : 48}
          className="ring-2 ring-white/70"
        />
        <div className="min-w-0">
          <p className={`font-semibold opacity-85 ${hero ? "text-sub" : "text-caption"}`}>{entry.rank}위</p>
          <h3 className={`font-bold leading-tight break-keep ${hero ? "truncate text-2xl" : "line-clamp-2 text-base"}`} title={p.nameKo}>
            <Link href={`/player/${p.id}`} className="focus-ring rounded-lg underline-offset-4 hover:underline">
              {p.nameKo}
            </Link>
          </h3>
          <p className={`mt-1 flex min-w-0 items-center gap-1.5 opacity-90 ${hero ? "text-body" : "text-caption"}`}>
            <LogoChip team={team} fallback={p.teamShort} size={hero ? 20 : 14} />
            <span className="truncate">{teamLabel}</span>
            {hero && (
              <span className="shrink-0">
                · {positionLabel(p.position) ? `${positionLabel(p.position)} · ` : ""}
                {NATIONALITY_LABELS[nationalityOf(p)]}
              </span>
            )}
            {!hero && p.position && <span className="shrink-0">· {p.position}</span>}
          </p>
        </div>
      </div>
      <p className={`relative ${hero ? "mt-4" : "mt-2.5"}`}>
        <span className={`block font-semibold opacity-85 ${hero ? "text-sub" : "text-caption"}`}>
          {statTitle(category, mode)}
          {lowerIsBetter && <span className="whitespace-nowrap"> · 적을수록 상위</span>}
        </span>
        <span className={`block font-bold leading-none tracking-tight ${hero ? "mt-1 text-5xl" : "mt-0.5 text-3xl"}`}>
          {formatStat(entry.value, category, mode)}
        </span>
      </p>
    </article>
  );
}

export default function LeadersView({ seasonLabel, players, teams }: Props) {
  const [state, setState] = useState<LeadersState>(DEFAULT_LEADERS_STATE);
  // 표 정렬 (null 이면 선택한 부문의 "상위" 방향 — 턴오버는 적은 순)
  const [sort, setSort] = useState<{ key: LeaderStatKey; dir: SortDir } | null>(null);
  const teamByCode = useMemo(() => new Map(teams.map((t) => [t.teamCode, t])), [teams]);
  const teamCodes = useMemo(() => teams.map((t) => t.teamCode), [teams]);

  // 공유 링크로 들어온 상태 반영 (이 시즌에 없는 팀·부문은 기본값)
  useEffect(() => {
    setState(parseLeadersQuery(window.location.search, { teamCodes }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 선택 상태를 주소에 남긴다 (재렌더링 없이)
  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${leadersQueryString(state)}`);
  }, [state]);

  const update = (patch: Partial<LeadersState>) => setState((s) => ({ ...s, ...patch }));
  const { category, mode, origin, position, teamCode, presetIdx } = state;
  const rule = QUALIFY_PRESETS[presetIdx];
  const columns = columnOrder(category);
  const sortKey = sort?.key ?? category;
  const sortDir = sort?.dir ?? defaultSortDir(category);

  // 성공률 시도 기준: 이 시즌 표본 충족 선수(포지션·국적·팀 필터 전 리그 전체)의 경기당 시도 평균 — 플레이어 카드와 같은 함수
  const thresholds = useMemo(() => attemptThresholds(players, rule), [players, rule]);

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
  const note = attemptsNote(thresholds);
  const teamName = (code: string) => teamShortLabel(teamByCode.get(code)?.shortName ?? code);

  function chooseCategory(key: LeaderStatKey) {
    update({ category: key });
    setSort(null);
  }

  function clickHeader(key: LeaderStatKey) {
    setSort(key === sortKey ? { key, dir: sortDir === "desc" ? "asc" : "desc" } : { key, dir: defaultSortDir(key) });
  }

  const selectedTeam = teamCode ? teamByCode.get(teamCode) : undefined;
  const chips = leaderFilterChips(state, teamName).map((c) => ({
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
      cell: (p) => ranks.get(p.id) ?? "–",
    },
    {
      key: "player",
      header: "선수",
      align: "left",
      rowHeader: true,
      headerClassName: "w-40",
      className: "font-normal",
      cell: (p) => {
        const team = teamByCode.get(p.teamCode);
        return (
          // 칸 전체(사진·이름·팀)가 선수 페이지 링크 — 누르는 영역 40px 이상 (디자인 점검 C1)
          <Link
            href={`/player/${p.id}`}
            className="focus-ring group flex min-h-10 min-w-0 items-center gap-2 rounded-lg"
            title={`${p.nameKo} 선수 페이지`}
          >
            <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={team?.color} size={28} />
            <span className="min-w-0">
              <span className="block max-w-32 truncate font-semibold leading-tight text-ink underline-offset-2 group-hover:underline">
                {p.nameKo}
              </span>
              <span className="flex min-w-0 items-center gap-1 text-caption text-ink-3">
                <TeamLogo logoUrl={team?.logoUrl} shortName={team?.shortName ?? p.teamShort} color={team?.color} size={16} />
                <span className="max-w-20 truncate">{teamShortLabel(team?.shortName ?? p.teamShort)}</span>
                <PosBadge p={p} />
              </span>
            </span>
          </Link>
        );
      },
    },
    ...columns.map((key): RowColumn<LeaderPlayer> => {
      const active = key === sortKey;
      const term = LEADER_COLUMN_GLOSSARY[key];
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
              title={`${statTitle(key, mode)}로 정렬`}
              className="focus-ring flex h-10 cursor-pointer items-center justify-end gap-0.5 whitespace-nowrap rounded-lg px-1 font-semibold transition-colors duration-200 hover:text-ink"
            >
              {LEADER_STATS[key].short}
              {/* 정렬 방향 표시는 지금 정렬 중인 열에만 (빈 자리를 두지 않아 14개 열이 992px 안에 들어간다) */}
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
    <main className="mx-auto max-w-5xl px-4 pt-5">
      <header className="mb-3">
        <p className="text-sub font-medium text-ink-3">{seasonLabel} KBL 정규시즌</p>
        <h1 className="mt-0.5 text-h1 font-bold">시즌 순위표</h1>
      </header>

      {/* 1차 컨트롤: 부문 칩 한 줄 (칩이 많으면 이 줄만 옆으로 민다) */}
      <ChipRow
        label="부문 선택"
        scroll
        chips={LEADER_CATEGORIES.map((key) => ({ value: key, label: LEADER_STATS[key].label }))}
        value={category}
        onChange={chooseCategory}
      />

      {/* 나머지 필터: 버튼 → 시트(모바일) / 패널(PC). 적용 중인 것은 요약 칩 */}
      <section aria-label="필터" className="mt-3">
        <FilterSheet
          chips={chips}
          onReset={() => setState((s) => resetLeaderFilters(s))}
          resultText={`${filtered.length}명 보기`}
          trailing={`${filtered.length}명`}
        >
          <FilterGroup label="기록 단위" hint={isModeIndependent(category) ? "지금 부문은 비율 지표라 단위와 관계없습니다" : undefined}>
            <Segmented label="경기당 또는 시즌 합계" options={MODE_OPTIONS} value={mode} onChange={(v) => update({ mode: v })} />
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
                className={`focus-ring h-11 w-full min-w-0 cursor-pointer rounded-lg border border-line bg-surface pr-2 text-base text-ink ${
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
              className="focus-ring h-11 w-full min-w-0 max-w-xs cursor-pointer rounded-lg border border-line bg-surface px-2 text-base text-ink"
              value={presetIdx}
              onChange={(e) => update({ presetIdx: Number(e.target.value) })}
            >
              {QUALIFY_PRESETS.map((r, i) => (
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
              attemptName(category) && `경기당 시도 리그 평균(${note}) 이상만 순위`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </section>

      {/* 매거진 표지: 선택 부문 1~3위 */}
      <section aria-label={`${statTitle(category, mode)} 1~3위`} className="mt-4">
        {top.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {top.map((e, i) => (
              <CoverCard
                key={e.player.id}
                entry={e}
                team={teamByCode.get(e.player.teamCode)}
                category={category}
                mode={mode}
                hero={i === 0}
              />
            ))}
          </div>
        ) : (
          <div className="surface-card rounded-2xl px-4 py-8 text-center">
            <p className="text-body font-semibold text-ink">조건에 맞는 선수가 없습니다</p>
            <p className="mt-1 text-sub text-ink-2">필터를 줄이거나 표본 기준을 낮춰 보세요.</p>
            <button
              type="button"
              onClick={() => setState((s) => resetLeaderFilters(s))}
              className="focus-ring mt-4 h-11 rounded-lg border border-line bg-surface px-4 text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
            >
              필터 초기화
            </button>
          </div>
        )}
      </section>

      {/* 전체 순위: 모바일 행 카드 / PC 표 */}
      {rows.length > 0 && (
        <section aria-labelledby="all-ranks" className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 id="all-ranks" className="text-h2 font-bold">
              전체 순위
            </h2>
            {/* 모바일 정렬: 드롭다운 하나 (PC 는 열 제목을 누른다) */}
            <label className="flex items-center gap-2 text-sub font-medium text-ink-2 lg:hidden">
              정렬 기준
              <select
                className="focus-ring h-10 cursor-pointer rounded-lg border border-line bg-surface px-2 text-base text-ink"
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
            caption={`${seasonLabel} ${sortedLabel}`}
            columns={tableColumns}
            pageSize={LEADERS_PAGE_SIZE}
            resetKey={`${leadersQueryString(state)}|${sortKey}|${sortDir}`}
            emphasize={(p) => (ranks.get(p.id) ?? 99) <= 3}
            rowLabel={(p) => `${ranks.get(p.id) ?? "순위 없음"}${ranks.has(p.id) ? "위" : ""} ${p.nameKo}, ${statTitle(sortKey, mode)} ${formatStat(statValue(p, sortKey, mode), sortKey, mode)}, 자세히`}
            summary={(p) => {
              const team = teamByCode.get(p.teamCode);
              const rank = ranks.get(p.id);
              const ma = madeAttempts(p, sortKey);
              const eligible = isRankEligible(p, sortKey, thresholds);
              return (
                <>
                  <span
                    className={`tabular w-7 shrink-0 text-center text-body ${rank !== undefined && rank <= 3 ? "font-black text-ink" : "font-semibold text-ink-3"}`}
                  >
                    {rank ?? "–"}
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
              <Link
                href={`/player/${p.id}`}
                className="focus-ring inline-flex h-10 items-center gap-1 rounded-lg px-1 text-body font-semibold text-ink underline-offset-4 hover:underline"
              >
                {p.nameKo} 선수 페이지 <IconChevronRight size={16} />
              </Link>
            )}
          />
          <p className="mt-2 text-sub leading-relaxed text-ink-3">
            성공률 아래 작은 숫자는 시즌 합계 성공/시도. 경기당 시도가 리그 평균({note})에 못 미치면 순위 “–”
            {" "}<InfoLink term="attempts" />
          </p>
        </section>
      )}
    </main>
  );
}
