"use client";
// 플레이어 카드 한 장 (게임 카드처럼): 팀 색 상단 + 큰 사진 + 종합 등급 → 메인 스탯 9개(시즌 순위) + 파울·출전 줄
// → 레이더 6축(공격·수비·리바운드·슈팅·리딩·효율) + 축별 등급(S~F). 순위는 리그 전체(또는 같은 포지션), 등급은 같은 국적 집단 안. 값·순위·백분위·등급 계산은 전부 lib/metrics.ts·lib/cardview.ts — 이 파일은 배치와 표기만 맡는다.
// 입력은 lib/cardview buildSeasonCardView 결과(SeasonCardView) 하나: 시즌·순위 범위(전체/같은 포지션)·팀 색·로고가 그 시즌 것.
// 사진은 선수당 한 장(시즌별 사진이 없다)이라 어느 시즌 카드든 같은 사진을 쓰고, 팀 색·로고만 그 시즌 것을 쓴다.
// size: "sm"(모바일, 폭 100%) / "lg"(PC·저장 이미지, 폭 약 500px) — 글자·사진·격자·레이더를 비례해 키운다.
// layout: "vertical"(세로 카드 — 모바일·비교 탭·저장 이미지) / "horizontal"(PC 1024px 이상 선수 상세, 2026-09-30 피드백 5차 #1):
//   왼쪽 = 팀 색 + 큰 세로 사진 + 이름·소속·포지션·배지·종합 등급, 가운데 = 스탯 3×3 + 파울·출전 줄, 오른쪽 = 레이더.
//   1280×800 한 화면에 들어가게 높이 520px 이하(실측은 PLAN.md §13). 치수는 DIM.h.
// ⓘ(종합 등급·등급 기준)와 유형 라벨은 그 자리 팝오버(HelpPopover) — 용어 페이지로 이동하지 않는다.
// exportMode(이미지 저장 사본)에서는 공식 사진·로고를 쓰지 않고 대체 디자인(팀 색·이니셜·약칭)으로 그린다.
import { seasonShortLabel } from "@/lib/career";
import { useEffect, useRef, useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts";
import Link from "next/link";
import type { CardPlayer, TeamColor } from "@/lib/types";
import { cardFootStats, radarGeometry, rankHeading, rankPhrase, type SeasonCardView } from "@/lib/cardview";
import { CAREER_CODE } from "@/lib/career-cards";
import { offenseTypeDef, playerTypeHelp } from "@/lib/glossary";
import { nationalityOf, NATIONALITY_LABELS, positionLabel } from "@/lib/roster";
import {
  RADAR_AXES,
  RADAR_AXIS_LABELS,
  RADAR_COMPONENTS,
  rankTier,
  topShareLabel as topShare,
  gradeScore,
  type CardEntryOf,
  type CardStatEntry,
  type Grade,
  type RadarAxis,
  type RankTier,
} from "@/lib/metrics";
import { mixHex, teamShortLabel } from "@/lib/images";
import { desaturate, FALLBACK_TEAM_COLOR, gradeTone, readableInk } from "@/lib/teams";
import HelpPopover from "./HelpPopover";
import { IconInfo } from "./icons";
import PlayerAvatar from "./PlayerAvatar";
import Skeleton from "./Skeleton";
import TeamLogo from "./TeamLogo";
import { TeamLink } from "./EntityLinks";
import type { ThemeColors } from "./useThemeColors";
import { SOURCE_LINE } from "./SourceFooter";

/** 카드 한 장의 값 (lib/metrics buildCardEntry 결과) */
export type CardEntry = CardEntryOf<CardPlayer>;

export type CardSize = "sm" | "lg";
export type CardLayout = "vertical" | "horizontal";

interface Props {
  /** 카드 한 장의 값 — 시즌·순위 범위·팀 (lib/cardview buildSeasonCardView) */
  view: SeasonCardView;
  colors: ThemeColors;
  size?: CardSize;
  /** 레이더 선 색 (비교 시 선수 구분: series1 / series2) */
  seriesColor: string;
  /** 이미지 저장 사본: 공식 이미지 없이 대체 디자인만 */
  exportMode?: boolean;
  /** 이름에 걸 링크 (없으면 링크 없음 — 선수 페이지 안의 카드·저장 사본) */
  nameHref?: string;
  /** 세로(기본) / 가로(PC 선수 상세). 저장 사본은 늘 세로 */
  layout?: CardLayout;
}

const FALLBACK_COLOR: TeamColor = FALLBACK_TEAM_COLOR;

const NF1 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt1 = (n: number) => (Number.isFinite(n) ? NF1.format(n) : "–");
const fmtPct = (n: number | null | undefined) => (n === null || n === undefined ? "–" : Math.round(n).toString());

/** 크기별 치수 (px). lg 는 sm 의 약 1.3배 */
const DIM = {
  sm: { header: 226, photo: 208, logo: 40, name: 28, nameEn: 12, statVal: 22, statPct: 13, statLabel: 12, rank: 12, ovr: 34, radarH: 316, gradeChip: 26, tickLabel: 11, tickValue: 10.5, pad: 12 },
  lg: { header: 296, photo: 276, logo: 52, name: 36, nameEn: 13, statVal: 29, statPct: 16, statLabel: 13, rank: 13.5, ovr: 46, radarH: 380, gradeChip: 34, tickLabel: 13, tickValue: 11.5, pad: 16 },
  // 가로 카드(PC): header 는 쓰지 않고(왼쪽 판이 카드 높이를 채움) 사진 높이만. 레이더 높이는 오른쪽 열 폭에 맞춘다
  h: { header: 0, photo: 330, logo: 46, name: 34, nameEn: 13, statVal: 27, statPct: 15, statLabel: 13, rank: 13, ovr: 42, radarH: 340, gradeChip: 30, tickLabel: 13, tickValue: 11.5, pad: 16 },
} as const;
type Dim = (typeof DIM)[keyof typeof DIM];
/** 가로 카드 열 폭 (왼쪽 판 · 오른쪽 레이더). 가운데 스탯 열이 나머지 */
const H_LEFT = 280;
const H_RIGHT = 320;

/** 레이더 꼭짓점 라벨 상자 크기 (GradeTick 과 같은 계산 — 차트 배치 radarGeometry 입력) */
function tickBlock(d: Dim): { w: number; h: number } {
  return { w: Math.max(d.gradeChip, d.tickLabel * 4.6), h: d.gradeChip + 4 + d.tickLabel + 2 + d.tickValue };
}

/** 요소 폭 (ResizeObserver). 첫 렌더·정적 HTML 은 fallback */
function useWidth<T extends HTMLElement>(fallback: number): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setW(Math.round(el.clientWidth) || fallback);
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, w];
}
/** lg 카드 폭 (저장 이미지·PC 한 장 보기) */
export const CARD_LG_WIDTH = 500;

