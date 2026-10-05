// 앱 아이콘 그림 (64×64, 바탕 없음) — 아이콘(build-app-icons.ts)과 아이폰 시작 화면(build-splash.tsx)이 같이 쓴다.
// 색은 KBL 리그 로고의 남색·주황. 글자는 기기 글꼴에 기대지 않게 선(path)으로 그린다.
export const NAVY = "#011B6A";
export const ORANGE = "#EB6100";

/** 64×64 그림 (바탕 없이) */
export const APP_ART = [
  // KBL — 글자 높이 14, 획 3.6
  `<g fill="none" stroke="#ffffff" stroke-width="3.6" stroke-linejoin="miter" transform="translate(14.5 8)">`,
  `<path d="M1.8 0V14M10.6 0L3 7L10.6 14"/>`,
  `<path d="M14.6 0V14M14.6 1.8H19.6A2.6 2.6 0 0 1 19.6 7H14.6M19.6 7H20.2A2.7 2.7 0 0 1 20.2 12.2H14.6"/>`,
  `<path d="M27.2 0V12.2H35"/>`,
  `</g>`,
  // 농구공
  `<circle cx="22" cy="42" r="12.5" fill="${ORANGE}"/>`,
  `<g fill="none" stroke="${NAVY}" stroke-width="1.6"><path d="M22 29.5V54.5M9.5 42H34.5"/><path d="M13.2 33.2A15 15 0 0 1 13.2 50.8M30.8 33.2A15 15 0 0 0 30.8 50.8"/></g>`,
  // 막대 세 개 (스탯)
  `<rect x="39" y="45" width="5" height="9.5" rx="1" fill="#ffffff" fill-opacity="0.55"/>`,
  `<rect x="46" y="39" width="5" height="15.5" rx="1" fill="#ffffff" fill-opacity="0.8"/>`,
  `<rect x="53" y="32" width="5" height="22.5" rx="1" fill="${ORANGE}"/>`,
].join("");
