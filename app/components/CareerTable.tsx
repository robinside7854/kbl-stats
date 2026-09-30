"use client";
// 선수 페이지 시즌별 기록 (PLAN.md §2-2 ②): 한 줄 = 한 시즌(최근이 위), 경기당/합계 전환.
// 행 모양이 순위표 행(LeaderPlayer)과 같아 값·표기는 lib/leaders.ts(statValue·formatStat·madeAttempts)를 그대로 쓴다.
// RowList: 모바일(<1024px)은 행 카드(시즌·팀·득점/리바/어시, 누르면 전 항목), PC는 전체 표 — 가로 스크롤 없음 (디자인 점검 A1).
// 시즌을 고르면 위 카드 영역(PlayerSeasonCards)이 그 시즌 카드로 바뀌고 카드로 스크롤한다 ("player-season" 이벤트).
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
  type LeaderStatKey,
  type StatMode,
} from "@/lib/leaders";
import { seasonShortLabel } from "@/lib/career";
import { teamShortLabel } from "@/lib/images";
import { playerHref } from "@/lib/cardview";
import { IconChevronRight } from "./icons";
import { PLAYER_SEASON_EVENT } from "./PlayerSeasonCards";
import RowList, { type RowColumn } from "./RowList";
import Segmented from "./Segmented";
import TeamLogo from "./TeamLogo";

const MODE_OPTIONS: { value: StatMode; label: string }[] = [
  { value: "perGame", label: "경기당" },
  { value: "total", label: "시즌 합계" },
];

/** 모바일 접힌 행에 보이는 세 값 */
const SUMMARY_KEYS: LeaderStatKey[] = ["points", "reb", "ast"];

/** 위 카드를 그 시즌으로 바꾸고 카드로 스크롤 */
function showSeasonCard(seasonCode: number) {
  window.dispatchEvent(new CustomEvent(PLAYER_SEASON_EVENT, { detail: seasonCode }));
  document.getElementById("season-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function CareerTable({ seasons }: { seasons: CareerSeason[] }) {
  const [mode, setMode] = useState<StatMode>("perGame");
  const rows = useMemo(() => [...seasons].sort((a, b) => b.seasonCode - a.seasonCode), [seasons]);
  const teamOf = (s: CareerSeason) => s.team?.shortName ?? s.teamShort;
  const value = (s: CareerSeason, key: LeaderStatKey) => formatStat(statValue(s, key, mode), key, mode);

  const columns: RowColumn<CareerSeason>[] = [
    {
      key: "season",
      header: "시즌",
      align: "left",
      rowHeader: true,
      headerClassName: "w-16",
      className: "font-semibold",
      cell: (s) => (
        <Link
          href={`${playerHref(s.id, s.seasonCode)}#season-card`}
          scroll={false}
          onClick={(ev) => {
            ev.preventDefault();
            showSeasonCard(s.seasonCode);
          }}
          className="focus-ring whitespace-nowrap rounded text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
          title={`${seasonShortLabel(s.seasonLabel)} 선수 카드`}
        >
          {seasonShortLabel(s.seasonLabel)}
        </Link>
      ),
    },
    {
      key: "team",
      header: "팀",
      align: "left",
      cell: (s) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <TeamLogo logoUrl={s.team?.logoUrl} shortName={teamOf(s)} color={s.team?.color} size={20} />
          <span className="max-w-20 truncate">{teamShortLabel(teamOf(s))}</span>
        </span>
      ),
    },
    ...TABLE_COLUMNS.map(
      (key): RowColumn<CareerSeason> => ({
        key,
        header: <span className="whitespace-nowrap font-semibold">{LEADER_STATS[key].short}</span>,
        className: "whitespace-nowrap",
        cell: (s) => {
          const ma = madeAttempts(s, key);
          return (
            <>
              <span className="block leading-tight">{value(s, key)}</span>
              {ma && <span className="block text-caption leading-tight text-ink-3">{formatMadeAttempts(ma)}</span>}
            </>
          );
        },
      }),
    ),
  ];

  return (
    <section aria-labelledby="career-table-title">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="career-table-title" className="text-h2 font-bold">
          시즌별 기록
        </h2>
        <Segmented label="경기당 또는 시즌 합계" options={MODE_OPTIONS} value={mode} onChange={setMode} />
      </div>
      <RowList
        rows={rows}
        rowKey={(s) => String(s.seasonCode)}
        caption={`시즌별 정규시즌 기록 (${mode === "perGame" ? "경기당" : "시즌 합계"}), 최근 시즌이 위`}
        columns={columns}
        unit="시즌"
        rowLabel={(s) =>
          `${seasonShortLabel(s.seasonLabel)} ${teamShortLabel(teamOf(s))}, 득점 ${value(s, "points")}, 자세히`
        }
        summary={(s) => (
          <>
            <span className="w-12 shrink-0 text-body font-bold text-ink">{seasonShortLabel(s.seasonLabel)}</span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5 text-body text-ink-2">
                <TeamLogo logoUrl={s.team?.logoUrl} shortName={teamOf(s)} color={s.team?.color} size={20} />
                <span className="truncate">{teamShortLabel(teamOf(s))}</span>
              </span>
              <span className="tabular block text-sub text-ink-3">{s.games}경기</span>
            </span>
            {SUMMARY_KEYS.map((k) => (
              <span key={k} className="w-11 shrink-0 text-right">
                <span className="tabular block text-body font-bold leading-tight text-ink">{value(s, k)}</span>
                <span className="block text-caption leading-tight text-ink-3">{LEADER_STATS[k].short}</span>
              </span>
            ))}
          </>
        )}
        details={(s) =>
          TABLE_COLUMNS.map((key) => {
            const ma = madeAttempts(s, key);
            return {
              key,
              label: LEADER_STATS[key].short,
              value: (
                <>
                  {value(s, key)}
                  {ma && <span className="ml-1 text-caption text-ink-3">{formatMadeAttempts(ma)}</span>}
                </>
              ),
            };
          })
        }
        detailFooter={(s) => (
          <button
            type="button"
            onClick={() => showSeasonCard(s.seasonCode)}
            className="focus-ring inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg px-1 text-body font-semibold text-ink underline-offset-4 hover:underline"
          >
            {seasonShortLabel(s.seasonLabel)} 선수 카드 보기 <IconChevronRight size={16} />
          </button>
        )}
      />
      <p className="mt-2 text-sub text-ink-3">정규시즌만. 성공률 아래 작은 숫자는 시즌 합계 성공/시도.</p>
    </section>
  );
}
