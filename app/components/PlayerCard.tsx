"use client";
// 플레이어 카드 한 장 (게임 카드처럼): 팀 색 상단 + 큰 사진 → 메인 스탯 9개(시즌 순위) → 작은 레이더(백분위 5축).
// 값·순위·백분위 계산은 전부 lib/metrics.ts — 이 파일은 배치와 표기만 맡는다.
// exportMode(이미지 저장 사본)에서는 공식 사진·로고를 쓰지 않고 대체 디자인(팀 색·이니셜·약칭)으로 그린다.
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts";
import type { CardPlayer, CardTeam, TeamColor } from "@/lib/types";
import {
  attemptsNote,
  axisValue,
  radarAxes,
  RADAR_AXIS_LABELS,
  RADAR_AXIS_SHORT_LABELS,
  rankTier,
  type CardStatEntry,
  type PlayerType,
  type RadarAxisSet,
  type RadarPercentiles,
  type RankTier,
} from "@/lib/metrics";
import { mixHex, teamShortLabel } from "@/lib/images";
import PlayerAvatar from "./PlayerAvatar";
import TeamLogo from "./TeamLogo";
import type { ThemeColors } from "./useThemeColors";
import { SOURCE_LINE } from "./SourceFooter";

export interface CardEntry {
  player: CardPlayer;
  pct: RadarPercentiles;
  type: PlayerType;
  qualified: boolean;
  /** 메인 스탯 9개 (CARD_STATS 순서) + 시즌 순위 */
  stats: CardStatEntry[];
}

interface Props {
  entry: CardEntry;
  team?: CardTeam;
  seasonLabel: string;
  axisSet: RadarAxisSet;
  ruleLabel: string;
  qualifiedCount: number;
  colors: ThemeColors;
  /** 미니 레이더 선 색 (비교 시 선수 구분: series1 / series2) */
  seriesColor: string;
  /** 이미지 저장 사본: 공식 이미지 없이 대체 디자인만 */
  exportMode?: boolean;
}

const FALLBACK_COLOR: TeamColor = { primary: "#6B7280", secondary: "#9CA3AF", text: "#fff" };

const NF1 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt1 = (n: number) => (Number.isFinite(n) ? NF1.format(n) : "–");
const fmtPct = (n: number | null | undefined) => (n === null || n === undefined ? "–" : Math.round(n).toString());

const ATTEMPTS_NOTE = attemptsNote();

// ─────────────────────────────────────────────
// 순위 표시
// ─────────────────────────────────────────────

/** 금·은·동 메달 색 (바탕·테두리·숫자). 이모지 대신 SVG — 이미지 저장 시 이모지 폰트 문제 회피 */
const MEDAL: Record<"gold" | "silver" | "bronze", { fill: string; ring: string; ink: string; name: string }> = {
  gold: { fill: "#F2C94C", ring: "#B7892A", ink: "#4A3500", name: "금메달" },
  silver: { fill: "#D9DCE1", ring: "#8E949C", ink: "#2F3338", name: "은메달" },
  bronze: { fill: "#DE9A68", ring: "#9A5A2C", ink: "#3D1F08", name: "동메달" },
};

function Medal({ tier, rank }: { tier: "gold" | "silver" | "bronze"; rank: number }) {
  const m = MEDAL[tier];
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 18 18" className="shrink-0">
      <circle cx="9" cy="9" r="8" fill={m.fill} stroke={m.ring} strokeWidth="1.5" />
      <circle cx="9" cy="9" r="5.6" fill="none" stroke={m.ring} strokeOpacity="0.45" strokeWidth="0.8" />
      <text x="9" y="12.4" textAnchor="middle" fontSize="9.5" fontWeight="800" fill={m.ink} fontFamily="system-ui, sans-serif">
        {rank}
      </text>
    </svg>
  );
}

