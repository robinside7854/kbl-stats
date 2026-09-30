// 슛 차트(서버 C api.kbl.or.kr) 수집 규칙 — 순수 함수만 (fetch.ts·backfill-shots.ts·테스트가 쓴다).
// KBL 원본 필드명(gmkey, gameCode, isEnded, shootLog …)은 이 파일에서만 다룬다 (CLAUDE.md 코딩 규칙).
//
// 응답 형태 (2026-09-30 Actions 러너 확인):
//   경기 목록 GET /match/list?fromDate=YYYYMMDD&toDate=YYYYMMDD&tcodeList=all
//     → 배열 [{ gmkey: "S49G14N1", seasonCode, gameCode("01" 정규), gameNo, gameDate, tcodeH, tcodeA, scoreH, scoreA, isEnded, … }]
//   슛 차트  GET /match/{gmkey}/match-chart
//     → { shootLog: [{ pcode, pname, ename, tcode, logs: [{ q, x, y, o: "O"|"X", d: "1"|"2" }] }], … }
// 이번 단계는 수집만 한다 — 좌표 해석(바스켓 위치·구역)은 실제 raw 를 받은 뒤 다음 단계에서.

type Raw = Record<string, any>;

/** 정규시즌 경기 구분 코드 (서버 C 경기 목록의 gameCode) */
export const REGULAR_GAME_CODE = "01";

/** 문자열로 한 번 더 감싼 응답이면 풀어 준다 (서버 B 에서 본 적 있는 형태 — 서버 C 도 방어) */
function unwrap(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

export interface MonthRange {
  /** "YYYYMMDD" */
  fromDate: string;
  /** "YYYYMMDD" (그 달 마지막 날) */
  toDate: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** year 년 month(1~12) 월 한 달 구간 */
export function monthRange(year: number, month: number): MonthRange {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { fromDate: `${year}${pad(month)}01`, toDate: `${year}${pad(month)}${pad(last)}` };
}

/**
 * 시즌 라벨(코드표 seasonName1) → 경기 목록을 받을 월 구간.
 * - "2025-2026" 꼴: 앞 해 9월 ~ 뒤 해 6월 (10개월 — 개막 10월·플레이오프 5월을 앞뒤로 한 달씩 여유)
 * - "1997" 꼴(한 해 시즌, 코드 1): 그 해 1월 ~ 12월 (12개월)
 * - 알 수 없는 꼴: 빈 배열
 * untilDate("YYYY-MM-DD")를 주면 그 날짜 이후에 시작하는 달은 뺀다 (매일 수집: 아직 오지 않은 달은 받지 않는다).
 */
export function seasonMonthRanges(label: string, untilDate?: string): MonthRange[] {
  const s = String(label ?? "").trim();
  const months: [number, number][] = [];
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})\s*-\s*(\d{4})$/))) {
    const y1 = Number(m[1]);
    const y2 = Number(m[2]);
    if (y2 !== y1 + 1) return [];
    for (let mo = 9; mo <= 12; mo++) months.push([y1, mo]);
    for (let mo = 1; mo <= 6; mo++) months.push([y2, mo]);
  } else if ((m = s.match(/^(\d{4})$/))) {
    const y = Number(m[1]);
    for (let mo = 1; mo <= 12; mo++) months.push([y, mo]);
  } else {
    return [];
  }
  const limit = untilDate ? untilDate.replace(/-/g, "") : null;
  return months.map(([y, mo]) => monthRange(y, mo)).filter((r) => !limit || r.fromDate <= limit);
}

/** 시즌 달 구간(seasonMonthRanges)의 마지막 날이 오늘보다 앞인가 — 비시즌에 끝난 시즌 목록을 매일 다시 받지 않으려고 */
export function seasonWindowClosed(label: string, today: string): boolean {
  const ranges = seasonMonthRanges(label);
  return ranges.length > 0 && ranges[ranges.length - 1].toDate < today.replace(/-/g, "");
}

/** 경기 목록 응답(한 달)이 정상 형식인가 — 배열(0경기 달도 정상). 문자열로 감싼 배열도 인정 */
export function isMatchListResponse(body: unknown): boolean {
  return Array.isArray(unwrap(body));
}

/** 월별 응답 여러 개 → 항목을 합친 배열 (각 항목은 원본 그대로 — list.json 에 저장하는 형태) */
export function mergeMatchLists(bodies: readonly unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const b of bodies) {
    const list = unwrap(b);
    if (Array.isArray(list)) out.push(...list);
  }
  return out;
}

