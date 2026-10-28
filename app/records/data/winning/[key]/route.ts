// 기록 탭 "클러치" 위닝샷 목록 파일 (2026-10-28): /records/data/winning/{구분_기간_shots}.json — 구분·기간을 고르면 그 목록 하나만 받는다.
// 빌드 때 전부 미리 만드는 정적 파일(force-static + generateStaticParams) — 방문 때 서버 계산 없음. 키 규칙은 lib/records clutchListKey.
import { loadWinningShotLists } from "@/lib/data";
import { recordListKeyFromSlug, recordListSlug } from "@/lib/records";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(loadWinningShotLists()).map((key) => ({ key: `${recordListSlug(key)}.json` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const list = loadWinningShotLists()[recordListKeyFromSlug(key)];
  return list ? Response.json(list) : new Response("Not found", { status: 404 });
}
