// 폰 푸시 알림 보내기 (2026-10-08 알림 2단계) — 매일 수집·가공 뒤 GitHub Actions(fetch.yml)가 부른다.
// 알림함과 같은 목록(scripts/notif-feed.ts) → 회원마다 즐겨찾기 선수·응원팀 새 소식(lib/push pickPushItems) → 기기마다 알림 하나(composePush).
// 필요한 Secrets: DATABASE_URL(Neon — Vercel 과 같은 값), VAPID_PRIVATE_KEY. 공개 키는 data/codes/site.json pushPublicKey.
// 둘 중 하나라도 없으면 아무것도 안 하고 끝난다(수집을 막지 않는다). 실패도 경고만.
import { neon } from "@neondatabase/serverless";
import webpush from "web-push";
import site from "../data/codes/site.json";
import { composePush, pickPushItems, pushPublicKey } from "../lib/push.js";
import { ensureSchema, markPushSent, prunePushSent, pushTargets, removePushEndpoint, type Query } from "../lib/server/members.js";
import { buildNotifFeed } from "./notif-feed.js";

async function main() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const publicKey = pushPublicKey();
  if (!url || !privateKey || !publicKey) {
    console.log("폰 알림: 설정 없음(DATABASE_URL·VAPID_PRIVATE_KEY) — 건너뜀");
    return;
  }
  webpush.setVapidDetails(site.siteUrl, publicKey, privateKey);
  const sql = neon(url);
  const q: Query = (text, params) => sql.query(text, params ?? []) as Promise<Record<string, unknown>[]>;
  await ensureSchema(q);

  const feed = await buildNotifFeed();
  const targets = await pushTargets(q);
  let sent = 0;
  let gone = 0;
  let failed = 0;
  for (const t of targets) {
    const items = pickPushItems(feed.items, t);
    const payload = composePush(items);
    if (!payload) continue;
    let delivered = false;
    for (const s of t.subscriptions) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
        delivered = true;
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await removePushEndpoint(q, s.endpoint);
          gone++;
        } else {
          failed++;
          console.warn(`폰 알림 실패 (${code ?? "?"})`);
        }
      }
    }
    // 한 기기라도 받았으면 보낸 것으로 (다음 수집 때 같은 소식을 다시 보내지 않게)
    if (delivered) await markPushSent(q, t.memberId, items.map((it) => it.id));
  }
  await prunePushSent(q);
  console.log(`폰 알림: 회원 ${targets.length}명 · 보냄 ${sent} · 없어진 기기 ${gone} · 실패 ${failed}`);
}

main().catch((e) => {
  console.warn("폰 알림 보내기 실패 (수집에는 영향 없음):", e);
});
