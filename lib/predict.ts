// 플레이오프 확률·경기 전 승률 (2026-10-14 사용자 "공홈에 없는 우리만의 기능" 1번) — 우리 규칙으로 돌린 추정, KBL 공식 수치 아님.
//
// 1) 팀 능력치 = "평균 상대에게 몇 점 이기는 팀인가"(점수 차 기준, SRS 식).
//    경기마다 점수 차 = 홈 능력치 − 원정 능력치 + 홈 이점 이라고 보고, 이번 시즌 끝난 경기에 가장 잘 맞는 값을 푼다.
//    시즌 초에는 몇 경기만으로 흔들리지 않게 "지난 시즌 능력치의 30%"를 출발점으로 두고, 경기 수가 쌓일수록 이번 시즌 값으로 옮겨 간다
//    (출발점 무게 = 경기 SHRINK 개만큼). 매각으로 코드가 바뀐 팀·새 팀은 출발점 0(리그 평균).
// 2) 경기 승률 = 정규분포(능력치 차 + 홈 이점, 표준편차 GAME_SD)에서 홈 팀이 이길 확률.
// 3) 플레이오프 확률 = 남은 일정을 SIMS 번 돌려(팀 능력치의 불확실성까지 매번 흔들어서) 최종 순위가 6위 안·2위 안·1위인 비율.
//    동률 순위는 KBL 규정(상대 전적 등)을 다 따르지 않고 무작위로 가른다.
//
// 상수는 과거 18시즌(2008-09 ~ 2025-26, 정규시즌 4,803경기)을 "그날 전까지 경기만 보고" 예측해 맞춘 값(2026-10-16):
//   로그 손실 0.641(동전 던지기 0.693) · 앞선 팀이 이긴 비율 63.3% · 60~70% 라고 한 경기의 실제 승률 68.2%.
//   시즌 1/4 시점 6강 확률의 브라이어 점수 0.135(모두 60% 로 찍으면 0.240), 1/2 시점 0.078.
import type { SeasonGame } from "./types";

export const PREDICT = {
  /** 홈 이점 (점) — 2016-17 ~ 2025-26 홈 팀 평균 득실 +1.1~1.8 */
  HOME_ADV: 1.3,
  /** 출발점(지난 시즌 값) 무게 = 경기 수 */
  SHRINK: 8,
  /** 지난 시즌 능력치에서 남기는 비율 (나머지는 리그 평균으로) */
  PRIOR_KEEP: 0.3,
  /** 한 경기 점수 차 흔들림 (표준편차, 점) */
  GAME_SD: 11,
  /** 남은 시즌 돌리는 횟수 */
  SIMS: 10000,
} as const;

/** KBL 플레이오프: 정규리그 6위까지 진출, 1·2위는 4강 직행 (lib/notif-news 와 같은 규정) */
export const ODDS_PLAYOFF_SPOTS = 6;
export const ODDS_DIRECT_SPOTS = 2;

/** 되짚어 보기 결과 (화면 도움말에 쓰는 숫자 — 상수를 바꾸면 다시 재서 고친다) */
export const BACKTEST = { seasons: 18, games: 4803, favoriteWin: 0.633 } as const;

export interface TeamRating {
  /** 평균 상대 대비 점수 차 (+면 강함) */
  rating: number;
  /** 이번 시즌 끝난 경기 수 */
  games: number;
}

const isDone = (g: SeasonGame) =>
  g.ended && g.home.score !== null && g.away.score !== null && g.home.score !== g.away.score && !!g.home.teamCode && !!g.away.teamCode;

