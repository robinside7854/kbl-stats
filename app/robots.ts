// /robots.txt — 검색 로봇 안내 (2026-10-27, 규칙은 lib/seo): 개인·관리 화면은 막고 sitemap 위치를 알려 준다
import type { MetadataRoute } from "next";
import { buildRobots } from "@/lib/seo";
import { SITE_URL } from "@/lib/share";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return buildRobots(SITE_URL);
}
