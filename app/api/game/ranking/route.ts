// 54-0 주간 순위 (공개, 2026-10-05): GET ?week=this|last → GameRanking
// 누구나 보는 화면이라 Vercel 이 1분 동안 같은 응답을 나눠 준다(s-maxage) — DB 는 1분에 한 번꼴로만 읽는다.
import { NextResponse } from "next/server";
import { parseRankingWeek, kstWeekStart, type GameRanking } from "@/lib/account";
import { getDb } from "@/lib/server/db";
import { weeklyGameRanking } from "@/lib/server/members";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const week = parseRankingWeek(new URL(req.url).searchParams.get("week"));
  const db = await getDb();
  if (!db) {
    const now = new Date();
    const empty: GameRanking = {
      week,
      from: kstWeekStart(now, week === "last" ? -1 : 0).toISOString(),
      to: kstWeekStart(now, week === "last" ? 0 : 1).toISOString(),
      rows: [],
      members: 0,
    };
    return NextResponse.json(empty, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(await weeklyGameRanking(db, week), {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
  });
}
