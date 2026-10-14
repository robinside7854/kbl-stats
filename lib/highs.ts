// 한 경기 최다(시즌 하이·커리어 하이) 규칙 — 순수 함수만 (CLAUDE.md 원칙 5).
// KBL 원본 필드명(recordTxt 등)은 모른다 — raw → 우리 키 변환은 scripts/highs.ts 가 한다.
// process.ts(시즌 하이 1위 계산)와 화면(순위표 "이 시즌 한 경기 최다" 카드 줄, 선수 페이지 커리어 하이 표)이 같이 쓴다.

import type { HighKey, HighRecord, HighsSet, SeasonHighLeader, SeasonHighLeaderKey, SeasonHighLeaders } from "./types";

export interface HighDef {
  key: HighKey;
  /** 부문 이름, 예: "3점슛 성공" */
  label: string;
  /** record: 개수 / rate: 성공률(%) — 성공률은 시도 수 조건이 없어(1/1 = 100%) 순위표에는 쓰지 않는다 */
  kind: "record" | "rate";
}

/** 표시 순서 = 배열 순서 (KBL 공홈 선수 상세 "한경기최다" 순서) */
export const HIGH_DEFS: readonly HighDef[] = [
  { key: "pts", label: "득점", kind: "record" },
  { key: "fgm", label: "야투 성공", kind: "record" },
  { key: "fgPct", label: "야투 성공률", kind: "rate" },
  { key: "twoPm", label: "2점슛 성공", kind: "record" },
  { key: "twoPPct", label: "2점슛 성공률", kind: "rate" },
  { key: "tpm", label: "3점슛 성공", kind: "record" },
  { key: "tpPct", label: "3점슛 성공률", kind: "rate" },
  { key: "ftm", label: "자유투 성공", kind: "record" },
  { key: "ftPct", label: "자유투 성공률", kind: "rate" },
  { key: "oreb", label: "공격 리바운드", kind: "record" },
  { key: "dreb", label: "수비 리바운드", kind: "record" },
  { key: "reb", label: "리바운드", kind: "record" },
  { key: "ast", label: "어시스트", kind: "record" },
  { key: "stl", label: "스틸", kind: "record" },
  { key: "blk", label: "블록", kind: "record" },
];

export const HIGH_KEYS: readonly HighKey[] = HIGH_DEFS.map((d) => d.key);
const DEF_BY_KEY = new Map(HIGH_DEFS.map((d) => [d.key, d]));

export function highDef(key: HighKey): HighDef {
  return DEF_BY_KEY.get(key)!;
}

/**
 * 시즌 하이 1위(seasonHighLeaders)를 계산하는 부문 11개 — 기록(RECORD)만. 데이터는 11개 다 만들고, 화면 카드 줄은 HERO_HIGH_KEYS 7개만 쓴다.
 * 순서는 팬이 먼저 찾는 것부터
 * (득점·리바운드·어시스트·스틸·블록 → 슛 성공 → 공격/수비 리바운드).
 */
export const SEASON_HIGH_LEADER_KEYS: readonly SeasonHighLeaderKey[] = [
  "pts", "reb", "ast", "stl", "blk", "fgm", "twoPm", "tpm", "ftm", "oreb", "dreb",
];

/**
 * 화면에 보여 주는 한 경기 최다 부문 7개 (2026-09-30 사용자 요청): 득점·리바운드·어시스트·스틸·블록·3점 성공·자유투 성공.
 * 선수 상세 "커리어 하이" 표, 순위표 "이 시즌 한 경기 최다" 카드 줄, 하이라이트 카드 대체 목록이 이 순서로 쓴다.
 * 나머지(야투·2점 성공, 성공률 4개, 공격/수비 리바운드)는 processed 데이터에는 그대로 남기고 화면에서만 뺀다.
 */
export const HERO_HIGH_KEYS: readonly SeasonHighLeaderKey[] = ["pts", "reb", "ast", "stl", "blk", "tpm", "ftm"];

/** 모든 부문이 null 인 세트 */
export function emptyHighsSet(): HighsSet {
  return Object.fromEntries(HIGH_KEYS.map((k) => [k, null])) as HighsSet;
}

/** 두 기록 중 앞선 것: 값이 크면 앞, 같으면 먼저 달성한 날짜(날짜 없음은 뒤) */
export function compareHigh(a: HighRecord, b: HighRecord): number {
  if (a.value !== b.value) return b.value - a.value;
  if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.date && !b.date) return -1;
  if (!a.date && b.date) return 1;
  return 0;
}

/**
 * 시즌 하이 1위 (기록 부문 11개): 그 시즌 선수들의 seasonHighs 중 최대.
 * 동률이면 먼저 달성한 날짜, 그래도 같으면 선수 번호가 작은 쪽 (결과가 매번 같도록).
 * 성공률(RATE)은 시도 조건이 없어 왜곡되므로 넣지 않는다. 어느 선수에게도 시즌 하이가 없으면 null (raw 없음).
 * 값이 0 인 기록은 1위로 치지 않는다 (예: 아무도 블록을 못 한 시즌이면 null).
 */
