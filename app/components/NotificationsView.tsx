"use client";
// 알림함 화면 (2026-10-08): 날짜별 소식 목록, 새 소식은 파란 점. 화면을 열면 모두 읽은 것으로(파란 점은 이번에 본 동안 유지).
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { enabledLoginProviders } from "@/lib/account";
import { gameDayLabel } from "@/lib/games";
import { NOTIF_KIND_LABEL, NOTIF_WINDOW_DAYS, type NotifItem } from "@/lib/notifications";
import { IconChevronRight } from "./icons";
import PushToggle from "./PushToggle";
import NotifKindSettings from "./NotifKindSettings";
import Skeleton from "./Skeleton";
import { trackEvent } from "./track";
import { useNotifications } from "./useNotifications";

export default function NotificationsView() {
  const { prefs, mine, seenSet, seenReady, markAllRead, loaded, subscribed, favorites, teams, seasonCode } = useNotifications();
  // 이번에 열었을 때 새 소식이던 것 (읽음 처리 뒤에도 파란 점을 남긴다)
  const freshRef = useRef<Set<string> | null>(null);
  const [, force] = useState(0);
  useEffect(() => {
    if (!loaded || !seenReady || mine.length === 0 || freshRef.current) return;
    freshRef.current = new Set(mine.filter((it) => !seenSet.has(it.id)).map((it) => it.id));
    force((n) => n + 1);
    markAllRead();
  }, [loaded, seenReady, mine, seenSet, markAllRead]);

  const byDate = useMemo(() => {
    const m = new Map<string, NotifItem[]>();
    for (const it of mine) m.set(it.date, [...(m.get(it.date) ?? []), it]);
    return [...m.entries()];
  }, [mine]);

  // 폰 알림을 눌러 들어온 방문 (sw.js 가 ?src=push 로 연다)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("src") === "push") trackEvent("push_click");
  }, []);

  const loginOn = enabledLoginProviders().length > 0;
  const fresh = freshRef.current ?? new Set<string>();

  return (
    <>
      <h1 className="text-h1 font-black">알림</h1>
      <p className="mt-1 text-sub text-ink-3">
        즐겨찾기한 선수 {favorites.length}명 · 응원팀 {teams.length}팀의 최근 {NOTIF_WINDOW_DAYS}일 경기 소식이에요. 기록은 경기가 끝나고 한두 시간 뒤에 들어와요.
      </p>
      <PushToggle />
      {subscribed && <NotifKindSettings prefs={prefs} />}

      {!loaded ? (
        <div className="mt-5 space-y-2" aria-hidden>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !subscribed ? (
        <div className="surface-card mt-5 rounded-container p-5">
          <p className="text-body font-bold text-ink">아직 받을 소식이 없어요</p>
          <p className="mt-1 text-sub text-ink-2">선수 페이지에서 별을 눌러 즐겨찾기하면 그 선수 기록·커리어 하이·이정표를 알려 드려요.</p>
          <div className="mt-3 flex flex-wrap gap-x-4">
            <Link href="/players" className="link-shortcut">
              선수 찾기 <IconChevronRight size={16} />
            </Link>
            {loginOn && (
              <Link href="/me" className="link-shortcut" onClick={() => trackEvent("login_prompt_click", { place: "notifications" })}>
                로그인하고 응원팀 고르기 <IconChevronRight size={16} />
              </Link>
            )}
          </div>
        </div>
      ) : mine.length === 0 ? (
        <div className="surface-card mt-5 rounded-container p-5">
          <p className="text-body font-bold text-ink">최근 {NOTIF_WINDOW_DAYS}일 동안 새 소식이 없어요</p>
          <p className="mt-1 text-sub text-ink-2">
            즐겨찾기한 선수나 응원팀이 경기를 치르면 여기에 쌓여요.{prefs.off.length > 0 ? " 꺼 둔 종류는 보이지 않아요." : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4">
            {seasonCode !== null && (
              <Link href={`/season/${seasonCode}/schedule`} className="link-shortcut">
                다음 경기 일정 보기 <IconChevronRight size={16} />
              </Link>
            )}
            <Link href="/players" className="link-shortcut">
              즐겨찾기할 선수 찾기 <IconChevronRight size={16} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {byDate.map(([date, items]) => (
            <section key={date} aria-label={gameDayLabel(date)}>
              <h2 className="mb-2 text-sub font-bold text-ink-2">{gameDayLabel(date)}</h2>
              <ul className="surface-card divide-y divide-line overflow-hidden rounded-container">
                {items.map((it) => (
                  <li key={it.id}>
                    <Link
                      href={it.href}
                      onClick={() => trackEvent("notif_click", { kind: it.kind })}
                      className="focus-ring-inset flex min-h-12 items-start gap-3 px-4 py-3 transition-colors duration-200 hover:bg-surface-2"
                    >
                      {/* deslop-ignore-next-line 19 */}
                      <span aria-hidden className={`mt-2 h-2 w-2 shrink-0 rounded-full ${fresh.has(it.id) ? "bg-series-1" : "bg-transparent"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="text-caption font-semibold text-ink-3">
                          {NOTIF_KIND_LABEL[it.kind]}
                          {fresh.has(it.id) && <span className="sr-only"> · 새 소식</span>}
                        </span>
                        <span className="block text-body font-bold leading-snug text-ink break-keep">{it.title}</span>
                        {it.body && <span className="mt-0.5 block text-sub text-ink-2 break-keep">{it.body}</span>}
                      </span>
                      <IconChevronRight size={16} className="mt-1.5 shrink-0 text-ink-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {loaded && subscribed && teams.length === 0 && loginOn && (
        <p className="mt-5 text-sub text-ink-2">
          <Link href="/me" className="link-shortcut" onClick={() => trackEvent("login_prompt_click", { place: "notifications" })}>
            로그인하고 응원팀을 고르면 경기 결과도 와요 <IconChevronRight size={16} />
          </Link>
        </p>
      )}
    </>
  );
}
