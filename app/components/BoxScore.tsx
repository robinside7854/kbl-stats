"use client";
// 경기 박스스코어 (홈 "오늘의 경기"·일정 화면 공용, 2026-10-03).
// - 팀 고르기(원정·홈) → 표. 머리글을 누르면 그 열 내림차순(기본 득점순, lib/games sortBoxRows)
// - 열: 분·득점·리바·어시·스틸·블록·턴오버 / 야투(성공/시도)·야투%·3점·자유투.
//   폰(640px 미만)은 가로 스크롤 없이 "기본 / 슈팅" 두 보기로 나누고, 그 이상은 한 표에 전부.
// GA4: filter_change screen=boxscore (sort·view).
import Link from "next/link";
import { useState } from "react";
import type { GameBoxRow } from "@/lib/types";
import { fgPctOf, minutesLabel, sortBoxRows, type BoxSortKey } from "@/lib/games";
import Segmented from "./Segmented";
import { trackFilters } from "./track";

type View = "basic" | "shoot";

interface Col {
  key: BoxSortKey;
  label: string;
  /** 폰(640px 미만) 머리글 — 좁은 칸에 들어가게 */
  short?: string;
  /** 폰에서 이 열이 보이는 보기 */
  views: readonly View[];
  wide?: boolean;
  cell: (r: GameBoxRow) => string;
  total: (rows: readonly GameBoxRow[]) => string;
}

const sum = (rows: readonly GameBoxRow[], k: keyof GameBoxRow) => rows.reduce((s, r) => s + (r[k] as number), 0);
const made = (m: keyof GameBoxRow, a: keyof GameBoxRow) => ({
  cell: (r: GameBoxRow) => `${r[m]}/${r[a]}`,
  total: (rows: readonly GameBoxRow[]) => `${sum(rows, m)}/${sum(rows, a)}`,
});
const count = (k: keyof GameBoxRow) => ({ cell: (r: GameBoxRow) => String(r[k]), total: (rows: readonly GameBoxRow[]) => String(sum(rows, k)) });
const pct = (v: number | null) => (v === null ? "–" : v.toFixed(1));

const COLS: Col[] = [
  { key: "sec", label: "분", views: ["basic"], wide: true, cell: (r) => minutesLabel(r.sec), total: () => "" },
  { key: "pts", label: "득점", views: ["basic", "shoot"], ...count("pts") },
  { key: "reb", label: "리바", views: ["basic"], ...count("reb") },
  { key: "ast", label: "어시", views: ["basic"], ...count("ast") },
  { key: "stl", label: "스틸", views: ["basic"], ...count("stl") },
  { key: "blk", label: "블록", views: ["basic"], ...count("blk") },
  { key: "tov", label: "턴오버", short: "TO", views: ["basic"], ...count("tov") },
  { key: "fgm", label: "야투", views: ["shoot"], wide: true, ...made("fgm", "fga") },
  {
    key: "fgPct",
    label: "야투%",
    views: ["shoot"],
    wide: true,
    cell: (r) => pct(fgPctOf(r)),
    total: (rows) => pct(fgPctOf({ fgm: sum(rows, "fgm"), fga: sum(rows, "fga") })),
  },
  { key: "tpm", label: "3점", views: ["shoot"], wide: true, ...made("tpm", "tpa") },
  { key: "ftm", label: "자유투", short: "FT", views: ["shoot"], wide: true, ...made("ftm", "fta") },
];

export interface BoxSide {
  key: "away" | "home";
  name: string;
  rows: GameBoxRow[];
}

export default function BoxScore({ sides, seasonCode }: { sides: BoxSide[]; seasonCode: number }) {
  const [side, setSide] = useState<"away" | "home">("away");
  const [view, setView] = useState<View>("basic");
  const [sort, setSort] = useState<BoxSortKey>("pts");
  const cur = sides.find((s) => s.key === side) ?? sides[0];
  const rows = sortBoxRows(cur?.rows ?? [], sort);
  // 폰에서 지금 보기에 없는 열은 숨기고, 640px 이상은 전부
  const vis = (c: Col) => (c.views.includes(view) ? "" : "hidden sm:table-cell");

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented label="팀 고르기" options={sides.map((s) => ({ value: s.key, label: s.name }))} value={cur?.key ?? "away"} onChange={setSide} />
        <div className="sm:hidden">
          <Segmented
            label="기록 보기"
            options={[
              { value: "basic", label: "기본" },
              { value: "shoot", label: "슈팅" },
            ]}
            value={view}
            onChange={(v) => {
              trackFilters("boxscore", { view: v });
              setView(v);
            }}
          />
        </div>
      </div>
      <table className="tabular mt-2 w-full table-fixed text-caption sm:text-sub">
        <colgroup>
          <col />
          {COLS.map((c) => (
            <col key={c.key} className={`${vis(c)} ${c.wide ? "w-[2.9rem] sm:w-[3.2rem]" : "w-[2.1rem] sm:w-[2.6rem]"}`} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-line text-ink-3">
            <th scope="col" className="py-1 text-left font-medium">선수</th>
            {COLS.map((c) => {
              const active = sort === c.key;
              return (
                <th key={c.key} scope="col" aria-sort={active ? "descending" : undefined} className={`p-0 text-right font-medium ${vis(c)}`}>
                  <button
                    type="button"
                    onClick={() => {
                      if (active) return;
                      trackFilters("boxscore", { sort: c.key });
                      setSort(c.key);
                    }}
                    className={`focus-ring-inset inline-flex h-10 w-full items-center justify-end whitespace-nowrap rounded-md tracking-tight transition-colors duration-200 hover:text-ink ${
                      active ? "font-bold text-ink underline underline-offset-4" : ""
                    }`}
                  >
                    {c.short ? (
                      <>
                        <span className="sm:hidden" aria-hidden>{c.short}</span>
                        <span className="sr-only sm:not-sr-only">{c.label}</span>
                      </>
                    ) : (
                      c.label
                    )}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line">
              <th scope="row" className="min-w-0 text-left font-semibold">
                <Link
                  href={`/player/${r.id}?season=${seasonCode}`}
                  className="focus-ring-inset flex h-10 min-w-0 items-center rounded-md text-ink underline-offset-2 hover:underline"
                >
                  <span className="truncate">{r.nameKo}</span>
                </Link>
              </th>
              {COLS.map((c) => (
                <td key={c.key} className={`text-right ${vis(c)} ${sort === c.key ? "font-bold text-ink" : "text-ink-2"}`}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="font-semibold text-ink">
            <th scope="row" className="py-2 text-left">합계</th>
            {COLS.map((c) => (
              <td key={c.key} className={`text-right ${vis(c)}`}>
                {c.total(rows)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