// ─────────────────────────────────────────────
// 순위 표시
// ─────────────────────────────────────────────

/** 금·은·동 메달 색 (바탕·테두리·숫자). 이모지 대신 SVG — 이미지 저장 시 이모지 폰트 문제 회피.
 *  채도를 원래 값에서 20% 낮췄다(lib/teams desaturate, 디자인 점검 B5). 은색은 화면 회색 계열(따뜻한 회색)에 맞췄다.
 *  메달 옆에는 항상 "n위" 글자가 붙는다(색만으로 순위를 전하지 않는다). */
const MEDAL: Record<"gold" | "silver" | "bronze", { fill: string; ring: string; ink: string; name: string }> = {
  gold: { fill: "#ebcb6f", ring: "#b08b48", ink: "#3f2e00", name: "금메달" },
  silver: { fill: "#dcdad4", ring: "#8f8d86", ink: "#2f2e2b", name: "은메달" },
  bronze: { fill: "#d59e77", ring: "#925f3c", ink: "#3a1f0a", name: "동메달" },
};

function Medal({ tier, rank, px }: { tier: "gold" | "silver" | "bronze"; rank: number; px: number }) {
  const m = MEDAL[tier];
  return (
    <svg aria-hidden width={px} height={px} viewBox="0 0 18 18" className="shrink-0">
      {/* deslop-ignore-next-line 24 */}
      <circle cx="9" cy="9" r="8" fill={m.fill} stroke={m.ring} strokeWidth="1.5" />
      {/* deslop-ignore-next-line 24 */}
      <circle cx="9" cy="9" r="5.6" fill="none" stroke={m.ring} strokeOpacity="0.45" strokeWidth="0.8" />
      <text x="9" y="12.4" textAnchor="middle" fontSize="9.5" fontWeight="800" fill={m.ink}>
        {rank}
      </text>
    </svg>
  );
}

