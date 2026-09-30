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
      {/* deslop-ignore-next-line 24 */}
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
      {/* deslop-ignore-next-line 24 */}
      <circle cx="16" cy="7" r="2" />
      {/* deslop-ignore-next-line 24 */}
      <circle cx="10" cy="17" r="2" />
    </Svg>
  );
}

/** 위 꺾쇠 (접기 · 오름차순 정렬) */
export function IconChevronUp(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m6 15 6-6 6 6" />
    </Svg>
  );
}

/** 오른쪽 화살표 (옆으로 더 있음) */
export function IconArrowRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

/** 위 화살표 (비교표에서 더 나은 쪽) */
export function IconArrowUp(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Svg>
  );
}

/** 바깥 링크 (새 창) */
export function IconExternal(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 16 16 8M9 8h7v7" />
    </Svg>
  );
}

/** 정보 (용어 설명 링크) */
export function IconInfo(p: IconProps) {
  return (
    <Svg {...p}>
      {/* deslop-ignore-next-line 24 */}
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </Svg>
  );
}
