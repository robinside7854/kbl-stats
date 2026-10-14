"use client";
// 선수 상세(/player/[번호])의 카드 영역: 시즌 칩 → 플레이어 카드 → 설명.
// - 시즌 칩: 그 선수가 뛴 시즌 전부(최신이 기본). 고르면 카드가 그 시즌 기록·순위·등급·팀 색·로고로 바뀐다.
//   첫 화면(최신 시즌·전체 범위) 카드는 서버가 계산해 정적 HTML에 넣고(initial), 다른 시즌은 /cards/{코드}.json 을 받아
//   lib/cardview buildSeasonCardView 로 계산한다 (useCardView).
// - 순위 범위: 전체 / 같은 포지션 — 카드의 순위 비교 집단만 바꾼다 ("가드 중 3위"). 등급은 항상 같은 국적 집단 안.
// - 같은 선수 "시즌 비교"는 없앴다(2026-09-30 사용자 피드백) — 두 시즌·두 선수 비교는 비교 탭 링크로.
// - 상태는 주소 ?season=&scope=pos 에 남긴다 (window.location — 정적 HTML은 기본 상태로 그려진다).
// - PC(1024px 이상)는 가로 카드(왼쪽 사진·가운데 스탯·오른쪽 레이더, 높이 520px 이하) 한 줄 → 그 아래
//   시즌별 추이(원래 높이) + 오른쪽 좁은 열에 하이라이트 카드 3개 세로(그 시즌 순위 1~10위 부문, 없으면 커리어 하이).
//   (피드백 5차 #1: 세로 카드 옆에 추이를 카드 높이만큼 늘이던 배치를 없앴다.) 모바일은 세로 카드 → 추이 → 하이라이트 3개 가로.
// - 추이·하이라이트 아래 슛 차트(ShotChart) — 같은 시즌 칩을 따른다 (PLAN.md §14).
// - 시즌별 기록표(CareerTable)의 시즌을 누르면 "player-season" 이벤트로 여기 시즌을 바꾼다.
// - 시즌 칩 줄이 화면 위로 지나가면 떠 있는 시즌 바(FloatingSeasonBar)로 어디서든 시즌을 바꾼다 (2026-10-01).
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SeasonOption } from "@/lib/types";
import { compareHref, parsePlayerQuery, playerQueryString, type CardScope, type PlayerViewState } from "@/lib/cardview";
import { seasonShortLabel } from "@/lib/career";
import CardDeck from "./CardDeck";
import ChipRow from "./ChipRow";
import FloatingSeasonBar from "./FloatingSeasonBar";
import PrimeTag, { seasonChip } from "./PrimeTag";
import { IconChevronRight } from "./icons";
import InfoLink from "./InfoLink";
import { PlayerCardSkeleton } from "./PlayerCard";
import Segmented from "./Segmented";
import { useCardView } from "./useSeasonCards";
import { careerHighlights, seasonHighlights, type SeasonCardView } from "@/lib/cardview";
import type { CareerHighRow } from "@/lib/career";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import HighlightCards from "./HighlightCards";
import ShotChart from "./ShotChart";
import type { PlayerShotsFile } from "@/lib/shots";
import { similarFileUrl, type SimilarEntry } from "@/lib/similar";
import SimilarPlayers from "./SimilarPlayers";
import PercentileBars from "./PercentileBars";
import GameRangeBars from "./GameRangeBars";
import type { GameRangeSet } from "@/lib/career";
import { trackFilters } from "./track";

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
  /** 카드 아래에 둘 내용 (시즌별 추이 그래프 — PC 는 하이라이트 3개가 그 오른쪽 열) */
  aside?: React.ReactNode;
  /** 정규시즌 커리어 하이 행 (시즌 순위 1~10위가 없을 때 하이라이트 대체용). 없으면 [] */
  careerHighRows: CareerHighRow[];
  /** 슛 차트가 있는 시즌 코드 */
  shotSeasons: number[];
  /** 서버가 넣은 최신 시즌 슛 파일 (없으면 null) */
  initialShots: PlayerShotsFile | null;
  /** 처음 보이는 시즌의 비슷한 시즌 5개 (빌드 때 lib/similar). 다른 시즌은 고를 때 /similar/{번호}.json 을 받는다. 표본 미달 시즌은 키가 없다 */
  similar?: Record<number, SimilarEntry[]>;
  /** 비슷한 시즌이 있는 시즌 코드 (여기 없는 시즌은 파일을 받지 않고 "표본 미달" 안내) */
  similarSeasons?: number[];
  /** 프라임 시즌 코드 (lib/prime). 없으면 null */
  primeSeason?: number | null;
  /** 시즌별 경기 범위 (박스스코어가 있는 시즌만, lib/career gameRanges) */
  gameRanges?: Record<number, GameRangeSet>;
}

