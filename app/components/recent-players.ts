"use client";
// 최근 본 선수 저장 (2026-10-08 토스 검토 — 검색창을 누르면 최근 본 선수가 바로 보이게). 이 브라우저에만(localStorage), 서버로 보내지 않는다.
// 규칙(최대 5명·최근 것이 앞)은 lib/search pushRecentPlayer·parseRecentPlayers.
import { parseRecentPlayers, pushRecentPlayer } from "@/lib/search";

const KEY = "kbl-stats:recent-players:v1";

export function loadRecentPlayers(): string[] {
  try {
    return parseRecentPlayers(window.localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

export function addRecentPlayer(id: string): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(pushRecentPlayer(loadRecentPlayers(), id)));
  } catch {
    // 저장 불가(사생활 보호 모드 등) — 기능만 빠진다
  }
}
