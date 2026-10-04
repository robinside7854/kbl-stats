// 계정 연결 (2026-10-04): POST { provider } 연결 시작(표시 쿠키) → 브라우저가 그 회사로 로그인 · DELETE ?provider= 연결 해제
import { canUnlink, enabledLoginProviders, parseLoginProviders, providerOfMemberId } from "@/lib/account";
import { badWriteRequest, json, readJson } from "@/lib/server/api";
import { currentLoginId } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { setLinkIntent } from "@/lib/server/link";
import { getOrCreateMember, unlinkLogin } from "@/lib/server/members";

export const dynamic = "force-dynamic";

function providerFrom(raw: unknown) {
  const p = parseLoginProviders(typeof raw === "string" ? raw : "")[0];
  return p && enabledLoginProviders().includes(p) ? p : null;
}

export async function POST(req: Request) {
  const bad = badWriteRequest(req);
  if (bad) return bad;
  const id = await currentLoginId();
  if (!id) return json({ error: "signed_out" }, 401);
  const db = await getDb();
  if (!db) return json({ error: "unavailable" }, 503);
  const body = (await readJson(req)) as { provider?: unknown } | null;
  const provider = providerFrom(body?.provider);
  if (!provider) return json({ error: "bad_request" }, 400);
  const member = await getOrCreateMember(db, id);
  if (member.logins.includes(provider)) return json({ error: "already_linked" }, 409);
  await setLinkIntent(id, provider);
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  const bad = badWriteRequest(req);
  if (bad) return bad;
  const id = await currentLoginId();
  if (!id) return json({ error: "signed_out" }, 401);
  const db = await getDb();
  if (!db) return json({ error: "unavailable" }, 503);
  const provider = providerFrom(new URL(req.url).searchParams.get("provider"));
  if (!provider) return json({ error: "bad_request" }, 400);
  const member = await getOrCreateMember(db, id);
  if (!canUnlink(member.logins, providerOfMemberId(id), provider)) return json({ error: "cannot_unlink" }, 409);
  const r = await unlinkLogin(db, id, provider);
  if (!r.ok) return json({ error: "cannot_unlink" }, 409);
  return json({ member: r.member });
}
