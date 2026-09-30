// 한 경기 최다(서버 B mostgame) raw → 우리 키 변환 + 수집 대상 선정 규칙 — 순수 함수만 (fetch.ts·backfill-highs.ts·process.ts·테스트가 쓴다).
// KBL 원본 필드명(recordTxt, scoreRankCn, awayTeam …)은 이 파일에서만 다룬다 (CLAUDE.md 코딩 규칙).
//
// 응답 형태 (2026-09-30 Actions 러너 확인):
//   GET /api/v1/players/categories/mostgame/{seasonCode}/{playerNo}
//   → { MostGameRegularSeasons: [...], MostGameRegularAllTimes: [...], (플레이오프·챔프전 배열도 같은 형식) }
//   항목: { seasonCode, recordSc: "RECORD"|"RATE", recordTxt: "득점"…, record: "46.000", awayTeam: "70", gameDate: "20231021", scoreRankCn: 1, orderNo }
//   실제 키(2026-09-30 시즌 47 백필로 확인): MostGameRegularSeasons(그 시즌 정규 하이), MostGameRegularAllTimes(통산 정규),
//   MostGameRegularPlayoffs(통산 플레이오프), MostGameRegularChampions(통산 챔프전), MostGameDLeagueAlltimes(D리그 — 무시).
//   "Regular"는 접두어처럼 모든 키에 붙고, 구분은 그 뒤 단어(Playoffs/Champions)가 정한다. 리바운드 합계는 "전체 리바운드".

import { emptyHighsSet } from "../lib/highs.js";
import type { CareerHighs, HighKey, HighRecord, HighsSet } from "../lib/types.js";

type Raw = Record<string, any>;

/** KBL recordTxt → 우리 키. "필드골" = 야투 전체(2점+3점) — 같은 응답에 "2점슛"이 따로 있다 */
export const RECORD_TXT_TO_KEY: Readonly<Record<string, HighKey>> = {
  "득점": "pts",
  "필드골 성공": "fgm",
  "필드골 성공율": "fgPct",
  "2점슛 성공": "twoPm",
  "2점슛 성공율": "twoPPct",
  "3점슛 성공": "tpm",
  "3점슛 성공율": "tpPct",
  "자유투 성공": "ftm",
  "자유투 성공율": "ftPct",
  "공격 리바운드": "oreb",
  "수비 리바운드": "dreb",
  "전체 리바운드": "reb",
  "리바운드": "reb",
  "어시스트": "ast",
  "스틸": "stl",
  "블록": "blk",
};

/** recordTxt 표기 흔들림(공백·"성공률"/"성공율") 흡수 */
function normalizeTxt(t: unknown): string {
  return String(t ?? "").replace(/\s+/g, " ").trim().replace(/성공률$/, "성공율");
}
const TXT_NORMALIZED = new Map(Object.entries(RECORD_TXT_TO_KEY).map(([k, v]) => [normalizeTxt(k), v]));

export function recordKeyOf(recordTxt: unknown): HighKey | null {
  return TXT_NORMALIZED.get(normalizeTxt(recordTxt)) ?? null;
}

/** 응답이 JSON 문자열로 한 번 더 감싸져 있어도 푼다 (teams.json 에서 실제로 있었던 일) */
function unwrap(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/** "20231021" → "2023-10-21" (형식이 다르면 null) */
export function toIsoDate(v: unknown): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(v ?? "").trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function finiteOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 항목 하나 → 우리 기록 (값이 숫자가 아니면 null) */
export function toHighRecord(item: Raw): HighRecord | null {
  const value = finiteOrNull(item.record);
  if (value === null) return null;
  const opp = String(item.awayTeam ?? "").trim();
  return {
    value,
    date: toIsoDate(item.gameDate),
    opponentTeamCode: opp || null,
    times: finiteOrNull(item.scoreRankCn),
    seasonCode: finiteOrNull(item.seasonCode),
  };
}

/**
 * 배열 하나 → 부문별 세트. 같은 부문 항목이 여럿이면 값이 큰 것, 같으면 먼저 달성한 것.
 * 배열이 아니거나 비었으면 null (그 구분에 기록 없음).
 */
export function toHighsSet(list: unknown): HighsSet | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const set = emptyHighsSet();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const key = recordKeyOf((item as Raw).recordTxt);
    const rec = key ? toHighRecord(item as Raw) : null;
    if (!key || !rec) continue;
    const cur = set[key];
    if (!cur || rec.value > cur.value || (rec.value === cur.value && rec.date && (!cur.date || rec.date < cur.date))) set[key] = rec;
  }
  return set;
}

