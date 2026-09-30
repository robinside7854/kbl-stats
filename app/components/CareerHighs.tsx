"use client";
// 선수 페이지 "커리어 하이" (통산 한 경기 최다): 탭(정규시즌/플레이오프/챔프전) + 행 목록(부문 · 기록 · 상대 · 날짜 · 횟수).
// 행은 서버에서 lib/career careerHighTabs 로 다 만들어 넘긴다 — 이 파일은 탭 상태와 배치만.
// RowList: 모바일(<1024px) 행 카드(누르면 상대·날짜·횟수), PC 표 — 가로 스크롤 없음.
// 기록 없는 탭은 부르는 쪽에서 이미 빠져 있고, 탭이 하나도 없으면 이 컴포넌트를 그리지 않는다.
import { useState } from "react";
import type { CareerHighRow, HighsTab } from "@/lib/career";
import InfoLink from "./InfoLink";
import RowList, { type RowColumn } from "./RowList";
import Segmented from "./Segmented";

interface Tab {
  key: HighsTab;
  label: string;
  rows: CareerHighRow[];
}

const COLUMNS: RowColumn<CareerHighRow>[] = [
  { key: "label", header: "부문", align: "left", rowHeader: true, headerClassName: "w-36", className: "font-semibold text-ink", cell: (r) => r.label },
  {
    key: "value",
    header: "기록",
    headerClassName: "w-24",
    className: (r) => `text-base font-bold ${r.rate ? "text-ink-2" : "text-ink"}`,
    cell: (r) => r.value,
  },
  { key: "opponent", header: "상대", align: "left", headerClassName: "pl-4", className: "pl-4", cell: (r) => r.opponent },
  { key: "date", header: "날짜", cell: (r) => r.date },
  { key: "times", header: "횟수", cell: (r) => r.times },
];

export default function CareerHighs({ tabs }: { tabs: Tab[] }) {
  const [tabKey, setTabKey] = useState<HighsTab>(tabs[0]?.key ?? "regular");
  const tab = tabs.find((t) => t.key === tabKey) ?? tabs[0];
  if (!tab) return null;

  return (
    <section aria-labelledby="career-highs-title">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="career-highs-title" className="flex items-center gap-1 text-h2 font-bold">
          커리어 하이 <InfoLink term="gameHigh" className="ml-1" />
        </h2>
        {tabs.length > 1 ? (
          <Segmented label="경기 구분" options={tabs.map((t) => ({ value: t.key, label: t.label }))} value={tab.key} onChange={setTabKey} />
        ) : (
          <span className="text-sub font-semibold text-ink-3">{tab.label}</span>
        )}
      </div>
      {/* PC 표는 열이 5개뿐이라 전체 폭으로 늘이면 칸 사이가 벌어진다 → 폭 제한 */}
      <div className="lg:max-w-3xl">
        <RowList
          rows={tab.rows}
          rowKey={(r) => r.key}
          caption={`${tab.label} 통산 한 경기 최다 기록`}
          columns={COLUMNS}
          resetKey={tab.key}
          unit="개"
          rowLabel={(r) => `${r.label} ${r.value}, ${r.date}, 자세히`}
          summary={(r) => (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold leading-tight text-ink">{r.label}</span>
                <span className="tabular mt-0.5 block truncate text-sub text-ink-3">
                  {r.opponent !== "–" ? `상대 ${r.opponent} · ` : ""}
                  {r.date}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className={`tabular block text-lg font-bold leading-tight tracking-tight ${r.rate ? "text-ink-2" : "text-ink"}`}>{r.value}</span>
                <span className="block text-caption leading-tight text-ink-3">{r.times}</span>
              </span>
            </>
          )}
          details={(r) => [
            { key: "opponent", label: "상대", value: r.opponent },
            { key: "date", label: "날짜", value: r.date },
            { key: "times", label: "횟수", value: r.times },
          ]}
        />
      </div>
      <p className="mt-2 text-sub leading-relaxed text-ink-3">
        통산 한 경기 최고 기록. 횟수는 그 기록을 낸 경기 수. 성공률은 시도 수 조건이 없어 적게 던진 경기도 들어갑니다.
      </p>
    </section>
  );
}
