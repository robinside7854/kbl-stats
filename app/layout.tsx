import type { Metadata, Viewport } from "next";
import { splashStartupImages } from "@/lib/splash";
import { SITE_NAME, SITE_URL, shareMetadata } from "@/lib/share";
import { verificationMeta } from "@/lib/seo";
import site from "../data/codes/site.json";
import Analytics from "./components/Analytics";
import AppInstallTracker from "./components/AppInstallTracker";
import { FONT_CDN_ORIGIN, PRETENDARD_CSS_URL } from "./components/webFont";
import "./globals.css";

// 공유 미리보기 기본값 (lib/share): metadataBase 가 og:image·og:url 을 절대 주소로 만든다(카카오톡은 절대 주소만 읽음).
// 페이지마다 shareMetadata 로 제목·설명·이미지를 덮어쓴다.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...shareMetadata({
    title: "KBL - Stats Reference",
    description: "KBL 정규시즌 선수 기록을 플레이어 카드·리더보드·역대 기록으로 보는 비영리 팬 프로젝트.",
    path: "/",
  }),
  applicationName: SITE_NAME,
  // 구글 서치 콘솔·네이버 서치어드바이저 소유 확인 (2026-10-27, 값은 site.json searchVerification — 비면 없음)
  verification: verificationMeta(site.searchVerification),
  // 아이폰 "홈 화면에 추가" 를 앱처럼(주소창 없이) 열기 (2026-10-05 앱 설치 — 안드로이드는 app/manifest.ts)
  // 시작 화면 그림은 화면 크기마다 하나 (lib/splash, 그림은 scripts/build-splash.tsx — 2026-10-06 시안 A)
  appleWebApp: { capable: true, title: "KBL 스탯", statusBarStyle: "default", startupImage: splashStartupImages() },
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
        <AppInstallTracker />
        <Analytics />
      </body>
    </html>
  );
}
