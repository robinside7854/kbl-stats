"use client";
// 경기 카드 한 장 (홈 "오늘의 경기"·일정 화면 공용, 2026-10-03): 스코어보드는 좌우 배치(2026-10-05 사용자 — 위아래는 팀과 점수가 멀고
// 승자가 잘 안 보였다): **홈 팀이 늘 왼쪽** | 점수 "88 : 85"(이긴 쪽 진하게) | 원정 팀, 이긴 팀 이름 아래 "승" 표시. 그 아래 경기장·시간, 수훈 선수,
// "박스스코어 보기"를 누르면 팝업(2026-10-04 사용자 결정 — 카드 안에 펼치던 것을 바꿈: 폰은 아래에서 올라오는 시트, PC 는 가운데 창이라
// 14열 표가 카드 폭에 눌리지 않는다). 박스스코어는 카드에 들어 있거나(홈) 누를 때 받아 온다(일정 — /games/{시즌}/{날짜}.json).
// 하이라이트 영상(2026-10-04, game.highlight = TVING SPORTS 유튜브 영상 번호)이 있으면 "하이라이트" 버튼 → 같은 팝업에 youtube-nocookie 영상.
// 영상 틀은 팝업을 열 때만 만든다(평소 화면은 유튜브에 요청하지 않음).
// GA4: boxscore_open {game_key, season_code, place}, highlight_open {game_key, season_code, place}.
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GameBoxRow, SeasonGame, TeamColor } from "@/lib/types";
import { gameDayLabel, gameKeyPoints, STANDOUT_LABELS, standoutLine, winnerSide, type Standout } from "@/lib/games";
import { teamShortLabel } from "@/lib/images";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import BoxScore from "./BoxScore";
import { IconClose, IconExternal, IconPlay } from "./icons";
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
  /** 팀별 주요 선수 최대 2명 (lib/games teamStandouts — 일정 화면은 박스스코어 대신 서버가 미리 골라 준다) */
  stars?: { away: Standout[]; home: Standout[] } | null;
  /** 박스스코어를 누를 때 받아 오는 함수 (game.box 가 없을 때) */
  loadBox?: () => Promise<Box | null>;
  place: "home" | "schedule";
  /** 내 응원팀 경기 (홈에서 맨 앞에 올 때 위에 작게 표시, 2026-10-08) */
  mine?: boolean;
}

export const teamInfoOf = (teams: Record<string, GameTeamInfo>, code: string, fallback: string): GameTeamInfo =>
  teams[code] ?? { shortName: fallback, logoUrl: null, color: FALLBACK_TEAM_COLOR };

