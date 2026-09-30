"use client";
// 팀별 선수 분포 화면 (PLAN.md §2-3, §5-4): 산점도(가로 = 경기당 출전시간, 세로 = PER·TS%·경기당 득점) + 팀 요약 카드.
// - 점 = 표본 기준 충족 선수, 색 = 팀 색 (회색 기본값 팀은 범주형 팔레트, lib/teams.ts assignTeamColors).
//   팀 칩이 범례와 필터를 겸한다: 전체 / 한 팀 강조 / 두 팀 비교 — 선택 팀만 진하게, 나머지는 옅게.
//   두 팀 비교 때 색이 비슷하면 팔레트 1·2번으로 바꾸고(comparePairColors), 두 번째 팀 점은 네모 → 모양으로도 구분.
// - 점을 누르면 아래 작은 카드(이름·팀·값·선수 기록 링크). PC 는 올리면 툴팁도 뜬다. 모바일은 툴팁 없이 카드만.
// - 포지션 칩(전체/가드/포워드/센터): 점만 거른다 (lib/roster filterByPosition). 팀 의존도 카드는 팀 전체 기준 그대로.
// - 계산은 전부 lib/distribution.ts·lib/teams.ts·lib/roster.ts 순수 함수. 상태는 주소 쿼리(?teams=&y=&q=&pos=&p=)에 남긴다.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { CardTeam, LeaderPlayer } from "@/lib/types";
import { QUALIFY_PRESETS, qualifyLabel, qualifyShort } from "@/lib/metrics";
import {
  DEFAULT_DISTRIBUTION_STATE,
  distributionQueryString,
  formatMinutes,
  formatScatterY,
  formatShare,
  parseDistributionQuery,
  SCATTER_METRICS,
  scatterMetric,
  scatterPoints,
  teamEmphasis,
  toggleTeam,
  type DistributionState,
  type Emphasis,
  type ScatterPoint,
} from "@/lib/distribution";
import { assignTeamColors, comparePairColors, ensureMarkContrast, teamDependency } from "@/lib/teams";
import { teamShortLabel } from "@/lib/images";
import { filterByPosition, POSITION_FILTERS, positionFilterLabel, positionLabel } from "@/lib/roster";
import PlayerAvatar from "./PlayerAvatar";
import Segmented from "./Segmented";
import TeamLogo from "./TeamLogo";
import { useMedia } from "./useMedia";
import { useThemeColors } from "./useThemeColors";

interface Props {
  seasonLabel: string;
  players: LeaderPlayer[];
  teams: CardTeam[];
}

interface Datum extends ScatterPoint<LeaderPlayer> {
  color: string;
  emphasis: Emphasis;
  /** 두 팀 비교의 두 번째 팀 → 네모 */
  square: boolean;
  selected: boolean;
}

