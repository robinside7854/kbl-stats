// 이번 주 팬 MVP 표 수 (공개, 2026-10-16): GET → { this: VoteTally, last: VoteTally } (주 = 한국 시간 월~일, 서버 시각 기준)
// 누구나 보는 화면이라 Vercel 이 1분 동안 같은 응답을 나눠 준다(s-maxage) — DB 는 1분에 한 번꼴로만 읽는다.
import { NextResponse } from "next/server";
import { voteWeekKey, type VoteTally } from "@/lib/votes";
import { getDb } from "@/lib/server/db";
import { voteTallies } from "@/lib/server/votes";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const weeks = [voteWeekKey(now), voteWeekKey(now, -1)];
  const db = await getDb();
  if (!db) {
    const empty = (week: string): VoteTally => ({ week, counts: {}, total: 0 });
    return NextResponse.json({ this: empty(weeks[0]), last: empty(weeks[1]) }, { headers: { "Cache-Control": "no-store" } });
  }
  const [cur, last] = await voteTallies(db, weeks);
  return NextResponse.json(
    { this: cur, last },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" } },
  );
}
