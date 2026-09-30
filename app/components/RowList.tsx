"use client";
// 반응형 목록 (디자인 점검 2026-09-30 A1·A3): 가로로 미는 표를 없앤다.
// - 모바일·태블릿(<1024px): 행 카드 목록. 접힌 행 = summary(순위·이름·핵심 값), 누르면 그 자리에서 펼쳐져
//   details 전 항목이 2열 라벨/값 격자로 보인다. 여러 행을 동시에 펼칠 수 있다(aria-expanded).
// - PC(≥1024px): 전체 표. 열이 화면에 다 들어가게 글자·여백을 줄여 두고, 표를 감싸는 상자는 가로 스크롤을 두지 않는다.
// - pageSize 를 주면 앞에서 그만큼만 보이고 "더 보기 (남은 n명)" 버튼. resetKey 가 바뀌면(필터·정렬 변경) 처음 개수로 돌아간다.
// 값 계산은 부르는 쪽이 lib/ 함수로 끝내서 넘긴다 — 이 파일은 배치와 펼침·개수 상태만 맡는다.
// 순위표(LeadersView)·선수 기록표(CareerTable)·팀 분포 "표로 보기"(TeamsView)가 같이 쓴다.
import { Fragment, useEffect, useId, useState, type ReactNode } from "react";
import { takeFirst } from "@/lib/leaders";
import { IconChevronDown } from "./icons";

export interface RowColumn<R> {
  key: string;
  /** PC 표 머리글 내용 (정렬 버튼·ⓘ 포함 가능) */
  header: ReactNode;
  /** PC 표 칸 내용 */
  cell: (row: R) => ReactNode;
  align?: "left" | "right" | "center";
  /** 이 칸을 행 제목(th scope=row)으로 */
  rowHeader?: boolean;
  /** 머리글 aria-sort */
  ariaSort?: "ascending" | "descending" | "none";
  /** 지금 정렬 중인 열 → 옅은 바탕 */
  active?: boolean;
  /** 칸 추가 클래스 */
  className?: string | ((row: R) => string);
  headerClassName?: string;
}

export interface RowDetail {
  key: string;
  label: ReactNode;
  value: ReactNode;
  /** 지금 기준 항목 → 굵게 */
  strong?: boolean;
}

interface Props<R> {
  rows: readonly R[];
  rowKey: (row: R) => string;
  /** 표 caption · 목록 aria-label */
  caption: string;
  columns: RowColumn<R>[];
  /** 모바일 접힌 행 내용 (버튼 안에 들어가므로 링크·버튼을 넣지 않는다) */
  summary: (row: R) => ReactNode;
  /** 펼친 행의 2열 격자 */
  details: (row: R) => RowDetail[];
  /** 펼친 행 아래 줄 (선수 페이지 링크 등) */
  detailFooter?: (row: R) => ReactNode;
  /** 접힌 행 버튼의 스크린리더 이름, 예: "1위 워니, 자세히" */
  rowLabel: (row: R) => string;
  /** 앞에서 몇 행만 먼저 보일지 (없으면 전부) */
  pageSize?: number;
  /** 바뀌면 보이는 개수를 처음으로 되돌린다 (필터·정렬·시즌 상태를 문자열로) */
  resetKey?: string;
  /** "더 보기 (남은 n명)"의 단위 */
  unit?: string;
  /** 행 강조 (예: 1~3위) — PC 표 행 굵기 */
  emphasize?: (row: R) => boolean;
  /** PC 표 칸 좌우 여백을 줄인다 (열이 많은 순위표 — 17열을 992px 안에 넣기 위해) */
  dense?: boolean;
}

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

export default function RowList<R>({
  rows,
  rowKey,
  caption,
  columns,
  summary,
  details,
  detailFooter,
  rowLabel,
  pageSize,
  resetKey = "",
  unit = "명",
  emphasize,
  dense = false,
}: Props<R>) {
  const baseId = useId();
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [limit, setLimit] = useState(pageSize ?? Infinity);

  // 필터·정렬이 바뀌면 처음 개수로, 펼친 행도 닫는다
  useEffect(() => {
    setLimit(pageSize ?? Infinity);
    setOpen(new Set());
  }, [resetKey, pageSize]);

  const { shown, remaining } = takeFirst(rows, limit);

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const cellClass = (c: RowColumn<R>, r: R) => (typeof c.className === "function" ? c.className(r) : (c.className ?? ""));

  return (
    <div>
      {/* ── 모바일·태블릿: 행 카드 ── */}
      <ul aria-label={caption} className="surface-card tabular overflow-hidden rounded-container lg:hidden">
        {shown.map((r) => {
          const key = rowKey(r);
          const isOpen = open.has(key);
          const panelId = `${baseId}-${key}`;
          return (
            <li key={key} className="border-b border-line last:border-b-0">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                aria-label={rowLabel(r)}
                onClick={() => toggle(key)}
                className="focus-ring-inset flex min-h-14 w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors duration-200 hover:bg-surface-2"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2.5">{summary(r)}</span>
                <IconChevronDown
                  size={16}
                  className={`shrink-0 text-ink-3 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div id={panelId} className="bg-surface-2 px-3 pb-3 pt-2.5">
                  <dl className="tabular grid grid-cols-2 gap-x-4 gap-y-1.5 text-body">
                    {details(r).map((d) => (
                      <div key={d.key} className="flex min-w-0 items-baseline justify-between gap-2 border-b border-line/70 pb-1">
                        <dt className="shrink-0 text-sub text-ink-3">{d.label}</dt>
                        <dd className={`min-w-0 text-right ${d.strong ? "font-bold text-ink" : "text-ink-2"}`}>{d.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {detailFooter && <div className="mt-2.5">{detailFooter(r)}</div>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* ── PC: 전체 표 (가로 스크롤 없음 — 열 폭·글자를 줄여 992px 안에 넣는다) ── */}
      <div className="surface-card hidden overflow-hidden rounded-container lg:block">
        <table className="tabular w-full border-separate border-spacing-0 text-sub">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-sub text-ink-3">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={c.ariaSort}
                  className={`border-b border-line ${dense ? "px-1" : "px-1.5"} py-2 font-medium ${ALIGN[c.align ?? "right"]} ${
                    c.active ? "bg-surface-2 text-ink" : ""
                  } ${c.headerClassName ?? ""}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const strong = emphasize?.(r) ?? false;
              return (
                <tr key={rowKey(r)} className="transition-colors duration-200 hover:bg-surface-2">
                  {columns.map((c) => {
                    const cls = `h-12 border-b border-line ${dense ? "px-1" : "px-1.5"} py-1.5 ${ALIGN[c.align ?? "right"]} ${
                      c.active ? "bg-surface-2 font-semibold text-ink" : "text-ink-2"
                    } ${strong && c.rowHeader ? "font-bold" : ""} ${cellClass(c, r)}`;
                    return (
                      <Fragment key={c.key}>
                        {c.rowHeader ? (
                          <th scope="row" className={cls}>
                            {c.cell(r)}
                          </th>
                        ) : (
                          <td className={cls}>{c.cell(r)}</td>
                        )}
                      </Fragment>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + (pageSize ?? remaining))}
          className="focus-ring mt-3 flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-control border border-line bg-surface text-body font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
        >
          더 보기 <span className="font-normal text-ink-3">(남은 {remaining}{unit})</span>
          <IconChevronDown size={16} />
        </button>
      )}
    </div>
  );
}
