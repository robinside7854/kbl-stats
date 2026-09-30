"use client";
// 선수 상세(/player/[번호])의 카드 영역: 시즌 칩 → 플레이어 카드(+ 시즌 비교) → 설명.
// - 시즌 칩: 그 선수가 뛴 시즌 전부(최신이 기본). 고르면 카드가 그 시즌 기록·순위·등급·팀 색·로고로 바뀐다.
//   첫 화면(최신 시즌·전체 범위) 카드는 서버가 계산해 정적 HTML에 넣고(initial), 다른 시즌은 /cards/{코드}.json 을 받아
//   lib/cardview buildSeasonCardView 로 계산한다 (useCardView).
// - 순위 범위: 전체 / 같은 포지션 — 카드의 순위·등급 비교 집단만 바꾼다 ("가드 중 3위").
// - 시즌 비교: 켜면 두 번째 시즌 칩 줄 + 카드 두 장 + 스탯 증감 표, 비교 탭 링크.
// - 상태는 주소 ?season=&vs=&scope=pos 에 남긴다 (window.location — 정적 HTML은 기본 상태로 그려진다).
// - 시즌별 기록표(CareerTable)의 시즌을 누르면 "player-season" 이벤트로 여기 시즌을 바꾼다.
import { useEffect, useMemo, useState } from "react";
import type { SeasonOption } from "@/lib/types";
import {
  compareHref,
  defaultVsSeason,
  parsePlayerQuery,
  playerQueryString,
  type CardScope,
  type PlayerViewState,
  type SeasonCardView,
} from "@/lib/cardview";
import { seasonShortLabel } from "@/lib/career";
import Link from "next/link";
import CardDeck from "./CardDeck";
import ChipRow from "./ChipRow";
import CompareTable from "./CompareTable";
import InfoLink from "./InfoLink";
import Segmented from "./Segmented";
import { useCardView } from "./useSeasonCards";
import { useThemeColors } from "./useThemeColors";

/** 시즌별 기록표 등 다른 컴포넌트가 카드 시즌을 바꿀 때 보내는 이벤트 이름 */
export const PLAYER_SEASON_EVENT = "player-season";

interface Props {
  playerId: string;
  nameKo: string;
  /** 그 선수가 뛴 시즌 (오름차순) */
  seasons: SeasonOption[];
  /** 서버 계산 카드: 가장 최근 시즌 · 전체 범위 */
  initial: SeasonCardView;
  /** 포지션 묶음 이름 (예: "가드"). 모르면 null → 같은 포지션 범위 버튼을 끈다 */
  groupLabel: string | null;
  /** 카드 한 장일 때 PC 에서 오른쪽에 둘 내용 (시즌별 추이 그래프) — 시즌 비교 중에는 아래로 */
  aside?: React.ReactNode;
}

