"use client";
// 받을 알림 종류 (2026-10-08 토스 검토 B-7: 토스증권 "기능별 알림"처럼 종류마다 켜기·끄기 + 한 줄 설명).
// 알림함과 폰 알림에 같이 적용된다. 저장은 notif-prefs (로그인 회원 = 계정, 아니면 이 브라우저).
// GA4: filter_change screen=notifications filter=kind_{묶음} value=on/off (새 매개변수 없음).
import { NOTIF_GROUPS } from "@/lib/notifications";
import { trackFilters } from "./track";
import type { useNotifPrefs } from "./notif-prefs";

export default function NotifKindSettings({ prefs }: { prefs: ReturnType<typeof useNotifPrefs> }) {
  return (
    <section aria-labelledby="notif-kinds-title" className="surface-card mt-3 rounded-container px-4 pb-1 pt-3">
      <h2 id="notif-kinds-title" className="text-body font-bold text-ink">
        받을 소식
      </h2>
      <p className="text-sub text-ink-3">알림함과 폰 알림에 같이 적용돼요.</p>
      <ul className="mt-1 divide-y divide-line">
        {NOTIF_GROUPS.map((g) => {
          const on = !prefs.off.includes(g.key);
          return (
            <li key={g.key}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => {
                  trackFilters("notifications", { [`kind_${g.key}`]: on ? "off" : "on" });
                  void prefs.toggle(g.key);
                }}
                className="focus-ring-inset flex min-h-14 w-full cursor-pointer items-center gap-3 py-2.5 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold text-ink">{g.label}</span>
                  <span className="block text-sub text-ink-3 break-keep">{g.desc}</span>
                </span>
                {/* deslop-ignore-next-line 19 — 켜기·끄기 스위치는 둥근 막대가 관례 */}
                <span aria-hidden className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-series-1" : "bg-line"}`}>
                  {/* deslop-ignore-next-line 19 */}
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-card transition-transform duration-200 ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {prefs.message && (
        <p role="status" className="pb-2 text-sub text-ink-2">
          {prefs.message}
        </p>
      )}
    </section>
  );
}
