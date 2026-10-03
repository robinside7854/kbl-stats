"use client";
// 역대 기록 하위 탭 화면 공용 (한 경기 최다·한 시즌 최다·수상·우승, 2026-10-03):
// 경기 구분(정규시즌·플레이오프·챔프전, 있을 때) → 부문 칩 → 합계/경기당(있을 때) → 순위 목록(RecordList).
// 순위는 서버에서 부문마다 상위 50까지 골라 둔 것(lib/data) — 이 화면은 고르기만. 선택은 주소 ?kind=&cat=&mode= 에 남긴다.
// GA4: filter_change screen=records_game|records_season|records_awards (kind·category·mode).
import { useEffect, useState } from "react";
import { GAME_KINDS, type GameKind, type RecordListsData, type RecordMode } from "@/lib/records";
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

const MODE_OPTIONS: { value: RecordMode; label: string }[] = [
  { value: "total", label: "합계" },
  { value: "perGame", label: "경기당" },
];

export default function RecordBoardView({ screen, data, categories, kinds = false, modes = false, listKey, note, emptyText }: Props) {
  const [kind, setKind] = useState<GameKind>("regular");
  const [cat, setCat] = useState(categories[0].value);
  const [mode, setMode] = useState<RecordMode>("total");

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const k = qs.get("kind");
    if (kinds && GAME_KINDS.some((g) => g.value === k)) setKind(k as GameKind);
    const c = qs.get("cat");
    if (c && categories.some((d) => d.value === c)) setCat(c);
    if (modes && qs.get("mode") === "perGame") setMode("perGame");
  }, [categories, kinds, modes]);
  useEffect(() => {
    const qs = new URLSearchParams();
    if (kind !== "regular") qs.set("kind", kind);
    if (cat !== categories[0].value) qs.set("cat", cat);
    if (mode !== "total") qs.set("mode", mode);
    const q = qs.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
  }, [kind, cat, mode, categories]);

  const def = categories.find((d) => d.value === cat) ?? categories[0];
  const effMode: RecordMode = modes && def.perGame ? mode : "total";
  const key = listKey(kind, def.value, effMode);
  const items = data.lists[key] ?? [];

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
      {modes && def.perGame && (
        <div className="mt-3">
          <Segmented
            label="합계 또는 경기당"
            options={MODE_OPTIONS}
            value={mode}
            onChange={(v) => {
              trackFilters(screen, { mode: v });
              setMode(v);
            }}
          />
        </div>
      )}
      <section aria-label={`${def.label} 순위`} className="mt-4">
        <RecordList key={key} items={items} people={data.people} empty={emptyText?.(kind) ?? "기록이 없습니다."} />
        <p className="mt-2 text-sub text-ink-3">{note(kind, effMode)}</p>
      </section>
    </>
  );
}
