"use client";
// 플레이어 카드 1~2장 + 이미지 저장 (선수 상세·비교 탭 공용).
// - 두 장이면 나란히(화면 폭 768px 이상), 모바일은 위아래. 레이더 선 색은 시리즈 1(파랑)·2(주황)로 두 카드를 구분.
// - 카드 크기: 한 장이면 768px 이상에서 lg(약 500px), 두 장이면 1024px 이상에서만 lg.
// - wideLayout(선수 상세): 한 장 + 1024px 이상이면 가로 카드(PlayerCard layout="horizontal", 피드백 5차 #1). 저장 사본은 늘 세로.
// - 이미지 저장: 화면 밖에 공식 사진·로고 없는 사본(PlayerCard exportMode)을 그려 PNG로 (useCardSave — KBL 이미지는 CORS 헤더가 없다).
// - loading: 시즌 데이터를 받는 동안 같은 크기의 스켈레톤 카드(PlayerCardSkeleton)를 보여 준다 (디자인 점검 C3).
// - pending: 아직 카드 값이 하나도 없는 자리 수 (비교 탭이 공유 주소로 열릴 때) — 스켈레톤만 그린다.
import { useEffect, useRef, useState } from "react";
import type { SeasonCardView } from "@/lib/cardview";
import PlayerCard, { PlayerCardSkeleton, type CardLayout, type CardSize } from "./PlayerCard";
import { useCardSave } from "./useCardSave";
import { useMedia } from "./useMedia";
import { useThemeColors } from "./useThemeColors";

export interface DeckCard {
  view: SeasonCardView;
  /** 이름 링크 (없으면 링크 없음) */
  nameHref?: string;
  /** 시즌 데이터를 받는 중 */
  loading?: boolean;
}

interface Props {
  cards: DeckCard[];
  /** 저장 파일 이름 (확장자 포함) */
  fileName: string;
  /** 값이 아직 없는 카드 자리 수 (스켈레톤) */
  pending?: number;
  /** 한 장일 때 PC(1024px 이상)에서 가로 카드로 (선수 상세) */
  wideLayout?: boolean;
}

export default function CardDeck({ cards, fileName, pending = 0, wideLayout = false }: Props) {
  const colors = useThemeColors();
  const isMd = useMedia("(min-width: 768px)");
  const isLg = useMedia("(min-width: 1024px)");
  const pair = cards.length + pending > 1;
  const size: CardSize = isMd && (!pair || isLg) ? "lg" : "sm";
  const layout: CardLayout = wideLayout && !pair && isLg ? "horizontal" : "vertical";
  const series = [colors.series1, colors.series2];
  const { exportRef, saving, saveError, save } = useCardSave(colors.surface);
  // 저장이 끝난 뒤에만 한 번 알려 준다 (2026-10-16 디자인 정리 M4: 버튼 옆 상시 설명 → 저장 후 알림)
  const [saved, setSaved] = useState(false);
  const wasSaving = useRef(false);
  useEffect(() => {
    if (wasSaving.current && !saving && !saveError) setSaved(true);
    if (saving) setSaved(false);
    wasSaving.current = saving;
  }, [saving, saveError]);
  const busy = pending > 0 || cards.some((c) => c.loading);
  // 한 장일 때 가운데 폭 (sm 420px, lg 500px)
  const single = layout === "horizontal" ? "w-full" : "mx-auto w-full max-w-[420px] md:max-w-[500px]";

  return (
    <div>
      <div className={pair ? "grid gap-4 md:grid-cols-2" : single}>
        {cards.map((c, i) => (
          <div key={`${c.view.entry.player.id}-${c.view.seasonCode}-${i}`} className="min-w-0" aria-busy={c.loading || undefined}>
            {c.loading ? (
              <>
                <p role="status" className="sr-only">
                  시즌 기록 불러오는 중
                </p>
                <PlayerCardSkeleton size={size} layout={layout} />
              </>
            ) : (
              <PlayerCard view={c.view} colors={colors} size={size} seriesColor={series[i]} nameHref={c.nameHref} layout={layout} />
            )}
          </div>
        ))}
        {Array.from({ length: pending }, (_, i) => (
          <div key={`pending-${i}`} className="min-w-0" aria-busy>
            <p role="status" className="sr-only">
              선수 카드 불러오는 중
            </p>
            <PlayerCardSkeleton size={size} />
          </div>
        ))}
      </div>

      <div className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 ${pair ? "" : single}`}>
        <button
          type="button"
          onClick={() => save(fileName)}
          disabled={saving || busy}
          className="focus-ring h-11 rounded-control bg-ink px-4 text-body font-semibold text-bg transition-colors duration-200 hover:bg-ink/85 disabled:cursor-default disabled:opacity-60"
        >
          {saving ? "저장 중…" : pair ? "카드 두 장 이미지 저장" : "이미지 저장"}
        </button>
        {saved && (
          <p role="status" className="text-sub text-ink-2">
            저장했어요. 이미지에는 사진·로고 대신 팀 색과 이니셜이 들어가요.
          </p>
        )}
        {saveError && (
          <p role="alert" className="w-full text-body text-ink-2">
            {saveError}
          </p>
        )}
      </div>

      {/* 저장할 때만 화면 밖에 그리는 사본 (공식 이미지 없음) */}
      {saving && (
        <div aria-hidden className="pointer-events-none fixed top-0" style={{ left: -10000 }}>
          <div ref={exportRef} className="flex items-start gap-3 bg-surface p-3">
            {cards.map((c, i) => (
              <PlayerCard key={i} view={c.view} colors={colors} seriesColor={series[i]} exportMode size="lg" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
