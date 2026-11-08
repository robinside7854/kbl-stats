"use client";
// 54-0 플레이 수·최고 기록 한 줄 (2026-11-08) — 게임 시작 화면(위)과 결과 공유 칸에서 같이 쓴다.
// 숫자는 /api/game/stats (game-stats-client). 못 받으면 아무것도 그리지 않는다.
import Link from "next/link";
import { weekTopPercent, type GamePlayStats } from "@/lib/account";
import { recordLabel } from "@/lib/game-share";
import { IconChevronRight } from "./icons";

const n = (v: number) => v.toLocaleString("ko-KR");

/** 시작 화면: "지금까지 5,612판 · 이번 주 87명 도전 · 최고 기록 54-0 로방" */
export function GameStatsStrip({ stats }: { stats: GamePlayStats | null }) {
  if (!stats) return null;
  return (
    <div className="surface-card mb-4 rounded-container px-4 py-3">
      <dl className="tabular grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-caption text-ink-3">지금까지</dt>
          <dd className="text-h2 font-bold text-ink">{n(stats.totalPlays)}판</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-3">이번 주 도전</dt>
          <dd className="text-h2 font-bold text-ink">{n(Math.max(stats.weekPlayers, 0))}명</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-3">54-0 달성 회원</dt>
          <dd className="text-h2 font-bold text-ink">{n(stats.perfectMembers)}명</dd>
        </div>
      </dl>
      {stats.best && (
        <p className="mt-2 flex flex-wrap items-baseline justify-center gap-x-2 border-t border-line pt-2 text-sub text-ink-2">
          <span>
            최고 기록 <span className="tabular font-bold text-ink">{recordLabel(stats.best.wins)}</span> · <span className="font-semibold text-ink">{stats.best.nickname}</span>
          </span>
          <Link href="/game/ranking" className="focus-ring link-shortcut">
            주간 순위
            <IconChevronRight size={16} />
          </Link>
        </p>
      )}
    </div>
  );
}

/** 결과 화면 한 줄: "이번 주 312판 중 상위 4% · 최고 기록 54-0 로방" */
export function GameRankLine({ stats, wins }: { stats: GamePlayStats | null; wins: number }) {
  if (!stats) return null;
  const top = weekTopPercent(stats.weekHist, wins);
  return (
    <p className="tabular mt-1 text-sub text-ink-2">
      {top != null && (
        <>
          이번 주 {n(stats.weekPlays)}판 중 <span className="font-bold text-ink">상위 {top}%</span>
        </>
      )}
      {top != null && stats.best ? " · " : ""}
      {stats.best && (
        <>
          최고 기록 {recordLabel(stats.best.wins)} {stats.best.nickname}
        </>
      )}
    </p>
  );
}
