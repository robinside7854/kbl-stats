// 앱 설치(홈 화면 아이콘)용 PNG 만들기 (2026-10-05 사용자: 앱처럼 설치). 한 번 돌려 public/icons/ 에 커밋한다 — prebuild 아님.
// 그림은 app/icon.svg(막대 세 개)와 같다. maskable 은 안드로이드가 원·둥근 사각형으로 잘라도 막대가 남게 바탕을 끝까지 채우고 막대를 안쪽 70% 에 둔다.
// 실행: npx tsx scripts/build-app-icons.ts
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";

const BARS = `<rect x="15" y="34" width="9" height="16" rx="2" fill="#ffffff" opacity="0.6"/><rect x="27.5" y="25" width="9" height="25" rx="2" fill="#ffffff" opacity="0.8"/><rect x="40" y="14" width="9" height="36" rx="2" fill="#E8C468"/>`;
const MASKABLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#111110"/><g transform="translate(32 32) scale(0.7) translate(-32 -32)">${BARS}</g></svg>`;

async function main() {
  await mkdir("public/icons", { recursive: true });
  const any = await readFile("app/icon.svg");
  for (const size of [192, 512]) {
    await sharp(any, { density: 600 }).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
    await sharp(Buffer.from(MASKABLE), { density: 600 }).resize(size, size).png().toFile(`public/icons/maskable-${size}.png`);
  }
  console.log("public/icons: icon-192·512, maskable-192·512");
}
main();
