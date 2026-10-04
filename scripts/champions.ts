// 시즌 우승팀 판정 (2026-10-02 사용자 요청 "우승횟수도 선수 프로필에"). 순수 함수 — process.ts 가 부른다.
// 재료: 서버 C 경기 목록(data/raw/games/{시즌}/list.json, 슛 차트 수집 때 이미 받음)의 챔피언결정전(gameCode "04") 경기 점수.
// 챔프전은 7전 4선승제 → 4승을 먼저 한 팀이 우승. 4승 팀이 없으면(시즌 진행 중·2019-20 코로나 취소) 우승팀 없음.
// 1997~2025-26 판정 결과는 알려진 역대 우승팀과 전부 같다(2026-10-02 확인: 기아·현대·SK·삼성·동양·TG·KCC·모비스·KGC·오리온·LG 등).

type Raw = Record<string, any>;

/** 챔피언결정전 경기 구분 코드 (CLAUDE.md 코드 체계) */
export const FINALS_GAME_CODE = "04";
/** 7전 4선승제 */
export const FINALS_WINS_NEEDED = 4;

export interface SeasonChampion {
  teamCode: string;
  /** 경기 목록의 팀 이름(그 시즌 표기), 예: "울산모비스" */
  teamName: string;
  wins: number;
  losses: number;
}

function unwrap(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

const score = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * 경기 목록 → 그 시즌 우승팀. seasonCode 가 같고 gameCode "04" 인 경기(gmkey 중복은 한 번)만 센다.
 * 점수가 없거나 0:0·동점인 경기(아직 안 한 경기)는 뺀다. 4승 팀이 없으면 null.
 */
export function finalsChampion(list: unknown, seasonCode: number): SeasonChampion | null {
  const arr = unwrap(list);
  if (!Array.isArray(arr)) return null;
  const seen = new Set<string>();
  const wins = new Map<string, { name: string; wins: number }>();
  let games = 0;
  for (const g of arr as Raw[]) {
    if (!g || typeof g !== "object") continue;
    if (Number(g.seasonCode) !== seasonCode) continue;
    if (String(g.gameCode ?? "").trim().padStart(2, "0") !== FINALS_GAME_CODE) continue;
    const key = String(g.gmkey ?? "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const h = score(g.scoreH);
    const a = score(g.scoreA);
    if (h === null || a === null || h === a) continue;
    const homeWon = h > a;
    const code = String((homeWon ? g.tcodeH : g.tcodeA) ?? "").trim();
    if (!code) continue;
    const name = String((homeWon ? g.tnameH : g.tnameA) ?? "").trim();
    const e = wins.get(code) ?? { name, wins: 0 };
    e.wins++;
    wins.set(code, e);
    games++;
  }
  for (const [teamCode, e] of wins) {
    if (e.wins >= FINALS_WINS_NEEDED) return { teamCode, teamName: e.name, wins: e.wins, losses: games - e.wins };
  }
  return null;
}

/**
 * 선수의 우승 시즌 코드 (오름차순): 정규시즌 소속 팀이 그 시즌 우승팀인 시즌.
 * 한계: 시즌 중 이적했으면 KBL 기록의 팀(시즌 기록이 붙은 팀) 하나로만 본다. 챔프전 출전 여부는 보지 않는다.
 */
export function championSeasonsOf(
  seasons: readonly { seasonCode: number; teamCode: string }[],
  champions: ReadonlyMap<number, string>,
): number[] {
  return seasons
    .filter((s) => champions.get(s.seasonCode) === s.teamCode)
    .map((s) => s.seasonCode)
    .sort((a, b) => a - b);
}

/** 플레이오프(6강·4강) 경기 구분 코드 — 챔프전은 FINALS_GAME_CODE */
export const PLAYOFF_GAME_CODE = "03";

/** 팀 하나의 플레이오프 출전 기록 (2026-10-04 팀 페이지): 03 에서 만난 상대 수, 챔프전 진출 여부 */
export interface PlayoffEntry {
  teamCode: string;
  /** 6강·4강에서 맞붙은 서로 다른 상대 수 (1 = 한 시리즈, 2 = 두 시리즈) */
  series: number;
  finals: boolean;
}

/**
 * 경기 목록 → 그 시즌 플레이오프에 나간 팀들. 몇 강에서 떨어졌는지는 정규시즌 순위(1·2위는 6강을 건너뜀)와 함께
 * 화면 규칙(lib/franchise playoffStage)이 정한다. 점수 없는 경기도 대진은 정해진 것이라 센다.
 */
export function playoffEntries(list: unknown, seasonCode: number): PlayoffEntry[] {
  const arr = unwrap(list);
  if (!Array.isArray(arr)) return [];
  const opponents = new Map<string, Set<string>>();
  const finals = new Set<string>();
  const touch = (code: string) => {
    if (!opponents.has(code)) opponents.set(code, new Set());
    return opponents.get(code)!;
  };
  for (const g of arr as Raw[]) {
    if (!g || typeof g !== "object" || Number(g.seasonCode) !== seasonCode) continue;
    const code = String(g.gameCode ?? "").trim().padStart(2, "0");
    const h = String(g.tcodeH ?? "").trim();
    const a = String(g.tcodeA ?? "").trim();
    if (!h || !a) continue;
    if (code === PLAYOFF_GAME_CODE) {
      touch(h).add(a);
      touch(a).add(h);
    } else if (code === FINALS_GAME_CODE) {
      touch(h);
      touch(a);
      finals.add(h);
      finals.add(a);
    }
  }
  return [...opponents.entries()]
    .map(([teamCode, opp]) => ({ teamCode, series: opp.size, finals: finals.has(teamCode) }))
    .sort((x, y) => x.teamCode.localeCompare(y.teamCode));
}
