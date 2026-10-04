// 회원 기능 브라우저 쪽 (2026-10-04): 로그인 여부 힌트·내 정보 불러오기·저장·즐겨찾기 맞추기.
// 요청을 아끼려고(Vercel 무료 한도) 로그인한 적이 있는 브라우저에서만 /api/me 를 부른다 — 힌트는 localStorage,
// 내 정보는 이번 방문(sessionStorage) 동안 10분 기억한다. 로그인하지 않은 방문자는 회원 API 를 한 번도 부르지 않는다.
import { getCsrfToken } from "next-auth/react";
import { mergeFavorites, sameList, type MemberView } from "@/lib/account";
import { readFavorites, replaceFavorites } from "./useFavorites";

const HINT_KEY = "kbl-stats:signed-in:v1";
const CACHE_KEY = "kbl-stats:me:v1";
const SYNCED_KEY = "kbl-stats:favorites-synced:v1";
const CACHE_MS = 10 * 60 * 1000;
export const ACCOUNT_EVENT = "kbl-account-change";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function hasSignedInHint(): boolean {
  return safe(() => window.localStorage.getItem(HINT_KEY) === "1", false);
}

function clearSession() {
  safe(() => {
    window.localStorage.removeItem(HINT_KEY);
    window.sessionStorage.removeItem(CACHE_KEY);
    window.sessionStorage.removeItem(SYNCED_KEY);
  }, undefined);
}

function remember(member: MemberView) {
  safe(() => {
    window.localStorage.setItem(HINT_KEY, "1");
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), member }));
  }, undefined);
  window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT));
}

export function cachedMember(): MemberView | null {
  return safe(() => {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { at: number; member: MemberView };
    return Date.now() - v.at < CACHE_MS ? v.member : null;
  }, null);
}

/** suggestedNickname: 네이버 별명 (닉네임을 아직 안 정했을 때만, 화면은 칸에 미리 채우기만) */
export type MeResult = { status: "signed_in"; member: MemberView; suggestedNickname?: string | null } | { status: "signed_out" } | { status: "error" };

/** 내 정보 (fresh 가 아니면 10분 기억한 값) — 로그인 안 돼 있으면 힌트를 지운다 */
export async function fetchMe(fresh = false): Promise<MeResult> {
  if (!fresh) {
    const c = cachedMember();
    if (c) return { status: "signed_in", member: c };
  }
  try {
    const res = await fetch("/api/me", { cache: "no-store" });
    if (res.status === 401) {
      clearSession();
      window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT));
      return { status: "signed_out" };
    }
    if (!res.ok) return { status: "error" };
    const { member, suggestedNickname } = (await res.json()) as { member: MemberView; suggestedNickname?: string | null };
    remember(member);
    return { status: "signed_in", member, suggestedNickname: suggestedNickname ?? null };
  } catch {
    return { status: "error" };
  }
}

async function send(method: "PATCH" | "PUT" | "DELETE", url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

export type SaveResult = { ok: true; member: MemberView } | { ok: false; message: string };

export async function saveProfile(patch: { nickname?: string; teamCode?: string | null }): Promise<SaveResult> {
  try {
    const r = await send("PATCH", "/api/me", patch);
    if (!r.ok) return { ok: false, message: typeof r.data.message === "string" ? r.data.message : "저장하지 못했어요. 잠시 뒤 다시 해 주세요." };
    const member = r.data.member as MemberView;
    remember(member);
    return { ok: true, member };
  } catch {
    return { ok: false, message: "저장하지 못했어요. 인터넷 연결을 확인해 주세요." };
  }
}

/** 이 브라우저 즐겨찾기를 계정에도 저장 (로그인한 브라우저에서만, 실패해도 화면은 그대로) */
export async function pushFavorites(list: readonly string[]): Promise<void> {
  if (!hasSignedInHint()) return;
  try {
    const r = await send("PUT", "/api/me/favorites", { favorites: list });
    const c = cachedMember();
    if (r.ok && c) remember({ ...c, favorites: r.data.favorites as string[] });
  } catch {
    // 다음 로그인 때 다시 맞춘다
  }
}

/** 계정 목록과 이 브라우저 목록을 합쳐 양쪽에 저장 → 합친 개수 (이번 방문에 한 번) */
export async function syncFavorites(member: MemberView, force = false): Promise<number> {
  const done = safe(() => window.sessionStorage.getItem(SYNCED_KEY) === "1", false);
  if (done && !force) return member.favorites.length;
  const merged = mergeFavorites(readFavorites(), member.favorites);
  replaceFavorites(merged);
  if (!sameList(merged, member.favorites)) await pushFavorites(merged);
  safe(() => window.sessionStorage.setItem(SYNCED_KEY, "1"), undefined);
  return merged.length;
}

/** 닉네임을 저장했으면 로그인 쿠키에 잠시 둔 네이버 별명 제안을 지운다 (next-auth 세션 update) */
export async function clearSuggestion(): Promise<void> {
  try {
    const csrfToken = await getCsrfToken();
    await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csrfToken, data: { clearSuggest: true } }) });
  } catch {
    // 못 지워도 쿠키 만료(최대 30일)·로그아웃 때 사라진다
  }
}

/** 로그아웃 표시 (실제 로그아웃은 next-auth signOut) */
export function forgetAccount() {
  clearSession();
  window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT));
}

export async function deleteAccount(): Promise<boolean> {
  try {
    const r = await send("DELETE", "/api/me");
    if (r.ok) forgetAccount();
    return r.ok;
  } catch {
    return false;
  }
}
