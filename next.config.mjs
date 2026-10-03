// 보안 헤더 (2026-10-03 보안 점검 — 커뮤니티 공개 전). 모든 주소에 붙는다(Vercel 정적 파일 포함).
// CSP 허용 출처 = 이 사이트가 실제로 부르는 곳만:
//   - KBL 공식 사진·로고 kbl.or.kr (img, scripts/image-urls.ts·data/codes/site.json)
//   - Pretendard 글꼴 CSS·파일 cdn.jsdelivr.net (style·font, 카드 저장 때 fetch — app/components/webFont.ts)
//   - GA4 googletagmanager·google-analytics (Google 권장 CSP, app/components/Analytics.tsx)
// Next.js 정적 HTML 은 인라인 스크립트(하이드레이션 데이터)를 쓰므로 script 'unsafe-inline' 이 필요하다(정적 사이트라 nonce 불가).
// 개발 서버(npm run dev)는 eval 을 써서 CSP 를 운영 빌드에만 건다. 새 외부 출처를 쓰면 여기에 더해야 화면이 막히지 않는다.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://*.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https://kbl.or.kr https://*.google-analytics.com https://*.googletagmanager.com",
  "connect-src 'self' https://cdn.jsdelivr.net https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  // 다른 사이트가 이 사이트를 틀(iframe) 안에 넣어 클릭을 유도하지 못하게 (CSP frame-ancestors 를 모르는 옛 브라우저용)
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: CSP }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 응답에 "X-Powered-By: Next.js" 를 붙이지 않는다 (쓰는 기술을 굳이 알리지 않게)
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // 화면은 data/processed 의 JSON만 읽는다 (빌드 시점). 타입 검사는 tsconfig.json(app+lib)만 대상.

  // 옛 "플레이어 카드" 탭(/season/[코드])은 없앴다 (2026-09-30 피드백, PLAN.md §6-4) — 공유된 옛 주소를 살린다.
  //  - ?p=선수번호 가 있으면 그 선수 상세의 그 시즌 카드로: /player/번호?season=코드
  //  - 없으면 그 시즌 순위표로
  // 시즌 코드는 주소에서 그대로 받아 넘긴다(하드코딩 아님). 임시(307) — 구조가 또 바뀌어도 브라우저에 굳지 않게.
  // 참고: Next.js 는 원래 쿼리(p·vs·team 등)를 목적지에 덧붙인다 → 목적지 화면은 모르는 쿼리를 무시한다.
  async redirects() {
    return [
      {
        source: "/season/:seasonCode(\\d+)",
        has: [{ type: "query", key: "p", value: "(?<p>\\d+)" }],
        destination: "/player/:p?season=:seasonCode",
        permanent: false,
      },
      {
        source: "/season/:seasonCode(\\d+)",
        destination: "/season/:seasonCode/leaders",
        permanent: false,
      },
      // 플레이스타일(2026-10-02) 탭은 없앴다 — 옛 주소는 같은 시즌 리더보드로.
      // /season/코드/teams 는 2026-10-03 부터 팀 순위 화면 (예전 팀 분포 주소를 다시 씀)
      {
        source: "/season/:seasonCode(\\d+)/:old(playstyle)",
        destination: "/season/:seasonCode/leaders",
        permanent: false,
      },
    ];
  },
};
export default nextConfig;
