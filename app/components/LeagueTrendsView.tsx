"use client";
// 기록 메뉴 · 리그 변화 (/records/trends, 2026-10-16): KBL 30년 동안 리그 전체가 어떻게 바뀌었는지.
// 지표 칩 6개(lib/trends LEAGUE_TREND_METRICS) → 선 그래프 하나(한 계열이라 범례 상자 없음, 제목이 이름) → 지표별 한 줄 요약 목록.
// 진행 중 시즌은 경기 수가 적어 점선 + 빈 점으로 따로 보이고, 요약 문장(lib/trends trendTakeaway)에는 넣지 않는다.
// 선택은 주소 ?metric= 에 남긴다. GA4: filter_change screen=records_trends filter=metric.
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatTrendValue, LEAGUE_TREND_METRICS, trendTakeaway, type LeagueTrendKey, type LeagueTrendRow } from "@/lib/trends";
import ChipRow from "./ChipRow";
import NoteInfo from "./NoteInfo";
import { useThemeColors } from "./useThemeColors";
import { trackFilters } from "./track";

interface Datum {
  short: string;
  ongoing: boolean;
  /** 끝난 시즌 값 (실선) */
  done: number | null;
  /** 진행 중 시즌과 그 직전 시즌 값 (점선 구간) */
  live: number | null;
  value: number | null;
  teamGames: number;
}

const isKey = (v: string | null): v is LeagueTrendKey => LEAGUE_TREND_METRICS.some((m) => m.key === v);

