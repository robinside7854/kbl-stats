// 비교 탭 "통산" 카드 (2026-10-01 사용자 요청: 시즌 말고 시즌 통산으로도 비교) — 순수 함수만.
// 전 시즌 카드 데이터의 선수 행을 선수 번호로 더해 "통산 시즌" 하나(코드 CAREER_CODE = 0)처럼 만든다.
// 그러면 카드·순위·등급 계산(lib/cardview·lib/metrics)을 그대로 쓴다 — 비교 집단은 통산 CAREER_QUALIFY 를 넘긴 선수들.
//   - 누적(경기·득점·시도 등)은 합, 성공률은 성공 합 ÷ 시도 합(TS%·eFG%·TOV%·AST/TO 도 합계로 다시 계산)
//   - PER·USG%·REB%·AST% 는 출전 시간 가중 평균 (시즌 값만 있어 합계로 다시 못 만든다)
//   - 굿디펜스·디플렉션·미드레인지는 기록이 없던 시즌이 섞여 옛 선수에게 불리해서 통산 레이더에서 뺀다(coverage false)
import type { SeasonCards } from "./cards";
import type { CardPlayer, CardTeam, SeasonCoverage } from "./types";
import type { QualifyRule } from "./metrics";

/** 통산 카드의 시즌 코드 (실제 시즌 코드는 1부터라 겹치지 않는다) — 주소 ?a=번호:0 */
export const CAREER_CODE = 0;
export const CAREER_LABEL = "통산";
/** 통산 비교 집단: 100경기·1,000분 이상 (몇 경기 뛴 선수가 경기당 순위 위에 오지 않게) */
export const CAREER_QUALIFY: QualifyRule = { minGames: 100, minMinutes: 1000 };
/** 통산 커버리지: 전 시즌에 고르게 있는 항목만 */
export const CAREER_COVERAGE: SeasonCoverage = { advanced: true, plusMinus: true, goodDef: false, hustle: false, shots: false };

const SUM_KEYS = [
  "games", "minutes", "points", "reb", "ast", "stl", "blk", "tov", "fouls", "fga", "tpa", "fta",
  "fgm", "twoPa", "tpm", "oreb", "dreb", "goodDef", "deflections", "screenAst", "plusMinus", "midA", "midM",
] as const;
const MIN_WEIGHTED = ["per", "usgPct", "rebPct", "astPct"] as const;

const pct = (made: number, att: number) => (att > 0 ? (made / att) * 100 : 0);

/** 시즌별 카드 데이터 → 통산 카드 선수 목록 + 팀(각 선수 마지막 시즌 팀) */
export function buildCareerCards(seasons: readonly SeasonCards[]): { players: CardPlayer[]; teams: CardTeam[] } {
  const sorted = [...seasons].sort((a, b) => a.seasonCode - b.seasonCode);
  type Acc = { last: CardPlayer; lastSeason: number; lastTeam: CardTeam | undefined; sums: Record<string, number>; ftm: number; twoPm: number; w: Record<string, number> };
  const by = new Map<string, Acc>();
  for (const s of sorted) {
    for (const p of s.players) {
      let a = by.get(p.id);
      if (!a) {
        a = { last: p, lastSeason: s.seasonCode, lastTeam: undefined, sums: Object.fromEntries(SUM_KEYS.map((k) => [k, 0])), ftm: 0, twoPm: 0, w: Object.fromEntries(MIN_WEIGHTED.map((k) => [k, 0])) };
        by.set(p.id, a);
      }
      a.last = p;
      a.lastSeason = s.seasonCode;
      a.lastTeam = s.teams.find((t) => t.teamCode === p.teamCode);
      for (const k of SUM_KEYS) a.sums[k] += Number.isFinite(p[k]) ? p[k] : 0;
      a.ftm += ((p.ftPct || 0) * p.fta) / 100;
      a.twoPm += ((p.twoPPct || 0) * p.twoPa) / 100;
      for (const k of MIN_WEIGHTED) a.w[k] += (Number.isFinite(p[k]) ? p[k] : 0) * p.minutes;
    }
  }
  const players: CardPlayer[] = [];
  const teams = new Map<string, CardTeam>();
  for (const a of by.values()) {
    const s = a.sums;
    const poss = s.fga + 0.44 * s.fta + s.tov;
    const minW = (k: (typeof MIN_WEIGHTED)[number]) => (s.minutes > 0 ? a.w[k] / s.minutes : 0);
    // 팀 코드는 "마지막 시즌-팀 코드"로 — 같은 코드라도 시대마다 구단이 달랐던 경우(예: 10 = 기아 → 현대모비스) 로고·이름이 섞이지 않게
    const teamKey = `${a.lastSeason}-${a.last.teamCode}`;
    players.push({
      ...a.last,
      teamCode: teamKey,
      ...(Object.fromEntries(SUM_KEYS.map((k) => [k, s[k]])) as Pick<CardPlayer, (typeof SUM_KEYS)[number]>),
      fgPct: pct(s.fgm, s.fga),
      tpPct: pct(s.tpm, s.tpa),
      ftPct: pct(a.ftm, s.fta),
      twoPPct: pct(a.twoPm, s.twoPa),
      tsPct: s.fga + 0.44 * s.fta > 0 ? (s.points / (2 * (s.fga + 0.44 * s.fta))) * 100 : 0,
      efgPct: pct(s.fgm + 0.5 * s.tpm, s.fga),
      tovPct: pct(s.tov, poss),
      astTo: s.tov > 0 ? s.ast / s.tov : 0,
      per: minW("per"),
      usgPct: minW("usgPct"),
      rebPct: minW("rebPct"),
      astPct: minW("astPct"),
      offenseType: null,
    });
    if (a.lastTeam) teams.set(teamKey, { ...a.lastTeam, teamCode: teamKey });
  }
  return { players, teams: [...teams.values()] };
}
