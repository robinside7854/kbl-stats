// 54-0 내 배지 (2026-11-09): GET 받은 배지·판 수 · POST { lineup, stage } 한 판 결과(서버가 라인업으로 다시 판정) · PUT { earned, plays } 이 브라우저 기록 합치기
// stage: "season" = 정규리그가 끝났을 때(판 수 +1) / "playoff" = 플레이오프를 끝까지 봤을 때 — 보낸 배지 이름은 믿지 않고 서버가 다시 판정한다.
import teamLineage from "@/data/codes/team-lineage.json";
import { validLineupParam } from "@/lib/account";
import { decodeLineupParam, findCandidateTeam, simulateSeason } from "@/lib/game";
import { parseBadgeState, playoffBadges, seasonBadges, type BadgeGameInput } from "@/lib/game-badges";
import { simulatePlayoffs } from "@/lib/game-playoffs";
import { badWriteRequest, json, readJson } from "@/lib/server/api";
import { currentLoginId } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { loadGamePool } from "@/lib/server/game-pool";
import { memberBadgeState, mergeMemberBadges, recordMemberBadges } from "@/lib/server/members";

export const dynamic = "force-dynamic";

const successor = (teamLineage as { successor: Record<string, string> }).successor;

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
  return json(await memberBadgeState(c.db, c.id));
}

export async function POST(req: Request) {
  const bad = badWriteRequest(req);
  if (bad) return bad;
  const c = await context();
  if ("error" in c) return c.error;
  const body = (await readJson(req)) as { lineup?: unknown; stage?: unknown } | null;
  if (!body || !validLineupParam(body.lineup) || (body.stage !== "season" && body.stage !== "playoff")) return json({ error: "bad_request" }, 400);
  const pool = await loadGamePool(new URL(req.url).origin);
  if (!pool) return json({ error: "unavailable" }, 503);
  const players = decodeLineupParam(pool, body.lineup);
  if (!players) return json({ error: "bad_request" }, 400);
  const wins = simulateSeason(players).wins;
  const input: BadgeGameInput = { players, teamCodes: players.map((p) => findCandidateTeam(pool, p)?.teamCode ?? ""), wins, successor };
  if (body.stage === "season") return json(await recordMemberBadges(c.db, c.id, seasonBadges(input), true));
  const before = await memberBadgeState(c.db, c.id);
  const keys = playoffBadges(input, simulatePlayoffs(players, wins), !before.earned.first_ring);
  return json(await recordMemberBadges(c.db, c.id, keys, false));
}

export async function PUT(req: Request) {
  const bad = badWriteRequest(req);
  if (bad) return bad;
  const c = await context();
  if ("error" in c) return c.error;
  return json(await mergeMemberBadges(c.db, c.id, parseBadgeState(await readJson(req))));
}
