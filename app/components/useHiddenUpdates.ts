"use client";
// 업데이트 소식 삭제 (2026-10-05) 브라우저 쪽: 관리자가 지운 글 번호 불러오기·지우기·되돌리기, 관리자인지.
// 지운 글 목록은 /api/updates/hidden 한 번 → 이번 방문(sessionStorage) 동안 5분 기억. 로그인 기능이 꺼진 빌드는 DB 가 없어 부르지 않는다.
import { useEffect, useState } from "react";
import { enabledLoginProviders } from "@/lib/account";
import { fetchMe, hasSignedInHint } from "./account-client";

const CACHE_KEY = "kbl-stats:hidden-updates:v1";
const CACHE_MS = 5 * 60 * 1000;
const EVENT = "kbl-hidden-updates-change";

function readCache(): string[] | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { at: number; hidden: string[] };
    return Date.now() - v.at < CACHE_MS && Array.isArray(v.hidden) ? v.hidden : null;
  } catch {
    return null;
  }
}

function writeCache(hidden: string[]) {
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), hidden }));
  } catch {
    // 기억 못 하면 다음에 다시 부른다
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

let inflight: Promise<string[]> | null = null;

/** 지운 글 번호 (못 받으면 빈 목록 — 글은 그대로 보인다) */
export function loadHiddenUpdates(): Promise<string[]> {
  if (enabledLoginProviders().length === 0) return Promise.resolve([]);
  const c = readCache();
  if (c) return Promise.resolve(c);
  inflight ??= fetch("/api/updates/hidden")
    .then((r) => (r.ok ? r.json() : { hidden: [] }))
    .then((d: { hidden?: unknown }) => {
      const list = Array.isArray(d.hidden) ? d.hidden.filter((s): s is string => typeof s === "string") : [];
      writeCache(list);
      return list;
    })
    .catch(() => [] as string[])
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** 관리자: 글 지우기(hidden true)·되돌리기 → 성공하면 true */
export async function saveHiddenUpdate(slug: string, hidden: boolean): Promise<boolean> {
  try {
    const res = await fetch("/api/updates/hidden", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, hidden }),
    });
    if (!res.ok) return false;
    const d = (await res.json()) as { hidden?: string[] };
    writeCache(Array.isArray(d.hidden) ? d.hidden : []);
    return true;
  } catch {
    return false;
  }
}

/** 지운 글 번호 (불러오는 중 null) */
export function useHiddenUpdates(enabled = true): string[] | null {
  const [hidden, setHidden] = useState<string[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () => loadHiddenUpdates().then((h) => alive && setHidden(h));
    load();
    window.addEventListener(EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, load);
    };
  }, [enabled]);
  return hidden;
}

/** 지금 브라우저가 관리자로 로그인했는지 (로그인한 적 없는 브라우저는 부르지 않는다) */
export function useIsAdmin(): boolean {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (enabledLoginProviders().length === 0 || !hasSignedInHint()) return;
    let alive = true;
    fetchMe().then((r) => alive && setAdmin(r.status === "signed_in" && !!r.member.isAdmin));
    return () => {
      alive = false;
    };
  }, []);
  return admin;
}
