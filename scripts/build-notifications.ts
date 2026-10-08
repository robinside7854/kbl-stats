// 알림 목록 만들기 — `npm run build`·`npm run dev` 전에 자동 실행 (package.json prebuild·predev, 2026-10-08 알림함).
// data/processed(최신 시즌 games.json·시즌 파일·선수 색인) → lib/notifications buildNotifItems → public/notifications.json.
// 모두에게 같은 목록이고, 브라우저가 즐겨찾기 선수·응원팀 것만 고른다(우리 정적 파일 — KBL 호출 아님). 생성물이라 git 제외.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildNotifItems, type CareerSums, type NotifContext, type NotifFeed } from "../lib/notifications.js";
import type { PlayerIndexEntry, SeasonData, SeasonGamesFile, SeasonOption } from "../lib/types.js";

const ROOT = process.cwd();
const PROCESSED = join(ROOT, "data", "processed");
const OUT = join(ROOT, "public", "notifications.json");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main() {
  const seasons = await readJson<SeasonOption[]>(join(PROCESSED, "seasons.json"), []);
  // 경기 기록(박스스코어)이 있는 가장 최근 시즌
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
  if (seasonCode === null || !games) {
    await writeFile(OUT, JSON.stringify(feed));
    console.log("알림: 경기 기록 없음 — 빈 목록");
    return;
  }

  // 통산 합계(전 시즌) · 팀 약칭(이번 시즌)
  const careerSums: Record<string, CareerSums> = {};
  const teamShort: Record<string, string> = {};
  for (const s of seasons) {
    const season = await readJson<SeasonData | null>(join(PROCESSED, String(s.seasonCode), "players.json"), null);
    if (!season) continue;
    if (s.seasonCode === seasonCode) for (const t of season.teams ?? []) teamShort[t.teamCode] = t.shortNameKo;
    for (const p of season.players) {
      const c = (careerSums[p.playerNo] ??= { points: 0, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0, games: 0, wins: 0 });
      c.points += p.points; c.reb += p.reb; c.ast += p.ast; c.stl += p.stl; c.blk += p.blk; c.tpm += p.tpm;
      c.games += p.games; c.wins += p.wins;
    }
  }
  const index = await readJson<PlayerIndexEntry[]>(join(PROCESSED, "players-index.json"), []);
  const careerHighs: NotifContext["careerHighs"] = {};
  for (const p of index) {
    const reg = (p.careerHighs as { regular?: NotifContext["careerHighs"][string] } | null | undefined)?.regular;
    if (reg) careerHighs[p.id] = reg;
  }

  feed.items = buildNotifItems(games.games, { seasonCode, teamShort, careerHighs, careerSums });
  await mkdir(join(ROOT, "public"), { recursive: true });
  await writeFile(OUT, JSON.stringify(feed));
  const byKind = feed.items.reduce<Record<string, number>>((m, it) => ((m[it.kind] = (m[it.kind] ?? 0) + 1), m), {});
  console.log(`알림: 시즌 ${seasonCode} · ${feed.items.length}개 ${JSON.stringify(byKind)}`);
}

main().catch((e) => {
  console.error("알림 목록 만들기 실패 (빈 목록으로 계속):", e);
  return writeFile(OUT, JSON.stringify({ version: 1, seasonCode: 0, builtAt: new Date().toISOString(), items: [] }));
});
