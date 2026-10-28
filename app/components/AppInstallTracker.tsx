"use client";
// 앱 설치 방문 통계 (2026-10-05 앱 설치): 설치 완료 app_install, 설치한 앱으로 연 방문은 사용자 속성 display_mode=standalone.
// 화면에는 아무것도 그리지 않는다. 설치 창 준비물(beforeinstallprompt)은 받아 두고 재방문 권유가 쓴다(2026-10-27).
import { useEffect } from "react";
import { captureInstallPrompt, clearInstallPrompt } from "./install-prompt";
import { setUserProperties, trackEvent } from "./track";

export default function AppInstallTracker() {
  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setUserProperties({ display_mode: standalone ? "standalone" : "browser" });
    const onInstalled = () => {
      clearInstallPrompt();
      trackEvent("app_install", {});
    };
    // 설치 창 준비물은 받아 두기만 한다 — 재방문 권유(ReturnNudge)의 "앱 설치" 버튼이 쓴다
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}
