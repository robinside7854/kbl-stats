// 내 회원 정보: GET 보기(처음이면 만든다 — 연결된 로그인 수단·관리자 여부·방금 연결 결과 포함) · PATCH 닉네임·응원팀·끈 알림 종류 저장 · DELETE 탈퇴(바로 삭제)
import { normalizeTeamCode, normalizeTeamCodes, validateNickname } from "@/lib/account";
import { badWriteRequest, json, readJson } from "@/lib/server/api";
import { currentLoginId, currentSession } from "@/lib/server/auth";
import { isAdmin } from "@/lib/server/admin";
import { getDb } from "@/lib/server/db";
import { parseNotifOff } from "@/lib/notifications";
import { deleteMember, getOrCreateMember, updateProfile } from "@/lib/server/members";

export const dynamic = "force-dynamic";

async function context() {
  const id = await currentLoginId();
  if (!id) return { error: json({ error: "signed_out" }, 401) } as const;
  const db = await getDb();
  if (!db) return { error: json({ error: "unavailable" }, 503) } as const;
  return { id, db } as const;
}

export async function GET() {
  const s = await currentSession();
  if (!s) return json({ error: "signed_out" }, 401);
  const db = await getDb();
  if (!db) return json({ error: "unavailable" }, 503);
  const member = await getOrCreateMember(db, s.id);
  if (await isAdmin(db, s.id)) member.isAdmin = true;
  // 닉네임을 아직 안 정했을 때만 네이버 별명을 제안으로 (저장은 사용자가 '저장'을 눌러야)
  return json({ member, suggestedNickname: member.nickname ? null : s.suggest, linkResult: s.linkResult });
}

export async function PATCH(req: Request) {
  const bad = badWriteRequest(req);
  if (bad) return bad;
  const c = await context();
  if ("error" in c) return c.error;
  const body = (await readJson(req)) as { nickname?: unknown; teamCode?: unknown; teamCodes?: unknown; notifOff?: unknown } | null;
  if (!body) return json({ error: "bad_request" }, 400);
  const patch: { nickname?: string | null; teamCode?: string | null; teamCodes?: string[]; notifOff?: string[] } = {};
  if (body.nickname !== undefined) {
    const n = validateNickname(body.nickname);
    if (!n.ok) return json({ error: "nickname_invalid", message: n.error }, 400);
    patch.nickname = n.value;
  }
  if (body.teamCodes !== undefined) {
    const t = normalizeTeamCodes(body.teamCodes);
    if (t === undefined) return json({ error: "bad_request" }, 400);
    patch.teamCodes = t;
  } else if (body.teamCode !== undefined) {
    const t = normalizeTeamCode(body.teamCode);
    if (t === undefined) return json({ error: "bad_request" }, 400);
    patch.teamCode = t;
  }
  if (body.notifOff !== undefined) {
    if (!Array.isArray(body.notifOff)) return json({ error: "bad_request" }, 400);
    patch.notifOff = parseNotifOff(body.notifOff);
  }
  const r = await updateProfile(c.db, c.id, patch);
  if (!r.ok) return json({ error: r.error, message: "이미 다른 분이 쓰는 닉네임이에요." }, 409);
  return json({ member: r.member });
}

export async function DELETE(req: Request) {
  const bad = badWriteRequest(req);
  if (bad) return bad;
  const c = await context();
  if ("error" in c) return c.error;
  await deleteMember(c.db, c.id);
  return json({ ok: true });
}
