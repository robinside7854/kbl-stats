// 선수별 슛 차트 파일 만들기 — `npm run build`·`npm run dev` 전에 자동 실행 (package.json prebuild·predev).
// data/processed/{시즌}/shots.json(점 좌표) + players.json(shotZones·shotZoneLeague) → public/shots/{시즌}/{선수}.json
// 선수 상세에서 시즌 칩을 바꾸면 브라우저가 그 선수·시즌 파일 하나만 받는다(우리 정적 파일 — KBL 호출 아님).
// 형식은 lib/shots.ts PlayerShotsFile. 생성물이므로 git 에 올리지 않는다(.gitignore). 첫 화면(최신 시즌)은 서버가 같은 값을 넣는다(lib/data loadPlayerShots).
// 슛 데이터가 없는 시즌은 폴더를 만들지 않는다. processed 가 없으면 빈 폴더만 남기고 끝낸다(빌드 실패 금지).
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildPlayerShotsFile } from "../lib/shots.js";
import type { SeasonData, SeasonOption } from "../lib/types.js";
import type { ShotPoint } from "../lib/shots.js";

const ROOT = process.cwd();
const PROCESSED = join(ROOT, "data", "processed");
const OUT = join(ROOT, "public", "shots");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main() {
  const seasons = await readJson<SeasonOption[]>(join(PROCESSED, "seasons.json"), []);
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const notes: string[] = [];
  let files = 0;
  for (const s of seasons) {
    const points = await readJson<Record<string, ShotPoint[]> | null>(join(PROCESSED, String(s.seasonCode), "shots.json"), null);
    if (!points) continue;
    const season = await readJson<SeasonData | null>(join(PROCESSED, String(s.seasonCode), "players.json"), null);
    if (!season) continue;
    const dir = join(OUT, String(s.seasonCode));
    await mkdir(dir, { recursive: true });
    let n = 0;
    for (const p of season.players) {
      const file = buildPlayerShotsFile(season, p.playerNo, points[p.playerNo]);
      if (!file) continue;
      await writeFile(join(dir, `${p.playerNo}.json`), JSON.stringify(file), "utf8");
      n++;
    }
    files += n;
    notes.push(`${s.seasonCode}:${n}`);
  }
  console.log(`슛 차트 파일: ${files}개 → public/shots/ [${notes.join(" ") || "슛 데이터 없음"}]`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
