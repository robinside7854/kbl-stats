"use client";
// 팀 페이지 시즌 로스터 표 (2026-10-30 사용자: 열이 경기·분·득점·리바·어시뿐이고 머리글로 정렬이 안 됨 → 다른 기록 표처럼).
// - 열: 경기·분·득점·리바·어시·스틸·블록·턴오버 / 야투%·3점(경기당 성공)·3점%·자유투% (경기당, 성공률은 시즌 합계로)
// - 머리글을 누르면 그 열 큰 값부터, 한 번 더 누르면 반대로 (선수 탭 나열 순서와 같은 규칙). 정렬 규칙은 lib/franchise sortRoster
// - 표가 든 상자가 좁으면(56rem 미만) 가로 스크롤 없이 "기본 / 수비 / 슈팅" 보기(각 4칸)로 나누고 경기 수는 이름 아래로, 넓으면 한 표에 전부 (박스스코어와 같은 방식)
// GA4: filter_change screen=team filter=roster_sort(값 = 열, 반대 순서면 _asc)·roster_view.
import Link from "next/link";
import { useState } from "react";
import { ROSTER_PCT_MIN_ATTEMPTS, rosterPct, sortRoster, type RosterRow, type RosterSortKey } from "@/lib/franchise";
import type { TeamColor } from "@/lib/types";
import { IconChevronDown, IconChevronUp } from "./icons";
import NoteInfo from "./NoteInfo";
import PlayerAvatar from "./PlayerAvatar";
import Segmented from "./Segmented";
import { trackFilters } from "./track";

type View = "basic" | "defense" | "shoot";

interface Col {
  key: RosterSortKey;
  label: string;
  /** 좁은 머리글 */
  short?: string;
  views: readonly View[];
  cell: (r: RosterRow) => string;
  /** 성공률 열: 시도가 적으면 흐리게 */
  pct?: boolean;
}

const one = (v: number) => v.toFixed(1);
const pctCell = (key: "fgPct" | "tpPct" | "ftPct") => (r: RosterRow) => {
  const v = rosterPct(r, key);
  return v === null ? "–" : v.toFixed(1);
};

const COLS: Col[] = [
  { key: "gp", label: "경기", views: [], cell: (r) => String(r.gp) },
  { key: "mpg", label: "분", views: ["basic"], cell: (r) => one(r.mpg) },
  { key: "ppg", label: "득점", views: ["basic"], cell: (r) => one(r.ppg) },
  { key: "rpg", label: "리바", views: ["basic"], cell: (r) => one(r.rpg) },
  { key: "apg", label: "어시", views: ["basic"], cell: (r) => one(r.apg) },
  { key: "spg", label: "스틸", views: ["defense"], cell: (r) => one(r.spg) },
  { key: "bpg", label: "블록", views: ["defense"], cell: (r) => one(r.bpg) },
  { key: "tpg", label: "턴오버", views: ["defense"], cell: (r) => one(r.tpg) },
  { key: "fgPct", label: "야투%", views: ["shoot"], cell: pctCell("fgPct"), pct: true },
  { key: "tpmPg", label: "3점", views: ["shoot"], cell: (r) => one(r.tpmPg) },
  { key: "tpPct", label: "3점%", views: ["shoot"], cell: pctCell("tpPct"), pct: true },
  { key: "ftPct", label: "자유투%", short: "FT%", views: ["shoot"], cell: pctCell("ftPct"), pct: true },
];

const VIEWS: { value: View; label: string }[] = [
  { value: "basic", label: "기본" },
  { value: "defense", label: "수비" },
  { value: "shoot", label: "슈팅" },
];

const NOTE = `머리글을 누르면 그 기록 순, 한 번 더 누르면 반대 순서예요. 성공률은 시즌 합계로 세고, 시도 ${ROSTER_PCT_MIN_ATTEMPTS}개 미만은 흐리게 보이고 성공률 순으로 볼 땐 맨 뒤에 둬요.`;

const attemptsOf = (r: RosterRow, key: RosterSortKey) => (key === "fgPct" ? r.fga : key === "tpPct" ? r.tpa : r.fta);

