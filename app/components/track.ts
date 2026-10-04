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

/** 필터·보기 바꾸기 — 바뀐 항목마다 filter_change 하나 (screen: 화면 이름, filter: 항목 이름, value: 새 값) */
export function trackFilters(screen: string, patch: Record<string, unknown>) {
  for (const [filter, v] of Object.entries(patch)) {
    trackEvent("filter_change", { screen, filter, value: v === null || v === undefined ? "none" : String(v) });
  }
}

/**
 * 사용자 속성 (2026-10-04): 그 뒤 이벤트·페이지 조회에 붙어 보고서를 "로그인 회원 / 아닌 사람", "응원팀별"로 나눠 볼 수 있다.
 * 값은 개인을 알아볼 수 없는 것만 (yes/no, 팀 코드). GA → 맞춤 정의에 "사용자" 범위로 등록해야 보인다.
 */
export function setUserProperties(props: Record<string, string>) {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: (command: "set", target: "user_properties", value: Record<string, string>) => void }).gtag;
  try {
    gtag?.("set", "user_properties", props);
  } catch {
    // 통계 실패가 화면을 막으면 안 된다
  }
}
