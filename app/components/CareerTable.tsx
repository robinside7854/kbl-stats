"use client";
// 선수 페이지 시즌별 기록표 (PLAN.md §2-2 ②): 한 줄 = 한 시즌(최근이 위), 경기당/합계 전환.
// 행 모양이 순위표 행(LeaderPlayer)과 같아 값·표기는 lib/leaders.ts(statValue·formatStat·madeAttempts)를 그대로 쓴다.
// 모바일에서는 표 영역만 가로 스크롤, 시즌 열은 고정 (순위표와 같은 방식).
// 시즌을 누르면 그 시즌 플레이어 카드(/season/[코드]?p=선수번호)로.
import { useMemo, useState } from "react";
import Link from "next/link";
import type { CareerSeason } from "@/lib/types";
import {
  formatMadeAttempts,
  formatStat,
  LEADER_STATS,
  madeAttempts,
  statValue,
  TABLE_COLUMNS,
  type StatMode,
} from "@/lib/leaders";
import { seasonShortLabel } from "@/lib/career";
import { teamShortLabel } from "@/lib/images";
import Segmented from "./Segmented";
import TeamLogo from "./TeamLogo";

const MODE_OPTIONS: { value: StatMode; label: string }[] = [
  { value: "perGame", label: "경기당" },
  { value: "total", label: "시즌 합계" },
];

export default function CareerTable({ seasons }: { seasons: CareerSeason[] }) {
  const [mode, setMode] = useState<StatMode>("perGame");
  const rows = useMemo(() => [...seasons].sort((a, b) => b.seasonCode - a.seasonCode), [seasons]);

  return (
    <section aria-labelledby="career-table-title">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="career-table-title" className="text-base font-bold">
          시즌별 기록
        </h2>
        <Segmented label="경기당 또는 시즌 합계" options={MODE_OPTIONS} value={mode} onChange={setMode} />
      </div>
      <p className="mb-2 text-xs text-ink-3 sm:hidden">표를 옆으로 밀면 열이 더 있습니다 →</p>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="tabular w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">
            시즌별 정규시즌 기록 ({mode === "perGame" ? "경기당" : "시즌 합계"}), 최근 시즌이 위
          </caption>
          <thead>
            <tr className="text-xs text-ink-3">
              <th
                scope="col"
                className="sticky left-0 z-20 w-18 min-w-18 border-b border-r border-line bg-surface px-2 py-2 text-left font-medium"
              >
                시즌
              </th>
              <th scope="col" className="border-b border-line px-2 py-2 text-left font-medium">
                팀
              </th>
              {TABLE_COLUMNS.map((key) => (
                <th key={key} scope="col" className="whitespace-nowrap border-b border-line px-1.5 py-2 text-right font-semibold">
                  {LEADER_STATS[key].short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const teamName = s.team?.shortName ?? s.teamShort;
              return (
                <tr key={s.seasonCode} className="group">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 w-18 min-w-18 border-b border-r border-line bg-surface px-2 py-1.5 text-left font-semibold group-hover:bg-surface-2"
                  >
                    <Link
                      href={`/season/${s.seasonCode}?p=${s.id}`}
                      className="whitespace-nowrap text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
                      title={`${seasonShortLabel(s.seasonLabel)} 플레이어 카드`}
                    >
                      {seasonShortLabel(s.seasonLabel)}
                    </Link>
                  </th>
                  <td className="border-b border-line px-2 py-1.5 group-hover:bg-surface-2">
                    <span className="flex items-center gap-1.5 whitespace-nowrap text-ink-2">
                      <TeamLogo logoUrl={s.team?.logoUrl} shortName={teamName} color={s.team?.color} size={20} />
                      {teamShortLabel(teamName)}
                    </span>
                  </td>
                  {TABLE_COLUMNS.map((key) => {
                    const ma = madeAttempts(s, key);
                    return (
                      <td
                        key={key}
                        className="whitespace-nowrap border-b border-line px-1.5 py-1.5 text-right text-ink-2 group-hover:bg-surface-2"
                      >
                        <span className="block leading-tight">{formatStat(statValue(s, key, mode), key, mode)}</span>
                        {ma && <span className="block text-[10px] leading-tight text-ink-3">{formatMadeAttempts(ma)}</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-3">
        정규시즌만. 경기당 모드에서 출전시간·득점 등 누적 기록은 경기 수로 나눈 값입니다. 야투%·3점%·자유투%·TS%·PER는
        KBL 계산값 그대로이고, 성공률 아래 작은 숫자는 시즌 합계 성공/시도입니다. 시즌을 누르면 그 시즌 플레이어 카드로 갑니다.
      </p>
    </section>
  );
}
