"use client";
// 알림함 (2026-10-08): /notifications.json(빌드 때 만든 최근 경기 소식, scripts/build-notifications.ts)에서
// 이 브라우저 즐겨찾기 선수·로그인 회원 응원팀 것만 고른다(lib/notifications myNotifs). 읽음은 이 브라우저 localStorage.
// 즐겨찾기도 응원팀도 없으면 파일을 받지 않는다(요청 아끼기). 끈 종류(notif-prefs, 2026-10-08)는 빼고 센다.
import { useCallback, useEffect, useMemo, useState } from "react";
import { initialSeen, mergeSeen, myNotifs, visibleNotifs, withoutOffGroups, type NotifFeed, type NotifItem } from "@/lib/notifications";
import { ACCOUNT_EVENT, cachedMember, hasSignedInHint, lastKnownMember } from "./account-client";
import { useFavorites } from "./useFavorites";
import { useNotifPrefs } from "./notif-prefs";

const SEEN_KEY = "kbl-stats:notif-seen:v1";
const SEEN_EVENT = "kbl-notif-seen";

let feedPromise: Promise<NotifFeed | null> | null = null;
function loadFeed(): Promise<NotifFeed | null> {
  feedPromise ??= fetch("/notifications.json")
    .then((r) => (r.ok ? (r.json() as Promise<NotifFeed>) : null))
    .catch(() => {
      feedPromise = null;
      return null;
    });
  return feedPromise;
}

function readSeen(): string[] | null {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function writeSeen(list: string[]) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(list));
  } catch {
    // 저장 못 하는 브라우저(사생활 보호 모드 등)는 이번 방문 동안만
  }
  window.dispatchEvent(new CustomEvent(SEEN_EVENT));
}

function memberTeams(): string[] {
  if (!hasSignedInHint()) return [];
  return (cachedMember() ?? lastKnownMember())?.teamCodes ?? [];
}

export function useNotifications() {
  const fav = useFavorites();
  const prefs = useNotifPrefs();
  const [teams, setTeams] = useState<string[]>([]);
  const [feed, setFeed] = useState<NotifFeed | null>(null);
  const [seen, setSeen] = useState<string[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const sync = () => setTeams(memberTeams());
    const syncSeen = () => setSeen(readSeen());
    sync();
    syncSeen();
    window.addEventListener(ACCOUNT_EVENT, sync);
    window.addEventListener(SEEN_EVENT, syncSeen);
    return () => {
      window.removeEventListener(ACCOUNT_EVENT, sync);
      window.removeEventListener(SEEN_EVENT, syncSeen);
    };
  }, []);

  const subscribed = fav.list.length > 0 || teams.length > 0;
  useEffect(() => {
    if (!fav.ready) return;
    if (!subscribed) {
      setLoaded(true);
      return;
    }
    let alive = true;
    void loadFeed().then((f) => {
      if (!alive) return;
      setFeed(f);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [fav.ready, subscribed]);

  const mine: NotifItem[] = useMemo(
    // 목록에는 앞날 소식(경기 날 안내·생일)이 미리 들어 있어 오늘까지만 (visibleNotifs, 2026-10-12)
    () => (feed ? withoutOffGroups(myNotifs(visibleNotifs(feed.items, new Date()), fav.list, teams), prefs.off) : []),
    [feed, fav.list, teams, prefs.off],
  );

  // 처음 쓰는 브라우저: 가장 최근 경기일 것만 새 알림으로
  useEffect(() => {
    if (seen === null && mine.length > 0) writeSeen(initialSeen(mine));
  }, [seen, mine]);

  const seenSet = useMemo(() => new Set(seen ?? []), [seen]);
  const unread = seen === null ? 0 : mine.filter((it) => !seenSet.has(it.id)).length;
  const markAllRead = useCallback(() => {
    if (mine.length === 0) return;
    writeSeen(mergeSeen(readSeen() ?? [], mine.map((it) => it.id)));
  }, [mine]);

  return { prefs, mine, unread, seenSet, seenReady: seen !== null, markAllRead, loaded, subscribed, favorites: fav.list, teams, seasonCode: feed?.seasonCode ?? null };
}
