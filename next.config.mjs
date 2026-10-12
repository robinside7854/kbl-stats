// 보안 헤더 (2026-10-03 보안 점검 — 커뮤니티 공개 전). 모든 주소에 붙는다(Vercel 정적 파일 포함).
// CSP 허용 출처 = 이 사이트가 실제로 부르는 곳만:
//   - KBL 공식 사진·로고 kbl.or.kr (img, scripts/image-urls.ts·data/codes/site.json)
//   - Pretendard 글꼴 CSS·파일 cdn.jsdelivr.net (style·font, 카드 저장 때 fetch — app/components/webFont.ts)
//   - GA4 googletagmanager·google-analytics (Google 권장 CSP, app/components/Analytics.tsx)
//   - 경기 하이라이트 영상 틀 youtube-nocookie.com (frame, 2026-10-04 app/components/GameCard.tsx — 팝업을 열 때만)
// Next.js 정적 HTML 은 인라인 스크립트(하이드레이션 데이터)를 쓰므로 script 'unsafe-inline' 이 필요하다(정적 사이트라 nonce 불가).
// 개발 서버(npm run dev)는 eval 을 써서 CSP 를 운영 빌드에만 건다. 새 외부 출처를 쓰면 여기에 더해야 화면이 막히지 않는다.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://*.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https://kbl.or.kr https://*.google-analytics.com https://*.googletagmanager.com",
  "connect-src 'self' https://cdn.jsdelivr.net https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
  "frame-src https://www.youtube-nocookie.com",
  // 폰 푸시 알림 받는 서비스 워커 public/sw.js (2026-10-08)
  "worker-src 'self'",
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

// 로그인(구글·네이버, 2026-10-04) 켜기 판정 — 빌드 때 한 번. 화면은 NEXT_PUBLIC_LOGIN_PROVIDERS 만 본다(lib/account enabledLoginProviders).
// 운영 배포(또는 로컬 시험용 LOGIN_FORCE_ENABLE=1) + 비밀값(NEXTAUTH_SECRET) + DB(DATABASE_URL, Vercel Neon 연동) + 그 회사 키가 모두 있어야 켜진다.
// 하나라도 없으면 빈 값 → 로그인 버튼·화면이 숨는다(미리보기 배포·설정 전 상태가 깨지지 않게).
function loginProviders() {
  const env = process.env;
  const on = env.VERCEL_ENV === "production" || env.LOGIN_FORCE_ENABLE === "1";
  if (!on || !(env.NEXTAUTH_SECRET || env.AUTH_SECRET) || !(env.DATABASE_URL || env.POSTGRES_URL)) return "";
  const list = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) list.push("google");
  if (env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET) list.push("naver");
  return list.join(",");
}

/** @type {import('next').NextConfig} */
/** public/ 의 빌드 생성 데이터 파일 (scripts/build-*.ts) */
const DATA_FILES = ["/notifications.json", "/search-index.json", "/search-hot.json", "/game/pool.json", "/cards/:path*", "/shots/:path*", "/games/:path*"];
const DATA_CACHE = [{ key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=3600" }];
const IMAGE_CACHE = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];

const nextConfig = {
  env: { NEXT_PUBLIC_LOGIN_PROVIDERS: loginProviders() },
  reactStrictMode: true,
  // 응답에 "X-Powered-By: Next.js" 를 붙이지 않는다 (쓰는 기술을 굳이 알리지 않게)
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // 서비스 워커는 늘 새로 받게 (고친 내용이 기기에 바로 닿도록)
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      // 빌드 때 만든 우리 데이터 파일 — 하루 한 번만 바뀌므로 브라우저가 5분 동안은 다시 묻지 않게 (2026-10-12 호출 줄이기:
      // 기본값은 화면을 옮길 때마다 "바뀌었나?" 를 다시 물어 Vercel 요청 수에 잡혔다). 5분이 지나면 가진 걸 먼저 보여 주고 뒤에서 새로 받는다.
      // Vercel 쪽 저장(CDN)은 배포 때 자동으로 비워지므로 새 데이터는 늦어도 5분 안에 보인다.
      ...DATA_FILES.map((source) => ({ source, headers: DATA_CACHE })),
      // 공유 미리보기·앱 아이콘·시작 화면 그림 — 거의 안 바뀌어 하루
      ...["/og/:path*", "/icons/:path*", "/splash/:path*"].map((source) => ({ source, headers: IMAGE_CACHE })),
    ];
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
      // 팀 순위 화면(/season/코드/teams, 2026-10-03)은 2026-10-06 "팀" 화면의 "표로 보기"로 합침
      {
        source: "/season/:seasonCode(\\d+)/teams",
        destination: "/teams?view=table&season=:seasonCode",
        permanent: false,
      },
      {
        source: "/season/:seasonCode(\\d+)/:old(playstyle)",
        destination: "/season/:seasonCode/leaders",
        permanent: false,
      },
    ];
  },
};
export default nextConfig;
