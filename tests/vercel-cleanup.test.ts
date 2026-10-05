// Vercel 옛 배포 정리 — 지울 것 고르기 규칙 (scripts/vercel-cleanup.ts pickDeletions) — npm run test:cleanup
import assert from "node:assert/strict";
import { KEEP_READY_DEFAULT, pickDeletions, type DeploymentLite } from "../scripts/vercel-cleanup";

const d = (uid: string, state: string, created: number, target: string | null = "production"): DeploymentLite => ({ uid, state, created, target });

// 완료 배포 8개(최신 d8) + 막힌 것 2개 + 진행 중 1개 + 실패 1개
const all: DeploymentLite[] = [
  d("d1", "READY", 1), d("d2", "READY", 2), d("d3", "READY", 3), d("d4", "READY", 4),
  d("d5", "READY", 5), d("d6", "READY", 6), d("d7", "READY", 7), d("d8", "READY", 8),
  d("b1", "BLOCKED", 9), d("b2", "BLOCKED", 10),
  d("e1", "ERROR", 11),
  d("q1", "BUILDING", 12),
];

// 기본: 운영(d6) + 진행 중(q1) + 완료 최근 5개(d8~d4) 남김 → d1·d2·d3·BLOCKED·ERROR 지움
{
  const doomed = pickDeletions(all, "d6").map((x) => x.uid).sort();
  assert.deepEqual(doomed, ["b1", "b2", "d1", "d2", "d3", "e1"]);
}

// 운영 배포가 오래된 것이어도(d1) 반드시 남긴다
{
  const doomed = pickDeletions(all, "d1").map((x) => x.uid);
  assert.ok(!doomed.includes("d1"), "운영 배포를 지우면 사이트가 내려간다");
  assert.ok(doomed.includes("d3") && doomed.includes("d2"));
}

// 운영 배포를 모르면(null) 그래도 최신 READY 5개는 남는다
{
  const kept = all.filter((x) => !pickDeletions(all, null).some((y) => y.uid === x.uid)).map((x) => x.uid).sort();
  assert.deepEqual(kept, ["d4", "d5", "d6", "d7", "d8", "q1"]);
}

// 진행 중(QUEUED·BUILDING·INITIALIZING)은 개수와 무관하게 남긴다
{
  const inflight = [d("a", "QUEUED", 1), d("b", "INITIALIZING", 2), d("c", "BUILDING", 3)];
  assert.deepEqual(pickDeletions(inflight, null), []);
}

// 남길 개수를 바꿀 수 있다 · 기본값은 5
{
  assert.equal(KEEP_READY_DEFAULT, 5);
  const doomed = pickDeletions(all, "d8", 2).map((x) => x.uid).sort();
  assert.deepEqual(doomed, ["b1", "b2", "d1", "d2", "d3", "d4", "d5", "d6", "e1"]);
}

// 입력 순서가 섞여 있어도 "최근" 은 created 기준
{
  const shuffled = [...all].reverse();
  assert.deepEqual(pickDeletions(shuffled, "d6").map((x) => x.uid).sort(), ["b1", "b2", "d1", "d2", "d3", "e1"]);
}

console.log("vercel-cleanup: 통과");
