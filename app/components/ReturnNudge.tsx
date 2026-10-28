"use client";
// 경기 다음 날 다시 오게 (2026-10-27 GA4 검토 3번: 박스스코어가 두 번째 인기인데 하루 방문자는 20~35명에서 멈춤).
// 박스스코어 창을 닫은 직후 화면 아래에 작은 카드를 한 번 띄워, 다음 경기 결과를 받을 방법 하나를 권한다.
// 무엇을 권할지는 lib/return-nudge pickNudgeKind (폰 알림 켜기 → 앱 설치 → 아이폰 홈 화면 추가 → 로그인).
// 닫으면 14일 동안 안 띄우고, 권한 것을 하면 다시 안 띄운다. 할 게 없는 브라우저(이미 알림 켬 등)엔 아무것도 안 그린다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { enabledLoginProviders } from "@/lib/account";
import { NUDGE_TEXT, pickNudgeKind, shouldShowNudge, type NudgeKind } from "@/lib/return-nudge";
import { hasSignedInHint } from "./account-client";
import { BOXSCORE_CLOSED_EVENT, canPromptInstall, promptInstall } from "./install-prompt";
import { IconBell, IconClose } from "./icons";
import { enablePush, pushEnabled, pushSupport } from "./push-client";
import { trackEvent } from "./track";

const STORE_KEY = "kbl-stats:return-nudge:v1";

function readStore(): string | null {
  try {
    return window.localStorage.getItem(STORE_KEY);
  } catch {
    return "done"; // 저장이 안 되는 브라우저는 매번 뜨지 않게 아예 안 띄운다
  }
}

function writeStore(value: string) {
  try {
    window.localStorage.setItem(STORE_KEY, value);
  } catch {
    /* 저장 불가 — 이번 방문만 */
  }
}

function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function ReturnNudge() {
  const [kind, setKind] = useState<NudgeKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let shownThisVisit = false;
    async function onClosed() {
      if (shownThisVisit || !shouldShowNudge(readStore(), Date.now())) return;
      const support = pushSupport();
      const next = pickNudgeKind({
        pushSupport: support,
        pushOn: support === "ok" ? await pushEnabled() : false,
        signedIn: hasSignedInHint(),
        loginEnabled: enabledLoginProviders().length > 0,
        canInstall: canPromptInstall(),
        standalone: isStandalone(),
      });
      if (!next) return;
      shownThisVisit = true;
      writeStore(String(Date.now()));
      setMessage(null);
      setKind(next);
      trackEvent("return_nudge_show", { kind: next });
    }
    window.addEventListener(BOXSCORE_CLOSED_EVENT, onClosed);
    return () => window.removeEventListener(BOXSCORE_CLOSED_EVENT, onClosed);
  }, []);

  if (!kind) return null;
  const text = NUDGE_TEXT[kind];

  function finish() {
    writeStore("done");
    setKind(null);
  }

  async function act() {
    if (!kind) return;
    trackEvent("return_nudge_click", { kind });
    if (kind === "push") {
      setBusy(true);
      const r = await enablePush();
      setBusy(false);
      trackEvent("push_enable", { result: r });
      if (r === "on") finish();
      else setMessage(r === "denied" ? "알림이 막혀 있어요. 폰이나 브라우저 설정에서 이 사이트 알림을 허용해 주세요." : "켜지 못했어요. 알림함에서 다시 해 볼 수 있어요.");
    } else if (kind === "install") {
      await promptInstall();
      finish(); // 설치를 안 골라도 같은 창은 다시 못 띄운다
    } else {
      finish(); // ios_home 은 안내만, login 은 링크로 이동
    }
  }

  function dismiss() {
    trackEvent("return_nudge_dismiss", { kind: kind ?? "" });
    setKind(null);
  }

  const actionClass =
    "focus-ring inline-flex h-11 shrink-0 items-center justify-center rounded-control bg-series-1 px-4 text-sub font-bold text-white transition-colors duration-200 hover:bg-series-1/90 disabled:opacity-60";

  return (
    <aside
      aria-labelledby="return-nudge-title"
      className="surface-card fixed inset-x-4 bottom-[calc(var(--bottom-nav-h)+0.75rem)] z-40 mx-auto max-w-md rounded-container p-4 md:bottom-6 md:left-auto md:right-6 md:mx-0 md:w-[24rem]"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-series-1/15 text-series-1">
          <IconBell size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="return-nudge-title" className="text-body font-bold text-ink break-keep">
            {text.title}
          </h2>
          <p className="mt-0.5 text-sub text-ink-2 break-keep">{text.body}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="안내 닫기"
          className="focus-ring -mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-ink-3 transition-colors duration-200 hover:text-ink"
        >
          <IconClose size={20} />
        </button>
      </div>
      <div className="mt-3 flex justify-end">
        {kind === "login" ? (
          <Link href="/me" onClick={act} className={actionClass}>
            {text.action}
          </Link>
        ) : (
          <button type="button" onClick={act} disabled={busy} className={actionClass}>
            {busy ? "잠시만요" : text.action}
          </button>
        )}
      </div>
      {message && (
        <p role="status" className="mt-2 text-sub text-ink-2 break-keep">
          {message}
        </p>
      )}
    </aside>
  );
}
