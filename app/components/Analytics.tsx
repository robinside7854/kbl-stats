"use client";
// 방문 통계 (GA4, 2026-10-02 사용자 요청: 어떤 화면·기능에 사람이 많이 오는지 보기)
// - 측정 ID 는 Vercel 환경변수 NEXT_PUBLIC_GA_ID (예: G-ABC123XYZ). 없으면 아무것도 불러오지 않는다(개발·미리보기 기본값)
// - 페이지 이동은 GA4 "향상된 측정 → 브라우저 기록 이벤트 기반 페이지 변경"이 자동으로 센다(App Router 의 화면 전환 포함)
// - 버튼 단위 행동은 trackEvent 로 따로 보낸다. 이름·값은 개인을 알아볼 수 없는 것만(선수 번호·시즌·화면 이름)
import Script from "next/script";
import { gaMeasurementId } from "@/lib/analytics";

const GA_ID = gaMeasurementId();

type Gtag = (command: "event", name: string, params?: Record<string, string | number | boolean>) => void;

/** GA4 맞춤 이벤트. GA 가 꺼져 있거나 차단돼 있으면 조용히 넘어간다 */
export function trackEvent(name: string, params?: Record<string, string | number | boolean>) {
  if (!GA_ID || typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  try {
    gtag?.("event", name, params);
  } catch {
    // 통계 실패가 화면을 막으면 안 된다
  }
}

export default function Analytics() {
  if (!GA_ID) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
    </>
  );
}
