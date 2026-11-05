// 시상 레이스 — 이번 시즌 MVP·MIP 후보 (2026-11-05 사용자 기준). 순수 함수만, 재료는 lib/data loadAwardRace.
// 화면: 기록 탭 "시상 레이스"(/records/race, AwardRaceView) · 홈 한 줄 카드(AwardRaceStrip) · 선수 머리말 칩(PlayerHero).
//
// MVP (묶음 둘: 국내 선수(아시아쿼터 포함) / 외국 선수 — 2026-11-05 사용자: 아시아쿼터는 국내 선수로 분류)
//   기준은 과거 시즌 실제 정규리그 MVP(국내 30시즌)·외국선수 MVP(27시즌)를 되짚어 보며 고른 묶음별 규칙(2026-11-05 사용자 "가장
//   정확한 방법", 결정 A). 조합 약 15만 개(자격 문턱 × 점수 무게, 득점·PER 무게 포함)를 대입하고, 한 시즌씩 빼고 나머지로
//   고른 규칙이 빠진 시즌을 맞히는지(교차 검증)로 확인했다. 수상 가산점은 빼고 계산.
//   - 공통 자격: 기본 표본 기준, 팀 경기 2/3 이상 출전
//   - 국내: 팀 6위(플레이오프 자리) 이내·경기당 28분 이상·기록 합 국내 10위 이내, 점수 = 기록 합 70% + 팀 승률 20% + 종합 점수 10%
//     → 30시즌 1위 적중 22·3위 안 28 (교차 검증 16·24, 예전 규칙 19·26). 기록 합 10위 문턱은 2026-11-05 사용자 결정 —
//     역대 국내 MVP 30명 중 29명이 9위 안(예외 윤호영 11-12 12위), 1위 팀 덕에 기록이 약한 선수가 3위 안에 드는 것을 막는다
//   - 외국: "기록 합" 같은 묶음 10위 이내, 점수 = 팀 승률 60% + 기록 합 40% (종합 점수·출전 시간·팀 순위 문턱은 오히려 정확도를 떨어뜨려 뺌)
//     → 27시즌 1위 23·3위 안 26 (교차 검증 20·25, 예전 규칙 16·25)
//   - 기록 합 = 경기당 득점+리바+어시+스틸+블록, 점수에는 같은 묶음 안 백분위(나보다 낮은 선수 비율)로 들어간다
//   - 같으면 개인 점수 → 팀 순위. 묶음마다 3명까지
//   - 개인 종합 점수: 사이트 등급과 같은 풀(국내+아시아쿼터 / 외국, lib/metrics gradeGroupOf)
//   - 지표별 순위: 같은 묶음(국내+아시아쿼터끼리 / 외국끼리) 안, 성공률은 리그 시도 기준을 채운 선수끼리
// MIP (국내 선수(아시아쿼터 포함), 3명 — 실제 KBL 기량 발전상 26명이 모두 국내 선수)
//   - 평생 한 번: 앞선 시즌에 기량 발전상을 받은 선수는 빼고, MVP 급(앞선 시즌 정규리그 MVP·외국선수 MVP 수상자)도 뺀다
//     (2026-11-05 사용자: MIP 는 재수상 없음, MVP 3위권은 알 수 없어 수상자로)
//   - 지난 시즌·이번 시즌 모두 표본 기준을 채운 선수 중, 지난 시즌 종합 C 이하(55점 미만) → 이번 시즌 B 이상(55점 이상)
//     그리고 최근 3시즌(지난 시즌 포함, 표본 충족 시즌만) 종합 점수 평균도 C 이하 — 원래 잘하던 선수의 반등·부활은 빼려고
//     (2026-11-05 사용자: 양홍석처럼 원래 평균 이상이던 선수는 취지에 안 맞는다)
//   - 점수 = 기록 합 증가 70% + 이번 시즌 종합 점수 20% + PER 증가 10% — 셋 다 "지난 시즌·이번 시즌 기록이 있는 국내 선수" 안
//     백분위. 과거 26시즌 실제 수상자를 되짚어 보며 "지난 시즌 C 이하" 안에서 가장 잘 맞힌 조합(1위 9/26, 조합 약 9만 개,
//     2026-11-05). 실제 수상자 26명 중 16명은 지난 시즌에 이미 C 위였다 — 우리 취지와 실제 시상이 다른 부분이라 적중률이 낮다
//   - 같으면 종합 점수 상승폭. 팀 성적은 보지 않는다
// 모두 우리 규칙(KBL 공식 시상 기준 아님) — 화면 ⓘ 에 적는다.
import type { SeasonCards } from "./cards";
import type { StandingRow } from "./games";
import {
  buildCardContext,
  buildCardEntry,
  buildGradingContext,
  CARD_STATS,
  gradeScore,
  isQualified,
  perGame,
  type CardContext,
  type CardEntryOf,
  type Grade,
} from "./metrics";
import type { CardPlayer, CardTeam, Nationality, Position, PositionGroup } from "./types";

