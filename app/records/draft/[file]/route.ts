// 드래프트 연도별 파일 (2026-10-16): /records/draft/{연도}.json — 드래프트 페이지는 처음 보이는 연도만 HTML 에 넣고,
// 다른 연도 칩을 누르면 여기서 그 해 하나만 받는다(lib/draft draftYearUrl). 빌드 때 전부 미리 만드는 정적 파일(방문 때 계산 없음).
import { loadDraftYear, loadDraftYears } from "@/lib/data-history";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return loadDraftYears().map((y) => ({ file: `${y}.json` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const m = /^(\d{4})\.json$/.exec(file);
  const data = m ? loadDraftYear(Number(m[1])) : null;
  if (!data) return new Response("Not found", { status: 404 });
  return Response.json(data);
}
