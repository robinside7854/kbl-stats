// 앱 설치(홈 화면 아이콘)용 PNG 만들기. 한 번 돌려 public/icons/·app/apple-icon.png 에 커밋한다 — prebuild 아님.
// 그림 (2026-10-05 사용자: "통계 앱 같다 → KBL + 농구 + 스탯 셋 다"): 리그 남색 바탕 위 KBL 글자 + 주황 농구공 + 막대 세 개.
// 색은 KBL 리그 로고의 남색 #011B6A·주황 #EB6100. 글자는 기기 글꼴에 기대지 않게 선(path)으로 그린다.
// app/icon.svg(파비콘)도 이 파일이 같은 그림으로 써 넣는다. maskable 은 안드로이드가 원으로 잘라도 남게 안쪽 78% 에 둔다.
// 실행: npx tsx scripts/build-app-icons.ts
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { APP_ART as ART, NAVY } from "./app-art.js";

const svg = (bg: string, inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${bg}${inner}</svg>`;
const ROUNDED = svg(`<rect width="64" height="64" rx="14" fill="${NAVY}"/>`, ART);
const FULL = svg(`<rect width="64" height="64" fill="${NAVY}"/>`, ART);
const MASKABLE = svg(`<rect width="64" height="64" fill="${NAVY}"/>`, `<g transform="translate(32 32) scale(0.78) translate(-32 -32)">${ART}</g>`);

const png = (s: string, size: number, out: string) => sharp(Buffer.from(s), { density: 600 }).resize(size, size).png().toFile(out);

async function main() {
  await mkdir("public/icons", { recursive: true });
  await writeFile("app/icon.svg", ROUNDED + "\n");
  for (const size of [192, 512]) {
    await png(ROUNDED, size, `public/icons/icon-${size}.png`);
    await png(MASKABLE, size, `public/icons/maskable-${size}.png`);
  }
  // 아이폰은 스스로 둥글게 자르므로 바탕을 끝까지
  await png(FULL, 180, "app/apple-icon.png");
  console.log("app/icon.svg, app/apple-icon.png, public/icons: icon-192·512, maskable-192·512");
}
main();
