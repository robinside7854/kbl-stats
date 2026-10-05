// 아이폰·아이패드 "홈 화면에 추가" 시작 화면(스플래시) 그림 목록 (2026-10-06 사용자: 시안 A 리그 남색).
// 아이폰은 화면 크기마다 맞는 그림을 따로 줘야 한다(media 가 맞는 것 하나를 고름) — 세로만(app/manifest.ts orientation portrait).
// 그림은 scripts/build-splash.tsx 가 public/splash/{w}x{h}.png 로 만들어 커밋한다(prebuild 아님), layout 의 appleWebApp.startupImage 가 이 목록을 쓴다.
// 안드로이드는 휴대폰이 manifest background_color(#011B6A) + 아이콘으로 직접 그린다.

/** CSS 폭·높이(pt)와 화면 배율. 그림 크기 = 폭×배율 · 높이×배율 */
export const SPLASH_DEVICES: readonly { w: number; h: number; dpr: number }[] = [
  { w: 440, h: 956, dpr: 3 }, // 16 Pro Max
  { w: 402, h: 874, dpr: 3 }, // 16 Pro
  { w: 430, h: 932, dpr: 3 }, // 14 Pro Max · 15 Plus · 15 Pro Max · 16 Plus
  { w: 393, h: 852, dpr: 3 }, // 14 Pro · 15 · 15 Pro · 16
  { w: 428, h: 926, dpr: 3 }, // 12·13 Pro Max · 14 Plus
  { w: 390, h: 844, dpr: 3 }, // 12 · 13 · 14
  { w: 375, h: 812, dpr: 3 }, // X · XS · 11 Pro · 12·13 mini
  { w: 414, h: 896, dpr: 3 }, // XS Max · 11 Pro Max
  { w: 414, h: 896, dpr: 2 }, // XR · 11
  { w: 414, h: 736, dpr: 3 }, // 6·7·8 Plus
  { w: 375, h: 667, dpr: 2 }, // 6·7·8 · SE 2·3세대
  { w: 320, h: 568, dpr: 2 }, // SE 1세대
  { w: 768, h: 1024, dpr: 2 }, // iPad 9.7
  { w: 834, h: 1194, dpr: 2 }, // iPad Pro 11
  { w: 1024, h: 1366, dpr: 2 }, // iPad Pro 12.9
];

export const splashFile = (d: { w: number; h: number; dpr: number }) => `/splash/${d.w * d.dpr}x${d.h * d.dpr}.png`;

/** layout metadata appleWebApp.startupImage 값 */
export function splashStartupImages(): { url: string; media: string }[] {
  return SPLASH_DEVICES.map((d) => ({
    url: splashFile(d),
    media: `(device-width: ${d.w}px) and (device-height: ${d.h}px) and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: portrait)`,
  }));
}
