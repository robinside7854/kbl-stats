"use client";
// 선수 유형 레이더 카드 (+ 선택적 비교 선수 겹쳐 보기, PNG 저장)
import { useRef, useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { toPng } from "html-to-image";
import type { CardPlayer } from "@/lib/types";
import {
  RADAR_AXES,
  RADAR_AXIS_LABELS,
  type PerGameStats,
  type PlayerType,
  type RadarAxis,
  type RadarPercentiles,
} from "@/lib/metrics";
import type { ThemeColors } from "./useThemeColors";
import { SOURCE_LINE } from "./SourceFooter";

export interface CardEntry {
  player: CardPlayer;
  pct: RadarPercentiles;
  type: PlayerType;
  qualified: boolean;
  perGame: PerGameStats;
}

interface Props {
  a: CardEntry;
  b: CardEntry | null;
  seasonLabel: string;
  ruleLabel: string;
  qualifiedCount: number;
  colors: ThemeColors;
}

const AXIS_HINT: Record<RadarAxis, string> = {
  usgPct: "공격 점유 (공격을 얼마나 끝내나)",
  tsPct: "슈팅 효율 (자유투·3점 반영)",
  astPct: "동료 득점 도움 비율",
  rebPct: "리바운드 점유",
  pie: "경기 전체 기여도",
};

const fmt = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "–");
const fmtPct = (n: number | null) => (n === null ? "–" : Math.round(n).toString());

function SampleBadge() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-ink-2">
      <svg aria-hidden width="10" height="10" viewBox="0 0 10 10">
        <path d="M5 0.8 9.4 9H0.6Z" fill="var(--warn)" />
        <rect x="4.5" y="3.4" width="1" height="3" fill="#0b0b0b" />
        <rect x="4.5" y="7" width="1" height="1" fill="#0b0b0b" />
      </svg>
      표본 부족
    </span>
  );
}

function OriginBadge({ isForeign }: { isForeign: boolean }) {
  return (
    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">
      {isForeign ? "외국인" : "국내"}
    </span>
  );
}

interface TooltipRow {
  axis: RadarAxis;
  label: string;
  a: number;
  b?: number;
}

