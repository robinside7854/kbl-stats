// 검색용 경량 색인 만들기 — `npm run build`·`npm run dev` 전에 자동 실행 (package.json prebuild·predev).
// data/processed/players-index.json + seasons.json + 시즌 파일 팀 색 → public/search-index.json
// 상단 검색창이 브라우저에서 이 파일을 한 번만 받아 이름을 거른다 (우리 사이트의 정적 파일, KBL 호출 아님).
// 생성물이므로 git 에 올리지 않는다(.gitignore). 규칙은 lib/search.ts buildSearchIndex.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildSearchIndex } from "../lib/search.js";
import { decodeSeasonCards, encodeSeasonCards } from "../lib/cards.js";
import { toCardPlayers, toCardTeams } from "../lib/convert.js";
import { pickPrimeSeasons, primeCandidatesOf, type PrimeCandidate } from "../lib/prime.js";
import type { PlayerIndexEntry, SeasonData, SeasonOption } from "../lib/types.js";

const ROOT = process.cwd();
const PROCESSED = join(ROOT, "data", "processed");

async function main() {
  const index = JSON.parse(await readFile(join(PROCESSED, "players-index.json"), "utf8")) as PlayerIndexEntry[];
  const seasons = JSON.parse(await readFile(join(PROCESSED, "seasons.json"), "utf8")) as SeasonOption[];
  const labelByCode = new Map(seasons.map((s) => [s.seasonCode, s.seasonLabel]));

  // 선수들의 마지막 시즌 파일에서만 팀 색을 읽는다
  const colorBySeason = new Map<number, Map<string, { primary: string; text: string }>>();
  for (const code of new Set(index.map((e) => e.seasons[e.seasons.length - 1]?.seasonCode).filter((c) => c !== undefined))) {
    const file = join(PROCESSED, String(code), "players.json");
    if (!existsSync(file)) continue;
    const season = JSON.parse(await readFile(file, "utf8")) as SeasonData;
    colorBySeason.set(code, new Map(season.teams.map((t) => [t.teamCode, { primary: t.color.primary, text: t.color.text }])));
  }

  const entries = buildSearchIndex(
    index,
    (code) => labelByCode.get(code) ?? String(code),
    (team, code) => colorBySeason.get(code)?.get(team),
  );
  // 프라임 시즌: 전 시즌 카드 데이터(public/cards 와 같은 encode→decode)로 계산해 비교 탭 시즌 칩에 표시 (lib/prime)
  const candidates: PrimeCandidate[] = [];
  for (const s of seasons) {
    const file = join(PROCESSED, String(s.seasonCode), "players.json");
    if (!existsSync(file)) continue;
    const season = JSON.parse(await readFile(file, "utf8")) as SeasonData;
    if (season.players.length === 0) continue;
    const cards = decodeSeasonCards(
      encodeSeasonCards(
        { seasonCode: season.seasonCode, seasonLabel: season.seasonLabel, coverage: season.coverage, teams: toCardTeams(season) },
        toCardPlayers(season, () => null),
      ),
    );
    candidates.push(...primeCandidatesOf(cards));
  }
  const prime = pickPrimeSeasons(candidates);
  for (const e of entries) {
    const c = prime.get(e.id);
    if (c !== undefined) e.prime = c;
  }

  await mkdir(join(ROOT, "public"), { recursive: true });
  const json = JSON.stringify(entries);
  await writeFile(join(ROOT, "public", "search-index.json"), json, "utf8");
  console.log(`검색 색인: ${entries.length}명, ${(json.length / 1024).toFixed(0)}KB → public/search-index.json`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
