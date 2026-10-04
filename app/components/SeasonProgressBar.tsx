// 정규시즌 진행률 막대 (2026-10-04 사용자 요청 — 홈 제목 아래·일정 화면). 계산은 lib/games seasonProgress, 여기선 그리기만.
import type { SeasonProgress } from "@/lib/games";

export default function SeasonProgressBar({ progress, className = "" }: { progress: SeasonProgress; className?: string }) {
  const done = progress.ended >= progress.total;
  return (
    <div className={`tabular ${className}`}>
      <div className="flex items-baseline justify-between gap-2 text-sub">
        <span className="font-semibold text-ink-2">{done ? "정규시즌 종료" : "정규시즌 진행"}</span>
        <span className="text-ink-3">
          {progress.ended.toLocaleString()} / {progress.total.toLocaleString()}경기 ·{" "}
          <span className="font-bold text-ink">{progress.pct}%</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="정규시즌 진행률"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.pct}
        className="mt-1.5 h-2 w-full overflow-hidden rounded-sm bg-surface-2"
      >
        <div className="h-full rounded-sm bg-[var(--series-1)]" style={{ width: `${Math.max(progress.pct, progress.ended > 0 ? 1 : 0)}%` }} />
      </div>
    </div>
  );
}
