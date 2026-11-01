"use client";
// 역대 기록 하위 탭 화면 공용 (한 경기 최다·한 시즌 최다·수상·우승, 2026-10-03):
// 부문 칩 한 줄 → "필터" 버튼(경기 구분·합계/경기당·국적·현역만, 2026-10-06) → 순위 목록(RecordList).
// 서버가 부문마다 필터(국내/외국인 × 전체/현역)별 상위 50을 모두 담아 보내고(lib/data unionForFilters), 이 화면은 걸러서 순위만 다시 센다
// remote 가 있으면(한 경기·한 시즌 최다, 2026-10-12) 페이지에는 처음 목록 하나만 들어 있고 다른 목록은 고를 때 정적 파일로 받는다(lib/records recordListUrl)
// (lib/records filterRecordList). 선택은 주소 ?kind=&cat=&mode=&origin=&active=1 에 남긴다.
// 부문에 sorts 가 있으면(클러치 득점, 2026-11-01) 부문 칩 바로 아래 정렬 기준 Segmented — 고른 값이 목록 키 부문이 된다(?sort=).
// scopes 가 있으면(클러치 탭, 2026-10-28) 기간(통산·시즌) 고르기와 경기 구분을 필터 버튼 밖 한 줄에 둔다 — ?season= 으로 남김.
// GA4: filter_change screen=records_game|records_season|records_awards|records_clutch|records_profile (kind·category·mode·origin·active_only·season·sort).
import InfoLink from "./InfoLink";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_RECORD_FILTERS,
  filterRecordList,
  GAME_KINDS,
  recordFilterChips,
  type GameKind,
  type RecordFilterField,
  type RecordListsData,
  type RecordMode,
  type RecordOrigin,
  type RecordTab,
  recordListUrl,
} from "@/lib/records";
import ActiveOnlyToggle from "./ActiveOnlyToggle";
import FilterSheet, { FilterGroup } from "./FilterSheet";
import ChipRow from "./ChipRow";
import RecordList from "./RecordList";
import Segmented from "./Segmented";
import Skeleton from "./Skeleton";
import { trackEvent, trackFilters } from "./track";

export interface BoardCategory {
  value: string;
  label: string;
  /** 경기당 단위가 있는 부문 */
  perGame?: boolean;
  /** 부문 안 정렬 기준 (클러치 득점 "득점순 / 야투율순", 2026-11-01) — value 는 목록 키 부문, 첫 값이 기본. 주소 ?sort= */
  sorts?: { value: string; label: string }[];
}

