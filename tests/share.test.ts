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

console.log("share: 통과");
