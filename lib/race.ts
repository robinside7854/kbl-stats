// 득점왕 레이스 (2026-10-16 사용자 요청 "우리만의 기능"): 리더보드 부문(득점·리바·어시·스틸·블록·3점) 상위 5명의
// 경기일마다 "그날까지 경기당 평균" 선. 재료는 시즌 경기 박스스코어(data/processed/{시즌}/games.json box) — 순수 함수만.
//
// 규칙 (우리 규칙):
// - 상위 5명 = 박스스코어로 센 시즌 최종(지금까지) 경기당 값 순. 표본 기준은 그 시즌 기본 기준(lib/metrics seasonDefaultQualify —
//   진행 중 시즌은 팀 경기 절반 이상)을 박스스코어로 센 경기 수·출전 분에 적용한다. 동률이면 합계 → 이름.
// - 선은 그 선수가 3경기(RACE_MIN_GAMES) 이상 뛴 날부터 그린다 — 1~2경기 평균은 너무 흔들려서(첫 경기 30점이면 30.0 이 1위).
// - 1위 바뀜은 "이 다섯 명 중" 1위가 바뀐 횟수(리그 전체 1위가 아니다). 같은 값이면 원래 1위를 그대로 둔다.
// - 출전 시간 0초 줄은 경기로 세지 않는다(지금 데이터엔 없음).
import type { GameBoxRow, SeasonGame } from "./types";

export const RACE_CATEGORIES = ["points", "reb", "ast", "stl", "blk", "tpm"] as const;
export type RaceCategory = (typeof RACE_CATEGORIES)[number];

export const RACE_LABELS: Record<RaceCategory, string> = {
  points: "득점",
  reb: "리바운드",
  ast: "어시스트",
  stl: "스틸",
  blk: "블록",
  tpm: "3점 성공",
};

const ROW_VALUE: Record<RaceCategory, (r: GameBoxRow) => number> = {
  points: (r) => r.pts,
  reb: (r) => r.reb,
  ast: (r) => r.ast,
  stl: (r) => r.stl,
  blk: (r) => r.blk,
  tpm: (r) => r.tpm,
};

/** 선을 그리기 시작하는 경기 수 */
export const RACE_MIN_GAMES = 3;
/** 선 개수 */
export const RACE_TOP = 5;
/** 레이스를 보여 줄 최소 경기일 수 (선이 그려진 날 기준) — 개막 직후 점 한두 개짜리 그래프는 안 보인다 */
export const RACE_MIN_DATES = 4;

export const isRaceCategory = (k: string): k is RaceCategory => (RACE_CATEGORIES as readonly string[]).includes(k);

export interface RaceLine {
  id: string;
  nameKo: string;
  /** 가장 최근 경기의 팀 */
  teamCode: string;
  /** 지금 경기당 값 */
  value: number;
  games: number;
}

export interface RaceSeries {
  category: RaceCategory;
  /** 경기일 "2026-10-03" (오름차순) — 박스스코어가 있는 끝난 경기의 날짜 */
  dates: string[];
  /** 지금 순위 순 */
  lines: RaceLine[];
  /** values[선][날짜] = 그날까지 경기당 값 (소수 둘째 자리), 3경기 전이면 null */
  values: (number | null)[][];
}