interface Props {
  screen: "records_game" | "records_season" | "records_awards" | "records_clutch" | "records_profile";
  data: RecordListsData;
  categories: BoardCategory[];
  /** 경기 구분 칩을 쓰는가 */
  kinds?: boolean;
  /** 합계/경기당 전환을 쓰는가 */
  modes?: boolean;
  /** 페이지에 없는 목록은 /records/data/{remote}/… 에서 받는다 */
  remote?: RecordTab;
  /** 목록 키 만들기 (lib/data 의 키 규칙과 같아야 한다). scope = 기간 고르기 값 (scopes 가 없으면 "all") */
  listKey: (kind: GameKind, cat: string, mode: RecordMode, scope: string) => string;
  /** 목록 아래 안내 (지금 고른 상태에 맞춰) */
  note: (kind: GameKind, mode: RecordMode, scope: string, cat: string) => string;
  /** 고른 구분에 기록이 하나도 없을 때 문구 */
  emptyText?: (kind: GameKind) => string;
  /** 기간 고르기 (첫 값이 기본 — 통산). 있으면 경기 구분도 필터 밖 한 줄로 */
  scopes?: { value: string; label: string }[];
  /** 처음 고른 기간 (없으면 scopes 첫 값) — 프로필 탭은 최신 시즌 */
  defaultScope?: string;
  /** 구분·기간이 바뀔 때 (부모가 같은 기간의 다른 목록을 맞추려고) */
  onSelect?: (kind: GameKind, scope: string) => void;
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

export default function RecordBoardView({ screen, data, categories, kinds = false, modes = false, remote, listKey, note, emptyText, scopes, defaultScope, onSelect }: Props) {
  const [kind, setKind] = useState<GameKind>("regular");
  const [scope, setScope] = useState(defaultScope ?? scopes?.[0]?.value ?? "all");
  const baseScope = defaultScope ?? scopes?.[0]?.value;
  const inline = !!scopes;
  const [cat, setCat] = useState(categories[0].value);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [mode, setMode] = useState<RecordMode>("total");
  const [origin, setOrigin] = useState<RecordOrigin>("all");
  const [activeOnly, setActiveOnly] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const k = qs.get("kind");
    if (kinds && GAME_KINDS.some((g) => g.value === k)) setKind(k as GameKind);
    const c = qs.get("cat");
    if (c && categories.some((d) => d.value === c)) setCat(c);
    // 예전 주소: 정렬 기준이 부문이던 때(?cat=fgPct) → 그 정렬 기준을 가진 부문으로
    const owner = c ? categories.find((d) => d.sorts?.some((x) => x.value === c && x.value !== d.value)) : undefined;
    if (owner && c) {
      setCat(owner.value);
      setSortBy(c);
    }
    const so = qs.get("sort");
    if (so && categories.some((d) => d.sorts?.some((x) => x.value === so))) setSortBy(so);
    if (modes && qs.get("mode") === "perGame") setMode("perGame");
    const o = qs.get("origin");
    if (o === "domestic" || o === "foreign") setOrigin(o);
    if (qs.get("active") === "1") setActiveOnly(true);
    const s = qs.get("season");
    if (scopes && s && scopes.some((x) => x.value === s)) setScope(s);
  }, [categories, kinds, modes, scopes]);
  useEffect(() => {
    onSelect?.(kind, scope);
  }, [kind, scope, onSelect]);
  useEffect(() => {
    // 다른 컨트롤의 쿼리(수상 탭 ?season=)는 그대로 두고 이 화면 것만 고친다
    const qs = new URLSearchParams(window.location.search);
    const put = (k: string, v: string | null) => (v === null ? qs.delete(k) : qs.set(k, v));
    put("kind", kind !== "regular" ? kind : null);
    put("cat", cat !== categories[0].value ? cat : null);
    const sorts = categories.find((d) => d.value === cat)?.sorts;
    put("sort", sorts && sortBy && sortBy !== sorts[0].value && sorts.some((x) => x.value === sortBy) ? sortBy : null);
    put("mode", mode !== "total" ? mode : null);
    put("origin", origin !== "all" ? origin : null);
    put("active", activeOnly ? "1" : null);
    if (scopes) put("season", scope !== baseScope ? scope : null);
    const q = qs.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
  }, [kind, cat, sortBy, mode, origin, activeOnly, categories, scope, scopes, baseScope]);

  const def = categories.find((d) => d.value === cat) ?? categories[0];
  const effMode: RecordMode = modes && def.perGame ? mode : "total";
  const sortValue = def.sorts ? (def.sorts.find((x) => x.value === sortBy) ?? def.sorts[0]).value : null;
  const listCat = sortValue ?? def.value;
  const key = listKey(kind, listCat, effMode, scope);
  // 받아 온 목록 (키 → 목록·선수 정보). 실패한 키는 null
  const [loaded, setLoaded] = useState<Record<string, RecordListsData | null>>({});
  const missing = !!remote && !(key in data.lists) && !(key in loaded);
  useEffect(() => {
    if (!missing || !remote) return;
    let alive = true;
    fetch(recordListUrl(remote, key))
      .then((r) => (r.ok ? (r.json() as Promise<RecordListsData>) : null))
      .catch(() => null)
      .then((got) => {
        if (alive) setLoaded((m) => ({ ...m, [key]: got }));
      });
    return () => {
      alive = false;
    };
  }, [missing, remote, key]);
  const all = data.lists[key] ?? loaded[key]?.lists[key];
  const people = useMemo(() => {
    const extra = loaded[key]?.people;
    return extra ? { ...data.people, ...extra } : data.people;
  }, [data.people, loaded, key]);
  const failed = loaded[key] === null;
  const items = useMemo(() => filterRecordList(all ?? [], origin, activeOnly), [all, origin, activeOnly]);
  const filtered = origin !== "all" || activeOnly;
  function reset(field: RecordFilterField) {
    if (field === "kind") setKind(DEFAULT_RECORD_FILTERS.kind);
    if (field === "mode") setMode(DEFAULT_RECORD_FILTERS.mode);
    if (field === "origin") setOrigin(DEFAULT_RECORD_FILTERS.origin);
    if (field === "activeOnly") setActiveOnly(DEFAULT_RECORD_FILTERS.activeOnly);
  }

  return (
    <>
      {inline && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
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
          <label className="flex items-center gap-2 text-sub text-ink-2">
            <span className="shrink-0">기간</span>
            <select
              value={scope}
              onChange={(e) => {
                trackFilters(screen, { season: e.target.value });
                setScope(e.target.value);
              }}
              className="focus-ring h-10 rounded-control border border-line bg-surface px-3 text-base text-ink"
            >
              {scopes!.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {/* 1차 컨트롤은 부문 칩 한 줄, 경기 구분·합계/경기당·국적·현역만은 필터 버튼 안 (2026-10-06 사용자: 누르는 단계 최대 2번) */}
      <ChipRow
        label="부문 선택"
        scroll
        chips={categories.map((d) => ({ value: d.value, label: d.label }))}
        value={def.value}
        onChange={(v) => {
          trackFilters(screen, { category: v });
          setCat(v);
        }}
      />
      {def.sorts && sortValue && (
        <div className="mt-3">
          <Segmented
            label={`${def.label} 정렬 기준`}
            options={def.sorts}
            value={sortValue}
            onChange={(v) => {
              trackFilters(screen, { sort: v });
              setSortBy(v);
            }}
          />
        </div>
      )}
      <div className="mt-3">
        <FilterSheet
          chips={recordFilterChips({ kind: inline ? "regular" : kind, mode, origin, activeOnly }, modes && !!def.perGame).map((c) => ({
            key: c.field,
            label: c.label,
            onClear: () => reset(c.field),
          }))}
          onReset={() => (inline ? (["mode", "origin", "activeOnly"] as const) : (["kind", "mode", "origin", "activeOnly"] as const)).forEach(reset)}
          resultText={`${items.length}명 보기`}
          trailing={`${items.length}명`}
        >
          {kinds && !inline && (
            <FilterGroup label="경기 구분">
              <Segmented
                label="경기 구분"
                options={GAME_KINDS.map((g) => ({ value: g.value, label: g.label }))}
                value={kind}
                onChange={(v) => {
                  trackFilters(screen, { kind: v });
                  setKind(v);
                }}
              />
            </FilterGroup>
          )}
          {modes && def.perGame && (
            <FilterGroup label="기록 단위">
              <Segmented
                label="합계 또는 경기당"
                options={MODE_OPTIONS}
                value={mode}
                onChange={(v) => {
                  trackFilters(screen, { mode: v });
                  setMode(v);
                }}
              />
            </FilterGroup>
          )}
          <FilterGroup label="국적">
            <Segmented
              label="국적"
              options={ORIGIN_OPTIONS}
              value={origin}
              onChange={(v) => {
                trackFilters(screen, { origin: v });
                setOrigin(v);
              }}
            />
          </FilterGroup>
          <FilterGroup label="현역" hint={<>현역 = KBL 현역 등록 명단에 있는 선수 <InfoLink term="rosterStatus" /></>}>
            <ActiveOnlyToggle
              on={activeOnly}
              onChange={(v) => {
                trackFilters(screen, { active_only: v });
                setActiveOnly(v);
              }}
            />
          </FilterGroup>
        </FilterSheet>
      </div>
      <section aria-label={`${def.label} 순위`} className="mt-4">
        {missing ? (
          <div className="surface-card rounded-container p-3">
            <p role="status" className="sr-only">
              순위 불러오는 중
            </p>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="my-2 h-12 w-full" />
            ))}
          </div>
        ) : failed ? (
          <div role="alert" className="surface-card rounded-container px-4 py-8 text-center text-body text-ink-2">
            <p>순위를 불러오지 못했어요.</p>
            <button
              type="button"
              onClick={() =>
                setLoaded((m) => {
                  const next = { ...m };
                  delete next[key];
                  return next;
                })
              }
              className="focus-ring mt-3 inline-flex h-10 cursor-pointer items-center rounded-control border border-line px-4 text-sub font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
            >
              다시 불러오기
            </button>
          </div>
        ) : (
        <RecordList
          key={`${key}:${origin}:${activeOnly}`}
          items={items}
          people={people}
          empty={(all ?? []).length > 0 && filtered ? "조건에 맞는 선수가 없습니다." : (emptyText?.(kind) ?? "기록이 없습니다.")}
          onReset={
            (all ?? []).length > 0 && filtered
              ? () => {
                  trackEvent("filter_reset", { screen });
                  reset("origin");
                  reset("activeOnly");
                }
              : undefined
          }
        />
        )}
        <p className="mt-2 text-sub text-ink-3">{note(kind, effMode, scope, listCat)}</p>
      </section>
    </>
  );
}
