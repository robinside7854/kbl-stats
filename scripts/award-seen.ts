// 수상 알림용 "처음 본 날" 기록 (2026-10-12 알림 ⑭). 공홈 수상 표에는 날짜가 없어서, process 가 돌 때마다
// 최근 시즌 수상 칸을 data/award-first-seen.json 과 비교해 새로 생긴 칸에 오늘(한국 날짜)을 적는다.
// 파일이 처음 만들어질 때 이미 있던 칸은 null(알리지 않음) — 지난 수상이 한꺼번에 소식이 되지 않게. 순수 함수.

/** 키 → 처음 본 한국 날짜 (null = 기록을 시작하기 전부터 있던 칸) */
export type AwardSeenState = Record<string, string | null>;

/** 최근 몇 시즌(시즌 코드 순번)의 수상만 지켜보나 */
export const AWARD_SEEN_SEASONS = 2;

export function awardSeenKey(seasonCode: number, key: string, playerNo: string, note: string | null): string {
  return `${seasonCode}:${key}:${playerNo}:${note ?? ""}`;
}

/**
 * 지켜보는 칸 목록으로 상태 갱신. prev 가 null(파일 없음)이면 지금 있는 칸을 모두 null 로.
 * 이번에 안 보인 칸도 지우지 않는다(한 시즌 가공이 실패한 날 지웠다가 다음 날 "새 수상"으로 알리지 않게).
 */
export function updateAwardSeen(prev: AwardSeenState | null, keys: readonly string[], today: string): AwardSeenState {
  const out: AwardSeenState = { ...(prev ?? {}) };
  for (const k of keys) if (!(k in out)) out[k] = prev === null ? null : today;
  return out;
}