export type GameKind = "regular" | "playoff" | "finals";
export type HighsScope = "season" | "allTime";

/** 응답 키 이름 → (구분, 범위). MostGame… 꼴이 아니거나 구분을 모르면 null */
export function classifyMostGameKey(key: string): { game: GameKind; scope: HighsScope } | null {
  const k = key.trim();
  if (!/^MostGame/i.test(k)) return null;
  if (/dleague/i.test(k)) return null; // D리그는 범위 밖
  const rest = k.slice("MostGame".length);
  // 범위: "…Seasons"만 그 시즌, 나머지(AllTimes·Playoffs·Champions)는 통산
  const scope: HighsScope = /seasons?$/i.test(rest) ? "season" : "allTime";
  // 구분: 챔프전 → 플레이오프 → 정규 순으로 판정 ("Regular"가 접두어로 늘 붙으므로 마지막에 본다)
  // "PO" 약칭은 대문자 두 글자 + 다음 단어(대문자)로만 본다 — 대소문자 무시로 보면 "POAllTimes"의 뒤 글자를 단어로 오인하거나
  // 다른 단어 속 "po"(예: "Report")를 잘못 잡는다
  const isPlayoff = /play ?off/i.test(rest) || /(^|[^A-Za-z]|[a-z])PO([A-Z]|[^A-Za-z]|$)/.test(rest);
  const game: GameKind | null = /champ|final/i.test(rest) ? "finals" : isPlayoff ? "playoff" : /regular/i.test(rest) ? "regular" : null;
  return game ? { game, scope } : null;
}

/** 응답이 mostgame 형태인가 (MostGame… 배열이 하나라도 있으면) — 수집 때 이상한 응답(빈 문자열·HTML)을 저장하지 않으려고 */
export function isMostGameResponse(body: unknown): boolean {
  const o = unwrap(body);
  if (!o || typeof o !== "object" || Array.isArray(o)) return false;
  return Object.entries(o as Raw).some(([k, v]) => /^MostGame/i.test(k) && Array.isArray(v));
}

export interface ParsedMostGame {
  /** 요청한 시즌의 정규시즌 시즌 하이 */
  season: HighsSet | null;
  /** 통산 (정규·플레이오프·챔프전) */
  career: CareerHighs;
  /** 모르는 MostGame… 키 (경고용) */
  unknownKeys: string[];
}

/** mostgame raw 파일 내용(JSON.parse 결과) → 시즌 하이 + 통산. 형태가 다르면 전부 null */
export function parseMostGame(parsed: unknown): ParsedMostGame {
  const out: ParsedMostGame = { season: null, career: { regular: null, playoff: null, finals: null }, unknownKeys: [] };
  const o = unwrap(parsed);
  if (!o || typeof o !== "object" || Array.isArray(o)) return out;
  for (const [k, v] of Object.entries(o as Raw)) {
    if (!/^MostGame/i.test(k)) continue;
    if (/dleague/i.test(k)) continue; // D리그 배열은 범위 밖이라 경고 없이 넘긴다
    const c = classifyMostGameKey(k);
    if (!c) {
      out.unknownKeys.push(k);
      continue;
    }
    const set = toHighsSet(unwrap(v));
    if (c.scope === "allTime") out.career[c.game] = set;
    else if (c.game === "regular") out.season = set;
    // 플레이오프·챔프전의 "그 시즌" 배열은 이번 범위에서 쓰지 않는다 (정규시즌만 화면 — SCOPE.md)
  }
  return out;
}

/** 통산 세트가 하나라도 있으면 true */
export function hasCareerHighs(c: CareerHighs): boolean {
  return !!(c.regular || c.playoff || c.finals);
}

