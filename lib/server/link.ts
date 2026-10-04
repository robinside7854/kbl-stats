// 계정 연결 표시 쿠키 (서버 전용, 2026-10-04): "지금 이 로그인 번호의 회원에 ○○ 로그인을 붙이려는 중"을
// 로그인 회사에 다녀오는 동안 기억한다. 서명(HMAC, 로그인 비밀값)·5분 만료·회사 일치일 때만 쓴다.
// 흐름: POST /api/me/link → 이 쿠키 → signIn(회사) → 로그인 콜백(lib/server/auth jwt)이 읽고 지운 뒤 linkLogin.
import "server-only";
import { cookies } from "next/headers";
import type { LoginProvider } from "@/lib/account";
import { decodeLinkIntent, encodeLinkIntent, LINK_COOKIE, LINK_MAX_AGE_SEC } from "@/lib/link-token";

export async function setLinkIntent(loginId: string, provider: LoginProvider): Promise<void> {
  (await cookies()).set(LINK_COOKIE, encodeLinkIntent(loginId, provider), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // 로그인 회사에서 돌아오는 이동(GET)에도 실려 오게
    path: "/",
    maxAge: LINK_MAX_AGE_SEC,
  });
}

/** 읽고 지운다 (한 번만 쓰기) */
export async function takeLinkIntent(provider: string): Promise<string | null> {
  try {
    const jar = await cookies();
    const value = jar.get(LINK_COOKIE)?.value;
    if (value === undefined) return null;
    jar.delete(LINK_COOKIE);
    return decodeLinkIntent(value, provider);
  } catch {
    return null;
  }
}
