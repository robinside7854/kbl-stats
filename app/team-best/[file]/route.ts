// 팀 올타임 베스트 5 후보 파일 (2026-10-16 "우리만의 기능"): /team-best/{팀코드}.json — 이 팀에서 30경기 이상 뛴 선수와 이 팀 최고 시즌.
// 팀 페이지에는 넣지 않고(팀마다 후보 40~140명, 약 10~35KB) "베스트 5 만들기"를 누르거나 공유 주소(?best=)로 열 때만 받는다.
// 빌드 때 전부 미리 만드는 정적 파일 (force-static + generateStaticParams) — 방문 때 서버 계산 없음.
import { loadFranchises } from "@/lib/data";
import { loadTeamBest } from "@/lib/data-career-extra";
import type { TeamBestFile } from "@/lib/team-best";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [...loadFranchises().keys()].map((teamCode) => ({ file: `${teamCode}.json` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const teamCode = file.replace(/\.json$/, "");
  if (!/^\d+$/.test(teamCode)) return new Response("Not found", { status: 404 });
  const body: TeamBestFile = { teamCode, candidates: loadTeamBest(teamCode) };
  return Response.json(body);
}
