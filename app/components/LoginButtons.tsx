"use client";
// 구글·네이버 로그인 버튼 (각 회사 버튼 안내에 맞춘 색·로고 — 팀 색·액센트 규칙의 예외).
// 이 브라우저에서 마지막으로 쓴 회사 버튼에 "최근 사용" 꼬리표(로그아웃해도 남음).
// GA4: login_start { provider }. 로그인이 끝나면 /me?login=회사 로 돌아와 AccountView 가 login_success 를 보낸다.
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { PROVIDER_LABELS, type LoginProvider } from "@/lib/account";
import { lastLoginProvider } from "./account-client";
import { trackEvent } from "./track";

function GoogleMark() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function NaverMark() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 20 20">
      <path fill="#ffffff" d="M13.56 10.7 6.17 0H0v20h6.44V9.3L13.83 20H20V0h-6.44z" />
    </svg>
  );
}

function RecentTag({ tone }: { tone: "dark" | "light" }) {
  return (
    <span
      // deslop-ignore-next-line 03
      className={`ml-1 rounded-md px-1.5 py-0.5 text-caption font-bold ${tone === "dark" ? "bg-white text-[#03753A]" : "bg-[#1f1f1f] text-white"}`}
    >
      최근 사용
    </span>
  );
}

export default function LoginButtons({ providers }: { providers: LoginProvider[] }) {
  const [busy, setBusy] = useState<LoginProvider | null>(null);
  const [last, setLast] = useState<LoginProvider | null>(null);
  useEffect(() => setLast(lastLoginProvider()), []);
  function go(p: LoginProvider) {
    setBusy(p);
    trackEvent("login_start", { provider: p });
    void signIn(p, { callbackUrl: `/me?login=${p}` });
  }
  return (
    <div className="grid gap-2">
      {providers.includes("naver") && (
        <button
          type="button"
          onClick={() => go("naver")}
          disabled={busy !== null}
          // deslop-ignore-next-line 03
          className="focus-ring inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-control bg-[#03C75A] text-body font-bold text-white transition-colors duration-200 hover:bg-[#02b350] disabled:cursor-wait"
        >
          <NaverMark />
          {busy === "naver" ? "네이버로 이동 중…" : `${PROVIDER_LABELS.naver}로 로그인`}
          {last === "naver" && busy === null && <RecentTag tone="dark" />}
        </button>
      )}
      {providers.includes("google") && (
        <button
          type="button"
          onClick={() => go("google")}
          disabled={busy !== null}
          // deslop-ignore-next-line 03
          className="focus-ring inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-control border border-[#747775] bg-white text-body font-bold text-[#1f1f1f] transition-colors duration-200 hover:bg-[#f2f2f2] disabled:cursor-wait"
        >
          <GoogleMark />
          {busy === "google" ? "구글로 이동 중…" : `${PROVIDER_LABELS.google} 계정으로 로그인`}
          {last === "google" && busy === null && <RecentTag tone="light" />}
        </button>
      )}
    </div>
  );
}