export default function RadarCard({ a, b, seasonLabel, ruleLabel, qualifiedCount, colors }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const p = a.player;

  // 백분위가 없는 축(비교 집단이 빈 경우)은 0으로 그리되 표에는 "–"
  const data: TooltipRow[] = RADAR_AXES.map((axis) => ({
    axis,
    label: RADAR_AXIS_LABELS[axis],
    a: a.pct[axis] ?? 0,
    ...(b ? { b: b.pct[axis] ?? 0 } : {}),
  }));

  async function save() {
    if (!cardRef.current) return;
    setSaving(true);
    setSaveError(null);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: colors.surface,
        skipFonts: true,
      });
      const link = document.createElement("a");
      link.download = `${p.nameKo}${b ? `_vs_${b.player.nameKo}` : ""}_${seasonLabel}_레이더.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setSaveError("이미지 저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  const stats: [string, string][] = [
    ["경기", String(p.games)],
    ["출전시간", `${fmt(a.perGame.minutes)}분`],
    ["득점", fmt(a.perGame.points)],
    ["리바운드", fmt(a.perGame.reb)],
    ["어시스트", fmt(a.perGame.ast)],
    ["PER", fmt(p.per)],
  ];

  return (
    <div>
      {/* ── 이미지로 저장되는 영역 (출처 줄 포함) ── */}
      <article ref={cardRef} className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-ink-3">
              {seasonLabel} 정규시즌 · {p.teamName}
            </p>
            <h2 className="mt-0.5 text-2xl font-bold leading-tight">{p.nameKo}</h2>
            <p className="text-sm text-ink-2">{p.nameEn}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <OriginBadge isForeign={p.isForeign} />
            {!a.qualified && <SampleBadge />}
          </div>
        </div>

        <p className="mt-3 inline-block rounded-lg bg-surface-2 px-3 py-1.5 text-sm">
          <span className="text-ink-3">유형 </span>
          <strong className="font-semibold text-ink">{a.type.label}</strong>
        </p>

        <dl className="tabular mt-4 grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-6">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] text-ink-3">{k === "경기" || k === "PER" ? k : `경기당 ${k}`}</dt>
              <dd className="text-lg font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        {b && (
          <div className="mt-4 flex flex-col gap-1 text-sm" aria-label="범례">
            <LegendItem color={colors.series1} name={p.nameKo} sub={p.teamShort} />
            <LegendItem
              color={colors.series2}
              name={b.player.nameKo}
              sub={`${b.player.teamShort} · ${b.type.label}`}
              badge={!b.qualified}
            />
          </div>
        )}

        <div className="mx-auto mt-2 h-[280px] w-full max-w-[420px] sm:h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="72%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
              <PolarGrid stroke={colors.grid} />
              <PolarAngleAxis dataKey="label" tick={{ fill: colors.ink2, fontSize: 12, fontWeight: 600 }} />
              <PolarRadiusAxis domain={[0, 100]} tickCount={5} tick={false} axisLine={false} />
              <Radar
                name={p.nameKo}
                dataKey="a"
                stroke={colors.series1}
                strokeWidth={2}
                fill={colors.series1}
                fillOpacity={0.22}
                dot={{ r: 4, fill: colors.series1, stroke: colors.surface, strokeWidth: 2 }}
                isAnimationActive={false}
              />
              {b && (
                <Radar
                  name={b.player.nameKo}
                  dataKey="b"
                  stroke={colors.series2}
                  strokeWidth={2}
                  fill={colors.series2}
                  fillOpacity={0.16}
                  dot={{ r: 4, fill: colors.series2, stroke: colors.surface, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              )}
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as TooltipRow;
                  return (
                    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
                      <p className="font-semibold text-ink">{row.label}</p>
                      <TooltipLine color={colors.series1} name={p.nameKo} raw={p[row.axis]} pct={a.pct[row.axis]} />
                      {b && (
                        <TooltipLine
                          color={colors.series2}
                          name={b.player.nameKo}
                          raw={b.player[row.axis]}
                          pct={b.pct[row.axis]}
                        />
                      )}
                    </div>
                  );
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* 표 보기: 축별 원값 + 백분위 (색 없이도 읽을 수 있게) */}
        <table className="tabular w-full text-sm">
          <caption className="sr-only">축별 원래 값과 시즌 내 백분위</caption>
          <thead>
            <tr className="border-b border-line text-left text-[11px] text-ink-3">
              <th scope="col" className="py-1.5 font-medium">
                지표
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                <span className="inline-flex items-center gap-1">
                  {b && <Swatch color={colors.series1} />}
                  {b ? p.nameKo : "값"}
                </span>
              </th>
              {!b && (
                <th scope="col" className="py-1.5 text-right font-medium">
                  백분위
                </th>
              )}
              {b && (
                <th scope="col" className="py-1.5 text-right font-medium">
                  <span className="inline-flex items-center gap-1">
                    <Swatch color={colors.series2} />
                    {b.player.nameKo}
                  </span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {RADAR_AXES.map((axis) => (
              <tr key={axis} className="border-b border-line last:border-0">
                <th scope="row" className="py-2 text-left font-normal">
                  <span className="font-semibold text-ink">{RADAR_AXIS_LABELS[axis]}</span>
                  <span className="ml-1.5 hidden text-xs text-ink-3 sm:inline">{AXIS_HINT[axis]}</span>
                </th>
                {b ? (
                  <>
                    <td className="py-2 text-right text-ink">
                      {fmt(p[axis])} <span className="text-xs text-ink-3">({fmtPct(a.pct[axis])})</span>
                    </td>
                    <td className="py-2 text-right text-ink">
                      {fmt(b.player[axis])} <span className="text-xs text-ink-3">({fmtPct(b.pct[axis])})</span>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 text-right text-ink">{fmt(p[axis])}</td>
                    <td className="py-2 text-right font-semibold text-ink">{fmtPct(a.pct[axis])}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
          그래프는 원래 값이 아니라 백분위(0~100)입니다. 비교 집단: {seasonLabel} 정규시즌 {ruleLabel} {qualifiedCount}명
          {b ? " · 괄호 안은 백분위" : ""}. 2차 스탯은 KBL 계산값 그대로입니다(NBA 공식과 척도가 다를 수 있음).
        </p>
        <p className="mt-2 border-t border-line pt-2 text-[11px] font-medium text-ink-2">{SOURCE_LINE}</p>
      </article>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "저장 중…" : "이미지 저장"}
        </button>
        {saveError && (
          <p role="alert" className="text-sm text-ink-2">
            {saveError}
          </p>
        )}
      </div>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />;
}

function LegendItem({ color, name, sub, badge }: { color: string; name: string; sub: string; badge?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Swatch color={color} />
      <span className="shrink-0 whitespace-nowrap font-semibold text-ink">{name}</span>
      <span className="min-w-0 truncate text-ink-3">{sub}</span>
      {badge && (
        <span className="shrink-0">
          <SampleBadge />
        </span>
      )}
    </span>
  );
}

function TooltipLine({ color, name, raw, pct }: { color: string; name: string; raw: number; pct: number | null }) {
  return (
    <p className="tabular mt-1 flex items-center gap-1.5 text-ink-2">
      <Swatch color={color} />
      <span className="text-ink">{name}</span>
      <span>
        {fmt(raw)} · 백분위 {fmtPct(pct)}
      </span>
    </p>
  );
}
