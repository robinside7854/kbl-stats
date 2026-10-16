"use client";
// 홈 부문 1위 한 줄 (2026-10-01 사용자: 새로고침할 때마다 부문을 돌려 가며).
// 2026-10-16 디자인 정리 M1: 팀 색 큰 띠·배경 팀 이름 글자를 걷고 흰 줄 하나로. PC(1280px+)는 가운데에 그 선수의 경기당 기록 6개를 한 줄로.
// 정적 HTML 은 첫 부문(득점)으로 그리고, 브라우저에서 지난번 부문의 다음 부문으로 바꾼다(lib/home nextHeroIndex, 기억은 localStorage).
import Link from "next/link";
import { useEffect, useState } from "react";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import type { CardTeam, LeaderPlayer } from "@/lib/types";
import { formatStat, LEADER_STATS, type LeaderEntry, type LeaderStatKey } from "@/lib/leaders";
import { heroStatLine, HOME_HERO_STORAGE_KEY, HOME_UNITS, nextHeroIndex } from "@/lib/home";
import { teamShortLabel } from "@/lib/images";
import { playerHref } from "@/lib/cardview";
import { nationalityOf, NATIONALITY_LABELS, positionLabel } from "@/lib/roster";
import PlayerAvatar from "./PlayerAvatar";
import TeamLogo from "./TeamLogo";
import { TeamLink } from "./EntityLinks";

export interface HeroItem {
  key: LeaderStatKey;
  entry: LeaderEntry<LeaderPlayer>;
  team?: CardTeam;
}

export default function HomeHero({ items, seasonCode }: { items: HeroItem[]; seasonCode: number }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const keys = items.map((it) => it.key);
    let last: string | null = null;
    try {
      last = window.localStorage.getItem(HOME_HERO_STORAGE_KEY);
    } catch {
      // 저장소를 못 쓰는 환경: 무작위로 고른다
    }
    const next = nextHeroIndex(keys, last, Math.random());
    if (next < 0) return;
    setIndex(next);
    try {
      window.localStorage.setItem(HOME_HERO_STORAGE_KEY, keys[next]);
    } catch {
      // 기억 못 해도 표시는 그대로
    }
  }, [items]);
  const item = items[index] ?? items[0];
  return <Hero entry={item.entry} statKey={item.key} team={item.team} seasonCode={seasonCode} />;
}

function Hero({
  entry,
  statKey,
  team,
  seasonCode,
}: {
  entry: LeaderEntry<LeaderPlayer>;
  statKey: LeaderStatKey;
  team?: CardTeam;
  seasonCode: number;
}) {
  const p = entry.player;
  const color = team?.color ?? FALLBACK_TEAM_COLOR;
  const teamName = team?.shortName ?? p.teamShort;
  const value = formatStat(entry.value, statKey, "perGame");
  const label = LEADER_STATS[statKey].label;
  const unit = HOME_UNITS[statKey] ?? "";
  const pos = positionLabel(p.position);
  return (
    <section aria-label={`경기당 ${label} 1위 ${p.nameKo}`} className="mx-auto mt-6 max-w-page px-4">
      <div className="surface-card tabular flex items-center gap-3 rounded-container px-4 py-3 lg:gap-5 lg:px-5 lg:py-4">
        {/* deslop-ignore-next-line 19 */}
        <Link href={playerHref(p.id, seasonCode)} tabIndex={-1} aria-hidden className="shrink-0 rounded-full">
          <span className="lg:hidden">
            <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={color} size={48} />
          </span>
          <span className="hidden lg:inline">
            <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={color} size={64} />
          </span>
        </Link>
        <div className="min-w-0 flex-1 xl:flex-none">
          <p className="text-caption font-semibold text-ink-2 lg:text-sub">경기당 {label} 1위</p>
          <p className="truncate text-body font-bold text-ink lg:text-xl">
            <Link href={playerHref(p.id, seasonCode)} className="focus-ring rounded-control underline-offset-4 hover:underline">
              {p.nameKo}
            </Link>
          </p>
          <p className="flex min-w-0 items-center gap-1.5 text-caption text-ink-2 lg:text-sub">
            <TeamLink code={p.teamCode} season={seasonCode} place="home_hero" className="flex min-w-0 items-center gap-1.5">
              <TeamLogo logoUrl={team?.logoUrl} shortName={teamName} color={color} size={16} />
              <span className="truncate">{teamShortLabel(teamName)}</span>
            </TeamLink>
            {pos && <span className="shrink-0">· {pos}</span>}
            <span className="hidden shrink-0 sm:inline">· {NATIONALITY_LABELS[nationalityOf(p)]}</span>
          </p>
        </div>
        {/* PC(1280px+): 빈 가운데에 그 선수의 경기당 기록 6개 — 상자 없이 한 줄, 지금 부문만 진하게 */}
        <dl className="mx-auto hidden gap-6 xl:flex" aria-label={`${p.nameKo} 경기당 기록`}>
          {heroStatLine(p).map((s) => (
            <div key={s.key}>
              <dt className="whitespace-nowrap text-caption text-ink-3">{LEADER_STATS[s.key].label}</dt>
              <dd className={`whitespace-nowrap text-body font-bold ${s.key === statKey ? "text-ink" : "text-ink-2"}`}>
                {formatStat(s.value, s.key, "perGame")}
              </dd>
            </div>
          ))}
        </dl>
        <p className="shrink-0 leading-none text-ink">
          {/* deslop-ignore-next-line 11 */}
          <span className="text-3xl font-bold tracking-tight lg:text-4xl">{value}</span>
          <span className="ml-0.5 text-sub font-semibold text-ink-2">{unit}</span>
        </p>
      </div>
    </section>
  );
}
