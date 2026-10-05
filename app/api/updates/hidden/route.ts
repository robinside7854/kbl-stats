// 업데이트 소식 삭제 (2026-10-05): GET 지운 글 번호(공개, Vercel 1분 캐시) · POST { slug, hidden } 관리자만 지우기·되돌리기.
// 글 자체는 코드(lib/updates)에 남는다 — 화면이 이 목록에 있는 글을 숨긴다.
import { NextResponse } from "next/server";
import { badWriteRequest, json, readJson } from "@/lib/server/api";
import { isAdmin } from "@/lib/server/admin";
import { currentLoginId } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { hiddenUpdates, setUpdateHidden } from "@/lib/server/members";
import { postBySlug } from "@/lib/updates";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  if (!db) return NextResponse.json({ hidden: [] }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ hidden: await hiddenUpdates(db) }, {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
  });
}

export async function POST(req: Request) {
  const bad = badWriteRequest(req);
  if (bad) return bad;
  const id = await currentLoginId();
  if (!id) return json({ error: "signed_out" }, 401);
  const db = await getDb();
  if (!db) return json({ error: "unavailable" }, 503);
  if (!(await isAdmin(db, id))) return json({ error: "forbidden" }, 403);
  const body = (await readJson(req)) as { slug?: unknown; hidden?: unknown } | null;
  if (!body || typeof body.slug !== "string" || typeof body.hidden !== "boolean" || !postBySlug(body.slug)) {
    return json({ error: "bad_request" }, 400);
  }
  return json({ hidden: await setUpdateHidden(db, body.slug, body.hidden) });
}
