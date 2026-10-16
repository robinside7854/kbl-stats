"use client";
// 기록 메뉴 · 외국 선수 명예의 전당 (/records/foreign, 2026-10-16).
// 보기 두 개: "명예의 전당"(헌액 기준을 넘은 선수 카드, 정렬 통산 득점·수상·경기당 득점) / "한 시즌 최고"(경기당 득+리+어, 우리 규칙).
// 헌액 기준·정렬은 lib/hall (제목 옆 ⓘ 풀이). 선택은 주소 ?view=seasons&sort= 에 남긴다.
// GA4: filter_change screen=records_foreign filter=view·sort.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ForeignHallData, HallMemberView } from "@/lib/data-history";
import { HALL_REASON_LABELS, HALL_SORTS, sortHall, type HallSort } from "@/lib/hall";
import { teamShortLabel } from "@/lib/images";
import AwardIcon from "./AwardIcon";
import ChipRow from "./ChipRow";
import PlayerAvatar from "./PlayerAvatar";
import Segmented from "./Segmented";
import TeamLogo from "./TeamLogo";
import { trackFilters } from "./track";

type View = "hall" | "seasons";
const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: "hall", label: "명예의 전당" },
  { value: "seasons", label: "한 시즌 최고" },
];

const NF1 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NF0 = new Intl.NumberFormat("ko-KR");

export default function ForeignHallView({ data }: { data: ForeignHallData }) {
  const [view, setView] = useState<View>("hall");
  const [sort, setSort] = useState<HallSort>("points");
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("view") === "seasons") setView("seasons");
    const s = qs.get("sort");
    if (HALL_SORTS.some((o) => o.value === s)) setSort(s as HallSort);
  }, []);
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (view === "seasons") qs.set("view", "seasons");
    else qs.delete("view");
    if (sort !== "points") qs.set("sort", sort);
    else qs.delete("sort");
    const q = qs.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
  }, [view, sort]);

  const members = useMemo(() => sortHall(data.members, sort), [data.members, sort]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="보기"
          options={VIEW_OPTIONS}
          value={view}
          onChange={(v) => {
            trackFilters("records_foreign", { view: v });
            setView(v);
          }}
        />
        {view === "hall" && (
          <ChipRow
            label="정렬"
            chips={HALL_SORTS.map((o) => ({ value: o.value, label: o.label }))}
            value={sort}
            onChange={(v) => {
              trackFilters("records_foreign", { sort: v });
              setSort(v);
            }}
          />
        )}
      </div>

      {view === "hall" ? (
        <>
          <p className="mt-3 text-body text-ink-2">
            KBL 을 거쳐 간 외국 선수 {NF0.format(data.pool)}명 가운데 <span className="font-bold text-ink">{members.length}명</span>
          </p>
          <ol className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {members.map((m, i) => (
              <HallCard key={m.id} m={m} n={i + 1} />
            ))}
          </ol>
        </>
      ) : (
        <SeasonsList data={data} />
      )}
    </>
  );
}

