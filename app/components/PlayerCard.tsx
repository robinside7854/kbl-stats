"use client";
// 플레이어 카드 한 장 (게임 카드처럼): 팀 색 상단 + 큰 사진 + 종합 등급 → 메인 스탯 9개(시즌 순위) + 파울·출전 줄
// → 레이더 + 축별 등급(S~F). 값·순위·백분위·등급 계산은 전부 lib/metrics.ts·lib/cardview.ts — 이 파일은 배치와 표기만 맡는다.
// 입력은 lib/cardview buildSeasonCardView 결과(SeasonCardView) 하나: 시즌·순위 범위(전체/같은 포지션)·팀 색·로고가 그 시즌 것.
// 사진은 선수당 한 장(시즌별 사진이 없다)이라 어느 시즌 카드든 같은 사진을 쓰고, 팀 색·로고만 그 시즌 것을 쓴다.
// size: "sm"(모바일, 폭 100%) / "lg"(PC·저장 이미지, 폭 약 500px) — 글자·사진·격자·레이더를 비례해 키운다.
// exportMode(이미지 저장 사본)에서는 공식 사진·로고를 쓰지 않고 대체 디자인(팀 색·이니셜·약칭)으로 그린다.
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import Link from "next/link";
import type { CardPlayer, TeamColor } from "@/lib/types";
import { cardFootStats, rankHeading, rankPhrase, type SeasonCardView } from "@/lib/cardview";
import { glossaryHref } from "@/lib/glossary";
import { nationalityOf, NATIONALITY_LABELS, positionLabel } from "@/lib/roster";
import {
  axisValue,
  radarAxes,
  RADAR_AXIS_LABELS,
  RADAR_AXIS_SHORT_LABELS,
  rankTier,
  type CardEntryOf,
  type CardStatEntry,
  type Grade,
  type RadarAxis,
  type RankTier,
} from "@/lib/metrics";
import { mixHex, teamShortLabel } from "@/lib/images";
import PlayerAvatar from "./PlayerAvatar";
import TeamLogo from "./TeamLogo";
import type { ThemeColors } from "./useThemeColors";
import { SOURCE_LINE } from "./SourceFooter";

/** 카드 한 장의 값 (lib/metrics buildCardEntry 결과) */
export type CardEntry = CardEntryOf<CardPlayer>;

export type CardSize = "sm" | "lg";

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
}

const FALLBACK_COLOR: TeamColor = { primary: "#6B7280", secondary: "#9CA3AF", text: "#fff" };

const NF1 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt1 = (n: number) => (Number.isFinite(n) ? NF1.format(n) : "–");
const fmtPct = (n: number | null | undefined) => (n === null || n === undefined ? "–" : Math.round(n).toString());

/** 크기별 치수 (px). lg 는 sm 의 약 1.3배 */
const DIM = {
  sm: { header: 226, photo: 208, logo: 40, name: 28, nameEn: 11, statVal: 22, statPct: 13, statLabel: 11, rank: 12, ovr: 34, radarH: 300, gradeChip: 26, tickLabel: 10.5, tickValue: 9.5, pad: 12 },
  lg: { header: 296, photo: 276, logo: 52, name: 36, nameEn: 13, statVal: 29, statPct: 16, statLabel: 13, rank: 13.5, ovr: 46, radarH: 380, gradeChip: 34, tickLabel: 13, tickValue: 11.5, pad: 16 },
} as const;
/** lg 카드 폭 (저장 이미지·PC 한 장 보기) */
export const CARD_LG_WIDTH = 500;

// ─────────────────────────────────────────────
// 순위 표시
// ─────────────────────────────────────────────

/** 금·은·동 메달 색 (바탕·테두리·숫자). 이모지 대신 SVG — 이미지 저장 시 이모지 폰트 문제 회피 */
const MEDAL: Record<"gold" | "silver" | "bronze", { fill: string; ring: string; ink: string; name: string }> = {
  gold: { fill: "#F2C94C", ring: "#B7892A", ink: "#4A3500", name: "금메달" },
  silver: { fill: "#D9DCE1", ring: "#8E949C", ink: "#2F3338", name: "은메달" },
  bronze: { fill: "#DE9A68", ring: "#9A5A2C", ink: "#3D1F08", name: "동메달" },
};

