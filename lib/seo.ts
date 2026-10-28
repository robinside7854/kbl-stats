// 검색 엔진 안내 (2026-10-27 GA4 검토: 구글 유입 42세션뿐, sitemap·robots 가 없었다) — 순수 함수만.
// sitemap.xml = "우리 사이트에 이런 주소들이 있다" 목록, robots.txt = 검색 로봇이 들어오면 안 되는 곳.
// 재료(선수 번호·팀·시즌·글 목록)는 app/sitemap.ts 가 lib/data 에서 읽어 넘긴다.
import type { MetadataRoute } from "next";

/** 검색에 나올 필요가 없는 개인·관리 화면 (페이지에도 noindex 가 있다) — robots 에서 막는다 */
export const PRIVATE_PATHS = ["/api/", "/me", "/admin", "/notifications", "/favorites"] as const;

/** 늘 있는 화면 (주소, 우선순위) — 메뉴·기록 탭 */
const FIXED_PAGES: [string, number][] = [
  ["/", 1],
  ["/players", 0.9],
  ["/teams", 0.8],
  ["/records", 0.8],
  ["/records/game", 0.7],
  ["/records/season", 0.7],
  ["/records/awards", 0.7],
  ["/records/clutch", 0.6],
  ["/records/draft", 0.6],
  ["/records/trends", 0.5],
  ["/records/foreign", 0.5],
  ["/game", 0.8],
  ["/game/ranking", 0.5],
  ["/compare", 0.5],
  ["/glossary", 0.4],
  ["/updates", 0.4],
  ["/privacy", 0.1],
];

export interface SitemapInput {
  /** 사이트 절대 주소 (site.json siteUrl, 끝 / 없이) */
  siteUrl: string;
  playerNos: string[];
  teamCodes: string[];
  /** 선수가 있는 시즌 코드 */
  seasonCodes: number[];
  /** 진행 중 시즌 (매일 바뀌는 쪽) */
  ongoingSeason: number | null;
  updateSlugs: string[];
  /** 기록이 들어온 마지막 날 "2026-10-26" — 매일 바뀌는 화면의 고친 날 */
  asOf: string | null;
}

export function buildSitemap(input: SitemapInput): MetadataRoute.Sitemap {
  const base = input.siteUrl.replace(/\/+$/, "");
  const fresh = input.asOf ? new Date(`${input.asOf}T00:00:00+09:00`) : undefined;
  const entry = (path: string, priority: number, changing: boolean): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path}`,
    ...(changing && fresh ? { lastModified: fresh } : {}),
    changeFrequency: changing ? "daily" : "monthly",
    priority,
  });
  const fixed = FIXED_PAGES.map(([path, p]) => entry(path, p, p >= 0.7));
  const seasons = input.seasonCodes.flatMap((code) => {
    const now = code === input.ongoingSeason;
    return [entry(`/season/${code}/leaders`, now ? 0.8 : 0.5, now), entry(`/season/${code}/schedule`, now ? 0.7 : 0.3, now)];
  });
  const teams = input.teamCodes.map((code) => entry(`/team/${encodeURIComponent(code)}`, 0.7, true));
  // 선수는 은퇴 선수까지 전부 — 옛 선수 이름으로 검색해 들어오는 길이 가장 크다
  const players = input.playerNos.map((no) => entry(`/player/${encodeURIComponent(no)}`, 0.6, false));
  const posts = input.updateSlugs.map((slug) => entry(`/updates/${encodeURIComponent(slug)}`, 0.2, false));
  return [...fixed, ...seasons, ...teams, ...players, ...posts];
}

export function buildRobots(siteUrl: string): MetadataRoute.Robots {
  const base = siteUrl.replace(/\/+$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

/** 검색 관리 도구 소유 확인 값 (site.json searchVerification) → layout metadata.verification. 빈 값은 넣지 않는다 */
export function verificationMeta(v: { google?: string; naver?: string } | undefined): { google?: string; other?: Record<string, string> } | undefined {
  const google = v?.google?.trim();
  const naver = v?.naver?.trim();
  if (!google && !naver) return undefined;
  return { ...(google ? { google } : {}), ...(naver ? { other: { "naver-site-verification": naver } } : {}) };
}
