// 내 계정 (/me, 2026-10-04): 구글·네이버 로그인, 닉네임·응원팀, 로그인 연결, 즐겨찾기 계정 저장, 로그아웃·탈퇴. 헤더 계정 버튼으로 들어온다(메뉴 없음).
// 정적 페이지 — 로그인 상태는 브라우저가 /api/me 로 확인한다. 응원팀 목록 = lib/data loadAccountTeams.
import type { Metadata } from "next";
import { listSeasonsWithPlayers, loadAccountTeams } from "@/lib/data";
import AccountView from "@/app/components/AccountView";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = {
  title: "내 계정 · KBL - Stats Reference",
  robots: { index: false, follow: false },
};

export default function MePage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0]?.seasonCode ?? 0;
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest} view="me" />
      <main className="mx-auto max-w-xl px-4 pb-6 pt-5">
        <h1 className="mb-4 text-h1 font-black">내 계정</h1>
        <AccountView teams={loadAccountTeams()} />
      </main>
      <SourceFooter />
    </>
  );
}
