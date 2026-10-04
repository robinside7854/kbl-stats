// 내 즐겨찾기 목록 통째로 저장 (PUT { favorites: ["선수번호", …] }) → 저장된 목록
import { sanitizeFavorites } from "@/lib/account";
import { badWriteRequest, json, readJson } from "@/lib/server/api";
import { currentMemberId } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { setFavorites } from "@/lib/server/members";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const bad = badWriteRequest(req);
  if (bad) return bad;
  const id = await currentMemberId();
  if (!id) return json({ error: "signed_out" }, 401);
  const db = await getDb();
  if (!db) return json({ error: "unavailable" }, 503);
  const body = (await readJson(req)) as { favorites?: unknown } | null;
  if (!body || !Array.isArray(body.favorites)) return json({ error: "bad_request" }, 400);
  return json({ favorites: await setFavorites(db, id, sanitizeFavorites(body.favorites)) });
}
