"use client";
// 시즌 순위표 화면 (PLAN.md §2-1, §5-4): 부문 1~3위 "표지" 카드 + 정렬 가능한 표.
// 정렬·필터·순위·표기는 전부 lib/leaders.ts 순수 함수 — 이 파일은 상태와 배치만 맡는다.
// 선택 상태는 주소 쿼리(?cat=&mode=&origin=&team=&q=)에 남긴다. useSearchParams 대신 window.location 을 읽어
// 정적 HTML에 기본 상태(경기당 득점)의 카드·표가 그대로 렌더링되게 한다 (CardExplorer 와 같은 방식).
import { useEffect, useMemo, useState } from "react";
import type { CardTeam, LeaderPlayer } from "@/lib/types";
import { attemptsNote, attemptThresholds, QUALIFY_PRESETS, qualifyLabel, qualifyShort } from "@/lib/metrics";
import {
  attemptName,
  columnOrder,
  DEFAULT_LEADERS_STATE,
  defaultSortDir,
  filterLeaders,
  formatMadeAttempts,
  formatStat,
  isModeIndependent,
  isRankEligible,
  LEADER_CATEGORIES,
  LEADER_STATS,
  leadersQueryString,
  madeAttempts,
  parseLeadersQuery,
  rankMap,
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
import PlayerAvatar from "./PlayerAvatar";
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
const ORIGIN_OPTIONS: { value: OriginFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "domestic", label: "국내" },
  { value: "foreign", label: "외국인" },
];

