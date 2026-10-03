// 날짜별 박스스코어 파일 만들기 — `npm run build`·`npm run dev` 전에 자동 실행 (package.json prebuild·predev, 2026-10-03 일정 화면).
// data/processed/{시즌}/games.json → public/games/{시즌}/{YYYY-MM-DD}.json = { [gmkey]: { home, away } } (박스스코어 있는 경기만).
// 일정 화면은 경기 목록만 정적 HTML 에 넣고, "선수 기록"을 누르면 그 날짜 파일 하나만 받는다(우리 정적 파일 — KBL 호출 아님).
// 생성물이므로 git 에 올리지 않는다(.gitignore). processed 가 없으면 빈 폴더만 남기고 끝낸다(빌드 실패 금지).
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SeasonGamesFile, SeasonOption } from "../lib/types.js";

const ROOT = process.cwd();
const PROCESSED = join(ROOT, "data", "processed");
const OUT = join(ROOT, "public", "games");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main() {
  const seasons = await readJson<SeasonOption[]>(join(PROCESSED, "seasons.json"), []);
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  const notes: string[] = [];
  for (const s of seasons) {
    const file = await readJson<SeasonGamesFile | null>(join(PROCESSED, String(s.seasonCode), "games.json"), null);
    const byDate = new Map<string, Record<string, unknown>>();
    for (const g of file?.games ?? []) {
      if (!g.box) continue;
      const day = byDate.get(g.date) ?? {};
      day[g.gmkey] = g.box;
      byDate.set(g.date, day);
    }
    if (byDate.size === 0) continue;
    await mkdir(join(OUT, String(s.seasonCode)), { recursive: true });
    for (const [date, day] of byDate) await writeFile(join(OUT, String(s.seasonCode), `${date}.json`), JSON.stringify(day), "utf8");
    notes.push(`${s.seasonCode}:${byDate.size}일`);
  }
  console.log(`박스스코어 파일: ${notes.join(" ") || "없음"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
