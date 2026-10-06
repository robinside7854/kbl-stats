// 경기 하이라이트 영상 (2026-10-04 사용자 요청) — TVING SPORTS 유튜브 채널(KBL 중계사)의 경기별 하이라이트를 경기에 붙인다. 순수 함수만.
// 재료: 채널 RSS(키 없음, 최근 15개 — 야구·쇼츠가 섞임) → 매일 수집이 새 하이라이트가 있을 때만 data/raw/highlights/tving/{시각}.xml 로 쌓는다.
// 제목 형식(2026-10-04 RSS 로 확인): "[DB vs 소노] 10/4 경기 I 2026-27 KCC 프로농구 I 하이라이트 I TVING" — 앞이 홈 팀, 뒤가 원정 팀.
// 임베드 허용은 oEmbed 200 으로 확인(2026-10-04).
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SeasonGame } from "../lib/types.js";

export interface FeedEntry {
  videoId: string;
  title: string;
  /** ISO 시각 (RSS published) */
  published: string;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** 유튜브 RSS(Atom) → 영상 목록. 형식이 다르면 빈 배열 */
export function parseFeed(xml: string): FeedEntry[] {
  const out: FeedEntry[] = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const id = /<yt:videoId>([A-Za-z0-9_-]{6,20})<\/yt:videoId>/.exec(e)?.[1];
    const title = /<title>([\s\S]*?)<\/title>/.exec(e)?.[1];
    const published = /<published>([^<]+)<\/published>/.exec(e)?.[1];
    if (id && title && published) out.push({ videoId: id, title: decode(title.trim()), published });
  }
  return out;
}

export interface HighlightTitle {
  home: string;
  away: string;
  /** "2026-10-04" */
  date: string;
}

/**
 * 경기 하이라이트 제목 → 홈·원정 팀 이름과 경기 날짜. 프로농구 경기 하이라이트가 아니면(야구·쇼츠·모먼트) null.
 * 연도: 제목의 시즌("2026-27")에서 7월 이후 달은 앞 연도, 그 전 달은 뒤 연도. 시즌이 없으면 올린 날의 연도.
 */
export function parseHighlightTitle(title: string, published: string): HighlightTitle | null {
  if (!/프로농구/.test(title) || !/하이라이트/.test(title) || /shorts/i.test(title)) return null;
  const m = /^\s*\[\s*(.+?)\s+vs\s+(.+?)\s*\]\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*경기/.exec(title);
  if (!m) return null;
  const month = Number(m[3]);
  const day = Number(m[4]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const season = /(\d{4})\s*-\s*\d{2,4}/.exec(title.slice(m[0].length));
  let year: number;
  if (season) year = Number(season[1]) + (month >= 7 ? 0 : 1);
  else {
    const p = /^(\d{4})-(\d{2})/.exec(published);
    if (!p) return null;
    year = Number(p[1]) - (month > Number(p[2]) ? 1 : 0); // 1월에 올린 12월 경기
  }
  return { home: m[1].trim(), away: m[2].trim(), date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

const norm = (s: string) => s.replace(/\s+/g, "").toUpperCase();
/** 제목의 짧은 팀 이름("DB")이 경기 목록 팀 이름("원주 DB")에 맞는지 — 끝이 같으면 */
export const teamMatches = (full: string, short: string) => {
  const f = norm(full);
  const s = norm(short);
  return s.length > 0 && (f === s || f.endsWith(s));
};

/** 경기 → 하이라이트 영상 번호 (gmkey → videoId). 같은 경기 영상이 여럿이면 먼저 올라온 것. 홈·원정이 뒤바뀐 제목도 받는다 */
export function matchHighlights(games: readonly SeasonGame[], entries: readonly FeedEntry[]): Map<string, string> {
  const out = new Map<string, string>();
  const sorted = [...entries].sort((a, b) => a.published.localeCompare(b.published));
  for (const e of sorted) {
    const t = parseHighlightTitle(e.title, e.published);
    if (!t) continue;
    const g = games.find(
      (x) =>
        x.date === t.date &&
        ((teamMatches(x.home.name, t.home) && teamMatches(x.away.name, t.away)) ||
          (teamMatches(x.home.name, t.away) && teamMatches(x.away.name, t.home))),
    );
    if (g && !out.has(g.gmkey)) out.set(g.gmkey, e.videoId);
  }
  return out;
}

/** 이미 받아 둔 영상 번호에 없는 경기 하이라이트가 이번 RSS 에 있는지 (없으면 raw 를 새로 저장하지 않는다) */
export function hasNewHighlight(entries: readonly FeedEntry[], known: ReadonlySet<string>): boolean {
  return entries.some((e) => !known.has(e.videoId) && parseHighlightTitle(e.title, e.published) !== null);
}

/** 쌓아 둔 RSS raw 전부 → 영상 목록 (같은 영상은 한 번). fetch(새 영상 판단)·process(경기에 붙이기) 공용 */
export async function readSavedFeeds(dir: string): Promise<FeedEntry[]> {
  const seen = new Map<string, FeedEntry>();
  for (const f of (await readdir(dir).catch(() => [] as string[])).sort()) {
    if (!f.endsWith(".xml")) continue;
    for (const e of parseFeed(await readFile(join(dir, f), "utf8").catch(() => ""))) if (!seen.has(e.videoId)) seen.set(e.videoId, e);
  }
  return [...seen.values()];
}

/** 끝난 경기의 하이라이트를 며칠 동안 기다리나 — 이 기간이 지나도 없으면 더는 RSS 를 보지 않는다 (보통 2~10시간 뒤 올라옴) */
export const HIGHLIGHT_WAIT_DAYS = 3;

/**
 * 하이라이트를 아직 기다리는 경기: 끝났고, 영상이 안 붙었고, 경기 날짜가 오늘(한국 날짜 "YYYY-MM-DD")에서 HIGHLIGHT_WAIT_DAYS 일 안.
 * 매일 수집 사이 알람(scripts/highlight-watch.ts)이 이게 비었으면 유튜브에 요청하지 않는다.
 */
export function pendingHighlightGames<T extends { date: string; ended: boolean; highlight?: string }>(
  games: readonly T[],
  today: string,
  days = HIGHLIGHT_WAIT_DAYS,
): T[] {
  const from = new Date(`${today}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - days);
  const fromIso = from.toISOString().slice(0, 10);
  return games.filter((g) => g.ended && !g.highlight && g.date >= fromIso && g.date <= today);
}

/**
 * RSS 받기 — 주소 여러 개를 번갈아 최대 rounds 바퀴(사이 waitMs). 영상이 하나라도 읽히는 응답이면 그 XML, 끝까지 안 되면 마지막 오류를 던진다.
 * 유튜브 RSS 가 가끔 404 를 줘서(2026-10-06) 만든 것. fetch.ts(매일 수집)·highlight-watch.ts(알람) 공용
 */
export async function fetchHighlightFeed(urls: readonly string[], rounds = 3, waitMs = 5000): Promise<string> {
  let last = "응답 없음";
  for (let r = 0; r < rounds; r++) {
    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": "kbl-stats fan project (non-commercial; github.com/robinside7854/kbl-stats)" } });
        if (!res.ok) {
          last = `HTTP ${res.status}`;
        } else {
          const xml = await res.text();
          if (parseFeed(xml).length > 0) return xml;
          last = "RSS 형식이 다름 (영상 0개)";
        }
      } catch (e) {
        last = (e as Error).message;
      }
      await new Promise((ok) => setTimeout(ok, waitMs));
    }
  }
  throw new Error(`RSS ${urls.length}개 주소 × ${rounds}번 실패: ${last}`);
}
