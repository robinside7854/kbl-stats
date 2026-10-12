// 역대 기록 목록 파일 (2026-10-12 호출·속도 정리 3번): /records/data/{game|season}/{목록}.json — 한 경기 최다·한 시즌 최다 페이지가
// 처음 보이는 목록만 HTML 에 넣고, 다른 부문·구분·단위를 고르면 여기서 그 목록 하나만 받는다(lib/records pickRecordList·recordListUrl).
// 빌드 때 전부 미리 만들어 두는 정적 파일이다(force-static + generateStaticParams) — 방문 때 서버 계산 없음.
import { loadGameHighLists, loadSeasonBestLists } from "@/lib/data";
import { pickRecordList, recordListKeyFromSlug, recordListSlug, type RecordTab } from "@/lib/records";

export const dynamic = "force-static";
export const dynamicParams = false;

const loaders: Record<RecordTab, () => ReturnType<typeof loadGameHighLists>> = {
  game: loadGameHighLists,
  season: loadSeasonBestLists,
};

export function generateStaticParams() {
  return (Object.keys(loaders) as RecordTab[]).flatMap((tab) =>
    Object.keys(loaders[tab]().lists).map((key) => ({ tab, key: `${recordListSlug(key)}.json` })),
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ tab: string; key: string }> }) {
  const { tab, key } = await params;
  const load = loaders[tab as RecordTab];
  if (!load) return new Response("Not found", { status: 404 });
  const data = load();
  const listKey = recordListKeyFromSlug(key);
  if (!data.lists[listKey]) return new Response("Not found", { status: 404 });
  return Response.json(pickRecordList(data, listKey));
}