/** 범례·칩의 색 표시 (두 번째 비교 팀은 네모) */
function Swatch({ color, square }: { color: string; square?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2.5 w-2.5 shrink-0 ${square ? "rounded-[2px]" : "rounded-full"}`}
      style={{ background: color }}
    />
  );
}

export default function TeamsView({ seasonLabel, players, teams }: Props) {
  const colors = useThemeColors();
  const isMd = useMedia("(min-width: 768px)");
  const [state, setState] = useState<DistributionState>(DEFAULT_DISTRIBUTION_STATE);
  const teamByCode = useMemo(() => new Map(teams.map((t) => [t.teamCode, t])), [teams]);
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // 공유 링크로 들어온 상태 반영 (이 시즌에 없는 팀·선수는 버린다)
  useEffect(() => {
    setState(
      parseDistributionQuery(window.location.search, {
        teamCodes: teams.map((t) => t.teamCode),
        playerIds: new Set(players.map((p) => p.id)),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${distributionQueryString(state)}`);
  }, [state]);

  const update = (patch: Partial<DistributionState>) => setState((s) => ({ ...s, ...patch }));
  const { teams: selected, yKey, presetIdx, playerId, position } = state;
  const rule = QUALIFY_PRESETS[presetIdx];
  const metric = scatterMetric(yKey);

  // 팀 색: 시즌 팀 전체 기준으로 배정(필터가 바뀌어도 같은 팀은 같은 색) → 바탕 대비 보정 → 두 팀 비교 보정
  const teamColor = useMemo(() => {
    const base = assignTeamColors(teams, colors.categorical);
    const m = new Map<string, string>();
    for (const [code, hex] of base) m.set(code, ensureMarkContrast(hex, colors.surface));
    if (selected.length === 2) {
      const [a, b] = comparePairColors(m.get(selected[0])!, m.get(selected[1])!, colors.categorical);
      m.set(selected[0], a);
      m.set(selected[1], b);
    }
    return m;
  }, [teams, colors, selected]);
  const colorOf = (code: string) => teamColor.get(code) ?? "#6B7280";

  const points = useMemo(() => scatterPoints(filterByPosition(players, position), rule, yKey), [players, position, rule, yKey]);
  // 선택한 선수가 표본 기준을 바꿔 사라지면 카드도 닫는다
  const selectedPoint = points.find((d) => d.player.id === playerId) ?? null;

  const data: Datum[] = useMemo(() => {
    const rows = points.map((d) => ({
      ...d,
      color: colorOf(d.player.teamCode),
      emphasis: teamEmphasis(d.player.teamCode, selected),
      square: selected.length === 2 && d.player.teamCode === selected[1],
      selected: d.player.id === playerId,
    }));
    // 옅은 점을 먼저 그려 강조 점이 위에 오게, 고른 선수는 맨 위
    const order = (d: Datum) => (d.selected ? 3 : d.emphasis === "dim" ? 0 : d.emphasis === "normal" ? 1 : 2);
    return rows.sort((a, b) => order(a) - order(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, selected, playerId, teamColor]);

  const deps = useMemo(
    () => teams.map((t) => ({ team: t, dep: teamDependency(players, t.teamCode, rule) })),
    [teams, players, rule],
  );

  const xMax = points.reduce((m, d) => Math.max(m, d.x), 0);
  const xDomain: [number, number] = [0, Math.max(40, Math.ceil(xMax / 5) * 5)];

  function selectPlayer(id: string | null) {
    update({ playerId: id === playerId ? null : id });
  }

  const selectionText =
    selected.length === 0
      ? "전체 팀"
      : selected.map((c) => teamShortLabel(teamByCode.get(c)?.shortName ?? c)).join(selected.length === 2 ? " vs " : "");
  const tableRows = [...data]
    .filter((d) => d.emphasis !== "dim")
    .sort((a, b) => b.y - a.y || a.player.nameKo.localeCompare(b.player.nameKo, "ko"));

  return (
    <main className="mx-auto max-w-5xl px-4 pt-5">
      <header className="mb-4">
        <p className="text-xs font-medium text-ink-3">{seasonLabel} KBL 정규시즌</p>
        <h1 className="mt-0.5 text-xl font-bold tracking-tight">팀별 선수 분포</h1>
        <p className="mt-1 text-sm text-ink-2">
          점 하나가 선수 한 명입니다. 오른쪽일수록 많이 뛰고, 위쪽일수록 {metric.label} 값이 높습니다. 팀을 고르면 그 팀만
          진하게, 두 팀을 고르면 나란히 비교합니다.
        </p>
      </header>

      {/* 조작: 세로축 지표 · 표본 기준 · 팀(범례 겸용) */}
      <section aria-label="보기 설정" className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <Segmented
            label="세로축 지표"
            options={SCATTER_METRICS.map((m) => ({ value: m.key, label: m.label }))}
            value={yKey}
            onChange={(v) => update({ yKey: v })}
          />
          <Segmented
            label="포지션"
            options={POSITION_FILTERS.map((f) => ({ value: f, label: positionFilterLabel(f) }))}
            value={position}
            onChange={(v) => update({ position: v })}
          />
          <label className="flex min-w-0 items-center gap-2 text-xs font-medium text-ink-2">
            <span className="shrink-0">표본 기준</span>
            <select
              className="h-10 min-w-0 rounded-lg border border-line bg-surface px-2 text-base text-ink sm:text-sm"
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

        <div role="group" aria-label="팀 선택 (최대 두 팀)" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={selected.length === 0}
            onClick={() => update({ teams: [] })}
            className={`h-9 rounded-full border px-3 text-sm font-semibold ${
              selected.length === 0 ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2"
            }`}
          >
            전체
          </button>
          {teams.map((t) => {
            const on = selected.includes(t.teamCode);
            const dim = selected.length > 0 && !on;
            return (
              <button
                key={t.teamCode}
                type="button"
                aria-pressed={on}
                onClick={() => update({ teams: toggleTeam(selected, t.teamCode) })}
                className={`flex h-9 items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-3 text-sm font-semibold ${
                  on ? "border-ink bg-surface-2 text-ink ring-1 ring-ink" : "border-line bg-surface text-ink-2 hover:bg-surface-2"
                } ${dim ? "opacity-60" : ""}`}
              >
                <TeamLogo logoUrl={t.logoUrl} shortName={t.shortName} color={t.color} size={20} />
                <Swatch color={colorOf(t.teamCode)} square={selected.length === 2 && t.teamCode === selected[1]} />
                <span className="whitespace-nowrap">{teamShortLabel(t.shortName)}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-ink-3">
          {qualifyLabel(rule)} 출전한 {position !== "all" ? `${positionFilterLabel(position)} ` : ""}선수 {points.length}명 · {selectionText}
          {selected.length === 1 && " 강조 · 한 팀을 더 누르면 두 팀 비교"}
          {selected.length === 2 && " 비교 (두 번째 팀은 네모 점)"}
        </p>
      </section>

      {/* 산점도 */}
      <section aria-label={`${metric.label} 대 경기당 출전시간 산점도`} className="mt-3 rounded-2xl border border-line bg-surface p-2 sm:p-4">
        <div aria-hidden className="scatter-plot w-full">
          <ResponsiveContainer
            width="100%"
            aspect={isMd ? 1.8 : 1.05}
            initialDimension={{ width: 358, height: 340 }}
          >
            <ScatterChart margin={{ top: 12, right: 12, bottom: isMd ? 22 : 18, left: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeWidth={1} />
              <XAxis
                type="number"
                dataKey="x"
                domain={xDomain}
                tickCount={isMd ? 9 : 5}
                tick={{ fill: colors.ink3, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: colors.grid }}
                label={{
                  value: isMd ? "경기당 출전시간 (분)" : "출전(분)",
                  position: "insideBottom",
                  offset: isMd ? -14 : -10,
                  fill: colors.ink2,
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={["auto", "auto"]}
                width={isMd ? 44 : 34}
                tick={{ fill: colors.ink3, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: isMd ? metric.label : metric.short,
                  angle: -90,
                  position: "insideLeft",
                  offset: isMd ? 12 : 8,
                  fill: colors.ink2,
                  fontSize: 11,
                  style: { textAnchor: "middle" },
                }}
              />
              {isMd && (
                <Tooltip
                  isAnimationActive={false}
                  cursor={false}
                  content={({ active, payload }) => {
                    const d = active && payload?.[0] ? (payload[0].payload as Datum) : null;
                    if (!d) return null;
                    const t = teamByCode.get(d.player.teamCode);
                    return (
                      <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md">
                        <p className="flex items-center gap-1.5 font-semibold text-ink">
                          <Swatch color={d.color} square={d.square} />
                          {d.player.nameKo}
                          <span className="font-normal text-ink-2">
                            {teamShortLabel(t?.shortName ?? d.player.teamShort)}
                            {d.player.position ? ` · ${d.player.position}` : ""}
                          </span>
                        </p>
                        <p className="mt-0.5 text-ink-2">
                          출전 {formatMinutes(d.x)} · {metric.label} <b className="text-ink">{formatScatterY(d.y, yKey)}</b>
                        </p>
                        <p className="mt-0.5 text-ink-3">눌러서 선수 카드 열기</p>
                      </div>
                    );
                  }}
                />
              )}
              <Scatter
                data={data}
                isAnimationActive={false}
                shape={(props: { cx?: number; cy?: number; payload?: Datum }) => {
                  const { cx, cy, payload: d } = props;
                  if (cx == null || cy == null || !d) return <g />;
                  const dim = d.emphasis === "dim";
                  const r = d.selected ? 7.5 : d.emphasis === "focus" ? 6 : 5;
                  const common = {
                    fill: d.color,
                    fillOpacity: dim ? 0.2 : 1,
                    stroke: d.selected ? colors.ink : colors.surface,
                    strokeWidth: 2,
                    strokeOpacity: dim ? 0.4 : 1,
                  };
                  return (
                    <g onClick={() => selectPlayer(d.player.id)} style={{ cursor: "pointer" }}>
                      {/* 누르기 쉬운 넓은 투명 영역 */}
                      <circle cx={cx} cy={cy} r={12} fill="transparent" />
                      {d.square ? (
                        <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={1.5} {...common} />
                      ) : (
                        <circle cx={cx} cy={cy} r={r} {...common} />
                      )}
                      {d.selected && (
                        <text
                          x={cx}
                          y={cy - 12}
                          textAnchor="middle"
                          fontSize={12}
                          fontWeight={700}
                          fill={colors.ink}
                          stroke={colors.surface}
                          strokeWidth={3}
                          paintOrder="stroke"
                        >
                          {d.player.nameKo}
                        </text>
                      )}
                    </g>
                  );
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* 고른 선수 카드 (모바일은 툴팁 대신 이것) */}
        <div className="mt-2 min-h-16" aria-live="polite">
          {selectedPoint ? (
            <SelectedCard
              point={selectedPoint}
              team={teamByCode.get(selectedPoint.player.teamCode)}
              color={colorOf(selectedPoint.player.teamCode)}
              metricLabel={metric.label}
              yText={formatScatterY(selectedPoint.y, yKey)}
              onClose={() => update({ playerId: null })}
            />
          ) : (
            <p className="flex h-16 items-center justify-center rounded-xl bg-surface-2 px-3 text-center text-xs text-ink-3">
              점을 누르면 선수 이름과 기록이 여기 나옵니다
            </p>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-ink-3">
          {metric.note}. 가로축 = 시즌 누적 출전시간 ÷ 출전 경기. {qualifyLabel(rule)} 선수만 표시합니다. 팀 색이 비슷한
          팀끼리는 점 색만으로 구분하기 어려우니 팀을 골라 보세요.
        </p>
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-ink-2">
            표로 보기 ({selected.length ? selectionText : "전체"} {tableRows.length}명)
          </summary>
          <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-line">
            <table className="tabular w-full text-xs">
              <thead className="sticky top-0 bg-surface-2 text-ink-3">
                <tr>
                  <th scope="col" className="px-2 py-1.5 text-left font-medium">선수</th>
                  <th scope="col" className="px-2 py-1.5 text-left font-medium">팀</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">출전</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">{metric.short}</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((d) => (
                  <tr key={d.player.id} className="border-t border-line">
                    <td className="px-2 py-1">
                      <Link href={`/player/${d.player.id}`} className="font-semibold text-ink underline-offset-2 hover:underline">
                        {d.player.nameKo}
                      </Link>
                    </td>
                    <td className="px-2 py-1 text-ink-2">
                      {teamShortLabel(teamByCode.get(d.player.teamCode)?.shortName ?? d.player.teamShort)}
                    </td>
                    <td className="px-2 py-1 text-right text-ink-2">{formatMinutes(d.x)}</td>
                    <td className="px-2 py-1 text-right font-semibold text-ink">{formatScatterY(d.y, yKey)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      {/* 팀 요약: 핵심 의존도 */}
      <section aria-labelledby="dep-title" className="mt-8">
        <h2 id="dep-title" className="text-base font-bold">
          팀별 핵심 의존도
        </h2>
        <p className="mt-1 text-xs text-ink-3">
          상위 3명 득점 비중 = 팀 득점 1~3위 선수의 시즌 득점 합 ÷ 팀 선수 전원의 시즌 득점 합. 높을수록 소수에게 기대는 팀.
          카드를 누르면 위 산점도에서 그 팀을 강조합니다.
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {deps.map(({ team: t, dep }) => {
            const on = selected.includes(t.teamCode);
            const share = dep.topShare ?? 0;
            return (
              <li key={t.teamCode} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => update({ teams: toggleTeam(selected, t.teamCode) })}
                  className={`flex h-full w-full min-w-0 flex-col rounded-xl border bg-surface p-3 text-left hover:bg-surface-2 ${
                    on ? "border-ink ring-1 ring-ink" : "border-line"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <TeamLogo logoUrl={t.logoUrl} shortName={t.shortName} color={t.color} size={28} />
                    <span className="truncate text-sm font-bold text-ink">{teamShortLabel(t.shortName)}</span>
                  </span>
                  <span className="mt-2 text-[11px] font-medium text-ink-3">상위 3명 득점 비중</span>
                  <span className="text-2xl font-bold leading-tight tracking-tight text-ink">{formatShare(dep.topShare)}</span>
                  <span aria-hidden className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full rounded-full" style={{ width: `${share}%`, background: colorOf(t.teamCode) }} />
                  </span>
                  <span className="mt-1.5 text-[11px] text-ink-2">
                    표본 충족 {dep.qualifiedCount}명 / {dep.rosterCount}명
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-3 break-keep">
                    {dep.top.map((p) => p.nameKo).join(" · ")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[11px] leading-snug text-ink-3">
          선수 기록을 합친 값이라 KBL 공식 팀 기록과 다를 수 있습니다(시즌 중 이적한 선수는 KBL 기록상 소속 팀 한 곳으로 집계).
        </p>
      </section>
    </main>
  );
}

function SelectedCard({
  point,
  team,
  color,
  metricLabel,
  yText,
  onClose,
}: {
  point: ScatterPoint<LeaderPlayer>;
  team?: CardTeam;
  color: string;
  metricLabel: string;
  yText: string;
  onClose: () => void;
}) {
  const p = point.player;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-sm">
      <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={team?.color} size={44} />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5">
          <Swatch color={color} />
          <span className="truncate font-bold text-ink">{p.nameKo}</span>
          <span className="flex shrink-0 items-center gap-1 text-xs text-ink-2">
            <TeamLogo logoUrl={team?.logoUrl} shortName={team?.shortName ?? p.teamShort} color={team?.color} size={16} />
            {teamShortLabel(team?.shortName ?? p.teamShort)}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-ink-2">
          출전 {formatMinutes(point.x)} · {metricLabel} <b className="text-ink">{yText}</b> · {p.games}경기
          {positionLabel(p.position) ? ` · ${positionLabel(p.position)}` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="선수 카드 닫기"
        className="-mr-1 flex h-8 w-6 shrink-0 items-center justify-center text-ink-3 hover:text-ink sm:order-last"
      >
        ✕
      </button>
      {/* 모바일은 아래 줄 전체 폭, 640px 이상은 같은 줄 오른쪽 */}
      <Link
        href={`/player/${p.id}`}
        className="w-full shrink-0 rounded-lg bg-ink px-2.5 py-2 text-center text-xs font-semibold text-bg hover:opacity-90 sm:w-auto"
      >
        선수 기록 보기 ›
      </Link>
    </div>
  );
}
