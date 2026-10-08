// 시즌 범위 막대 (2026-10-08 토스 검토 B-9): 그 시즌 경기별 득점·리바운드·어시스트의 최저 ─ 최고 막대 위에
// 평균(파란 점)과 최근 경기(빈 동그라미) 자리. "요즘 잘하나?"를 한 줄로. 계산은 lib/career gameRanges(빌드 때).
import { gameDayLabel } from "@/lib/games";
import { rangePosition, type GameRangeSet } from "@/lib/career";

const NF1 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function GameRangeBars({ data, seasonShort }: { data: GameRangeSet; seasonShort: string }) {
  return (
    <section aria-labelledby="game-range-title" className="surface-card rounded-container p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="game-range-title" className="text-h2 font-bold">
          경기별 기록 범위
        </h2>
        <p className="text-sub text-ink-3">
          {seasonShort} · {data.games}경기 · 최근 {gameDayLabel(data.lastDate)}
        </p>
      </div>
      <ul className="mt-3 grid gap-x-8 gap-y-4 md:grid-cols-3">
        {data.rows.map((r) => {
          const avgAt = rangePosition(r.avg, r.min, r.max);
          const lastAt = rangePosition(r.last, r.min, r.max);
          return (
            <li key={r.key}>
              <p className="flex items-baseline justify-between gap-2">
                <span className="text-body font-semibold text-ink">{r.label}</span>
                <span className="text-sub text-ink-2 tabular">
                  평균 <b className="font-bold text-ink">{NF1.format(r.avg)}</b> · 최근 <b className="font-bold text-ink">{r.last}</b>
                </span>
              </p>
              <div
                className="relative mx-2 mt-3 h-2"
                role="img"
                aria-label={`${r.label} 최저 ${r.min}, 최고 ${r.max}, 평균 ${NF1.format(r.avg)}, 최근 경기 ${r.last}`}
              >
                <span aria-hidden className="absolute inset-0 rounded-control bg-surface-2" />
                {/* deslop-ignore-next-line 19 — 막대 위 점 표시 */}
                <span aria-hidden className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-surface" style={{ left: `${lastAt}%` }} />
                {/* deslop-ignore-next-line 19 */}
                <span aria-hidden className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-series-1" style={{ left: `${avgAt}%` }} />
              </div>
              <p className="mt-1.5 flex justify-between text-caption text-ink-3 tabular">
                <span>최저 {r.min}</span>
                <span>최고 {r.max}</span>
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-3">
        <span className="inline-flex items-center gap-1">
          {/* deslop-ignore-next-line 19 */}
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-series-1" /> 평균
        </span>
        <span className="inline-flex items-center gap-1">
          {/* deslop-ignore-next-line 19 */}
          <span aria-hidden className="h-3 w-3 rounded-full border-2 border-ink" /> 최근 경기
        </span>
      </p>
    </section>
  );
}
