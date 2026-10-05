"use client";
// 설치한 앱 뒤로 가기 (2026-10-05 사용자: PC 에 설치한 앱은 뒤로 가기 버튼이 없어 불편).
// 설치한 앱(standalone)은 주소창·브라우저 버튼이 없다 → 헤더 로고 왼쪽에 ‹ 버튼. 브라우저로 볼 때와 홈에서는 그리지 않는다.
// 앱 안에서 이동한 기록이 있으면 이전 화면, 앱을 막 연 화면이면 홈으로. GA4 app_back.
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconChevronLeft } from "./icons";
import { trackEvent } from "./track";

export function isStandaloneApp(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: window-controls-overlay)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function AppBackButton() {
  const [standalone, setStandalone] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setStandalone(isStandaloneApp());
  }, []);

  if (!standalone || pathname === "/") return null;

  function back() {
    trackEvent("app_back", {});
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  return (
    <button
      type="button"
      onClick={back}
      aria-label="뒤로 가기"
      title="뒤로 가기"
      className="focus-ring inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-control border border-line bg-surface text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
    >
      <IconChevronLeft size={20} />
    </button>
  );
}
