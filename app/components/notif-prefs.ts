"use client";
// 알림 종류별 켜기·끄기 (2026-10-08 토스 검토 B-7). 저장 = 끈 묶음 목록(lib/notifications NOTIF_GROUPS 키).
// 로그인 회원은 계정(/api/me PATCH notifOff → members.notif_off, 폰 알림 보내기도 이 값을 본다), 아니면 이 브라우저 localStorage.
// 계정 값이 있으면 그걸 먼저 (다른 기기에서 바꾼 것도 따라오게).
import { useCallback, useEffect, useState } from "react";
import { parseNotifOff, type NotifGroup } from "@/lib/notifications";
import { ACCOUNT_EVENT, cachedMember, hasSignedInHint, lastKnownMember, saveProfile } from "./account-client";

const LOCAL_KEY = "kbl-stats:notif-off:v1";
const PREFS_EVENT = "kbl-notif-prefs";

function readLocal(): NotifGroup[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? parseNotifOff(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function writeLocal(list: NotifGroup[]) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  } catch {
    // 저장 못 하는 브라우저는 이번 방문 동안만
  }
  window.dispatchEvent(new CustomEvent(PREFS_EVENT));
}

export function readNotifOff(): NotifGroup[] {
  if (hasSignedInHint()) {
    const m = cachedMember() ?? lastKnownMember();
    if (m && Array.isArray(m.notifOff)) return parseNotifOff(m.notifOff);
  }
  return readLocal();
}

export function useNotifPrefs() {
  const [off, setOff] = useState<NotifGroup[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setOff(readNotifOff());
    sync();
    window.addEventListener(ACCOUNT_EVENT, sync);
    window.addEventListener(PREFS_EVENT, sync);
    return () => {
      window.removeEventListener(ACCOUNT_EVENT, sync);
      window.removeEventListener(PREFS_EVENT, sync);
    };
  }, []);

  const toggle = useCallback(async (group: NotifGroup) => {
    const now = readNotifOff();
    const next = parseNotifOff(now.includes(group) ? now.filter((g) => g !== group) : [...now, group]);
    setMessage(null);
    writeLocal(next);
    setOff(next);
    if (hasSignedInHint()) {
      const r = await saveProfile({ notifOff: next });
      if (!r.ok) {
        setMessage("계정에 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
        setOff(readNotifOff());
      }
    }
    return next;
  }, []);

  return { off, toggle, message };
}
