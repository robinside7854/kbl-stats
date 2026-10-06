"use client";
// 역대 통산 순위 화면("기록" 메뉴 통산 탭, 머리말·탭은 RecordsHeader): 부문 칩 → 필터 버튼(합계/경기당·국적·현역만 ?active=1, 2026-10-06) → 순위 목록 50명씩 "더 보기".
// 순위·표기는 lib/records 순수 함수. 선택 상태는 주소 ?cat=&mode=&origin= 에 남긴다(정적 HTML 은 기본 상태: 통산 득점 합계).
import InfoLink from "./InfoLink";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  formatRecord,
  isActiveCareer,
  rankCareerTotals,
  RECORD_STATS,
  RECORDS_MIN_GAMES,
  RECORDS_PAGE_SIZE,
  DEFAULT_RECORD_FILTERS,
  recordFilterChips,
  type RecordFilterField,
  recordBarShare,
  type CareerTotal,
  type RecordMode,
  type RecordOrigin,
  type RecordStatKey,
} from "@/lib/records";
import { seasonRangeLabel } from "@/lib/career";
import { teamShortLabel } from "@/lib/images";
import ChipRow from "./ChipRow";
import PlayerAvatar from "./PlayerAvatar";
import ActiveOnlyToggle from "./ActiveOnlyToggle";
import FilterSheet, { FilterGroup } from "./FilterSheet";
import RecordsHeader from "./RecordsHeader";
import Segmented from "./Segmented";
import { trackFilters } from "./track";

const MODE_OPTIONS: { value: RecordMode; label: string }[] = [
  { value: "total", label: "통산 합계" },
  { value: "perGame", label: "경기당" },
];
const ORIGIN_OPTIONS: { value: RecordOrigin; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "domestic", label: "국내" },
  { value: "foreign", label: "외국인" },
];

