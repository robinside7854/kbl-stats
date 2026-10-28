"use client";
// 경기 박스스코어 (홈 "오늘의 경기"·일정 화면 공용, 2026-10-03).
// - 팀 고르기(원정·홈) → 표. 머리글을 누르면 그 열 내림차순(기본 득점순, lib/games sortBoxRows)
// - 열: 분·득점·리바·어시·스틸·블록·턴오버 / 야투(성공/시도)·야투%·3점·자유투.
//   표가 든 상자가 좁으면(56rem 미만, 폰·PC 두 칸 카드) 가로 스크롤 없이 "기본 / 슈팅" 두 보기로 나누고, 넓으면 한 표에 전부.
// - 슈팅 보기: 야투·야투%·3점·3점%·자유투·자유투% (2026-10-03 사용자: 3점·자유투 성공률도 %로)
// - 위닝샷·버저비터를 넣은 선수는 이름 옆에 금색 번개(글자는 아래 표에), 표 아래 "클러치 기록"(4쿼터·연장 남은 2분 미만 6점 차 이내, lib/clutch — 2026-10-28)
// GA4: filter_change screen=boxscore (sort·view). 클러치 ⓘ 는 help_open topic=clutch.
import Link from "next/link";
import { useId, useState } from "react";
import type { ClutchLine, GameBoxRow, WinningShot } from "@/lib/types";
import { fgPctOf, ftPctOf, minutesLabel, sortBoxRows, tpPctOf, type BoxSortKey } from "@/lib/games";
import { winningLabel } from "@/lib/clutch";
import { IconBolt } from "./icons";
import InfoLink from "./InfoLink";
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
  /** 칸 너비: count(숫자) / made(성공/시도·분) / pct(성공률) / wide(머리글이 긴 열 — 턴오버·자유투%) */
  size: "count" | "made" | "pct" | "wide";
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

const pctCol = (key: BoxSortKey, label: string, short: string, of: (r: { fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number }) => number | null): Col => ({
  key,
  label,
  short,
  views: ["shoot"],
  size: "pct",
  cell: (r) => pct(of(r)),
  total: (rows) =>
    pct(of({ fgm: sum(rows, "fgm"), fga: sum(rows, "fga"), tpm: sum(rows, "tpm"), tpa: sum(rows, "tpa"), ftm: sum(rows, "ftm"), fta: sum(rows, "fta") })),
});

// 폰 "슈팅" 보기는 성공/시도·성공률 6칸 (득점은 "기본" 보기에만 — 좁은 폭에 맞추려고)
const COLS: Col[] = [
  { key: "sec", label: "분", views: ["basic"], size: "made", cell: (r) => minutesLabel(r.sec), total: () => "" },
  { key: "pts", label: "득점", views: ["basic"], size: "count", ...count("pts") },
  { key: "reb", label: "리바", views: ["basic"], size: "count", ...count("reb") },
  { key: "ast", label: "어시", views: ["basic"], size: "count", ...count("ast") },
  { key: "stl", label: "스틸", views: ["basic"], size: "count", ...count("stl") },
  { key: "blk", label: "블록", views: ["basic"], size: "count", ...count("blk") },
  { key: "tov", label: "턴오버", short: "TO", views: ["basic"], size: "wide", ...count("tov") },
  { key: "fgm", label: "야투", views: ["shoot"], size: "made", ...made("fgm", "fga") },
  pctCol("fgPct", "야투%", "야투%", fgPctOf),
  { key: "tpm", label: "3점", views: ["shoot"], size: "made", ...made("tpm", "tpa") },
  pctCol("tpPct", "3점%", "3점%", tpPctOf),
  { key: "ftm", label: "자유투", short: "FT", views: ["shoot"], size: "made", ...made("ftm", "fta") },
  { ...pctCol("ftPct", "자유투%", "FT%", ftPctOf), size: "wide" },
];

// 넓은 표(@4xl)는 머리글 글자 + 열 사이 여백(pl-2)이 들어가게 (2026-10-07 사용자: 턴오버가 옆 열과 붙어 보임)
const SIZE: Record<Col["size"], string> = {
  count: "w-[2.1rem] @4xl:w-[3.25rem]",
  made: "w-[2.6rem] @4xl:w-[4rem]",
  pct: "w-[2.5rem] @4xl:w-[4rem]",
  wide: "w-[2.5rem] @4xl:w-[4.5rem]",
};

export interface BoxSide {
  key: "away" | "home";
  name: string;
  teamCode: string;
  rows: GameBoxRow[];
}

/** 위닝샷·버저비터·결승 자유투 꼬리표 (이름 옆 — 경기 카드·선수 최근 경기와 같은 모양) */
export function WinningTag({ shot, className = "" }: { shot: Pick<WinningShot, "buzzer" | "kind">; className?: string }) {
  return (
    <span className={`shrink-0 rounded-sm border border-[var(--gold-ink)] px-1 text-caption font-bold leading-[1.15rem] text-[var(--gold-ink)] ${className}`}>
      {winningLabel(shot)}
    </span>
  );
}