export function computeSeasonHighLeaders(
  players: readonly { playerNo: string; seasonHighs?: HighsSet | null }[],
): SeasonHighLeaders | null {
  if (!players.some((p) => p.seasonHighs)) return null;
  const out = {} as SeasonHighLeaders;
  for (const key of SEASON_HIGH_LEADER_KEYS) {
    let best: SeasonHighLeader | null = null;
    for (const p of players) {
      const r = p.seasonHighs?.[key];
      if (!r || !(r.value > 0)) continue;
      const cand: SeasonHighLeader = { playerNo: p.playerNo, ...r };
      if (!best) {
        best = cand;
        continue;
      }
      const c = compareHigh(cand, best);
      if (c < 0 || (c === 0 && cand.playerNo.localeCompare(best.playerNo, "en", { numeric: true }) < 0)) best = cand;
    }
    out[key] = best;
  }
  return out;
}

const NF1 = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });

/** 기록 표기: 개수는 정수("46"), 성공률은 소수 한 자리까지 "%"("66.7%", "100%") */
export function formatHighValue(value: number, key: HighKey): string {
  if (!Number.isFinite(value)) return "–";
  return highDef(key).kind === "rate" ? `${NF1.format(value)}%` : String(Math.round(value));
}

/**
 * 시도 수를 붙이는 슛 성공 부문 (그 경기의 시도·성공률). 득점 하이에는 붙이지 않는다.
 * 야투 성공(fgm)은 화면(HERO_HIGH_KEYS)에 없지만 데이터에는 붙여 둔다.
 */
export const SHOT_HIGH_KEYS: readonly HighKey[] = ["tpm", "ftm", "fgm"];

/**
 * 슛 부문의 그 경기 성공/시도·성공률 표기: "5/8 · 62.5%". 시도 수가 없거나(경기별 기록 못 찾음) 슛 부문이 아니면 null → 개수만.
 * 성공률은 기록에 붙은 pct, 없으면 성공 ÷ 시도로 계산.
 */
export function formatHighShot(r: HighRecord | null | undefined, key: HighKey): string | null {
  if (!r || !SHOT_HIGH_KEYS.includes(key)) return null;
  const att = r.attempts;
  if (att === null || att === undefined || !Number.isFinite(att) || att <= 0) return null;
  const pct = r.pct !== null && r.pct !== undefined && Number.isFinite(r.pct) ? r.pct : (r.value / att) * 100;
  return `${Math.round(r.value)}/${Math.round(att)} · ${NF1.format(pct)}%`;
}

/** 날짜 표기: "2023-10-21" → "2023.10.21". 없으면 "–" */
export function formatHighDate(date: string | null): string {
  const m = date ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
  return m ? `${m[1]}.${m[2]}.${m[3]}` : "–";
}

/** 횟수 표기: 3 → "3회", 없으면 "–" */
export function formatHighTimes(times: number | null): string {
  return times && times > 0 ? `${times}회` : "–";
}

/**
 * 순위표 부문(lib/leaders LeaderStatKey) → 대응하는 시즌 하이 부문. 고른 부문의 카드를 강조한다.
 * 성공률·TS%·PER 등은 대응하는 기록 부문이 없다. (키를 문자열로 받아 leaders.ts ↔ highs.ts 순환 import 를 피한다)
 */
export const LEADER_CATEGORY_HIGH: Readonly<Record<string, SeasonHighLeaderKey>> = {
  points: "pts",
  reb: "reb",
  ast: "ast",
  stl: "stl",
  blk: "blk",
  tpm: "tpm",
};

// ─────────────────────────────────────────────
// 순위표 "이 시즌 한 경기 최다" 카드 줄 (HERO_HIGH_KEYS 7개)
// ─────────────────────────────────────────────

export interface SeasonHighCard {
  key: SeasonHighLeaderKey;
  label: string;
  value: string;            // "46"
  playerNo: string;
  nameKo: string;
  photoUrl: string | null;
  teamCode: string;         // 그 선수의 이 시즌 팀 (카드 색·로고)
  date: string;             // "2023.10.21"
  opponent: string | null;  // 상대 팀 한글 약칭 (모르면 코드, 코드도 없으면 null)
  opponentCode: string | null; // 상대 팀 코드 (팀 페이지 링크, 2026-10-14)
  times: number | null;     // 같은 기록 횟수
  shot: string | null;      // 슛 부문의 그 경기 성공/시도·성공률 "5/8 · 62.5%" (없으면 null)
}

/**
 * 시즌 파일의 seasonHighLeaders → 카드 줄. 1위가 없는 부문과 시즌 선수 목록에 없는 선수는 뺀다.
 * teamName: 팀 코드 → 한글 약칭 (그 시즌 팀 목록, 없으면 null → 코드 그대로).
 * 결과가 빈 배열이면 화면은 섹션을 숨긴다.
 */
export function buildSeasonHighCards(
  leaders: SeasonHighLeaders | null | undefined,
  players: readonly { id: string; nameKo: string; photoUrl: string | null; teamCode: string }[],
  teamName: (code: string) => string | null,
): SeasonHighCard[] {
  if (!leaders) return [];
  const byId = new Map(players.map((p) => [p.id, p]));
  const out: SeasonHighCard[] = [];
  for (const key of HERO_HIGH_KEYS) {
    const l = leaders[key];
    const p = l ? byId.get(l.playerNo) : undefined;
    if (!l || !p) continue;
    out.push({
      key,
      label: highDef(key).label,
      value: formatHighValue(l.value, key),
      playerNo: p.id,
      nameKo: p.nameKo,
      photoUrl: p.photoUrl,
      teamCode: p.teamCode,
      date: formatHighDate(l.date),
      opponent: l.opponentTeamCode ? (teamName(l.opponentTeamCode) ?? l.opponentTeamCode) : null,
      opponentCode: l.opponentTeamCode ?? null,
      times: l.times,
      shot: formatHighShot(l, key),
    });
  }
  return out;
}
