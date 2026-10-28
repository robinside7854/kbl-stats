"use client";
// 선수 아바타: 기본은 팀 색 + 이름 첫 글자, 공식 사진이 있으면 위에 얹는다 (PLAN.md §5-2 ③).
// next/image를 쓰지 않는다 — 외부 사진을 Vercel이 다시 받아 최적화(=복제)하지 않도록 브라우저가 직접 받게 둔다.
// ⚠️ 이미지 저장(html-to-image) 사본에는 official={false} 로 넣고 ExportImages 로 감싼다 — KBL 서버에 CORS 헤더가 없어
//    원래 주소로는 저장이 실패하므로 우리 주소 중계(/img-proxy)로 받는다(2026-10-28). 감싸지 않으면 대체 디자인만.
//
// variant
// - "circle"  : 목록·선택 상자용 원형 (size = 지름)
// - "portrait": 플레이어 카드 상단의 큰 세로 사진 (size = 높이, 폭은 공식 사진 비율 470:609).
//               배경 없이 카드 그라데이션 위에 얹고, 사진이 없으면 실루엣 + 큰 이니셜로 대체.
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import type { TeamColor } from "@/lib/types";
import { nameInitial } from "@/lib/images";
import { useOfficialImage } from "./useOfficialImage";

const FALLBACK: TeamColor = FALLBACK_TEAM_COLOR;
/** KBL 현역 프로필 사진 비율 (470×609, PLAN.md §5-1) */
const PORTRAIT_RATIO = 470 / 609;

interface Props {
  photoUrl?: string | null;
  nameKo: string;
  color?: TeamColor;
  size?: number;
  variant?: "circle" | "portrait";
  /** false 면 화면용 핫링크를 쓰지 않는다 — 이미지 저장 사본(ExportImages 안)은 중계 주소, 그 밖엔 대체 디자인만 */
  official?: boolean;
  className?: string;
}

export default function PlayerAvatar({
  photoUrl,
  nameKo,
  color = FALLBACK,
  size = 32,
  variant = "circle",
  official = true,
  className = "",
}: Props) {
  const { src, loaded, imgProps } = useOfficialImage(photoUrl, official);

  if (variant === "portrait") {
    const width = Math.round(size * PORTRAIT_RATIO);
    return (
      <span
        className={`relative inline-block shrink-0 select-none ${className}`}
        style={{ width, height: size, color: color.text }}
        title={nameKo}
      >
        {/* 대체 디자인: 사진이 뜨기 전·실패·저장 사본에서 보인다 */}
        {!loaded && (
          <span aria-hidden className="absolute inset-0">
            <svg viewBox="0 0 94 122" className="absolute inset-x-0 bottom-0 h-full w-full" preserveAspectRatio="xMidYMax meet">
              {/* deslop-ignore-next-line 24 */}
              <circle cx="47" cy="40" r="21" fill="currentColor" fillOpacity="0.2" />
              <path d="M6 122c0-27 18-44 41-44s41 17 41 44Z" fill="currentColor" fillOpacity="0.2" />
            </svg>
            <span
              className="absolute inset-x-0 text-center font-black leading-none"
              style={{ top: size * 0.2, fontSize: Math.round(size * 0.2), opacity: 0.85 }}
            >
              {nameInitial(nameKo)}
            </span>
          </span>
        )}
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            {...imgProps}
            src={src}
            alt={nameKo}
            decoding="async"
            referrerPolicy="no-referrer"
            width={width}
            height={size}
            className="absolute inset-0 h-full w-full object-contain object-bottom"
          />
        )}
      </span>
    );
  }

  return (
    <span
      // 옅은 안쪽 테두리 — 검정 계열 팀 색 원이 다크 바탕에 묻히지 않게 (디자인 점검 C5)
      // deslop-ignore-next-line 19
      className={`relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-bold ring-1 ring-inset ring-black/5 dark:ring-white/20 ${className}`}
      style={{ width: size, height: size, background: color.primary, color: color.text, fontSize: Math.round(size * 0.45) }}
      title={nameKo}
    >
      <span aria-hidden={!!src}>{nameInitial(nameKo)}</span>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          loading="lazy"
          {...imgProps}
          src={src}
          alt={nameKo}
          decoding="async"
          referrerPolicy="no-referrer"
          width={size}
          height={size}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      )}
    </span>
  );
}
