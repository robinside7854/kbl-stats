// 54-0 한 판 세기 (로그인 없이, 2026-11-08): POST { lineup, pid } → 서버가 라인업으로 승수를 다시 계산해 세고 최신 집계를 돌려준다.
// pid = 브라우저 무작위 번호(그 주 사람 수만 센다, 누구인지 알 수 없다). 보낸 승수는 받지 않는다.
import { validLineupParam, validPlayId } from "@/lib/account";
import { recheckLineup } from "@/lib/game";
import { badWriteRequest, json, readJson } from "@/lib/server/api";
import { getDb } from "@/lib/server/db";
import { loadGamePool } from "@/lib/server/game-pool";
import { gamePlayStats, recordGamePlay } from "@/lib/server/members";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const bad = badWriteRequest(req);
  if (bad) return bad;
  const body = (await readJson(req)) as { lineup?: unknown; pid?: unknown } | null;
  if (!body || !validLineupParam(body.lineup) || !validPlayId(body.pid)) return json({ error: "bad_request" }, 400);
  const db = await getDb();
  if (!db) return json({ error: "unavailable" }, 503);
  const pool = await loadGamePool(new URL(req.url).origin);
  if (!pool) return json({ error: "unavailable" }, 503);
  const re = recheckLineup(pool, body.lineup);
  if (!re) return json({ error: "bad_request" }, 400);
  await recordGamePlay(db, re.wins, body.pid);
  return json({ wins: re.wins, stats: await gamePlayStats(db) });
}
