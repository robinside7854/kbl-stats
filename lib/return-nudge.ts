// 경기 다음 날 다시 오게 (2026-10-27 GA4 검토 3번) — 순수 함수만.
// 박스스코어 창을 닫은 직후(관심이 가장 높을 때) 한 번, 다음 경기 결과를 받을 방법을 하나만 권한다.
// 화면은 app/components/ReturnNudge.tsx, 저장은 localStorage(이 브라우저만).

/** 권하는 것 — 폰 알림 켜기 / 앱 설치 / 아이폰 홈 화면에 추가 안내 / 로그인(폰 알림은 로그인 회원만) */
export type NudgeKind = "push" | "install" | "ios_home" | "login";

export interface NudgeState {
  /** 폰 알림을 이 브라우저에서 켤 수 있나 (push-client pushSupport) */
  pushSupport: "ok" | "unsupported" | "ios-browser";
  pushOn: boolean;
  signedIn: boolean;
  loginEnabled: boolean;
  /** 브라우저가 설치 창을 띄울 수 있게 준비했나 (beforeinstallprompt) */
  canInstall: boolean;
  /** 이미 설치한 앱으로 열었나 */
  standalone: boolean;
}

/** 무엇을 권할지 — 할 게 없으면 null(띄우지 않음). 손이 덜 가는 것부터 */
export function pickNudgeKind(s: NudgeState): NudgeKind | null {
  if (s.pushSupport === "ok" && s.signedIn && !s.pushOn) return "push";
  if (s.canInstall && !s.standalone) return "install";
  if (s.pushSupport === "ios-browser") return "ios_home";
  if (s.pushSupport === "ok" && !s.signedIn && s.loginEnabled) return "login";
  return null;
}

/** 닫았으면 이만큼 지나야 다시 (한 번 권한 뒤 매번 띄우면 귀찮다) */
export const NUDGE_SNOOZE_DAYS = 14;

/** 저장 값: "done"(권한 것을 했음 — 다시 안 띄움) 또는 마지막으로 띄운 시각(ms) */
export function shouldShowNudge(stored: string | null, now: number): boolean {
  if (!stored) return true;
  if (stored === "done") return false;
  const at = Number(stored);
  if (!Number.isFinite(at)) return true;
  return now - at >= NUDGE_SNOOZE_DAYS * 86_400_000;
}

export const NUDGE_TEXT: Record<NudgeKind, { title: string; body: string; action: string }> = {
  push: {
    title: "다음 경기 결과, 폰으로 받아 볼래요?",
    body: "응원팀·즐겨찾기 선수 기록이 들어오면 알려 드려요. 밤 12시~아침 8시엔 쉬어요.",
    action: "폰 알림 켜기",
  },
  install: {
    title: "앱으로 설치해 두면 편해요",
    body: "홈 화면에서 바로 열려요. 기록은 경기 끝나고 1시간쯤 뒤에 올라와요.",
    action: "앱 설치",
  },
  ios_home: {
    title: "홈 화면에 추가해 두세요",
    body: "사파리 아래 공유 버튼 → '홈 화면에 추가'. 앱처럼 열리고 폰 알림도 켤 수 있어요.",
    action: "알겠어요",
  },
  login: {
    title: "다음 경기 결과, 폰으로 받아 볼래요?",
    body: "로그인하고 응원팀을 고르면 경기 끝나고 기록이 들어올 때 폰으로 알려 드려요.",
    action: "로그인하기",
  },
};
