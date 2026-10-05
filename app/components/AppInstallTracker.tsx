"use client";
// 앱 설치 방문 통계 (2026-10-05 앱 설치): 설치 완료 app_install, 설치한 앱으로 연 방문은 사용자 속성 display_mode=standalone.
// 화면에는 아무것도 그리지 않는다 (설치 버튼은 브라우저 메뉴의 "앱 설치"·"홈 화면에 추가"를 쓴다).
import { useEffect } from "react";
import { setUserProperties, trackEvent } from "./track";

export default function AppInstallTracker() {
  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setUserProperties({ display_mode: standalone ? "standalone" : "browser" });
    const onInstalled = () => trackEvent("app_install", {});
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);
  return null;
}
