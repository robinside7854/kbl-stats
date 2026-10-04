// 관리자 화면 (/admin, 2026-10-04): 전체 회원 목록. 메뉴·검색 노출 없음, 관리자 판정은 서버(/api/admin/members)가 한다.
// 관리자 = 환경변수 ADMIN_LOGIN_IDS 의 로그인 번호가 붙은 회원(lib/server/admin). 관리자가 아니면 내 로그인 번호를 보여 준다(등록용).
import type { Metadata } from "next";
import { listSeasonsWithPlayers, loadAccountTeams } from "@/lib/data";
import AdminView from "@/app/components/AdminView";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = {
  title: "관리자 · KBL - Stats Reference",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  const seasons = listSeasonsWithPlayers();
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={seasons[0]?.seasonCode ?? 0} view="me" />
      <main className="mx-auto max-w-5xl px-4 pb-6 pt-5">
        <h1 className="mb-4 text-h1 font-black">회원 목록</h1>
        <AdminView teams={loadAccountTeams()} />
      </main>
      <SourceFooter />
    </>
  );
}
