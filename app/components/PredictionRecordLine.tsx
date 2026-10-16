// 우리 예측 적중률 한 줄 (2026-10-16): "올 시즌 우리 예측 21경기 중 14경기 맞힘 (67%) · 지난 시즌 61%" + ⓘ(winProb).
// 숫자는 빌드 때 lib/data-predict-extra 가 끝난 경기마다 "그날 전 정보만"으로 다시 예측해 센 것(lib/predict backtestSeason).
// 플레이오프 확률 표 아래·일정 화면 머리말에 쓴다. 새 GA4 이벤트 없음(ⓘ 는 help_open topic=winProb).
import type { SeasonPredictionRecord } from "@/lib/data-predict-extra";
import { recordText } from "@/lib/predict";
import InfoLink from "./InfoLink";

const pct = (r: { games: number; hits: number }) => `${Math.round((r.hits / r.games) * 100)}%`;

export default function PredictionRecordLine({
  record,
  previous = null,
  className = "",
}: {
  record: SeasonPredictionRecord | null;
  previous?: SeasonPredictionRecord | null;
  className?: string;
}) {
  if (!record) return null;
  const head = record.ongoing ? "올 시즌 우리 예측" : `${record.seasonShort} 경기 전 예측을 되짚어 보면`;
  return (
    <p className={`tabular flex flex-wrap items-center gap-x-1 text-sub text-ink-2 ${className}`}>
      <span>
        {head} <span className="font-semibold text-ink">{recordText(record)}</span>
        {previous && previous.games > 0 && <span className="text-ink-3"> · {previous.seasonShort} 시즌 {pct(previous)}</span>}
      </span>
      <InfoLink term="winProb" className="-my-3" />
    </p>
  );
}
