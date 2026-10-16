"use client";
// 비교 탭 모바일(768px 미만) 좌우 비교 (2026-09-30 피드백 5차 #6): 카드 2장을 세로로 쌓지 않고
// 위 = 두 선수 작은 아바타·이름·시즌(범례 겸용), 가운데 = 두 선수 레이더를 한 차트에 겹쳐(색 2개),
// 아래 = 행마다 "A값 | 항목 | B값" + 가운데에서 양쪽으로 자라는 막대(큰 값 = 1, 우세 쪽은 굵은 글자 + 화살표).
// 색: 두 팀 색(lib/teams comparePairColors — 너무 비슷하면 파랑·주황), 바탕 대비 보정(ensureMarkContrast). B 선은 점선으로도 구분.
// 값·순위·우세 쪽은 lib/cardview compareCardEntries, 막대 비율은 compareBarShares — 여기서는 배치만.
import { useEffect, useRef, useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts";
import { compareBarShares, compareCardEntries, eraCompareRows, radarGeometry, rankShort, type SeasonCardView } from "@/lib/cardview";
import { gradeScore, RADAR_AXES, RADAR_AXIS_LABELS } from "@/lib/metrics";
import { comparePairColors, ensureMarkContrast, FALLBACK_TEAM_COLOR } from "@/lib/teams";
import { IconArrowUp } from "./icons";
import PlayerAvatar from "./PlayerAvatar";
import { PlayerLink } from "./EntityLinks";
import type { ThemeColors } from "./useThemeColors";

interface Props {
  a: SeasonCardView;
  b: SeasonCardView;
  /** "워니 25-26" 꼴 */
  aLabel: string;
  bLabel: string;
  colors: ThemeColors;
  caption: string;
  /** "relative" = 리그 평균 대비 지수로 (2026-10-16 시대 보정) */
  era?: "raw" | "relative";
}

const RADAR_H = 280;
const TICK = { w: 70, h: 30 };

/** 꼭짓점 라벨: 축 이름 + "A등급 · B등급" (글자는 잉크 색, 등급 옆 작은 색 점이 선수 구분) */
function Tick(props: {
  x?: number;
  y?: number;
  payload?: { coordinate: number };
  index?: number;
  a: SeasonCardView;
  b: SeasonCardView;
  ca: string;
  cb: string;
  colors: ThemeColors;
}) {
  const { x = 0, y = 0, payload, a, b, ca, cb, colors } = props;
  const axis = RADAR_AXES[props.index ?? 0];
  if (!axis) return null;
  const rad = ((payload?.coordinate ?? 90) * Math.PI) / 180;
  const bx = x + Math.cos(rad) * (TICK.w / 2 + 2);
  const by = y - Math.sin(rad) * (TICK.h / 2 + 2);
  const top = by - TICK.h / 2;
  return (
    <g>
      <text x={bx} y={top + 12} textAnchor="middle" fontSize={12} fontWeight={700} fill={colors.ink2}>
        {RADAR_AXIS_LABELS[axis]}
      </text>
      {/* deslop-ignore-next-line 24 */}
      <circle cx={bx - 30} cy={top + 23} r={3.5} fill={ca} />
      <text x={bx - 24} y={top + 27} fontSize={12} fontWeight={800} fill={colors.ink} style={{ fontVariantNumeric: "tabular-nums" }}>
        {a.entry.grades[axis]}
        <tspan fontSize={10} fontWeight={600} fill={colors.ink2}>{gradeScore(a.entry.pct[axis]) ?? ""}</tspan>
      </text>
      <rect x={bx + 3} y={top + 19.5} width={7} height={7} fill={cb} />
      <text x={bx + 13} y={top + 27} fontSize={12} fontWeight={800} fill={colors.ink} style={{ fontVariantNumeric: "tabular-nums" }}>
        {b.entry.grades[axis]}
        <tspan fontSize={10} fontWeight={600} fill={colors.ink2}>{gradeScore(b.entry.pct[axis]) ?? ""}</tspan>
      </text>
    </g>
  );
}

function OverlayRadar({ a, b, ca, cb, colors }: { a: SeasonCardView; b: SeasonCardView; ca: string; cb: string; colors: ThemeColors }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(340);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setW(Math.round(el.clientWidth) || 340);
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { outer, cy } = radarGeometry(w, RADAR_H, TICK);
  const data = RADAR_AXES.map((axis) => ({ axis, label: RADAR_AXIS_LABELS[axis], a: a.entry.pct[axis] ?? 0, b: b.entry.pct[axis] ?? 0 }));
  return (
    <div ref={ref} aria-hidden style={{ height: RADAR_H }}>
      <RadarChart width={w} height={RADAR_H} data={data} outerRadius={outer} cx={w / 2} cy={cy} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <PolarGrid stroke={colors.grid} />
        <PolarAngleAxis dataKey="label" tick={(tp: object) => <Tick {...tp} a={a} b={b} ca={ca} cb={cb} colors={colors} />} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar dataKey="a" stroke={ca} strokeWidth={2} fill={ca} fillOpacity={0.16} dot={{ r: 3, fill: ca, stroke: colors.surface, strokeWidth: 2 }} isAnimationActive={false} />
        <Radar
          dataKey="b"
          stroke={cb}
          strokeWidth={2}
          strokeDasharray="5 3"
          fill={cb}
          fillOpacity={0.16}
          dot={{ r: 3, fill: cb, stroke: colors.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </RadarChart>
    </div>
  );
}

function Side({ v, label, color, align }: { v: SeasonCardView; label: string; color: string; align: "left" | "right" }) {
  const p = v.entry.player;
  const teamColor = v.team?.color ?? FALLBACK_TEAM_COLOR;
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      {/* deslop-ignore-next-line 19 */}
      <PlayerLink id={p.id} season={v.seasonCode} tabIndex={-1} aria-label={`${p.nameKo} 선수 페이지`} className="inline-flex shrink-0 rounded-full">
        {/* deslop-ignore-next-line 19 */}
        <span className="inline-flex rounded-full p-0.5" style={{ boxShadow: `0 0 0 2px ${color}` }}>
          <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={teamColor} size={40} />
        </span>
      </PlayerLink>
      <span className="min-w-0">
        <PlayerLink id={p.id} season={v.seasonCode} className="block truncate text-body font-bold leading-tight text-ink hover:underline">
          {p.nameKo}
        </PlayerLink>
        <span className="block truncate text-caption text-ink-3">{label}</span>
      </span>
    </div>
  );
}

export default function CompareHeadToHead({ a, b, aLabel, bLabel, colors, caption, era = "raw" }: Props) {
  const base = compareCardEntries(a.entry, b.entry);
  const rows = era === "relative" ? eraCompareRows(base, a.league, b.league) : base;
  const [ca0, cb0] = comparePairColors(a.team?.color.primary ?? FALLBACK_TEAM_COLOR.primary, b.team?.color.primary ?? FALLBACK_TEAM_COLOR.primary, [
    colors.series1,
    colors.series2,
  ]);
  const ca = ensureMarkContrast(ca0, colors.surface);
  const cb = ensureMarkContrast(cb0, colors.surface);
  // 라벨에서 선수 이름을 빼고 시즌·팀만 (이름은 굵게 따로)
  const sub = (v: SeasonCardView, label: string) => `${label.replace(v.entry.player.nameKo, "").trim()} · ${v.team?.shortName ?? v.entry.player.teamShort}`;

  const value = (text: string, rank: string, win: boolean, align: "left" | "right") => (
    <span className={`min-w-0 ${align === "right" ? "text-right" : "text-left"}`}>
      <span className={`inline-flex items-center gap-0.5 text-body leading-tight ${win ? "font-bold text-ink" : "text-ink-2"}`}>
        {win && align === "right" && <IconArrowUp size={16} />}
        {text}
        {win && align === "left" && <IconArrowUp size={16} />}
        {win && <span className="sr-only">더 나음</span>}
      </span>
      {rank && <span className="block text-caption leading-tight text-ink-3">{rank}</span>}
    </span>
  );

  return (
    <section aria-label={caption} className="surface-card rounded-container p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <Side v={a} label={sub(a, aLabel)} color={ca} align="left" />
        <span className="text-caption font-semibold text-ink-3">vs</span>
        <Side v={b} label={sub(b, bLabel)} color={cb} align="right" />
      </div>

      <div className="mt-2 border-t border-line pt-2">
        <p className="text-sub font-semibold text-ink-2">레이더 6축 등급</p>
        <OverlayRadar a={a} b={b} ca={ca} cb={cb} colors={colors} />
        <p className="text-caption text-ink-3">
          {a.entry.player.nameKo} 실선 · {b.entry.player.nameKo} 점선. 등급은 각자 {a.gradeLabel === b.gradeLabel ? a.gradeLabel : "자기 국적 집단"} 기준.
        </p>
      </div>

      <ul className="tabular mt-2 border-t border-line">
        {rows.map((r) => {
          const bars = compareBarShares(r);
          return (
            <li key={r.key} className={`border-b border-line py-2 last:border-b-0 ${r.key === "overall" ? "bg-surface-2 -mx-3 px-3" : ""}`}>
              <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)] items-center gap-2">
                {value(r.aText, r.aNote ?? rankShort(r.aRank), r.better === "a", "right")}
                <span className="text-center text-sub font-medium leading-tight text-ink-2">
                  {r.label}
                  {r.lowerIsBetter && <span className="block text-caption font-normal text-ink-3">적을수록 좋음</span>}
                </span>
                {value(r.bText, r.bNote ?? rankShort(r.bRank), r.better === "b", "left")}
              </div>
              {bars && (
                <div aria-hidden className="mt-1 grid grid-cols-2 gap-1">
                  <span className="flex justify-end">
                    <span className="block h-1.5 rounded-l" style={{ width: `${bars.a * 100}%`, background: ca, opacity: r.better === "b" ? 0.45 : 1 }} />
                  </span>
                  <span className="flex justify-start">
                    <span className="block h-1.5 rounded-r" style={{ width: `${bars.b * 100}%`, background: cb, opacity: r.better === "a" ? 0.45 : 1 }} />
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-caption leading-relaxed text-ink-3">
        {era === "relative"
          ? "100% = 그 시즌 리그 평균. 작은 숫자는 원래 기록과 그 시즌 평균이에요."
          : "순위·등급은 각자 자기 시즌 안에서 매겼습니다. 시즌이 다르면 값보다 순위·등급을 보세요."}
      </p>
    </section>
  );
}
