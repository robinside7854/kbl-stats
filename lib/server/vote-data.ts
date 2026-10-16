// 팬 참여 정적 파일 (서버 전용, 2026-10-16): 투표 후보를 우리 정적 파일 /vote/data.json(빌드 때 scripts/build-votes.ts)에서
// 같은 사이트로 한 번 받아 10분 기억한다(lib/server/game-pool.ts 와 같은 방식). 못 받으면 null — API 는 503 을 돌려준다.
import "server-only";
import type { VoteDataFile } from "../votes";

const KEEP_MS = 10 * 60 * 1000;
let cached: { data: VoteDataFile; at: number } | null = null;
let pending: Promise<VoteDataFile | null> | null = null;

export async function loadVoteData(origin: string): Promise<VoteDataFile | null> {
  if (cached && Date.now() - cached.at < KEEP_MS) return cached.data;
  if (!pending) {
    pending = fetch(new URL("/vote/data.json", origin), { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? (r.json() as Promise<VoteDataFile>) : null))
      .then((data) => {
        if (data && Array.isArray(data.weeks)) cached = { data, at: Date.now() };
        return cached?.data ?? null;
      })
      .catch(() => cached?.data ?? null)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

/** 그 시즌 경기 번호 앞부분 "S49G" */
export const seasonPrefix = (data: VoteDataFile) => `S${data.seasonCode}G`;
