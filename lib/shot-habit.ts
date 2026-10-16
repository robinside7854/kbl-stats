// 슛 습관의 변화 (2026-10-16 "우리만의 기능"): 시즌마다 슛을 어디서 던졌나(구역 5개 비중)를 나란히. 순수 함수만.
// 재료: 시즌 파일 players[].shotZones (공홈 슛 차트, 2006-07 부터). 화면 app/components/ShotHabit.
import { seasonShortLabel } from "./career";
import { SHOT_ZONES, type ShotZoneKey as ZoneKey, type ShotZoneSummary } from "./shots";

/** 이 시즌을 줄로 넣는 최소 슛 수 (주 공격 유형과 같은 기준 — 적으면 비중이 흔들린다) */
export const SHOT_HABIT_MIN_ATTEMPTS = 50;
/** 줄이 이만큼 있어야 섹션을 보인다 */
export const SHOT_HABIT_MIN_SEASONS = 2;
/** 한마디: 묶음 비중이 이만큼(%p) 안 바뀌면 "거의 그대로" */
export const SHOT_HABIT_CHANGE_MIN = 5;

export interface ShotHabitRow {
  seasonCode: number;
  /** "25-26" */
  season: string;
  attempts: number;
  /** 구역별 비중 0~100, 소수 1자리 (SHOT_ZONES 순서 — 페이지 데이터를 작게) */
  shares: Record<ZoneKey, number>;
}

/** 시즌 오름차순 재료 → 슛이 충분한 시즌만 */
export function shotHabitRows(
  seasons: readonly { seasonCode: number; seasonLabel: string; shotZones?: ShotZoneSummary | null }[],
): ShotHabitRow[] {
  const out: ShotHabitRow[] = [];
  for (const s of [...seasons].sort((a, b) => a.seasonCode - b.seasonCode)) {
    const z = s.shotZones;
    const n = z?.total.attempts ?? 0;
    if (!z || n < SHOT_HABIT_MIN_ATTEMPTS) continue;
    const shares = {} as Record<ZoneKey, number>;
    for (const d of SHOT_ZONES) shares[d.key] = Math.round((z.zones[d.key].a / n) * 1000) / 10;
    out.push({ seasonCode: s.seasonCode, season: seasonShortLabel(s.seasonLabel), attempts: n, shares });
  }
  return out;
}

/** 한마디용 묶음 세 개: 안쪽(골밑+페인트) · 미드레인지 · 3점(코너+아크) */
export const SHOT_HABIT_GROUPS: readonly { key: "inside" | "mid" | "three"; label: string; zones: readonly ZoneKey[] }[] = [
  { key: "three", label: "3점", zones: ["corner3", "arc3"] },
  { key: "inside", label: "골밑·페인트", zones: ["rim", "paint"] },
  { key: "mid", label: "미드레인지", zones: ["mid"] },
];

export const groupShare = (r: ShotHabitRow, zones: readonly ZoneKey[]) => zones.reduce((s, k) => s + r.shares[k], 0);

/**
 * 첫 줄과 마지막 줄을 비교한 한마디. 가장 많이 바뀐 묶음 하나:
 * "3점 비중 2% → 28%로 늘었어요 (18-19 → 25-26)". 바뀐 폭이 SHOT_HABIT_CHANGE_MIN 미만이면 "거의 그대로". 줄이 2개 미만이면 null
 */
export function shotHabitTakeaway(rows: readonly ShotHabitRow[]): string | null {
  if (rows.length < SHOT_HABIT_MIN_SEASONS) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const span = `${first.season} → ${last.season}`;
  let best: { label: string; from: number; to: number } | null = null;
  for (const g of SHOT_HABIT_GROUPS) {
    const from = Math.round(groupShare(first, g.zones));
    const to = Math.round(groupShare(last, g.zones));
    if (!best || Math.abs(to - from) > Math.abs(best.to - best.from)) best = { label: g.label, from, to };
  }
  if (!best || Math.abs(best.to - best.from) < SHOT_HABIT_CHANGE_MIN) return `${span}, 슛 던지는 곳이 거의 그대로예요`;
  return `${best.label} 비중 ${best.from}% → ${best.to}%로 ${best.to > best.from ? "늘었어요" : "줄었어요"} (${span})`;
}
