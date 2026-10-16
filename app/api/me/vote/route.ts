// 내 팬 MVP 표 (2026-10-16): GET → { votes: {주: 선수 번호} } (이번 주·지난주) · POST { playerNo } → 이번 주 표(바꾸기 포함)
// 후보인지는 우리 정적 파일(/vote/data.json — 그 주 박스스코어로 만든 후보)로 서버가 다시 본다. 주는 서버 시각으로 정한다(보낸 값을 믿지 않음).
import { voteWeekKey, isVoteCandidate } from "@/lib/votes";
import { badWriteRequest, json, readJson } from "@/lib/server/api";
import { currentLoginId } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { loadVoteData } from "@/lib/server/vote-data";
import { castVote, myVotes } from "@/lib/server/votes";

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
  const now = new Date();
  return json({ votes: await myVotes(c.db, c.id, [voteWeekKey(now), voteWeekKey(now, -1)]) });
}

export async function POST(req: Request) {
  const bad = badWriteRequest(req);
  if (bad) return bad;
  const c = await context();
  if ("error" in c) return c.error;
  const body = (await readJson(req)) as { playerNo?: unknown } | null;
  const week = voteWeekKey(new Date());
  const data = await loadVoteData(new URL(req.url).origin);
  if (!data) return json({ error: "unavailable" }, 503);
  if (!data.weeks.some((w) => w.week === week)) return json({ error: "no_candidates", message: "이번 주 후보가 아직 없어요. 첫 경기가 끝나면 열려요." }, 409);
  if (!isVoteCandidate(data.weeks, week, body?.playerNo)) return json({ error: "bad_request", message: "이번 주 후보가 아니에요." }, 400);
  await castVote(c.db, c.id, week, body!.playerNo as string);
  return json({ week, playerNo: body!.playerNo });
}