/** 두세 개 중 하나를 고르는 버튼 묶음 */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`h-9 rounded-md px-3 text-sm font-semibold ${
            o.value === value ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 팀 색 배경 위에 올리는 로고 — 로고 색이 배경과 겹치지 않게 흰 칩 위에 */
function LogoChip({ team, fallback, size }: { team?: CardTeam; fallback: string; size: number }) {
  return (
    <span className="inline-flex shrink-0 rounded-md bg-white p-0.5">
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
  const color = team?.color ?? { primary: "#6B7280", secondary: "#9CA3AF", text: "#fff" };
  const teamLabel = teamShortLabel(team?.shortName ?? p.teamShort);
  const lowerIsBetter = LEADER_STATS[category].better === "low";
  return (
    <article
      className={`relative overflow-hidden rounded-2xl ${hero ? "col-span-2 p-4 sm:p-5" : "p-3"}`}
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
          <p className={`font-semibold opacity-85 ${hero ? "text-xs" : "text-[11px]"}`}>{entry.rank}위</p>
          <h3 className={`font-bold leading-tight break-keep ${hero ? "truncate text-2xl" : "line-clamp-2 text-base"}`} title={p.nameKo}>
            {p.nameKo}
          </h3>
          <p className={`mt-1 flex min-w-0 items-center gap-1.5 opacity-90 ${hero ? "text-sm" : "text-[11px]"}`}>
            <LogoChip team={team} fallback={p.teamShort} size={hero ? 20 : 14} />
            <span className="truncate">{teamLabel}</span>
            {hero && <span className="shrink-0">· {p.isForeign ? "외국인" : "국내"}</span>}
          </p>
        </div>
      </div>
      <p className={`relative ${hero ? "mt-4" : "mt-2.5"}`}>
        <span className={`block font-semibold opacity-85 ${hero ? "text-xs" : "text-[11px]"}`}>
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
  const { category, mode, origin, teamCode, presetIdx } = state;
  const rule = QUALIFY_PRESETS[presetIdx];
  const categories = LEADER_CATEGORIES;
  const columns = columnOrder(category);
  const sortKey = sort?.key ?? category;
  const sortDir = sort?.dir ?? defaultSortDir(category);

  // 성공률 시도 기준: 이 시즌 표본 충족 선수(국내/외국인·팀 필터 전 전체)의 경기당 시도 평균 — 플레이어 카드와 같은 함수
  const thresholds = useMemo(() => attemptThresholds(players, rule), [players, rule]);

  const filtered = useMemo(
    () => filterLeaders(players, { origin, teamCode, rule }),
    [players, origin, teamCode, rule],
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
  const categoryAttempt = attemptName(category);
  const note = attemptsNote(thresholds);

  function chooseCategory(key: LeaderStatKey) {
    update({ category: key });
    setSort(null);
  }

  function clickHeader(key: LeaderStatKey) {
    setSort(key === sortKey ? { key, dir: sortDir === "desc" ? "asc" : "desc" } : { key, dir: defaultSortDir(key) });
  }

  const selectedTeam = teamCode ? teamByCode.get(teamCode) : undefined;

  return (
    <main className="mx-auto max-w-5xl px-4 pt-5">
      <header className="mb-4">
        <p className="text-xs font-medium text-ink-3">{seasonLabel} KBL 정규시즌</p>
        <h1 className="mt-0.5 text-xl font-bold tracking-tight">시즌 순위표</h1>
        <p className="mt-1 text-sm text-ink-2">부문을 고르면 1~3위가 위에, 전체 순위가 아래 표에 나옵니다. 표 열 제목을 누르면 그 열로 정렬합니다.</p>
      </header>

      {/* 필터: 아래 카드·표 전부에 적용 */}
      <section aria-label="부문 선택" className="flex flex-wrap gap-1.5">
        {categories.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={key === category}
            onClick={() => chooseCategory(key)}
            className={`h-9 rounded-full border px-3 text-sm font-semibold ${
              key === category ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2"
            }`}
          >
            {LEADER_STATS[key].label}
          </button>
        ))}
      </section>

      <section aria-label="보기 설정" className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Segmented label="경기당 또는 시즌 합계" options={MODE_OPTIONS} value={mode} onChange={(v) => update({ mode: v })} />
          <Segmented label="국내 또는 외국인" options={ORIGIN_OPTIONS} value={origin} onChange={(v) => update({ origin: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          <label className="flex min-w-0 flex-col text-xs font-medium text-ink-2">
            <span className="mb-1">팀</span>
            <span className="relative flex items-center">
              {selectedTeam && (
                <span className="pointer-events-none absolute left-2">
                  <TeamLogo logoUrl={selectedTeam.logoUrl} shortName={selectedTeam.shortName} color={selectedTeam.color} size={22} />
                </span>
              )}
              <select
                className={`h-11 w-full min-w-0 rounded-lg border border-line bg-surface pr-2 text-base text-ink ${
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
          </label>
          <label className="flex min-w-0 flex-col text-xs font-medium text-ink-2">
            <span className="mb-1">표본 기준</span>
            <select
              className="h-11 w-full min-w-0 rounded-lg border border-line bg-surface px-2 text-base text-ink"
              value={presetIdx}
              onChange={(e) => update({ presetIdx: Number(e.target.value) })}
            >
              {QUALIFY_PRESETS.map((r, i) => (
                <option key={i} value={i}>
                  {qualifyShort(r)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-ink-3">
          {qualifyLabel(rule)} 출전한 선수 {filtered.length}명
          {isModeIndependent(category) && " · 이 부문은 비율 지표라 경기당/합계 전환과 관계없습니다"}
          {LEADER_STATS[category].better === "low" && " · 턴오버는 적을수록 상위입니다"}
        </p>
        {categoryAttempt && (
          <p className="text-xs text-ink-3">
            성공률 순위는 경기당 시도가 리그 평균({note}) 이상인 선수만
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
          <p className="rounded-xl border border-line bg-surface px-4 py-8 text-center text-sm text-ink-2">
            조건에 맞는 선수가 없습니다. 표본 기준을 낮추거나 팀·국내/외국인 선택을 바꿔 보세요.
          </p>
        )}
      </section>

      {/* 전체 순위표 — 표 영역만 가로 스크롤, 순위·선수 열은 고정 */}
      {rows.length > 0 && (
        <section aria-label="전체 순위표" className="mt-6">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-base font-bold">전체 순위</h2>
            <p className="text-xs text-ink-3 sm:hidden">표를 옆으로 밀면 열이 더 있습니다 →</p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="tabular w-full border-separate border-spacing-0 text-sm">
              <caption className="sr-only">
                {seasonLabel} {statTitle(sortKey, mode)} 순위, {sortDir === "desc" ? "높은 순" : "낮은 순"}
              </caption>
              <thead>
                <tr className="text-xs text-ink-3">
                  <th scope="col" className="sticky left-0 z-20 w-9 min-w-9 border-b border-line bg-surface px-1 py-2 text-center font-medium">
                    순위
                  </th>
                  <th
                    scope="col"
                    className="sticky left-9 z-20 w-34 min-w-34 border-b border-r border-line bg-surface px-2 py-2 text-left font-medium sm:w-44 sm:min-w-44"
                  >
                    선수
                  </th>
                  {columns.map((key) => {
                    const active = key === sortKey;
                    return (
                      <th
                        key={key}
                        scope="col"
                        aria-sort={active ? (sortDir === "desc" ? "descending" : "ascending") : "none"}
                        className={`border-b border-line p-0 text-right font-medium ${active ? "bg-surface-2 text-ink" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => clickHeader(key)}
                          title={`${statTitle(key, mode)}로 정렬`}
                          className="flex w-full items-center justify-end gap-0.5 whitespace-nowrap px-1.5 py-2 font-semibold hover:text-ink"
                        >
                          {LEADER_STATS[key].short}
                          <span aria-hidden className="w-2 text-[9px]">
                            {active ? (sortDir === "desc" ? "▼" : "▲") : ""}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const team = teamByCode.get(p.teamCode);
                  const rank = ranks.get(p.id);
                  const eligible = isRankEligible(p, sortKey, thresholds);
                  return (
                    <tr key={p.id} className="group">
                      <td
                        className={`sticky left-0 z-10 border-b border-line bg-surface px-1 py-1.5 text-center group-hover:bg-surface-2 ${
                          rank !== undefined && rank <= 3 ? "font-bold text-ink" : "text-ink-2"
                        }`}
                        title={eligible ? undefined : `${attemptName(sortKey)} 시도 부족 — 순위 제외`}
                      >
                        {rank ?? "–"}
                      </td>
                      <td className="sticky left-9 z-10 w-34 min-w-34 max-w-34 border-b border-r border-line bg-surface px-2 py-1.5 group-hover:bg-surface-2 sm:w-44 sm:min-w-44 sm:max-w-44">
                        <span className="flex min-w-0 items-center gap-2">
                          <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={team?.color} size={24} />
                          <span className="min-w-0">
                            <span className="line-clamp-2 font-semibold leading-tight break-keep text-ink" title={p.nameKo}>
                              {p.nameKo}
                            </span>
                            <span className="flex min-w-0 items-center gap-1 text-[11px] text-ink-3">
                              <TeamLogo logoUrl={team?.logoUrl} shortName={team?.shortName ?? p.teamShort} color={team?.color} size={16} />
                              <span className="truncate">{teamShortLabel(team?.shortName ?? p.teamShort)}</span>
                            </span>
                          </span>
                        </span>
                      </td>
                      {columns.map((key) => {
                        const ma = madeAttempts(p, key);
                        const dim = key === sortKey && !eligible;
                        return (
                          <td
                            key={key}
                            className={`border-b border-line px-1.5 py-1.5 text-right whitespace-nowrap ${
                              key === sortKey ? "bg-surface-2 font-semibold text-ink" : "text-ink-2"
                            } ${dim ? "opacity-60" : ""}`}
                          >
                            <span className="block leading-tight">{formatStat(statValue(p, key, mode), key, mode)}</span>
                            {ma && (
                              <span className="block text-[10px] font-normal leading-tight text-ink-3">
                                {formatMadeAttempts(ma)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-3">
            경기당 모드에서 출전시간·득점 등 누적 기록은 경기 수로 나눈 값입니다. 야투%·3점%·자유투%·TS%·PER는 KBL
            계산값 그대로이고, 성공률 아래 작은 숫자는 시즌 합계 성공/시도입니다. 성공률 순위는 경기당 시도가 리그
            평균({note}) 이상인 선수만 매기며, 미달 선수는 순위 “–”로 표 아래쪽에 둡니다. 턴오버는 적을수록 상위입니다.
          </p>
        </section>
      )}
    </main>
  );
}
