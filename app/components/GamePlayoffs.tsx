"use client";
// 54-0 플레이오프 이어 하기 (2026-11-08) — 규칙·계산은 lib/game-playoffs.ts, 여기서는 보여 주기만.
// 정규리그 1위(39승 이상)면 "플레이오프 이어서 하기" 버튼 → 4강(5전 3승)·챔프전(7전 4승)을 한 경기씩 펼쳐 보인다.
// 경기마다 점수·최고 활약, 시리즈가 끝나면 선수별 평균·시리즈 MVP (2026-11-09).
// 같은 라인업은 늘 같은 결과(시드) — 다시 눌러도 결과는 같다. 동작 줄이기 설정이면 한 번에 보인다.
import { useEffect, useState } from "react";
import { GAME_PLAYOFF_SEED_WINS, PLAYOFF_NO_RECORD_FORM, boxLineText, formOf, playoffVerdict, type PlayoffResult } from "@/lib/game-playoffs";
import type { GameCandidate } from "@/lib/game";
import type { ThemeColors } from "./useThemeColors";

const STEP_MS = 420;
const PO_COLS = [
  { key: "ppg", label: "득점" },
  { key: "rpg", label: "리바" },
  { key: "apg", label: "어시" },
  { key: "spg", label: "스틸" },
  { key: "bpg", label: "블록" },
] as const;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export type PlayoffPhase = "idle" | "playing" | "done";

/** 선수 플레이오프 폼 한 줄 "+8%" · "−6%" · "기록 없음" */
function formText(c: GameCandidate): string {
  if (!c.po) return `플옵 기록 없음 ${Math.round((PLAYOFF_NO_RECORD_FORM - 1) * 100)}%`;
  const d = Math.round((c.po.f - 1) * 100);
  return d === 0 ? `플옵 ${c.po.g}경기 · 그대로` : `플옵 ${c.po.g}경기 · ${d > 0 ? "+" : "−"}${Math.abs(d)}%`;
}