export default function BoxScore({
  sides,
  seasonCode,
  winning = null,
  clutch = [],
}: {
  sides: BoxSide[];
  seasonCode: number;
  winning?: WinningShot | null;
  clutch?: readonly ClutchLine[];
}) {
  const [side, setSide] = useState<"away" | "home">(sides[0]?.key ?? "home");
  const [view, setView] = useState<View>("basic");
  const [sort, setSort] = useState<BoxSortKey>("pts");
  const cur = sides.find((s) => s.key === side) ?? sides[0];
  const rows = sortBoxRows(cur?.rows ?? [], sort);
  // 상자 폭이 56rem(896px) 미만이면 지금 보기에 없는 열은 숨기고, 그 이상은 전부 (container query — 두 칸 카드 안에서도 넘치지 않게)
  const vis = (c: Col) => (c.views.includes(view) ? "" : "hidden @4xl:table-cell");

  return (
    <div className="@container mt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented label="팀 고르기" options={sides.map((s) => ({ value: s.key, label: s.name }))} value={cur?.key ?? "home"} onChange={setSide} />
        <div className="@4xl:hidden">
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
      <table className="tabular mt-2 w-full table-fixed text-caption @4xl:text-sub">
        <colgroup>
          <col />
          {COLS.map((c) => (
            <col key={c.key} className={`${vis(c)} ${SIZE[c.size]}`} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-line text-ink-3">
            <th scope="col" className="py-1 text-left font-medium">선수</th>
            {COLS.map((c) => {
              const active = sort === c.key;
              return (
                <th key={c.key} scope="col" aria-sort={active ? "descending" : undefined} className={`p-0 pl-1 text-right font-medium @4xl:pl-2 ${vis(c)}`}>
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
                        <span className="@4xl:hidden" aria-hidden>{c.short}</span>
                        <span className="sr-only @4xl:not-sr-only">{c.label}</span>
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
                  {/* 위닝샷·버저비터: 이름 칸이 좁아(PC 도 14열) 이름이 잘리지 않게 금색 번개 아이콘만 — 글자 꼬리표는 아래 클러치 기록에 */}
                  {winning?.id === r.id && (
                    <span className="ml-0.5 shrink-0 text-[var(--gold-ink)]" title={winningLabel(winning)}>
                      <IconBolt size={16} />
                      <span className="sr-only">{winningLabel(winning)}</span>
                    </span>
                  )}
                </Link>
              </th>
              {COLS.map((c) => (
                <td key={c.key} className={`pl-1 text-right @4xl:pl-2 ${vis(c)} ${sort === c.key ? "font-bold text-ink" : "text-ink-2"}`}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="font-semibold text-ink">
            <th scope="row" className="py-2 text-left">합계</th>
            {COLS.map((c) => (
              <td key={c.key} className={`pl-1 text-right @4xl:pl-2 ${vis(c)}`}>
                {c.total(rows)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <ClutchTable lines={clutch} sides={sides} seasonCode={seasonCode} winning={winning} />
    </div>
  );
}

/** 클러치 기록: 두 팀 선수 중 클러치 상황에 슛·자유투를 던진 선수 (득점 많은 순) */
function ClutchTable({ lines, sides, seasonCode, winning }: { lines: readonly ClutchLine[]; sides: BoxSide[]; seasonCode: number; winning: WinningShot | null }) {
  const titleId = useId();
  if (lines.length === 0) return null;
  const teamName = (code: string) => sides.find((s) => s.teamCode === code)?.name ?? "";
  return (
    <section aria-labelledby={titleId} className="mt-4">
      <h3 id={titleId} className="flex items-center gap-1 text-sub font-bold text-ink">
        클러치 기록 <InfoLink term="clutch" />
      </h3>
      <p className="text-caption text-ink-3">4쿼터·연장 남은 2분 미만, 6점 차 이내</p>
      <table className="tabular mt-1 w-full table-fixed text-caption @4xl:text-sub">
        <colgroup>
          <col />
          <col className="w-[2.6rem] @4xl:w-[4rem]" />
          <col className="w-[2.6rem] @4xl:w-[4rem]" />
          <col className="w-[2.6rem] @4xl:w-[4rem]" />
          <col className="w-[2.6rem] @4xl:w-[4rem]" />
        </colgroup>
        <thead>
          <tr className="border-b border-line text-ink-3">
            <th scope="col" className="py-2 text-left font-medium">선수</th>
            <th scope="col" className="pl-1 text-right font-medium">득점</th>
            <th scope="col" className="pl-1 text-right font-medium">야투</th>
            <th scope="col" className="pl-1 text-right font-medium">3점</th>
            <th scope="col" className="whitespace-nowrap pl-1 text-right font-medium">
              <span className="@4xl:hidden" aria-hidden>FT</span>
              <span className="sr-only @4xl:not-sr-only">자유투</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={`${l.teamCode}:${l.nameKo}`} className="border-b border-line">
              <th scope="row" className="min-w-0 text-left font-semibold">
                <span className="flex h-10 min-w-0 items-center gap-1">
                  {l.id ? (
                    <Link href={`/player/${l.id}?season=${seasonCode}`} className="focus-ring-inset min-w-0 truncate rounded-md text-ink underline-offset-2 hover:underline">
                      {l.nameKo}
                    </Link>
                  ) : (
                    <span className="min-w-0 truncate text-ink">{l.nameKo}</span>
                  )}
                  <span className="shrink-0 font-normal text-ink-3">{teamName(l.teamCode)}</span>
                  {winning && winning.teamCode === l.teamCode && winning.nameKo === l.nameKo && <WinningTag shot={winning} />}
                </span>
              </th>
              <td className="pl-1 text-right font-bold text-ink">{l.pts}</td>
              <td className="pl-1 text-right text-ink-2">{`${l.fgm}/${l.fga}`}</td>
              <td className="pl-1 text-right text-ink-2">{`${l.tpm}/${l.tpa}`}</td>
              <td className="pl-1 text-right text-ink-2">{`${l.ftm}/${l.fta}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
