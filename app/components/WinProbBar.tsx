// 경기 전 승리 확률 막대 (2026-10-16, lib/predict homeWinProb — 우리 추정): 아직 안 한 경기 카드의 스코어보드 아래.
// 왼쪽 = 홈 팀(카드와 같은 순서), 두 팀 색 막대 + 양 끝 숫자. 색이 비슷한 두 팀도 가운데 틈으로 갈린다. ⓘ = 계산 방법(help_open topic=winProb).
import type { TeamColor } from "@/lib/types";
import InfoLink from "./InfoLink";

export default function WinProbBar({
  homeProb,
  home,
  away,
  className = "",
}: {
  homeProb: number;
  home: { shortName: string; color: TeamColor };
  away: { shortName: string; color: TeamColor };
  className?: string;
}) {
  const h = Math.round(homeProb * 100);
  const a = 100 - h;
  return (
    <div className={`tabular ${className}`}>
      <p className="flex items-center justify-between text-caption text-ink-3">
        <span className={h >= a ? "font-bold text-ink" : ""}>{h}%</span>
        <span className="inline-flex items-center">
          승리 확률 · 우리 추정
          <InfoLink term="winProb" compact className="-my-3" />
        </span>
        <span className={a > h ? "font-bold text-ink" : ""}>{a}%</span>
      </p>
      <div
        role="img"
        aria-label={`승리 확률 ${home.shortName} ${h}%, ${away.shortName} ${a}% (우리 추정)`}
        className="mt-1 flex h-2 gap-0.5 overflow-hidden rounded-sm"
      >
        <span className="h-full" style={{ width: `${h}%`, background: home.color.primary }} />
        <span className="h-full flex-1" style={{ background: away.color.primary }} />
      </div>
    </div>
  );
}
