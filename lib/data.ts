// 빌드 시점(서버)에서 data/processed/*.json 을 읽는 함수들.
// KBL API는 모른다 — 수집 결과 파일만 안다 (CLAUDE.md 원칙 1).
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { CardPlayer, SeasonData, SeasonOption } from "./types";

const PROCESSED_DIR = path.join(process.cwd(), "data", "processed");

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(PROCESSED_DIR, file), "utf8")) as T;
}

// 빌드 중 같은 파일을 여러 번 읽지 않도록 메모리에 캐시
const cache = new Map<number, SeasonData | null>();

export function loadSeasonData(seasonCode: number): SeasonData | null {
  if (cache.has(seasonCode)) return cache.get(seasonCode)!;
  const data = readSeasonFile(seasonCode);
  cache.set(seasonCode, data);
  return data;
}

function readSeasonFile(seasonCode: number): SeasonData | null {
  const file = path.join(String(seasonCode), "players.json");
  if (!fs.existsSync(path.join(PROCESSED_DIR, file))) return null;
  return readJson<SeasonData>(file);
}

/** 선수가 1명 이상 있는 시즌만, 최신 시즌이 먼저 오도록 정렬 (개막 전 시즌은 숨김) */
export function listSeasonsWithPlayers(): SeasonOption[] {
  const seasons = readJson<SeasonOption[]>("seasons.json");
  return seasons
    .filter((s) => (loadSeasonData(s.seasonCode)?.players.length ?? 0) > 0)
    .sort((a, b) => b.seasonCode - a.seasonCode);
}

/** 화면에 넘길 최소 필드만 추린다 */
export function toCardPlayers(season: SeasonData): CardPlayer[] {
  return season.players.map((p) => ({
    id: p.playerNo,
    nameKo: p.nameKo,
    nameEn: p.nameEn,
    teamName: p.teamName,
    teamShort: p.teamShort,
    isForeign: p.isForeign,
    games: p.games,
    minutes: p.minutes,
    points: p.points,
    reb: p.reb,
    ast: p.ast,
    per: p.per,
    usgPct: p.usgPct,
    tsPct: p.tsPct,
    astPct: p.astPct,
    rebPct: p.rebPct,
    pie: p.pie,
  }));
}
