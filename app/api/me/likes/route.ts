// 내 좋아요 켜기·끄기 (2026-10-04): PUT { kind: "player"|"team", target: "번호", liked: true|false } → 내 좋아요 목록
import { validLikeTarget } from "@/lib/account";
import { badWriteRequest, json, readJson } from "@/lib/server/api";
import { currentLoginId } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { setLike } from "@/lib/server/members";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const bad = badWriteRequest(req);
  if (bad) return bad;
  const id = await currentLoginId();
  if (!id) return json({ error: "signed_out" }, 401);
  const db = await getDb();
  if (!db) return json({ error: "unavailable" }, 503);
  const body = (await readJson(req)) as { kind?: unknown; target?: unknown; liked?: unknown } | null;
  if (!body || typeof body.liked !== "boolean" || !validLikeTarget(body.kind, body.target)) return json({ error: "bad_request" }, 400);
  const r = await setLike(db, id, body.kind, body.target as string, body.liked);
  if (!r.ok) return json({ error: "limit", message: "좋아요는 500개까지 누를 수 있어요." }, 409);
  return json({ likes: r.likes });
}
