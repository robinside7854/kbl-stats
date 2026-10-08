"use client";
// 폰 알림 켜기 카드 (2026-10-08 알림 2단계) — 알림함 맨 위. 로그인 회원만, 아이폰은 홈 화면에 추가한 앱에서만.
// 켜면 매일 기록이 들어온 뒤(경기 끝나고 한두 시간) 즐겨찾기 선수·응원팀 새 소식을 폰 알림 하나로 묶어 보낸다(scripts/send-push.ts).
import { useEffect, useState } from "react";
import Link from "next/link";
import { enabledLoginProviders } from "@/lib/account";
import { hasSignedInHint } from "./account-client";
import { IconBell, IconChevronRight } from "./icons";
import { disablePush, enablePush, pushEnabled, pushSupport, type PushSupport } from "./push-client";
import { trackEvent } from "./track";

const MESSAGES: Record<string, string> = {
  denied: "알림이 막혀 있어요. 브라우저나 폰 설정에서 이 사이트 알림을 허용한 뒤 다시 눌러 주세요.",
  failed: "켜지 못했어요. 잠시 뒤 다시 해 주세요.",
  signed_out: "로그인이 풀렸어요. 다시 로그인한 뒤 켜 주세요.",
};

export default function PushToggle() {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSupport(pushSupport());
    setSignedIn(hasSignedInHint());
    void pushEnabled().then(setOn);
  }, []);

  if (support === null || support === "unsupported" || enabledLoginProviders().length === 0) return null;

  async function toggle() {
    setBusy(true);
    setMessage(null);
    if (on) {
      const ok = await disablePush();
      if (ok) setOn(false);
      trackEvent("push_disable", { result: ok ? "off" : "failed" });
    } else {
      const r = await enablePush();
      setOn(r === "on");
      if (r !== "on") setMessage(MESSAGES[r]);
      trackEvent("push_enable", { result: r });
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby="push-title" className="surface-card mt-4 rounded-container px-4 py-3">
      <div className="flex items-center gap-3">
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${on ? "bg-series-1/15 text-series-1" : "bg-surface-2 text-ink-2"}`}>
          <IconBell size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="push-title" className="text-body font-bold text-ink">
            폰 알림 {on ? "켜짐" : "꺼짐"}
          </h2>
          <p className="text-sub text-ink-2 break-keep">
            {support === "ios-browser"
              ? "아이폰은 사파리 공유 버튼 → '홈 화면에 추가'로 설치한 앱에서 켤 수 있어요."
              : on
                ? "기록이 들어오면 폰으로 보내 드려요. 밤 12시~아침 8시엔 쉬어요."
                : "사이트를 안 열어도 새 소식을 폰으로 받아요."}
          </p>
        </div>
        {support === "ok" && signedIn && (
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            aria-pressed={on}
            className={`focus-ring inline-flex h-10 shrink-0 items-center rounded-control px-4 text-sub font-bold transition-colors duration-200 disabled:opacity-60 ${
              on ? "border border-line bg-surface text-ink-2 hover:bg-surface-2" : "bg-series-1 text-white hover:bg-series-1/90"
            }`}
          >
            {busy ? "잠시만요" : on ? "끄기" : "켜기"}
          </button>
        )}
      </div>
      {support === "ok" && !signedIn && (
        <Link href="/me" className="link-shortcut mt-1 text-sub" onClick={() => trackEvent("login_prompt_click", { place: "push" })}>
          로그인하면 폰 알림을 켤 수 있어요 <IconChevronRight size={16} />
        </Link>
      )}
      {message && (
        <p role="status" className="mt-2 text-sub text-ink-2">
          {message}
        </p>
      )}
    </section>
  );
}
