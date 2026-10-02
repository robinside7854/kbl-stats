// 숏폼 에피소드 빌더 공용 (build-short-milestones · build-short-quiz) — data/processed·raw 를 읽기만 한다(원칙 1).
import fs from "node:fs";
import path from "node:path";
import type { SeasonData } from "../lib/types";
import { captionChunks, toSpeech } from "../lib/shorts";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const PROCESSED = path.join(ROOT, "data", "processed");

export function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

/** 선수가 있는 시즌 파일 (오래된 순) */
export function loadSeasons(): SeasonData[] {
  const list = readJson<{ seasonCode: number }[]>(path.join(PROCESSED, "seasons.json"));
  return list
    .map((s) => path.join(PROCESSED, String(s.seasonCode), "players.json"))
    .filter((f) => fs.existsSync(f))
    .map((f) => readJson<SeasonData>(f))
    .filter((s) => s.players.length > 0)
    .sort((a, b) => a.seasonCode - b.seasonCode);
}

type MasterRow = { playerNo: string; kname: string; teamCode: string };
function masterRows(file: string): MasterRow[] | null {
  if (!fs.existsSync(file)) return null;
  const pages = readJson<unknown[]>(file);
  return pages.flatMap((pg) => ((typeof pg === "string" ? JSON.parse(pg) : pg) as { playerList?: MasterRow[] }).playerList ?? []);
}
/** 선수 마스터(전체, 지금 소속 팀) */
export const loadMaster = () => masterRows(path.join(ROOT, "data", "raw", "players", "players.json")) ?? [];
/** 현역 등록 명단(regSc=Y) — Actions 에서 scripts/fetch-active.ts 가 받은 것. 없으면 null */
export const loadActive = () => masterRows(path.join(ROOT, "data", "raw", "players", "active.json"));

export interface TeamInfo {
  code: string;
  name: string;
  color: string;
  secondary: string;
  logoUrl: string | null;
}
/** 팀 코드 → 가장 최근 시즌의 이름·색·로고 */
export function teamDirectory(seasons: readonly SeasonData[]): Map<string, TeamInfo> {
  const out = new Map<string, TeamInfo>();
  for (const s of seasons) {
    for (const t of s.teams) {
      out.set(t.teamCode, {
        code: t.teamCode,
        name: t.shortNameKo ?? t.teamCode,
        color: t.color?.primary ?? "#6B7280",
        secondary: t.color?.secondary ?? "#9CA3AF",
        logoUrl: t.logoUrl ?? null,
      });
    }
  }
  return out;
}

export function photoDirectory(): Map<string, string | null> {
  const index = readJson<{ id: string; photoUrl: string | null }[]>(path.join(PROCESSED, "players-index.json"));
  return new Map(index.map((p) => [p.id, p.photoUrl]));
}

/** 장면에 읽는 말·자막 조각을 붙인다 */
export const withSpeech = <T extends { caption: string }>(s: T) => ({ ...s, speech: toSpeech(s.caption), chunks: captionChunks(s.caption) });

export interface UploadCopy {
  title: string;
  description: string;
  casual: { title: string; description: string };
  tags: string[];
}

export function writeEpisode(slug: string, episode: Record<string, unknown> & UploadCopy) {
  const dir = path.join(ROOT, "shorts", "episodes", slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "episode.json"), JSON.stringify(episode, null, 2) + "\n");
  const u = episode;
  fs.writeFileSync(
    path.join(dir, "upload.txt"),
    [
      "===== 캐주얼 =====", "[제목]", u.casual.title, "", "[설명]", u.casual.description, "",
      "===== 정리형 =====", "[제목]", u.title, "", "[설명]", u.description, "",
      "[태그 — 공통]", u.tags.join(", "), "",
    ].join("\n"),
  );
  console.log(`에피소드 저장: shorts/episodes/${slug}/episode.json`);
}

export const FOOTER = [
  "기록: KBL 공식 홈페이지 · 사진 © KBL 및 각 구단 · 비영리 팬 채널",
  "더 많은 기록: https://kbl-stats-reference.vercel.app",
];