function HallCard({ m, n }: { m: HallMemberView; n: number }) {
  const tiles = [
    { label: "경기", value: NF0.format(m.games) },
    { label: "총 득점", value: NF0.format(m.points) },
    { label: "득점", value: NF1.format(m.ppg) },
    { label: "리바", value: NF1.format(m.rpg) },
    { label: "어시", value: NF1.format(m.apg) },
  ];
  return (
    <li className="surface-card flex min-w-0 flex-col rounded-container">
      <Link href={`/player/${m.id}`} className="focus-ring-inset flex flex-1 flex-col rounded-container p-3 transition-colors duration-200 hover:bg-surface-2 sm:p-4">
        <span className="flex items-center gap-3">
          <span className="tabular w-6 shrink-0 text-center text-body font-bold text-ink-3">{n}</span>
          <PlayerAvatar photoUrl={m.photoUrl} nameKo={m.nameKo} color={m.color} size={56} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-body font-bold text-ink">{m.nameKo}</span>
              {m.active && <span className="text-caption font-semibold text-ink-3">현역</span>}
            </span>
            <span className="tabular block text-sub text-ink-3">
              {m.span} · {m.seasons}시즌
            </span>
          </span>
        </span>
        {/* 거쳐 간 팀: 로고 + 팀 + 시즌 구간 (같은 팀 두 번이면 한 칸에 구간 둘) */}
        <span className="mt-3 block">
          <span className="text-caption font-semibold text-ink-3">거쳐 간 팀 {m.teams.length}</span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            {m.teams.map((t) => (
              <span key={t.teamCode} className="inline-flex min-h-8 items-center gap-1.5 rounded-control border border-line bg-surface px-2 py-1 text-sub">
                <TeamLogo logoUrl={t.logoUrl} shortName={t.teamShort} color={t.color} size={18} />
                <span className="whitespace-nowrap font-semibold text-ink">{teamShortLabel(t.teamShort)}</span>
                <span className="tabular whitespace-nowrap text-caption text-ink-3">{t.ranges.join(" · ")}</span>
              </span>
            ))}
          </span>
        </span>
        <span className="tabular mt-3 grid grid-cols-5 gap-1 text-center">
          {tiles.map((t) => (
            <span key={t.label} className="min-w-0 rounded-control bg-surface-2 px-1 py-1.5">
              <span className="block text-body font-bold leading-tight text-ink">{t.value}</span>
              <span className="block whitespace-nowrap text-caption text-ink-3">{t.label}</span>
            </span>
          ))}
        </span>
        {m.chips.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1">
            {m.chips.map((c) => (
              <span
                key={c.key}
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-control border px-1.5 py-0.5 text-caption font-semibold ${
                  c.gold ? "border-[var(--grade-s)] bg-[color-mix(in_oklab,var(--grade-s)_18%,transparent)] text-ink" : "border-line text-ink-2"
                }`}
              >
                <AwardIcon award={c.key} />
                {c.label}
              </span>
            ))}
          </span>
        )}
        <span className="mt-auto pt-2 text-caption text-ink-3">헌액: {m.reasons.map((r) => HALL_REASON_LABELS[r]).join(" · ")}</span>
      </Link>
    </li>
  );
}

function SeasonsList({ data }: { data: ForeignHallData }) {
  return (
    <>
      <p className="mt-3 text-body text-ink-2">외국 선수 한 시즌 경기당 득점 + 리바운드 + 어시스트 순위</p>
      <ol className="surface-card tabular mt-2 divide-y divide-line rounded-container">
        {data.seasons.map((s) => (
          <li key={`${s.id}-${s.seasonShort}`}>
            <Link
              href={`/player/${s.id}`}
              className="focus-ring-inset flex min-h-14 items-center gap-3 px-3 py-2 transition-colors duration-200 hover:bg-surface-2"
            >
              <span className={`w-7 shrink-0 text-center text-body ${s.rank <= 3 ? "font-black text-ink" : "font-semibold text-ink-3"}`}>{s.rank}</span>
              <PlayerAvatar photoUrl={s.photoUrl} nameKo={s.nameKo} color={s.color} size={s.rank <= 3 ? 40 : 32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold leading-tight text-ink">{s.nameKo}</span>
                <span className="block text-sub leading-snug text-ink-3">
                  {s.seasonShort} {s.teamShort} · {s.games}경기
                </span>
                <span className="block text-caption text-ink-3">
                  {NF1.format(s.ppg)}점 {NF1.format(s.rpg)}리바 {NF1.format(s.apg)}어시
                </span>
              </span>
              <span className="shrink-0 text-right">
                {/* deslop-ignore-next-line 11 */}
                <span className="block text-lg font-bold leading-tight text-ink">{NF1.format(s.value)}</span>
                <span className="block text-caption text-ink-3">득+리+어</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-caption leading-snug text-ink-3">
        끝난 시즌, 그 시즌 최다 출전의 60% 이상 뛴 선수만. 시대마다 외국 선수 규정(인원·키·출전 쿼터)이 달라 숫자를 그대로 비교하긴 어려워요.
      </p>
    </>
  );
}