export default function PlayerSeasonCards({ playerId, nameKo, seasons, initial, groupLabel, aside, careerHighRows, shotSeasons, initialShots, similar, similarSeasons, primeSeason, gameRanges }: Props) {
  const codes = useMemo(() => seasons.map((s) => s.seasonCode), [seasons]);
  const labelOf = (code: number) => seasonShortLabel(seasons.find((s) => s.seasonCode === code)?.seasonLabel ?? String(code));
  const [state, setState] = useState<PlayerViewState>({ season: initial.seasonCode, scope: "all" });
  // 위쪽 시즌 칩 줄 — 화면 밖으로 나가면 떠 있는 시즌 바(FloatingSeasonBar)가 나타난다
  const [chipsEl, setChipsEl] = useState<HTMLDivElement | null>(null);

  // 공유 링크로 들어온 상태 반영 + 기록표에서 시즌을 누르면 카드 시즌 변경
  useEffect(() => {
    setState(parsePlayerQuery(window.location.search, codes));
    const onSeason = (e: Event) => {
      const code = (e as CustomEvent<number>).detail;
      if (codes.includes(code)) setState((s) => ({ ...s, season: code }));
    };
    window.addEventListener(PLAYER_SEASON_EVENT, onSeason);
    return () => window.removeEventListener(PLAYER_SEASON_EVENT, onSeason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${playerQueryString(state, codes)}${window.location.hash}`);
  }, [state, codes]);

  const { season, scope } = state;
  const a = useCardView(playerId, season, scope, initial);
  const similarState = useSimilarSeasons(playerId, season, similar, similarSeasons);

  const scopeOptions: { value: CardScope; label: string }[] = [
    { value: "all", label: "전체" },
    { value: "position", label: groupLabel ? `같은 포지션 (${groupLabel})` : "같은 포지션" },
  ];
  const seasonChips = [...codes].reverse().map((c) => seasonChip(c, labelOf(c), primeSeason));

  const view = a.view;
  // 하이라이트: 고른 시즌 순위 1~10위 부문 최대 3개, 없으면 정규시즌 커리어 하이 상위 3개 (lib/cardview)
  const seasonItems = view ? seasonHighlights(view.entry.stats, view.groupLabel) : [];
  const highlight =
    seasonItems.length > 0
      ? { title: `${labelOf(view!.seasonCode)} 하이라이트`, items: seasonItems }
      : { title: "커리어 하이 (정규시즌)", items: careerHighlights(careerHighRows) };
  const fileName = `${nameKo}_${labelOf(season)}_플레이어카드.png`;

  const deck = (
    <section id="season-card" aria-label="시즌 플레이어 카드" className="scroll-mt-4">
      {view ? (
        <CardDeck cards={[{ view, loading: a.status === "loading" }]} fileName={fileName} wideLayout />
      ) : a.status === "error" ? (
        <p role="alert" className="surface-card rounded-container px-4 py-8 text-center text-body text-ink-2">
          시즌 기록을 불러오지 못했습니다. 시즌을 다시 눌러 주세요.
        </p>
      ) : (
        <div className="mx-auto w-full max-w-[420px] md:max-w-[500px]">
          <p role="status" className="sr-only">
            시즌 기록 불러오는 중
          </p>
          <PlayerCardSkeleton />
        </div>
      )}
      {a.status === "error" && view && (
        <p role="alert" className="mt-2 text-body text-ink-2">
          시즌 기록을 불러오지 못했습니다. 다른 시즌을 눌렀다가 다시 눌러 주세요.
        </p>
      )}
    </section>
  );

  return (
    <div>
      {/* ── 조작: 시즌 칩 · 순위 범위 · 비교 탭 링크 ── */}
      <section aria-label="카드 보기 설정" className="space-y-2.5">
        <div ref={setChipsEl}>
          <h2 id="season-cards-title" className="text-h2 font-bold">시즌 카드</h2>
          <div className="mb-1.5 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sub font-semibold text-ink-2">
              시즌 <span className="font-normal text-ink-3">· {seasons.length}시즌 뛰었음</span>
            </p>
            {/* 프라임 시즌 바로 가기: 칩 줄이 최신 시즌부터라 옛 프라임 시즌은 화면 밖에 있을 수 있다 */}
            {primeSeason != null && primeSeason !== season && codes.includes(primeSeason) && (
              <button
                type="button"
                onClick={() => {
                  trackFilters("player", { season: primeSeason, via: "prime" });
                  setState((s) => ({ ...s, season: primeSeason }));
                }}
                className="focus-ring link-shortcut gap-1.5 px-1 text-sub"
              >
                <PrimeTag /> {labelOf(primeSeason)} 시즌 보기
                <IconChevronRight size={16} />
              </button>
            )}
          </div>
          <ChipRow label="카드 시즌 선택" chips={seasonChips} value={season} onChange={(c) => {
          trackFilters("player", { season: c });
          setState((s) => ({ ...s, season: c }));
        }} scroll />
        </div>
      </section>

      {/* 순위 기준(전체 / 같은 포지션)은 카드 바로 위 — 카드 속 순위와 한 화면에 보이게
          (2026-10-06 카드 아래로 옮겼다가 2026-10-11 사용자: "버튼이 너무 밑이라 순위와 한 번에 안 보임") */}
      {groupLabel && (
        <div className="mt-3 flex items-center gap-2 text-sub font-medium text-ink-3">
          순위 기준
          <Segmented
            label="순위 비교 범위"
            options={scopeOptions}
            value={scope}
            onChange={(v) => {
              trackFilters("player", { scope: v });
              setState((s) => ({ ...s, scope: v }));
            }}
          />
        </div>
      )}

      {/* ── 카드 (PC 가로 카드 한 줄) → 추이 + 하이라이트 ── */}
      <div className={groupLabel ? "mt-2" : "mt-4"}>{deck}</div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          href={compareHref({ id: playerId, seasonCode: season })}
          className="focus-ring link-shortcut text-body"
        >
          비교 탭에서 다른 선수·시즌과 비교
          <IconChevronRight size={16} />
        </Link>
      </div>
      <p className="mt-3 text-sub leading-relaxed text-ink-3">
        등급은 같은 국적 집단 안, 순위는 리그 전체{groupLabel ? "(또는 같은 포지션)" : ""} 기준입니다 <InfoLink term="radarAxes" />. 사진은 모든 시즌에 같은 한 장입니다.
      </p>
      {/* 경기별 기록 범위 (토스 검토 B-9): 박스스코어가 있는 시즌만, 카드 시즌을 따른다 */}
      {gameRanges?.[season] && (
        <div className="mt-6">
          <GameRangeBars data={gameRanges[season]} seasonShort={labelOf(season)} />
        </div>
      )}
      {/* 세부 능력치 백분위 막대 (Baseball Savant 방식): 카드와 같은 시즌·같은 등급 집단 */}
      {view && (
        <div className="mt-6">
          <PercentileBars view={view} seasonShort={labelOf(view.seasonCode)} />
        </div>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="min-w-0">{aside}</div>
        <HighlightCards title={highlight.title} items={highlight.items} teamPrimary={view?.team?.color.primary ?? FALLBACK_TEAM_COLOR.primary} />
      </div>
      {/* 슛 차트: 카드와 같은 시즌을 따른다 (팀 색도 그 시즌 카드의 팀) */}
      <div className="mt-8">
        <ShotChart
          playerId={playerId}
          seasonCode={season}
          seasonShort={labelOf(season)}
          available={shotSeasons}
          initial={initialShots}
          teamPrimary={view?.team?.color.primary ?? FALLBACK_TEAM_COLOR.primary}
        />
      </div>
      <FloatingSeasonBar
        codes={codes}
        season={season}
        labelOf={labelOf}
        primeSeason={primeSeason}
        onChange={(c) => {
          trackFilters("player", { season: c });
          setState((s) => ({ ...s, season: c }));
        }}
        anchor={chipsEl}
      />
      {/* 비슷한 시즌: 카드와 같은 시즌을 따른다 */}
      {similar && (
        <div className="mt-8">
          <SimilarPlayers items={similarState.items} loading={similarState.loading} seasonShort={labelOf(season)} />
        </div>
      )}
    </div>
  );
}

/**
 * 비슷한 시즌 목록 (2026-10-14 결과물 줄이기): 페이지에는 처음 시즌 것만 들어 있고,
 * 그 밖의 시즌을 고르면 선수 파일(/similar/{번호}.json — 모든 시즌)을 한 번 받아 둔다.
 */
function useSimilarSeasons(
  playerId: string,
  season: number,
  initial: Record<number, SimilarEntry[]> | undefined,
  available: number[] | undefined,
) {
  const [all, setAll] = useState<Record<number, SimilarEntry[]> | null>(null);
  const [failed, setFailed] = useState(false);
  const inInitial = !!initial && season in initial;
  const need = !!initial && !inInitial && !!available?.includes(season) && all === null && !failed;
  useEffect(() => {
    if (!need) return;
    let alive = true;
    fetch(similarFileUrl(playerId))
      .then((r) => (r.ok ? (r.json() as Promise<Record<number, SimilarEntry[]>>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => alive && setAll(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [need, playerId]);
  if (inInitial) return { items: initial![season], loading: false };
  return { items: all?.[season], loading: need };
}
