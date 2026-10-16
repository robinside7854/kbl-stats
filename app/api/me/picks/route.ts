// 내 승부 예측 (2026-10-16): GET → MyPicks { picks: {gmkey: "home"|"away"}, hits, total } (이번 시즌)
// POST { gmkey, side } → 경기 시작 전까지만 (마감은 서버 시각 + 우리 정적 파일의 경기 시작 시각으로 판정, 지나면 409 locked)
import { isGmkey, isPickOpen, parsePickSide, settledGames } from "@/lib/votes";
import { badWriteRequest, json, readJson } from "@/lib/server/api";
import { currentLoginId } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { loadVoteData, seasonPrefix } from "@/lib/server/vote-data";
import { myPicks, setPick } from "@/lib/server/votes";

export const dynamic = "force-dynamic";

async function context(req: Request) {
  const id = await currentLoginId();
  if (!id) return { error: json({ error: "signed_out" }, 401) } as const;
  const db = await getDb();
  if (!db) return { error: json({ error: "unavailable" }, 503) } as const;
  const data = await loadVoteData(new URL(req.url).origin);
  if (!data) return { error: json({ error: "unavailable" }, 503) } as const;
  return { id, db, data } as const;
}

export async function GET(req: Request) {
  const c = await context(req);
  if ("error" in c) return c.error;
  return json(await myPicks(c.db, c.id, seasonPrefix(c.data), settledGames(c.data.games)));
}

export async function POST(req: Request) {
  const bad = badWriteRequest(req);
  if (bad) return bad;
  const c = await context(req);
  if ("error" in c) return c.error;
  const body = (await readJson(req)) as { gmkey?: unknown; side?: unknown } | null;
  const side = parsePickSide(body?.side);
  if (!side || !isGmkey(body?.gmkey)) return json({ error: "bad_request" }, 400);
  const game = c.data.games.find((g) => g.gmkey === body!.gmkey);
  if (!game) return json({ error: "bad_request" }, 400);
  if (!isPickOpen(game, new Date())) return json({ error: "locked", message: "경기가 시작돼서 예측이 마감됐어요." }, 409);
  await setPick(c.db, c.id, game.gmkey, side);
  return json({ gmkey: game.gmkey, side });
}
