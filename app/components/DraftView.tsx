"use client";
// 기록 메뉴 · 드래프트 (/records/draft?year=2015, 2026-10-16): 연도 칩 → 그 해 요약 → "실제 지명순 / 다시 뽑는다면" 전환 → 선수 목록.
// 페이지 HTML 에는 처음 연도 하나만 있고, 다른 연도는 /records/draft/{연도}.json 을 받는다(lib/draft draftYearUrl).
// 다시 뽑기 규칙은 lib/draft redraftOrder (통산 득+리+어+스틸+블록) — 머리말 "기록" 옆 ⓘ 에서 풀이.
// 선택은 주소 ?year=&order=redraft 에 남긴다. GA4: filter_change screen=records_draft filter=year·order.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DraftPlayerView, DraftYearData } from "@/lib/data-history";
import { draftYearFromParam, draftYearUrl, pickLabel } from "@/lib/draft";
import ChipRow from "./ChipRow";
import PlayerAvatar from "./PlayerAvatar";
import Segmented from "./Segmented";
import Skeleton from "./Skeleton";
import { IconArrowUp } from "./icons";
import { trackFilters } from "./track";

type Order = "actual" | "redraft";
const ORDER_OPTIONS: { value: Order; label: string }[] = [
  { value: "actual", label: "실제 지명순" },
  { value: "redraft", label: "다시 뽑는다면" },
];

const NF1 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NF0 = new Intl.NumberFormat("ko-KR");

export default function DraftView({ years, initial }: { years: number[]; initial: DraftYearData }) {
  const [year, setYear] = useState(initial.year);
  const [order, setOrder] = useState<Order>("actual");
  const [loaded, setLoaded] = useState<Record<number, DraftYearData | null>>({ [initial.year]: initial });

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const y = draftYearFromParam(qs.get("year"), years);
    if (qs.get("year") && y !== null) setYear(y);
    if (qs.get("order") === "redraft") setOrder("redraft");
  }, [years]);
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (year !== initial.year) qs.set("year", String(year));
    else qs.delete("year");
    if (order === "redraft") qs.set("order", "redraft");
    else qs.delete("order");
    const q = qs.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
  }, [year, order, initial.year]);

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
  const rows = useMemo(() => {
    if (!data) return [];
    return order === "redraft" ? [...data.players].sort((a, b) => a.redraft - b.redraft) : data.players;
  }, [data, order]);

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
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-1 text-h2 font-bold">
              {order === "redraft" ? "다시 뽑는다면" : "지명 순서"}
            </h2>
            <Segmented
              label="순서"
              options={ORDER_OPTIONS}
              value={order}
              onChange={(v) => {
                trackFilters("records_draft", { order: v });
                setOrder(v);
              }}
            />
          </div>
          <ol className="surface-card tabular mt-2 divide-y divide-line rounded-container">
            {rows.map((p) => (
              <DraftRow key={p.id} p={p} order={order} />
            ))}
          </ol>
          <p className="mt-2 text-caption leading-snug text-ink-3">
            KBL 정규시즌에 한 경기도 뛰지 않은 지명 선수는 기록이 없어 목록에 없어요.
            {data.duplicate && " 이 해는 드래프트가 두 번 열려 같은 순위가 둘씩 있어요."}
          </p>
        </>
      )}
    </>
  );
}

function YearSummary({ data }: { data: DraftYearData }) {
  const first = data.players[0];
  const top = [...data.players].sort((a, b) => a.redraft - b.redraft)[0];
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: "1순위", value: first ? <PlayerName p={first} /> : "–" },
    { label: "다시 뽑으면 1순위", value: top ? <PlayerName p={top} /> : "–" },
    { label: "신인상", value: data.rookie ? <Link href={`/player/${data.rookie.id}`} className="focus-ring rounded-control underline decoration-line underline-offset-4 hover:decoration-ink">{data.rookie.nameKo}</Link> : "없음" },
    { label: "정규리그 MVP", value: `${data.mvpCount}명` },
  ];
  return (
    <section aria-label={`${data.year} 드래프트 요약`} className="surface-card mt-3 rounded-container p-4">
      <p className="text-h2 font-bold">{data.year} 드래프트</p>
      <p className="mt-0.5 text-sub text-ink-3">{data.players.length}명이 KBL 에서 뛰었어요</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="text-sub text-ink-3">{f.label}</dt>
            <dd className="mt-0.5 truncate text-body font-bold text-ink">{f.value}</dd>
          </div>
        ))}
      </dl>
      {data.early && <p className="mt-3 text-sub text-ink-3">아직 데뷔한 지 얼마 안 된 해라 다시 뽑기 순서는 앞으로 크게 바뀔 수 있어요.</p>}
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

/** 실제 → 다시 뽑기 이동 (빨강 오름·파랑 내림 = 리더보드 순위 변동 색) */
function Move({ move }: { move: number }) {
  if (move === 0) return <span className="text-caption font-bold text-ink-3">그대로</span>;
  const up = move > 0;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap text-caption font-bold ${up ? "text-[var(--div-hot)]" : "text-[var(--div-cold)]"}`}
      aria-label={`실제보다 ${Math.abs(move)}계단 ${up ? "위" : "아래"}`}
    >
      <IconArrowUp size={16} className={`h-3 w-3 ${up ? "" : "rotate-180"}`} aria-hidden />
      {Math.abs(move)}
    </span>
  );
}

function DraftRow({ p, order }: { p: DraftPlayerView; order: Order }) {
  const redraft = order === "redraft";
  return (
    <li>
      <Link
        href={`/player/${p.id}`}
        className="focus-ring-inset flex min-h-16 items-center gap-3 px-3 py-2.5 transition-colors duration-200 hover:bg-surface-2"
      >
        {/* 왼쪽 칸: 실제 지명순이면 "1-3"(라운드-순위), 다시 뽑기면 새 순번 + 이동 */}
        <span className="flex w-10 shrink-0 flex-col items-center text-center">
          {redraft ? (
            <>
              <span className={`text-body ${p.redraft <= 3 ? "font-black text-ink" : "font-semibold text-ink-2"}`}>{p.redraft}</span>
              <Move move={p.move} />
            </>
          ) : (
            <>
              <span className="text-body font-bold text-ink">{p.pickText}</span>
              <span className="text-caption text-ink-3">순위</span>
            </>
          )}
        </span>
        <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={p.color} size={40} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-body font-semibold text-ink">{p.nameKo}</span>
            {p.active && <span className="text-caption font-semibold text-ink-3">현역</span>}
          </span>
          <span className="block text-sub leading-snug text-ink-3">
            {redraft ? `실제 ${pickLabel(p.round, p.pick)}` : p.lastTeam}
            {p.span && ` · ${p.span}`} · {NF0.format(p.games)}경기
          </span>
          {p.chips.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-1">
              {p.chips.map((c) => (
                <span
                  key={c.key}
                  className={`whitespace-nowrap rounded-control border px-1.5 py-0.5 text-caption font-semibold ${
                    c.gold ? "border-[var(--grade-s)] bg-[color-mix(in_oklab,var(--grade-s)_18%,transparent)] text-ink" : "border-line text-ink-2"
                  }`}
                >
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