export default function LeagueTrendsView({ rows }: { rows: LeagueTrendRow[] }) {
  const colors = useThemeColors();
  const [key, setKey] = useState<LeagueTrendKey>("teamPoints");
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("metric");
    if (isKey(v)) setKey(v);
  }, []);
  const choose = (k: LeagueTrendKey) => {
    if (k === key) return;
    trackFilters("records_trends", { metric: k });
    setKey(k);
    const qs = new URLSearchParams(window.location.search);
    if (k === "teamPoints") qs.delete("metric");
    else qs.set("metric", k);
    const q = qs.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
  };
  const metric = LEAGUE_TREND_METRICS.find((m) => m.key === key)!;
  const takeaways = useMemo(() => new Map(LEAGUE_TREND_METRICS.map((m) => [m.key, trendTakeaway(rows, m.key)])), [rows]);

  const data: Datum[] = useMemo(() => {
    const liveIdx = rows.findIndex((r) => r.ongoing);
    return rows.map((r, i) => {
      const v = r.values[key];
      return {
        short: r.short,
        ongoing: r.ongoing,
        value: v,
        done: r.ongoing ? null : v,
        live: liveIdx >= 0 && (i === liveIdx || i === liveIdx - 1) ? v : null,
        teamGames: r.teamGames,
      };
    });
  }, [rows, key]);
  const lastDoneIdx = data.reduce((acc, d, i) => (d.done !== null ? i : acc), -1);
  const yDomain: [number | string, number | string] = metric.zeroBase ? [0, "auto"] : ["auto", "auto"];
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  return (
    <>
      <ChipRow
        label="지표"
        chips={LEAGUE_TREND_METRICS.map((m) => ({ value: m.key, label: m.label }))}
        value={key}
        onChange={choose}
      />

      <section aria-labelledby="trend-chart-title" className="surface-card mt-3 rounded-container p-3 sm:p-4">
        <h2 id="trend-chart-title" className="flex items-center gap-1 text-h2 font-bold">
          {metric.title}
          <NoteInfo title={metric.title} text={`${metric.note}${rows.some((r) => r.ongoing) ? " 빈 점은 진행 중인 시즌이에요." : ""}`} />
        </h2>
        {trendTakeaway(rows, key, false) && <p className="tabular mt-1 text-body text-ink-2">{trendTakeaway(rows, key, false)}</p>}
        <div aria-hidden className="mt-3 h-64 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 340, height: 256 }}>
            <LineChart data={data} margin={{ top: 24, right: 30, bottom: 4, left: 0 }}>
              <CartesianGrid vertical={false} stroke={colors.grid} strokeWidth={1} />
              <XAxis
                dataKey="short"
                tick={{ fill: colors.ink3, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: colors.grid }}
                interval="preserveStartEnd"
                minTickGap={14}
              />
              <YAxis
                width={40}
                domain={yDomain}
                allowDecimals
                tick={{ fill: colors.ink3, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => fmt(v)}
              />
              <Tooltip
                cursor={{ stroke: colors.ink3, strokeWidth: 1 }}
                isAnimationActive={false}
                content={({ active, payload }) => {
                  const d = active && payload?.[0] ? (payload[0].payload as Datum) : null;
                  if (!d) return null;
                  return (
                    <div className="surface-card rounded-control px-2.5 py-1.5 text-sub">
                      <p className="font-semibold text-ink">
                        {d.short}
                        {d.ongoing && <span className="ml-1 font-medium text-ink-3">진행 중</span>}
                      </p>
                      <p className="tabular mt-0.5 text-body font-bold text-ink">{formatTrendValue(d.value, metric)}</p>
                      {key === "teamPoints" && <p className="tabular text-ink-3">팀 경기 {d.teamGames}</p>}
                    </div>
                  );
                }}
              />
              <Line
                type="linear"
                dataKey="done"
                stroke={colors.series1}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                connectNulls={false}
                isAnimationActive={false}
                activeDot={{ r: 5, fill: colors.series1, stroke: colors.surface, strokeWidth: 2 }}
                dot={(p: { cx?: number; cy?: number; index?: number }) =>
                  p.index === lastDoneIdx && p.cx != null && p.cy != null ? (
                    <g key="last">
                      <circle cx={p.cx} cy={p.cy} r={4} fill={colors.series1} stroke={colors.surface} strokeWidth={2} />
                      <text x={p.cx} y={p.cy - 10} textAnchor="end" fontSize={12} fontWeight={700} fill={colors.ink}>
                        {formatTrendValue(data[p.index].value, metric)}
                      </text>
                    </g>
                  ) : (
                    <g key={`d${p.index}`} />
                  )
                }
              />
              <Line
                type="linear"
                dataKey="live"
                stroke={colors.series1}
                strokeWidth={2}
                strokeDasharray="4 4"
                connectNulls={false}
                isAnimationActive={false}
                dot={(p: { cx?: number; cy?: number; index?: number; payload?: Datum }) =>
                  p.payload?.ongoing && p.cx != null && p.cy != null ? (
                    <circle key={`o${p.index}`} cx={p.cx} cy={p.cy} r={4.5} fill={colors.surface} stroke={colors.series1} strokeWidth={2} />
                  ) : (
                    <g key={`o${p.index}`} />
                  )
                }
                activeDot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <details className="mt-2 group">
          <summary className="focus-ring flex h-10 cursor-pointer items-center rounded-control text-sub font-semibold text-ink-2 transition-colors duration-200 hover:text-ink">
            시즌별 숫자 보기
          </summary>
          <ol className="tabular mt-1 grid grid-cols-2 gap-x-4 text-sub sm:grid-cols-3 lg:grid-cols-5">
            {[...rows].reverse().map((r) => (
              <li key={r.seasonCode} className="flex justify-between gap-2 border-b border-line py-1.5">
                <span className="text-ink-3">
                  {r.short}
                  {r.ongoing && " · 진행 중"}
                </span>
                <span className="font-semibold text-ink">{formatTrendValue(r.values[key], metric)}</span>
              </li>
            ))}
          </ol>
        </details>
      </section>

      <section aria-labelledby="trend-summary-title" className="mt-6">
        <h2 id="trend-summary-title" className="mb-2 text-h2 font-bold">
          한 줄로 보는 30년
        </h2>
        <ul className="surface-card divide-y divide-line rounded-container">
          {LEAGUE_TREND_METRICS.map((m) => {
            const text = takeaways.get(m.key);
            if (!text) return null;
            const on = m.key === key;
            return (
              <li key={m.key}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    choose(m.key);
                    document.getElementById("trend-chart-title")?.scrollIntoView({ block: "nearest" });
                  }}
                  className={`focus-ring-inset flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left text-body transition-colors duration-200 hover:bg-surface-2 ${on ? "font-semibold text-ink" : "text-ink-2"}`}
                >
                  {/* deslop-ignore-next-line 19 */}
                  <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${on ? "bg-[var(--series-1)]" : "bg-line"}`} />
                  <span className="tabular min-w-0">{text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
