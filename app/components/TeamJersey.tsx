// 소속 팀 이력의 유니폼 한 벌 (2026-10-01 사용자: "유니폼에 로고를 넣어서 한 줄로"). 민소매 유니폼 SVG 를 팀 주 색으로 칠하고,
// 목·팔 둘레는 보조 색, 가슴에 팀 로고(공식 이미지 실패·스위치 off 면 TeamLogo 대체 디자인).
import type { TeamColor } from "@/lib/types";
import TeamLogo from "./TeamLogo";

const BODY = "M19 3 L27 3 Q32 12 37 3 L45 3 L46 11 Q49 20 58 22 L58 69 Q32 72 6 69 L6 22 Q15 20 18 11 Z";
const NECK = "M27 3 Q32 12 37 3";
const ARM_L = "M18 11 Q15 20 6 22";
const ARM_R = "M46 11 Q49 20 58 22";

export default function TeamJersey({
  color,
  logoUrl,
  shortName,
  width = 64,
}: {
  color: TeamColor;
  logoUrl?: string | null;
  shortName: string;
  width?: number;
}) {
  const height = Math.round((width * 72) / 64);
  const logo = Math.round(width * 0.36);
  return (
    <span className="relative inline-block shrink-0" style={{ width, height }} aria-hidden="true">
      <svg viewBox="0 0 64 72" width={width} height={height} className="block">
        <path d={BODY} fill={color.primary} stroke="var(--line)" strokeWidth={1} strokeLinejoin="round" />
        <path d={NECK} fill="none" stroke={color.secondary} strokeWidth={2.5} strokeLinecap="round" />
        <path d={ARM_L} fill="none" stroke={color.secondary} strokeWidth={2.5} strokeLinecap="round" />
        <path d={ARM_R} fill="none" stroke={color.secondary} strokeWidth={2.5} strokeLinecap="round" />
      </svg>
      {/* 로고 받침: 둥근 가슴 마크(아바타와 같은 원형 예외) */}
      <span
        // deslop-ignore-next-line 19
        className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full bg-white"
        style={{ top: Math.round(height * 0.36), width: logo + 6, height: logo + 6 }}
      >
        <TeamLogo logoUrl={logoUrl} shortName={shortName} color={color} size={logo} />
      </span>
    </span>
  );
}