function RankLine({ entry, color, fs, group }: { entry: CardStatEntry; color: TeamColor; fs: number; group: string | null }) {
  const r = entry.rank;
  const small = { fontSize: fs - 1 };
  if (r.reason === "unranked") return null;
  if (r.rank === null) {
    return (
      <span className="font-medium text-ink-3" style={small}>
        {r.reason === "sample" ? "표본 미달" : "시도 부족"}
      </span>
    );
  }
  const tier = rankTier(r.rank);
  const of = (
    <span className="text-ink-3" style={{ fontSize: fs - 2 }}>
      /{r.of}
    </span>
  );
  if (tier === "gold" || tier === "silver" || tier === "bronze") {
    return (
      <span className="inline-flex items-center gap-1" aria-label={`${MEDAL[tier].name} ${rankPhrase(r.rank, r.of, group)}`}>
        <Medal tier={tier} rank={r.rank} px={Math.round(fs * 1.5)} />
        <span className="font-bold text-ink" style={{ fontSize: fs }}>
          {r.rank}위
        </span>
        {of}
      </span>
    );
  }
  if (tier === "top10") {
    const tagBg = desaturate(color.primary, 0.2);
    return (
      <span className="inline-flex items-center gap-1" aria-label={rankPhrase(r.rank, r.of, group)}>
        <span
          className="rounded px-1.5 py-px font-bold"
          style={{ fontSize: fs - 1, lineHeight: 1.35, background: tagBg, color: readableInk(tagBg, color.text), boxShadow: "0 0 0 1px var(--rank-pill-ring)" }}
        >
          {r.rank}위
        </span>
        {of}
      </span>
    );
  }
  return (
    <span className="text-ink-2" style={small} aria-label={rankPhrase(r.rank, r.of, group)}>
      {r.rank}위{of}
    </span>
  );
}

/** 1~10위 칸 배경: 팀 색을 표면 색에 옅게 섞는다 (농도는 globals.css --rank-tint, 다크 모드에서 더 진하게) */
function cellStyle(tier: RankTier, color: TeamColor): React.CSSProperties | undefined {
  if (!tier) return undefined;
  const team = desaturate(color.primary, 0.2);
  return {
    background: `color-mix(in srgb, ${team} var(--rank-tint), var(--surface))`,
    borderColor: `color-mix(in srgb, ${team} var(--rank-border), var(--surface))`,
  };
}

