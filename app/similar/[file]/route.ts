// 선수별 비슷한 시즌 파일 (2026-10-14 선수 페이지 결과물 줄이기): /similar/{선수번호}.json — 시즌 코드 → 비슷한 시즌 5개.
// 선수 페이지에는 처음 보이는 시즌 목록만 넣고(전에는 모든 시즌 목록이 페이지마다 두 번씩 들어갔다), 시즌을 바꾸면 이 파일을 한 번 받는다.
// 빌드 때 전부 미리 만들어 두는 정적 파일이다(force-static + generateStaticParams) — 방문 때 서버 계산 없음.
import { loadPlayersIndex, loadSimilarPlayers } from "@/lib/data";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return loadPlayersIndex().map((e) => ({ file: `${e.id}.json` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const id = file.replace(/\.json$/, "");
  if (!/^\d+$/.test(id)) return new Response("Not found", { status: 404 });
  return Response.json(loadSimilarPlayers(id));
}
