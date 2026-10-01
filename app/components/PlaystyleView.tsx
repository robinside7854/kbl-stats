"use client";
// 플레이스타일 화면: 역할 유형 / 공격 유형 → 유형 칩(인원) → 그 유형 안 순위.
// 1~10위는 사진·팀·등급과 "카드 보기"가 있는 큰 줄, 11위부터는 "더 보기"로 작은 줄. 상태는 주소 ?kind=&type=&origin=.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { groupStyles, parseStyleQuery, STYLE_TOP, styleQueryString, type StyleKind, type StyleOrigin, type StyleRow } from "@/lib/playstyle";
import { playerHref } from "@/lib/cardview";
import { positionLabel } from "@/lib/roster";
import { FALLBACK_TEAM_COLOR, gradeTone } from "@/lib/teams";
import { teamShortLabel } from "@/lib/images";
import type { CardTeam } from "@/lib/types";
import ChipRow from "./ChipRow";
import { IconChevronRight } from "./icons";
import InfoLink from "./InfoLink";
import PlayerAvatar from "./PlayerAvatar";
import Segmented from "./Segmented";
import TeamLogo from "./TeamLogo";
import { useThemeColors, type ThemeColors } from "./useThemeColors";

interface Props {
  seasonCode: number;
  seasonLabel: string;
  rows: StyleRow[];
  teams: CardTeam[];
  /** 슛 차트가 있는 시즌인가 (공격 유형) */
  hasShots: boolean;
}

const ORIGIN_OPTIONS: { value: StyleOrigin; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "domestic", label: "국내" },
  { value: "foreign", label: "외국인" },
];

