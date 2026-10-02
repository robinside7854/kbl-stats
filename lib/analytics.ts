// 방문 통계(GA4) 측정 ID (2026-10-02 사용자 제공). 빌드할 때 서버에서만 읽는다.
// - Vercel 운영 배포(VERCEL_ENV=production)일 때만 기본 ID 로 켠다 → 미리보기 배포·로컬 개발은 통계에 안 섞인다
// - 환경변수 NEXT_PUBLIC_GA_ID 가 있으면 그 값이 우선(다른 GA 속성으로 바꿀 때). "off" 면 끈다
export const DEFAULT_GA_ID = "G-03YNZDVE0F";

export function gaMeasurementId(): string {
  const override = (process.env.NEXT_PUBLIC_GA_ID ?? "").trim();
  if (override.toLowerCase() === "off") return "";
  const id = override || (process.env.VERCEL_ENV === "production" ? DEFAULT_GA_ID : "");
  // 형식이 틀린 값(따옴표·공백 섞임 등)이면 스크립트 주소가 깨지므로 끈다
  return /^G-[A-Z0-9]+$/.test(id) ? id : "";
}
