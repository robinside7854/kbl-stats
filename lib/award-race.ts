// 시상 레이스 — 이번 시즌 MVP·MIP 후보 (2026-11-05 사용자 기준). 순수 함수만, 재료는 lib/data loadAwardRace.
// 화면: 기록 탭 "시상 레이스"(/records/race, AwardRaceView) · 홈 한 줄 카드(AwardRaceStrip) · 선수 머리말 칩(PlayerHero).
//
// MVP (묶음 둘: 국내 선수(아시아쿼터 포함) / 외국 선수 — 2026-11-05 사용자: 아시아쿼터는 국내 선수로 분류)
//   - 자격: 기본 표본 기준을 채우고, 팀 경기의 2/3 이상 뛰고, 팀이 지금 4위 이내, 개인 종합 점수 55(종합 B) 이상
//   - 순위: MVP 점수 = 개인 종합 점수 × 0.6 + 팀 승률(%) × 0.4 (2026-11-05 사용자: 삼성이 압도적 1위인데 후보가 적다 → 팀 성적 가중치)
//     같으면 개인 점수 → 팀 순위. 묶음마다 3명까지
//   - 개인 종합 점수: 사이트 등급과 같은 풀(국내+아시아쿼터 / 외국, lib/metrics gradeGroupOf)
//   - 지표별 순위: 같은 묶음(국내+아시아쿼터끼리 / 외국끼리) 안, 성공률은 리그 시도 기준을 채운 선수끼리
// MIP (전체 선수, 3명)
//   - 지난 시즌·이번 시즌 모두 표본 기준을 채운 선수 중, 경기당 출전 시간 증가 · 경기당 득점+리바운드+어시스트 증가 ·
//     TS%·PER 둘 다 증가 · 종합 등급 1단계 이상 · 종합 점수 15 이상 상승 — 모두 만족. 팀 성적은 보지 않는다
//   - 순위: 종합 점수 상승폭 → 등급 상승 단계 → 출전 시간 증가
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

export const MVP_TEAM_RANK_MAX = 4;
export const MVP_TEAM_WEIGHT = 0.4;
export const MVP_MIN_GAMES_SHARE = 2 / 3;
/** 개인 종합 점수 하한 = 종합 B (lib/metrics OVERALL_GRADE_CUTS) */
export const MVP_MIN_OVERALL = 55;
export const RACE_PICKS = 3;
export const MIP_MIN_SCORE_GAIN = 15;
export const MIP_MIN_GRADE_STEPS = 1;

export type MvpGroup = "domestic" | "foreign";
export const MVP_GROUPS: readonly MvpGroup[] = ["domestic", "foreign"];
export const MVP_GROUP_LABELS: Record<MvpGroup, string> = { domestic: "국내 선수", foreign: "외국 선수" };
/** 지표 순위 앞에 붙는 짧은 이름 ("국내 2위") */
export const MVP_GROUP_SHORT: Record<MvpGroup, string> = { domestic: "국내", foreign: "외국" };

/** MVP 카드에 보이는 지표 (CARD_STATS 키 + PER) */
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

/** MVP 점수: 개인 종합 점수(0~100) × 0.6 + 팀 승률(%) × 0.4 */
export function mvpScore(individual: number, teamPct: number): number {
  return round1(individual * (1 - MVP_TEAM_WEIGHT) + teamPct * 100 * MVP_TEAM_WEIGHT);
}

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
  const rows = qualified.flatMap((e) => {
    const p = e.player;
    const t = team.get(p.teamCode);
    if (!t || t.games === 0) return [];
    if (t.rank > MVP_TEAM_RANK_MAX) return [];
    if (p.games / t.games < MVP_MIN_GAMES_SHARE) return [];
    const ind = e.overallPct!;
    if (ind < MVP_MIN_OVERALL) return [];
    const samePos = p.positionGroup ? qualified.filter((x) => x.player.positionGroup === p.positionGroup) : [];
    const stats: RaceStat[] = MVP_STAT_KEYS.map((k) => {
      const s = e.stats.find((x) => x.def.key === k)!;
      return { key: k, label: s.def.label, text: statText(s.def.kind, s.value), rank: s.rank.rank, of: s.rank.of };
    });
    const pr = per.get(p.id);
    stats.push({ key: "per", label: "PER", text: p.per.toFixed(1), rank: pr?.rank ?? null, of: pr?.of ?? qualified.length });
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
      mvpScore: mvpScore(ind, t.pct),
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

/** MIP 후보 (전체 선수, 3명까지) */
export function mipCandidates(cards: SeasonCards, prevCards: SeasonCards): MipCandidate[] {
  const cur = seasonEntries(cards);
  const prev = seasonEntries(prevCards);
  const rows: Omit<MipCandidate, "rank">[] = [];
  for (const [id, e] of cur) {
    const q = prev.get(id);
    if (!q || !e.qualified || !q.qualified || e.overallPct === null || q.overallPct === null) continue;
    if (!isQualified(q.player, prevCards.defaults.rule)) continue;
    const a = mipLine(q);
    const b = mipLine(e);
    const steps = gradeSteps(a.grade, b.grade);
    const gain = e.overallPct - q.overallPct;
    const volume = (l: MipLine) => l.ppg + l.rpg + l.apg;
    const ok =
      b.mpg > a.mpg &&
      volume(b) > volume(a) &&
      b.tsPct > a.tsPct &&
      b.per > a.per &&
      steps >= MIP_MIN_GRADE_STEPS &&
      gain >= MIP_MIN_SCORE_GAIN;
    if (!ok) continue;
    const p = e.player;
    rows.push({ id, nameKo: p.nameKo, photoUrl: p.photoUrl, teamCode: p.teamCode, nationality: p.nationality, prev: a, cur: b, gain: round1(gain), steps });
  }
  rows.sort((x, y) => y.gain - x.gain || y.steps - x.steps || y.cur.mpg - y.prev.mpg - (x.cur.mpg - x.prev.mpg) || x.id.localeCompare(y.id));
  return rows.slice(0, RACE_PICKS).map((r, i) => ({ ...r, rank: i + 1 }));
}

/** 시상 레이스 전체 */
export function buildAwardRace(cards: SeasonCards, prevCards: SeasonCards, standings: readonly StandingRow[]): AwardRace {
  const teams: AwardRace["teams"] = {};
  for (const t of [...prevCards.teams, ...cards.teams]) teams[t.teamCode] = { shortName: t.shortName, logoUrl: t.logoUrl, color: t.color };
  return {
    seasonCode: cards.seasonCode,
    seasonLabel: cards.seasonLabel,
    prevSeasonCode: prevCards.seasonCode,
    prevSeasonLabel: prevCards.seasonLabel,
    teamGames: median(standings.map((r) => r.games)),
    mvp: { domestic: mvpCandidates(cards, standings, "domestic"), foreign: mvpCandidates(cards, standings, "foreign") },
    mip: mipCandidates(cards, prevCards),
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
