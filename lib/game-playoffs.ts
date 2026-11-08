// 54-0 플레이오프 이어 하기 (2026-11-08 사용자 결정) — 순수 함수만.
//   - 정규리그 1위(GAME_PLAYOFF_SEED_WINS 승 이상)만 플레이오프에 나간다. KBL 처럼 1위는 6강을 건너뛰고 4강(5전 3승) → 챔프전(7전 4승).
//   - 플레이오프 전력은 선수마다 "그 시즌 플레이오프 기록"으로 다시 매긴다: 분당 효율(EFF)이 정규시즌보다 좋으면 점수가 오르고
//     나쁘면 내려간다(playoffForm — 경기 수가 적으면 1 쪽으로 당김). 그 시즌 플레이오프에 못 나간 선수는 큰 경기 경험이 없어 조금 낮춘다.
//   - 정규리그 1위 기준: 1997~2025-26 정규리그 순위별 평균 승률(우리가 계산, 2026-11-08) 1위 71.6% · 2위 66.3% · 3위 60.5% ·
//     4위 56.6% · 5위 52.3% · 6위 49.0% → 1위 평균 승률 × 54경기 ≈ 39승.
//   - 상대: 실제 순위 승률(4강 약 55%·챔프전 약 64%)로 붙이면 잘 꾸린 라인업은 96% 우승이라 단기전 맛이 없다 →
//     이 게임의 플레이오프 상대는 "역대급 팀"으로 잡았다(4강 승률 75% · 챔프전 85% — 역대 최고 정규리그 승률보다 조금 높다).
//     2026-11-08 시뮬레이션(실제 풀, 정규리그 1위를 한 라인업만): S급 5명 우승 약 66% · 숨은 점수 1위 61% ·
//     매번 득점 1위 27% · 39~42승으로 겨우 1위 한 팀 12%.
//   - 한 경기 승리 확률 = 우리 팀이 리그 평균 팀을 이길 확률(winProbability)과 상대 승률을 log5(승산비)로 맞붙인다.
//   - 라인업으로 정한 시드로 굴린다 → 같은 라인업은 늘 같은 플레이오프 결과.
import { GAME_SEASON_GAMES, hashSeed, lineupKey, seededRng, teamRating, winProbability, type GameCandidate, type TeamRating } from "./game";

/** 정규리그 1위로 보는 승수 (역대 1위 평균 승률 71.6% × 54) */
export const GAME_PLAYOFF_SEED_WINS = 39;
/** 그 시즌 플레이오프에 안 나간 선수의 플레이오프 점수 배율 (큰 경기 경험 없음) */
export const PLAYOFF_NO_RECORD_FORM = 0.97;
/** 플레이오프 폼 배율 범위 */
export const PLAYOFF_FORM_MIN = 0.85;
export const PLAYOFF_FORM_MAX = 1.15;
/** 뛴 시간이 적으면 1 쪽으로 당기는 정도: 무게 = 플레이오프 출전 분 / (분 + 이 값) — 벤치 선수 몇 분의 우연을 줄인다 */
export const PLAYOFF_FORM_SHRINK_MINUTES = 150;

export interface PlayoffRoundDef {
  key: "semi" | "final";
  label: string;
  /** 이겨야 하는 경기 수 (5전 3승 → 3) */
  need: number;
  /** 상대 팀 정규리그 승률 */
  oppPct: number;
  /** 상대 설명 */
  oppLabel: string;
}
export const PLAYOFF_ROUNDS: readonly PlayoffRoundDef[] = [
  { key: "semi", label: "4강", need: 3, oppPct: 0.75, oppLabel: "6강을 뚫고 올라온 강팀" },
  { key: "final", label: "챔피언결정전", need: 4, oppPct: 0.85, oppLabel: "반대편 1번 시드급 강팀" },
];

/** 정규리그·플레이오프 한 사람 기록 (빌드 스크립트가 넘긴다) */
export interface FormLine {
  games: number;
  minutes: number;
  points: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  ftm: number;
  fta: number;
}

/** KBL·FIBA 효율(EFF) = 득점 + 리바 + 어시 + 스틸 + 블록 − 놓친 야투 − 놓친 자유투 − 턴오버 */
export function effOf(l: FormLine): number {
  return l.points + l.reb + l.ast + l.stl + l.blk - (l.fga - l.fgm) - (l.fta - l.ftm) - l.tov;
}

/** 플레이오프 분당 EFF ÷ 정규시즌 분당 EFF (정규시즌 값이 거의 0 이면 null) */
export function playoffEffRatio(regular: FormLine, playoff: FormLine): number | null {
  if (playoff.games <= 0 || playoff.minutes <= 0 || regular.minutes <= 0) return null;
  const reg = effOf(regular) / regular.minutes;
  if (reg <= 0.05) return null;
  return effOf(playoff) / playoff.minutes / reg;
}

/**
 * 그 시즌 플레이오프 선수 전체의 비율(분 가중) — 플레이오프는 수비가 빡빡해 누구나 효율이 조금 떨어진다(2026-11-08 측정 중앙 ×0.94).
 * 그래서 선수 비율을 이 값으로 나눠 "그 시즌 플레이오프 평균보다 잘했나"로 본다.
 */
export function leaguePlayoffRatio(pairs: readonly { regular: FormLine; playoff: FormLine }[]): number {
  let po = 0, poMin = 0, reg = 0, regMin = 0;
  for (const { regular, playoff } of pairs) {
    if (playoff.minutes <= 0 || regular.minutes <= 0) continue;
    po += effOf(playoff);
    poMin += playoff.minutes;
    // 플레이오프에서 뛴 시간만큼의 정규시즌 효율
    reg += (effOf(regular) / regular.minutes) * playoff.minutes;
    regMin += playoff.minutes;
  }
  if (poMin === 0 || regMin === 0 || reg <= 0) return 1;
  return po / poMin / (reg / regMin);
}