interface Acc {
  id: string;
  nameKo: string;
  teamCode: string;
  games: number;
  sec: number;
  total: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** 박스스코어가 있는 끝난 경기 (날짜·경기 순) */
const boxGames = (games: readonly SeasonGame[]) => games.filter((g) => g.ended && g.box).slice().sort((a, b) => a.date.localeCompare(b.date));

/**
 * 한 부문의 레이스. 표본 기준(rule)을 넘긴 선수가 없거나 박스스코어가 없으면 null.
 * rule 은 lib/metrics QualifyRule 과 같은 꼴(경기·출전 분).
 */
export function buildRace(
  games: readonly SeasonGame[],
  category: RaceCategory,
  rule: { minGames: number; minMinutes: number },
  top: number = RACE_TOP,
): RaceSeries | null {
  const list = boxGames(games);
  if (list.length === 0) return null;
  const val = ROW_VALUE[category];
  const dates: string[] = [];
  // 선수별 그날까지 누적 (날짜마다 스냅숏 — 경기 수·합계)
  const acc = new Map<string, Acc>();
  const snaps: Map<string, [number, number]>[] = [];
  for (let i = 0; i < list.length; ) {
    const date = list[i].date;
    for (; i < list.length && list[i].date === date; i++) {
      const g = list[i];
      for (const side of ["home", "away"] as const) {
        for (const r of g.box![side]) {
          if (r.sec <= 0) continue;
          const a = acc.get(r.id) ?? { id: r.id, nameKo: r.nameKo, teamCode: g[side].teamCode, games: 0, sec: 0, total: 0 };
          a.games++;
          a.sec += r.sec;
          a.total += val(r);
          a.teamCode = g[side].teamCode;
          a.nameKo = r.nameKo;
          acc.set(r.id, a);
        }
      }
    }
    dates.push(date);
    snaps.push(new Map([...acc.values()].map((a) => [a.id, [a.games, a.total] as [number, number]])));
  }
  const qualified = [...acc.values()].filter((a) => a.games >= rule.minGames && a.sec / 60 >= rule.minMinutes && a.total > 0);
  if (qualified.length === 0) return null;
  const chosen = qualified
    .sort((x, y) => y.total / y.games - x.total / x.games || y.total - x.total || x.nameKo.localeCompare(y.nameKo, "ko"))
    .slice(0, top);
  const lines: RaceLine[] = chosen.map((a) => ({ id: a.id, nameKo: a.nameKo, teamCode: a.teamCode, value: round2(a.total / a.games), games: a.games }));
  const values = chosen.map((a) =>
    snaps.map((s) => {
      const v = s.get(a.id);
      return v && v[0] >= RACE_MIN_GAMES ? round2(v[1] / v[0]) : null;
    }),
  );
  return { category, dates, lines, values };
}

/** 선이 하나라도 그려진 경기일 수 */
export function raceDrawnDates(s: RaceSeries): number {
  return s.dates.filter((_, d) => s.values.some((row) => row[d] !== null)).length;
}

export interface RaceSummary {
  /** 1위가 바뀐 횟수 (처음 1위가 정해진 것은 세지 않는다) */
  changes: number;
  /** 지금 1위 (선 순서 번호) — 그려진 날이 없으면 null */
  leader: number | null;
  /** 지금 1위가 1위에 오른 날 */
  since: string | null;
  /** 지금 1위가 1위를 지킨 경기일 수 (오른 날 포함) */
  streakDays: number;
  /** 1위를 한 번이라도 해 본 선수 수 */
  leaders: number;
}

/** 경기일마다 다섯 명 중 1위 → 바뀐 횟수·지금 1위의 연속 일수. 같은 값이면 원래 1위 유지, 처음엔 선 순서가 빠른 쪽 */
export function raceSummary(s: RaceSeries): RaceSummary {
  let leader: number | null = null;
  let since: string | null = null;
  let streak = 0;
  let changes = 0;
  const ever = new Set<number>();
  s.dates.forEach((date, d) => {
    let max = -Infinity;
    for (const row of s.values) if (row[d] !== null && row[d]! > max) max = row[d]!;
    if (max === -Infinity) return;
    const tied = s.values.map((row, i) => (row[d] === max ? i : -1)).filter((i) => i >= 0);
    const best = leader !== null && tied.includes(leader) ? leader : tied[0];
    if (best !== leader) {
      if (leader !== null) changes++;
      leader = best;
      since = date;
      streak = 0;
    }
    ever.add(best);
    streak++;
  });
  return { changes, leader, since, streakDays: streak, leaders: ever.size };
}

/** 한 줄 요약: "1위가 4번 바뀌었어요 · 지금 1위 워니는 23경기일째" / "워니가 처음부터 1위를 지키고 있어요" */
export function raceTakeaway(s: RaceSeries, sum: RaceSummary = raceSummary(s)): string | null {
  if (sum.leader === null) return null;
  const name = s.lines[sum.leader].nameKo;
  if (sum.changes === 0) return `${name}${josaIGa(name)} 처음부터 1위를 지키고 있어요`;
  return `1위가 ${sum.changes}번 바뀌었어요 · 지금 1위 ${name}${josaEunNeun(name)} ${sum.streakDays}경기일째`;
}

/** 받침 있으면 true (한글 끝 글자 기준, 영문·숫자는 받침 없음으로) */
function hasBatchim(word: string): boolean {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return false;
  return (c - 0xac00) % 28 !== 0;
}
const josaIGa = (w: string) => (hasBatchim(w) ? "이" : "가");
const josaEunNeun = (w: string) => (hasBatchim(w) ? "은" : "는");

/** 가로축 눈금 "10.3" */
export const raceDateTick = (date: string) => `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