// ─────────────────────────────────────────────
// 수집 대상 선정 (매일 수집 — fetch.ts)
// ─────────────────────────────────────────────

/**
 * 직전 시즌을 매일 수집에 남겨 두는 기간(일). 최신 시즌을 처음 수집한 날(개막 직후)부터 이 일수 동안은
 * 직전 시즌 선수의 한 경기 최다도 같이 받는다 — 개막 전후 비시즌 동안 바뀐 통산 기록(플레이오프 등)을 놓치지 않으려고.
 * 그 뒤로는 직전 시즌이 "마감"되어 다시 받지 않는다 (필요하면 백필 워크플로).
 */
export const PREVIOUS_SEASON_GRACE_DAYS = 30;

/** "YYYY-MM-DD" 두 날짜 사이 일수 (b - a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export interface HighsTargetInput {
  /** 코드표의 시즌과 그 시즌 raw 선수 수 (raw 가 없으면 0) */
  seasons: readonly { seasonCode: number; playerCount: number }[];
  /** 시즌 코드 → 선수가 처음 1명 이상 수집된 날 (data/season-first-seen.json) */
  firstSeen: Readonly<Record<string, string>>;
  /** 오늘 "YYYY-MM-DD" */
  today: string;
  graceDays?: number;
}

/**
 * 매일 한 경기 최다를 받을 시즌:
 * - 코드표 최신 시즌에 선수가 있으면(시즌 중) → 최신 시즌. 그리고 최신 시즌 첫 수집일로부터 graceDays 일 미만이면
 *   선수가 있는 그 전 시즌도 (개막 직후 한 달).
 * - 최신 시즌이 아직 0명(개막 전)이면 → 선수가 있는 가장 최근 시즌 하나 (직전 시즌이 아직 "현재").
 * - 그 밖의 옛 시즌은 받지 않는다 (마감 — 백필 워크플로가 한 번 받는다).
 * 첫 수집일이 기록돼 있지 않으면 오늘로 본다(→ 직전 시즌 포함).
 */
export function highsTargetSeasons(input: HighsTargetInput): number[] {
  const grace = input.graceDays ?? PREVIOUS_SEASON_GRACE_DAYS;
  const sorted = [...input.seasons].sort((a, b) => b.seasonCode - a.seasonCode);
  const withPlayers = sorted.filter((s) => s.playerCount > 0);
  if (withPlayers.length === 0) return [];
  const latest = sorted[0];
  if (latest.playerCount === 0) return [withPlayers[0].seasonCode];
  const first = input.firstSeen[String(latest.seasonCode)] ?? input.today;
  const prev = withPlayers.find((s) => s.seasonCode < latest.seasonCode);
  return prev && daysBetween(first, input.today) < grace ? [latest.seasonCode, prev.seasonCode] : [latest.seasonCode];
}

/** 시즌 첫 수집일 기록: 선수가 1명 이상이고 아직 기록이 없을 때만 오늘 날짜를 넣은 새 객체 */
export function updateFirstSeen(
  firstSeen: Readonly<Record<string, string>>,
  seasonCode: number,
  playerCount: number,
  today: string,
): Record<string, string> {
  const key = String(seasonCode);
  if (playerCount <= 0 || firstSeen[key]) return { ...firstSeen };
  return { ...firstSeen, [key]: today };
}

/** raw traditional_regular.json 내용 → 선수 번호(중복 제거, 나온 순서) */
export function playerNosFromTraditional(parsed: unknown): string[] {
  const data = (unwrap(parsed) as Raw | null)?.data;
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  for (const r of data) {
    const no = String(r?.playerNo ?? "").trim();
    if (no) seen.add(no);
  }
  return [...seen];
}

/** 백필 이어받기: 이미 raw 파일이 있는 선수는 건너뛴다 (existing = 저장된 파일 이름 "{선수}.json" 또는 선수 번호) */
export function pendingPlayers(playerNos: readonly string[], existing: Iterable<string>): string[] {
  const have = new Set([...existing].map((f) => f.replace(/\.json$/, "")));
  return playerNos.filter((no) => !have.has(no));
}

/** 오늘 날짜 "YYYY-MM-DD" (한국 시간 — 수집은 04:10 KST) */
export function todayKst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
