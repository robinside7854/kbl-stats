// 54-0 게임 후보 풀 만들기 — `npm run build`·`npm run dev` 전에 자동 실행 (package.json prebuild·predev).
// data/processed → (lib/data 와 같은 카드 변환) → lib/game-pool buildGamePool → public/game/pool.json.
// 생성물이므로 git 에 올리지 않는다(.gitignore). processed 가 없으면 빈 풀을 쓴다(빌드 실패 금지).
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { decodeSeasonCards, encodeSeasonCards, type SeasonCards } from "../lib/cards.js";
import { toCardPlayers, toCardTeams } from "../lib/convert.js";
import { buildGamePool, pickRegularChampions } from "../lib/game-pool.js";
import { computeStandings } from "../lib/games.js";
import { pickPrimeSeasons, primeCandidatesOf } from "../lib/prime.js";
import { schoolGroupOf, SCHOOL_ABROAD } from "../lib/roster.js";
import type { PlayerIndexEntry, SeasonData, SeasonGame, SeasonOption } from "../lib/types.js";

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
  const regularChampions = new Map<number, Set<string>>();
  for (const s of seasons) {
    const season = await readJson<SeasonData | null>(join(PROCESSED, String(s.seasonCode), "players.json"), null);
    if (!season || season.players.length === 0) continue;
    // 정규리그 1위 (우승 DNA): 경기 결과 순위 맨 위 동률 팀 → 공식 1위 이름으로 가린다
    const games = await readJson<{ games: SeasonGame[] } | null>(join(PROCESSED, String(s.seasonCode), "games.json"), null);
    const rows = computeStandings(games?.games ?? []);
    const top = rows.filter((r) => r.pct === rows[0]?.pct && r.wins === rows[0]?.wins);
    const names = (code: string) => season.teams.filter((t) => t.teamCode === code).flatMap((t) => [t.shortNameKo, t.name, t.shortName]);
    const first = pickRegularChampions(
      top.map((r) => ({ teamCode: r.teamCode, names: names(r.teamCode) })),
      season.seasonAwards?.regular?.first ?? null,
    );
    if (first.length > 0) regularChampions.set(season.seasonCode, new Set(first));
    const file = encodeSeasonCards(
      { seasonCode: season.seasonCode, seasonLabel: season.seasonLabel, coverage: season.coverage, teams: toCardTeams(season) },
      toCardPlayers(season, (no) => photo.get(no) ?? null),
    );
    all.push(decodeSeasonCards(file));
  }
  // 출신교 (동문 케미): 해외·정보 없음은 빼고, 프라임 시즌
  const schools = new Map<string, string>();
  for (const e of index) {
    const g = schoolGroupOf(e.school, e.isForeign);
    if (g && g !== SCHOOL_ABROAD) schools.set(e.id, g);
  }
  const primes = pickPrimeSeasons(all.flatMap(primeCandidatesOf));
  const pool = buildGamePool(all, { schools, primes, regularChampions });
  console.log(`정규리그 1위: ${[...regularChampions].map(([k, v]) => `${k}:${[...v].join("·")}`).join(" ")}`);
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
