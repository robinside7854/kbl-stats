"use client";
// 역대 기록 하위 탭 화면 공용 (한 경기 최다·한 시즌 최다·수상·우승, 2026-10-03):
// 경기 구분(정규시즌·플레이오프·챔프전, 있을 때) → 부문 칩 → 합계/경기당(있을 때)·국적·현역만 → 순위 목록(RecordList).
// 서버가 부문마다 필터(국내/외국인 × 전체/현역)별 상위 50을 모두 담아 보내고(lib/data unionForFilters), 이 화면은 걸러서 순위만 다시 센다
// (lib/records filterRecordList). 선택은 주소 ?kind=&cat=&mode=&origin=&active=1 에 남긴다.
// GA4: filter_change screen=records_game|records_season|records_awards (kind·category·mode·origin·active_only).
import { useEffect, useMemo, useState } from "react";
import { filterRecordList, GAME_KINDS, type GameKind, type RecordListsData, type RecordMode, type RecordOrigin } from "@/lib/records";
import ChipRow from "./ChipRow";
import RecordList from "./RecordList";
import Segmented from "./Segmented";
import { trackFilters } from "./track";

export interface BoardCategory {
  value: string;
  label: string;
  /** 경기당 단위가 있는 부문 */
  perGame?: boolean;
}

interface Props {
  screen: "records_game" | "records_season" | "records_awards";
  data: RecordListsData;
  categories: BoardCategory[];
  /** 경기 구분 칩을 쓰는가 */
  kinds?: boolean;
  /** 합계/경기당 전환을 쓰는가 */
  modes?: boolean;
  /** 목록 키 만들기 (lib/data 의 키 규칙과 같아야 한다) */
  listKey: (kind: GameKind, cat: string, mode: RecordMode) => string;
  /** 목록 아래 안내 (지금 고른 상태에 맞춰) */
  note: (kind: GameKind, mode: RecordMode) => string;
  /** 고른 구분에 기록이 하나도 없을 때 문구 */
  emptyText?: (kind: GameKind) => string;
}

const ORIGIN_OPTIONS: { value: RecordOrigin; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "domestic", label: "국내" },
  { value: "foreign", label: "외국인" },
];

const MODE_OPTIONS: { value: RecordMode; label: string }[] = [
  { value: "total", label: "합계" },
  { value: "perGame", label: "경기당" },
];

export default function RecordBoardView({ screen, data, categories, kinds = false, modes = false, listKey, note, emptyText }: Props) {
  const [kind, setKind] = useState<GameKind>("regular");
  const [cat, setCat] = useState(categories[0].value);
  const [mode, setMode] = useState<RecordMode>("total");
  const [origin, setOrigin] = useState<RecordOrigin>("all");
  const [activeOnly, setActiveOnly] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const k = qs.get("kind");
    if (kinds && GAME_KINDS.some((g) => g.value === k)) setKind(k as GameKind);
    const c = qs.get("cat");
    if (c && categories.some((d) => d.value === c)) setCat(c);
    if (modes && qs.get("mode") === "perGame") setMode("perGame");
    const o = qs.get("origin");
    if (o === "domestic" || o === "foreign") setOrigin(o);
    if (qs.get("active") === "1") setActiveOnly(true);
  }, [categories, kinds, modes]);
  useEffect(() => {
    const qs = new URLSearchParams();
    if (kind !== "regular") qs.set("kind", kind);
    if (cat !== categories[0].value) qs.set("cat", cat);
    if (mode !== "total") qs.set("mode", mode);
    if (origin !== "all") qs.set("origin", origin);
    if (activeOnly) qs.set("active", "1");
    const q = qs.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
  }, [kind, cat, mode, origin, activeOnly, categories]);

  const def = categories.find((d) => d.value === cat) ?? categories[0];
  const effMode: RecordMode = modes && def.perGame ? mode : "total";
  const key = listKey(kind, def.value, effMode);
  const all = data.lists[key];
  const items = useMemo(() => filterRecordList(all ?? [], origin, activeOnly), [all, origin, activeOnly]);
  const filtered = origin !== "all" || activeOnly;

  return (
    <>
      {kinds && (
        <Segmented
          label="경기 구분"
          options={GAME_KINDS.map((g) => ({ value: g.value, label: g.label }))}
          value={kind}
          onChange={(v) => {
            trackFilters(screen, { kind: v });
            setKind(v);
          }}
        />
      )}
      <ChipRow
        label="부문 선택"
        scroll
        className={kinds ? "mt-3" : ""}
        chips={categories.map((d) => ({ value: d.value, label: d.label }))}
        value={def.value}
        onChange={(v) => {
          trackFilters(screen, { category: v });
          setCat(v);
        }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        {modes && def.perGame && (
          <Segmented
            label="합계 또는 경기당"
            options={MODE_OPTIONS}
            value={mode}
            onChange={(v) => {
              trackFilters(screen, { mode: v });
              setMode(v);
            }}
          />
        )}
        <Segmented
          label="국적"
          options={ORIGIN_OPTIONS}
          value={origin}
          onChange={(v) => {
            trackFilters(screen, { origin: v });
            setOrigin(v);
          }}
        />
        <button
          type="button"
          aria-pressed={activeOnly}
          onClick={() => {
            trackFilters(screen, { active_only: !activeOnly });
            setActiveOnly((v) => !v);
          }}
          className={`focus-ring-inset flex h-10 cursor-pointer items-center whitespace-nowrap rounded-control border px-3 text-body font-semibold transition-colors duration-200 ${
            activeOnly ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2"
          }`}
        >
          현역만
        </button>
      </div>
      <section aria-label={`${def.label} 순위`} className="mt-4">
        <RecordList
          key={`${key}:${origin}:${activeOnly}`}
          items={items}
          people={data.people}
          empty={(all ?? []).length > 0 && filtered ? "조건에 맞는 선수가 없습니다." : (emptyText?.(kind) ?? "기록이 없습니다.")}
        />
        <p className="mt-2 text-sub text-ink-3">{note(kind, effMode)}</p>
      </section>
    </>
  );
}
