"use client";
// 팀 로고: 기본은 팀 색 사각형 + 약칭(최대 3글자), 공식 로고가 있으면 위에 얹는다 (PLAN.md §5-2 ③).
// next/image를 쓰지 않는다(외부 로고 복제 회피). 이미지 저장(html-to-image) 대상 영역 안에는 넣지 않는다(CORS).
import type { TeamColor } from "@/lib/types";
import { teamMark } from "@/lib/images";
import { useOfficialImage } from "./useOfficialImage";

const FALLBACK: TeamColor = { primary: "#6B7280", secondary: "#9CA3AF", text: "#fff" };

interface Props {
  logoUrl?: string | null;
  shortName: string;
  color?: TeamColor;
  size?: number;
  className?: string;
}

export default function TeamLogo({ logoUrl, shortName, color = FALLBACK, size = 24, className = "" }: Props) {
  const { src, loaded, imgProps } = useOfficialImage(logoUrl);
  const mark = teamMark(shortName);
  return (
    <span
      className={`relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-md font-bold leading-none ${className}`}
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
      {!loaded && <span aria-hidden={!!src}>{mark}</span>}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          {...imgProps}
          src={src}
          alt={shortName}
          loading="lazy"
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