export default function PlaystyleView({ seasonCode, seasonLabel, rows, teams, hasShots }: Props) {
  const colors = useThemeColors();
  const [kind, setKind] = useState<StyleKind>("role");
  const [origin, setOrigin] = useState<StyleOrigin>("all");
  const [type, setType] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const teamByCode = useMemo(() => new Map(teams.map((t) => [t.teamCode, t])), [teams]);

  useEffect(() => {
    const q = parseStyleQuery(window.location.search);
    setKind(q.kind === "offense" && hasShots ? "offense" : "role");
    setOrigin(q.origin);
    setType(q.type);
  }, [hasShots]);

  const groups = useMemo(() => groupStyles(rows, kind, origin), [rows, kind, origin]);
  const group = groups.find((g) => g.key === type) ?? groups[0] ?? null;

  useEffect(() => {
    const q = styleQueryString({ kind, type: group && group.key !== groups[0]?.key ? group.key : null, origin });
    window.history.replaceState(null, "", `${window.location.pathname}${q}`);
    setShowAll(false);
  }, [kind, origin, group, groups]);

  const top = group ? group.rows.slice(0, STYLE_TOP) : [];
  const rest = group ? group.rows.slice(STYLE_TOP) : [];

  return (
    <main className="mx-auto max-w-5xl px-4 pt-5">
      <header className="mb-3">
        <p className="text-sub font-medium text-ink-3">{seasonLabel} KBL 정규시즌 · 10경기·100분 이상</p>
        <h1 className="mt-0.5 flex items-center gap-1 text-h1 font-bold">
          플레이스타일 <InfoLink term={kind === "role" ? "playerTypes" : "offenseTypes"} className="ml-1" />
        </h1>
      </header>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {hasShots && (
          <Segmented
            label="유형 기준"
            options={[
              { value: "role", label: "역할 유형" },
              { value: "offense", label: "공격 유형" },
            ]}
            value={kind}
            onChange={(k) => {
              setKind(k);
              setType(null);
            }}
          />
        )}
        <Segmented label="국적" options={ORIGIN_OPTIONS} value={origin} onChange={setOrigin} />
      </div>

      <ChipRow
        label="유형 선택"
        className="mt-3"
        chips={groups.map((g) => ({ value: g.key, label: `${g.label} ${g.rows.length}` }))}
        value={group?.key ?? ""}
        onChange={setType}
      />

      {group ? (
        <section aria-labelledby="style-title" className="mt-4">
          <h2 id="style-title" className="text-h2 font-bold">
            {group.label} <span className="text-sub font-medium text-ink-3">{group.rows.length}명</span>
          </h2>
          <p className="mt-0.5 text-sub text-ink-2">{group.short} · 종합 점수 순</p>

          <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {top.map((r, i) => (
              <li key={r.id} className="min-w-0">
                <TopRow r={r} rank={i + 1} team={teamByCode.get(r.teamCode)} seasonCode={seasonCode} colors={colors} />
              </li>
            ))}
          </ol>

          {rest.length > 0 &&
            (showAll ? (
              <ol start={STYLE_TOP + 1} className="surface-card tabular mt-3 divide-y divide-line rounded-container">
                {rest.map((r, i) => (
                  <li key={r.id}>
                    <Link
                      href={playerHref(r.id, seasonCode)}
                      className="focus-ring-inset flex min-h-12 items-center gap-3 px-3 py-2 text-body transition-colors duration-200 hover:bg-surface-2"
                    >
                      <span className="w-7 shrink-0 text-center font-semibold text-ink-3">{STYLE_TOP + i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-ink">{r.nameKo}</span>
                      <span className="shrink-0 text-sub text-ink-3">{teamShortLabel(teamByCode.get(r.teamCode)?.shortName ?? r.teamShort)}</span>
                      <span className="w-14 shrink-0 text-right font-bold text-ink">
                        {r.grade} {r.score ?? ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="focus-ring mt-3 h-11 w-full cursor-pointer rounded-control border border-line bg-surface text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
              >
                더 보기 ({rest.length}명)
              </button>
            ))}
        </section>
      ) : (
        <p className="surface-card mt-4 rounded-container px-4 py-8 text-center text-body text-ink-2">이 조건에 맞는 선수가 없습니다.</p>
      )}
    </main>
  );
}

/** 1~10위 큰 줄: 순위 · 사진 · 이름·팀·포지션 · 종합 등급+점수 · 카드 보기 */
function TopRow({ r, rank, team, seasonCode, colors }: { r: StyleRow; rank: number; team?: CardTeam; seasonCode: number; colors: ThemeColors }) {
  const color = team?.color ?? FALLBACK_TEAM_COLOR;
  const tone = gradeTone(r.grade, color, colors);
  const teamName = team?.shortName ?? r.teamShort;
  const pos = positionLabel(r.position);
  return (
    <Link
      href={playerHref(r.id, seasonCode)}
      className="focus-ring surface-card tabular flex min-h-20 items-center gap-3 rounded-container px-3 py-2.5 transition-colors duration-200 hover:bg-surface-2"
      aria-label={`${rank}위 ${r.nameKo}, ${teamName}, 종합 ${r.grade} ${r.score ?? ""}점, 선수 카드 보기`}
    >
      <span className={`w-6 shrink-0 text-center text-body ${rank <= 3 ? "font-black text-ink" : "font-semibold text-ink-3"}`}>{rank}</span>
      <PlayerAvatar photoUrl={r.photoUrl} nameKo={r.nameKo} color={color} size={48} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-bold text-ink">{r.nameKo}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1 text-caption text-ink-2">
          <TeamLogo logoUrl={team?.logoUrl} shortName={teamName} color={color} size={16} />
          <span className="truncate">
            {teamShortLabel(teamName)}
            {pos ? ` · ${pos}` : ""} · 경기당 {r.ppg.toFixed(1)}점
          </span>
        </span>
      </span>
      <span
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-control border-[1.5px] px-1.5 text-base font-black"
        style={{ background: tone.bg, color: tone.ink, borderColor: tone.border }}
      >
        {r.grade}
        <span className="text-caption font-bold">{r.score ?? ""}</span>
      </span>
      <span className="hidden shrink-0 items-center text-sub font-semibold text-ink-2 sm:inline-flex">
        카드 <IconChevronRight size={16} />
      </span>
    </Link>
  );
}
