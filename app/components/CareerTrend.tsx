"use client";
// 선수 페이지 시즌별 추이 선 그래프 (Recharts LineChart, PLAN.md §2-2 ③).
// - 지표 전환 버튼 8개(lib/career TREND_METRICS: 득점·리바·어시·스틸·블록·야투%·3점%·PER), 가로축 = 시즌, 세로축 = 값.
//   한 개 계열이라 범례 상자 없음(제목이 이름).
// - 선은 시리즈 색 2px, 점은 **그 시즌 팀 로고**(LogoDot: 흰 원 + 로고 22px, 이적 시즌은 26px + 두꺼운 팀 색 테두리).
//   로고가 없거나 불러오지 못하면(또는 공식 이미지 스위치 off) 팀 색 원 + 약칭 글자로 대신한다.
//   팀 색이 비슷하거나(옛 구단은 모두 회색) 로고를 알아보기 어려운 경우를 위해 툴팁·범례에 팀 이름이 항상 같이 나온다.
// - 점을 누르거나(모바일) 올리면 툴팁에 시즌·팀·값·경기 수. 마지막 시즌 값은 점 옆에 직접 표기.
// - 뛰지 않은 시즌(군 복무 등)은 값 없음 → 선이 끊긴다.
import { useMemo, useState } from "react";
import { officialImagesEnabled, teamMark } from "@/lib/images";
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
import TeamLogo from "./TeamLogo";
import { useThemeColors } from "./useThemeColors";
import { trackFilters } from "./track";

const GRAY: TeamColor = FALLBACK_TEAM_COLOR;

interface Props {
  /** 시즌 오름차순 */
  seasons: CareerSeason[];
  /** 코드표 시즌 목록 (빈 시즌을 가로축에 깔기 위해) */
  allSeasons: SeasonOption[];
  /**
   * PC(1024px 이상)에서 부모 높이를 채운다 — 선수 상세에서 카드 옆 열이 카드 높이만큼 늘어날 때 차트가 그 높이를 채우도록.
   * 모바일은 지금처럼 고정 높이.
   */
  fill?: boolean;
}

interface Datum extends TrendRow {
  tick: string;
  team: string;
  color: string;
  textColor: string;
  logoUrl: string | null;
}

/** 로고 점 지름 (px): 보통 시즌 / 이적 시즌 */
const DOT = { normal: 22, changed: 26 } as const;

/**
 * 추이 그래프의 점 = 그 시즌 팀 로고 (SVG <image>). 대체: 팀 색 원 + 약칭 글자(teamMark).
 * 로고는 흰 원 안에 얹는다(팀 색 배경 위 로고가 묻히지 않게) — 로드가 끝나기 전·실패하면 대체 디자인이 보인다.
 */
