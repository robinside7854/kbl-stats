"use client";
// 내 계정 화면의 "54-0 내 기록" (2026-10-04): 판 수·최고 성적·전승 횟수 + 최근 라인업 목록(다시 보기 = 공유 주소, 지우기)
import Link from "next/link";
import { useEffect, useState } from "react";
import { GAME_HISTORY_LIMIT, type GameHistory, type GameRecord } from "@/lib/account";
import { fetchGameHistory, removeGameRecord } from "./account-client";
import { IconClose } from "./icons";
import Skeleton from "./Skeleton";
import { trackEvent } from "./track";

const VISIBLE = 5;
const BONUS_LABELS: Record<string, string> = { school: "동문 케미", prime: "프라임 타임", champion: "우승 DNA" };

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function GameHistoryCard() {
  const [history, setHistory] = useState<GameHistory | null | "error">(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchGameHistory().then((h) => alive && setHistory(h ?? "error"));
    return () => {
      alive = false;
    };
  }, []);

  async function remove(r: GameRecord) {
    setBusy(r.lineup);
    const h = await removeGameRecord(r.lineup);
    setBusy(null);
    if (h) {
      setHistory(h);
      trackEvent("game_record_delete", { wins: r.wins });
    }
  }

  return (
    <section id="game-history" aria-labelledby="game-history-title" className="surface-card rounded-container p-4">
      <h2 id="game-history-title" className="text-body font-bold">
        54-0 내 기록
      </h2>
      {history === null ? (
        <div className="mt-2 space-y-2" aria-busy="true" aria-label="불러오는 중">
          <Skeleton className="h-12 rounded-card" />
          <Skeleton className="h-14 rounded-card" />
        </div>
      ) : history === "error" ? (
        <p className="mt-1 text-body text-ink-2">기록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
      ) : history.plays === 0 ? (
        <p className="mt-1 text-body text-ink-2">
          아직 기록이 없어요. 로그인한 채로 54-0을 끝까지 하면 여기에 쌓여요.{" "}
          <Link href="/game" className="focus-ring rounded-control font-semibold text-ink underline underline-offset-2">
            54-0 하러 가기
          </Link>
        </p>
      ) : (
        <>
          <dl className="tabular mt-2 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "라인업", value: `${history.plays}개` },
              { label: "최고 성적", value: history.best === null ? "–" : `${history.best}-${54 - history.best}` },
              { label: "전승", value: `${history.perfect}번` },
            ].map((s) => (
              <div key={s.label} className="rounded-card bg-surface-2 px-2 py-2">
                <dt className="text-caption text-ink-3">{s.label}</dt>
                <dd className="text-h2 font-bold text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-3 divide-y divide-line">
            {(showAll ? history.records : history.records.slice(0, VISIBLE)).map((r) => (
              <li key={r.lineup} className="flex items-center gap-2 py-2">
                <Link
                  href={`/game?l=${r.lineup}`}
                  className="focus-ring-inset -my-1 flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-control py-1 transition-colors duration-200 hover:bg-surface-2"
                >
                  <span className={`tabular w-14 shrink-0 text-right text-body font-bold ${r.wins === 54 ? "text-ink" : "text-ink-2"}`}>
                    {r.wins}-{54 - r.wins}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sub text-ink">{r.names.map((n) => n.replace(/ \S+$/u, "")).join(" · ")}</span>
                    <span className="tabular block truncate text-caption text-ink-3">
                      {dateLabel(r.playedAt)} · 전력 {r.rating.toFixed(1)}
                      {r.bonuses.length > 0 && ` · ${r.bonuses.map((b) => BONUS_LABELS[b] ?? b).join(", ")}`}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => remove(r)}
                  disabled={busy === r.lineup}
                  aria-label={`${r.wins}-${54 - r.wins} 기록 지우기`}
                  className="focus-ring flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-3 transition-colors duration-200 hover:bg-surface-2 hover:text-ink disabled:cursor-default"
                >
                  <IconClose size={16} />
                </button>
              </li>
            ))}
          </ul>
          {!showAll && history.records.length > VISIBLE && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="focus-ring mt-1 h-10 w-full cursor-pointer rounded-control border border-line bg-surface text-sub font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
            >
              더 보기 ({history.records.length - VISIBLE}개)
            </button>
          )}
          {history.plays > history.records.length && (
            <p className="mt-2 text-caption text-ink-3">최근 {GAME_HISTORY_LIMIT}개만 보여요.</p>
          )}
        </>
      )}
    </section>
  );
}
