"use client";
// 비교 탭 (/compare): 슬롯 A·B 각각 검색창으로 선수 → 그 선수가 뛴 시즌 칩에서 시즌(기본 최신) → 카드 두 장 + 비교표.
// - 다른 선수·다른 시즌·같은 선수 두 시즌 모두 된다. 순위·등급은 각자 자기 시즌 안 값 (lib/cardview, 표 아래 안내).
// - 데이터는 전부 우리 정적 파일: 선수·뛴 시즌은 /search-index.json(useSearchIndex), 카드는 /cards/{코드}.json(useCardView).
//   정적 HTML에는 서버가 계산한 기본 비교(initialA·initialB)가 들어간다.
// - 상태는 주소 ?a=번호:코드&b=번호:코드 에 남겨 공유한다 (lib/cardview parseCompareQuery·compareQueryString).
// - 모바일(768px 미만)에 두 선수가 다 있으면 카드 2장 대신 좌우 비교(CompareHeadToHead: 겹친 레이더 + A값 | 항목 | B값 막대),
//   카드 전체는 "카드 보기" 토글로 (저장도 거기서). PC 는 카드 2장 + 비교표 그대로 (피드백 5차 #6).
//   화면 폭 판단은 CSS(md:)로 해 정적 HTML 에서도 깜빡이지 않는다.
import { useEffect, useState } from "react";
import type { SearchEntry, SeasonOption } from "@/lib/types";
import {
  compareQueryString,
  latestSeason,
  parseCompareQuery,
  playerHref,
  type CompareSlot,
  type SeasonCardView,
} from "@/lib/cardview";
import { seasonShortLabel } from "@/lib/career";
import CardDeck, { type DeckCard } from "./CardDeck";
import ChipRow from "./ChipRow";
import { seasonChip } from "./PrimeTag";
import { CAREER_CODE, CAREER_LABEL } from "@/lib/career-cards";
import CompareHeadToHead from "./CompareHeadToHead";
import CompareTable from "./CompareTable";
import { IconChevronDown, IconChevronUp } from "./icons";
import PlayerSearch from "./PlayerSearch";
import { useCardView } from "./useSeasonCards";
import { loadSearchIndex } from "./useSearchIndex";
import { useThemeColors } from "./useThemeColors";

/** 서버가 넣어 주는 기본 슬롯 */
export interface SlotInit {
  id: string;
  nameKo: string;
  /** 뛴 시즌 코드 (오름차순) */
  seasons: number[];
  view: SeasonCardView;
  prime?: number;
}

interface Slot {
  id: string;
  nameKo: string;
  seasons: number[];
  season: number;
  /** 프라임 시즌 코드 (검색 색인) */
  prime?: number;
}

interface Props {
  /** 선수가 있는 시즌 (라벨 찾기용) */
  seasons: SeasonOption[];
  initialA: SlotInit | null;
  initialB: SlotInit | null;
}

const fromInit = (s: SlotInit | null): Slot | null =>
  s ? { id: s.id, nameKo: s.nameKo, seasons: s.seasons, season: s.view.seasonCode, prime: s.prime } : null;

const fromEntry = (e: SearchEntry, season?: number): Slot => ({
  id: e.id,
  nameKo: e.nameKo,
  seasons: e.seasons,
  // 통산(CAREER_CODE)도 고를 수 있다
  season: season !== undefined && (season === CAREER_CODE || e.seasons.includes(season)) ? season : (latestSeason(e.seasons) ?? e.last),
  prime: e.prime,
});

