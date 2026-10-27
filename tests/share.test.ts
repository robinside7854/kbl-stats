// 공유 미리보기 규칙 검증 (2026-10-04): 페이지 메타 한 벌·이미지 경로·GA 화면 이름. 실행: npm run test:share
import assert from "node:assert/strict";
import { ogImagePath, OG_HEIGHT, OG_WIDTH, SITE_URL, shareMetadata, sharePageOf } from "../lib/share";

assert.match(SITE_URL, /^https:\/\//); // 카카오톡은 절대 https 주소의 이미지만 읽는다
const m = shareMetadata({ title: "이정현 · KBL 선수 기록", description: "설명", path: "/player/1", image: ogImagePath.player("1") });
const og = m.openGraph as { url: string; images: { url: string; width: number; height: number }[]; title: string; locale: string };
assert.equal(og.url, "/player/1");
assert.equal(og.title, "이정현 · KBL 선수 기록");
assert.equal(og.locale, "ko_KR");
assert.deepEqual([og.images[0].url, og.images[0].width, og.images[0].height], ["/og/player/1.png", OG_WIDTH, OG_HEIGHT]);
assert.equal((m.twitter as { card: string }).card, "summary_large_image");
// 이미지를 안 주면 사이트 기본 이미지
assert.equal((shareMetadata({ title: "t", description: "d", path: "/" }).openGraph as typeof og).images[0].url, ogImagePath.default());
assert.equal(ogImagePath.leaders(47), "/og/leaders/47.png");

assert.equal(sharePageOf("/"), "home");
assert.equal(sharePageOf("/player/290381"), "player");
assert.equal(sharePageOf("/season/47/leaders"), "leaders");
assert.equal(sharePageOf("/records/game"), "records");

// 검색 엔진 안내 (2026-10-27): sitemap·robots·소유 확인
import { buildRobots, buildSitemap, PRIVATE_PATHS, verificationMeta } from "../lib/seo";
const map = buildSitemap({ siteUrl: "https://x.app/", playerNos: ["290381", "1"], teamCodes: ["16"], seasonCodes: [49, 47], ongoingSeason: 49, updateSlugs: ["2026-10-27-a"], asOf: "2026-10-26" });
const urls = map.map((e) => e.url);
assert.ok(urls.includes("https://x.app/") && urls.includes("https://x.app/player/290381") && urls.includes("https://x.app/team/16"));
assert.ok(urls.includes("https://x.app/season/47/leaders") && urls.includes("https://x.app/updates/2026-10-27-a"));
assert.equal(new Set(urls).size, urls.length); // 겹치는 주소 없음
assert.ok(urls.every((u) => !PRIVATE_PATHS.some((p) => u.startsWith(`https://x.app${p}`)))); // 개인 화면은 목록에 없음
assert.equal(map.find((e) => e.url.endsWith("/season/49/leaders"))!.changeFrequency, "daily"); // 진행 중 시즌
assert.equal(map.find((e) => e.url.endsWith("/season/47/leaders"))!.changeFrequency, "monthly");
assert.ok(map.find((e) => e.url.endsWith("/season/49/leaders"))!.lastModified instanceof Date);
assert.equal(map.find((e) => e.url.endsWith("/season/47/leaders"))!.lastModified, undefined);
const robots = buildRobots("https://x.app");
assert.equal(robots.sitemap, "https://x.app/sitemap.xml");
assert.ok((robots.rules as { disallow: string[] }[])[0].disallow.includes("/me"));
assert.equal(verificationMeta({ google: "", naver: " " }), undefined);
assert.deepEqual(verificationMeta({ naver: "abc" }), { other: { "naver-site-verification": "abc" } });

console.log("share: 통과");
