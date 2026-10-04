// 로그인 설정 (next-auth v4, 2026-10-04) — 구글·네이버. 세션은 암호화된 쿠키(JWT)라 로그인 자체에는 DB 가 필요 없다.
// 개인정보 최소: 구글은 scope "openid"(고유 번호만), 네이버는 앱 설정에서 고른 항목이 와도 고유 번호(id)만 쓴다.
// 쿠키·세션에도 이름·이메일·사진을 넣지 않고 회원 번호("google:…", "naver:…")만 남긴다.
// 켜는 조건(빌드 때 next.config.mjs 가 판정): 운영 배포 + NEXTAUTH_SECRET + DATABASE_URL + 그 회사 키 → NEXT_PUBLIC_LOGIN_PROVIDERS.
import "server-only";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import NaverProvider from "next-auth/providers/naver";
import site from "@/data/codes/site.json";
import { enabledLoginProviders, memberIdOf } from "@/lib/account";

// 운영 배포에서는 로그인 되돌아올 주소를 사이트 주소로 고정한다 (배포마다 바뀌는 VERCEL_URL 을 쓰면 구글·네이버에 등록한 주소와 달라진다)
if (process.env.VERCEL_ENV === "production" && !process.env.NEXTAUTH_URL) process.env.NEXTAUTH_URL = site.siteUrl;

/** 로그인 회사가 준 정보 중 고유 번호만 남긴다 */
const idOnly = (id: string) => ({ id, name: null, email: null, image: null });

function providers(): NextAuthOptions["providers"] {
  const on = enabledLoginProviders();
  const list: NextAuthOptions["providers"] = [];
  if (on.includes("google")) {
    list.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        authorization: { params: { scope: "openid", prompt: "select_account" } },
        profile: (p: { sub: string }) => idOnly(p.sub),
      }),
    );
  }
  if (on.includes("naver")) {
    list.push(
      NaverProvider({
        clientId: process.env.NAVER_CLIENT_ID ?? "",
        clientSecret: process.env.NAVER_CLIENT_SECRET ?? "",
        profile: (p: { response: { id: string } }) => idOnly(p.response.id),
      }),
    );
  }
  return list;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  providers: providers(),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 }, // 30일
  pages: { signIn: "/me", error: "/me" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        const mid = memberIdOf(account.provider, account.providerAccountId);
        if (mid) token.mid = mid;
      }
      // 이름·이메일·사진은 쿠키에 남기지 않는다
      delete token.name;
      delete token.email;
      delete token.picture;
      return token;
    },
    async session({ session, token }) {
      return { expires: session.expires, user: { id: typeof token.mid === "string" ? token.mid : null } } as unknown as typeof session;
    },
    // 로그인 뒤에는 우리 사이트 안 주소로만 돌아온다
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/me`;
    },
  },
};

/** 지금 요청의 회원 번호 (로그인 안 했으면 null) */
export async function currentMemberId(): Promise<string | null> {
  if (enabledLoginProviders().length === 0) return null;
  const s = await getServerSession(authOptions);
  const id = (s?.user as { id?: unknown } | undefined)?.id;
  return typeof id === "string" ? id : null;
}
