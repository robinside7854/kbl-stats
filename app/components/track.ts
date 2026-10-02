// GA4 맞춤 이벤트 (브라우저에서 부름). 통계 스크립트가 없거나(미리보기·개발) 차단돼 있으면 조용히 넘어간다.
// 이름·값은 개인을 알아볼 수 없는 것만(선수 번호·시즌·화면 이름). 목록은 CLAUDE.md "방문 통계"
type Gtag = (command: "event", name: string, params?: Record<string, string | number | boolean>) => void;

export function trackEvent(name: string, params?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  try {
    gtag?.("event", name, params);
  } catch {
    // 통계 실패가 화면을 막으면 안 된다
  }
}
