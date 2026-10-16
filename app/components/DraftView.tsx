"use client";
// 기록 메뉴 · 드래프트 (/records/draft?year=2015, 2026-10-16): 연도 칩 → 그 해 요약(1순위 + 우승·수상 합계, 항목마다 아이콘) → 지명 순 선수 목록.
// 2026-10-16 사용자: "다시 뽑는다면" 순위는 없애고 그 해 우승 횟수·챔프전 MVP 같은 수상 내용을 더 — lib/draft draftClassHonors.
// 페이지 HTML 에는 처음 연도 하나만 있고, 다른 연도는 /records/draft/{연도}.json 을 받는다(lib/draft draftYearUrl).
// 선택은 주소 ?year= 에 남긴다. GA4: filter_change screen=records_draft filter=year.
import Link from "next/link";
import { useEffect, useState } from "react";
import type { DraftPlayerView, DraftYearData } from "@/lib/data-history";
import { draftYearFromParam, draftYearUrl } from "@/lib/draft";
import AwardIcon from "./AwardIcon";
import NoteInfo from "./NoteInfo";
import ChipRow from "./ChipRow";
import PlayerAvatar from "./PlayerAvatar";
import Skeleton from "./Skeleton";
import { trackFilters } from "./track";

const NF1 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NF0 = new Intl.NumberFormat("ko-KR");

export default function DraftView({ years, initial }: { years: number[]; initial: DraftYearData }) {
  const [year, setYear] = useState(initial.year);
  const [loaded, setLoaded] = useState<Record<number, DraftYearData | null>>({ [initial.year]: initial });

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const y = draftYearFromParam(qs.get("year"), years);
    if (qs.get("year") && y !== null) setYear(y);
  }, [years]);
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (year !== initial.year) qs.set("year", String(year));
    else qs.delete("year");
    qs.delete("order");
    const q = qs.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
  }, [year, initial.year]);

  const missing = !(year in loaded);
  useEffect(() => {
    if (!missing) return;
    let alive = true;
    fetch(draftYearUrl(year))
      .then((r) => (r.ok ? (r.json() as Promise<DraftYearData>) : null))
      .catch(() => null)
      .then((got) => {
        if (alive) setLoaded((m) => ({ ...m, [year]: got }));
      });
    return () => {
      alive = false;
    };
  }, [missing, year]);

  const data = loaded[year];

  return (
    <>
      <ChipRow
        label="드래프트 연도"
        scroll
        chips={years.map((y) => ({ value: y, label: String(y) }))}
        value={year}
        onChange={(y) => {
          trackFilters("records_draft", { year: y });
          setYear(y);
        }}
      />

      {missing ? (
        <div role="status" aria-label="불러오는 중" className="mt-3 space-y-3">
          <Skeleton className="h-24 rounded-container" />
          <Skeleton className="h-96 rounded-container" />
        </div>
      ) : !data ? (
        <div className="surface-card mt-3 rounded-container px-4 py-8 text-center">
          <p className="text-body text-ink-2">이 해 드래프트 기록을 불러오지 못했어요.</p>
          <button
            type="button"
            onClick={() => setLoaded((m) => Object.fromEntries(Object.entries(m).filter(([k]) => Number(k) !== year)))}
            className="focus-ring mt-4 h-11 rounded-control border border-line bg-surface px-4 text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
          >
            다시 불러오기
          </button>
        </div>
      ) : (
        <>
          <YearSummary data={data} />
          <h2 className="mt-5 flex items-center text-h2 font-bold">
            지명 순서
            <NoteInfo title="지명 순서 목록" text="KBL 정규시즌에 한 경기도 뛰지 않은 지명 선수는 기록이 없어 목록에 없어요." />
          </h2>
          <ol className="surface-card tabular mt-2 divide-y divide-line rounded-container">
            {data.players.map((p) => (
              <DraftRow key={p.id} p={p} />
            ))}
          </ol>
          {data.duplicate && <p className="mt-2 text-caption leading-snug text-ink-3">이 해는 드래프트가 두 번 열려 같은 순위가 둘씩 있어요.</p>}
        </>
      )}
    </>
  );
}

