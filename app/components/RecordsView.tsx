"use client";
// 역대 통산 순위 화면: 부문 칩 · 합계/경기당 · 국적(전체/국내/외국인) → 순위 목록 50명씩 "더 보기".
// 순위·표기는 lib/records 순수 함수. 선택 상태는 주소 ?cat=&mode=&origin= 에 남긴다(정적 HTML 은 기본 상태: 통산 득점 합계).
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  formatRecord,
  rankCareerTotals,
  RECORD_STATS,
  RECORDS_MIN_GAMES,
  RECORDS_PAGE_SIZE,
  type CareerTotal,
  type RecordMode,
  type RecordOrigin,
  type RecordStatKey,
} from "@/lib/records";
import { seasonShortLabel } from "@/lib/career";
import { teamShortLabel } from "@/lib/images";
import ChipRow from "./ChipRow";
import InfoLink from "./InfoLink";
import PlayerAvatar from "./PlayerAvatar";
import Segmented from "./Segmented";

const MODE_OPTIONS: { value: RecordMode; label: string }[] = [
  { value: "total", label: "통산 합계" },
  { value: "perGame", label: "경기당" },
];
const ORIGIN_OPTIONS: { value: RecordOrigin; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "domestic", label: "국내" },
  { value: "foreign", label: "외국인" },
];

export default function RecordsView({ totals, spanLabel }: { totals: CareerTotal[]; spanLabel: string }) {
  const [cat, setCat] = useState<RecordStatKey>("points");
  const [mode, setMode] = useState<RecordMode>("total");
  const [origin, setOrigin] = useState<RecordOrigin>("all");
  const [limit, setLimit] = useState(RECORDS_PAGE_SIZE);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const c = qs.get("cat");
    if (c && RECORD_STATS.some((d) => d.key === c)) setCat(c as RecordStatKey);
    if (qs.get("mode") === "perGame") setMode("perGame");
    const o = qs.get("origin");
    if (o === "domestic" || o === "foreign") setOrigin(o);
  }, []);
  useEffect(() => {
    const qs = new URLSearchParams();
    if (cat !== "points") qs.set("cat", cat);
    if (mode !== "total") qs.set("mode", mode);
    if (origin !== "all") qs.set("origin", origin);
    const q = qs.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    setLimit(RECORDS_PAGE_SIZE);
  }, [cat, mode, origin]);

  const def = RECORD_STATS.find((d) => d.key === cat)!;
  const effMode: RecordMode = def.perGame ? mode : "total";
  const rows = useMemo(() => rankCareerTotals(totals, cat, effMode, origin), [totals, cat, effMode, origin]);
  const shown = rows.slice(0, limit);
  const title = `${effMode === "perGame" ? "통산 경기당" : "통산"} ${def.label}`;

  return (
    <main className="mx-auto max-w-5xl px-4 pt-5">
      <header className="mb-3">
        <p className="text-sub font-medium text-ink-3">KBL 정규시즌 · {spanLabel}</p>
        <h1 className="mt-0.5 flex items-center gap-1 text-h1 font-bold">
          역대 기록 <InfoLink term="records" className="ml-1" />
        </h1>
      </header>

      <ChipRow label="부문 선택" scroll chips={RECORD_STATS.map((d) => ({ value: d.key, label: d.label }))} value={cat} onChange={setCat} />
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        {def.perGame && <Segmented label="통산 합계 또는 경기당" options={MODE_OPTIONS} value={mode} onChange={setMode} />}
        <Segmented label="국적" options={ORIGIN_OPTIONS} value={origin} onChange={setOrigin} />
      </div>
      {effMode === "perGame" && <p className="mt-2 text-sub text-ink-3">경기당 순위는 통산 {RECORDS_MIN_GAMES}경기 이상 선수만</p>}

      <section aria-labelledby="records-title" className="mt-4">
        <h2 id="records-title" className="sr-only">
          {title} 순위
        </h2>
        {shown.length === 0 ? (
          <p className="surface-card rounded-container px-4 py-8 text-center text-body text-ink-2">조건에 맞는 선수가 없습니다.</p>
        ) : (
          <ol className="surface-card tabular divide-y divide-line rounded-container">
            {shown.map((r) => {
              const t = r.total;
              const span = t.firstLabel === t.lastLabel ? seasonShortLabel(t.firstLabel) : `${seasonShortLabel(t.firstLabel)}~${seasonShortLabel(t.lastLabel)}`;
              return (
                <li key={t.id}>
                  <Link
                    href={`/player/${t.id}`}
                    className="focus-ring-inset flex min-h-14 items-center gap-3 px-3 py-2 transition-colors duration-200 hover:bg-surface-2"
                  >
                    <span className={`w-8 shrink-0 text-center text-body ${r.rank <= 3 ? "font-black text-ink" : "font-semibold text-ink-3"}`}>{r.rank}</span>
                    <PlayerAvatar
                      photoUrl={t.photoUrl}
                      nameKo={t.nameKo}
                      color={{ primary: t.lastTeamColor, secondary: t.lastTeamColor, text: "#ffffff" }}
                      size={r.rank <= 3 ? 40 : 32}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold leading-tight text-ink">{t.nameKo}</span>
                      <span className="block truncate text-sub text-ink-3">
                        {span} · {t.seasons}시즌 · {t.games.toLocaleString("ko-KR")}경기 · {teamShortLabel(t.lastTeam)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-lg font-bold leading-tight tracking-tight text-ink">{formatRecord(r.value, cat, effMode)}</span>
                      <span className="block text-caption text-ink-3">{def.unit}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
        {rows.length > shown.length && (
          <button
            type="button"
            onClick={() => setLimit((n) => n + RECORDS_PAGE_SIZE)}
            className="focus-ring mt-3 h-11 w-full rounded-control border border-line bg-surface text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
          >
            더 보기 (남은 {rows.length - shown.length}명)
          </button>
        )}
        <p className="mt-2 text-sub text-ink-3">시즌 기록을 더한 값이라 KBL 공식 통산 기록과 조금 다를 수 있습니다. 정규시즌만.</p>
      </section>
    </main>
  );
}
