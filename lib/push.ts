// 폰 푸시 알림 규칙 (2026-10-08 알림 2단계). 순수 함수 — 화면(구독 검사)·scripts/send-push.ts(보낼 것 고르기·문구) 공용.
// 알림 내용은 알림함과 같은 목록(lib/notifications)을 쓴다. 회원 한 명에게 한 번 수집에 알림 하나(여러 소식은 묶음).
import { myNotifs, withoutOffGroups, type NotifItem } from "./notifications";
import site from "../data/codes/site.json";

/** 마지막 경기일과 그 전날 소식만 보낸다 (처음 켠 사람에게 지난 주 소식이 한꺼번에 가지 않게) */
export const PUSH_LOOKBACK_DAYS = 2;

/** 조용한 시간 (한국 시간, 2026-10-08 토스 검토): 자정~아침 8시에는 보내지 않고 아침 첫 보내기(push-morning.yml 08:10)에 묶는다.
 *  하이라이트 확인 알람이 새벽 2:40 까지 돌아 새벽에 폰이 울릴 수 있었다. 늦은 경기 수집(밤 10~11시대)은 그대로 보낸다 */
export const PUSH_QUIET_START_HOUR = 0;
export const PUSH_QUIET_END_HOUR = 8;

/** 지금이 조용한 시간인지 (한국 시간 = UTC+9) */
export function isQuietHour(now: Date): boolean {
  const hour = (now.getUTCHours() + 9) % 24;
  return hour >= PUSH_QUIET_START_HOUR && hour < PUSH_QUIET_END_HOUR;
}

/** 알림을 눌렀을 때 열 주소 — 알림함 (src=push 로 GA 에서 구분) */
export const PUSH_OPEN_URL = "/notifications?src=push";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  /** 같은 tag 는 폰 알림 목록에서 하나로 바뀐다 */
  tag: string;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 이 회원에게 새로 보낼 소식 (최근 PUSH_LOOKBACK_DAYS 일 · 아직 안 보낸 것 · 끈 종류 빼고 · 알림함 순서) */
export function pickPushItems(
  items: readonly NotifItem[],
  target: { favorites: readonly string[]; teams: readonly string[]; sent: ReadonlySet<string>; off?: readonly string[] },
): NotifItem[] {
  const mine = withoutOffGroups(myNotifs(items, target.favorites, target.teams), target.off ?? []);
  if (mine.length === 0) return [];
  const latest = items.reduce((m, it) => (it.date > m ? it.date : m), items[0].date);
  const from = addDays(latest, -(PUSH_LOOKBACK_DAYS - 1));
  return mine.filter((it) => it.date >= from && !target.sent.has(it.id));
}

/** 소식 여러 개 → 폰 알림 하나: 첫 소식 제목 + 둘째 소식(나머지는 "외 N개") */
export function composePush(items: readonly NotifItem[]): PushPayload | null {
  if (items.length === 0) return null;
  const [first, second] = items;
  let body = first.body;
  if (second) body = items.length === 2 ? second.title : `${second.title} 외 ${items.length - 2}개`;
  return { title: first.title, body, url: PUSH_OPEN_URL, tag: "kbl-news" };
}

/** 브라우저가 보낸 구독 정보 검사 (https 주소, 키 길이) — 아니면 null */
export function parsePushSubscription(input: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  if (!input || typeof input !== "object") return null;
  const o = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = typeof o.endpoint === "string" ? o.endpoint : "";
  const p256dh = typeof o.keys?.p256dh === "string" ? o.keys.p256dh : "";
  const auth = typeof o.keys?.auth === "string" ? o.keys.auth : "";
  if (!/^https:\/\/[^\s]+$/.test(endpoint) || endpoint.length > 1000) return null;
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{8,100}$/.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

/** 푸시 공개 키 (VAPID — data/codes/site.json, 공개해도 되는 값. 비밀 키는 GitHub Secrets 에만) */
export function pushPublicKey(): string {
  return (site as { pushPublicKey?: string }).pushPublicKey ?? "";
}
