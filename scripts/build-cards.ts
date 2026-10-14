// 비교 탭용 시즌별 카드 데이터 만들기 — `npm run build`·`npm run dev` 전에 자동 실행 (package.json prebuild·predev).
// data/processed/{시즌}/players.json + players-index.json(사진 주소) → public/cards/{seasonCode}.json
// 브라우저가 고른 시즌 파일만 받아 lib/cards.ts decodeSeasonCards → lib/metrics buildCardContext 로 카드를 그린다.
// 형식은 lib/cards.ts (열 형식, 기본 표본 기준 참고값 포함). 생성물이므로 git 에 올리지 않는다(.gitignore).
// 선수 0명 시즌(개막 전)은 만들지 않는다. processed 가 없으면 빈 폴더만 남기고 끝낸다(빌드 실패 금지).
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { decodeSeasonCards, encodeSeasonCards, type SeasonCards } from "../lib/cards.js";
import { buildCareerCards, CAREER_CODE, CAREER_COVERAGE, CAREER_LABEL, CAREER_QUALIFY } from "../lib/career-cards.js";
import { toCardPlayers, toCardTeams } from "../lib/convert.js";
import type { PlayerIndexEntry, SeasonData, SeasonOption } from "../lib/types.js";
import { isOngoingSeason, seasonDefaultQualify } from "../lib/metrics.js";

const ROOT = process.cwd();
const PROCESSED = join(ROOT, "data", "processed");
const OUT = join(ROOT, "public", "cards");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main() {
  const seasons = await readJson<SeasonOption[]>(join(PROCESSED, "seasons.json"), []);
  const index = await readJson<PlayerIndexEntry[]>(join(PROCESSED, "players-index.json"), []);
  const photo = new Map(index.map((e) => [e.id, e.photoUrl]));

  // 지난 생성물(없어진 시즌)이 남지 않게 매번 비우고 다시 만든다
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  // 진행 중 시즌(선수 있는 가장 최근 시즌, 우승팀 없음)은 팀 경기 절반 이상 — lib/data seasonQualify 와 같은 규칙
  const loaded = new Map<number, SeasonData>();
  for (const s of seasons) {
    const season = await readJson<SeasonData | null>(join(PROCESSED, String(s.seasonCode), "players.json"), null);
    if (season && season.players.length > 0) loaded.set(s.seasonCode, season);
  }
  const latest = loaded.size > 0 ? Math.max(...loaded.keys()) : null;

  const sizes: string[] = [];
  let maxKb = 0;
  const all: SeasonCards[] = [];
  for (const s of seasons) {
    const season = loaded.get(s.seasonCode);
    if (!season) continue;
    const players = toCardPlayers(season, (no) => photo.get(no) ?? null);
    const file = encodeSeasonCards(
      { seasonCode: season.seasonCode, seasonLabel: season.seasonLabel, coverage: season.coverage, teams: toCardTeams(season) },
      players,
      seasonDefaultQualify(isOngoingSeason(season.seasonCode, latest, season.champion ?? null), season.players),
    );
    all.push(decodeSeasonCards(file));
    const json = JSON.stringify(file);
    await writeFile(join(OUT, `${season.seasonCode}.json`), json, "utf8");
    const kb = json.length / 1024;
    maxKb = Math.max(maxKb, kb);
    sizes.push(`${season.seasonCode}:${kb.toFixed(0)}`);
  }
  // 통산 카드 (비교 탭 "통산" 칩, 코드 0) — 전 시즌을 선수별로 더한 것 (lib/career-cards)
  if (all.length > 0) {
    const career = buildCareerCards(all);
    const file = encodeSeasonCards(
      { seasonCode: CAREER_CODE, seasonLabel: CAREER_LABEL, coverage: CAREER_COVERAGE, teams: career.teams },
      career.players,
      CAREER_QUALIFY,
    );
    const json = JSON.stringify(file);
    await writeFile(join(OUT, `${CAREER_CODE}.json`), json, "utf8");
    sizes.push(`통산:${(json.length / 1024).toFixed(0)}`);
  }
  console.log(`카드 데이터: ${sizes.length}개 시즌 → public/cards/ (최대 ${maxKb.toFixed(0)}KB) [${sizes.join(" ")}]`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
