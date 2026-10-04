// 구글·네이버 로그인 주소 (/api/auth/...) — next-auth v4. 설정은 lib/server/auth.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/server/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