export default function CompareView({ seasons, initialA, initialB }: Props) {
  const colors = useThemeColors();
  const [a, setA] = useState<Slot | null>(fromInit(initialA));
  const [b, setB] = useState<Slot | null>(fromInit(initialB));
  const [queryError, setQueryError] = useState(false);
  // 모바일 좌우 비교에서 카드 2장 펼치기
  const [showCards, setShowCards] = useState(false);
  const labelOf = (code: number) =>
    code === CAREER_CODE ? CAREER_LABEL : seasonShortLabel(seasons.find((s) => s.seasonCode === code)?.seasonLabel ?? String(code));
  const hrefOf = (id: string, code: number) => playerHref(id, code === CAREER_CODE ? undefined : code);

  // 공유 링크(?a=&b=)로 들어오면 검색 색인에서 선수 이름·뛴 시즌을 찾아 슬롯을 채운다
  useEffect(() => {
    const q = parseCompareQuery(window.location.search);
    if (!q.a && !q.b) return;
    loadSearchIndex()
      .then((list) => {
        const byId = new Map(list.map((e) => [e.id, e]));
        const fill = (slot: CompareSlot | null, set: (s: Slot) => void) => {
          const e = slot && byId.get(slot.id);
          if (e) set(fromEntry(e, slot.seasonCode));
          else if (slot) setQueryError(true);
        };
        fill(q.a, setA);
        fill(q.b, setB);
      })
      .catch(() => setQueryError(true));
  }, []);

  useEffect(() => {
    const toSlot = (s: Slot | null): CompareSlot | null => (s ? { id: s.id, seasonCode: s.season } : null);
    window.history.replaceState(null, "", `${window.location.pathname}${compareQueryString(toSlot(a), toSlot(b))}`);
  }, [a, b]);

  const va = useCardView(a?.id ?? null, a?.season ?? null, "all", initialA?.view);
  const vb = useCardView(b?.id ?? null, b?.season ?? null, "all", initialB?.view);
  const cards: DeckCard[] = [];
  if (a && va.view) cards.push({ view: va.view, loading: va.status === "loading", nameHref: hrefOf(a.id, va.view.seasonCode) });
  if (b && vb.view) cards.push({ view: vb.view, loading: vb.status === "loading", nameHref: hrefOf(b.id, vb.view.seasonCode) });
  // 공유 주소로 열려 아직 값이 없는 자리 → 스켈레톤 (디자인 점검 C3)
  const pending = [a && !va.view && va.status === "loading", b && !vb.view && vb.status === "loading"].filter(Boolean).length;
  const both = cards.length === 2 ? ([cards[0].view, cards[1].view] as const) : null;
  const tag = (v: SeasonCardView) => `${v.entry.player.nameKo} ${labelOf(v.seasonCode)}`;

  const slotUi = (name: "A" | "B", slot: Slot | null, set: (s: Slot | null) => void, series: string, other: Slot | null) => (
    <section aria-label={`선수 ${name}`} className="surface-card min-w-0 rounded-container p-3">
      <h2 className="flex min-w-0 items-center gap-2 text-h2 font-bold">
        {/* deslop-ignore-next-line 19 */}
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: series }} />
        선수 {name}
        {slot && <span className="truncate text-ink-2">· {slot.nameKo}</span>}
      </h2>
      <PlayerSearch
        className="mt-2 w-full"
        label={`선수 ${name} 검색`}
        placeholder={slot ? "다른 선수로 바꾸기" : "선수 이름 검색"}
        onSelect={(e) => set(fromEntry(e))}
      />
      {slot && (
        <div className="mt-2.5">
          <p className="mb-1.5 text-sub font-semibold text-ink-2">
            시즌 · {slot.seasons.length}시즌 뛰었음
            {slot.season === CAREER_CODE && <span className="font-normal text-ink-3"> · 통산은 100경기 이상 선수끼리 비교</span>}
          </p>
          <ChipRow
            label={`선수 ${name} 시즌`}
            scroll
            chips={[
              { value: CAREER_CODE, label: CAREER_LABEL, aria: "통산 (전 시즌 합계)" },
              ...[...slot.seasons].reverse().map((c) => seasonChip(c, labelOf(c), slot.prime)),
            ]}
            value={slot.season}
            onChange={(c) => set({ ...slot, season: c })}
          />
          {other && other.id !== slot.id && (
            <button
              type="button"
              onClick={() => set({ ...other, season: other.seasons.find((c) => c !== other.season) ?? other.season })}
              className="focus-ring mt-1 inline-flex h-10 items-center rounded-control text-sub font-semibold text-ink-2 underline underline-offset-4 transition-colors duration-200 hover:text-ink"
            >
              {other.nameKo}의 다른 시즌과 비교하기
            </button>
          )}
        </div>
      )}
    </section>
  );

  return (
    <main className="mx-auto max-w-5xl px-4 pt-5">
      <header className="mb-4">
        <h1 className="text-h1 font-bold">비교</h1>
        <p className="mt-1 text-body text-ink-2">두 선수, 또는 한 선수의 두 시즌을 나란히 봅니다.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {slotUi("A", a, setA, colors.series1, b)}
        {slotUi("B", b, setB, colors.series2, a)}
      </div>
      {queryError && (
        <p role="alert" className="mt-2 text-body text-ink-2">
          주소의 선수를 찾지 못했습니다. 검색으로 다시 골라 주세요.
        </p>
      )}
      {[va, vb].some((v) => v.status === "error") && (
        <p role="alert" className="mt-2 text-body text-ink-2">
          시즌 기록을 불러오지 못했습니다. 시즌을 다시 눌러 주세요.
        </p>
      )}

      <div className="mt-5 space-y-6">
        {both && (
          <div className="space-y-2 md:hidden">
            <CompareHeadToHead
              a={both[0]}
              b={both[1]}
              aLabel={tag(both[0])}
              bLabel={tag(both[1])}
              colors={colors}
              caption={`${tag(both[0])}와 ${tag(both[1])} 좌우 비교`}
            />
            <button
              type="button"
              aria-expanded={showCards}
              aria-controls="compare-cards"
              onClick={() => setShowCards((v) => !v)}
              className="focus-ring inline-flex h-11 w-full cursor-pointer items-center justify-center gap-1 rounded-control border border-line bg-surface text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
            >
              {showCards ? "카드 접기" : "카드 보기 · 이미지 저장"}
              {showCards ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </button>
          </div>
        )}
        {cards.length + pending > 0 && (
          <div id="compare-cards" className={both && !showCards ? "hidden md:block" : ""}>
            <CardDeck
              cards={cards}
              pending={pending}
              fileName={`${cards.map((c) => `${c.view.entry.player.nameKo}_${labelOf(c.view.seasonCode)}`).join("_vs_")}_플레이어카드.png`}
            />
          </div>
        )}
        {both && (
          <div className="hidden md:block">
          <CompareTable
            a={both[0]}
            b={both[1]}
            aLabel={tag(both[0])}
            bLabel={tag(both[1])}
            seriesA={colors.series1}
            seriesB={colors.series2}
            showDelta={both[0].entry.player.id === both[1].entry.player.id}
            caption={`${tag(both[0])}와 ${tag(both[1])} 기록 비교`}
          />
          </div>
        )}
      </div>
    </main>
  );
}
