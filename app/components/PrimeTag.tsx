// 프라임 시즌 표시 (시즌 칩 안 작은 금색 꼬리표) — lib/prime 이 고른 시즌. 금색은 S 등급과 같은 토큰(--grade-s)
export default function PrimeTag() {
  return (
    <span className="rounded-md bg-[var(--grade-s)] px-1 py-px text-caption font-bold leading-tight text-[var(--grade-s-ink)]">프라임</span>
  );
}

/** 시즌 칩 하나 (라벨 + 프라임이면 꼬리표·금색 테두리) */
export function seasonChip(code: number, label: string, prime: number | null | undefined) {
  const isPrime = prime === code;
  return {
    value: code,
    label: isPrime ? (
      <>
        {label}
        <PrimeTag />
      </>
    ) : (
      label
    ),
    aria: isPrime ? `${label} 시즌, 프라임 시즌` : `${label} 시즌`,
    highlight: isPrime,
  };
}
