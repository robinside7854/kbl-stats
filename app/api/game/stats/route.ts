// 54-0 플레이 수·최고 기록 (공개, 2026-11-08): GET → GamePlayStats. DB 가 없으면 null.
// 게임 화면을 열 때마다 부르므로 Vercel 이 1분 동안 같은 응답을 나눠 준다(s-maxage) — DB 는 1분에 한 번꼴.
import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { gamePlayStats } from "@/lib/server/members";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  if (!db) return NextResponse.json(null, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(await gamePlayStats(db), {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
  });
}
