"use client";
// 득점왕 레이스 (2026-10-16): 리더보드 1~3위 표지 아래. 고른 부문(득점·리바·어시·스틸·블록·3점 — 아니면 득점)의 지금 상위 5명이
// 경기일마다 "그날까지 경기당 평균"이 어떻게 움직였는지 선 5개(Recharts LineChart). 재료·규칙은 lib/race(빌드 때 lib/data-race 가 계산).
// - 색: 범주형 팔레트 --cat-1…5 를 지금 순위 순서로(팀 색은 같은 팀 두 명·비슷한 팀 색이 겹쳐서 쓰지 않는다 — dataviz 검증기 통과 5색).
//   선 색만으로 구분하지 않게 아래 범례에 순위·이름·팀 로고·지금 값을 같이 둔다(표 대신).
// - 선은 그 선수가 3경기 이상 뛴 날부터. 마지막 점에 표면 색 고리 점, 1위만 끝에 값 표기.
// - 점을 누르거나(모바일) 올리면 그날 다섯 명 값(큰 순). 새 GA4 이벤트 없음(부문은 리더보드 부문 칩 filter_change 를 따른다, ⓘ 는 help_open topic=race).
import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ScoringRaces } from "@/lib/data-race";
import { isRaceCategory, RACE_LABELS, RACE_MIN_GAMES, raceDateTick, type RaceCategory } from "@/lib/race";
import { gameDayLabel } from "@/lib/games";
import { teamShortLabel } from "@/lib/images";
import type { CardTeam } from "@/lib/types";
import InfoLink from "./InfoLink";
import { PlayerLink } from "./EntityLinks";
import TeamLogo from "./TeamLogo";
import { useThemeColors } from "./useThemeColors";

interface Props {
  data: ScoringRaces;
  /** 리더보드에서 고른 부문 (레이스 부문이 아니면 득점) */
  category: string;
  teams: Map<string, CardTeam>;
  seasonCode: number;
  ongoing: boolean;
}

const fmt = (v: number, cat: RaceCategory) => (cat === "points" || cat === "reb" ? v.toFixed(1) : v.toFixed(2));

export default function ScoringRace({ data, category, teams, seasonCode, ongoing }: Props) {
  const colors = useThemeColors();
  const cat: RaceCategory = isRaceCategory(category) && data.races[category] ? category : data.races.points ? "points" : (Object.keys(data.races)[0] as RaceCategory);
  const race = data.races[cat];
  const rows = useMemo(
    () =>
      race
        ? data.dates.map((date, d) => {
            const o: Record<string, number | string | null> = { date, tick: raceDateTick(date) };
            race.values.forEach((row, i) => (o[`l${i}`] = row[d]));
            return o;
          })
        : [],
    [data.dates, race],
  );
  if (!race) return null;
  const lineColor = (i: number) => colors.categorical[i % colors.categorical.length];
  const last = data.dates.length - 1;
  const label = RACE_LABELS[cat];

  return (
    <section aria-labelledby="race-title" className="surface-card mt-6 rounded-container p-3 sm:p-4">
      <h2 id="race-title" className="flex items-center text-h2 font-bold">
        {label} 레이스
        <InfoLink term="race" className="ml-1" />
      </h2>
      <p className="mt-0.5 text-sub text-ink-3">
        {ongoing ? "지금" : "시즌 끝"} {label} 상위 5명 · 경기일마다 그날까지 경기당 평균
      </p>
      {race.takeaway && <p className="mt-2 text-body font-semibold text-ink break-keep">{race.takeaway}</p>}

      <div aria-hidden className="mt-2 h-60 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 340, height: 240 }}>
          <LineChart data={rows} margin={{ top: 16, right: 36, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke={colors.grid} strokeWidth={1} />
            <XAxis
              dataKey="tick"
              tick={{ fill: colors.ink3, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: colors.grid }}
              interval="preserveStartEnd"
              minTickGap={18}
            />
            <YAxis
              width={36}
              domain={["auto", "auto"]}
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
                const row = active && payload?.[0] ? (payload[0].payload as Record<string, number | string | null>) : null;
                if (!row) return null;
                const list = race.lines
                  .map((l, i) => ({ l, i, v: row[`l${i}`] as number | null }))
                  .filter((x) => x.v !== null)
                  .sort((a, b) => b.v! - a.v!);
                return (
                  <div className="surface-card tabular rounded-control px-2.5 py-1.5 text-sub">
                    <p className="font-semibold text-ink">{gameDayLabel(String(row.date))}까지</p>
                    {list.length === 0 ? (
                      <p className="text-ink-3">아직 {RACE_MIN_GAMES}경기 뛴 선수가 없어요</p>
                    ) : (
                      <ul className="mt-0.5 space-y-0.5">
                        {list.map((x) => (
                          <li key={x.l.id} className="flex items-center gap-1.5 text-ink-2">
                            <span aria-hidden className="inline-block h-0.5 w-3 rounded-sm" style={{ background: lineColor(x.i) }} />
                            <span className="min-w-0 flex-1 truncate">{x.l.nameKo}</span>
                            <span className="font-bold text-ink">{fmt(x.v!, cat)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              }}
            />
            {race.lines.map((l, i) => (
              <Line
                key={l.id}
                type="linear"
                dataKey={`l${i}`}
                stroke={lineColor(i)}
                strokeWidth={i === 0 ? 2.5 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
                connectNulls={false}
                isAnimationActive={false}
                activeDot={{ r: 4, stroke: colors.surface, strokeWidth: 2 }}
                dot={(props: { cx?: number; cy?: number; index?: number }) => {
                  const { cx, cy, index = 0 } = props;
                  if (index !== last || cx == null || cy == null) return <g key={`d${i}-${index}`} />;
                  return (
                    <g key={`d${i}-${index}`}>
                      <circle cx={cx} cy={cy} r={4.5} fill={lineColor(i)} stroke={colors.surface} strokeWidth={2} />
                      {i === 0 && (
                        <text x={cx + 7} y={cy + 4} fontSize={12} fontWeight={700} fill={colors.ink} style={{ fontVariantNumeric: "tabular-nums" }}>
                          {fmt(l.value, cat)}
                        </text>
                      )}
                    </g>
                  );
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 범례 = 지금 순위표 (색만으로 구분하지 않게 순위·이름·팀·값) */}
      <ol className="tabular mt-2 grid gap-x-4 sm:grid-cols-2 xl:grid-cols-5">
        {race.lines.map((l, i) => {
          const team = teams.get(l.teamCode);
          return (
            <li key={l.id} className="flex min-h-10 min-w-0 items-center gap-2 border-b border-line text-sub last:border-b-0 sm:border-b-0">
              <span aria-hidden className="inline-block h-1 w-4 shrink-0 rounded-sm" style={{ background: lineColor(i) }} />
              <span className="w-4 shrink-0 text-center font-semibold text-ink-3">{i + 1}</span>
              <TeamLogo logoUrl={team?.logoUrl} shortName={team?.shortName ?? l.teamCode} color={team?.color} size={18} />
              <PlayerLink id={l.id} season={seasonCode} className="min-w-0 truncate font-semibold text-ink">
                {l.nameKo}
              </PlayerLink>
              <span className="sr-only">{teamShortLabel(team?.shortName ?? "")}</span>
              <span className="ml-auto shrink-0 font-bold text-ink">{fmt(l.value, cat)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
