"use client";
// 헤더 알림 종 (2026-10-08): 즐겨찾기 선수·응원팀 새 소식 수 → /notifications. 계산은 useNotifications.
import Link from "next/link";
import { IconBell } from "./icons";
import { trackEvent } from "./track";
import { useNotifications } from "./useNotifications";

export default function NotificationBell({ active = false }: { active?: boolean }) {
  const { unread } = useNotifications();
  const label = unread > 0 ? `알림, 새 소식 ${unread}개` : "알림";
  return (
    <Link
      href="/notifications"
      onClick={() => trackEvent("notif_open", { unread })}
      aria-label={label}
      title="알림"
      aria-current={active ? "page" : undefined}
      className={`focus-ring relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border transition-colors duration-200 ${
        active ? "border-series-1 bg-series-1/15 text-series-1" : "border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink"
      }`}
    >
      <IconBell size={20} />
      {unread > 0 && (
        // 새 소식 수 배지 (색 점과 같은 원형)
        <span
          aria-hidden
          // deslop-ignore-next-line 19
          className="tabular absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-series-1 px-1 text-caption font-bold leading-none text-white"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