function LogoDot({ cx, cy, d, surface }: { cx: number; cy: number; d: Datum; surface: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const size = d.teamChanged ? DOT.changed : DOT.normal;
  const r = size / 2;
  const src = d.logoUrl && officialImagesEnabled() && failed !== d.logoUrl ? d.logoUrl : null;
  const showLogo = !!src && loaded === src;
  // 점이 작아(22px) 한글 약칭은 두 글자까지만 (전자랜드 → 전자). 영문 머리글자는 teamMark 그대로(최대 3글자)
  const m = teamMark(d.team);
  const mark = /[가-힣]/.test(m) ? [...m].slice(0, 2).join("") : m;
  const inner = size - 6; // 로고 그림 크기 (테두리 안쪽)
  return (
    <g>
      {/* 바깥 고리: 표면 색 2px (선과 겹칠 때 분리), 이적 시즌은 팀 색 고리를 한 겹 더 */}
      <circle cx={cx} cy={cy} r={r + 1} fill={surface} />
      {d.teamChanged && <circle cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={2.5} />}
      {showLogo ? (
        <circle cx={cx} cy={cy} r={r - (d.teamChanged ? 1.5 : 0)} fill="#ffffff" stroke="rgba(0,0,0,0.12)" strokeWidth={1} />
      ) : (
        <>
          <circle cx={cx} cy={cy} r={r - (d.teamChanged ? 1.5 : 0)} fill={d.color} />
          <text
            x={cx}
            y={cy + (mark.length > 2 ? 3 : 3.5)}
            textAnchor="middle"
            fontSize={mark.length > 2 ? 7.5 : 9.5}
            fontWeight={800}
            fill={d.textColor}
          >
            {mark}
          </text>
        </>
      )}
      {src && (
        <image
          href={src}
          x={cx - inner / 2}
          y={cy - inner / 2}
          width={inner}
          height={inner}
          preserveAspectRatio="xMidYMid meet"
          opacity={showLogo ? 1 : 0}
          onLoad={() => setLoaded(src)}
          onError={() => setFailed(src)}
          data-official-image=""
        />
      )}
    </g>
  );
}

export default function CareerTrend({ seasons, allSeasons, fill = false }: Props) {
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
          textColor: (s?.team?.color ?? GRAY).text,
          logoUrl: s?.team?.logoUrl ?? null,
        };
      }),
    [seasons, allSeasons, key, bySeason],
  );

  // 범례: 거쳐 간 팀(처음 등장 순). 같은 팀 코드라도 이름이 바뀌면 따로 (KT&G → 정관장)
  const legend = useMemo(() => {
    const seen = new Map<string, Datum>();
    for (const d of data) if (d.value !== null && !seen.has(d.team)) seen.set(d.team, d);
    return [...seen.values()].map((d) => ({ team: d.team, color: { primary: d.color, secondary: d.color, text: d.textColor }, logoUrl: d.logoUrl }));
  }, [data]);

  if (seasons.length < 2) {
    return (
      <section aria-labelledby="trend-title" className={`surface-card rounded-container p-4 ${fill ? "lg:flex-1" : ""}`}>
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
    <section
      aria-labelledby="trend-title"
      className={`surface-card rounded-container p-3 sm:p-4 ${fill ? "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col" : ""}`}
    >
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
            onClick={() => {
              trackFilters("trend", { metric: m.key });
              setKey(m.key);
            }}
            className={`focus-ring h-10 rounded-control border px-3 text-body font-semibold transition-colors duration-200 ${
              m.key === key ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div aria-hidden className={`mt-3 h-60 w-full sm:h-72 ${fill ? "lg:h-auto lg:min-h-72 lg:flex-1" : ""}`}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 340, height: 240 }}>
          <LineChart data={data} margin={{ top: 30, right: 34, bottom: 4, left: 4 }}>
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
                  <div className="surface-card rounded-control px-2.5 py-1.5 text-sub">
                    <p className="font-semibold text-ink">{seasonShortLabel(d.seasonLabel)}</p>
                    {d.value === null ? (
                      <p className="text-ink-3">정규시즌 기록 없음</p>
                    ) : (
                      <>
                        <p className="mt-0.5 flex items-center gap-1.5 text-ink-2">
                          {/* deslop-ignore-next-line 19 */}
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
                const r = (payload.teamChanged ? DOT.changed : DOT.normal) / 2;
                return (
                  <g key={`d${index}`}>
                    <LogoDot cx={cx} cy={cy} d={payload} surface={colors.surface} />
                    {index === lastIdx && (
                      <text x={cx} y={cy - r - 5} textAnchor="middle" fontSize={12} fontWeight={700} fill={colors.ink}>
                        {formatTrend(payload.value, key)}
                      </text>
                    )}
                  </g>
                );
              }}
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sub text-ink-2">
        <span className="text-ink-3">점 = 그 시즌 팀 로고{legend.length > 1 ? " · 테두리 있는 큰 점 = 이적한 시즌" : ""}</span>
        {legend.map((l) => (
          <span key={l.team} className="inline-flex items-center gap-1.5">
            <TeamLogo logoUrl={l.logoUrl} shortName={l.team} color={l.color} size={16} />
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
