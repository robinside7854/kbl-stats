// 방문 통계(GA4) 측정 ID — Vercel 환경변수 NEXT_PUBLIC_GA_ID (예: G-ABC123XYZ). 비어 있으면 통계를 끈다.
// 서버 컴포넌트(푸터 안내 문구)와 브라우저(app/components/Analytics) 양쪽에서 읽으므로 lib 에 둔다.
export function gaMeasurementId(): string {
  const id = (process.env.NEXT_PUBLIC_GA_ID ?? "").trim();
  // 형식이 틀린 값(따옴표·공백 섞임 등)이면 스크립트 주소가 깨지므로 끈다
  return /^G-[A-Z0-9]+$/.test(id) ? id : "";
}
