"use client";
// 칩 줄: 여러 값 중 하나를 고르는 둥근 버튼 묶음 (시즌·포지션·국적·팀 칩 공용).
// scroll: 칩이 많을 때(시즌 30개 등) 줄바꿈 대신 이 줄만 옆으로 민다 — 페이지 전체는 가로로 밀리지 않는다.
//   음수 여백(-mx)으로 화면 끝까지 늘이지 않는다: 부모 상자가 넘쳐 보이는 문제가 생겨서(2026-09-30 가로 스크롤 점검).

export interface Chip<T extends string | number> {
  value: T;
  label: React.ReactNode;
  /** 스크린리더용 이름 (label 이 그림일 때) */
  aria?: string;
  /** 다른 칩보다 눈에 띄게 (프라임 시즌): 안 고른 상태에서도 금색 테두리 */
  highlight?: boolean;
}

interface Props<T extends string | number> {
  label: string;
  chips: Chip<T>[];
  value: T;
  onChange: (v: T) => void;
  scroll?: boolean;
  className?: string;
}

export default function ChipRow<T extends string | number>({ label, chips, value, onChange, scroll = false, className = "" }: Props<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex gap-1.5 ${scroll ? "overflow-x-auto pb-1 [scrollbar-width:thin]" : "flex-wrap"} ${className}`}
    >
      {chips.map((c) => {
        const on = c.value === value;
        return (
          <button
            key={String(c.value)}
            type="button"
            aria-pressed={on}
            aria-label={c.aria}
            onClick={() => onChange(c.value)}
            className={`focus-ring-inset flex h-10 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-control border px-3 text-body font-semibold transition-colors duration-200 ${
              on
                ? "border-ink bg-ink text-bg"
                : c.highlight
                  ? "border-[var(--grade-s)] bg-surface text-ink ring-1 ring-[var(--grade-s)] hover:bg-surface-2"
                  : "border-line bg-surface text-ink-2 hover:bg-surface-2"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