export const MVP_MIN_GAMES_SHARE = 2 / 3;
export const RACE_PICKS = 3;
/** MIP: 지난 시즌 종합 점수가 이 값 미만(C 이하) → 이번 시즌 이 값 이상(B 이상). lib/metrics OVERALL_GRADE_CUTS 의 B 컷 */
export const MIP_GRADE_LINE = 55;
/** MIP: 지난 시즌 포함 최근 몇 시즌 평균을 볼지 */
export const MIP_HISTORY_SEASONS = 3;
/** MIP 점수 무게 (합 1): 기록 합 증가·이번 시즌 종합 점수·PER 증가 — 각자 후보 풀 안 백분위 */
export const MIP_WEIGHTS = { prodGain: 0.7, overall: 0.2, perGain: 0.1 } as const;
/** MIP 에서 빼는 앞선 수상 (평생 한 번 + MVP 급) — scripts/awards AwardKey */
export const MIP_EXCLUDE_AWARDS: readonly string[] = ["mip", "mvp", "foreignMvp"];

export type MvpGroup = "domestic" | "foreign";
export const MVP_GROUPS: readonly MvpGroup[] = ["domestic", "foreign"];
export const MVP_GROUP_LABELS: Record<MvpGroup, string> = { domestic: "국내 선수", foreign: "외국 선수" };
/** 지표 순위 앞에 붙는 짧은 이름 ("국내 2위") */
export const MVP_GROUP_SHORT: Record<MvpGroup, string> = { domestic: "국내", foreign: "외국" };

export interface MvpGroupRule {
  /** 팀 순위 상한 (null = 보지 않음) */
  teamRankMax: number | null;
  /** 경기당 출전(분) 하한 */
  minMpg: number;
  /** 기록 합 같은 묶음 순위 상한 (null = 보지 않음) */
  prodRankMax: number | null;
  /** MVP 점수 무게 (합 1): 개인 종합 점수·팀 승률·기록 합 백분위 */
  weights: { overall: number; team: number; prod: number };
}

/** 묶음별 규칙 — 과거 MVP 되짚어 보기로 고른 값 (위 머리 주석) */
export const MVP_GROUP_RULES: Record<MvpGroup, MvpGroupRule> = {
  domestic: { teamRankMax: 6, minMpg: 28, prodRankMax: 10, weights: { overall: 0.1, team: 0.2, prod: 0.7 } },
  foreign: { teamRankMax: null, minMpg: 0, prodRankMax: 10, weights: { overall: 0, team: 0.6, prod: 0.4 } },
};

/** MVP 카드에 보이는 지표 (CARD_STATS 키 + PER + 기록 합) */
const MVP_STAT_KEYS = ["points", "reb", "ast", "stl", "blk", "fgPct", "tpPct"] as const;

export interface RaceStat {
  key: string;
  label: string;
  text: string;
  /** 같은 묶음 안 순위 (null = 시도 부족 등으로 순위 밖) */
  rank: number | null;
  of: number;
}

export interface RaceTeamLine {
  rank: number;
  wins: number;
  losses: number;
  /** 0~1 */
  pct: number;
}

export interface MvpCandidate {
  rank: number;
  id: string;
  nameKo: string;
  photoUrl: string | null;
  teamCode: string;
  position: Position | null;
  positionGroup: PositionGroup | null;
  nationality: Nationality | null;
  /** 개인 종합 등급·점수 (그 묶음 풀 기준) */
  grade: Grade | "-";
  score: number;
  /** MVP 점수 (소수 첫째 자리) */
  mvpScore: number;
  team: RaceTeamLine;
  games: number;
  teamGames: number;
  /** 같은 묶음·같은 포지션 묶음 안 개인 종합 점수 순위 (포지션 모르면 null) */
  posRank: { rank: number; of: number } | null;
  stats: RaceStat[];
}

export interface MipLine {
  grade: Grade | "-";
  score: number;
  games: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  tsPct: number;
  per: number;
}

