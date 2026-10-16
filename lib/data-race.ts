// 득점왕 레이스 재료 (2026-10-16) — 빌드 때 data/processed/{시즌}/games.json 박스스코어를 읽는다(서버 전용). 규칙은 lib/race.
import { loadSeasonGames, seasonQualify } from "./data";
import { buildRace, RACE_CATEGORIES, RACE_MIN_DATES, raceDrawnDates, raceSummary, raceTakeaway, type RaceCategory, type RaceLine } from "./race";

/** 화면에 넘기는 모양 — 날짜는 한 번만 */
export interface ScoringRaces {
  dates: string[];
  races: Partial<Record<RaceCategory, { lines: RaceLine[]; values: (number | null)[][]; takeaway: string | null; changes: number }>>;
}

/**
 * 박스스코어가 끝난 경기를 거의 다 덮는 시즌만(끝난 경기의 95% 이상 — 빠진 경기가 많으면 평균이 공식 기록과 달라진다).
 * 선이 그려진 날이 RACE_MIN_DATES 보다 적으면 그 부문은 뺀다. 남는 부문이 없으면 null.
 */
export function loadScoringRaces(seasonCode: number): ScoringRaces | null {
  const games = loadSeasonGames(seasonCode);
  const ended = games.filter((g) => g.ended);
  const boxed = ended.filter((g) => g.box);
  if (ended.length === 0 || boxed.length < ended.length * 0.95) return null;
  const rule = seasonQualify(seasonCode);
  let dates: string[] = [];
  const races: ScoringRaces["races"] = {};
  for (const c of RACE_CATEGORIES) {
    const r = buildRace(games, c, rule);
    if (!r || raceDrawnDates(r) < RACE_MIN_DATES) continue;
    dates = r.dates;
    const sum = raceSummary(r);
    races[c] = { lines: r.lines, values: r.values, takeaway: raceTakeaway(r, sum), changes: sum.changes };
  }
  return Object.keys(races).length > 0 ? { dates, races } : null;
}
