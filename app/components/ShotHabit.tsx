"use client";
// 선수 상세 "슛 습관의 변화" (2026-10-16 "우리만의 기능"): 시즌마다 슛을 던진 구역 비중을 100% 가로 막대로 쌓아 나란히.
// 줄 = 슛 50개 이상 시즌(lib/shot-habit), 색 = 구역 5개(범주형 --cat-1~5, 안쪽 → 바깥 순서), 막대 안 숫자는 12%(폰)·6%(넓은 화면) 이상 칸만.
// 위에 한 줄 요약(첫 시즌 → 마지막 시즌 가장 많이 바뀐 묶음). 계산은 서버에서 끝나 여기서는 그리기만 — 누르는 것 없음(GA4 없음).
// 클라이언트 컴포넌트인 까닭: 서버 컴포넌트면 그린 결과(칸마다 class·style)가 페이지 데이터(RSC)에 한 번 더 들어간다 — 숫자만 넘기는 편이 작다.
import { SHOT_ZONES } from "@/lib/shots";
import { shotHabitTakeaway, type ShotHabitRow } from "@/lib/shot-habit";
import InfoLink from "./InfoLink";

/** 막대 안에 숫자를 쓰는 최소 비중 (좁은 칸은 숫자가 넘친다) — 폰 12%, 640px 이상 6% */
const LABEL_MIN_SHARE = 12;
const LABEL_MIN_SHARE_WIDE = 6;
const ZONE_COLOR = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)"];
const NF = new Intl.NumberFormat("ko-KR");

export default function ShotHabit({ rows }: { rows: ShotHabitRow[] }) {
  const takeaway = shotHabitTakeaway(rows);
  if (!takeaway) return null;
  return (
    <section aria-labelledby="shot-habit-title">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="shot-habit-title" className="flex items-center gap-1 text-h2 font-bold">
          슛 습관의 변화 <InfoLink term="shotHabit" className="ml-1" />
        </h2>
        <span className="text-sub text-ink-3">정규시즌 슛 시도 중 구역 비중(%)</span>
      </div>
      <div className="surface-card rounded-container p-4">
        <p className="text-body font-semibold text-ink [word-break:keep-all]">{takeaway}</p>
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-caption text-ink-2" aria-label="색 설명">
          {SHOT_ZONES.map((z, i) => (
            <li key={z.key} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: ZONE_COLOR[i] }} />
              {z.label}
            </li>
          ))}
        </ul>
        <ol className="tabular mt-3 space-y-1.5">
          {rows.map((r) => {
            const summary = SHOT_ZONES.map((z) => `${z.label} ${Math.round(r.shares[z.key])}%`).join(", ");
            return (
              <li key={r.seasonCode} className="grid grid-cols-[2.75rem_minmax(0,1fr)_3.25rem] items-center gap-2 sm:grid-cols-[3.5rem_minmax(0,1fr)_4rem]">
                <span className="text-sub font-semibold text-ink">{r.season}</span>
                <span
                  role="img"
                  aria-label={`${r.season} 시즌: ${summary}`}
                  className="flex h-7 gap-px overflow-hidden rounded-control bg-surface text-caption font-bold [&>span]:flex [&>span]:items-center [&>span]:justify-center"
                  style={{ color: "var(--cat-ink)" }}
                >
                  {SHOT_ZONES.map((z, i) => {
                    const v = r.shares[z.key];
                    if (v <= 0) return null;
                    return (
                      <span key={z.key} style={{ width: `${v}%`, background: ZONE_COLOR[i] }}>
                        {v >= LABEL_MIN_SHARE ? Math.round(v) : v >= LABEL_MIN_SHARE_WIDE ? <span className="hidden sm:inline">{Math.round(v)}</span> : ""}
                      </span>
                    );
                  })}
                </span>
                <span className="text-right text-caption text-ink-3">{NF.format(r.attempts)}개</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
