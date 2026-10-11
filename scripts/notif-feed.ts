// 알림 목록 만들기 (공용) — build-notifications.ts(화면용 파일)·send-push.ts(폰 알림) 가 같이 쓴다.
// data/processed(최신 시즌 games.json·시즌 파일·선수 색인) → lib/notifications buildNotifItems.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildNotifItems, careerHighsFromIndex, careerSumsFromSeasons, type NotifFeed } from "../lib/notifications.js";
import type { PlayerIndexEntry, SeasonData, SeasonGamesFile, SeasonOption } from "../lib/types.js";

const PROCESSED = join(process.cwd(), "data", "processed");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8")) as T;
}

export async function buildNotifFeed(): Promise<NotifFeed> {
  const seasons = await readJson<SeasonOption[]>(join(PROCESSED, "seasons.json"), []);
  let seasonCode: number | null = null;
  let games: SeasonGamesFile | null = null;
  for (const s of [...seasons].sort((a, b) => b.seasonCode - a.seasonCode)) {
    const f = await readJson<SeasonGamesFile | null>(join(PROCESSED, String(s.seasonCode), "games.json"), null);
    if (f?.games.some((g) => g.ended && g.box)) {
      seasonCode = s.seasonCode;
      games = f;
      break;
    }
  }
  const feed: NotifFeed = { version: 1, seasonCode: seasonCode ?? 0, builtAt: new Date().toISOString(), items: [] };
  if (seasonCode === null || !games) return feed;

  const teamShort: Record<string, string> = {};
  const seasonFiles: SeasonData[] = [];
  for (const s of seasons) {
    const season = await readJson<SeasonData | null>(join(PROCESSED, String(s.seasonCode), "players.json"), null);
    if (!season) continue;
    if (s.seasonCode === seasonCode) for (const t of season.teams ?? []) teamShort[t.teamCode] = t.shortNameKo;
    seasonFiles.push(season);
  }
  const careerSums = careerSumsFromSeasons(seasonFiles);
  const index = await readJson<PlayerIndexEntry[]>(join(PROCESSED, "players-index.json"), []);
  const careerHighs = careerHighsFromIndex(index);
  feed.items = buildNotifItems(games.games, { seasonCode, teamShort, careerHighs, careerSums });
  return feed;
}
