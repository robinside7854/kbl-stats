// 시즌 승부 예측 순위 (공개, 2026-10-16): GET → PickRanking (닉네임 회원, 채점된 경기 10개 이상, 적중 수 → 적중률, 상위 50)
// 채점은 우리 정적 파일(/vote/data.json)의 끝난 경기 승패로. Vercel 이 1분 동안 같은 응답을 나눠 준다.
import { NextResponse } from "next/server";
import { PICK_RANKING_MIN, settledGames, type PickRanking } from "@/lib/votes";
import { getDb } from "@/lib/server/db";
import { loadVoteData } from "@/lib/server/vote-data";
import { pickRanking } from "@/lib/server/votes";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const db = await getDb();
  const data = db ? await loadVoteData(new URL(req.url).origin) : null;
  if (!db || !data) {
    const empty: PickRanking = { rows: [], members: 0, minPicks: PICK_RANKING_MIN };
    return NextResponse.json(empty, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(await pickRanking(db, settledGames(data.games)), {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
  });
}
