// 54-0 플레이 수·최고 기록 (2026-11-08) 브라우저 쪽: 게임 화면을 열 때 집계 한 번(GET, 1분 공유 캐시),
// 한 판을 완성하면 세기(POST — 서버가 승수를 다시 계산). 사람 수는 이 브라우저의 무작위 번호로만 센다(누구인지 모름).
// 로그인 기능(= DB)이 꺼진 빌드에서는 부르지 않는다.
import { enabledLoginProviders, type GamePlayStats } from "@/lib/account";

const PID_KEY = "kbl-stats:game-pid:v1";

export const gameStatsEnabled = () => enabledLoginProviders().length > 0;

/** 이 브라우저의 무작위 번호 (없으면 만든다, 저장이 안 되는 환경이면 이번 방문 동안만) */
let memoryPid: string | null = null;
export function playId(): string {
  const make = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
  try {
    const saved = window.localStorage.getItem(PID_KEY);
    if (saved && /^[a-z0-9]{16,40}$/.test(saved)) return saved;
    const id = make();
    window.localStorage.setItem(PID_KEY, id);
    return id;
  } catch {
    memoryPid ??= make();
    return memoryPid;
  }
}

export async function fetchGameStats(): Promise<GamePlayStats | null> {
  if (!gameStatsEnabled()) return null;
  try {
    const r = await fetch("/api/game/stats");
    return r.ok ? ((await r.json()) as GamePlayStats | null) : null;
  } catch {
    return null;
  }
}

export async function postGamePlay(lineup: string): Promise<GamePlayStats | null> {
  if (!gameStatsEnabled()) return null;
  try {
    const r = await fetch("/api/game/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineup, pid: playId() }),
    });
    if (!r.ok) return null;
    return ((await r.json()) as { stats: GamePlayStats }).stats ?? null;
  } catch {
    return null;
  }
}
