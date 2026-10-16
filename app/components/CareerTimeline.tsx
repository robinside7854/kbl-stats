"use client";
// 선수 상세 "커리어 타임라인" (2026-10-16 "우리만의 기능"): 일이 있었던 시즌만 세로 줄로 — 데뷔·이적·복귀·우승·수상·프라임·커리어 하이·통산 이정표.
// 계산은 서버(lib/timeline careerTimeline via lib/data-career-extra), 여기서는 그리기와 "더 보기"만.
// 시즌이 TIMELINE_VISIBLE 보다 많으면 오래된 시즌부터 그만큼 보이고 나머지는 접는다. GA4: filter_change screen=player filter=timeline value=more
import { Fragment, useState } from "react";
import { TIMELINE_VISIBLE, type TimelineKind, type TimelineSeason } from "@/lib/timeline";
import { IconChevronDown } from "./icons";
import InfoLink from "./InfoLink";
import { TeamLink } from "./EntityLinks";
import { trackFilters } from "./track";

const KIND_LABEL: Record<TimelineKind, string> = {
  debut: "데뷔",
  move: "이적",
  return: "복귀",
  rename: "구단",
  prime: "프라임",
  champion: "우승",
  award: "수상",
  high: "커리어 하이",
  milestone: "이정표",
};

/** 굵게 보이는 줄 (팬이 먼저 찾는 것) */
const STRONG: ReadonlySet<TimelineKind> = new Set(["debut", "champion", "award", "prime"]);

export default function CareerTimeline({ rows }: { rows: TimelineSeason[] }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;
  const shown = open ? rows : rows.slice(0, TIMELINE_VISIBLE);
  const hidden = rows.length - shown.length;

  return (
    <section aria-labelledby="career-timeline-title">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="career-timeline-title" className="flex items-center gap-1 text-h2 font-bold">
          커리어 타임라인 <InfoLink term="careerTimeline" className="ml-1" />
        </h2>
        <span className="text-sub text-ink-3">정규시즌 기준 · 일이 있었던 시즌만</span>
      </div>
      <div className="surface-card rounded-container px-4 py-3">
        {/* PC 는 두 단(위→아래, 다음 단) — 한 줄이 짧아 넓은 화면 오른쪽이 비지 않게 */}
        <ol className="lg:columns-2 lg:gap-10">
          {shown.map((s, i) => {
            const champ = s.items.some((it) => it.kind === "champion");
            const last = i === shown.length - 1 && hidden === 0;
            return (
              <li key={s.seasonCode} className="relative grid break-inside-avoid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 pb-4 last:pb-1">
                {/* 세로 줄과 점 — 우승 시즌 점은 금색 */}
                {!last && <span aria-hidden className="absolute bottom-0 left-[7px] top-4 w-0.5 bg-line" />}
                {/* deslop-ignore-next-line 19 */}
                <span aria-hidden className="relative mt-1.5 block h-4 w-4 rounded-full border-2 border-surface" style={{ background: champ ? "var(--grade-s)" : "var(--ink-3)" }} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="tabular text-body font-bold text-ink">{s.season}</span>
                    <TeamLink code={s.teamCode} season={s.seasonCode} place="career_timeline" className="text-sub text-ink-2">
                      {s.teamName}
                    </TeamLink>
                  </p>
                  {/* 칸 모양은 dl 에 한 번만 (줄마다 class 를 반복하면 페이지가 커진다) */}
                  <dl className="mt-1 grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-sub text-ink [&>dd]:min-w-0 [&>dd]:[word-break:keep-all] [&>dd]:[overflow-wrap:anywhere] [&>dt]:text-caption [&>dt]:leading-5 [&>dt]:text-ink-3">
                    {s.items.map((it, j) => (
                      <Fragment key={j}>
                        <dt>{KIND_LABEL[it.kind]}</dt>
                        <dd className={STRONG.has(it.kind) ? "font-semibold" : undefined}>
                          {it.text}
                          {it.sub && <span className="tabular block text-caption font-normal text-ink-3">{it.sub}</span>}
                        </dd>
                      </Fragment>
                    ))}
                  </dl>
                </div>
              </li>
            );
          })}
        </ol>
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              trackFilters("player", { timeline: "more" });
            }}
            className="focus-ring mt-1 flex h-11 w-full cursor-pointer items-center justify-center gap-1 rounded-control border border-line text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
          >
            {hidden}시즌 더 보기 <IconChevronDown size={16} />
          </button>
        )}
      </div>
    </section>
  );
}
