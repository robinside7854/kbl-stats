// 로그인 설정 (next-auth v4, 2026-10-04) — 구글·네이버. 세션은 암호화된 쿠키(JWT)라 로그인 자체에는 DB 가 필요 없다.
// 개인정보 최소: 구글은 scope "openid"(고유 번호만), 네이버는 앱 설정에서 고른 항목이 와도 고유 번호(id)만 쓴다.
// 쿠키·세션에도 이름·이메일·사진을 넣지 않고 회원 번호("google:…", "naver:…")만 남긴다.
// 예외 하나(2026-10-04 사용자 결정, 네이버 검수 "제공 정보 활용처"): 네이버 별명은 처음 닉네임 칸에 미리 채울 제안으로만 쓴다 —
// 암호화된 로그인 쿠키에 suggest 로 잠시 두고, 닉네임을 저장하면 지운다(clearSuggestion → update). DB 에는 사용자가 직접 저장한 닉네임만.
// 계정 연결(2026-10-04): 로그인한 회원이 /api/me/link 로 표시 쿠키를 남기고 다른 회사로 로그인하면, 여기서 그 로그인 번호를 회원에 붙인다
// (lib/server/members linkLogin). 실패하면 원래 로그인 번호로 그대로 로그인돼 있게 하고, 결과는 linkResult 로 /me 에 알린다.
// 켜는 조건(빌드 때 next.config.mjs 가 판정): 운영 배포 + NEXTAUTH_SECRET + DATABASE_URL + 그 회사 키 → NEXT_PUBLIC_LOGIN_PROVIDERS.
import "server-only";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import NaverProvider from "next-auth/providers/naver";
import site from "@/data/codes/site.json";
import { enabledLoginProviders, LINK_RESULTS, memberIdOf, providerOfMemberId, type LinkResult } from "@/lib/account";
import { getDb } from "./db";
import { takeLinkIntent } from "./link";
import { linkLogin, loginExists, resolveMemberId } from "./members";
import { notifyAdminsNewMember } from "./admin-notify";

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
        // 별명은 닉네임 제안으로만 (name 자리에 잠깐 실어 jwt 에서 suggest 로 옮긴다)
        profile: (p: { response: { id: string; nickname?: string } }) => ({ ...idOnly(p.response.id), name: p.response.nickname ?? null }),
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
    async jwt({ token, account, user, trigger }) {
      if (account) {
        const mid = memberIdOf(account.provider, account.providerAccountId);
        if (mid) token.mid = mid;
        delete token.linkResult;
        const from = mid ? await takeLinkIntent(account.provider) : null;
        if (mid && from && from !== mid) {
          let result: LinkResult = "failed";
          try {
            const db = await getDb();
            const r = db ? await linkLogin(db, from, mid) : null;
            if (r?.ok) result = r.merged ? "merged" : "linked";
            else if (r?.error === "conflict") result = "conflict";
          } catch (e) {
            console.error("계정 연결 실패", e);
          }
          // 못 붙였으면 원래 계정으로 로그인해 둔다 (새 회원이 생기지 않게)
          if (result === "conflict" || result === "failed") token.mid = from;
          token.linkResult = result;
        } else if (mid) {
          // 처음 보는 로그인 = 신규 가입 → 회원을 만들고 관리자에게 폰 알림 (2026-10-17). 실패해도 로그인은 그대로
          try {
            const db = await getDb();
            if (db && !(await loginExists(db, mid))) {
              await resolveMemberId(db, mid);
              const provider = providerOfMemberId(mid);
              if (provider) await notifyAdminsNewMember(db, provider);
            }
          } catch (e) {
            console.error("신규 가입 알림 실패", e);
          }
        }
        const nick = typeof user?.name === "string" ? suggestionFrom(user.name) : null;
        if (account.provider === "naver" && nick) token.suggest = nick;
        else delete token.suggest;
      }
      // 닉네임을 저장했으면 제안을 지운다 (브라우저가 /api/auth/session 에 update 를 보냄)
      if (trigger === "update") {
        delete token.suggest;
        delete token.linkResult;
      }
      // 이름·이메일·사진은 쿠키에 남기지 않는다
      delete token.name;
      delete token.email;
      delete token.picture;
      return token;
    },
    async session({ session, token }) {
      return {
        expires: session.expires,
        user: {
          id: typeof token.mid === "string" ? token.mid : null,
          suggest: typeof token.suggest === "string" ? token.suggest : null,
          linkResult: LINK_RESULTS.includes(token.linkResult as LinkResult) ? token.linkResult : null,
        },
      } as unknown as typeof session;
    },
    // 로그인 뒤에는 우리 사이트 안 주소로만 돌아온다
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/me`;
    },
  },
};

/** 네이버 별명 → 닉네임 제안 (앞뒤 공백만 지우고 20자까지 — 규칙에 안 맞으면 화면이 안내한다) */
function suggestionFrom(name: string): string | null {
  const v = name.normalize("NFC").trim().slice(0, 20);
  return v || null;
}

/** 지금 요청의 로그인 번호·닉네임 제안·연결 결과 (로그인 안 했으면 null) */
export async function currentSession(): Promise<{ id: string; suggest: string | null; linkResult: LinkResult | null } | null> {
  if (enabledLoginProviders().length === 0) return null;
  const s = await getServerSession(authOptions);
  const u = s?.user as { id?: unknown; suggest?: unknown; linkResult?: unknown } | undefined;
  if (typeof u?.id !== "string") return null;
  return {
    id: u.id,
    suggest: typeof u.suggest === "string" ? u.suggest : null,
    linkResult: LINK_RESULTS.includes(u.linkResult as LinkResult) ? (u.linkResult as LinkResult) : null,
  };
}

/** 지금 요청의 로그인 번호 ("google:…" — 회원 번호는 lib/server/members resolveMemberId 로 찾는다, 로그인 안 했으면 null) */
export async function currentLoginId(): Promise<string | null> {
  if (enabledLoginProviders().length === 0) return null;
  const s = await getServerSession(authOptions);
  const id = (s?.user as { id?: unknown } | undefined)?.id;
  return typeof id === "string" ? id : null;
}
