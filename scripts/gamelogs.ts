// 경기별 기록(서버 B) raw → 한 경기 최다의 슛 시도 수 + 백필 대상 선정 — 순수 함수만 (fetch.ts·backfill-gamelogs.ts·process.ts·테스트).
// KBL 원본 필드명(RegularGameRecords, threepA, fdgA …)은 이 파일에서만 다룬다 (CLAUDE.md 코딩 규칙).
//
// 왜: mostgame(한 경기 최다) 응답에는 "3점슛 성공 8개"처럼 성공 개수만 있고 시도 수가 없다.
//     같은 선수·시즌의 경기별 기록에서 그 날짜(gameDate) 경기를 찾아 시도 수를 붙인다 → 화면 "8/12 · 66.7%".
//
// 응답 형태 (CLAUDE.md 서버 B — 2026-09-30 Actions 러너 확인):
//   GET /api/v1/players/categories/game/{seasonCode}/01/{playerNo}
//   → { RegularGameRecords: [{ gameNo, gameDate: "20260406", awayTeam, playSec, pts, fg, fgA, fgRt(2점슛), threep, threepA, threepRt,
//        fdg, fdgA, fdgRt(전체 야투), ft, ftA, ftRt, oR, dR, rb, aS, sT, bS, tO, foulTot, … }], … }
//   ⚠️ 시즌 기록(서버 A)과 같게 fg 는 2점슛, fdg 가 전체 야투로 본다 (확인되면 CLAUDE.md 에 적을 것).

import { SHOT_HIGH_KEYS } from "../lib/highs.js";
import type { HighKey, HighRecord, HighsSet } from "../lib/types.js";
import { toIsoDate } from "./highs.js";

type Raw = Record<string, any>;

