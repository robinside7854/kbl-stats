// 업데이트 소식 글 목록·띠배너 규칙 (lib/updates.ts) — npm run test:updates
import { GLOSSARY_ANCHORS } from "../lib/glossary";
import assert from "node:assert/strict";
import { bannerPost, itemHref, itemText, latestPost, postBySlug, shouldShowBanner, sortedPosts, UPDATE_POSTS, type UpdatePost } from "../lib/updates";

// 글 번호: 겹치지 않고 주소에 쓸 수 있는 모양, 날짜 형식
const slugs = UPDATE_POSTS.map((p) => p.slug);
assert.equal(new Set(slugs).size, slugs.length, "글 번호가 겹친다");
for (const p of UPDATE_POSTS) {
  assert.match(p.slug, /^[a-z0-9-]+$/, p.slug);
  assert.match(p.date, /^\d{4}-\d{2}-\d{2}$/, p.date);
  assert.ok(p.title && p.summary && p.blocks.length > 0, p.slug);
  // 띠배너 한 줄이라 짧게
  assert.ok(p.summary.length <= 20, `${p.slug} summary 가 길다`);
}

// 새 글은 맨 위에: 파일 순서 = 날짜 내림차순
assert.deepEqual(sortedPosts().map((p) => p.slug), slugs, "새 글은 UPDATE_POSTS 맨 위에 더할 것");

// 글 말투 규칙: 긴 대시·느낌표 없음, 블록 글자 전부
const texts = UPDATE_POSTS.flatMap((p) => [
  p.title,
  p.summary,
  ...p.blocks.flatMap((b) => (b.kind === "p" || b.kind === "h" ? [b.text] : b.items.map(itemText))),
]);
for (const t of texts) {
  assert.ok(!/[—–]/.test(t), `긴 대시: ${t}`);
  assert.ok(!t.includes("!"), `느낌표: ${t}`);
}

// 사이트 안 링크는 있는 화면으로
const ROUTES = ["/", "/players", "/teams", "/records", "/game", "/game/ranking", "/likes", "/privacy", "/me", "/updates", "/glossary", "/notifications", "/favorites", "/records/draft", "/records/foreign", "/records/trends", "/compare"];
// 선수·팀·시즌 화면은 번호가 붙은 주소 모양으로 확인
const ROUTE_PATTERNS = [/^\/player\/\d+$/, /^\/team\/\d+$/, /^\/season\/\d+\/(leaders|schedule)$/];
for (const p of UPDATE_POSTS)
  for (const b of p.blocks) {
    if (b.kind !== "list" && b.kind !== "steps") continue;
    for (const it of b.items) {
      const href = itemHref(it);
      if (!href) continue;
      const anchor = href.startsWith("/glossary#") && Object.values(GLOSSARY_ANCHORS).includes(href.slice("/glossary#".length));
      const ok = ROUTES.includes(href) || ROUTE_PATTERNS.some((r) => r.test(href)) || anchor || (href.startsWith("/updates/") && !!postBySlug(href.slice("/updates/".length)));
      assert.ok(ok, `${p.slug}: 없는 주소 ${href}`);
    }
  }

// 정렬: 날짜 내림차순, 같은 날짜는 파일 순서
const mk = (slug: string, date: string): UpdatePost => ({ slug, date, kind: "update", title: slug, summary: slug, blocks: [{ kind: "p", text: "x" }] });
const sample = [mk("b", "2026-10-05"), mk("a", "2026-10-06"), mk("c", "2026-10-05")];
assert.deepEqual(sortedPosts(sample).map((p) => p.slug), ["a", "b", "c"]);
assert.equal(latestPost(sample)?.slug, "a");
assert.equal(latestPost([]), null);

// 띠배너: 닫은 글이면 숨김, 더 새 글이면 다시
assert.equal(shouldShowBanner("a", null), true);
assert.equal(shouldShowBanner("a", "a"), false);
assert.equal(shouldShowBanner("b", "a"), true);
assert.equal(shouldShowBanner(null, null), false);

// 관리자가 지운 글은 띠배너에서 건너뛴다
assert.equal(bannerPost([], null, sample)?.slug, "a");
assert.equal(bannerPost(["a"], null, sample)?.slug, "b");
assert.equal(bannerPost(["a"], "b", sample), null);
assert.equal(bannerPost(["a", "b", "c"], null, sample), null);

console.log("updates 테스트 통과");

// 쪽 나누기 (2026-10-08: 10개씩)
{
  const { paginate, parsePageParam, UPDATES_PER_PAGE, UPDATE_AUTHOR } = await import("../lib/updates");
  assert.equal(UPDATES_PER_PAGE, 10);
  assert.equal(UPDATE_AUTHOR, "로방");
  const list = Array.from({ length: 23 }, (_, i) => i);
  assert.deepEqual(paginate(list, 1), { items: list.slice(0, 10), page: 1, totalPages: 3 });
  assert.deepEqual(paginate(list, 3).items, [20, 21, 22]);
  assert.equal(paginate(list, 9).page, 3); // 넘치면 마지막 쪽
  assert.equal(paginate([], 1).totalPages, 1);
  assert.equal(parsePageParam("2"), 2);
  assert.equal(parsePageParam("0"), 1);
  assert.equal(parsePageParam("abc"), 1);
  assert.equal(parsePageParam(null), 1);
  console.log("updates: 쪽 나누기 통과");
}
