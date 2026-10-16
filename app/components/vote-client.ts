"use client";
// 팬 참여 브라우저 쪽 (2026-10-16): 이번 주 팬 MVP 투표 (경기 승부 예측은 같은 날 폐지).
// 요청 아끼기(Vercel 무료 한도): 공개 표 수(/api/vote)는 로그인 기능이 켜진 빌드에서만, 화면에 필요할 때 한 번씩
// (이번 방문 1분 기억). 내 표(/api/me/vote)는 로그인한 적 있는 브라우저만 부른다(account-client 힌트).
import { enabledLoginProviders } from "@/lib/account";
import type { VoteTally } from "@/lib/votes";
import { ACCOUNT_EVENT, forgetAccount, hasSignedInHint } from "./account-client";

const SHORT_MS = 60 * 1000;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const participationOn = () => enabledLoginProviders().length > 0;

/** 공개 GET 을 이번 방문 1분 기억 + 동시에 부르면 하나로 */
const inflight = new Map<string, Promise<unknown>>();
function cachedGet<T>(url: string, key: string): Promise<T | null> {
  const hit = safe(() => {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as { at: number; data: T };
    return Date.now() - v.at < SHORT_MS ? v.data : null;
  }, null);
  if (hit) return Promise.resolve(hit);
  const running = inflight.get(url) as Promise<T | null> | undefined;
  if (running) return running;
  const p = fetch(url)
    .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
    .catch(() => null)
    .then((data) => {
      if (data) safe(() => window.sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data })), undefined);
      inflight.delete(url);
      return data;
    });
  inflight.set(url, p);
  return p;
}

const forget = (key: string) => safe(() => window.sessionStorage.removeItem(key), undefined);

async function send(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 401) forgetAccount();
  return { ok: res.ok, status: res.status, data };
}

// ── 이번 주 팬 MVP ──

export interface VoteTallies {
  this: VoteTally;
  last: VoteTally;
}

const TALLY_KEY = "kbl-stats:vote-tally:v1";

export const fetchVoteTallies = () => cachedGet<VoteTallies>("/api/vote", TALLY_KEY);

/** 내 표 (로그인한 적 있는 브라우저만 — 아니면 null) */
export async function fetchMyVotes(): Promise<Record<string, string> | null> {
  if (!hasSignedInHint()) return null;
  try {
    const res = await fetch("/api/me/vote", { cache: "no-store" });
    if (res.status === 401) forgetAccount();
    if (!res.ok) return null;
    return ((await res.json()) as { votes: Record<string, string> }).votes ?? {};
  } catch {
    return null;
  }
}

export type CastResult = { ok: true; week: string } | { ok: false; message: string; signedOut?: boolean };

export async function castVote(playerNo: string): Promise<CastResult> {
  try {
    const r = await send("/api/me/vote", { playerNo });
    forget(TALLY_KEY);
    if (r.ok) return { ok: true, week: String(r.data.week) };
    if (r.status === 401) return { ok: false, message: "로그인이 풀렸어요. 다시 로그인해 주세요.", signedOut: true };
    return { ok: false, message: typeof r.data.message === "string" ? r.data.message : "투표하지 못했어요. 잠시 뒤 다시 해 주세요." };
  } catch {
    return { ok: false, message: "투표하지 못했어요. 인터넷 연결을 확인해 주세요." };
  }
}