export default function GamePlayoffs({
  wins,
  playoff,
  players,
  phase,
  colors,
  onStart,
  onDone,
}: {
  wins: number;
  playoff: PlayoffResult | null;
  players: readonly GameCandidate[];
  phase: PlayoffPhase;
  colors: ThemeColors;
  onStart: () => void;
  onDone: () => void;
}) {
  const totalGames = playoff ? playoff.rounds.reduce((s, r) => s + r.games.length, 0) : 0;
  const [shown, setShown] = useState(phase === "done" ? totalGames : 0);

  useEffect(() => {
    if (phase !== "playing") {
      if (phase === "done") setShown(totalGames);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(totalGames);
      onDone();
      return;
    }
    setShown(0);
    let n = 0;
    const t = window.setInterval(() => {
      n++;
      setShown(n);
      if (n >= totalGames) {
        window.clearInterval(t);
        onDone();
      }
    }, STEP_MS);
    return () => window.clearInterval(t);
    // onDone 은 부모가 매번 새로 만든다 — 단계가 바뀔 때만 돈다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, totalGames]);

  if (!playoff) {
    const short = GAME_PLAYOFF_SEED_WINS - wins;
    return (
      <section aria-label="플레이오프" className="surface-card mt-3 rounded-container px-4 py-3">
        <p className="text-sub font-bold text-ink">플레이오프는 정규리그 1위만</p>
        <p className="mt-0.5 text-sub text-ink-2">
          {GAME_PLAYOFF_SEED_WINS}승 이상이면 1위로 플레이오프에 나가요. 이번엔 {short}승 모자라요.
        </p>
      </section>
    );
  }

  const nameOf = (id: string) => players.find((p) => p.id === id)?.nameKo ?? "";
  const ups = players.filter((p) => p.po && p.po.f > 1);
  const downs = players.filter((p) => formOf(p) < 1);
  let left = shown;
  const done = phase === "done";

  return (
    <section aria-label="플레이오프" className="surface-card mt-3 rounded-container p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-h2 font-bold text-ink">{done ? playoffVerdict(playoff) : "정규리그 1위! 플레이오프 진출"}</h2>
        <p className="tabular text-sub text-ink-2">
          플레이오프 전력 {playoff.rating.rating.toFixed(1)} · 우승 확률 {pct(playoff.titleProb)}
        </p>
      </div>
      {phase === "idle" && (
        <>
          <p className="mt-1 text-sub text-ink-2">
            1위라 6강은 건너뛰고 4강(5전 3승)부터. 선수마다 그 시즌 플레이오프 기록으로 전력을 다시 매겨요.
          </p>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {players.map((p) => {
              const f = formOf(p);
              return (
                <li key={p.id} className="tabular flex items-baseline justify-between gap-2 rounded-control border border-line px-3 py-2 text-sub">
                  <span className="min-w-0 truncate font-semibold text-ink">
                    {p.nameKo} <span className="font-normal text-ink-3">{p.season}</span>
                  </span>
                  <span className={`shrink-0 ${f > 1 ? "font-bold text-ink" : "text-ink-2"}`}>{formText(p)}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-caption text-ink-3">
            {ups.length > 0 ? `큰 경기에 강했던 선수 ${ups.length}명` : "큰 경기에서 더 잘한 선수는 없어요"}
            {downs.length > 0 ? ` · 플레이오프에서 주춤한 선수 ${downs.length}명` : ""}
          </p>
          <button
            type="button"
            onClick={onStart}
            className="focus-ring mt-3 h-12 w-full cursor-pointer rounded-control bg-ink text-body font-bold text-surface transition-colors duration-200 hover:bg-ink-2"
          >
            플레이오프 이어서 하기
          </button>
        </>
      )}
      {phase !== "idle" && (
        <ol className="mt-3 space-y-3" aria-live="polite">
          {playoff.rounds.map((r) => {
            const visible = Math.min(r.games.length, Math.max(0, left));
            left -= r.games.length;
            if (visible === 0 && !done) return null;
            let w = 0;
            let l = 0;
            for (const g of r.games.slice(0, visible)) g ? w++ : l++;
            const finished = visible === r.games.length;
            return (
              <li key={r.key} className="rounded-card border border-line p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-body font-bold text-ink">
                    {r.label} <span className="text-sub font-normal text-ink-2">vs {r.oppLabel}</span>
                  </p>
                  <p className="tabular text-caption text-ink-3">
                    한 경기 승리 확률 {pct(r.gameProb)} · 시리즈 {pct(r.seriesProb)}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  {r.games.slice(0, visible).map((g, i) => (
                    <span
                      key={i}
                      className={`tabular inline-flex h-8 w-8 items-center justify-center rounded-control text-sub font-bold ${g ? "bg-ink text-surface" : "border border-line text-ink-3"}`}
                    >
                      {g ? "승" : "패"}
                    </span>
                  ))}
                  <span className="tabular ml-auto text-h2 font-black text-ink">
                    {w}-{l}
                  </span>
                </div>
                {/* 경기마다 점수와 그 경기 최고 활약 */}
                <ul className="tabular mt-2 space-y-1 text-sub">
                  {r.box.slice(0, visible).map((g, i) => {
                    const top = g.lines.find((l) => l.id === g.topId)!;
                    return (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="w-12 shrink-0 text-ink-3">{i + 1}차전</span>
                        <span className={`w-20 shrink-0 font-semibold ${g.win ? "text-ink" : "text-ink-2"}`}>
                          {g.win ? "승" : "패"} {g.score}-{g.oppScore}
                        </span>
                        <span className="min-w-0 text-ink-2">
                          <span className="font-semibold text-ink">{nameOf(g.topId)}</span> {boxLineText(top)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {finished && (
                  <>
                    <p className="mt-2 text-sub font-semibold text-ink">{r.won ? (r.key === "final" ? "챔피언!" : "챔프전 진출") : r.key === "final" ? "준우승" : "4강 탈락"}</p>
                    <table className="tabular mt-2 w-full table-fixed text-caption">
                      <caption className="mb-1 text-left text-sub text-ink-2">
                        {r.won ? (r.key === "final" ? "챔프전 MVP" : "시리즈 MVP") : "팀 최고 활약"} <span className="font-bold text-ink">{nameOf(r.starId)}</span> · 시리즈 평균
                      </caption>
                      <thead>
                        <tr className="text-ink-3">
                          <th scope="col" className="w-[34%] py-1 text-left font-medium">선수</th>
                          {PO_COLS.map((c) => (
                            <th key={c.key} scope="col" className="py-1 text-right font-medium">
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line border-y border-line">
                        {r.averages.map((a) => (
                          <tr key={a.id} className={a.id === r.starId ? "font-bold text-ink" : "text-ink-2"}>
                            <th scope="row" className="truncate py-1 text-left font-semibold text-ink">
                              {nameOf(a.id)}
                            </th>
                            {PO_COLS.map((c) => (
                              <td key={c.key} className="py-1 text-right">
                                {a[c.key].toFixed(1)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {done && playoff.champion && (
        <p className="mt-3 rounded-control px-3 py-2 text-body font-bold" style={{ background: colors.gradeS, color: colors.gradeSInk }}>
          {wins}승 정규리그 1위에 챔프전 우승까지. 통합 우승이에요.
          {playoff.finalsMvpId && <span className="block text-sub font-semibold">챔프전 MVP {nameOf(playoff.finalsMvpId)}</span>}
        </p>
      )}
    </section>
  );
}
