"use client";
// 폰 푸시 알림 켜기·끄기 (2026-10-08 알림 2단계). 서비스 워커 public/sw.js 를 등록하고 브라우저 푸시 서비스에 구독한 뒤
// 구독 정보(주소·키)를 /api/me/push 로 계정에 저장한다. 보내기는 매일 수집 뒤 GitHub Actions(scripts/send-push.ts).
import { pushPublicKey } from "@/lib/push";

export type PushSupport = "ok" | "unsupported" | "ios-browser";

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** 이 브라우저에서 켤 수 있나 — 아이폰·아이패드는 "홈 화면에 추가"한 앱에서만 된다 */
export function pushSupport(): PushSupport {
  if (!pushPublicKey()) return "unsupported";
  const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIos() && !isStandalone()) return "ios-browser";
  return ok ? "ok" : "unsupported";
}

function keyBytes(base64url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** 지금 이 기기에서 켜져 있나 */
export async function pushEnabled(): Promise<boolean> {
  try {
    if (pushSupport() !== "ok" || Notification.permission !== "granted") return false;
    return (await currentSubscription()) !== null;
  } catch {
    return false;
  }
}

export type EnableResult = "on" | "denied" | "failed" | "signed_out";

export async function enablePush(): Promise<EnableResult> {
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return "denied";
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(pushPublicKey()) as BufferSource }));
    const res = await fetch("/api/me/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    if (res.ok) return "on";
    await sub.unsubscribe().catch(() => {});
    return res.status === 401 ? "signed_out" : "failed";
  } catch {
    return "failed";
  }
}

/** 끄기 — 계정에서 지우고 브라우저 구독도 푼다 (로그아웃할 때도 부른다) */
export async function disablePush(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator)) return true;
    const sub = await currentSubscription();
    if (!sub) return true;
    await fetch("/api/me/push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe();
    return true;
  } catch {
    return false;
  }
}
