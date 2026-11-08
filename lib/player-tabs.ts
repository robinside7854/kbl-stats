// 선수 상세 탭 (2026-11-08 사용자: "정보가 많아 스크롤이 길면 이탈한다 — 탭으로 정리").
// 한 번에 한 묶음만 보인다. 주소 ?tab= 에 남긴다(기본 탭은 생략). 순수 함수만 — 화면은 app/components/PlayerTabs.
// GA4: filter_change screen=player filter=tab value=키

export type PlayerTabKey = "season" | "ability" | "shots" | "career" | "moments";

export interface PlayerTabDef {
  key: PlayerTabKey;
  label: string;
  /** 시즌 칩을 쓰는 탭 (카드 시즌을 따른다) */
  seasonal: boolean;
}

/** 탭 순서 = 화면 순서 */
export const PLAYER_TABS: PlayerTabDef[] = [
  { key: "season", label: "시즌", seasonal: true }, // 시즌 카드 · 하이라이트 · 최근 경기
  { key: "ability", label: "능력치", seasonal: true }, // 세부 능력치 · 경기별 기록 범위 · 비슷한 시즌
  { key: "shots", label: "슛", seasonal: true }, // 슛 차트 · 슛 습관의 변화
  { key: "career", label: "커리어", seasonal: false }, // 시즌별 추이 · 기록표 · 타임라인
  { key: "moments", label: "명장면", seasonal: false }, // 커리어 하이 · 클러치
];

export const DEFAULT_PLAYER_TAB: PlayerTabKey = "season";

/** 이 선수에게 보일 탭 (내용이 없는 탭은 뺀다) */
export function availablePlayerTabs(has: { card: boolean; shots: boolean; moments: boolean }): PlayerTabKey[] {
  return PLAYER_TABS.filter((t) => {
    if (t.key === "season" || t.key === "ability") return has.card;
    if (t.key === "shots") return has.card && has.shots;
    if (t.key === "moments") return has.moments;
    return true;
  }).map((t) => t.key);
}

/** 첫 탭 (보일 탭 중 첫째) */
export const firstPlayerTab = (available: readonly PlayerTabKey[]): PlayerTabKey => available[0] ?? "career";

/** 쿼리 ?tab= → 탭. 없거나 이 선수에게 없는 탭이면 첫 탭 */
export function parsePlayerTab(search: string, available: readonly PlayerTabKey[]): PlayerTabKey {
  const v = new URLSearchParams(search).get("tab");
  return available.find((k) => k === v) ?? firstPlayerTab(available);
}

export const isSeasonalTab = (key: PlayerTabKey) => PLAYER_TABS.some((t) => t.key === key && t.seasonal);

/**
 * 지금 쿼리에서 몇 개 키만 바꾼다 (null = 지움). 탭과 카드 시즌이 같은 주소를 같이 쓰므로 서로의 키를 지우지 않게.
 * 예: mergeQuery("?season=45", { tab: "shots" }) → "?season=45&tab=shots"
 */
export function mergeQuery(search: string, patch: Record<string, string | null>): string {
  const qs = new URLSearchParams(search);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) qs.delete(k);
    else qs.set(k, v);
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

/** 탭 → 쿼리 조각 (첫 탭이면 지움) */
export const tabQueryPatch = (tab: PlayerTabKey, available: readonly PlayerTabKey[]) => ({ tab: tab === firstPlayerTab(available) ? null : tab });
