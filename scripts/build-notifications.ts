// 알림 목록 만들기 — `npm run build`·`npm run dev` 전에 자동 실행 (package.json prebuild·predev, 2026-10-08 알림함).
// scripts/notif-feed.ts buildNotifFeed → public/notifications.json. 모두에게 같은 목록이고, 브라우저가 즐겨찾기 선수·응원팀 것만 고른다
// (우리 정적 파일 — KBL 호출 아님). 생성물이라 git 제외.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildNotifFeed } from "./notif-feed.js";

const ROOT = process.cwd();
const OUT = join(ROOT, "public", "notifications.json");

async function main() {
  const feed = await buildNotifFeed();
  await mkdir(join(ROOT, "public"), { recursive: true });
  await writeFile(OUT, JSON.stringify(feed));
  const byKind = feed.items.reduce<Record<string, number>>((m, it) => ((m[it.kind] = (m[it.kind] ?? 0) + 1), m), {});
  console.log(`알림: 시즌 ${feed.seasonCode} · ${feed.items.length}개 ${JSON.stringify(byKind)}`);
}

main().catch((e) => {
  console.error("알림 목록 만들기 실패 (빈 목록으로 계속):", e);
  return writeFile(OUT, JSON.stringify({ version: 1, seasonCode: 0, builtAt: new Date().toISOString(), items: [] }));
});