export interface MipCandidate {
  rank: number;
  id: string;
  nameKo: string;
  photoUrl: string | null;
  teamCode: string;
  nationality: Nationality | null;
  prev: MipLine;
  cur: MipLine;
  /** 종합 점수 상승 (소수 첫째 자리) */
  gain: number;
  /** 종합 등급 상승 단계 */
  steps: number;
  /** 최근 시즌(지난 시즌 포함, 표본 충족) 종합 점수 평균과 그 시즌 수 */
  recent: { score: number; seasons: number };
  /** 경기당 득점+리바+어시+스틸+블록 증가 (소수 첫째 자리) */
  prodGain: number;
  /** MIP 점수 0~100 (MIP_WEIGHTS) */
  score: number;
}

export interface AwardRace {
  seasonCode: number;
  seasonLabel: string;
  prevSeasonCode: number;
  prevSeasonLabel: string;
  /** 팀 경기 수 가운데값 (팀당 N경기 기준) */
  teamGames: number;
  mvp: Record<MvpGroup, MvpCandidate[]>;
  mip: MipCandidate[];
  teams: Record<string, Pick<CardTeam, "shortName" | "logoUrl" | "color">>;
}

const GRADE_STEP: Record<Grade | "-", number> = { S: 5, A: 4, B: 3, C: 2, D: 1, F: 0, "-": -1 };
/** 등급 상승 단계 (S 5 … F 0) */
export const gradeSteps = (from: Grade | "-", to: Grade | "-") => (from === "-" || to === "-" ? 0 : GRADE_STEP[to] - GRADE_STEP[from]);

