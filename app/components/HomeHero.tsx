"use client";
// 홈 표지: 부문 1위 한 명 (2026-10-01 사용자: 새로고침할 때마다 부문을 돌려 가며). 2026-10-16 M1 에서 한 줄로 줄였다가 2026-10-17 사용자 "임팩트가 적다"로 큰 띠를 되살림.
// PC(1024px 이상, 2026-10-06 사용자: 가운데가 비어 있다)는 이름·숫자를 키우고 가운데에 그 선수의 경기당 기록 6칸(지금 부문 강조).
// 정적 HTML 은 첫 부문(득점)으로 그리고, 브라우저에서 지난번 부문의 다음 부문으로 바꾼다(lib/home nextHeroIndex, 기억은 localStorage).
import Link from "next/link";
import { useEffect, useState } from "react";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import type { CardTeam, LeaderPlayer } from "@/lib/types";
import { formatStat, LEADER_STATS, type LeaderEntry, type LeaderStatKey } from "@/lib/leaders";
import { heroStatLine, HOME_HERO_STORAGE_KEY, HOME_UNITS, nextHeroIndex } from "@/lib/home";
import { mixHex, teamShortLabel } from "@/lib/images";
import { playerHref } from "@/lib/cardview";
import { nationalityOf, NATIONALITY_LABELS, positionLabel } from "@/lib/roster";
import { IconChevronRight } from "./icons";
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
  const mid = mixHex(color.primary, "#000000", 0.3);
  const dark = mixHex(color.primary, "#000000", 0.62);
  const value = formatStat(entry.value, statKey, "perGame");
  const label = LEADER_STATS[statKey].label;
  const unit = HOME_UNITS[statKey] ?? "";
  return (
    <section aria-label={`${label} 1위 ${p.nameKo}`} className="mx-auto mt-3 max-w-page sm:px-4">
      <div
        className="relative overflow-hidden sm:rounded-container"
        style={{ background: `linear-gradient(155deg, ${color.primary} 0%, ${mid} 55%, ${dark} 100%)`, color: color.text }}
      >
        {/* 장식: 팀 약칭 큰 글씨 (선수 페이지 머리말과 같은 방식) */}
        <span
          aria-hidden
          // deslop-ignore-next-line 11
          className="pointer-events-none absolute -right-3 top-2 select-none whitespace-nowrap text-[7.5rem] font-black leading-none tracking-tighter opacity-10 sm:text-[11rem]"
        >
          {teamShortLabel(teamName, 5)}
        </span>
        <div className="relative flex min-h-[260px] items-end px-4 sm:min-h-[320px] sm:px-8 lg:min-h-[360px] lg:gap-8 lg:px-10">
          <div className="relative z-10 min-w-0 flex-1 pb-5 pt-5 lg:flex-none lg:pb-8 lg:pt-8">
            <p className="inline-flex rounded-control px-2.5 py-1 text-sub font-bold lg:text-body" style={{ background: "rgba(0,0,0,0.25)" }}>
              {label} 1위
            </p>
            {/* deslop-ignore-next-line 11 */}
            <h2 className="mt-3 text-[2.1rem] font-black leading-[1.05] tracking-tight [overflow-wrap:anywhere] sm:text-6xl lg:text-7xl">
              <Link href={playerHref(p.id, seasonCode)} className="focus-ring rounded-control underline-offset-4 hover:underline">
                {p.nameKo}
              </Link>
            </h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-body font-semibold opacity-90 lg:mt-3">
              <TeamLink code={p.teamCode} season={seasonCode} place="home_hero" className="inline-flex min-h-10 items-center gap-1.5">
                <span className="inline-flex rounded-control bg-white p-0.5">
                  <TeamLogo logoUrl={team?.logoUrl} shortName={teamName} color={color} size={20} />
                </span>
                {teamShortLabel(teamName)}
              </TeamLink>
              <span className="whitespace-nowrap">
                {positionLabel(p.position) ? ` · ${positionLabel(p.position)}` : ""} · {NATIONALITY_LABELS[nationalityOf(p)]}
              </span>
            </p>
            <p className="tabular mt-4 leading-none">
              {/* deslop-ignore-next-line 11 */}
              <span className="text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">{value}</span>
              <span className="ml-1 text-lg font-bold">{unit}</span>
            </p>
            <p className="mt-1.5 text-body font-semibold opacity-90">경기당 {label} {value}{unit}</p>
            <Link
              href={playerHref(p.id, seasonCode)}
              className="focus-ring mt-4 inline-flex h-11 items-center gap-1 rounded-control bg-white px-4 text-body font-bold text-[#0b0b0b] transition-colors duration-200 hover:bg-white/85"
            >
              선수 카드 보기 <IconChevronRight size={16} />
            </Link>
          </div>
          {/* PC 가운데: 이번 시즌 경기당 기록 6칸 — 1280px 부터(1024 에서는 칸이 좁아 "리바운드"·"4.0점"이 꺾인다) */}
          <div className="relative z-10 hidden min-w-0 flex-1 self-center xl:block">
          <dl className="grid grid-cols-3 gap-2 xl:gap-3">
            {heroStatLine(p).map((s) => {
              const on = s.key === statKey;
              return (
                <div
                  key={s.key}
                  className="rounded-card px-3 py-2.5 xl:px-4 xl:py-3"
                  style={{ background: on ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.2)", boxShadow: on ? "inset 0 0 0 2px rgba(255,255,255,0.7)" : undefined }}
                >
                  <dt className="whitespace-nowrap text-sub font-semibold opacity-85">{LEADER_STATS[s.key].label}</dt>
                  {/* deslop-ignore-next-line 11 */}
                  <dd className="tabular mt-0.5 whitespace-nowrap text-3xl font-black leading-none tracking-tight">
                    {formatStat(s.value, s.key, "perGame")}
                    <span className="ml-0.5 text-sub font-bold opacity-85">{HOME_UNITS[s.key] ?? ""}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
            <p className="mt-2 text-sub font-semibold opacity-85">
              {p.games}경기 · {p.wins}승 {p.losses}패 · 경기당 기록
            </p>
          </div>
          <Link href={playerHref(p.id, seasonCode)} tabIndex={-1} aria-hidden className="relative -mr-3 shrink-0 self-end sm:mr-0">
            <span className="sm:hidden">
              <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={color} variant="portrait" size={220} />
            </span>
            <span className="hidden sm:inline lg:hidden">
              <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={color} variant="portrait" size={310} />
            </span>
            <span className="hidden lg:inline">
              <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={color} variant="portrait" size={350} />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
