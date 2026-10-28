// 문자중계(서버 C api.kbl.or.kr, 공홈 경기 기록 "문자중계" 탭) 수집·해석 규칙 — 순수 함수만 (collect-textcast·backfill-textcast·process·테스트).
// KBL 원본 필드명(n, q, m, s, p, t, a …)은 이 파일에서만 다룬다 (CLAUDE.md 코딩 규칙). 판정(클러치·위닝샷)은 lib/clutch.ts.
//
// 응답 형태 (2026-10-28 Actions 러너 확인, 2006-07~2026-27 11경기):
//   GET /match/{gmkey}/text-cast?quarterList=Q4
//     → 배열 [{ n: 412(경기 안 순번), q: "Q4"|"X1"(연장), m: 9, s: 55(그 쿼터 남은 분·초 — 초 단위까지만, 0.x 초는 없다),
//              p: "이정현"(선수 이름, 선수 번호는 없다), e(영문), t: "66"(팀 코드), a: "205"(동작 코드), f(파울 종류), c(교체 꼬리표) }]
//   quarterList 를 빼면 마지막 쿼터만 온다(연장이 있으면 마지막 연장). 2005-06 이전 시즌은 빈 배열.
// 동작 코드(공홈 화면 번들 gameActionCodeList): 201 2점 성공·202 2점 실패·203 자유투 성공·204 자유투 실패·205 3점 성공·206 3점 실패·
//   207 덩크 성공·208 덩크 실패·009 게임 종료·101/102 교체 … — 성공·실패 개수가 박스스코어와 같은 것을 3경기로 확인(2026-10-28).
// 수집 범위: 4쿼터 + 연장만 (클러치·위닝샷은 4쿼터·연장 마지막 2분 — 경기당 보통 1회 요청). 4쿼터 시작 점수는 최종 점수에서 거꾸로 뺀다.
import type { GameSide, TextCastAction, TextCastEvent } from "../lib/types.js";
import { isEndedGame } from "./shots.js";
import { toIsoDate } from "./highs.js";

type Raw = Record<string, any>;

/** 문자중계가 있는 첫 시즌 (2006-07, 코드 11 — 2026-10-28 조사: 코드 1·5·10 은 빈 배열, 11 부터 있음. 슛 차트와 같은 범위) */
export const TEXTCAST_FIRST_SEASON = 11;

/** 4쿼터 */
export const FOURTH_QUARTER = "Q4";

