// 팬 참여 정적 파일 만들기 — `npm run build`·`npm run dev` 전에 자동 실행 (package.json prebuild·predev, 2026-10-16).
// 경기가 있는 가장 최근 시즌의 data/processed/{시즌}/games.json → public/vote/data.json
// = 최근 4주 팬 MVP 후보(그 주 박스스코어, 팀마다 한 명·눈에 띈 기록 순) + 시즌 경기 표(시작 시각·승패). 규칙은 lib/votes.ts.
// 서버(API)가 이 파일로 투표·예측이 맞는지 검사한다(lib/server/vote-data.ts). 생성물이라 git 제외.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PlayerIndexEntry, SeasonGamesFile, SeasonOption } from "../lib/types.js";
import { buildVoteData, type VoteDataFile } from "../lib/votes.js";

const ROOT = process.cwd();
const PROCESSED = join(ROOT, "data", "processed");
const OUT_DIR = join(ROOT, "public", "vote");
const OUT = join(OUT_DIR, "data.json");

const empty = (): VoteDataFile => ({ version: 1, seasonCode: 0, builtAt: new Date().toISOString(), weeks: [], games: [] });

async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main() {
  const seasons = (await readJson<SeasonOption[]>(join(PROCESSED, "seasons.json"), [])).map((s) => s.seasonCode).sort((a, b) => b - a);
  const index = await readJson<PlayerIndexEntry[]>(join(PROCESSED, "players-index.json"), []);
  const photo = new Map(index.map((p) => [p.id, p.photoUrl]));
  let data = empty();
  for (const code of seasons) {
    const file = await readJson<SeasonGamesFile | null>(join(PROCESSED, String(code), "games.json"), null);
    if (!file?.games?.length) continue;
    data = buildVoteData(code, file.games, (id) => photo.get(id) ?? null);
    break;
  }
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, JSON.stringify(data));
  const weeks = data.weeks.map((w) => `${w.week} ${w.players.length}명`).join(", ") || "없음";
  console.log(`팬 참여: 시즌 ${data.seasonCode} · 후보 ${weeks} · 경기 ${data.games.length}`);
}

main().catch(async (e) => {
  console.error("팬 참여 파일 만들기 실패 (빈 파일로 계속):", e);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, JSON.stringify(empty()));
});
