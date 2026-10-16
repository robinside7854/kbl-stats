"use client";
// 팬 참여 브라우저 쪽 (2026-10-16): 이번 주 팬 MVP 투표·경기 승부 예측.
// 요청 아끼기(Vercel 무료 한도): 공개 수(/api/vote·/api/picks·/api/picks/ranking)는 로그인 기능이 켜진 빌드에서만, 화면에 필요할 때 한 번씩
// (이번 방문 1분 기억, 같은 화면 여러 카드가 요청 하나를 나눠 씀). 내 표·내 예측(/api/me/…)은 로그인한 적 있는 브라우저만 부른다(account-client 힌트).
import { useEffect, useSyncExternalStore } from "react";
import { enabledLoginProviders } from "@/lib/account";
import type { MyPicks, PickCounts, PickRanking, PickSide, VoteTally } from "@/lib/votes";
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

// ── 승부 예측 순위 ──

export const fetchPickRanking = () => cachedGet<PickRanking>("/api/picks/ranking", "kbl-stats:pick-ranking:v1");

// ── 경기 승부 예측 (경기 카드 여러 장이 같은 상태를 나눠 쓴다) ──

interface PicksState {
  counts: PickCounts | null;
  /** null = 아직 모름·로그인 안 함 */
  mine: MyPicks | null;
  signedIn: boolean;
}

const COUNTS_KEY = "kbl-stats:pick-counts:v1";
let state: PicksState = { counts: null, mine: null, signedIn: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const setState = (patch: Partial<PicksState>) => {
  state = { ...state, ...patch };
  emit();
};
let countsLoading = false;
let mineLoading = false;

function loadCounts() {
  if (countsLoading || state.counts) return;
  countsLoading = true;
  void cachedGet<{ counts: PickCounts }>("/api/picks", COUNTS_KEY).then((d) => {
    countsLoading = false;
    setState({ counts: d?.counts ?? {} });
  });
}

function loadMine() {
  if (mineLoading || state.mine || !hasSignedInHint()) return;
  mineLoading = true;
  setState({ signedIn: true });
  void fetch("/api/me/picks", { cache: "no-store" })
    .then(async (res) => {
      if (res.status === 401) {
        forgetAccount();
        setState({ signedIn: false });
        return;
      }
      if (res.ok) setState({ mine: (await res.json()) as MyPicks });
    })
    .catch(() => undefined)
    .finally(() => {
      mineLoading = false;
    });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const SERVER_STATE: PicksState = { counts: null, mine: null, signedIn: false };

/** 경기 카드용: needCounts 면 공개 예측 수도 받는다 (아직 안 한 경기를 보일 때만) */
export function useGamePicks(needCounts: boolean): PicksState {
  const s = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  useEffect(() => {
    if (!participationOn()) return;
    loadMine();
    if (needCounts) loadCounts();
    const onAccount = () => {
      const hinted = hasSignedInHint();
      if (!hinted && state.signedIn) setState({ signedIn: false, mine: null });
      else if (hinted) loadMine();
    };
    window.addEventListener(ACCOUNT_EVENT, onAccount);
    return () => window.removeEventListener(ACCOUNT_EVENT, onAccount);
  }, [needCounts]);
  return s;
}

export type PickResult = { ok: true } | { ok: false; message: string };

/** 예측하기 (바로 화면에 반영, 실패하면 되돌림) */
export async function makePick(gmkey: string, side: PickSide): Promise<PickResult> {
  const before = state;
  const prev = before.mine?.picks[gmkey];
  if (prev === side) return { ok: true };
  const mine: MyPicks = { hits: 0, total: 0, picks: {}, ...before.mine };
  const counts = { ...(before.counts ?? {}) };
  const c: [number, number] = [...(counts[gmkey] ?? [0, 0])] as [number, number];
  if (prev) c[prev === "home" ? 0 : 1] = Math.max(0, c[prev === "home" ? 0 : 1] - 1);
  c[side === "home" ? 0 : 1] += 1;
  counts[gmkey] = c;
  setState({ mine: { ...mine, picks: { ...mine.picks, [gmkey]: side } }, counts });
  try {
    const r = await send("/api/me/picks", { gmkey, side });
    forget(COUNTS_KEY);
    if (r.ok) return { ok: true };
    setState({ mine: before.mine, counts: before.counts });
    if (r.status === 401) {
      setState({ signedIn: false, mine: null });
      return { ok: false, message: "로그인이 풀렸어요. 다시 로그인해 주세요." };
    }
    return { ok: false, message: typeof r.data.message === "string" ? r.data.message : "예측을 저장하지 못했어요." };
  } catch {
    setState({ mine: before.mine, counts: before.counts });
    return { ok: false, message: "예측을 저장하지 못했어요. 인터넷 연결을 확인해 주세요." };
  }
}

/** 내 예측 (투표 화면 — 적중 수 표시용, 로그인한 적 있는 브라우저만) */
export function useMyPickRecord(): MyPicks | null {
  const s = useGamePicks(false);
  return s.mine;
}