/** 경기가 끝났는가. isEnded 가 있으면 그 값(true·"Y"·"1"·1·"true"), 없으면 경기 날짜가 오늘보다 앞이면 끝난 것으로 본다 */
export function isEndedGame(item: Raw, today?: string): boolean {
  const v = item?.isEnded;
  if (v !== undefined && v !== null && v !== "") {
    if (typeof v === "boolean") return v;
    return ["y", "1", "true", "t"].includes(String(v).trim().toLowerCase());
  }
  if (!today) return false;
  const d = String(item?.gameDate ?? "").replace(/\D/g, "");
  return d.length === 8 && d < today.replace(/-/g, "");
}

export interface RegularGame {
  gmkey: string;
  /** "YYYYMMDD" 또는 "" */
  gameDate: string;
  ended: boolean;
}

/**
 * 경기 목록(list.json 내용 또는 월별 응답을 합친 배열) → 그 시즌 정규시즌 경기.
 * 거르기: seasonCode 가 같고 gameCode === "01", gmkey 가 있는 항목. gmkey 중복은 처음 것만 (나온 순서 유지).
 * seasonCode 가 없는 항목은 gmkey 앞머리 "S{시즌}G" 로 판단한다.
 */
export function regularGamesOf(list: unknown, seasonCode: number, today?: string): RegularGame[] {
  const arr = unwrap(list);
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: RegularGame[] = [];
  for (const item of arr as Raw[]) {
    if (!item || typeof item !== "object") continue;
    const gmkey = String(item.gmkey ?? "").trim();
    if (!gmkey || seen.has(gmkey)) continue;
    const season = item.seasonCode !== undefined && item.seasonCode !== null && item.seasonCode !== ""
      ? Number(item.seasonCode)
      : Number(gmkey.match(/^S(\d+)G/i)?.[1] ?? NaN);
    if (season !== seasonCode) continue;
    if (String(item.gameCode ?? "").trim().padStart(2, "0") !== REGULAR_GAME_CODE) continue;
    seen.add(gmkey);
    out.push({ gmkey, gameDate: String(item.gameDate ?? "").replace(/\D/g, ""), ended: isEndedGame(item, today) });
  }
  return out;
}

/** 끝난 정규시즌 경기의 gmkey (슛 차트 수집 대상 후보) */
export function endedRegularGmkeys(list: unknown, seasonCode: number, today?: string): string[] {
  return regularGamesOf(list, seasonCode, today).filter((g) => g.ended).map((g) => g.gmkey);
}

/**
 * 목록이 "마감"됐는가 — 정규시즌 경기가 1개 이상이고 전부 끝났다.
 * 백필은 마감된 목록이 이미 있으면 월별 목록을 다시 받지 않는다 (이어받기 때 요청 10회 절약).
 */
export function isListFinal(list: unknown, seasonCode: number, today?: string): boolean {
  const games = regularGamesOf(list, seasonCode, today);
  return games.length > 0 && games.every((g) => g.ended);
}

/** 슛 차트 응답이 정상 형식인가 — 객체이고 shootLog 가 배열 */
export function isShotChartResponse(body: unknown): boolean {
  const o = unwrap(body);
  return !!o && typeof o === "object" && !Array.isArray(o) && Array.isArray((o as Raw).shootLog);
}

/** 슛 차트에 슛 기록(logs)이 한 개라도 있는가 — 빈 차트는 "아직 입력 전"일 수 있어 매일 수집에선 저장하지 않는다 */
export function shotChartHasLogs(body: unknown): boolean {
  if (!isShotChartResponse(body)) return false;
  const log = (unwrap(body) as Raw).shootLog as Raw[];
  return log.some((p) => Array.isArray(p?.logs) && p.logs.length > 0);
}

/** 이어받기: 이미 raw 파일("{gmkey}.json")이 있는 경기는 건너뛴다 */
export function pendingGames(gmkeys: readonly string[], existing: Iterable<string>): string[] {
  const have = new Set([...existing].map((f) => f.replace(/\.json$/, "")));
  return gmkeys.filter((k) => !have.has(k));
}

/**
 * 시즌 코드 → 라벨. 코드표 파일(data/codes/seasons.json, { data: [{ seasonCode, seasonName1 }] })이 우선, 없으면 백업 상수.
 */
export function seasonLabelOf(seasonCode: number, codesFile: unknown, fallback: Readonly<Record<number, string>>): string | null {
  const data = (unwrap(codesFile) as Raw | null)?.data;
  if (Array.isArray(data)) {
    const hit = data.find((d: Raw) => Number(d?.seasonCode) === seasonCode && typeof d?.seasonName1 === "string");
    if (hit) return hit.seasonName1;
  }
  return fallback[seasonCode] ?? null;
}
