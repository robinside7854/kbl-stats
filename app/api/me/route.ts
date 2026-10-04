// 내 회원 정보: GET 보기(처음이면 만든다) · PATCH 닉네임·응원팀 저장 · DELETE 탈퇴(바로 삭제)
import { normalizeTeamCode, validateNickname } from "@/lib/account";
import { badWriteRequest, json, readJson } from "@/lib/server/api";
import { currentMemberId } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { deleteMember, getOrCreateMember, updateProfile } from "@/lib/server/members";

export const dynamic = "force-dynamic";

async function context() {
  const id = await currentMemberId();
  if (!id) return { error: json({ error: "signed_out" }, 401) } as const;
  const db = await getDb();
  if (!db) return { error: json({ error: "unavailable" }, 503) } as const;
  return { id, db } as const;
}

export async function GET() {
  const c = await context();
  if ("error" in c) return c.error;
  return json({ member: await getOrCreateMember(c.db, c.id) });
}

export async function PATCH(req: Request) {
  const bad = badWriteRequest(req);
  if (bad) return bad;
  const c = await context();
  if ("error" in c) return c.error;
  const body = (await readJson(req)) as { nickname?: unknown; teamCode?: unknown } | null;
  if (!body) return json({ error: "bad_request" }, 400);
  const patch: { nickname?: string | null; teamCode?: string | null } = {};
  if (body.nickname !== undefined) {
    const n = validateNickname(body.nickname);
    if (!n.ok) return json({ error: "nickname_invalid", message: n.error }, 400);
    patch.nickname = n.value;
  }
  if (body.teamCode !== undefined) {
    const t = normalizeTeamCode(body.teamCode);
    if (t === undefined) return json({ error: "bad_request" }, 400);
    patch.teamCode = t;
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
