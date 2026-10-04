// 내 계정 (/me, 2026-10-04): 구글·네이버 로그인, 닉네임·응원팀, 즐겨찾기 계정 저장, 로그아웃·탈퇴. 헤더 계정 버튼으로 들어온다(메뉴 없음).
// 정적 페이지 — 로그인 상태는 브라우저가 /api/me 로 확인한다. 응원팀 목록 = 선수 기록이 있는 최신 시즌 + 직전 시즌의 팀.
import type { Metadata } from "next";
import { listSeasonsWithPlayers, loadSeasonData } from "@/lib/data";
import type { Team } from "@/lib/types";
import AccountView, { type AccountTeam } from "@/app/components/AccountView";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = {
  title: "내 계정 · KBL - Stats Reference",
  robots: { index: false, follow: false },
};

export default function MePage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0]?.seasonCode ?? 0;
  // 개막 직후엔 최신 시즌에 아직 경기를 안 한 팀이 빠져 있다 → 직전 시즌 팀으로 채운다(같은 코드는 최신 시즌 값)
  const byCode = new Map<string, Team>();
  for (const s of seasons.slice(0, 2)) for (const t of loadSeasonData(s.seasonCode)?.teams ?? []) if (!byCode.has(t.teamCode)) byCode.set(t.teamCode, t);
  const teams: AccountTeam[] = [...byCode.values()]
    .sort((a, b) => a.order - b.order)
    .map((t) => ({ teamCode: t.teamCode, name: t.shortNameKo, logoUrl: t.logoUrl, color: t.color }));
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest} view="me" />
      <main className="mx-auto max-w-xl px-4 pb-6 pt-5">
        <h1 className="mb-4 text-h1 font-black">내 계정</h1>
        <AccountView teams={teams} />
      </main>
      <SourceFooter />
    </>
  );
}
