// 54-0 내 기록 (2026-10-04): GET 최근 기록·요약 · POST { lineup, wins, rating, bonuses, names } 저장 · DELETE ?lineup= 한 줄 지우기
import { validGameRecord, validLineupParam } from "@/lib/account";
import { badWriteRequest, json, readJson } from "@/lib/server/api";
import { currentLoginId } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { deleteGameRecord, gameHistory, saveGameRecord } from "@/lib/server/members";

export const dynamic = "force-dynamic";

async function context() {
  const id = await currentLoginId();
  if (!id) return { error: json({ error: "signed_out" }, 401) } as const;
  const db = await getDb();
  if (!db) return { error: json({ error: "unavailable" }, 503) } as const;
  return { id, db } as const;
}

export async function GET() {
  const c = await context();
  if ("error" in c) return c.error;
  return json(await gameHistory(c.db, c.id));
}

export async function POST(req: Request) {
  const bad = badWriteRequest(req);
  if (bad) return bad;
  const c = await context();
  if ("error" in c) return c.error;
  const rec = validGameRecord(await readJson(req));
  if (!rec) return json({ error: "bad_request" }, 400);
  await saveGameRecord(c.db, c.id, rec);
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  const bad = badWriteRequest(req);
  if (bad) return bad;
  const c = await context();
  if ("error" in c) return c.error;
  const lineup = new URL(req.url).searchParams.get("lineup");
  if (!validLineupParam(lineup)) return json({ error: "bad_request" }, 400);
  await deleteGameRecord(c.db, c.id, lineup);
  return json(await gameHistory(c.db, c.id));
}