/** 응답이 JSON 문자열로 한 번 더 감싸져 있어도 푼다 (teams.json 에서 실제로 있었던 일) */
function unwrap(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 경기 한 줄 (슛 성공·시도만 — 우리 이름) */
export interface GameLogRow {
  /** "2026-04-06" */
  date: string | null;
  gameNo: string | null;
  fgm: number | null; // 전체 야투 성공 (fdg)
  fga: number | null; // 전체 야투 시도 (fdgA)
  tpm: number | null; // 3점 성공 (threep)
  tpa: number | null; // 3점 시도 (threepA)
  ftm: number | null; // 자유투 성공 (ft)
  fta: number | null; // 자유투 시도 (ftA)
}

/** 응답이 경기별 기록 형태인가 (RegularGameRecords 배열이 있으면) — 수집 때 빈 응답·HTML 을 저장하지 않으려고 */
export function isGameLogResponse(body: unknown): boolean {
  const o = unwrap(body);
  return !!o && typeof o === "object" && !Array.isArray(o) && Array.isArray((o as Raw).RegularGameRecords);
}

/** raw 파일 내용(JSON.parse 결과) → 정규시즌 경기 목록. 형태가 다르면 빈 배열 */
export function parseGameLog(parsed: unknown): GameLogRow[] {
  const o = unwrap(parsed) as Raw | null;
  const list = o && typeof o === "object" ? unwrap(o.RegularGameRecords) : null;
  if (!Array.isArray(list)) return [];
  return list
    .filter((g): g is Raw => !!g && typeof g === "object")
    .map((g) => ({
      date: toIsoDate(g.gameDate),
      gameNo: g.gameNo === null || g.gameNo === undefined || g.gameNo === "" ? null : String(g.gameNo),
      fgm: numOrNull(g.fdg),
      fga: numOrNull(g.fdgA),
      tpm: numOrNull(g.threep),
      tpa: numOrNull(g.threepA),
      ftm: numOrNull(g.ft),
      fta: numOrNull(g.ftA),
    }));
}

/** 슛 부문 → 그 경기 (성공, 시도) 열 */
const SHOT_FIELDS: Readonly<Partial<Record<HighKey, readonly [keyof GameLogRow, keyof GameLogRow]>>> = {
  tpm: ["tpm", "tpa"],
  ftm: ["ftm", "fta"],
  fgm: ["fgm", "fga"],
};

/** 소수 첫째 자리 반올림 */
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * 한 경기 최다 기록 하나 + 그 시즌 경기 목록 → { attempts, pct } 또는 null(못 찾음).
 * 같은 날짜 경기를 찾고, 그 경기의 성공 개수가 기록 값과 같을 때만 믿는다 (다르면 다른 경기 — 붙이지 않는다).
 * 같은 날 경기가 둘 이상이면(있을 수 없지만) 성공 개수가 맞는 첫 경기.
 */
export function shotAttemptsFor(
  key: HighKey,
  rec: Pick<HighRecord, "value" | "date">,
  games: readonly GameLogRow[],
): { attempts: number; pct: number } | null {
  const f = SHOT_FIELDS[key];
  if (!f || !rec.date) return null;
  for (const g of games) {
    if (g.date !== rec.date) continue;
    const made = g[f[0]] as number | null;
    const att = g[f[1]] as number | null;
    if (made === null || att === null || att <= 0 || made !== rec.value || made > att) continue;
    return { attempts: att, pct: round1((made / att) * 100) };
  }
  return null;
}

/**
 * 부문별 세트에 슛 부문(SHOT_HIGH_KEYS: 3점·자유투·야투 성공) 시도 수를 붙인 새 세트.
 * gamesFor(기록의 달성 시즌) → 그 시즌 경기 목록. 경기별 raw 가 없으면 undefined → 그 기록은 손대지 않는다(필드 없음).
 * raw 는 있는데 같은 날 경기를 못 찾으면 attempts·pct = null. 득점 등 다른 부문은 그대로.
 * fallbackSeason: 기록에 시즌 코드가 없을 때 쓸 시즌 (시즌 하이는 그 시즌).
 */
export function attachShotAttempts(
  set: HighsSet | null | undefined,
  gamesFor: (seasonCode: number) => readonly GameLogRow[] | undefined,
  fallbackSeason: number | null = null,
): HighsSet | null {
  if (!set) return null;
  const out = { ...set };
  for (const key of SHOT_HIGH_KEYS) {
    const rec = set[key];
    if (!rec) continue;
    const season = rec.seasonCode ?? fallbackSeason;
    const games = season === null ? undefined : gamesFor(season);
    if (!games) continue;
    const shot = shotAttemptsFor(key, rec, games);
    out[key] = { ...rec, attempts: shot?.attempts ?? null, pct: shot?.pct ?? null };
  }
  return out;
}

// ─────────────────────────────────────────────
// 백필 대상 (backfill-gamelogs.yml)
// ─────────────────────────────────────────────

/**
 * 백필에서 경기별 기록을 받을 커리어 하이 부문: 3점 성공·자유투 성공(시도 수를 붙이는 부문) + 득점.
 * 득점 하이 경기는 지금 화면에 시도 수를 붙이지 않지만 같이 받아 둔다(2026-09-30 요청 범위 — raw 는 경기 전체라 나중에 쓸 수 있다).
 */
export const GAMELOG_TARGET_KEYS: readonly HighKey[] = ["pts", "tpm", "ftm"];

export interface GamelogTarget {
  seasonCode: number;
  playerNo: string;
}

/**
 * 선수 색인(players-index.json) → 경기별 기록을 받을 (선수, 시즌) 조합.
 * 정규시즌 커리어 하이(careerHighs.regular)의 득점·3점·자유투 기록이 나온 시즌만 — 선수당 최대 3개, 중복 제거.
 * 순서: 최신 시즌 먼저, 같은 시즌은 선수 번호 순 (백필이 최근 기록부터 채우도록).
 */
export function gamelogTargets(
  index: readonly { id: string; careerHighs?: { regular: HighsSet | null } | null }[],
): GamelogTarget[] {
  const seen = new Set<string>();
  const out: GamelogTarget[] = [];
  for (const e of index) {
    const reg = e.careerHighs?.regular;
    if (!reg) continue;
    for (const key of GAMELOG_TARGET_KEYS) {
      const r = reg[key];
      const s = r?.seasonCode;
      if (!r || !(r.value > 0) || typeof s !== "number" || !Number.isInteger(s) || s <= 0) continue;
      const k = `${s}/${e.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ seasonCode: s, playerNo: e.id });
    }
  }
  return out.sort((a, b) => b.seasonCode - a.seasonCode || a.playerNo.localeCompare(b.playerNo, "en", { numeric: true }));
}

/** 대상 → 시즌별 선수 번호 (최신 시즌 먼저) */
export function groupTargetsBySeason(targets: readonly GamelogTarget[]): Map<number, string[]> {
  const m = new Map<number, string[]>();
  for (const t of [...targets].sort((a, b) => b.seasonCode - a.seasonCode)) {
    const list = m.get(t.seasonCode) ?? [];
    if (!list.includes(t.playerNo)) list.push(t.playerNo);
    m.set(t.seasonCode, list);
  }
  return m;
}
