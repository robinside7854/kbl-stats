/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
