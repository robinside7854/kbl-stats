"use client";
// 플레이어 카드 1~2장 + 이미지 저장 (선수 상세·비교 탭 공용).
// - 두 장이면 나란히(화면 폭 768px 이상), 모바일은 위아래. 레이더 선 색은 시리즈 1(파랑)·2(주황)로 두 카드를 구분.
// - 카드 크기: 한 장이면 768px 이상에서 lg(약 500px), 두 장이면 1024px 이상에서만 lg.
// - 이미지 저장: 화면 밖에 공식 사진·로고 없는 사본(PlayerCard exportMode)을 그려 PNG로 (useCardSave — KBL 이미지는 CORS 헤더가 없다).
// - loading: 시즌 데이터를 받는 동안 이전 카드를 옅게 보여 주고 "불러오는 중" 표시.
import type { SeasonCardView } from "@/lib/cardview";
import PlayerCard, { type CardSize } from "./PlayerCard";
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
}

export default function CardDeck({ cards, fileName }: Props) {
  const colors = useThemeColors();
  const isMd = useMedia("(min-width: 768px)");
  const isLg = useMedia("(min-width: 1024px)");
  const pair = cards.length > 1;
  const size: CardSize = isMd && (!pair || isLg) ? "lg" : "sm";
  const series = [colors.series1, colors.series2];
  const { exportRef, saving, saveError, save } = useCardSave(colors.surface);
  const busy = cards.some((c) => c.loading);
  // 한 장일 때 가운데 폭 (sm 420px, lg 500px)
  const single = "mx-auto w-full max-w-[420px] md:max-w-[500px]";

  return (
    <div>
      <div className={pair ? "grid gap-4 md:grid-cols-2" : single}>
        {cards.map((c, i) => (
          <div key={`${c.view.entry.player.id}-${c.view.seasonCode}-${i}`} className="relative min-w-0">
            <div className={c.loading ? "opacity-50 transition-opacity" : "transition-opacity"} aria-busy={c.loading || undefined}>
              <PlayerCard view={c.view} colors={colors} size={size} seriesColor={series[i]} nameHref={c.nameHref} />
            </div>
            {c.loading && (
              <p
                role="status"
                className="absolute left-1/2 top-24 -translate-x-1/2 rounded-full bg-ink px-3 py-1.5 text-sub font-semibold text-bg shadow"
              >
                시즌 기록 불러오는 중…
              </p>
            )}
          </div>
        ))}
      </div>

      <div className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 ${pair ? "" : single}`}>
        <button
          type="button"
          onClick={() => save(fileName)}
          disabled={saving || busy}
          className="h-11 rounded-lg bg-ink px-4 text-body font-semibold text-surface hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "저장 중…" : pair ? "카드 두 장 이미지 저장" : "이미지 저장"}
        </button>
        <p className="text-sub text-ink-3">저장 이미지에는 사진·로고가 들어가지 않습니다 (팀 색·이니셜로 대신 그림)</p>
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