const round1 = (v: number) => Math.round(v * 10) / 10;
const median = (xs: readonly number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

/** MVP 점수 (0~100): 개인 종합 점수(0~100)·팀 승률(0~1)·기록 합 백분위(0~1)를 묶음 무게로 */
export function mvpScore(group: MvpGroup, individual: number, teamPct: number, prodPct: number): number {
  const w = MVP_GROUP_RULES[group].weights;
  return round1(individual * w.overall + teamPct * 100 * w.team + prodPct * 100 * w.prod);
}

/** 기록 합 = 경기당 득점+리바운드+어시스트+스틸+블록 */
export const productionPerGame = (p: Pick<CardPlayer, "points" | "reb" | "ast" | "stl" | "blk" | "games">) =>
  perGame(p.points + p.reb + p.ast + p.stl + p.blk, p.games);

/** 아시아쿼터는 국내 선수 묶음 (2026-11-05 사용자) — 사이트 등급 풀과 같다 */
function groupOfPlayer(p: CardPlayer): MvpGroup {
  return (p.nationality ?? (p.isForeign ? "foreign" : "domestic")) === "foreign" ? "foreign" : "domestic";
}

/** 묶음 하나의 등급·순위 재료 (등급은 사이트와 같은 풀, 순위는 그 묶음 선수끼리) */
function groupContext(cards: SeasonCards, group: MvpGroup): { ctx: CardContext; members: CardPlayer[] } {
  const grading = buildGradingContext(cards.players, cards.defaults.rule, cards.coverage);
  const members = cards.players.filter((p) => groupOfPlayer(p) === group);
  const ctx = buildCardContext(members, cards.defaults.rule, cards.coverage, { thresholds: cards.defaults.thresholds, grading });
  return { ctx, members };
}

const statText = (kind: "perGame" | "pct", v: number) => (kind === "pct" ? `${v.toFixed(1)}%` : v.toFixed(1));

/** 같은 묶음 안 PER 순위 (표본 충족 선수끼리, 높은 순, 동점 같은 순위) */
function perRanks(entries: readonly CardEntryOf<CardPlayer>[]): Map<string, { rank: number; of: number }> {
  const q = entries.filter((e) => e.qualified);
  const out = new Map<string, { rank: number; of: number }>();
  for (const e of q) out.set(e.player.id, { rank: 1 + q.filter((x) => x.player.per > e.player.per).length, of: q.length });
  return out;
}

/** 묶음 하나의 MVP 후보 (3명까지) */
export function mvpCandidates(cards: SeasonCards, standings: readonly StandingRow[], group: MvpGroup): MvpCandidate[] {
  const team = new Map(standings.map((r) => [r.teamCode, r]));
  const { ctx, members } = groupContext(cards, group);
  const entries = members.map((p) => buildCardEntry(p, ctx));
  const qualified = entries.filter((e) => e.qualified && e.overallPct !== null);
  const per = perRanks(entries);
  const rule = MVP_GROUP_RULES[group];
  const prodRankOf = (p: CardPlayer) => 1 + qualified.filter((x) => productionPerGame(x.player) > productionPerGame(p)).length;
  const rows = qualified.flatMap((e) => {
    const p = e.player;
    const t = team.get(p.teamCode);
    if (!t || t.games === 0) return [];
    if (rule.teamRankMax !== null && t.rank > rule.teamRankMax) return [];
    if (p.games / t.games < MVP_MIN_GAMES_SHARE) return [];
    if (perGame(p.minutes, p.games) < rule.minMpg) return [];
    const ind = e.overallPct!;
    const prodRank = prodRankOf(p);
    if (rule.prodRankMax !== null && prodRank > rule.prodRankMax) return [];
    const mine = productionPerGame(p);
    const prodPct = qualified.length > 1 ? qualified.filter((x) => productionPerGame(x.player) < mine).length / (qualified.length - 1) : 1;
    const samePos = p.positionGroup ? qualified.filter((x) => x.player.positionGroup === p.positionGroup) : [];
    const stats: RaceStat[] = MVP_STAT_KEYS.map((k) => {
      const s = e.stats.find((x) => x.def.key === k)!;
      return { key: k, label: s.def.label, text: statText(s.def.kind, s.value), rank: s.rank.rank, of: s.rank.of };
    });
    const pr = per.get(p.id);
    stats.push({ key: "per", label: "PER", text: p.per.toFixed(1), rank: pr?.rank ?? null, of: pr?.of ?? qualified.length });
    stats.push({ key: "prod", label: "기록 합", text: productionPerGame(p).toFixed(1), rank: prodRank, of: qualified.length });
    const c: Omit<MvpCandidate, "rank"> = {
      id: p.id,
      nameKo: p.nameKo,
      photoUrl: p.photoUrl,
      teamCode: p.teamCode,
      position: p.position,
      positionGroup: p.positionGroup,
      nationality: p.nationality,
      grade: e.overall,
      score: gradeScore(ind) ?? 0,
      mvpScore: mvpScore(group, ind, t.pct, prodPct),
      team: { rank: t.rank, wins: t.wins, losses: t.losses, pct: t.pct },
      games: p.games,
      teamGames: t.games,
      posRank: samePos.length ? { rank: 1 + samePos.filter((x) => x.overallPct! > ind).length, of: samePos.length } : null,
      stats,
    };
    return [{ c, ind }];
  });
  rows.sort((a, b) => b.c.mvpScore - a.c.mvpScore || b.ind - a.ind || a.c.team.rank - b.c.team.rank || a.c.id.localeCompare(b.c.id));
  return rows.slice(0, RACE_PICKS).map((r, i) => ({ ...r.c, rank: i + 1 }));
}

function mipLine(e: CardEntryOf<CardPlayer>): MipLine {
  const p = e.player;
  return {
    grade: e.overall,
    score: gradeScore(e.overallPct) ?? 0,
    games: p.games,
    mpg: perGame(p.minutes, p.games),
    ppg: perGame(p.points, p.games),
    rpg: perGame(p.reb, p.games),
    apg: perGame(p.ast, p.games),
    tsPct: p.tsPct,
    per: p.per,
  };
}

/** 사이트 등급과 같은 풀(국내+아시아쿼터 / 외국)로 매긴 시즌 카드 값 */
function seasonEntries(cards: SeasonCards): Map<string, CardEntryOf<CardPlayer>> {
  const grading = buildGradingContext(cards.players, cards.defaults.rule, cards.coverage);
  const ctx = buildCardContext(cards.players, cards.defaults.rule, cards.coverage, { thresholds: cards.defaults.thresholds, grading });
  return new Map(cards.players.map((p) => [p.id, buildCardEntry(p, ctx)]));
}

/** MIP 점수 (백분위는 0~1) */
export function mipScore(prodGainPct: number, overallPct: number, perGainPct: number): number {
  return round1((prodGainPct * MIP_WEIGHTS.prodGain + overallPct * MIP_WEIGHTS.overall + perGainPct * MIP_WEIGHTS.perGain) * 100);
}

/**
 * MIP 후보 (국내 선수(아시아쿼터 포함), 3명까지). older = 지난 시즌보다 앞선 시즌들(최근 것 먼저) — 최근 시즌 평균에 쓴다.
 * excluded = 빼는 선수 번호(앞선 시즌 기량 발전상·MVP 수상자, lib/data 가 색인 수상 기록으로 만든다).
 */
export function mipCandidates(
  cards: SeasonCards,
  prevCards: SeasonCards,
  older: readonly SeasonCards[] = [],
  excluded: ReadonlySet<string> = new Set(),
): MipCandidate[] {
  const cur = seasonEntries(cards);
  const prev = seasonEntries(prevCards);
  const olderEntries = older.slice(0, MIP_HISTORY_SEASONS - 1).map(seasonEntries);
  const prodOf = (p: CardPlayer) => (p.points + p.reb + p.ast + p.stl + p.blk) / Math.max(1, p.games);
  // 백분위 풀: 이번 시즌 표본 충족 + 지난 시즌 기록이 있는 국내 선수 (되짚어 보기와 같은 풀)
  const pool = [...cur].flatMap(([id, e]) => {
    const q = prev.get(id);
    if (!q || !e.qualified || e.overallPct === null || e.player.nationality === "foreign") return [];
    return [{ id, e, q, prodGain: prodOf(e.player) - prodOf(q.player), perGain: e.player.per - q.player.per, overall: e.overallPct }];
  });
  const pctIn = (vals: number[], v: number) => vals.filter((x) => x < v).length / Math.max(1, vals.length - 1);
  const prodVals = pool.map((r) => r.prodGain);
  const perVals = pool.map((r) => r.perGain);
  const ovrVals = pool.map((r) => r.overall);
  const rows: Omit<MipCandidate, "rank">[] = [];
  for (const { id, e, q, prodGain, perGain, overall } of pool) {
    if (excluded.has(id)) continue;
    if (!q.qualified || q.overallPct === null || !isQualified(q.player, prevCards.defaults.rule)) continue;
    const hist = [q, ...olderEntries.map((m) => m.get(id))].flatMap((x) => (x && x.qualified && x.overallPct !== null ? [x.overallPct] : []));
    const recentAvg = hist.reduce((sum, v) => sum + v, 0) / hist.length;
    if (!(q.overallPct < MIP_GRADE_LINE && overall >= MIP_GRADE_LINE && recentAvg < MIP_GRADE_LINE)) continue;
    const a = mipLine(q);
    const b = mipLine(e);
    const p = e.player;
    rows.push({
      id,
      nameKo: p.nameKo,
      photoUrl: p.photoUrl,
      teamCode: p.teamCode,
      nationality: p.nationality,
      prev: a,
      cur: b,
      gain: round1(overall - q.overallPct),
      steps: gradeSteps(a.grade, b.grade),
      recent: { score: gradeScore(recentAvg) ?? 0, seasons: hist.length },
      prodGain: round1(prodGain),
      score: mipScore(pctIn(prodVals, prodGain), pctIn(ovrVals, overall), pctIn(perVals, perGain)),
    });
  }
  rows.sort((x, y) => y.score - x.score || y.gain - x.gain || x.id.localeCompare(y.id));
  return rows.slice(0, RACE_PICKS).map((r, i) => ({ ...r, rank: i + 1 }));
}

/** 시상 레이스 전체 */
export function buildAwardRace(
  cards: SeasonCards,
  prevCards: SeasonCards,
  standings: readonly StandingRow[],
  older: readonly SeasonCards[] = [],
  mipExcluded: ReadonlySet<string> = new Set(),
): AwardRace {
  const teams: AwardRace["teams"] = {};
  for (const t of [...prevCards.teams, ...cards.teams]) teams[t.teamCode] = { shortName: t.shortName, logoUrl: t.logoUrl, color: t.color };
  return {
    seasonCode: cards.seasonCode,
    seasonLabel: cards.seasonLabel,
    prevSeasonCode: prevCards.seasonCode,
    prevSeasonLabel: prevCards.seasonLabel,
    teamGames: median(standings.map((r) => r.games)),
    mvp: { domestic: mvpCandidates(cards, standings, "domestic"), foreign: mvpCandidates(cards, standings, "foreign") },
    mip: mipCandidates(cards, prevCards, older, mipExcluded),
    teams,
  };
}

/** 선수 머리말 칩 글자 (후보가 아니면 빈 배열). 예: "MVP 후보 1위", "MIP 후보 2위" */
export function raceTagsOf(race: AwardRace | null, playerId: string): string[] {
  if (!race) return [];
  const out: string[] = [];
  for (const g of MVP_GROUPS) {
    const c = race.mvp[g].find((x) => x.id === playerId);
    if (c) out.push(`MVP 후보 ${c.rank}위`);
  }
  const m = race.mip.find((x) => x.id === playerId);
  if (m) out.push(`MIP 후보 ${m.rank}위`);
  return out;
}

/** 지표 순위 한 줄 ("국내 2위" / 순위 밖이면 "") */
export function raceRankText(group: MvpGroup, s: Pick<RaceStat, "rank">): string {
  return s.rank === null ? "" : `${MVP_GROUP_SHORT[group]} ${s.rank}위`;
}
