// 폰 푸시 알림 구독 (2026-10-08): POST { subscription } 이 기기 켜기 · DELETE { endpoint } 끄기. 로그인 회원만.
// 보내기는 여기서 하지 않는다 — 매일 수집 뒤 GitHub Actions(scripts/send-push.ts)가 보낸다.
import { parsePushSubscription } from "@/lib/push";
import { badWriteRequest, json, readJson } from "@/lib/server/api";
import { currentLoginId } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { deletePushSubscription, savePushSubscription } from "@/lib/server/members";

export const dynamic = "force-dynamic";

async function context(req: Request) {
  const bad = badWriteRequest(req);
  if (bad) return { error: bad } as const;
  const id = await currentLoginId();
  if (!id) return { error: json({ error: "signed_out" }, 401) } as const;
  const db = await getDb();
  if (!db) return { error: json({ error: "unavailable" }, 503) } as const;
  return { id, db } as const;
}

export async function POST(req: Request) {
  const c = await context(req);
  if ("error" in c) return c.error;
  const body = (await readJson(req)) as { subscription?: unknown } | null;
  const sub = parsePushSubscription(body?.subscription);
  if (!sub) return json({ error: "bad_request" }, 400);
  await savePushSubscription(c.db, c.id, sub);
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  const c = await context(req);
  if ("error" in c) return c.error;
  const body = (await readJson(req)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string") return json({ error: "bad_request" }, 400);
  await deletePushSubscription(c.db, c.id, body.endpoint);
  return json({ ok: true });
}
