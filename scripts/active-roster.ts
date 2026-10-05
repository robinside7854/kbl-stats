// KBL 현역 등록 명단(서버 B 선수 마스터 regSc=Y) 주 1회 확인 규칙 — 순수 함수 (2026-10-06 사용자 결정).
// 명단은 갱신 주기가 따로 없다(응답에 Last-Modified·ETag 없음, 부를 때마다 KBL DB 값 — 2026-10-05 조사).
// 그래서 매일 받지 않고 일주일에 한 번 받아, 바뀌었을 때만 raw(data/raw/players/active.json)를 다시 쓰고
// 바뀐 날·들어온/빠진 선수를 기록(data/active-roster-log.json)한다 — 쌓이면 KBL 이 언제 명단을 고치는지 보인다.
// 수집 루프는 scripts/fetch.ts fetchActiveRoster, 화면 쪽 상태 판정은 lib/roster rosterStatusOf.

/** 확인 간격 (일) */
export const ROSTER_CHECK_DAYS = 7;
/** 기록에 남기는 변경 수 상한 (오래된 것부터 버림) */
export const ROSTER_LOG_MAX = 200;

export interface RosterChange {
  /** 바뀐 것을 처음 본 날 (한국 날짜 "YYYY-MM-DD") */
  date: string;
  /** 그날 등록 인원 */
  count: number;
  /** 새로 들어온 · 빠진 선수 번호 */
  added: string[];
  removed: string[];
  /** 계속 있는 선수 중 팀·등번호 등이 바뀐 수 */
  updated: number;
}

export interface RosterLog {
  /** 마지막으로 확인한 날 (바뀌지 않았어도 갱신) */
  checkedAt: string | null;
  /** 오래된 것 먼저 */
  changes: RosterChange[];
}

export const EMPTY_ROSTER_LOG: RosterLog = { checkedAt: null, changes: [] };

/** 날짜 두 개("YYYY-MM-DD") 사이 일수 */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** 오늘 확인할 차례인지: 확인한 적이 없거나, 마지막 확인 뒤 7일 이상 지났으면 */
export function rosterCheckDue(checkedAt: string | null | undefined, today: string, days = ROSTER_CHECK_DAYS): boolean {
  if (!checkedAt || !/^\d{4}-\d{2}-\d{2}$/.test(checkedAt)) return true;
  return daysBetween(checkedAt, today) >= days;
}

type Row = Record<string, unknown>;
const idOf = (r: Row) => String(r.playerNo ?? "");

/** 선수 번호 → 행(줄 순서·rowNo 처럼 순서만 뜻하는 값은 빼고 비교) */
function byId(rows: readonly Row[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rows) {
    const id = idOf(r);
    if (!id) continue;
    const { rowNo: _rowNo, ...rest } = r;
    out.set(id, JSON.stringify(Object.keys(rest).sort().map((k) => [k, rest[k]])));
  }
  return out;
}

/** 지난 명단(없으면 null) → 새 명단의 차이. 바뀐 게 없으면 null */
export function rosterChange(oldRows: readonly Row[] | null, newRows: readonly Row[], date: string): RosterChange | null {
  const before = byId(oldRows ?? []);
  const after = byId(newRows);
  const added = [...after.keys()].filter((id) => !before.has(id)).sort();
  const removed = [...before.keys()].filter((id) => !after.has(id)).sort();
  let updated = 0;
  for (const [id, v] of after) if (before.has(id) && before.get(id) !== v) updated++;
  if (oldRows && added.length === 0 && removed.length === 0 && updated === 0) return null;
  return { date, count: after.size, added, removed, updated };
}

/** 확인 한 번 반영: 바뀌었으면 기록 추가(+ 저장해야 함), 아니면 확인 날짜만 */
export function applyRosterCheck(
  log: RosterLog,
  oldRows: readonly Row[] | null,
  newRows: readonly Row[],
  today: string,
): { log: RosterLog; changed: RosterChange | null } {
  const changed = rosterChange(oldRows, newRows, today);
  const changes = changed ? [...log.changes, changed].slice(-ROSTER_LOG_MAX) : log.changes;
  return { log: { checkedAt: today, changes }, changed };
}
