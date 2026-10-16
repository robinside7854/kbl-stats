// 상 종류마다 아이콘 하나 (2026-10-16 사용자: 드래프트 수상 항목에 아이콘). 드래프트·외국 선수 전당의 칩과 요약이 같이 쓴다.
import type { AwardKey } from "@/lib/types";
import { IconBolt, IconCrown, IconMedal, IconShieldCheck, IconSprout, IconStar, IconTrendUp, IconTrophy, type IconSize } from "./icons";

export type AwardIconKey = AwardKey | "champion";

export default function AwardIcon({ award, size = 16, className = "" }: { award: AwardIconKey; size?: IconSize; className?: string }) {
  const p = { size, className };
  switch (award) {
    case "champion":
      return <IconTrophy {...p} />;
    case "mvp":
    case "foreignMvp":
      return <IconCrown {...p} />;
    case "finalsMvp":
      return <IconMedal {...p} />;
    case "best5":
    case "allStarMvp":
      return <IconStar {...p} />;
    case "defensive":
    case "defense5":
      return <IconShieldCheck {...p} />;
    case "rookie":
      return <IconSprout {...p} />;
    case "sixthMan":
      return <IconBolt {...p} />;
    case "mip":
      return <IconTrendUp {...p} />;
  }
}
