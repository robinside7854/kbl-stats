// 54-0 내 기록 (2026-10-04): GET 최근 기록·요약 · POST { lineup, wins, rating, bonuses, names } 저장 · DELETE ?lineup= 한 줄 지우기
// 2026-10-05 주간 순위: 저장 전에 서버가 라인업으로 성적을 다시 계산해 그 값으로 저장(verified) — 보낸 숫자를 믿지 않는다.
// 라인업이 풀 규칙에 안 맞으면 400, 풀을 못 받으면 보낸 값 그대로 저장하되 순위에는 안 올린다.
import { GAME_BONUS_KEYS, validGameRecord, validLineupParam } from "@/lib/account";
import { recheckLineup } from "@/lib/game";
import { loadGamePool } from "@/lib/server/game-pool";
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
  const pool = await loadGamePool(new URL(req.url).origin);
  if (pool) {
    const re = recheckLineup(pool, rec.lineup);
    if (!re) return json({ error: "bad_request" }, 400);
    const bonuses = GAME_BONUS_KEYS.filter((k) => re.bonuses.includes(k));
    await saveGameRecord(c.db, c.id, { lineup: rec.lineup, wins: re.wins, rating: re.rating, bonuses, names: re.names, verified: true });
    return json({ ok: true });
  }
  await saveGameRecord(c.db, c.id, { ...rec, verified: false });
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
