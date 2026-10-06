// 하이라이트만 확인 (2026-10-06 사용자: "하이라이트는 되도록 공백 없이") — fetch.yml 이 그날 수집을 안 할 때(문지기가 건너뜀) 부른다.
// TVING 하이라이트는 경기 끝나고 2~10시간 뒤에 올라와서(10/5 14시 경기 → 22시, 16시 경기 → 새벽 1시) 하루 1번 수집만으로는 하루씩 늦었다.
// 1) 최신 시즌 games.json 에서 하이라이트를 기다리는 경기(pendingHighlightGames — 끝났고 영상 없고 3일 안)가 없으면 아무 요청도 안 함
// 2) 있으면 RSS 1번 → 그 경기에 맞는 영상이 있으면 raw 저장(data/raw/highlights/tving/{UTC시각}.xml) → GITHUB_OUTPUT changed=true
//    (그다음 fetch.yml 이 npm run process 로 games.json 에 붙이고 커밋 → Vercel 재배포)
// 실패해도 종료 코드 0 (매일 수집을 막지 않게). 실행: npx tsx scripts/highlight-watch.ts
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, HIGHLIGHT_FEED_URL, HIGHLIGHT_SOURCE } from "./config.js";
import { matchHighlights, parseFeed, pendingHighlightGames } from "./highlights.js";
import { todayKst } from "./highs.js";
import type { SeasonGame } from "../lib/types.js";

async function output(changed: boolean) {
  const file = process.env.GITHUB_OUTPUT;
  if (file) await appendFile(file, `changed=${changed}\n`);
}

async function main() {
  const seasons = JSON.parse(await readFile(join(DATA_DIR, "processed", "seasons.json"), "utf8")) as { seasonCode: number }[];
  const code = seasons[seasons.length - 1]?.seasonCode;
  const file = await readFile(join(DATA_DIR, "processed", String(code), "games.json"), "utf8").catch(() => null);
  if (!file) {
    console.log(`[하이라이트] ${code} 시즌 경기 파일 없음 — 건너뜀`);
    return output(false);
  }
  const games = (JSON.parse(file) as { games: SeasonGame[] }).games;
  const pending = pendingHighlightGames(games, todayKst());
  if (pending.length === 0) {
    console.log("[하이라이트] 기다리는 경기 없음 — 요청 안 함");
    return output(false);
  }
  console.log(`[하이라이트] 기다리는 경기 ${pending.length}개: ${pending.map((g) => `${g.date} ${g.home.name}-${g.away.name}`).join(", ")}`);
  const res = await fetch(HIGHLIGHT_FEED_URL, { headers: { "User-Agent": "kbl-stats fan project (non-commercial; github.com/robinside7854/kbl-stats)" } });
  if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
  const xml = await res.text();
  const found = matchHighlights(pending, parseFeed(xml));
  if (found.size === 0) {
    console.log("[하이라이트] 아직 안 올라옴");
    return output(false);
  }
  const dir = join(DATA_DIR, "raw", "highlights", HIGHLIGHT_SOURCE);
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13);
  await writeFile(join(dir, `${stamp}.xml`), xml, "utf8");
  console.log(`[하이라이트] ${found.size}경기 새 영상 → ${dir}/${stamp}.xml`);
  return output(true);
}

main().catch(async (e) => {
  console.warn(`[하이라이트] 확인 실패(경고만): ${(e as Error).message}`);
  await output(false);
});
