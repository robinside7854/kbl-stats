// /sitemap.xml — 검색 엔진에 알려 줄 주소 목록 (2026-10-27, 규칙은 lib/seo). 빌드 때 한 번 만드는 정적 파일
import type { MetadataRoute } from "next";
import { buildSitemap } from "@/lib/seo";
import { SITE_URL } from "@/lib/share";
import { dataAsOfDate, isSeasonOngoing, listSeasonsWithPlayers, loadFranchises, loadPlayersIndex } from "@/lib/data";
import { UPDATE_POSTS } from "@/lib/updates";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const seasonCodes = listSeasonsWithPlayers().map((s) => s.seasonCode);
  return buildSitemap({
    siteUrl: SITE_URL,
    playerNos: loadPlayersIndex().map((e) => e.id),
    teamCodes: [...loadFranchises().keys()],
    seasonCodes,
    ongoingSeason: seasonCodes.find((code) => isSeasonOngoing(code)) ?? null,
    updateSlugs: UPDATE_POSTS.map((p) => p.slug),
    asOf: dataAsOfDate(),
  });
}
