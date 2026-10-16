// 알림 목록 만들기 (공용) — build-notifications.ts(화면용 파일)·send-push.ts(폰 알림) 가 같이 쓴다.
// data/processed(최신 시즌 games.json·시즌 파일·선수 색인) → lib/notifications buildNotifItems.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildNotifItems, careerHighsFromIndex, careerSumsFromSeasons, kstDate, sortNotifs, type NotifFeed } from "../lib/notifications.js";
import {
  alltimeRankItems,
  awardItems,
  birthdayItems,
  leaderRankItems,
  mergeLeagueRecords,
  teamPreviewItems,
  teamRankItems,
  teamStreakItems,
  type SeenAward,
} from "../lib/notif-news.js";
import { SEASON_AWARD_DEFS } from "../lib/awards.js";
import { attachFeatContexts, domesticFromIndex, performancesFromGames } from "../lib/feat-context.js";
import { seasonShortLabel } from "../lib/career.js";
import { awardSeenKey, type AwardSeenState } from "./award-seen.js";
import type { PlayerIndexEntry, SeasonData, SeasonGamesFile, SeasonOption } from "../lib/types.js";

const PROCESSED = join(process.cwd(), "data", "processed");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8")) as T;
}

/** 수상 칸 → 알림 재료 (처음 본 날이 적힌 것만 — data/award-first-seen.json) */
function seenAwards(seasonFiles: readonly SeasonData[], seen: AwardSeenState): SeenAward[] {
  const label = new Map(SEASON_AWARD_DEFS.map((d) => [d.key as string, d.label]));
  const out: SeenAward[] = [];
  for (const season of seasonFiles) {
    for (const a of season.seasonAwards?.awards ?? []) {
      for (const w of a.winners) {
        if (!w.playerNo) continue;
        const date = seen[awardSeenKey(season.seasonCode, a.key, w.playerNo, w.note)];
        if (!date) continue;
        const periodic = a.key === "roundMvp" || a.key === "monthMvp";
        out.push({
          seasonCode: season.seasonCode,
          seasonLabel: seasonShortLabel(season.seasonLabel),
          awardLabel: periodic && w.note ? `${w.note} MVP` : label.get(a.key) ?? a.key,
          playerNo: w.playerNo,
          name: w.name,
          team: w.team,
          date,
        });
      }
    }
  }
  return out;
}

/** now: 경기 날 안내·생일·수상의 "오늘" (한국 날짜) — 빌드 때와 폰 알림 보낼 때 */
export async function buildNotifFeed(now: Date = new Date()): Promise<NotifFeed> {
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
    seasonFiles.push(season);
  }
  // 팀 약칭: 최근 시즌 것으로 (이번 시즌에 아직 선수 기록이 없는 팀도 — 2026-27 SK 처럼 개막이 늦은 팀)
  for (const season of [...seasonFiles].sort((a, b) => a.seasonCode - b.seasonCode)) {
    if (season.seasonCode > seasonCode) continue;
    for (const t of season.teams ?? []) teamShort[t.teamCode] = t.shortNameKo;
  }
  const careerSums = careerSumsFromSeasons(seasonFiles);
  const index = await readJson<PlayerIndexEntry[]>(join(PROCESSED, "players-index.json"), []);
  const careerHighs = careerHighsFromIndex(index);
  const names: Record<string, string> = {};
  for (const p of index) names[p.id] = p.nameKo;
  const today = kstDate(now);
  const ctx = { seasonCode, teamShort };
  const current = seasonFiles.find((s) => s.seasonCode === seasonCode);
  const birthdayOf = new Map(index.map((e) => [e.id, e.birthday ?? null]));
  const birthdayPlayers = (current?.players ?? []).map((p) => ({
    id: p.playerNo,
    nameKo: p.nameKo,
    birthday: birthdayOf.get(p.playerNo) ?? null,
    teamShort: teamShort[p.teamCode] ?? p.teamName,
  }));
  const seen = await readJson<AwardSeenState>(join(process.cwd(), "data", "award-first-seen.json"), {});
  // 대기록에 맥락 꼬리표 (2026-10-16, lib/feat-context) — 알림함 소식 아래 한 줄
  const base = attachFeatContexts(mergeLeagueRecords(buildNotifItems(games.games, { seasonCode, teamShort, careerHighs, careerSums }), games.games, ctx), {
    performances: performancesFromGames(games.games),
    careerHighs,
    careerSums: careerSums as unknown as Record<string, Record<string, number>>,
    domestic: domesticFromIndex(index),
  });
  feed.items = sortNotifs([
    ...base,
    ...teamStreakItems(games.games, ctx),
    ...teamRankItems(games.games, ctx),
    ...teamPreviewItems(games.games, ctx, today),
    ...leaderRankItems(games.games, ctx),
    ...alltimeRankItems(games.games, { careerSums, names }),
    ...birthdayItems(birthdayPlayers, today, seasonCode),
    ...awardItems(seenAwards(seasonFiles, seen), today),
  ]);
  return feed;
}
