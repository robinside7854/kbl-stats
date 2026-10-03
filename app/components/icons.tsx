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

/** 생일 케이크 (홈 "오늘 생일") */
export function IconCake(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.5c.9 1 .9 2 0 2.7-.9-.7-.9-1.7 0-2.7Z" />
      <path d="M12 6.2V9" />
      <rect x="4" y="9" width="16" height="5" rx="1.5" />
      <path d="M4 14v5.5h16V14" />
      <path d="M4 16.5c1.3 0 1.3-1 2.7-1s1.3 1 2.6 1 1.4-1 2.7-1 1.3 1 2.7 1 1.3-1 2.6-1 1.4 1 2.7 1" />
    </Svg>
  );
}

/**
 * 생일 고깔모자 (아바타 위에 비스듬히 얹는 장식, 홈 "오늘 생일"). 아이콘 크기 규칙 밖의 장식이라 width 만 받는다.
 * 색: 몸통 = 팀 색(color), 줄무늬·방울 = 흰색 — 팀 색이 어두워도 밝아도 보이게 가는 외곽선(ink)을 두른다.
 */
export function PartyHat({ width, color, ink }: { width: number; color: string; ink: string }) {
  return (
    <svg aria-hidden width={width} height={width * 1.25} viewBox="0 0 32 40">
      <path d="M16 6 29 37H3Z" fill={color} stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11.5 17 21 14.5M8.6 24.5 23.6 20.6M5.8 31.6 26.3 26.4" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
      {/* deslop-ignore-next-line 24 — 사용자가 요청한 생일 고깔모자 장식 */}
      <circle cx="16" cy="5" r="3.6" fill="#ffffff" stroke={ink} strokeWidth="1.5" />
    </svg>
  );
}

/** 주사위 (헤더 "랜덤 카드") */
export function IconDice(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      {/* deslop-ignore-next-line 24 */}
      <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
      {/* deslop-ignore-next-line 24 */}
      <circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none" />
      {/* deslop-ignore-next-line 24 */}
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

// ── 하단 탭 바 아이콘 (모바일, 24) ──

/** 집 (홈) */
export function IconHome(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1Z" />
    </Svg>
  );
}

/** 사람 (선수) */
export function IconPlayer(p: IconProps) {
  return (
    <Svg {...p}>
      {/* deslop-ignore-next-line 24 */}
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </Svg>
  );
}

/** 막대 (리더보드) */
export function IconLeaders(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 20V13h4.5v7M9.75 20V6h4.5v14M15.5 20v-9H20v9M3 20h18" />
    </Svg>
  );
}

/** 좌우 화살표 (비교) */
export function IconCompare(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 4 4 8l4 4M4 8h12M16 12l4 4-4 4M20 16H8" />
    </Svg>
  );
}

/** 트로피 (역대 기록) */
export function IconTrophy(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4v3h-4Z" />
    </Svg>
  );
}

/** 별 (즐겨찾기). filled 면 속을 채운다 */
export function IconStar({ filled = false, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Svg {...p} fill={filled ? "currentColor" : "none"}>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9Z" />
    </Svg>
  );
}

/** 농구공 (54-0 게임) */
export function IconBall(p: IconProps) {
  return (
    <Svg {...p}>
      {/* deslop-ignore-next-line 24 */}
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5v17M6 6c2.5 2.2 2.5 9.8 0 12M18 6c-2.5 2.2-2.5 9.8 0 12" />
    </Svg>
  );
}

/** 방패 (팀) */
export function IconTeam(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.5 19 6v5.5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6Z" />
      <path d="M9 11.5h6M12 8.5v6" />
    </Svg>
  );
}