export default function PlayerSeasonCards({ playerId, nameKo, seasons, initial, groupLabel, aside }: Props) {
  const colors = useThemeColors();
  const codes = useMemo(() => seasons.map((s) => s.seasonCode), [seasons]);
  const labelOf = (code: number) => seasonShortLabel(seasons.find((s) => s.seasonCode === code)?.seasonLabel ?? String(code));
  const [state, setState] = useState<PlayerViewState>({ season: initial.seasonCode, vs: null, scope: "all" });

  // 공유 링크로 들어온 상태 반영 + 기록표에서 시즌을 누르면 카드 시즌 변경
  useEffect(() => {
    setState(parsePlayerQuery(window.location.search, codes));
    const onSeason = (e: Event) => {
      const code = (e as CustomEvent<number>).detail;
      if (codes.includes(code)) setState((s) => ({ ...s, season: code, vs: s.vs === code ? null : s.vs }));
    };
    window.addEventListener(PLAYER_SEASON_EVENT, onSeason);
    return () => window.removeEventListener(PLAYER_SEASON_EVENT, onSeason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${playerQueryString(state, codes)}${window.location.hash}`);
  }, [state, codes]);

  const { season, vs, scope } = state;
  const a = useCardView(playerId, season, scope, initial);
  const b = useCardView(vs === null ? null : playerId, vs, scope, null);
  const comparing = vs !== null;

  function chooseSeason(code: number) {
    setState((s) => ({ ...s, season: code, vs: s.vs === code ? defaultVsSeason(codes.filter((c) => c !== code), code) : s.vs }));
  }
  function toggleCompare() {
    setState((s) => ({ ...s, vs: s.vs === null ? defaultVsSeason(codes, s.season) : null }));
  }

  const scopeOptions: { value: CardScope; label: string }[] = [
    { value: "all", label: "전체" },
    { value: "position", label: groupLabel ? `같은 포지션 (${groupLabel})` : "같은 포지션" },
  ];
  const seasonChips = (list: number[]) =>
    [...list].reverse().map((c) => ({ value: c, label: labelOf(c), aria: `${labelOf(c)} 시즌` }));

  const viewA = a.view;
  const viewB = comparing ? b.view : null;
  const cards = [
    viewA && { view: viewA, loading: a.status === "loading" },
    viewB && { view: viewB, loading: b.status === "loading" },
  ].filter((c): c is { view: SeasonCardView; loading: boolean } => !!c);
  const fileName = `${nameKo}_${labelOf(season)}${viewB ? `_vs_${labelOf(viewB.seasonCode)}` : ""}_플레이어카드.png`;
  const classic = cards.some((c) => c.view.axisSet === "classic");
  const mixedAxes = cards.length === 2 && cards[0].view.axisSet !== cards[1].view.axisSet;

  const deck = (
    <section id="season-card" aria-label="시즌 플레이어 카드" className="scroll-mt-4">
      {cards.length > 0 ? (
        <CardDeck cards={cards} fileName={fileName} />
      ) : (
        <p className="rounded-xl border border-line bg-surface px-4 py-8 text-center text-sm text-ink-2">
          {a.status === "error" ? "시즌 기록을 불러오지 못했습니다. 다시 시도해 주세요." : "시즌 기록 불러오는 중…"}
        </p>
      )}
      {(a.status === "error" || b.status === "error") && cards.length > 0 && (
        <p role="alert" className="mt-2 text-sm text-ink-2">
          시즌 기록을 불러오지 못했습니다. 다른 시즌을 눌렀다가 다시 눌러 주세요.
        </p>
      )}
    </section>
  );

  return (
    <div>
      {/* ── 조작: 시즌 칩 · 순위 범위 · 시즌 비교 ── */}
      <section aria-label="카드 보기 설정" className="space-y-2.5">
        <div>
          <h2 className="mb-1.5 text-sm font-bold">
            시즌 <span className="font-normal text-ink-3">· {seasons.length}시즌 뛰었음</span>
          </h2>
          <ChipRow label="카드 시즌 선택" chips={seasonChips(codes)} value={season} onChange={chooseSeason} scroll />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="순위·등급 비교 범위"
            options={groupLabel ? scopeOptions : scopeOptions.slice(0, 1)}
            value={scope}
            onChange={(v) => setState((s) => ({ ...s, scope: v }))}
          />
          {codes.length > 1 && (
            <button
              type="button"
              aria-pressed={comparing}
              onClick={toggleCompare}
              className={`h-10 rounded-lg border px-3 text-sm font-semibold ${
                comparing ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2"
              }`}
            >
              {comparing ? "시즌 비교 끄기" : "시즌 비교"}
            </button>
          )}
        </div>
        {!groupLabel && <p className="text-xs text-ink-3">포지션 정보가 없는 선수라 순위 범위는 전체만 볼 수 있습니다.</p>}
        {comparing && vs !== null && (
          <div>
            <h3 className="mb-1.5 text-sm font-bold">
              비교할 시즌 <span className="font-normal text-ink-3">· 레이더 선 주황</span>
            </h3>
            <ChipRow
              label="비교할 시즌 선택"
              chips={seasonChips(codes.filter((c) => c !== season))}
              value={vs}
              onChange={(v) => setState((s) => ({ ...s, vs: v }))}
              scroll
            />
            <p className="mt-1.5 text-xs">
              <Link
                href={compareHref({ id: playerId, seasonCode: season }, { id: playerId, seasonCode: vs })}
                className="font-semibold text-ink-2 underline underline-offset-4 hover:text-ink"
              >
                비교 탭에서 다른 선수와도 비교하기 ›
              </Link>
            </p>
          </div>
        )}
      </section>

      {/* ── 카드 ── */}
      {comparing ? (
        <div className="mt-4 space-y-6">
          {deck}
          {viewA && viewB && (
            <CompareTable
              a={viewA}
              b={viewB}
              aLabel={labelOf(viewA.seasonCode)}
              bLabel={labelOf(viewB.seasonCode)}
              seriesA={colors.series1}
              seriesB={colors.series2}
              showDelta
              caption={`${nameKo} ${labelOf(viewA.seasonCode)}와 ${labelOf(viewB.seasonCode)} 시즌 기록 비교`}
            />
          )}
          {aside && <div className="min-w-0">{aside}</div>}
        </div>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-[500px_minmax(0,1fr)] lg:items-start">
          {deck}
          {aside && <div className="min-w-0">{aside}</div>}
        </div>
      )}

      <p className="mt-4 max-w-3xl text-xs leading-relaxed text-ink-3">
        카드 아래 레이더는 원래 값이 아니라 시즌 내 백분위(0~100)이고, 꼭짓점 글자는 그 백분위의 등급입니다 — S 상위 10%, A 상위 25%,
        B 상위 45%, C 상위 65%, D 상위 85%, F 그 아래 <InfoLink term="percentileGrade" />. 종합 등급은 5개 축 백분위 평균의 등급입니다.
        사진은 시즌별로 따로 없어 모든 시즌 카드에 같은 사진을 쓰고, 팀 색·로고는 그 시즌 소속 팀 것입니다.{" "}
        {classic
          ? "2차 스탯(USG%·AST%·REB%)이 없는 시즌은 40분당 환산과 TS%·PER로 그렸습니다(고전 축)"
          : "USG%는 표준 척도(KBL 원값×5), 용어 참고"}
        {classic ? <InfoLink term="per40" className="ml-0.5" /> : <InfoLink term="usgPct" className="ml-0.5" />}
        {mixedAxes && " — 두 시즌의 레이더 축이 달라 모양을 직접 비교할 수 없습니다"}.
      </p>
    </div>
  );
}
