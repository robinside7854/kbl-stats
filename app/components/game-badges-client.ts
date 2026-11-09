"use client";
// 54-0 배지 브라우저 쪽 (2026-11-09): 이 브라우저(localStorage)에 늘 쌓고, 로그인한 브라우저면 계정(/api/me/badges)에도.
// 판정 규칙은 lib/game-badges — 계정 쪽은 서버가 라인업으로 다시 판정한다(보낸 배지 이름을 믿지 않음).
import { useEffect, useState } from "react";
import { enabledLoginProviders } from "@/lib/account";
import {
  EMPTY_BADGES, addBadges, mergeBadgeStates, parseBadgeState, playBadges, playoffBadges, seasonBadges,
  type BadgeGameInput, type BadgeKey, type BadgeState,
} from "@/lib/game-badges";
import type { PlayoffResult } from "@/lib/game-playoffs";
import { hasSignedInHint } from "./account-client";

const KEY = "kbl-stats:game-badges:v1";
const EVENT = "kbl-badges-change";

function readLocal(): BadgeState {
  try {
    return parseBadgeState(JSON.parse(window.localStorage.getItem(KEY) ?? "null"));
  } catch {
    return { ...EMPTY_BADGES, earned: {} };
  }
}

function writeLocal(s: BadgeState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // 저장이 막힌 브라우저 — 이번 화면에서만
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: s }));
}

const accountOn = () => enabledLoginProviders().length > 0 && hasSignedInHint();

/** 탈퇴할 때 이 브라우저 배지도 지운다 */
export function clearLocalBadges() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}

/**
 * 한 판 결과로 배지 받기. season = 정규리그 결과(판 수 +1), playoff = 플레이오프를 끝까지 봤을 때.
 * 반환: 이번에 새로 받은 배지 (이 브라우저 기준 + 계정에서 새로 받은 것)
 */
export async function recordGameBadges(stage: "season" | "playoff", lineup: string, input: BadgeGameInput, playoff: PlayoffResult | null): Promise<BadgeKey[]> {
  const now = new Date().toISOString();
  let local = readLocal();
  let keys: BadgeKey[];
  if (stage === "season") {
    local = { ...local, plays: local.plays + 1 };
    keys = [...seasonBadges(input), ...playBadges(local.plays)];
  } else {
    keys = playoffBadges(input, playoff, !local.earned.first_ring);
  }
  const res = addBadges(local, keys, now);
  writeLocal(res.state);
  const added = new Set(res.added);
  if (accountOn()) {
    try {
      const r = await fetch("/api/me/badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineup, stage }),
      });
      if (r.ok) {
        const body = (await r.json()) as { state: unknown; added: BadgeKey[] };
        writeLocal(mergeBadgeStates(readLocal(), parseBadgeState(body.state)));
        for (const k of body.added ?? []) added.add(k);
      }
    } catch {
      // 계정 저장 실패 — 이 브라우저에는 남아 있다(다음에 합친다)
    }
  }
  return [...added];
}

/** 이 브라우저 + 계정(로그인했으면) 배지. 계정에 없는 것이 이 브라우저에 있으면 계정에도 합친다 */
async function syncWithAccount(): Promise<void> {
  if (!accountOn()) return;
  try {
    const r = await fetch("/api/me/badges");
    if (!r.ok) return;
    const server = parseBadgeState(await r.json());
    const local = readLocal();
    const merged = mergeBadgeStates(server, local);
    const missing = Object.keys(merged.earned).some((k) => !server.earned[k as BadgeKey]) || merged.plays > server.plays;
    if (missing) {
      await fetch("/api/me/badges", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(merged) }).catch(() => undefined);
    }
    writeLocal(merged);
  } catch {
    // 무시 — 이 브라우저 것만 보인다
  }
}

let synced = false;

/** 화면용: 지금 배지 상태 (처음 한 번 계정과 맞춘다) */
export function useGameBadges(): BadgeState | null {
  const [state, setState] = useState<BadgeState | null>(null);
  useEffect(() => {
    setState(readLocal());
    const on = (e: Event) => setState((e as CustomEvent<BadgeState>).detail);
    window.addEventListener(EVENT, on);
    if (!synced) {
      synced = true;
      void syncWithAccount();
    }
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return state;
}
