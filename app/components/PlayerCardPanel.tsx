"use client";
// 선수 페이지의 "최근 시즌 플레이어 카드": 기존 PlayerCard 를 그대로 쓰고, 값은 서버에서 계산해 받은 것(lib/data loadPlayerCard).
// 비교 집단은 플레이어 카드 화면의 기본 기준과 같다 → /season/[코드]?p=선수 의 카드와 같은 순위·등급.
// 이미지 저장은 CardExplorer 와 같은 방식(useCardSave: 화면 밖 공식 이미지 없는 사본 → PNG).
import Link from "next/link";
import type { PlayerCardData } from "@/lib/data";
import { seasonShortLabel } from "@/lib/career";
import PlayerCard, { type CardSize } from "./PlayerCard";
import { useCardSave } from "./useCardSave";
import { useMedia } from "./useMedia";
import { useThemeColors } from "./useThemeColors";

export default function PlayerCardPanel({ data }: { data: PlayerCardData }) {
  const colors = useThemeColors();
  const isMd = useMedia("(min-width: 768px)");
  const size: CardSize = isMd ? "lg" : "sm";
  const { exportRef, saving, saveError, save } = useCardSave(colors.surface);
  const p = data.entry.player;
  const cardProps = {
    entry: data.entry,
    team: data.team ?? undefined,
    seasonLabel: data.seasonLabel,
    axisSet: data.axisSet,
    ruleLabel: data.ruleLabel,
    qualifiedCount: data.qualifiedCount,
    attemptsLabel: data.attemptsLabel,
    colors,
    seriesColor: colors.series1,
    linkName: false,
  };

  return (
    <section aria-labelledby="latest-card-title" className="mx-auto w-full max-w-[420px] md:max-w-[500px]">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 id="latest-card-title" className="text-base font-bold">
          {seasonShortLabel(data.seasonLabel)} 플레이어 카드
        </h2>
        <Link
          href={`/season/${data.seasonCode}?p=${p.id}`}
          className="shrink-0 text-xs font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
        >
          비교하러 가기
        </Link>
      </div>
      <PlayerCard {...cardProps} size={size} />
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => save(`${p.nameKo}_${data.seasonLabel}_플레이어카드.png`)}
          disabled={saving}
          className="h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "저장 중…" : "이미지 저장"}
        </button>
        <p className="text-xs text-ink-3">저장 이미지에는 사진·로고가 들어가지 않습니다 (팀 색·이니셜로 대신 그림)</p>
        {saveError && (
          <p role="alert" className="w-full text-sm text-ink-2">
            {saveError}
          </p>
        )}
      </div>

      {/* 저장할 때만 화면 밖에 그리는 사본 (공식 이미지 없음) */}
      {saving && (
        <div aria-hidden className="pointer-events-none fixed top-0" style={{ left: -10000 }}>
          <div ref={exportRef} className="bg-surface p-3">
            <PlayerCard {...cardProps} exportMode size="lg" />
          </div>
        </div>
      )}
    </section>
  );
}
