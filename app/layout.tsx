import type { Metadata, Viewport } from "next";
import Analytics from "./components/Analytics";
import { FONT_CDN_ORIGIN, PRETENDARD_CSS_URL } from "./components/webFont";
import "./globals.css";

export const metadata: Metadata = {
  title: "KBL - Stats Reference",
  description: "KBL 정규시즌 선수 기록을 플레이어 카드·리더보드·비교로 보는 비영리 팬 프로젝트.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 아이폰 홈 막대 영역까지 쓰고(하단 탭 바), 바 안쪽은 env(safe-area-inset-bottom) 만큼 띄운다
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#111110" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 글꼴: Pretendard Variable 동적 서브셋 (font-display: swap 은 CSS 안에). crossOrigin — 카드 저장 때 CSS 를 다시 읽는다 */}
        <link rel="preconnect" href={FONT_CDN_ORIGIN} crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href={PRETENDARD_CSS_URL} crossOrigin="anonymous" />
      </head>
      <body className="min-h-dvh">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
