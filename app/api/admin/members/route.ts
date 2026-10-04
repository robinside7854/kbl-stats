// 관리자: 전체 회원 목록 (GET). 관리자가 아니면 403 + 내 로그인 번호(관리자 등록용 — 본인 것만)
import { badWriteRequest, json } from "@/lib/server/api";
import { isAdmin } from "@/lib/server/admin";
import { currentLoginId } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { listMembers, loginIdsOfLogin } from "@/lib/server/members";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // 읽기지만 다른 사이트에서 부르는 것도 막는다
  const bad = badWriteRequest(new Request(req.url, { method: "DELETE", headers: req.headers }));
  if (bad) return bad;
  const id = await currentLoginId();
  if (!id) return json({ error: "signed_out" }, 401);
  const db = await getDb();
  if (!db) return json({ error: "unavailable" }, 503);
  if (!(await isAdmin(db, id))) return json({ error: "forbidden", myLoginIds: await loginIdsOfLogin(db, id) }, 403);
  return json({ members: await listMembers(db) });
}
