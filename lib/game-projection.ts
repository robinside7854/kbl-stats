// 54-0 "이 팀에서의 예상 기록"·예상 MVP (2026-11-08 사용자 결정) — 순수 함수만.
// 올스타끼리 모이면 공이 모자라서 각자 기록이 줄어든다:
//   - 주전 다섯 명이 한 경기에 나눠 갖는 몫(우리 가정): 득점 PROJ_POOL.pts · 리바운드 PROJ_POOL.reb · 어시스트 PROJ_POOL.ast.
//     KBL 팀 경기당 득점이 80점 안팎(시대마다 다름)이고 주전이 40분 중 약 30분을 뛰므로 보통 주전 몫은 60점 안팎 —
//     역대 최고 다섯 명이 더 오래 뛰고 더 잘 넣는다고 보고 넉넉하게 잡았다.
//   - 다섯 명 원래 기록 합이 몫보다 크면 몫을 나눈다. 나누는 무게 = 원래 기록 × 효율 보정(효율 축이 높을수록 공을 더 받는다).
//     몫보다 작으면 원래 기록 그대로(혼자 더 넣지는 않는다).
//   - 스틸·블록은 나눠 갖는 기록이 아니라 그대로.
// 예상 MVP = 예상 기록으로 매긴 공헌(MVP_WEIGHTS) + 숨은 종합 점수 조금 — 가장 높은 선수.
import { RADAR_AXES } from "./metrics";
import type { GameCandidate } from "./game";

export const PROJ_POOL = { pts: 72, reb: 36, ast: 19 } as const;
/** 효율 축(0~100)에 따른 몫 보정: 무게 = 원래 기록 × (PROJ_EFF_BASE + PROJ_EFF_SPAN × 효율/100) */
export const PROJ_EFF_BASE = 0.8;
export const PROJ_EFF_SPAN = 0.4;
/** 예상 MVP 공헌 = 득점 + 리바×0.8 + 어시×1.2 + (스틸+블록)×1.5 + 종합 점수×0.2 */
export const MVP_WEIGHTS = { pts: 1, reb: 0.8, ast: 1.2, stocks: 1.5, score: 0.2 } as const;

const EFF = RADAR_AXES.indexOf("efficiency");
const r1 = (v: number) => Math.round(v * 10) / 10;

export interface ProjectedLine {
  id: string;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
}

export interface LineupProjection {
  rows: ProjectedLine[];
  /** 예상 MVP 선수 번호 */
  mvpId: string;
  /** 득점 몫을 나눴나 (원래 합 > 몫) */
  shared: boolean;
}

function share(players: readonly GameCandidate[], key: "ppg" | "rpg" | "apg", pool: number): number[] {
  const raw = players.map((p) => p[key]);
  const total = raw.reduce((s, v) => s + v, 0);
  if (total <= pool) return raw;
  const weights = players.map((p) => p[key] * (PROJ_EFF_BASE + (PROJ_EFF_SPAN * (p.axes[EFF] ?? 50)) / 100));
  const wsum = weights.reduce((s, v) => s + v, 0) || 1;
  // 원래 기록보다 늘지는 않게 — 넘친 몫은 버린다(합이 몫보다 조금 작아질 수 있다)
  return weights.map((w, i) => Math.min(raw[i], (pool * w) / wsum));
}

export function projectLineup(players: readonly GameCandidate[]): LineupProjection {
  const pts = share(players, "ppg", PROJ_POOL.pts);
  const reb = share(players, "rpg", PROJ_POOL.reb);
  const ast = share(players, "apg", PROJ_POOL.ast);
  const rows = players.map((p, i) => ({ id: p.id, ppg: r1(pts[i]), rpg: r1(reb[i]), apg: r1(ast[i]), spg: p.spg, bpg: p.bpg }));
  const value = (i: number) =>
    rows[i].ppg * MVP_WEIGHTS.pts +
    rows[i].rpg * MVP_WEIGHTS.reb +
    rows[i].apg * MVP_WEIGHTS.ast +
    (rows[i].spg + rows[i].bpg) * MVP_WEIGHTS.stocks +
    players[i].score * MVP_WEIGHTS.score;
  let best = 0;
  for (let i = 1; i < players.length; i++) if (value(i) > value(best)) best = i;
  return { rows, mvpId: players[best]?.id ?? "", shared: players.reduce((s, p) => s + p.ppg, 0) > PROJ_POOL.pts };
}
