"use client";
// 두세 개 중 하나를 고르는 버튼 묶음 (순위표·선수 페이지 공용)

/** 두세 개 중 하나를 고르는 버튼 묶음 */
export default function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-control border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`focus-ring-inset h-10 cursor-pointer rounded-md px-3 text-body font-semibold transition-colors duration-200 ${
            o.value === value ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

