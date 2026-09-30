"use client";
// 선수 페이지 시즌별 추이 선 그래프 (Recharts LineChart, PLAN.md §2-2 ③).
// - 지표 전환 버튼 6개(lib/career TREND_METRICS), 가로축 = 시즌, 세로축 = 값. 한 개 계열이라 범례 상자 없음(제목이 이름).
// - 선은 시리즈 색 2px, 점은 그 시즌 팀 색(표면 색 고리 2px) — 팀이 바뀐 시즌은 점을 크게 + 아래 범례(팀 한글 약칭)로 구분.
//   팀 색이 비슷하거나(옛 구단은 모두 회색) 색을 구분하기 어려운 경우를 위해 툴팁·표에 팀 이름이 항상 같이 나온다.
// - 점을 누르거나(모바일) 올리면 툴팁에 시즌·팀·값·경기 수. 마지막 시즌 값은 점 옆에 직접 표기.
// - 뛰지 않은 시즌(군 복무 등)은 값 없음 → 선이 끊긴다.
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import type { CareerSeason, SeasonOption, TeamColor } from "@/lib/types";
import {
  formatTrend,
  seasonShortLabel,
  seasonTickLabel,
  TREND_METRICS,
  trendRows,
  type TrendKey,
  type TrendRow,
} from "@/lib/career";
import { teamShortLabel } from "@/lib/images";
import { useThemeColors } from "./useThemeColors";

const GRAY: TeamColor = FALLBACK_TEAM_COLOR;

interface Props {
  /** 시즌 오름차순 */
  seasons: CareerSeason[];
  /** 코드표 시즌 목록 (빈 시즌을 가로축에 깔기 위해) */
  allSeasons: SeasonOption[];
}

interface Datum extends TrendRow {
  tick: string;
  team: string;
  color: string;
}

export default function CareerTrend({ seasons, allSeasons }: Props) {
  const colors = useThemeColors();
  const [key, setKey] = useState<TrendKey>("points");
  const metric = TREND_METRICS.find((m) => m.key === key)!;

  const bySeason = useMemo(() => new Map(seasons.map((s) => [s.seasonCode, s])), [seasons]);
  const data: Datum[] = useMemo(
    () =>
      trendRows(seasons, allSeasons, key).map((r) => {
        const s = bySeason.get(r.seasonCode);
        return {
          ...r,
          tick: seasonTickLabel(r.seasonLabel),
          team: s ? teamShortLabel(s.team?.shortName ?? s.teamShort) : "",
          color: (s?.team?.color ?? GRAY).primary,
        };
      }),
    [seasons, allSeasons, key, bySeason],
  );

  // 범례: 거쳐 간 팀(처음 등장 순). 같은 팀 코드라도 이름이 바뀌면 따로 (KT&G → 정관장)
  const legend = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of data) if (d.value !== null && !seen.has(d.team)) seen.set(d.team, d.color);
    return [...seen.entries()].map(([team, color]) => ({ team, color }));
  }, [data]);

  if (seasons.length < 2) {
    return (
      <section aria-labelledby="trend-title" className="surface-card rounded-2xl p-4">
        <h2 id="trend-title" className="text-h2 font-bold">
          시즌별 추이
        </h2>
        <p className="mt-2 text-body text-ink-2">
          정규시즌 기록이 {seasonShortLabel(seasons[0]?.seasonLabel ?? "")} 한 시즌뿐이라 추이 그래프 대신 아래 기록표로 봅니다.
        </p>
      </section>
    );
  }

  const lastIdx = data.reduce((acc, d, i) => (d.value !== null ? i : acc), -1);
  const yDomain: [number | string, number | string] = metric.kind === "perGame" ? [0, "auto"] : ["auto", "auto"];

  return (
    <section aria-labelledby="trend-title" className="surface-card rounded-2xl p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="trend-title" className="text-h2 font-bold">
          시즌별 추이 <span className="font-medium text-ink-2">· {metric.title}</span>
        </h2>
        <p className="text-sub text-ink-3">점을 누르면 값이 보입니다</p>
      </div>

      <div role="group" aria-label="추이 지표" className="mt-2 flex flex-wrap gap-1.5">
        {TREND_METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={m.key === key}
            onClick={() => setKey(m.key)}
            className={`h-10 rounded-lg border px-3 text-sub font-semibold ${
              m.key === key ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div aria-hidden className="mt-3 h-60 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 340, height: 240 }}>
          <LineChart data={data} margin={{ top: 22, right: 34, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={colors.grid} strokeWidth={1} />
            <XAxis
              dataKey="tick"
              tick={{ fill: colors.ink3, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: colors.grid }}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              width={38}
              domain={yDomain}
              allowDecimals
              tick={{ fill: colors.ink3, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))}
            />
            <Tooltip
              cursor={{ stroke: colors.grid, strokeWidth: 1 }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const d = active && payload?.[0] ? (payload[0].payload as Datum) : null;
                if (!d) return null;
                return (
                  <div className="surface-card rounded-lg px-2.5 py-1.5 text-sub">
                    <p className="font-semibold text-ink">{seasonShortLabel(d.seasonLabel)}</p>
                    {d.value === null ? (
                      <p className="text-ink-3">정규시즌 기록 없음</p>
                    ) : (
                      <>
                        <p className="mt-0.5 flex items-center gap-1.5 text-ink-2">
                          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                          {d.team}
                          {d.teamChanged && <span className="text-ink-3">(이적)</span>} · {d.games}경기
                        </p>
                        <p className="mt-0.5 text-body font-bold text-ink">
                          {metric.title} {formatTrend(d.value, key)}
                        </p>
                      </>
                    )}
                  </div>
                );
              }}
            />
            <Line
              type="linear"
              dataKey="value"
              stroke={colors.series1}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              connectNulls={false}
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; index?: number; payload?: Datum }) => {
                const { cx, cy, index = 0, payload } = props;
                if (cx == null || cy == null || !payload || payload.value === null) return <g key={`d${index}`} />;
                const r = payload.teamChanged ? 6.5 : 5;
                return (
                  <g key={`d${index}`}>
                    <circle cx={cx} cy={cy} r={r} fill={payload.color} stroke={colors.surface} strokeWidth={2} />
                    {index === lastIdx && (
                      <text x={cx} y={cy - 11} textAnchor="middle" fontSize={12} fontWeight={700} fill={colors.ink}>
                        {formatTrend(payload.value, key)}
                      </text>
                    )}
                  </g>
                );
              }}
              activeDot={{ r: 7, stroke: colors.surface, strokeWidth: 2, fill: colors.series1 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sub text-ink-2">
        <span className="text-ink-3">점 색 = 그 시즌 팀{legend.length > 1 ? " · 큰 점 = 이적한 시즌" : ""}</span>
        {legend.map((l) => (
          <span key={l.team} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
            {l.team}
          </span>
        ))}
      </div>
      <p className="mt-1 text-caption leading-snug text-ink-3">
        {metric.kind === "perGame"
          ? "경기당 값 = 시즌 누적 ÷ 출전 경기."
          : "KBL 계산값 그대로."}{" "}
        출전 경기가 적은 시즌은 값이 튀기도 합니다. 정확한 숫자는 아래 시즌별 기록.
      </p>
    </section>
  );
}
