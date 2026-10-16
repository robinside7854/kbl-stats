"use client";
// 경기 승부 예측 (2026-10-16, 로드맵 1단계 — 로그인 회원만): 아직 안 한 경기 카드의 승리 확률 막대 아래 "누가 이길까요?" 두 버튼(홈 | 원정).
// 경기 시작 전까지 바꿀 수 있고(서버가 시작 시각으로 막음), 팬 예측 비율 "팬 12명 · DB 62%". 끝난 경기는 내가 예측했을 때만 "내 예측 적중/빗나감" 한 줄.
// 로그인 안 한 방문자: 비율만 + "로그인하고 예측하기" 링크(login_prompt_click place=pick). 로그인이 꺼진 빌드면 아무것도 안 그린다.
// 요청: 공개 예측 수는 아직 안 한 경기가 보일 때만 한 번(/api/picks, 1분 기억), 내 예측은 로그인한 적 있는 브라우저만(/api/me/picks).
// variant="row": 홈 "다음 경기" 줄 아래 — 로그인 회원에게만 두 버튼과 비율(로그인 안 했으면 아무것도 안 그림).
// GA4: pick_make {game_key, place}, login_prompt_click {place: pick}.
import Link from "next/link";
import { useEffect, useState } from "react";
import { isPickOpen, pickShare, type PickSide } from "@/lib/votes";
import type { SeasonGame, TeamColor } from "@/lib/types";
import { teamShortLabel } from "@/lib/images";
import { makePick, participationOn, useGamePicks } from "./vote-client";
import { hasSignedInHint } from "./account-client";
import { IconChevronRight } from "./icons";
import { trackEvent } from "./track";

interface TeamInfo {
  shortName: string;
  color: TeamColor;
}

interface Props {
  game: Pick<SeasonGame, "gmkey" | "date" | "start" | "ended" | "home" | "away">;
  home: TeamInfo;
  away: TeamInfo;
  place: "home" | "schedule";
  variant?: "card" | "row";
  className?: string;
}

/** 끝난 경기 적중 표시는 최근 이 기간만 (옛 시즌 일정 화면에서 내 예측을 부르지 않게) */
const RESULT_DAYS = 200;

export default function GamePick(props: Props) {
  // 정적 HTML 에는 그리지 않는다 (마감 판정에 지금 시각이 필요 — 브라우저에서만)
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  if (!now || !participationOn()) return null;
  const g = props.game;
  if (g.ended && now.getTime() - Date.parse(`${g.date}T00:00:00+09:00`) > RESULT_DAYS * 86_400_000) return null;
  // 홈 다음 경기 줄은 로그인 회원에게만 (로그인 안 한 방문자는 공개 예측 수도 부르지 않는다)
  if (props.variant === "row" && !hasSignedInHint()) return null;
  return <PickBody {...props} now={now} />;
}

function PickBody({ game: g, home, away, place, variant = "card", className = "", now }: Props & { now: Date }) {
  const open = isPickOpen(g, now);
  const { counts, mine, signedIn } = useGamePicks(!g.ended);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const my = mine?.picks[g.gmkey] ?? null;
  const share = pickShare(counts?.[g.gmkey]);
  const nameOf = (s: PickSide) => (s === "home" ? home : away).shortName;

  async function choose(side: PickSide) {
    if (busy || side === my) return;
    setBusy(true);
    setMsg(null);
    const r = await makePick(g.gmkey, side);
    setBusy(false);
    if (r.ok) trackEvent("pick_make", { game_key: g.gmkey, place });
    else setMsg(r.message);
  }

  // 끝난 경기: 내가 예측했을 때만 결과 한 줄
  if (g.ended) {
    if (!my || g.home.score === null || g.away.score === null || g.home.score === g.away.score) return null;
    const winner: PickSide = g.home.score > g.away.score ? "home" : "away";
    const hit = winner === my;
    return (
      <p className={`text-caption ${className}`}>
        <span className={`rounded-control border px-1.5 py-0.5 font-semibold ${hit ? "border-series-1 text-series-1" : "border-line text-ink-2"}`}>
          내 예측 {hit ? "적중" : "빗나감"}
        </span>
        <span className="ml-1.5 text-ink-3">{teamShortLabel(nameOf(my))} 승 예측</span>
      </p>
    );
  }

  const shareText = share ? `팬 ${share.total.toLocaleString("ko-KR")}명 · ${teamShortLabel(nameOf(share.side))} ${share.pct}%` : null;

  if (!signedIn) {
    if (variant === "row") return null;
    if (!shareText && !open) return null;
    return (
      <div className={`flex min-h-10 flex-wrap items-center justify-between gap-x-3 text-caption text-ink-3 tabular ${className}`}>
        <span>{shareText ?? "승부 예측"}</span>
        {open && (
          <Link href="/me" className="focus-ring link-shortcut text-caption" onClick={() => trackEvent("login_prompt_click", { place: "pick" })}>
            로그인하고 예측
            <IconChevronRight size={16} />
          </Link>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <p className={`flex min-h-6 flex-wrap items-center justify-between gap-x-3 text-caption text-ink-3 tabular ${className}`}>
        <span>
          예측 마감{my ? ` · 내 예측 ${teamShortLabel(nameOf(my))}` : ""}
        </span>
        {shareText && <span>{shareText}</span>}
      </p>
    );
  }

  return (
    <div className={`tabular ${className}`}>
      <p className="flex items-center justify-between gap-2 text-caption text-ink-3">
        <span className="min-w-0 truncate font-semibold text-ink-2">{my ? "내 예측 · 시작 전엔 바꿔도 돼요" : "누가 이길까요?"}</span>
        {shareText && <span className="shrink-0 whitespace-nowrap">{shareText}</span>}
      </p>
      <div role="group" aria-label="승부 예측" className="mt-1.5 grid grid-cols-2 gap-2">
        {(["home", "away"] as const).map((side) => {
          const t = side === "home" ? home : away;
          const on = my === side;
          return (
            <button
              key={side}
              type="button"
              aria-pressed={on}
              disabled={busy}
              onClick={() => void choose(side)}
              className={`focus-ring-inset flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-control border px-2 text-sub font-semibold transition-colors duration-200 disabled:cursor-wait ${
                on ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2"
              }`}
            >
              <span
                aria-hidden
                // 팀 색 점
                // deslop-ignore-next-line 19
                className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color.primary }} />
              <span className="truncate">{teamShortLabel(t.shortName)} 승</span>
            </button>
          );
        })}
      </div>
      {msg && (
        <p role="alert" className="mt-1 text-caption text-ink-2">
          {msg}
        </p>
      )}
    </div>
  );
}
