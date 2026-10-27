"use client";
// 브라우저 "앱 설치" 창 준비물 (2026-10-27 재방문 권유). 크롬·삼성 인터넷은 설치할 수 있을 때 beforeinstallprompt 를 한 번 보내는데,
// 그때 받아 두었다가 ReturnNudge 의 "앱 설치" 버튼에서 prompt() 를 부른다. 브라우저 자체 설치 안내는 막지 않는다(preventDefault 안 함).
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let saved: InstallPromptEvent | null = null;

export function captureInstallPrompt(e: Event) {
  saved = e as InstallPromptEvent;
}

export function clearInstallPrompt() {
  saved = null;
}

export const canPromptInstall = () => saved !== null;

/** 설치 창을 띄운다 — 사용자가 설치를 고르면 true */
export async function promptInstall(): Promise<boolean> {
  const e = saved;
  if (!e) return false;
  saved = null; // 한 번 쓴 이벤트는 다시 못 쓴다
  try {
    await e.prompt();
    return (await e.userChoice).outcome === "accepted";
  } catch {
    return false;
  }
}

/** 박스스코어 창을 닫았다는 신호 (GameCard → ReturnNudge) */
export const BOXSCORE_CLOSED_EVENT = "kbl:boxscore-closed";
