// 인라인 SVG 아이콘 한곳 모음 (디자인 점검 2026-09-30: 아이콘 라이브러리를 새로 들이지 않고 최소 세트만 둔다).
// 규칙: 크기는 16 / 20 / 24 세 단계만, 선 굵기 1.8, currentColor. 장식이면 aria-hidden(기본), 뜻이 있으면 버튼 쪽에 aria-label.
import type { SVGProps } from "react";

export type IconSize = 16 | 20 | 24;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  size?: IconSize;
}

function Svg({ size = 16, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** 돋보기 (검색) */
export function IconSearch(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.8-4.8" />
    </Svg>
  );
}

/** 닫기·해제 (✕) */
export function IconClose(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

/** 아래 꺾쇠 (펼치기) */
export function IconChevronDown(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

/** 오른쪽 꺾쇠 (이동 링크) */
export function IconChevronRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

/** 필터 (가로 막대 세 줄 + 조절 점) */
export function IconFilter(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </Svg>
  );
}
