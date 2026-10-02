// 54-0 게임 후보 풀 만들기 — `npm run build`·`npm run dev` 전에 자동 실행 (package.json prebuild·predev).
// data/processed → (lib/data 와 같은 카드 변환) → lib/game-pool buildGamePool → public/game/pool.json.
// 생성물이므로 git 에 올리지 않는다(.gitignore). processed 가 없으면 빈 풀을 쓴다(빌드 실패 금지).
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { decodeSeasonCards, encodeSeasonCards, type SeasonCards } from "../lib/cards.js";
import { toCardPlayers, toCardTeams } from "../lib/convert.js";
import { buildGamePool } from "../lib/game-pool.js";
import type { PlayerIndexEntry, SeasonData, SeasonOption } from "../lib/types.js";

const ROOT = process.cwd();
const PROCESSED = join(ROOT, "data", "processed");
const OUT = join(ROOT, "public", "game");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main() {
  const seasons = await readJson<SeasonOption[]>(join(PROCESSED, "seasons.json"), []);
  const index = await readJson<PlayerIndexEntry[]>(join(PROCESSED, "players-index.json"), []);
  const photo = new Map(index.map((e) => [e.id, e.photoUrl]));
  const all: SeasonCards[] = [];
  for (const s of seasons) {
    const season = await readJson<SeasonData | null>(join(PROCESSED, String(s.seasonCode), "players.json"), null);
    if (!season || season.players.length === 0) continue;
    const file = encodeSeasonCards(
      { seasonCode: season.seasonCode, seasonLabel: season.seasonLabel, coverage: season.coverage, teams: toCardTeams(season) },
      toCardPlayers(season, (no) => photo.get(no) ?? null),
    );
    all.push(decodeSeasonCards(file));
  }
  const pool = buildGamePool(all);
  await mkdir(OUT, { recursive: true });
  const json = JSON.stringify(pool);
  await writeFile(join(OUT, "pool.json"), json, "utf8");
  const n = pool.eras.reduce((s, e) => s + e.teams.reduce((t, x) => t + x.candidates.length, 0), 0);
  console.log(
    `게임 풀: 구간 ${pool.eras.length}개 [${pool.eras.map((e) => `${e.label}:${e.teams.length}팀`).join(" ")}] 후보 ${n}명 → public/game/pool.json (${(json.length / 1024).toFixed(0)}KB)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
