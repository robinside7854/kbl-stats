// 팀 연승·연패 글자 "3연승" (2026-10-11 사용자 결정 B). 연승 빨강·연패 파랑 — 리더보드 순위 변동 화살표와 같은 색 (--div-hot / --div-cold).
// 값은 lib/games notableStreak (2경기 이상만). 홈 다음 경기 줄·팀 화면 카드·팀 순위 표가 쓴다.
/** 연승 빨강·연패 파랑 (리더보드 순위 변동과 같은 색). pill = 옅은 바탕 꼬리표 (홈 다음 경기 줄, 2026-10-16) */
export default function StreakText({
  streak,
  className = "",
  pill = false,
}: {
  streak?: { label: string; kind: "W" | "L" };
  className?: string;
  pill?: boolean;
}) {
  if (!streak) return null;
  const tone = streak.kind === "W" ? "text-[var(--div-hot)]" : "text-[var(--div-cold)]";
  const box = pill
    ? `rounded-control px-1.5 py-0.5 leading-none ${streak.kind === "W" ? "bg-[color-mix(in_oklab,var(--div-hot)_12%,transparent)]" : "bg-[color-mix(in_oklab,var(--div-cold)_12%,transparent)]"}`
    : "";
  return <span className={`shrink-0 whitespace-nowrap text-caption font-bold ${tone} ${box} ${className}`}>{streak.label}</span>;
}

/** 한 경기 승·패 글자 "승"/"패" (같은 색 규칙 — 경기 띠·선수 최근 경기 공용, 2026-10-14) */
export function ResultTag({ win, className = "" }: { win: boolean; className?: string }) {
  return <span className={`font-bold ${win ? "text-[var(--div-hot)]" : "text-[var(--div-cold)]"} ${className}`}>{win ? "승" : "패"}</span>;
}
