// 좋아요 수 (공개, 2026-10-04): GET → { players: {선수번호: 수}, teams: {팀코드: 수}, fans: {팀코드: 응원팀으로 고른 회원 수} }
// 모든 선수·팀 페이지가 부르므로 Vercel 이 1분 동안 같은 응답을 나눠 준다(s-maxage) — DB 는 1분에 한 번꼴로만 읽는다.
import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { likeCounts } from "@/lib/server/members";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  if (!db) return NextResponse.json({ players: {}, teams: {}, fans: {} }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(await likeCounts(db), {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
  });
}
