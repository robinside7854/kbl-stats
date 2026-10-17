// 신규 가입 관리자 알림 (서버 전용, 2026-10-17 사용자 요청): 처음 보는 로그인으로 회원이 새로 생기면
// 관리자(ADMIN_LOGIN_IDS) 계정에서 폰 알림을 켜 둔 기기로 "새 회원이 가입했어요" 푸시를 보낸다.
// 필요: Vercel 환경변수 VAPID_PRIVATE_KEY(GitHub Secrets 와 같은 값). 없으면 조용히 건너뛴다 — 가입은 절대 막지 않는다.
// 새벽 조용한 시간(lib/push isQuietHour)도 관리자 알림은 보낸다(가입은 드물고 바로 알고 싶다는 요청).
import "server-only";
import webpush from "web-push";
import site from "@/data/codes/site.json";
import { parseAdminLoginIds, type LoginProvider } from "@/lib/account";
import { pushPublicKey } from "@/lib/push";
import { adminPushSubscriptions, memberCount, removePushEndpoint, type Query } from "./members";

const PROVIDER_LABELS: Record<LoginProvider, string> = { google: "구글", naver: "네이버" };

export async function notifyAdminsNewMember(q: Query, provider: LoginProvider): Promise<void> {
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const publicKey = pushPublicKey();
  const admins = [...parseAdminLoginIds(process.env.ADMIN_LOGIN_IDS)];
  if (!privateKey || !publicKey || admins.length === 0) return;
  const subs = await adminPushSubscriptions(q, admins);
  if (subs.length === 0) return;
  const total = await memberCount(q);
  const payload = JSON.stringify({
    title: "새 회원이 가입했어요",
    body: `${PROVIDER_LABELS[provider]} 로그인 · 지금 회원 ${total.toLocaleString("ko-KR")}명`,
    url: "/admin",
    tag: "kbl-admin-signup",
  });
  webpush.setVapidDetails(site.siteUrl, publicKey, privateKey);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await removePushEndpoint(q, s.endpoint);
        else console.warn(`관리자 가입 알림 실패 (${code ?? "?"})`);
      }
    }),
  );
}
