// 선수 상세 "세부 능력치" — 레이더 6축의 구성 요소마다 백분위 막대 (2026-10-01, Baseball Savant "Percentile Rankings" 참고).
// 막대 길이 = 백분위(0~100), 색 = 낮음 파랑 · 50 회색 · 높음 빨강(lib/teams divergingFill — dataviz 발산형 규칙).
// 숫자는 막대 밖 ink 색 글자(색 위에 글자를 얹지 않는다). 계산은 lib/cardview percentileBarGroups — 여기서는 그리기만.
// 시도 기준 미달·기록 없음은 막대 없이 "–".
import { percentileBarGroups, percentileTone, type SeasonCardView } from "@/lib/cardview";
import { divergingFill } from "@/lib/teams";
import InfoLink from "./InfoLink";

export default function PercentileBars({ view, seasonShort }: { view: SeasonCardView; seasonShort: string }) {
  const groups = percentileBarGroups(view.entry.radar);
  if (groups.length === 0) return null;
  return (
    <section aria-labelledby="pct-bars-title">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="pct-bars-title" className="flex items-center gap-1 text-h2 font-bold">
          세부 능력치 <InfoLink term="radarAxes" className="ml-1" />
        </h2>
        <span className="text-sub text-ink-3">
          {seasonShort} · {view.gradeLabel} 백분위 · 누적 기록은 경기당
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.axis} className="surface-card rounded-container px-3 py-2.5">
            <h3 className="tabular flex items-baseline justify-between text-body font-bold text-ink">
              {g.label}
              <span className="text-sub font-semibold text-ink-2">{g.axisPct === null ? "–" : Math.round(g.axisPct)}</span>
            </h3>
            <ul className="tabular mt-1.5 space-y-1.5">
              {g.rows.map((r) => (
                <li
                  key={r.key}
                  className="grid grid-cols-[minmax(0,1fr)_3.75rem_minmax(3.5rem,5.5rem)_1.75rem] items-center gap-2 text-sub"
                  aria-label={`${r.label} ${r.valueText}, ${r.pct === null ? "백분위 없음(시도 부족 또는 기록 없음)" : `백분위 ${r.pct}`}`}
                >
                  <span className="truncate text-ink-2" aria-hidden>
                    {r.label}
                  </span>
                  <span className="text-right text-ink" aria-hidden>
                    {r.valueText}
                  </span>
                  <span className="relative block h-2 overflow-hidden rounded-md bg-surface-2" aria-hidden>
                    {r.pct !== null && (
                      <span
                        className="absolute inset-y-0 left-0 block rounded-md"
                        style={{ width: `${Math.max(2, r.pct)}%`, background: divergingFill(percentileTone(r.pct)) }}
                      />
                    )}
                  </span>
                  <span className="text-right font-bold text-ink" aria-hidden>
                    {r.pct === null ? "–" : r.pct}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-3">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="block h-2 w-5 rounded-md" style={{ background: divergingFill(-1) }} />
          하위
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="block h-2 w-5 rounded-md" style={{ background: divergingFill(0) }} />
          중간
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="block h-2 w-5 rounded-md" style={{ background: divergingFill(1) }} />
          상위
        </span>
        <span>TOV%는 낮을수록 높은 백분위 · 성공률은 시도가 리그 평균 이상일 때만</span>
      </p>
    </section>
  );
}
