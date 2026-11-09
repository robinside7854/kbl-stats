// 54-0 "이 팀에서의 예상 기록"·예상 MVP (2026-11-08 사용자 결정, 2026-11-09 다시 짬) — 순수 함수만.
// 올스타끼리 모이면 공·리바운드·수비 기회를 나눠 가진다. 다섯 기록(득점·리바·어시·스틸·블록) 모두 같은 두 단계로 바뀐다:
//   ① 팀 몫: 주전 다섯 명이 한 경기에 가져가는 몫(PROJ_POOL, 우리 가정 — 아래)과 다섯 명 원래 합을 견준다.
//      합이 몫보다 크면 줄고, 작으면 조금 는다: 팀 합 = 원래 합 × (몫 ÷ 원래 합)^PROJ_POOL_POWER, PROJ_TEAM_MIN~MAX 배 안.
//   ② 팀 안 나누기: 그 기록에 맞는 능력 축(PROJ_AXIS — 득점은 공격·효율, 리바는 리바운드, 어시는 리딩, 스틸·블록은 수비)이
//      팀 안에서 높은 선수일수록 더 가져간다. 무게 = 원래 기록 × (PROJ_AXIS_BASE + PROJ_AXIS_SPAN × 축/100).
//      한 사람 변화는 원래의 PROJ_PLAYER_MIN~MAX 배 안.
//   몫(PROJ_POOL): 2026-11-09 실제 풀에서 숨은 점수 상위 400명으로 무작위 다섯 명 3,000번 — 합의 가운데값 득점 77·리바 27·
//   어시 18·스틸 6.4·블록 2.4. KBL 팀 한 경기 득점이 80점 안팎이고 주전이 40분 중 약 30분을 뛰므로 주전 몫은 60점대 —
//   역대급 다섯 명이 더 오래 뛰고 잘 넣는다고 보고 득점 70·리바 30·어시 16·스틸 6·블록 2.6 으로 잡았다.
// 예상 MVP = 예상 기록으로 매긴 공헌(MVP_WEIGHTS) + 숨은 종합 점수 조금 — 가장 높은 선수.
import { RADAR_AXES, type RadarAxis } from "./metrics";
import type { GameCandidate } from "./game";

export type ProjStat = "ppg" | "rpg" | "apg" | "spg" | "bpg";
export const PROJ_STATS: readonly ProjStat[] = ["ppg", "rpg", "apg", "spg", "bpg"];

export const PROJ_POOL: Record<ProjStat, number> = { ppg: 70, rpg: 30, apg: 16, spg: 6, bpg: 2.6 };
export const PROJ_POOL_POWER = 0.8;
export const PROJ_TEAM_MIN = 0.75;
export const PROJ_TEAM_MAX = 1.1;
/** 기록마다 몫을 가르는 능력 축 (둘이면 평균) */
export const PROJ_AXIS: Record<ProjStat, readonly RadarAxis[]> = {
  ppg: ["offense", "efficiency"],
  rpg: ["rebound"],
  apg: ["playmaking"],
  spg: ["defense"],
  bpg: ["defense"],
};
export const PROJ_AXIS_BASE = 0.7;
export const PROJ_AXIS_SPAN = 0.6;
export const PROJ_PLAYER_MIN = 0.65;
export const PROJ_PLAYER_MAX = 1.2;
/** 예상 MVP 공헌 = 득점 + 리바×0.8 + 어시×1.2 + (스틸+블록)×1.5 + 종합 점수×0.2 */
export const MVP_WEIGHTS = { pts: 1, reb: 0.8, ast: 1.2, stocks: 1.5, score: 0.2 } as const;

const r1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

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
  /** 기록마다 팀 합 배율 (몫 ÷ 원래 합에서 온 값 — 1 보다 작으면 나눠 가져 줄었다) */
  teamFactor: Record<ProjStat, number>;
}

function axisOf(p: GameCandidate, stat: ProjStat): number {
  const axes = PROJ_AXIS[stat];
  return axes.reduce((s, a) => s + (p.axes[RADAR_AXES.indexOf(a)] ?? 50), 0) / axes.length;
}

/** 한 기록을 팀 몫에 맞춰 다시 나눈다 → [선수별 값, 팀 배율] */
export function shareStat(players: readonly GameCandidate[], stat: ProjStat): { values: number[]; factor: number } {
  const raw = players.map((p) => p[stat]);
  const total = raw.reduce((s, v) => s + v, 0);
  if (total <= 0) return { values: raw, factor: 1 };
  const factor = clamp((PROJ_POOL[stat] / total) ** PROJ_POOL_POWER, PROJ_TEAM_MIN, PROJ_TEAM_MAX);
  const target = total * factor;
  const weights = players.map((p, i) => raw[i] * (PROJ_AXIS_BASE + (PROJ_AXIS_SPAN * axisOf(p, stat)) / 100));
  const wsum = weights.reduce((s, v) => s + v, 0) || 1;
  const values = weights.map((w, i) => clamp((target * w) / wsum, raw[i] * PROJ_PLAYER_MIN, raw[i] * PROJ_PLAYER_MAX));
  return { values, factor };
}

export function projectLineup(players: readonly GameCandidate[]): LineupProjection {
  const shared = Object.fromEntries(PROJ_STATS.map((k) => [k, shareStat(players, k)])) as Record<ProjStat, ReturnType<typeof shareStat>>;
  const rows: ProjectedLine[] = players.map((p, i) => ({
    id: p.id,
    ppg: r1(shared.ppg.values[i]),
    rpg: r1(shared.rpg.values[i]),
    apg: r1(shared.apg.values[i]),
    spg: r1(shared.spg.values[i]),
    bpg: r1(shared.bpg.values[i]),
  }));
  let best = 0;
  for (let i = 1; i < players.length; i++) if (mvpValue(rows[i], players[i]) > mvpValue(rows[best], players[best])) best = i;
  const teamFactor = Object.fromEntries(PROJ_STATS.map((k) => [k, shared[k].factor])) as Record<ProjStat, number>;
  return { rows, mvpId: players[best]?.id ?? "", teamFactor };
}

/** MVP 공헌 (예상 기록 한 줄 + 종합 점수) — 플레이오프 시리즈 MVP 도 같은 식 */
export function mvpValue(l: Omit<ProjectedLine, "id">, p: { score: number }): number {
  return l.ppg * MVP_WEIGHTS.pts + l.rpg * MVP_WEIGHTS.reb + l.apg * MVP_WEIGHTS.ast + (l.spg + l.bpg) * MVP_WEIGHTS.stocks + p.score * MVP_WEIGHTS.score;
}

/** 변화 글자 "+1.3" · "−2.2" · "0" (0.05 미만은 0) */
export function deltaText(v: number): string {
  const d = r1(v);
  if (Math.abs(d) < 0.05) return "0";
  return `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}`;
}
