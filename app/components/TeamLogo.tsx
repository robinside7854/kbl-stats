"use client";
// 팀 로고: 기본은 팀 색 사각형 + 약칭(최대 3글자), 공식 로고가 있으면 위에 얹는다 (PLAN.md §5-2 ③).
// next/image를 쓰지 않는다(외부 로고 복제 회피). 이미지 저장(html-to-image) 사본에는 official={false} + ExportImages(우리 주소 중계, CORS).
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import type { TeamColor } from "@/lib/types";
import { teamMark } from "@/lib/images";
import { useOfficialImage } from "./useOfficialImage";

const FALLBACK: TeamColor = FALLBACK_TEAM_COLOR;

interface Props {
  logoUrl?: string | null;
  shortName: string;
  color?: TeamColor;
  size?: number;
  /** false 면 공식 로고를 쓰지 않고 대체 디자인(팀 색 + 약칭)만 — 이미지 저장 사본 */
  official?: boolean;
  className?: string;
}

export default function TeamLogo({ logoUrl, shortName, color = FALLBACK, size = 24, official = true, className = "" }: Props) {
  const { src, loaded, imgProps } = useOfficialImage(logoUrl, official);
  const mark = teamMark(shortName);
  return (
    <span
      // 대체 디자인(팀 색 칸)에는 옅은 안쪽 테두리 — 검정 계열 팀 색(KT)이 다크 바탕에 묻히지 않게 (디자인 점검 C5)
      className={`relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-md font-bold leading-none ${
        loaded ? "" : "ring-1 ring-inset ring-black/5 dark:ring-white/20"
      } ${className}`}
      style={{
        width: size,
        height: size,
        // 로고가 뜨면 팀 색 배경을 걷어 로고 본래 색이 보이게 한다
        background: loaded ? "transparent" : color.primary,
        color: color.text,
        fontSize: Math.max(8, Math.round((size * (mark.length > 2 ? 0.32 : 0.42)))),
      }}
      title={shortName}
    >
      {!loaded && <span className="whitespace-nowrap" aria-hidden={!!src}>{mark}</span>}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          loading="lazy"
          {...imgProps}
          src={src}
          alt={shortName}
          decoding="async"
          referrerPolicy="no-referrer"
          width={size}
          height={size}
          className="absolute inset-0 h-full w-full object-contain"
        />
      )}
    </span>
  );
}