/**
 * 플레이오프 폼 배율: (선수 비율 ÷ 그 시즌 리그 비율)을 출전 시간으로 1 쪽으로 당긴 뒤 범위 안으로.
 * 정규시즌 분당 EFF 가 거의 0 이면(벤치 선수) 1.
 */
export function playoffForm(regular: FormLine, playoff: FormLine, leagueRatio = 1): number {
  if (playoff.games <= 0 || playoff.minutes <= 0) return PLAYOFF_NO_RECORD_FORM;
  const raw = playoffEffRatio(regular, playoff);
  if (raw === null) return 1;
  const ratio = raw / (leagueRatio > 0 ? leagueRatio : 1);
  const w = playoff.minutes / (playoff.minutes + PLAYOFF_FORM_SHRINK_MINUTES);
  const f = 1 + (ratio - 1) * w;
  return Math.round(Math.min(PLAYOFF_FORM_MAX, Math.max(PLAYOFF_FORM_MIN, f)) * 100) / 100;
}

/** 후보의 플레이오프 배율 (기록 없으면 PLAYOFF_NO_RECORD_FORM) */
export const formOf = (c: GameCandidate) => c.po?.f ?? PLAYOFF_NO_RECORD_FORM;

const clamp99 = (v: number) => Math.max(1, Math.min(99, v));

/** 플레이오프 전력 — 점수·6축에 선수마다 폼 배율을 곱해 다시 매긴다 (가산점·케미는 그대로 다시 계산) */
export function playoffRating(players: readonly GameCandidate[]): TeamRating {
  return teamRating(
    players.map((p) => {
      const f = formOf(p);
      return { ...p, score: clamp99(p.score * f), axes: p.axes.map((a) => clamp99(a * f)) };
    }),
  );
}

/** log5: 우리 팀(리그 평균 상대 승률 p)과 상대(승률 o)가 붙었을 때 한 경기 승리 확률 */
export function vsWinProb(p: number, o: number): number {
  const a = p * (1 - o);
  const b = o * (1 - p);
  return a + b === 0 ? 0.5 : a / (a + b);
}

/** need 승을 먼저 하는 시리즈를 이길 확률 (한 경기 p) */
export function seriesWinProb(p: number, need: number): number {
  let total = 0;
  let comb = 1; // C(need - 1 + k, k)
  for (let k = 0; k < need; k++) {
    if (k > 0) comb = (comb * (need - 1 + k)) / k;
    total += comb * p ** need * (1 - p) ** k;
  }
  return total;
}

export interface PlayoffRoundResult extends PlayoffRoundDef {
  /** 한 경기 승리 확률 */
  gameProb: number;
  /** 시리즈 승리 확률 */
  seriesProb: number;
  /** 경기마다 이겼는가 */
  games: boolean[];
  wins: number;
  losses: number;
  won: boolean;
}

export interface PlayoffResult {
  rating: TeamRating;
  rounds: PlayoffRoundResult[];
  champion: boolean;
  /** 4강 → 우승까지 갈 확률 */
  titleProb: number;
  /** 어디까지 갔나: champion(우승) · final(챔프전 패) · semi(4강 패) */
  stage: "champion" | "final" | "semi";
}

export const isPlayoffSeed = (wins: number) => wins >= GAME_PLAYOFF_SEED_WINS && wins <= GAME_SEASON_GAMES;

/** 플레이오프 시뮬레이션 — 정규리그 1위만 (아니면 null) */
export function simulatePlayoffs(players: readonly GameCandidate[], regularWins: number): PlayoffResult | null {
  if (!isPlayoffSeed(regularWins)) return null;
  const rating = playoffRating(players);
  const p = winProbability(rating.rating);
  const rng = seededRng(hashSeed(`${lineupKey(players)}|playoff`));
  const rounds: PlayoffRoundResult[] = [];
  let alive = true;
  let titleProb = 1;
  for (const def of PLAYOFF_ROUNDS) {
    const gameProb = vsWinProb(p, def.oppPct);
    const seriesProb = seriesWinProb(gameProb, def.need);
    titleProb *= seriesProb;
    if (!alive) continue;
    const games: boolean[] = [];
    let w = 0;
    let l = 0;
    while (w < def.need && l < def.need) {
      const win = rng() < gameProb;
      games.push(win);
      if (win) w++;
      else l++;
    }
    const won = w === def.need;
    rounds.push({ ...def, gameProb, seriesProb, games, wins: w, losses: l, won });
    if (!won) alive = false;
  }
  const champion = rounds.length === PLAYOFF_ROUNDS.length && rounds.every((r) => r.won);
  const stage = champion ? "champion" : rounds.length === PLAYOFF_ROUNDS.length ? "final" : "semi";
  return { rating, rounds, champion, titleProb, stage };
}

/** 플레이오프 결과 한 줄 */
export function playoffVerdict(r: PlayoffResult): string {
  if (r.champion) {
    const sweep = r.rounds.every((x) => x.losses === 0);
    return sweep ? "플레이오프 전승 우승!" : "챔피언결정전 우승!";
  }
  const last = r.rounds[r.rounds.length - 1];
  return r.stage === "final" ? `챔프전 ${last.wins}승 ${last.losses}패, 준우승` : `4강 ${last.wins}승 ${last.losses}패에서 탈락`;
}
