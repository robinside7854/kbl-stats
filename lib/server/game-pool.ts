// 54-0 후보 풀 (서버 전용, 2026-10-05 주간 순위): 저장 요청의 성적을 서버가 다시 계산하려고 우리 정적 파일
// /game/pool.json(빌드 때 생성, 약 1.1MB)을 같은 사이트에서 한 번 받아 둔다. 못 받으면 null — 저장은 되고 순위에만 안 오른다.
import "server-only";
import type { GamePool } from "../game";

const KEEP_MS = 60 * 60 * 1000;
let cached: { pool: GamePool; at: number } | null = null;
let pending: Promise<GamePool | null> | null = null;

export async function loadGamePool(origin: string): Promise<GamePool | null> {
  if (cached && Date.now() - cached.at < KEEP_MS) return cached.pool;
  if (!pending) {
    pending = fetch(new URL("/game/pool.json", origin), { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? (r.json() as Promise<GamePool>) : null))
      .then((pool) => {
        if (pool && Array.isArray(pool.eras)) cached = { pool, at: Date.now() };
        return cached?.pool ?? null;
      })
      .catch(() => cached?.pool ?? null)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}
