// 방문 통계 (GA4, 2026-10-02 사용자 요청: 어떤 화면·기능에 사람이 많이 오는지 보기)
// - 서버 컴포넌트: 측정 ID 는 빌드 때 lib/analytics gaMeasurementId 로 정해진다(운영 배포만 켜짐)
// - 페이지 이동은 GA4 "향상된 측정 → 브라우저 기록 이벤트 기반 페이지 변경"이 자동으로 센다(App Router 의 화면 전환 포함)
// - 버튼 단위 행동은 ./track 의 trackEvent 로 따로 보낸다
import Script from "next/script";
import { gaMeasurementId } from "@/lib/analytics";

export default function Analytics() {
  const id = gaMeasurementId();
  if (!id) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