function RankLine({ entry, color }: { entry: CardStatEntry; color: TeamColor }) {
  const r = entry.rank;
  if (r.rank === null) {
    return (
      <span className="text-[11px] font-medium text-ink-3">{r.reason === "sample" ? "표본 미달" : "시도 부족"}</span>
    );
  }
  const tier = rankTier(r.rank);
  const of = <span className="text-[10px] text-ink-3">/{r.of}</span>;
  if (tier === "gold" || tier === "silver" || tier === "bronze") {
    return (
      <span className="inline-flex items-center gap-1" aria-label={`${MEDAL[tier].name} 시즌 ${r.rank}위, ${r.of}명 중`}>
        <Medal tier={tier} rank={r.rank} />
        <span className="text-[12px] font-bold text-ink">{r.rank}위</span>
        {of}
      </span>
    );
  }
  if (tier === "top10") {
    return (
      <span className="inline-flex items-center gap-1" aria-label={`시즌 ${r.rank}위, ${r.of}명 중`}>
        <span
          className="rounded-full px-1.5 py-px text-[11px] font-bold leading-4"
          style={{ background: color.primary, color: color.text, boxShadow: "0 0 0 1px var(--rank-pill-ring)" }}
        >
          {r.rank}위
        </span>
        {of}
      </span>
    );
  }
  return (
    <span className="text-[11px] text-ink-2" aria-label={`시즌 ${r.rank}위, ${r.of}명 중`}>
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

function StatCell({ entry, color }: { entry: CardStatEntry; color: TeamColor }) {
  const { def, value } = entry;
  const tier = rankTier(entry.rank.rank);
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-line px-2 py-1.5" style={cellStyle(tier, color)}>
      <span className="truncate text-[11px] font-medium text-ink-2">{def.label}</span>
      <span className="text-[22px] font-bold leading-7 tracking-tight text-ink">
        {fmt1(value)}
        {def.kind === "pct" && <span className="ml-px text-[13px] font-semibold">%</span>}
      </span>
      <span className="mt-0.5 flex h-[18px] items-center">
        <RankLine entry={entry} color={color} />
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// 배지
// ─────────────────────────────────────────────

function HeroBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.18)" }}>
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

// ─────────────────────────────────────────────
// 카드
// ─────────────────────────────────────────────

export default function PlayerCard({
  entry,
  team,
  seasonLabel,
  axisSet,
  ruleLabel,
  qualifiedCount,
  colors,
  seriesColor,
  exportMode = false,
}: Props) {
  const p = entry.player;
  const color = team?.color ?? FALLBACK_COLOR;
  // 상단 그라데이션: 팀 primary → 검정 쪽으로 어둡게. 이름이 놓이는 아래쪽이 가장 어둡다 (글자는 color.text)
  const dark = mixHex(color.primary, "#000000", 0.62);
  const mid = mixHex(color.primary, "#000000", 0.3);
  const official = !exportMode;
  const axes = radarAxes(axisSet);
  const radarData = axes.map((axis) => ({ axis, label: RADAR_AXIS_SHORT_LABELS[axis], v: entry.pct[axis] ?? 0 }));

  return (
    <article
      className="w-full overflow-hidden rounded-3xl border border-line bg-surface shadow-sm"
      style={exportMode ? { width: 380 } : undefined}
      aria-label={`${p.nameKo} 플레이어 카드`}
    >
      {/* ── 상단: 팀 색 + 큰 사진 ── */}
      <div
        className="relative h-[226px] overflow-hidden"
        style={{ background: `linear-gradient(165deg, ${color.primary} 0%, ${mid} 55%, ${dark} 100%)`, color: color.text }}
      >
        {/* 장식: 팀 약칭 큰 글씨 */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-2 top-1 select-none whitespace-nowrap text-[88px] font-black leading-none tracking-tighter"
          style={{ opacity: 0.1 }}
        >
          {teamShortLabel(team?.shortName ?? p.teamShort, 5)}
        </span>

        {/* 사진: 오른쪽 아래에 붙여 하단이 카드 경계에 걸치게 */}
        <div className="absolute bottom-0 right-1">
          <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={color} variant="portrait" size={208} official={official} />
        </div>

        {/* 좌상단: 로고 · 시즌 · 유형 */}
        <div className="absolute left-3.5 top-3.5 flex max-w-[58%] flex-col items-start gap-1.5">
          <span className="inline-flex rounded-xl bg-white p-1 shadow-sm">
            <TeamLogo
              logoUrl={team?.logoUrl}
              shortName={team?.shortName ?? p.teamShort}
              color={color}
              size={40}
              official={official}
            />
          </span>
          <span className="text-[11px] font-medium" style={{ opacity: 0.85 }}>
            {seasonLabel} 정규시즌
          </span>
          <span className="rounded-lg px-2 py-1 text-[12px] font-bold leading-tight" style={{ background: "rgba(0,0,0,0.28)" }}>
            {entry.type.label}
          </span>
        </div>

        {/* 하단: 이름 (사진 아래쪽을 덮는 어두운 띠 위) */}
        <div
          className="absolute inset-x-0 bottom-0 px-3.5 pb-3 pt-10"
          style={{ background: `linear-gradient(to top, ${dark} 0%, ${dark}e6 40%, ${dark}00 100%)` }}
        >
          <div className="mb-1 flex flex-wrap gap-1">
            <HeroBadge>{p.isForeign ? "외국인" : "국내"}</HeroBadge>
            {!entry.qualified && <HeroBadge>표본 부족</HeroBadge>}
          </div>
          <h2 className="text-[28px] font-black leading-[1.1] tracking-tight [overflow-wrap:anywhere]">{p.nameKo}</h2>
          <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-wide" style={{ opacity: 0.8 }}>
            {p.nameEn} · {p.teamName}
          </p>
        </div>
      </div>

      {/* ── 중단: 메인 스탯 9개 + 시즌 순위 ── */}
      <div className="px-3 pt-3">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <h3 className="text-[12px] font-bold text-ink">
            경기당 기록 <span className="font-medium text-ink-3">· {p.games}경기</span>
          </h3>
          <span className="text-[11px] text-ink-3">시즌 순위</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {entry.stats.map((s) => (
            <StatCell key={s.def.key} entry={s} color={color} />
          ))}
        </div>
      </div>

      {/* ── 하단: 작은 레이더 (보조) + 백분위 표 ── */}
      <div className="mt-3 flex items-center gap-1 border-t border-line px-2 pt-2">
        <div className="shrink-0" aria-hidden>
          <RadarChart width={148} height={132} data={radarData} outerRadius={44} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <PolarGrid stroke={colors.grid} />
            <PolarAngleAxis dataKey="label" tick={{ fill: colors.ink3, fontSize: 9, fontWeight: 600 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              dataKey="v"
              stroke={seriesColor}
              strokeWidth={2}
              fill={seriesColor}
              fillOpacity={0.22}
              dot={{ r: 2.5, fill: seriesColor, stroke: colors.surface, strokeWidth: 1 }}
              isAnimationActive={false}
            />
          </RadarChart>
        </div>
        <div className="min-w-0 flex-1 pr-1">
          <p className="mb-0.5 flex flex-wrap items-center gap-1 text-[11px] font-semibold text-ink-2">
            시즌 내 백분위 {axisSet === "classic" && <ClassicAxesBadge />}
          </p>
          <table className="tabular w-full text-[11px]">
            <caption className="sr-only">축별 원래 값과 시즌 내 백분위(0~100)</caption>
            <tbody>
              {axes.map((axis) => (
                <tr key={axis}>
                  <th scope="row" className="py-px text-left font-medium text-ink-2">
                    {RADAR_AXIS_LABELS[axis]}
                  </th>
                  <td className="py-px text-right text-ink-3">{fmt1(axisValue(p, axis))}</td>
                  <td className="w-8 py-px text-right font-bold text-ink">{fmtPct(entry.pct[axis])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 기준·출처 (저장 이미지에도 남는다) ── */}
      <div className="mt-2 border-t border-line px-3.5 py-2 text-[10px] leading-snug text-ink-3">
        <p>
          순위·백분위: {seasonLabel} {ruleLabel} {qualifiedCount}명 중 · 턴오버는 적을수록 상위 · 성공률은 시도 기준({ATTEMPTS_NOTE}) 충족 선수만
        </p>
        <p className="mt-1 font-medium text-ink-2">{SOURCE_LINE}</p>
      </div>
    </article>
  );
}
