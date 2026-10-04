"use client";
// 경기 카드 한 장 (홈 "오늘의 경기"·일정 화면 공용, 2026-10-03): 원정·홈 팀과 점수(이긴 쪽 굵게), 경기장·시간, 수훈 선수,
// "박스스코어 보기"를 누르면 팝업(2026-10-04 사용자 결정 — 카드 안에 펼치던 것을 바꿈: 폰은 아래에서 올라오는 시트, PC 는 가운데 창이라
// 14열 표가 카드 폭에 눌리지 않는다). 박스스코어는 카드에 들어 있거나(홈) 누를 때 받아 온다(일정 — /games/{시즌}/{날짜}.json).
// GA4: boxscore_open {game_key, season_code, place}.
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GameBoxRow, SeasonGame, TeamColor } from "@/lib/types";
import { gameDayLabel, performerLine, winnerSide } from "@/lib/games";
import { teamShortLabel } from "@/lib/images";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import BoxScore from "./BoxScore";
import { IconClose } from "./icons";
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
}

export const teamInfoOf = (teams: Record<string, GameTeamInfo>, code: string, fallback: string): GameTeamInfo =>
  teams[code] ?? { shortName: fallback, logoUrl: null, color: FALLBACK_TEAM_COLOR };

export default function GameCard({ game: g, seasonCode, teams, stars = null, loadBox, place }: Props) {
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

  async function openBox() {
    setOpen(true);
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
            <span className="ml-1.5 text-caption font-semibold tracking-wide text-ink-3">{s.key === "home" ? "HOME" : "AWAY"}</span>
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
            aria-haspopup="dialog"
            onClick={openBox}
            className="focus-ring mt-2 flex h-10 w-full items-center justify-center gap-1 rounded-control border border-line text-sub font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2"
          >
            박스스코어 보기
          </button>
          {open && (
            <BoxScoreDialog
              title={`${sides[0].info.shortName} ${g.away.score ?? "–"} : ${g.home.score ?? "–"} ${sides[1].info.shortName}`}
              sub={[gameDayLabel(g.date), g.stadium].filter(Boolean).join(" · ")}
              onClose={() => setOpen(false)}
            >
              {box ? (
                <BoxScore
                  seasonCode={seasonCode}
                  sides={sides.map((s) => ({ key: s.key, name: s.info.shortName, rows: box[s.key] }))}
                />
              ) : loading ? (
                <Skeleton className="mt-2 h-48 w-full" />
              ) : failed ? (
                <p className="mt-2 text-sub text-ink-3">박스스코어를 불러오지 못했습니다</p>
              ) : null}
            </BoxScoreDialog>
          )}
        </>
      )}
    </article>
  );
}

/** 박스스코어 팝업: 폰 = 아래 시트(화면 높이 90%), PC(768px 이상) = 가운데 창. 바깥·ESC·닫기로 닫힘, 열린 동안 뒤 화면 스크롤 잠금, 닫으면 누른 버튼으로 포커스 복귀 */
function BoxScoreDialog({ title, sub, onClose, children }: { title: string; sub: string; onClose: () => void; children: React.ReactNode }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  // 부모가 다시 그려도(박스스코어를 받아 오는 중) 열 때 한 번만 준비하도록 닫기 함수는 ref 로
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-6">
      <div aria-hidden className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-container border-t border-line bg-surface md:max-h-[85dvh] md:max-w-4xl md:rounded-container md:border"
      >
        <div className="flex items-start justify-between gap-2 px-4 pb-1 pt-3">
          <div className="min-w-0">
            <h2 id={titleId} className="tabular truncate text-h2 font-bold">
              {title}
            </h2>
            <p className="text-sub text-ink-3">{sub}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="박스스코어 닫기"
            className="focus-ring -mr-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-2 transition-colors duration-200 hover:text-ink"
          >
            <IconClose size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
