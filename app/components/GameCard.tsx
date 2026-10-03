"use client";
// 경기 카드 한 장 (홈 "오늘의 경기"·일정 화면 공용, 2026-10-03): 원정·홈 팀과 점수(이긴 쪽 굵게), 경기장·시간, 수훈 선수,
// "선수 기록"을 누르면 박스스코어(BoxScore). 박스스코어는 카드에 들어 있거나(홈) 누를 때 받아 온다(일정 — /games/{시즌}/{날짜}.json).
// GA4: boxscore_open {game_key, season_code, place}.
import Link from "next/link";
import { useState } from "react";
import type { GameBoxRow, SeasonGame, TeamColor } from "@/lib/types";
import { performerLine, winnerSide } from "@/lib/games";
import { teamShortLabel } from "@/lib/images";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import BoxScore from "./BoxScore";
import { IconChevronDown, IconChevronUp } from "./icons";
import Skeleton from "./Skeleton";
import TeamLogo from "./TeamLogo";
import { trackEvent } from "./track";

export interface GameTeamInfo {
  shortName: string;
  logoUrl: string | null;
  color: TeamColor;
}

type Box = NonNullable<SeasonGame["box"]>;

interface Props {
  game: SeasonGame;
  seasonCode: number;
  teams: Record<string, GameTeamInfo>;
  /** 팀별 최다 득점 선수 (박스스코어를 안 들고 있는 일정 화면은 서버가 미리 골라 준다) */
  stars?: { away: GameBoxRow | null; home: GameBoxRow | null } | null;
  /** 박스스코어를 누를 때 받아 오는 함수 (game.box 가 없을 때) */
  loadBox?: () => Promise<Box | null>;
  place: "home" | "schedule";
  /** 펼쳤다 접을 때 (일정 화면: 펼친 카드는 두 칸을 차지) */
  onOpenChange?: (open: boolean) => void;
}

export const teamInfoOf = (teams: Record<string, GameTeamInfo>, code: string, fallback: string): GameTeamInfo =>
  teams[code] ?? { shortName: fallback, logoUrl: null, color: FALLBACK_TEAM_COLOR };

export default function GameCard({ game: g, seasonCode, teams, stars = null, loadBox, place, onOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<Box | null>(g.box);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const win = winnerSide(g);
  const hasBox = !!g.box || !!loadBox;
  const sides = (["away", "home"] as const).map((k) => ({
    key: k,
    info: teamInfoOf(teams, g[k].teamCode, g[k].name),
    score: g[k].score,
    won: win === k,
  }));
  const starOf = (k: "away" | "home") => stars?.[k] ?? null;

  async function toggle() {
    const next = !open;
    setOpen(next);
    onOpenChange?.(next);
    if (!next) return;
    trackEvent("boxscore_open", { game_key: g.gmkey, season_code: seasonCode, place });
    if (box || !loadBox) return;
    setLoading(true);
    setFailed(false);
    try {
      const b = await loadBox();
      setBox(b);
      if (!b) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="surface-card tabular rounded-container p-3">
      {sides.map((s) => (
        <div key={s.key} className="flex min-h-10 items-center gap-2.5">
          <TeamLogo logoUrl={s.info.logoUrl} shortName={s.info.shortName} color={s.info.color} size={28} />
          <span className={`min-w-0 flex-1 truncate text-body ${s.won ? "font-bold text-ink" : "font-medium text-ink-2"}`}>
            {s.info.shortName}
            <span className="ml-1 text-caption font-medium text-ink-3">{s.key === "home" ? "홈" : "원정"}</span>
          </span>
          <span className={`text-h2 leading-none ${s.won ? "font-black text-ink" : "font-semibold text-ink-3"}`}>
            {g.ended ? (s.score ?? "–") : ""}
          </span>
        </div>
      ))}
      <p className="mt-1 text-caption text-ink-3">
        {[g.ended ? "종료" : g.start ? `${g.start} 시작` : "예정", g.stadium].filter(Boolean).join(" · ")}
      </p>
      {(starOf("away") || starOf("home")) && (
        <ul className="mt-2 space-y-0.5 border-t border-line pt-2 text-sub">
          {sides.map((s) => {
            const star = starOf(s.key);
            return star ? (
              <li key={s.key} className="flex min-w-0 items-baseline gap-1.5">
                <span className="w-16 shrink-0 truncate text-caption text-ink-3">{teamShortLabel(s.info.shortName)}</span>
                <Link
                  href={`/player/${star.id}?season=${seasonCode}`}
                  className="focus-ring min-w-0 truncate rounded-md font-semibold text-ink underline-offset-2 hover:underline"
                >
                  {star.nameKo}
                </Link>
                <span className="shrink-0 text-ink-2">{performerLine(star)}</span>
              </li>
            ) : null;
          })}
        </ul>
      )}
      {g.ended && hasBox && (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={toggle}
            className="focus-ring mt-2 flex h-10 w-full items-center justify-center gap-1 rounded-control border border-line text-sub font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2"
          >
            선수 기록 {open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </button>
          {open &&
            (box ? (
              <BoxScore
                seasonCode={seasonCode}
                sides={sides.map((s) => ({ key: s.key, name: s.info.shortName, rows: box[s.key] }))}
              />
            ) : loading ? (
              <Skeleton className="mt-2 h-48 w-full" />
            ) : failed ? (
              <p className="mt-2 text-sub text-ink-3">선수 기록을 불러오지 못했습니다</p>
            ) : null)}
        </>
      )}
    </article>
  );
}
