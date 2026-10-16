// 경기 승부 예측 수 (공개, 2026-10-16): GET → { seasonCode, counts: { gmkey: [홈, 원정] } } (이번 시즌, 예측이 있는 경기만)
// 경기 카드가 아직 안 한 경기를 보일 때 한 번 부른다. Vercel 이 1분 동안 같은 응답을 나눠 준다(s-maxage) — DB 는 1분에 한 번꼴로만.
import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { loadVoteData, seasonPrefix } from "@/lib/server/vote-data";
import { pickCounts } from "@/lib/server/votes";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const db = await getDb();
  const data = db ? await loadVoteData(new URL(req.url).origin) : null;
  if (!db || !data) return NextResponse.json({ seasonCode: 0, counts: {} }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(
    { seasonCode: data.seasonCode, counts: await pickCounts(db, seasonPrefix(data)) },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" } },
  );
}