function StatCell({ entry, color, d, roomy, group }: { entry: CardStatEntry; color: TeamColor; d: Dim; roomy: boolean; group: string | null }) {
  const { def, value } = entry;
  const tier = rankTier(entry.rank.rank);
  return (
    <div
      className={`flex min-w-0 flex-col rounded-card border border-line ${roomy ? "px-2.5 py-2" : "px-2 py-1.5"}`}
      style={cellStyle(tier, color)}
    >
      <span className="truncate font-medium text-ink-2" style={{ fontSize: d.statLabel }}>
        {def.label}
      </span>
      <span className="font-bold tracking-tight text-ink" style={{ fontSize: d.statVal, lineHeight: 1.25 }}>
        {fmt1(value)}
        {def.kind === "pct" && (
          <span className="ml-px font-semibold" style={{ fontSize: d.statPct }}>
            %
          </span>
        )}
      </span>
      <span className="mt-0.5 flex items-center" style={{ height: Math.round(d.rank * 1.5) }}>
        <RankLine entry={entry} color={color} fs={d.rank} group={group} />
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// 등급 (S~F) 색 — lib/teams gradeTone (S 금색, A 팀 색, B 팀 색 옅게, C 이하 무채색, 채도 20% 낮춤, 글자 4.5:1)
// 레이더(SVG) 안에서도 쓰므로 hex 로 넘긴다(useThemeColors).
// ─────────────────────────────────────────────

/** 레이더 꼭짓점 라벨: 등급 칩(크게) + 축 이름 + 원래 값(작게). 꼭짓점 바깥쪽으로 밀어 그린다 */
/** 축 구성 요소 한 줄 설명 (툴팁·표 보기), 예: "경기당 득점 25.1 (92) · USG% 30.2 (88)" — 빠진 항목은 "제외" */
function componentsText(entry: CardEntry, axis: RadarAxis): string {
  return entry.radar.components[axis]
    .map((c) => `${RADAR_COMPONENTS[c.key].label} ${fmt1(c.value)} (${c.pct === null ? "시도 부족 제외" : fmtPct(c.pct)})`)
    .join(" · ");
}

function GradeTick(props: {
  x?: number;
  y?: number;
  payload?: { value: string; coordinate: number; index?: number };
  index?: number;
  axes: readonly RadarAxis[];
  entry: CardEntry;
  color: TeamColor;
  colors: ThemeColors;
  d: Dim;
}) {
  const { x = 0, y = 0, payload, axes, entry, color, colors, d } = props;
  const idx = props.index ?? payload?.index ?? 0;
  const axis = axes[idx];
  if (!axis) return null;
  const grade = entry.grades[axis] ?? "-";
  const tone = gradeTone(grade, color, colors);
  const chip = d.gradeChip;
  const { w: blockW, h: blockH } = tickBlock(d);
  // 꼭짓점 각도(도, 반시계·오른쪽 0) → 바깥쪽 단위 벡터. 블록 중심을 바깥으로 반 칸 민다
  const rad = ((payload?.coordinate ?? 90) * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = -Math.sin(rad);
  const bx = x + ux * (blockW / 2 + 2);
  const by = y + uy * (blockH / 2 + 2);
  const top = by - blockH / 2;
  // 꼭짓점 아래 숫자 = 등급 점수(1~99, 백분위 기준 — lib/metrics gradeScore)
  const score = gradeScore(entry.pct[axis]);
  const raw = score === null ? "–" : String(score);
  return (
    <g>
      <title>{`${RADAR_AXIS_LABELS[axis]} ${grade} ${raw}점(99점 만점) — ${componentsText(entry, axis)}`}</title>
      <rect
        x={bx - chip / 2}
        y={top}
        width={chip}
        height={chip}
        rx={chip * 0.26}
        fill={tone.bg}
        stroke={tone.border}
        strokeWidth={1.5}
      />
      <text
        x={bx}
        y={top + chip * 0.74}
        textAnchor="middle"
        fontSize={chip * 0.68}
        fontWeight={900}
        fill={tone.ink}
       
      >
        {grade}
      </text>
      <text x={bx} y={top + chip + 3 + d.tickLabel * 0.9} textAnchor="middle" fontSize={d.tickLabel} fontWeight={700} fill={colors.ink2}>
        {RADAR_AXIS_LABELS[axis]}
      </text>
      <text
        x={bx}
        y={top + chip + 5 + d.tickLabel + d.tickValue * 0.9}
        textAnchor="middle"
        fontSize={d.tickValue}
        fontWeight={700}
        fill={colors.ink2}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {raw}
      </text>
    </g>
  );
}

// ─────────────────────────────────────────────
// 배지
// ─────────────────────────────────────────────

function HeroBadge({ children, fs }: { children: React.ReactNode; fs: number }) {
  return (
    <span className="whitespace-nowrap rounded-control px-2 py-0.5 font-semibold" style={{ background: "rgba(255,255,255,0.18)", fontSize: fs }}>
      {children}
    </span>
  );
}

/** 헤더의 종합 등급 (게임 카드의 OVR 자리). 표본 미달이면 등급 대신 "표본 미달" */
function OverallBadge({
  entry,
  color,
  colors,
  d,
}: {
  entry: CardEntry;
  color: TeamColor;
  colors: ThemeColors;
  d: Dim;
}) {
  if (!entry.qualified) {
    return (
      <span
        className="inline-flex flex-col items-center justify-center rounded-control px-2 text-center font-bold leading-tight"
        style={{ height: d.logo + 8, background: "rgba(0,0,0,0.3)", fontSize: d.statLabel, boxShadow: "0 0 0 2px rgba(255,255,255,0.6)" }}
        aria-label="종합 등급: 표본 미달"
      >
        <span style={{ fontSize: d.statLabel - 2, opacity: 0.8 }}>종합</span>
        표본 미달
      </span>
    );
  }
  const tone = gradeTone(entry.overall, color, colors);
  return (
    <span
      className="inline-flex flex-col items-center justify-center rounded-control"
      style={{
        width: d.logo + 8,
        height: d.logo + 8,
        background: tone.bg,
        color: tone.ink,
        boxShadow: "0 0 0 2px rgba(255,255,255,0.85)",
      }}
      aria-label={`종합 등급 ${entry.overall} ${gradeScore(entry.overallPct) ?? "–"}점${topShare(entry.overallPct) ? `, ${entry.gradeGroup.label} ${topShare(entry.overallPct)}` : ""}`}
      title={topShare(entry.overallPct) ? `${entry.gradeGroup.label} ${topShare(entry.overallPct)}` : undefined}
    >
      <span className="font-bold leading-none" style={{ fontSize: Math.round(d.statLabel * 0.8), opacity: 0.85 }}>
        종합
      </span>
      <span className="font-black leading-none" style={{ fontSize: d.ovr * 0.72 }}>
        {entry.overall}
      </span>
      {/* 종합 점수 (1~99) */}
      <span className="tabular font-bold leading-none" style={{ fontSize: Math.round(d.statLabel * 0.85) }}>
        {gradeScore(entry.overallPct) ?? "–"}
      </span>
    </span>
  );
}


// ─────────────────────────────────────────────
// 불러오는 중 카드 (디자인 점검 C3) — 같은 크기(DIM)의 머리·3×3 격자·레이더 자리
// ─────────────────────────────────────────────

export function PlayerCardSkeleton({ size = "sm", layout = "vertical" }: { size?: CardSize; layout?: CardLayout }) {
  const horizontal = layout === "horizontal";
  const d: Dim = horizontal ? DIM.h : DIM[size];
  const roomy = horizontal || size === "lg";
  const cellH = Math.round(d.statLabel * 1.45 + d.statVal * 1.25 + d.rank * 1.5 + (roomy ? 20 : 16));
  const grid = (
    <div style={{ padding: d.pad }}>
      <Skeleton className="mb-2 h-4 w-32" />
      <div className={`grid grid-cols-3 ${roomy ? "gap-2" : "gap-1.5"}`}>
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="rounded-card" style={{ height: cellH }} />
        ))}
      </div>
      <Skeleton className="mt-2 h-4 w-48" />
    </div>
  );
  const radar = (
    <div style={{ padding: d.pad }}>
      <Skeleton className="h-4 w-40" />
      <div className="flex items-center justify-center" style={{ height: d.radarH }}>
        <Skeleton className="rounded-card" style={{ width: d.radarH * 0.62, height: d.radarH * 0.62 }} />
      </div>
    </div>
  );
  if (horizontal) {
    return (
      <div aria-hidden className="surface-card grid w-full overflow-hidden rounded-container" style={{ gridTemplateColumns: `${H_LEFT}px minmax(0,1fr) ${H_RIGHT}px` }}>
        <Skeleton className="row-span-2 rounded-none" style={{ minHeight: 440 }} />
        {grid}
        <div className="border-l border-line">{radar}</div>
        <div className="col-span-2 border-t border-line" style={{ padding: d.pad }}>
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    );
  }
  return (
    <div aria-hidden className="surface-card w-full overflow-hidden rounded-container">
      <Skeleton className="rounded-none" style={{ height: d.header }} />
      {grid}
      <div className="border-t border-line">{radar}</div>
      <div className="border-t border-line" style={{ padding: d.pad }}>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="mt-1.5 h-3 w-2/3" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 레이더 (폭을 재서 반지름·중심을 정한다 — 6개 꼭짓점 라벨·등급 칩이 차트 밖으로 나가지 않게, lib/cardview radarGeometry)
// ─────────────────────────────────────────────

function CardRadar({
  entry,
  color,
  colors,
  d,
  seriesColor,
  fixedWidth,
}: {
  entry: CardEntry;
  color: TeamColor;
  colors: ThemeColors;
  d: Dim;
  seriesColor: string;
  /** 저장 사본처럼 폭이 정해진 경우 (재지 않는다) */
  fixedWidth?: number;
}) {
  const [ref, measured] = useWidth<HTMLDivElement>(fixedWidth ?? 320);
  const width = fixedWidth ?? measured;
  const { outer, cy } = radarGeometry(width, d.radarH, tickBlock(d));
  const radarData = RADAR_AXES.map((axis) => ({ axis, label: RADAR_AXIS_LABELS[axis], v: entry.pct[axis] ?? 0 }));
  return (
    <div ref={ref} aria-hidden style={{ height: d.radarH }}>
      <RadarChart width={width} height={d.radarH} data={radarData} outerRadius={outer} cx={width / 2} cy={cy} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <PolarGrid stroke={colors.grid} />
        <PolarAngleAxis
          dataKey="label"
          tick={(tp: object) => <GradeTick {...tp} axes={RADAR_AXES} entry={entry} color={color} colors={colors} d={d} />}
        />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          dataKey="v"
          stroke={seriesColor}
          strokeWidth={2}
          fill={seriesColor}
          fillOpacity={0.22}
          dot={{ r: d.radarH >= 340 ? 4 : 3, fill: seriesColor, stroke: colors.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </RadarChart>
    </div>
  );
}

// ─────────────────────────────────────────────
// 카드
// ─────────────────────────────────────────────

export default function PlayerCard({ view, colors, size = "sm", seriesColor, exportMode = false, nameHref, layout = "vertical" }: Props) {
  const { entry, seasonLabel, ruleLabel, qualifiedCount, attemptsLabel, groupLabel, gradeLabel, missingComponents, overallNote, awardNote } = view;
  const team = view.team ?? undefined;
  const p = entry.player;
  const foot = cardFootStats(p);
  const pos = positionLabel(p.position);
  // 저장 사본은 늘 세로
  const horizontal = layout === "horizontal" && !exportMode;
  const d: Dim = horizontal ? DIM.h : DIM[size];
  const roomy = horizontal || size === "lg";
  const small = roomy ? 12.5 : 11;
  const color = team?.color ?? FALLBACK_COLOR;
  // 상단 그라데이션: 팀 primary → 검정 쪽으로 어둡게. 이름이 놓이는 아래쪽이 가장 어둡다 (글자는 color.text)
  const dark = mixHex(color.primary, "#000000", 0.62);
  const mid = mixHex(color.primary, "#000000", 0.3);
  const official = !exportMode;
  // 통산 카드(시즌 코드 0)는 팀 코드가 "마지막시즌-팀코드" 꼴 (lib/career-cards) — 팀 페이지는 뒤 코드로
  const teamPageCode = view.seasonCode === 0 ? p.teamCode.split("-").pop() ?? null : p.teamCode;
  const teamShort = team?.shortName ?? p.teamShort;
  const offense = p.offenseType ? offenseTypeDef(p.offenseType).label : null;

  // ── 팀 색 판 (세로 카드 위쪽 / 가로 카드 왼쪽) ──
  const hero = (
    <div
      className={`relative overflow-hidden ${horizontal ? "row-span-2 h-full" : ""}`}
      style={{
        height: horizontal ? undefined : d.header,
        minHeight: horizontal ? 420 : undefined,
        background: `linear-gradient(165deg, ${color.primary} 0%, ${mid} 55%, ${dark} 100%)`,
        color: color.text,
      }}
    >
      {/* 장식: 팀 약칭 큰 글씨 */}
      <span
        aria-hidden
        // deslop-ignore-next-line 11
        className="pointer-events-none absolute -right-2 top-1 select-none whitespace-nowrap font-black leading-none tracking-tighter"
        style={{ opacity: 0.1, fontSize: Math.round((horizontal ? 300 : d.header) * 0.39) }}
      >
        {teamShortLabel(teamShort, 5)}
      </span>

      {/* 사진: 오른쪽 아래에 붙여 하단이 카드 경계에 걸치게 */}
      <div className={`absolute bottom-0 ${horizontal ? "right-0" : "right-1"}`}>
        {nameHref && !exportMode ? (
          <Link href={nameHref} tabIndex={-1} aria-hidden className="block">
            <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={color} variant="portrait" size={d.photo} official={official} />
          </Link>
        ) : (
          <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={color} variant="portrait" size={d.photo} official={official} />
        )}
      </div>

      {/* 좌상단: 로고 + 종합 등급 · 시즌 · 유형 */}
      <div className="absolute flex max-w-[60%] flex-col items-start gap-1.5" style={{ left: d.pad + 2, top: d.pad + 2 }}>
        <div className="flex items-center gap-2">
          {/* 팀 로고를 누르면 팀 페이지 그 시즌 (2026-10-14, 저장 이미지는 링크 없음) */}
          <TeamLink code={exportMode ? null : teamPageCode} season={view.seasonCode || null} place="player_card" aria-label={`${teamShort} 팀 페이지`} className="inline-flex rounded-control bg-white p-1 shadow-card hover:no-underline">
            <TeamLogo logoUrl={team?.logoUrl} shortName={teamShort} color={color} size={d.logo} official={official} />
          </TeamLink>
          <OverallBadge entry={entry} color={color} colors={colors} d={d} />
          {!exportMode && (
            <HelpPopover
              term="radarAxes"
              ariaLabel="종합 등급 계산 방법"
              className="-mx-2 inline-flex h-10 w-10 items-center justify-center rounded-control transition-colors duration-200 hover:bg-black/15"
              style={{ color: color.text }}
            >
              <IconInfo size={16} />
            </HelpPopover>
          )}
        </div>
        <span className="font-medium" style={{ opacity: 0.85, fontSize: d.statLabel }}>
          {seasonShortLabel(seasonLabel)} 정규시즌
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {exportMode ? (
            <span className="rounded-control px-2 py-1 font-bold leading-tight" style={{ background: "rgba(0,0,0,0.28)", fontSize: d.statLabel + 1 }}>
              {entry.type.label}
            </span>
          ) : (
            // 유형 라벨을 누르면 그 자리에서 조건 팝오버 (라벨·조건은 lib/glossary PLAYER_TYPES)
            <HelpPopover
              content={playerTypeHelp(entry.type.key)}
              ariaLabel={`선수 유형 ${entry.type.label} — 유형 라벨 기준 보기`}
              className="inline-flex min-h-10 items-center gap-1 rounded-control px-2 text-left font-bold leading-tight underline-offset-4 transition-colors duration-200 hover:underline"
              style={{ background: "rgba(0,0,0,0.28)", fontSize: d.statLabel + 1, color: color.text }}
            >
              {entry.type.label}
              <IconInfo size={16} />
            </HelpPopover>
          )}
          {/* 주 공격 유형 (슛 구역 비중, lib/shots offenseType) — 있을 때만 작은 칩. 설명은 선수 상세 슛 차트 섹션의 팝오버에 */}
          {offense && (
            <span
              className="rounded-control border px-1.5 py-0.5 font-semibold leading-tight"
              style={{ borderColor: "currentColor", background: "rgba(0,0,0,0.18)", fontSize: d.statLabel }}
              aria-label={`주 공격 유형 ${offense}`}
            >
              {offense}
            </span>
          )}
        </div>
      </div>

      {/* 하단: 이름 (사진 아래쪽을 덮는 어두운 띠 위). 띠 위쪽 투명 부분이 유형 라벨 버튼을 덮지 않게 누르기는 통과시키고 이름 링크만 받는다 */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 pt-10"
        // deslop-ignore-next-line 06
        style={{ paddingLeft: d.pad + 2, paddingRight: d.pad + 2, paddingBottom: d.pad, background: `linear-gradient(to top, ${dark} 0%, ${dark}e6 40%, ${dark}00 100%)` }}
      >
        <div className="mb-1 flex flex-wrap gap-1">
          <HeroBadge fs={d.statLabel}>{NATIONALITY_LABELS[nationalityOf(p)]}</HeroBadge>
          {pos && <HeroBadge fs={d.statLabel}>{pos}</HeroBadge>}
          {!entry.qualified && <HeroBadge fs={d.statLabel}>표본 부족</HeroBadge>}
        </div>
        <h2 className="font-black tracking-tight [overflow-wrap:anywhere]" style={{ fontSize: d.name, lineHeight: 1.1 }}>
          {nameHref && !exportMode ? (
            <Link href={nameHref} className="focus-ring pointer-events-auto rounded-control underline-offset-4 hover:underline" title={`${p.nameKo} 선수 페이지`}>
              {p.nameKo}
            </Link>
          ) : (
            p.nameKo
          )}
        </h2>
        <p className="mt-0.5 truncate font-medium" style={{ opacity: 0.85, fontSize: d.nameEn }}>
          {p.nameEn} ·{" "}
          <TeamLink code={exportMode ? null : teamPageCode} season={view.seasonCode || null} place="player_card" className="pointer-events-auto">
            {p.teamName}
          </TeamLink>
        </p>
      </div>
    </div>
  );

  // ── 메인 스탯 9개 + 시즌 순위 + 파울·출전 줄 ──
  const stats = (
    <div style={{ paddingLeft: d.pad, paddingRight: d.pad, paddingTop: d.pad, paddingBottom: horizontal ? d.pad : 0 }}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="font-bold text-ink" style={{ fontSize: d.statLabel + 1 }}>
          경기당 기록 <span className="font-medium text-ink-3">· {p.games}경기</span>
        </h3>
        <span className={groupLabel ? "font-semibold text-ink-2" : "text-ink-3"} style={{ fontSize: d.statLabel }}>
          {view.seasonCode === CAREER_CODE && !groupLabel ? "통산 순위" : rankHeading(groupLabel)}
        </span>
      </div>
      <div className={`grid grid-cols-3 ${roomy ? "gap-2" : "gap-1.5"}`}>
        {/* 3×3 격자는 순위 있는 9개만. 파울(ranked: false)은 아래 작은 줄에 출전시간과 함께 (순위 없음) */}
        {entry.stats.filter((s) => s.def.ranked).map((s) => (
          <StatCell key={s.def.key} entry={s} color={color} d={d} roomy={roomy} group={groupLabel} />
        ))}
      </div>
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-ink-2" style={{ fontSize: d.statLabel }}>
        <span>
          파울 <b className="font-bold text-ink">{fmt1(foot.fouls)}</b>
        </span>
        <span aria-hidden className="text-ink-3">·</span>
        <span>
          출전시간 <b className="font-bold text-ink">{fmt1(foot.minutes)}</b>분
        </span>
        <span className="text-ink-3" style={{ fontSize: d.statLabel - 1 }}>
          경기당 · 순위 없음
        </span>
      </p>
    </div>
  );

  // ── 레이더 + 꼭짓점마다 등급 S~F ──
  // 등급 컷 안내는 화면에서는 ⓘ 팝오버 안에만(상시 문구를 늘리지 않는다), 저장 이미지에는 글로 남긴다.
  const radarBlock = (
    <div
      className={horizontal ? "border-l border-line" : "mt-3 border-t border-line"}
      style={{ paddingLeft: d.pad, paddingRight: d.pad, paddingTop: horizontal ? d.pad : 8, paddingBottom: horizontal ? 4 : 0 }}
    >
      <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ink-2" style={{ fontSize: d.statLabel }}>
        등급 기준: {gradeLabel}
        {!exportMode && <HelpPopover term="percentileGrade" ariaLabel="등급 컷과 계산 방법" className="font-normal" />}
        {exportMode && (
          <span className="font-normal text-ink-3">축 S 상위 10% · A 25% · B 45% · C 65% · D 85% · 종합 = 6축 포지션별 가중 평균의 순위 S 상위 5% · A 20% · B 45% · C 70% · D 90%</span>
        )}
      </p>
      <CardRadar entry={entry} color={color} colors={colors} d={d} seriesColor={seriesColor} fixedWidth={exportMode ? CARD_LG_WIDTH - 2 * d.pad : undefined} />
      {/* 포지션별 종합 가중치 (lib/metrics axisWeights): 가드·빅맨만 한 줄, 포워드·포지션 모름은 없음 */}
      {overallNote && (
        <p className="pb-1 leading-snug text-ink-3" style={{ fontSize: small }}>
          종합 등급: {overallNote}
        </p>
      )}
      {/* 그 시즌 수상 가산점 (lib/metrics AWARD_GRADE_BONUS) */}
      {awardNote && (
        <p className="pb-1 leading-snug text-ink-3" style={{ fontSize: small }}>
          수상 가산: {awardNote}
        </p>
      )}
      {missingComponents.length > 0 && (
        <p className="pb-1 leading-snug text-ink-3" style={{ fontSize: small }}>
          {view.seasonCode === CAREER_CODE ? "통산 비교에서 뺀 항목" : "이 시즌 기록이 없어 뺀 항목"}: {missingComponents.join("·")}
        </p>
      )}
      {/* 스크린리더·표 보기: 축별 백분위·등급·구성 요소. 표는 sr-only 폭(1px)을 무시하고 늘어나므로 div 로 감싼다 */}
      <div className="sr-only">
        <table>
          <caption>레이더 6축: 점수(99점 만점, {gradeLabel}), 등급, 구성 요소 값과 백분위</caption>
          <tbody>
            {RADAR_AXES.map((axis) => (
              <tr key={axis}>
                <th scope="row">{RADAR_AXIS_LABELS[axis]}</th>
                <td>{gradeScore(entry.pct[axis]) ?? "–"}점</td>
                <td>{entry.grades[axis] ?? "-"}</td>
                <td>{componentsText(entry, axis)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── 기준·출처 (저장 이미지에도 남는다) ──
  const footer = (
    <div
      className={`border-t border-line py-2 leading-snug text-ink-3 ${horizontal ? "col-span-2" : ""}`}
      style={{ paddingLeft: d.pad + 2, paddingRight: d.pad + 2, fontSize: small }}
    >
      <p>
        순위: {seasonShortLabel(seasonLabel)} {groupLabel ? `${groupLabel} 중 ` : ""}
        {ruleLabel} {qualifiedCount}명 중 · 등급: {gradeLabel} · 턴오버는 적을수록 상위 · 성공률 순위는 경기당 시도가 리그 평균({attemptsLabel}) 이상인 선수만
      </p>
      <p className="mt-1 font-medium text-ink-2">{SOURCE_LINE}</p>
    </div>
  );

  if (horizontal) {
    return (
      <article
        className="surface-card tabular grid w-full overflow-hidden rounded-container"
        style={{ gridTemplateColumns: `${H_LEFT}px minmax(0,1fr) ${H_RIGHT}px` }}
        aria-label={`${p.nameKo} 플레이어 카드`}
      >
        {hero}
        {stats}
        {radarBlock}
        {footer}
      </article>
    );
  }

  return (
    <article
      className="surface-card tabular w-full overflow-hidden rounded-container"
      style={exportMode ? { width: CARD_LG_WIDTH } : undefined}
      aria-label={`${p.nameKo} 플레이어 카드`}
    >
      {hero}
      {stats}
      {radarBlock}
      {footer}
    </article>
  );
}
