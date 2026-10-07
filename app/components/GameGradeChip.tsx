// 54-0 종합 등급 글자 칩 (뽑은 뒤 결과 화면·주간 순위에서만 — 고를 때는 등급을 숨긴다)
import { overallGrade } from "@/lib/metrics";
import { gradeTone } from "@/lib/teams";
import type { TeamColor } from "@/lib/types";
import type { ThemeColors } from "./useThemeColors";

export default function GradeChip({ score, color, colors }: { score: number; color: TeamColor; colors: ThemeColors }) {
  const grade = overallGrade(score);
  const tone = gradeTone(grade, color, colors);
  return (
    <span
      className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-control border px-1 text-caption font-black"
      style={{ background: tone.bg, color: tone.ink, borderColor: tone.border }}
      aria-label={`종합 등급 ${grade}`}
    >
      {grade}
    </span>
  );
}
