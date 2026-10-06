"use client";
// "현역만" 켜기·끄기 칩 (역대 기록 필터 안 — RecordsView·RecordBoardView 공용)
export default function ActiveOnlyToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={`focus-ring-inset flex h-10 cursor-pointer items-center whitespace-nowrap rounded-control border px-3 text-body font-semibold transition-colors duration-200 ${
        on ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2"
      }`}
    >
      현역만 보기
    </button>
  );
}