export default function GameCard({ game: g, seasonCode, teams, stars = null, loadBox, place, mine = false }: Props) {
  const [open, setOpen] = useState(false);
  const [video, setVideo] = useState(false);
  const [box, setBox] = useState<Box | null>(g.box);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const win = winnerSide(g);
  const hasBox = !!g.box || !!loadBox;
  const sides = (["home", "away"] as const).map((k) => ({
    key: k,
    info: teamInfoOf(teams, g[k].teamCode, g[k].name),
    score: g[k].score,
    won: win === k,
  }));
  const starsOf = (k: "away" | "home") => stars?.[k] ?? [];
  const matchTitle = `${sides[0].info.shortName} ${g.home.score ?? "–"} : ${g.away.score ?? "–"} ${sides[1].info.shortName}`;
  const [homeSide, awaySide] = sides;
  const matchSub = [gameDayLabel(g.date), g.stadium].filter(Boolean).join(" · ");

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
      {mine && <p className="mb-1 text-caption font-semibold text-series-1">내 응원팀 경기</p>}
      {/* 스코어보드: 홈(왼쪽) | 점수 | 원정(오른쪽) */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <TeamSide side={homeSide} />
        <div className="flex flex-col items-center px-1">
          {g.ended ? (
            <p className="flex items-baseline gap-1.5 leading-none" aria-label={`${homeSide.info.shortName} ${homeSide.score ?? "–"}점, ${awaySide.info.shortName} ${awaySide.score ?? "–"}점`}>
              <Score side={homeSide} />
              <span className="text-h2 font-semibold text-ink-3">:</span>
              <Score side={awaySide} />
            </p>
          ) : (
            <p className="text-h2 font-bold leading-none text-ink">{g.start ?? "–"}</p>
          )}
          <p className="mt-1.5 text-caption text-ink-3">{g.ended ? "종료" : g.start ? "시작" : "예정"}</p>
        </div>
        <TeamSide side={awaySide} />
      </div>
      {g.stadium && <p className="mt-1 text-center text-caption text-ink-3">{g.stadium}</p>}
      {(starsOf("away").length > 0 || starsOf("home").length > 0) && (
        <ul className="mt-2 space-y-1.5 border-t border-line pt-2 text-sub">
          {sides.map((s) => {
            const list = starsOf(s.key);
            return list.length > 0 ? (
              <li key={s.key} className="flex min-w-0 gap-1.5">
                <span className="w-14 shrink-0 truncate pt-0.5 text-caption text-ink-3">{teamShortLabel(s.info.shortName)}</span>
                <ul className="min-w-0 flex-1 space-y-0.5">
                  {list.map((st) => (
                    <li key={st.row.id} className="flex min-w-0 items-baseline gap-1.5">
                      <span className="w-8 shrink-0 rounded-sm bg-surface-2 text-center text-caption font-semibold text-ink-2">{STANDOUT_LABELS[st.kind]}</span>
                      <Link
                        href={`/player/${st.row.id}?season=${seasonCode}`}
                        className="focus-ring min-w-0 truncate rounded-md font-semibold text-ink underline-offset-2 hover:underline"
                      >
                        {st.row.nameKo}
                      </Link>
                      <span className="shrink-0 text-ink-2">{standoutLine(st)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ) : null;
          })}
        </ul>
      )}
      {g.ended && (hasBox || g.highlight) && (
        <>
          <div className={`mt-2 grid gap-2 ${hasBox && g.highlight ? "grid-cols-2" : "grid-cols-1"}`}>
            {hasBox && (
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={openBox}
                className="focus-ring flex h-10 w-full items-center justify-center gap-1 rounded-control border border-line text-sub font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2"
              >
                박스스코어 보기
              </button>
            )}
            {g.highlight && (
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => {
                  setVideo(true);
                  trackEvent("highlight_open", { game_key: g.gmkey, season_code: seasonCode, place });
                }}
                className="focus-ring flex h-10 w-full items-center justify-center gap-1 rounded-control border border-line text-sub font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2"
              >
                <IconPlay size={16} /> 하이라이트
              </button>
            )}
          </div>
          {video && g.highlight && (
            <BoxScoreDialog title={matchTitle} sub={`하이라이트 · ${gameDayLabel(g.date)}`} onClose={() => setVideo(false)}>
              <div className="aspect-video w-full overflow-hidden rounded-card bg-black">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(g.highlight)}?autoplay=1&rel=0&playsinline=1`}
                  title={`${matchTitle} 하이라이트`}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="h-full w-full"
                />
              </div>
              <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-caption text-ink-3">
                <span>영상 © TVING SPORTS · KBL</span>
                <a
                  href={`https://www.youtube.com/watch?v=${encodeURIComponent(g.highlight)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring link-shortcut gap-1 px-1 text-sub"
                >
                  유튜브에서 보기 <IconExternal size={16} />
                </a>
              </p>
            </BoxScoreDialog>
          )}
          {open && (
            <BoxScoreDialog
              title={matchTitle}
              sub={matchSub}
              onClose={() => setOpen(false)}
            >
              {box ? (
                <>
                  <KeyPoints game={{ ...g, box }} names={{ home: homeSide.info.shortName, away: awaySide.info.shortName }} />
                  <BoxScore
                    seasonCode={seasonCode}
                    sides={sides.map((s) => ({ key: s.key, name: s.info.shortName, rows: box[s.key] }))}
                  />
                </>
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

/** 박스스코어·하이라이트 팝업: 폰 = 아래 시트(화면 높이 90%), PC(768px 이상) = 가운데 창. 바깥·ESC·닫기로 닫힘, 열린 동안 뒤 화면 스크롤 잠금, 닫으면 누른 버튼으로 포커스 복귀 */
/** 이 경기 포인트 (lib/games gameKeyPoints — 박스스코어 숫자로 만든 요점, 없으면 안 보임) */
function KeyPoints({ game, names }: { game: SeasonGame; names: { home: string; away: string } }) {
  const points = gameKeyPoints(game, names);
  if (points.length === 0) return null;
  return (
    <section aria-label="이 경기 포인트" className="mb-3 rounded-card bg-surface-2 px-3 py-2.5">
      <h3 className="text-sub font-bold text-ink">이 경기 포인트</h3>
      <ul className="mt-1 space-y-0.5">
        {points.map((p) => (
          <li key={p} className="flex gap-2 text-body text-ink break-keep">
            <span aria-hidden className="text-[var(--series-1)]">·</span>
            <span className="tabular">{p}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

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
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-container border-t border-line bg-surface md:max-h-[85dvh] md:max-w-5xl md:rounded-container md:border"
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

interface SideView {
  key: "home" | "away";
  info: GameTeamInfo;
  score: number | null;
  won: boolean;
}

/** 스코어보드 한쪽 팀: 로고·이름·HOME/AWAY, 이긴 팀은 "승" 표시 */
function TeamSide({ side: s }: { side: SideView }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <TeamLogo logoUrl={s.info.logoUrl} shortName={s.info.shortName} color={s.info.color} size={36} />
      <span className={`mt-1 w-full truncate text-body ${s.won ? "font-bold text-ink" : "font-medium text-ink-2"}`}>{s.info.shortName}</span>
      <span className="mt-0.5 flex items-center gap-1 text-caption font-semibold tracking-wide text-ink-3">
        {s.key === "home" ? "HOME" : "AWAY"}
        {s.won && <span className="rounded-sm bg-ink px-1 text-caption font-bold tracking-normal text-bg">승</span>}
      </span>
    </div>
  );
}

/** 점수 한쪽: 이긴 쪽은 진한 검정, 진 쪽은 옅은 회색 */
function Score({ side: s }: { side: SideView }) {
  return <span className={`text-h1 ${s.won ? "font-black text-ink" : "font-semibold text-ink-3"}`}>{s.score ?? "–"}</span>;
}
