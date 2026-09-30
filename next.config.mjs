/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 화면은 data/processed 의 JSON만 읽는다 (빌드 시점). 타입 검사는 tsconfig.json(app+lib)만 대상.
};
export default nextConfig;