function YearSummary({ data }: { data: DraftYearData }) {
  const first = data.players[0];
  return (
    <section aria-label={`${data.year} 드래프트 요약`} className="surface-card mt-3 rounded-container p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-h2 font-bold">{data.year} 드래프트</p>
        <p className="text-sub text-ink-3">
          {first && (
            <>
              1순위 <PlayerName p={first} /> ·{" "}
            </>
          )}
          {data.players.length}명이 KBL 에서 뛰었어요
        </p>
      </div>
      {data.honors.length === 0 ? (
        <p className="mt-3 text-sub text-ink-2">아직 이 해 선수 중 우승이나 상을 받은 선수가 없어요.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.honors.map((h) => {
            const gold = h.key === "champion" || h.key === "mvp" || h.key === "finalsMvp";
            const names = h.players.slice(0, 3);
            return (
              <li key={h.key} className="flex min-w-0 items-start gap-3 rounded-card bg-surface-2 px-3 py-2.5">
                <span
                  aria-hidden
                  // deslop-ignore-next-line 19
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${gold ? "bg-[color-mix(in_oklab,var(--grade-s)_28%,transparent)] text-ink" : "bg-surface text-ink-2"}`}
                >
                  <AwardIcon award={h.key} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-sub font-semibold text-ink-2">{h.label}</span>
                    <span className="tabular text-body font-bold text-ink">{h.times}회</span>
                    {h.players.length > 1 && <span className="text-caption text-ink-3">{h.players.length}명</span>}
                  </span>
                  <span className="mt-0.5 block text-caption leading-snug text-ink-2 break-keep">
                    {names.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && " · "}
                        <Link href={`/player/${p.id}`} className="focus-ring rounded-sm underline decoration-line underline-offset-4 hover:decoration-ink">
                          {p.nameKo}
                        </Link>
                        {h.players.length > 1 && p.times > 1 && <span className="tabular"> {p.times}</span>}
                      </span>
                    ))}
                    {h.players.length > names.length && ` 외 ${h.players.length - names.length}명`}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PlayerName({ p }: { p: DraftPlayerView }) {
  return (
    <Link href={`/player/${p.id}`} className="focus-ring rounded-control underline decoration-line underline-offset-4 hover:decoration-ink">
      {p.nameKo}
    </Link>
  );
}

function DraftRow({ p }: { p: DraftPlayerView }) {
  return (
    <li>
      <Link
        href={`/player/${p.id}`}
        className="focus-ring-inset flex min-h-16 items-center gap-3 px-3 py-2.5 transition-colors duration-200 hover:bg-surface-2"
      >
        {/* 왼쪽 칸: "1-3"(라운드-순위) */}
        <span className="flex w-10 shrink-0 flex-col items-center text-center">
          <span className="text-body font-bold text-ink">{p.pickText}</span>
          <span className="text-caption text-ink-3">순위</span>
        </span>
        <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={p.color} size={40} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-body font-semibold text-ink">{p.nameKo}</span>
            {p.active && <span className="text-caption font-semibold text-ink-3">현역</span>}
          </span>
          <span className="block text-sub leading-snug text-ink-3">
            {p.lastTeam}
            {p.span && ` · ${p.span}`} · {NF0.format(p.games)}경기
          </span>
          {p.chips.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-1">
              {p.chips.map((c) => (
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
        </span>
        {/* 경기당 득점·리바·어시 — 폰은 득점만 크게, 넓으면 셋 */}
        <span className="shrink-0 text-right">
          <span className="block text-body font-bold text-ink">
            {p.games > 0 ? NF1.format(p.ppg) : "–"}
            <span className="ml-0.5 text-caption font-medium text-ink-3">점</span>
          </span>
          <span className="block text-caption text-ink-3">
            {p.games > 0 ? `${NF1.format(p.rpg)}리바 ${NF1.format(p.apg)}어시` : ""}
          </span>
        </span>
      </Link>
    </li>
  );
}