function unwrap(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/** 응답이 정상 형식인가 — 배열(빈 배열도 정상: 옛 시즌) */
export function isTextCastResponse(body: unknown): body is unknown[] {
  return Array.isArray(unwrap(body));
}

const itemsOf = (body: unknown): Raw[] => {
  const arr = unwrap(body);
  return Array.isArray(arr) ? (arr.filter((x) => x && typeof x === "object") as Raw[]) : [];
};

/** 응답의 쿼터 ("Q4"·"X1" …, 첫 항목 기준). 빈 응답이면 null */
export function quarterOf(body: unknown): string | null {
  const q = itemsOf(body)[0]?.q;
  return typeof q === "string" && q ? q : null;
}

/** 응답에 게임 종료(009)가 있는가 — 없으면 아직 입력 중일 수 있어 매일 수집에선 저장하지 않는다 */
export function hasGameEnd(body: unknown): boolean {
  return itemsOf(body).some((x) => String(x.a) === "009");
}

/**
 * 마지막 쿼터(쿼리 없이 받은 응답의 쿼터) → 더 받을 쿼터. 4쿼터면 없음, "X2"(2차 연장)면 Q4·X1.
 * 4쿼터 앞(Q1~Q3 — 비정상)이나 모르는 꼴이면 없음.
 */
export function extraQuarters(last: string): string[] {
  const m = /^X(\d+)$/.exec(last);
  if (!m) return [];
  const n = Number(m[1]);
  return [FOURTH_QUARTER, ...Array.from({ length: n - 1 }, (_, i) => `X${i + 1}`)];
}

/** 쿼터별 응답(받은 순서 무관) → 저장할 배열 (항목 원본 그대로 이어 붙임, 쿼터 순: Q4 → X1 → X2 …) */
export function mergeQuarters(bodies: readonly unknown[]): Raw[] {
  const rank = (q: string | null) => (q === FOURTH_QUARTER ? 0 : Number(/^X(\d+)$/.exec(q ?? "")?.[1] ?? 99));
  return [...bodies].sort((a, b) => rank(quarterOf(a)) - rank(quarterOf(b))).flatMap(itemsOf);
}

const ACTIONS: Record<string, TextCastAction> = {
  "201": "made2", "202": "miss2", "203": "madeFt", "204": "missFt", "205": "made3", "206": "miss3", "207": "madeDunk", "208": "missDunk",
  "009": "end", "101": "subIn", "102": "subOut", "211": "assist", "003": "timeout",
  "209": "rebound", "210": "rebound", "218": "rebound", "212": "steal", "214": "turnover", "223": "turnover",
  "215": "foul", "216": "foul", "224": "foul", "225": "foul",
};

/** raw(저장된 배열) → 우리 이벤트 (경기 안 순번 순). 형태가 다르면 빈 배열 */
export function parseTextCast(raw: unknown): TextCastEvent[] {
  return itemsOf(raw)
    .map((x) => ({
      seq: Number(x.n),
      period: String(x.q ?? ""),
      remaining: Number(x.m) * 60 + Number(x.s),
      nameKo: typeof x.p === "string" ? x.p.trim() : "",
      teamCode: String(x.t ?? ""),
      action: ACTIONS[String(x.a)] ?? "other",
    }))
    .filter((e) => Number.isFinite(e.seq) && Number.isFinite(e.remaining) && e.period !== "")
    .sort((a, b) => a.seq - b.seq);
}

/** 플레이오프 경기 구분 — "03" 6강·4강, "04" 챔피언결정전 (경기 목록 gameCode, 2026-10-28 사용자: 플레이오프 위닝샷도) */
export const PLAYOFF_GAME_CODES: Readonly<Record<string, "playoff" | "finals">> = { "03": "playoff", "04": "finals" };

export interface PlayoffGame {
  gmkey: string;
  /** "2026-04-12" */
  date: string;
  /** 6강·4강 = playoff, 챔프전 = finals */
  stage: "playoff" | "finals";
  ended: boolean;
  home: GameSide;
  away: GameSide;
}

/**
 * 경기 목록 → 그 시즌 플레이오프 경기 (날짜·번호 순). 목록에는 같은 기간 다른 대회(짝수 시즌 코드, 예: S48G03N1)도 섞여 있어
 * seasonCode 가 같은 것만 (gmkey 앞머리가 아니라 항목의 seasonCode — scripts/champions.ts playoffEntries 와 같은 규칙).
 */
export function playoffGamesOf(list: unknown, seasonCode: number, today?: string): PlayoffGame[] {
  const arr = Array.isArray(list) ? list : [];
  const seen = new Set<string>();
  const out: PlayoffGame[] = [];
  const num = (v: unknown) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
  for (const item of arr as Raw[]) {
    if (!item || typeof item !== "object" || Number(item.seasonCode) !== seasonCode) continue;
    const stage = PLAYOFF_GAME_CODES[String(item.gameCode ?? "").trim().padStart(2, "0")];
    const gmkey = String(item.gmkey ?? "").trim();
    const date = toIsoDate(item.gameDate);
    if (!stage || !gmkey || !date || seen.has(gmkey)) continue;
    seen.add(gmkey);
    out.push({
      gmkey,
      date,
      stage,
      ended: isEndedGame(item, today),
      home: { teamCode: String(item.tcodeH ?? ""), name: String(item.tnameH ?? ""), score: num(item.scoreH) },
      away: { teamCode: String(item.tcodeA ?? ""), name: String(item.tnameA ?? ""), score: num(item.scoreA) },
    });
  }
  const no = (g: PlayoffGame) => Number(/N(\d+)$/.exec(g.gmkey)?.[1] ?? 0);
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.stage.localeCompare(b.stage) || no(a) - no(b));
}