export default function TeamRosterTable({ rows, season, color }: { rows: readonly RosterRow[]; season: number; color: TeamColor }) {
  const [view, setView] = useState<View>("basic");
  const [sort, setSort] = useState<{ key: RosterSortKey; asc: boolean }>({ key: "ppg", asc: false });
  const sorted = sortRoster(rows, sort.key, sort.asc);
  const vis = (c: Col) => (c.views.includes(view) ? "" : "hidden @4xl:table-cell");
  const pick = (key: RosterSortKey) => {
    const asc = sort.key === key ? !sort.asc : false;
    trackFilters("team", { roster_sort: asc ? `${key}_asc` : key });
    setSort({ key, asc });
  };

  return (
    <div className="@container mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2 @4xl:hidden">
        <span className="flex items-center text-caption text-ink-3">
          경기당
          <NoteInfo title="로스터 표" text={NOTE} />
        </span>
        <Segmented
          label="기록 보기"
          options={VIEWS}
          value={view}
          onChange={(v) => {
            trackFilters("team", { roster_view: v });
            setView(v);
          }}
        />
      </div>
      <table className="tabular mt-2 w-full table-fixed text-sub">
        <colgroup>
          <col />
          {COLS.map((c) => (
            <col key={c.key} className={`${vis(c)} w-[2.85rem] @4xl:w-auto`} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-line text-caption text-ink-3 @4xl:text-sub">
            <th scope="col" className="py-1 text-left font-medium @4xl:w-[17rem]">
              <span className="inline-flex items-center">
                선수 <span className="ml-1 hidden @4xl:inline">(경기당)</span>
                <span className="hidden @4xl:inline-flex">
                  <NoteInfo title="로스터 표" text={NOTE} />
                </span>
              </span>
            </th>
            {COLS.map((c) => {
              const active = sort.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort.asc ? "ascending" : "descending") : undefined}
                  className={`p-0 pl-1 text-right font-medium @4xl:pl-2 ${vis(c)}`}
                >
                  <button
                    type="button"
                    onClick={() => pick(c.key)}
                    title={active ? "한 번 더 누르면 반대 순서" : `${c.label} 순으로`}
                    className={`focus-ring-inset inline-flex h-10 w-full items-center justify-end gap-0.5 whitespace-nowrap rounded-md tracking-tight transition-colors duration-200 hover:text-ink ${
                      active ? "font-bold text-ink" : ""
                    }`}
                  >
                    {c.short ? (
                      <>
                        <span className="@4xl:hidden" aria-hidden>
                          {c.short}
                        </span>
                        <span className="sr-only @4xl:not-sr-only">{c.label}</span>
                      </>
                    ) : (
                      c.label
                    )}
                    {active && (sort.asc ? <IconChevronUp size={16} aria-hidden /> : <IconChevronDown size={16} aria-hidden />)}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} className="border-b border-line last:border-b-0">
              <th scope="row" className="min-w-0 py-1.5 text-left font-normal">
                <Link
                  href={`/player/${p.id}?season=${season}`}
                  className="focus-ring-inset flex min-h-10 min-w-0 items-center gap-2 rounded-md transition-colors duration-200 hover:bg-surface-2"
                >
                  {/* 좁은 상자(폰)에서는 이름 자리를 넓히려고 사진을 뺀다 */}
                  <span className="hidden shrink-0 @sm:flex">
                    <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.name} color={color} size={32} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{p.name}</span>
                    <span className="block truncate text-caption text-ink-3">
                      {[p.pos, p.foreign ? "외국인" : null].filter(Boolean).join(" · ")}
                      {/* 경기 수 열은 넓은 표에만 — 좁으면 여기 */}
                      <span className="@4xl:hidden">{p.pos || p.foreign ? " · " : ""}{p.gp}경기</span>
                    </span>
                  </span>
                </Link>
              </th>
              {COLS.map((c) => {
                const faint = c.pct && attemptsOf(p, c.key) < ROSTER_PCT_MIN_ATTEMPTS;
                return (
                  <td
                    key={c.key}
                    className={`pl-1 text-right @4xl:pl-2 ${vis(c)} ${faint ? "text-ink-3" : sort.key === c.key ? "font-bold text-ink" : "text-ink-2"}`}
                  >
                    {c.cell(p)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
