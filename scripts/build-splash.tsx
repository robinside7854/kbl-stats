// 아이폰·아이패드 시작 화면 그림 public/splash/{px}.png 만들기 — 한 번 돌려 커밋한다(prebuild 아님). 목록은 lib/splash.ts.
// 디자인 = 시안 A 리그 남색(2026-10-06 사용자 결정): 남색 바탕 + 가운데 앱 아이콘 그림 + "KBL 스탯" + STATS REFERENCE, 아래 "비영리 팬 프로젝트".
// 글꼴은 레포의 Pretendard(OFL), 그림은 next/og(satori) — build-og.tsx 와 같은 방식. 안드로이드 시작 화면은 manifest 배경색이라 여기와 무관.
// 실행: npx tsx scripts/build-splash.tsx
import React from "react";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { APP_ART, NAVY } from "./app-art.js";
import { SPLASH_DEVICES, splashFile } from "../lib/splash.js";

const art = `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${APP_ART}</svg>`).toString("base64")}`;

async function main() {
  const [bold, regular] = await Promise.all([readFile("assets/fonts/Pretendard-Bold.otf"), readFile("assets/fonts/Pretendard-Regular.otf")]);
  await mkdir("public/splash", { recursive: true });
  for (const d of SPLASH_DEVICES) {
    const W = d.w * d.dpr;
    const H = d.h * d.dpr;
    const u = (n: number) => Math.round(n * d.dpr); // CSS pt → 픽셀
    const icon = u(Math.min(d.w * 0.3, 140));
    const res = new ImageResponse(
      (
        <div style={{ width: W, height: H, background: NAVY, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Pretendard", color: "#ffffff" }}>
          <img src={art} width={icon} height={icon} alt="" />
          <div style={{ marginTop: u(14), fontSize: u(30), fontWeight: 700, letterSpacing: -u(0.3) }}>KBL 스탯</div>
          <div style={{ marginTop: u(4), fontSize: u(12), fontWeight: 400, letterSpacing: u(2.4), color: "rgba(255,255,255,0.6)" }}>STATS REFERENCE</div>
          <div style={{ position: "absolute", bottom: u(48), left: 0, right: 0, display: "flex", justifyContent: "center", fontSize: u(12), color: "rgba(255,255,255,0.45)" }}>비영리 팬 프로젝트</div>
        </div>
      ),
      { width: W, height: H, fonts: [{ name: "Pretendard", data: bold, weight: 700, style: "normal" }, { name: "Pretendard", data: regular, weight: 400, style: "normal" }] },
    );
    const png = await sharp(Buffer.from(await res.arrayBuffer())).png({ palette: true, quality: 90, compressionLevel: 9 }).toBuffer();
    await writeFile(`public${splashFile(d)}`, png);
    console.log(`${splashFile(d)} ${(png.length / 1024).toFixed(0)}KB`);
  }
}
main();