/** 끝난 경기 + 출발점 → 팀 능력치 (출발점 쪽으로 당기는 최소제곱, 가우스-자이델 60회) */
export function teamRatings(games: readonly SeasonGame[], prior: Readonly<Record<string, number>> = {}, shrink: number = PREDICT.SHRINK): Map<string, TeamRating> {
  const teams = new Set<string>(Object.keys(prior));
  const done = games.filter(isDone);
  for (const g of games) {
    if (g.home.teamCode) teams.add(g.home.teamCode);
    if (g.away.teamCode) teams.add(g.away.teamCode);
  }
  const by = new Map<string, [string, number][]>();
  for (const t of teams) by.set(t, []);
  for (const g of done) {
    const m = g.home.score! - g.away.score! - PREDICT.HOME_ADV;
    by.get(g.home.teamCode)!.push([g.away.teamCode, m]);
    by.get(g.away.teamCode)!.push([g.home.teamCode, -m]);
  }
  const r = new Map<string, number>();
  for (const t of teams) r.set(t, prior[t] ?? 0);
  for (let it = 0; it < 60; it++) {
    for (const t of teams) {
      let s = shrink * (prior[t] ?? 0);
      let n = shrink;
      for (const [o, m] of by.get(t)!) {
        s += m + (r.get(o) ?? 0);
        n++;
      }
      r.set(t, n > 0 ? s / n : 0);
    }
  }
  const out = new Map<string, TeamRating>();
  for (const t of teams) out.set(t, { rating: r.get(t) ?? 0, games: by.get(t)!.length });
  return out;
}

/** 지난 시즌 경기 → 이번 시즌 출발점 (지난 시즌 능력치 × PRIOR_KEEP) */
export function priorFromSeason(lastGames: readonly SeasonGame[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [t, v] of teamRatings(lastGames, {}, 2)) out[t] = v.rating * PREDICT.PRIOR_KEEP;
  return out;
}

// 표준정규 누적분포 (Abramowitz-Stegun 7.1.26, 오차 1.5e-7)
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/** 홈 팀이 이길 확률 (0~1). 능력치를 모르는 팀은 리그 평균(0) */
export function homeWinProb(ratings: ReadonlyMap<string, TeamRating>, home: string, away: string): number {
  const diff = (ratings.get(home)?.rating ?? 0) - (ratings.get(away)?.rating ?? 0) + PREDICT.HOME_ADV;
  return normalCdf(diff / PREDICT.GAME_SD);
}

/** 남은 경기마다 홈 승률 (gmkey → 0~1). 이미 끝난 경기는 없음 */
export function upcomingWinProbs(games: readonly SeasonGame[], ratings: ReadonlyMap<string, TeamRating>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of games) {
    if (g.ended || !g.home.teamCode || !g.away.teamCode) continue;
    out[g.gmkey] = Math.round(homeWinProb(ratings, g.home.teamCode, g.away.teamCode) * 1000) / 1000;
  }
  return out;
}

export interface PlayoffOdds {
  teamCode: string;
  wins: number;
  losses: number;
  /** 시즌 끝 예상 승·패 (평균) */
  expWins: number;
  expLosses: number;
  /** 0~1 — 정규리그 1위 · 2위 안(4강 직행) · 6위 안(플레이오프) */
  first: number;
  top2: number;
  top6: number;
  /** 지금 능력치 (점) */
  rating: number;
  /** 남은 경기 결과와 상관없이 정해진 것 — 6위 안 확정(in)·탈락(out), 아직이면 null (동률은 불리하게 본다) */
  playoff: "in" | "out" | null;
}

/**
 * 순위 k 안을 확정했나·떨어졌나 (보수적으로 — 동률은 확정에선 진다고, 탈락에선 이길 수 있다고 본다).
 * 확정: 이 팀이 남은 경기를 다 져도, 이 팀 승수에 닿을 수 있는 팀이 k−1 개 이하.
 * 탈락: 이 팀이 남은 경기를 다 이겨도, 이미 그 승수를 넘은 팀이 k 개 이상 (같은 승수는 동률 순위로 들어갈 수 있으니 안 센다).
 */
export function certainSpot(i: number, wins: readonly number[], remaining: readonly number[], k: number): "in" | "out" | null {
  let canReach = 0;
  let alreadyAbove = 0;
  for (let j = 0; j < wins.length; j++) {
    if (j === i) continue;
    if (wins[j] + remaining[j] >= wins[i]) canReach++;
    if (wins[j] > wins[i] + remaining[i]) alreadyAbove++;
  }
  if (canReach <= k - 1) return "in";
  if (alreadyAbove >= k) return "out";
  return null;
}

/** 같은 입력이면 같은 결과 (mulberry32) */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 남은 일정을 sims 번 돌려 팀마다 최종 순위 확률. 시뮬레이션마다 팀 능력치를 그 불확실성(GAME_SD ÷ √(경기 수 + SHRINK))만큼 흔든다 —
 * 시즌 초에는 능력치가 덜 확실하니 확률이 50% 쪽으로 넓게 퍼진다. 결과는 6강 확률 → 예상 승수 순.
 */