export default function RecordsView({ totals, spanLabel, latestSeasonCode }: { totals: CareerTotal[]; spanLabel: string; latestSeasonCode: number }) {
  const [cat, setCat] = useState<RecordStatKey>("points");
  const [mode, setMode] = useState<RecordMode>("total");
  const [origin, setOrigin] = useState<RecordOrigin>("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [limit, setLimit] = useState(RECORDS_PAGE_SIZE);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const c = qs.get("cat");
    if (c && RECORD_STATS.some((d) => d.key === c)) setCat(c as RecordStatKey);
    if (qs.get("mode") === "perGame") setMode("perGame");
    const o = qs.get("origin");
    if (o === "domestic" || o === "foreign") setOrigin(o);
    if (qs.get("active") === "1") setActiveOnly(true);
  }, []);
  useEffect(() => {
    const qs = new URLSearchParams();
    if (cat !== "points") qs.set("cat", cat);
    if (mode !== "total") qs.set("mode", mode);
    if (origin !== "all") qs.set("origin", origin);
    if (activeOnly) qs.set("active", "1");
    const q = qs.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    setLimit(RECORDS_PAGE_SIZE);
  }, [cat, mode, origin, activeOnly]);

  const def = RECORD_STATS.find((d) => d.key === cat)!;
  const effMode: RecordMode = def.perGame ? mode : "total";
  const rows = useMemo(
    () => rankCareerTotals(totals, cat, effMode, origin, activeOnly ? latestSeasonCode : undefined),
    [totals, cat, effMode, origin, activeOnly, latestSeasonCode],
  );
  const shown = rows.slice(0, limit);
  const barMax = rows[0]?.value ?? 0;
  function reset(field: RecordFilterField) {
    if (field === "mode") setMode("total");
    if (field === "origin") setOrigin("all");
    if (field === "activeOnly") setActiveOnly(false);
  }
  const title = `${effMode === "perGame" ? "통산 경기당" : "통산"} ${def.label}`;

  return (
    <main className="mx-auto max-w-page px-4 pt-5">
      <RecordsHeader tab="career" leadersSeason={latestSeasonCode} scope={`KBL 정규시즌 · ${spanLabel}`} />

      <ChipRow label="부문 선택" scroll chips={RECORD_STATS.map((d) => ({ value: d.key, label: d.label }))} value={cat} onChange={(v) => { trackFilters("records", { category: v }); setCat(v); }} />
      {/* 합계/경기당·국적·현역만은 필터 버튼 안 (2026-10-06 사용자: 누르는 단계 최대 2번) */}
      <div className="mt-3">
        <FilterSheet
          chips={recordFilterChips({ ...DEFAULT_RECORD_FILTERS, mode, origin, activeOnly }, !!def.perGame).map((c) => ({
            key: c.field,
            label: c.label,
            onClear: () => reset(c.field),
          }))}
          onReset={() => (["mode", "origin", "activeOnly"] as const).forEach(reset)}
          resultText={`${rows.length}명 보기`}
          trailing={`${rows.length.toLocaleString("ko-KR")}명`}
        >
          {def.perGame && (
            <FilterGroup label="기록 단위" hint={`경기당 순위는 통산 ${RECORDS_MIN_GAMES}경기 이상 선수만`}>
              <Segmented label="통산 합계 또는 경기당" options={MODE_OPTIONS} value={mode} onChange={(v) => { trackFilters("records", { mode: v }); setMode(v); }} />
            </FilterGroup>
          )}
          <FilterGroup label="국적">
            <Segmented label="국적" options={ORIGIN_OPTIONS} value={origin} onChange={(v) => { trackFilters("records", { origin: v }); setOrigin(v); }} />
          </FilterGroup>
          <FilterGroup label="현역" hint={<>현역 = KBL 현역 등록 명단에 있는 선수 <InfoLink term="rosterStatus" /></>}>
            <ActiveOnlyToggle
              on={activeOnly}
              onChange={(v) => {
                trackFilters("records", { active_only: v });
                setActiveOnly(v);
              }}
            />
          </FilterGroup>
        </FilterSheet>
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
              const share = recordBarShare(r.value, barMax);
              const span = seasonRangeLabel(t.firstLabel, t.lastLabel);
              return (
                <li key={t.id}>
                  <Link
                    href={`/player/${t.id}`}
                    className="focus-ring-inset flex min-h-14 items-center gap-3 px-3 py-2 transition-colors duration-200 hover:bg-surface-2"
                  >
                    <span className={`w-8 shrink-0 text-center text-body ${r.rank <= 3 ? "font-black text-ink" : "font-semibold text-ink-3"}`}>{r.rank}</span>
                    {/* 사진 자리 폭 고정: 1~3위 사진이 커도 이름·막대 시작선이 같게 */}
                    <span className="flex w-10 shrink-0 justify-center">
                      <PlayerAvatar
                        photoUrl={t.photoUrl}
                        nameKo={t.nameKo}
                        color={{ primary: t.lastTeamColor, secondary: t.lastTeamColor, text: "#ffffff" }}
                        size={r.rank <= 3 ? 40 : 32}
                      />
                    </span>
                    <span className="min-w-0 flex-1 md:w-80 md:flex-none xl:w-96">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-body font-semibold leading-tight text-ink">{t.nameKo}</span>
                        {isActiveCareer(t, latestSeasonCode) && (
                          <span className="shrink-0 rounded-control border border-series-1 px-1.5 py-0.5 text-caption font-bold leading-none text-series-1">현역</span>
                        )}
                      </span>
                      <span className="block truncate text-sub text-ink-3">
                        {span} · {t.seasons}시즌 · {t.games.toLocaleString("ko-KR")}경기{cat === "wins" ? ` · ${t.wins.toLocaleString("ko-KR")}승 ${t.losses.toLocaleString("ko-KR")}패` : ""} · {teamShortLabel(t.lastTeam)}
                      </span>
                    </span>
                    {/* PC: 1위 대비 막대 (이름과 숫자 사이 빈칸 대신) */}
                    <span aria-hidden className="hidden min-w-0 flex-1 md:block">
                      <span className="block h-2.5 rounded-sm opacity-80" style={{ width: `${share * 100}%`, background: t.lastTeamColor }} />
                    </span>
                    <span className="shrink-0 text-right md:w-28">
                      {/* deslop-ignore-next-line 11 */}
                      <span className="block text-lg font-bold leading-tight tracking-tight text-ink lg:text-xl">{formatRecord(r.value, cat, effMode)}</span>
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