function Medal({ tier, rank, px }: { tier: "gold" | "silver" | "bronze"; rank: number; px: number }) {
  const m = MEDAL[tier];
  return (
    <svg aria-hidden width={px} height={px} viewBox="0 0 18 18" className="shrink-0">
      <circle cx="9" cy="9" r="8" fill={m.fill} stroke={m.ring} strokeWidth="1.5" />
      <circle cx="9" cy="9" r="5.6" fill="none" stroke={m.ring} strokeOpacity="0.45" strokeWidth="0.8" />
      <text x="9" y="12.4" textAnchor="middle" fontSize="9.5" fontWeight="800" fill={m.ink} fontFamily="system-ui, sans-serif">
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
    return (
      <span className="inline-flex items-center gap-1" aria-label={rankPhrase(r.rank, r.of, group)}>
        <span
          className="rounded-full px-1.5 py-px font-bold"
          style={{ fontSize: fs - 1, lineHeight: 1.35, background: color.primary, color: color.text, boxShadow: "0 0 0 1px var(--rank-pill-ring)" }}
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
  return {
    background: `color-mix(in srgb, ${color.primary} var(--rank-tint), var(--surface))`,
    borderColor: `color-mix(in srgb, ${color.primary} var(--rank-border), var(--surface))`,
  };
}

function StatCell({ entry, color, size, group }: { entry: CardStatEntry; color: TeamColor; size: CardSize; group: string | null }) {
  const d = DIM[size];
  const { def, value } = entry;
  const tier = rankTier(entry.rank.rank);
  return (
    <div
      className={`flex min-w-0 flex-col rounded-xl border border-line ${size === "lg" ? "px-2.5 py-2" : "px-2 py-1.5"}`}
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
// 등급 (S~F) 색
// ─────────────────────────────────────────────
// S = 금색 계열(globals.css --grade-s), A = 팀 색, B = 팀 색을 표면에 옅게 섞은 색 + 팀 색 테두리,
// C = 중립(--grade-c), D·F = 회색(--grade-d, --grade-f). 레이더(SVG) 안에서도 쓰므로 hex 로 넘긴다(useThemeColors).

interface GradeTone {
  bg: string;
  ink: string;
  border: string;
}

function gradeTone(grade: Grade | "-", color: TeamColor, c: ThemeColors): GradeTone {
  switch (grade) {
    case "S":
      return { bg: c.gradeS, ink: c.gradeSInk, border: c.gradeS };
    case "A":
      return { bg: color.primary, ink: color.text, border: color.primary };
    case "B":
      return { bg: mixHex(color.primary, c.surface, 0.72), ink: c.ink, border: color.primary };
    case "C":
      return { bg: c.gradeC, ink: c.gradeCInk, border: c.gradeC };
    case "D":
      return { bg: c.gradeD, ink: c.gradeDInk, border: c.gradeD };
    case "F":
      return { bg: c.gradeF, ink: c.gradeFInk, border: c.gradeF };
    default:
      return { bg: c.surface, ink: c.ink3, border: c.grid };
  }
}

/** 레이더 꼭짓점 라벨: 등급 칩(크게) + 축 이름 + 원래 값(작게). 꼭짓점 바깥쪽으로 밀어 그린다 */
function GradeTick(props: {
  x?: number;
  y?: number;
  payload?: { value: string; coordinate: number; index?: number };
  index?: number;
  axes: readonly RadarAxis[];
  entry: CardEntry;
  color: TeamColor;
  colors: ThemeColors;
  size: CardSize;
}) {
  const { x = 0, y = 0, payload, axes, entry, color, colors, size } = props;
  const d = DIM[size];
  const idx = props.index ?? payload?.index ?? 0;
  const axis = axes[idx];
  if (!axis) return null;
  const grade = entry.grades[axis] ?? "-";
  const tone = gradeTone(grade, color, colors);
  const chip = d.gradeChip;
  const blockW = Math.max(chip, d.tickLabel * 4.6);
  const blockH = chip + 4 + d.tickLabel + 2 + d.tickValue;
  // 꼭짓점 각도(도, 반시계·오른쪽 0) → 바깥쪽 단위 벡터. 블록 중심을 바깥으로 반 칸 민다
  const rad = ((payload?.coordinate ?? 90) * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = -Math.sin(rad);
  const bx = x + ux * (blockW / 2 + 2);
  const by = y + uy * (blockH / 2 + 2);
  const top = by - blockH / 2;
  const raw = fmt1(axisValue(entry.player, axis));
  return (
    <g>
      <title>{`${RADAR_AXIS_LABELS[axis]} ${raw} · 백분위 ${fmtPct(entry.pct[axis])} · 등급 ${grade}`}</title>
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
        fontFamily="system-ui, sans-serif"
      >
        {grade}
      </text>
      <text x={bx} y={top + chip + 3 + d.tickLabel * 0.9} textAnchor="middle" fontSize={d.tickLabel} fontWeight={700} fill={colors.ink2}>
        {RADAR_AXIS_SHORT_LABELS[axis]}
      </text>
      <text
        x={bx}
        y={top + chip + 5 + d.tickLabel + d.tickValue * 0.9}
        textAnchor="middle"
        fontSize={d.tickValue}
        fill={colors.ink3}
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
    <span className="whitespace-nowrap rounded-full px-2 py-0.5 font-semibold" style={{ background: "rgba(255,255,255,0.18)", fontSize: fs }}>
      {children}
    </span>
  );
}

// 2차 스탯이 없는 시즌이라 전 시즌 공통 축으로 그렸다는 표시 (저장 이미지에도 남는다)
function ClassicAxesBadge() {
  return (
    <span className="whitespace-nowrap rounded-full border border-line px-1.5 py-px text-[10px] font-medium text-ink-2">
      고전 축
    </span>
  );
}

/** 헤더의 종합 등급 (게임 카드의 OVR 자리). 표본 미달이면 등급 대신 "표본 미달" */
function OverallBadge({
  entry,
  color,
  colors,
  size,
}: {
  entry: CardEntry;
  color: TeamColor;
  colors: ThemeColors;
  size: CardSize;
}) {
  const d = DIM[size];
  if (!entry.qualified) {
    return (
      <span
        className="inline-flex flex-col items-center justify-center rounded-xl px-2 text-center font-bold leading-tight"
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
      className="inline-flex flex-col items-center justify-center rounded-xl"
      style={{
        width: d.logo + 8,
        height: d.logo + 8,
        background: tone.bg,
        color: tone.ink,
        boxShadow: "0 0 0 2px rgba(255,255,255,0.85)",
      }}
      aria-label={`종합 등급 ${entry.overall}`}
    >
      <span className="font-bold leading-none" style={{ fontSize: Math.round(d.statLabel * 0.8), opacity: 0.85 }}>
        종합
      </span>
      <span className="font-black leading-none" style={{ fontSize: d.ovr * 0.82 }}>
        {entry.overall}
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────
// 카드
// ─────────────────────────────────────────────

export default function PlayerCard({ view, colors, size = "sm", seriesColor, exportMode = false, nameHref }: Props) {
  const { entry, seasonLabel, axisSet, ruleLabel, qualifiedCount, attemptsLabel, groupLabel } = view;
  const team = view.team ?? undefined;
  const p = entry.player;
  const foot = cardFootStats(p);
  const pos = positionLabel(p.position);
  const d = DIM[size];
  const color = team?.color ?? FALLBACK_COLOR;
  // 상단 그라데이션: 팀 primary → 검정 쪽으로 어둡게. 이름이 놓이는 아래쪽이 가장 어둡다 (글자는 color.text)
  const dark = mixHex(color.primary, "#000000", 0.62);
  const mid = mixHex(color.primary, "#000000", 0.3);
  const official = !exportMode;
  const axes = radarAxes(axisSet);
  const radarData = axes.map((axis) => ({ axis, label: RADAR_AXIS_SHORT_LABELS[axis], v: entry.pct[axis] ?? 0 }));
  const teamShort = team?.shortName ?? p.teamShort;
  // 레이더 반지름: 차트 높이의 약 1/3 (꼭짓점 바깥에 등급 블록 자리를 남긴다)
  const outer = Math.round(d.radarH * 0.34);
  const radarWidth = exportMode ? CARD_LG_WIDTH - 2 * d.pad : undefined;

  const radar = (
    <RadarChart
      {...(radarWidth ? { width: radarWidth, height: d.radarH } : {})}
      data={radarData}
      outerRadius={outer}
      cy="54%"
      margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <PolarGrid stroke={colors.grid} />
      <PolarAngleAxis
        dataKey="label"
        tick={(tp: object) => <GradeTick {...tp} axes={axes} entry={entry} color={color} colors={colors} size={size} />}
      />
      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
      <Radar
        dataKey="v"
        stroke={seriesColor}
        strokeWidth={2}
        fill={seriesColor}
        fillOpacity={0.22}
        dot={{ r: size === "lg" ? 4 : 3, fill: seriesColor, stroke: colors.surface, strokeWidth: 2 }}
        isAnimationActive={false}
      />
    </RadarChart>
  );

  return (
    <article
      className="w-full overflow-hidden rounded-3xl border border-line bg-surface shadow-sm"
      style={exportMode ? { width: CARD_LG_WIDTH } : undefined}
      aria-label={`${p.nameKo} 플레이어 카드`}
    >
      {/* ── 상단: 팀 색 + 큰 사진 ── */}
      <div
        className="relative overflow-hidden"
        style={{ height: d.header, background: `linear-gradient(165deg, ${color.primary} 0%, ${mid} 55%, ${dark} 100%)`, color: color.text }}
      >
        {/* 장식: 팀 약칭 큰 글씨 */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-2 top-1 select-none whitespace-nowrap font-black leading-none tracking-tighter"
          style={{ opacity: 0.1, fontSize: Math.round(d.header * 0.39) }}
        >
          {teamShortLabel(teamShort, 5)}
        </span>

        {/* 사진: 오른쪽 아래에 붙여 하단이 카드 경계에 걸치게 */}
        <div className="absolute bottom-0 right-1">
          <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={color} variant="portrait" size={d.photo} official={official} />
        </div>

        {/* 좌상단: 로고 + 종합 등급 · 시즌 · 유형 */}
        <div className="absolute flex max-w-[60%] flex-col items-start gap-1.5" style={{ left: d.pad + 2, top: d.pad + 2 }}>
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-xl bg-white p-1 shadow-sm">
              <TeamLogo logoUrl={team?.logoUrl} shortName={teamShort} color={color} size={d.logo} official={official} />
            </span>
            <OverallBadge entry={entry} color={color} colors={colors} size={size} />
          </div>
          <span className="font-medium" style={{ opacity: 0.85, fontSize: d.statLabel }}>
            {seasonLabel} 정규시즌
          </span>
          <span className="rounded-lg px-2 py-1 font-bold leading-tight" style={{ background: "rgba(0,0,0,0.28)", fontSize: d.statLabel + 1 }}>
            {entry.type.label}
          </span>
        </div>

        {/* 하단: 이름 (사진 아래쪽을 덮는 어두운 띠 위) */}
        <div
          className="absolute inset-x-0 bottom-0 pt-10"
          style={{ paddingLeft: d.pad + 2, paddingRight: d.pad + 2, paddingBottom: d.pad, background: `linear-gradient(to top, ${dark} 0%, ${dark}e6 40%, ${dark}00 100%)` }}
        >
          <div className="mb-1 flex flex-wrap gap-1">
            <HeroBadge fs={d.statLabel}>{NATIONALITY_LABELS[nationalityOf(p)]}</HeroBadge>
            {pos && <HeroBadge fs={d.statLabel}>{pos}</HeroBadge>}
            {!entry.qualified && <HeroBadge fs={d.statLabel}>표본 부족</HeroBadge>}
          </div>
          <h2 className="font-black tracking-tight [overflow-wrap:anywhere]" style={{ fontSize: d.name, lineHeight: 1.1 }}>
            {nameHref && !exportMode ? (
              <Link href={nameHref} className="underline-offset-4 hover:underline" title={`${p.nameKo} 선수 페이지`}>
                {p.nameKo}
              </Link>
            ) : (
              p.nameKo
            )}
          </h2>
          <p className="mt-0.5 truncate font-medium uppercase tracking-wide" style={{ opacity: 0.8, fontSize: d.nameEn }}>
            {p.nameEn} · {p.teamName}
          </p>
        </div>
      </div>

      {/* ── 중단: 메인 스탯 9개 + 시즌 순위 ── */}
      <div style={{ paddingLeft: d.pad, paddingRight: d.pad, paddingTop: d.pad }}>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <h3 className="font-bold text-ink" style={{ fontSize: d.statLabel + 1 }}>
            경기당 기록 <span className="font-medium text-ink-3">· {p.games}경기</span>
          </h3>
          <span className={groupLabel ? "font-semibold text-ink-2" : "text-ink-3"} style={{ fontSize: d.statLabel }}>
            {rankHeading(groupLabel)}
          </span>
        </div>
        <div className={`grid grid-cols-3 ${size === "lg" ? "gap-2" : "gap-1.5"}`}>
          {/* 3×3 격자는 순위 있는 9개만. 파울(ranked: false)은 아래 작은 줄에 출전시간과 함께 (순위 없음) */}
          {entry.stats.filter((s) => s.def.ranked).map((s) => (
            <StatCell key={s.def.key} entry={s} color={color} size={size} group={groupLabel} />
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

      {/* ── 하단: 레이더(크게) + 꼭짓점마다 등급 S~F ── */}
      <div className="mt-3 border-t border-line" style={{ paddingLeft: d.pad, paddingRight: d.pad, paddingTop: 8 }}>
        <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ink-2" style={{ fontSize: d.statLabel }}>
          {groupLabel ? `${groupLabel} 중 등급` : "시즌 내 등급"}
          {!exportMode && (
            <Link
              href={glossaryHref("percentileGrade")}
              className="-my-2 inline-flex h-8 w-6 items-center justify-center font-normal text-ink-3 hover:text-ink"
              aria-label="등급 계산 방법 (용어 풀이)"
              title="등급 계산 방법"
            >
              ⓘ
            </Link>
          )}
          <span className="font-normal text-ink-3">S 상위 10% · A 25% · B 45% · C 65% · D 85%</span>
          {axisSet === "classic" && <ClassicAxesBadge />}
        </p>
        <div aria-hidden style={{ height: d.radarH }}>
          {radarWidth ? (
            radar
          ) : (
            <ResponsiveContainer width="100%" height={d.radarH} initialDimension={{ width: 320, height: d.radarH }}>
              {radar}
            </ResponsiveContainer>
          )}
        </div>
        {/* 스크린리더·표 보기: 축별 원래 값·백분위·등급 */}
        <table className="sr-only">
          <caption>축별 원래 값, 시즌 내 백분위(0~100), 등급</caption>
          <tbody>
            {axes.map((axis) => (
              <tr key={axis}>
                <th scope="row">{RADAR_AXIS_LABELS[axis]}</th>
                <td>{fmt1(axisValue(p, axis))}</td>
                <td>{fmtPct(entry.pct[axis])}</td>
                <td>{entry.grades[axis] ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 기준·출처 (저장 이미지에도 남는다) ── */}
      <div className="border-t border-line py-2 leading-snug text-ink-3" style={{ paddingLeft: d.pad + 2, paddingRight: d.pad + 2, fontSize: size === "lg" ? 11.5 : 10 }}>
        <p>
          순위·등급: {seasonLabel} {groupLabel ? `${groupLabel} 중 ` : ""}
          {ruleLabel} {qualifiedCount}명 중 · 턴오버는 적을수록 상위 · 성공률 순위는 경기당 시도가 리그 평균({attemptsLabel}) 이상인 선수만
        </p>
        <p className="mt-1 font-medium text-ink-2">{SOURCE_LINE}</p>
      </div>
    </article>
  );
}
