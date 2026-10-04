// 계정 연결 표시 쿠키 값 (순수 — 서명·만료·회사 확인, 테스트는 tests/account.test.ts). 쿠키를 다루는 쪽은 lib/server/link.ts.
import { createHmac, timingSafeEqual } from "node:crypto";
import { providerOfMemberId, type LoginProvider } from "./account";

export const LINK_COOKIE = "kbl-link";
export const LINK_MAX_AGE_SEC = 5 * 60;

function secret(): string {
  return process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "";
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function encodeLinkIntent(loginId: string, provider: LoginProvider, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ l: loginId, p: provider, e: now + LINK_MAX_AGE_SEC * 1000 })).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** 서명·만료·회사가 맞으면 연결을 시작한 로그인 번호 */
export function decodeLinkIntent(value: string | undefined, provider: string, now = Date.now()): string | null {
  if (!value || !secret()) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const v = JSON.parse(Buffer.from(body, "base64url").toString()) as { l?: unknown; p?: unknown; e?: unknown };
    if (typeof v.l !== "string" || v.p !== provider || typeof v.e !== "number" || v.e < now) return null;
    return providerOfMemberId(v.l) ? v.l : null;
  } catch {
    return null;
  }
}

