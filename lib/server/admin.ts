// 관리자 판정 (서버 전용, 2026-10-04): 환경변수 ADMIN_LOGIN_IDS 에 적은 로그인 번호 중 하나가 이 회원에 붙어 있으면 관리자.
// 계정을 연결해 두면 구글·네이버 어느 쪽으로 들어와도 관리자다. 이메일은 받지 않으므로 번호로 정한다(lib/account parseAdminLoginIds).
import "server-only";
import { isAdminLogin, parseAdminLoginIds } from "@/lib/account";
import { loginIdsOfLogin, type Query } from "./members";

export async function isAdmin(q: Query, loginId: string): Promise<boolean> {
  const admins = parseAdminLoginIds(process.env.ADMIN_LOGIN_IDS);
  if (admins.size === 0) return false;
  return isAdminLogin(await loginIdsOfLogin(q, loginId), admins);
}