export function playoffOdds(
  games: readonly SeasonGame[],
  ratings: ReadonlyMap<string, TeamRating>,
  opts: { sims?: number; seed?: number } = {},
): PlayoffOdds[] {
  const sims = opts.sims ?? PREDICT.SIMS;
  const rand = rng(opts.seed ?? 1);
  const teams = [...new Set(games.flatMap((g) => [g.home.teamCode, g.away.teamCode]).filter(Boolean))];
  const idx = new Map(teams.map((t, i) => [t, i]));
  const baseW = new Array(teams.length).fill(0);
  const baseL = new Array(teams.length).fill(0);
  const rest: [number, number][] = [];
  for (const g of games) {
    const h = idx.get(g.home.teamCode);
    const a = idx.get(g.away.teamCode);
    if (h === undefined || a === undefined) continue;
    if (isDone(g)) {
      const homeWon = g.home.score! > g.away.score!;
      baseW[homeWon ? h : a]++;
      baseL[homeWon ? a : h]++;
    } else if (!g.ended) rest.push([h, a]);
  }
  const rating = teams.map((t) => ratings.get(t)?.rating ?? 0);
  const spread = teams.map((t) => PREDICT.GAME_SD / Math.sqrt((ratings.get(t)?.games ?? 0) + PREDICT.SHRINK));
  const first = new Array(teams.length).fill(0);
  const top2 = new Array(teams.length).fill(0);
  const top6 = new Array(teams.length).fill(0);
  const winSum = new Array(teams.length).fill(0);
  const gauss = () => {
    let u = 0;
    while (u === 0) u = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
  const w = new Array(teams.length);
  const r = new Array(teams.length);
  const tie = new Array(teams.length);
  const order = teams.map((_, i) => i);
  for (let s = 0; s < sims; s++) {
    for (let i = 0; i < teams.length; i++) {
      w[i] = baseW[i];
      r[i] = rating[i] + gauss() * spread[i];
      tie[i] = rand();
    }
    for (const [h, a] of rest) {
      const p = normalCdf((r[h] - r[a] + PREDICT.HOME_ADV) / PREDICT.GAME_SD);
      w[rand() < p ? h : a]++;
    }
    order.sort((x, y) => w[y] - w[x] || tie[x] - tie[y]);
    order.forEach((i, rank) => {
      if (rank === 0) first[i]++;
      if (rank < ODDS_DIRECT_SPOTS) top2[i]++;
      if (rank < ODDS_PLAYOFF_SPOTS) top6[i]++;
    });
    for (let i = 0; i < teams.length; i++) winSum[i] += w[i];
  }
  const per = (n: number) => Math.round((n / sims) * 1000) / 1000;
  const remaining = teams.map((_, i) => rest.filter(([h, a]) => h === i || a === i).length);
  return teams
    .map((t, i) => {
      const total = baseW[i] + baseL[i] + remaining[i];
      const expWins = Math.round((winSum[i] / sims) * 10) / 10;
      return {
        teamCode: t,
        wins: baseW[i],
        losses: baseL[i],
        expWins,
        expLosses: Math.round((total - expWins) * 10) / 10,
        first: per(first[i]),
        top2: per(top2[i]),
        top6: per(top6[i]),
        rating: Math.round(rating[i] * 10) / 10,
        playoff: certainSpot(i, baseW, remaining, ODDS_PLAYOFF_SPOTS),
      };
    })
    .sort((x, y) => y.top6 - x.top6 || y.expWins - x.expWins);
}

/**
 * "73%" — 시뮬레이션이 0·100% 여도 수학적으로 정해지지 않았으면 "<1%"·">99%"(확정처럼 보이지 않게).
 * sure 를 넘기면(6강 칸) 정해진 경우 "확정"·"탈락".
 */
export function oddsText(p: number, sure: "in" | "out" | null = null): string {
  if (sure === "in") return "확정";
  if (sure === "out") return "탈락";
  if (p < 0.005) return "<1%";
  if (p > 0.995) return ">99%";
  return `${Math.round(p * 100)}%`;
}

/** 시드 = 끝난 경기 수 — 같은 날 빌드는 같은 숫자, 경기가 끝나면 바뀐다 */
export function oddsSeed(games: readonly SeasonGame[]): number {
  return games.filter(isDone).length * 7919 + 17;
}
