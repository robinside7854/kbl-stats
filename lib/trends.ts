// KBL 30년 리그 변화 (기록 메뉴 "리그 변화" 탭, /records/trends) — 순수 함수만.
// 재료: 시즌 파일(data/processed/{시즌}/players.json)의 선수 시즌 합계를 시즌마다 모두 더한 값 (lib/data-history loadLeagueTrends).
//
// 계산식 (우리 규칙 — KBL 공식 리그 기록이 아니라 선수 기록을 더한 값):
// - 팀 경기 수 = 끝난 정규시즌 경기 × 2 (한 경기에 두 팀). 경기 목록(games.json)이 없으면 출전 시간 합 ÷ 200분(40분 × 5명)으로 근사
// - 경기당 팀 득점 = 리그 선수 득점 합 ÷ 팀 경기 수
// - 3점 시도 비중 = 3점 시도 합 ÷ 야투 시도 합 (야투 = 2점 + 3점, KBL fdgA)
// - 3점 성공률 = 3점 성공 합 ÷ 3점 시도 합
// - 자유투 시도율 = 자유투 시도 합 ÷ 야투 시도 합 (Basketball-Reference FTr 와 같은 식)
// - 외국 선수 득점 비중 = 외국 선수(아시아쿼터 포함 — 시즌 파일 isForeign) 득점 ÷ 리그 득점
// - 평균 키 = 선수 키를 출전 시간으로 가중 평균. 키는 선수 마스터의 **지금 등록 값**(시즌 당시 값이 아님), 키가 있는 선수만
import { seasonShortLabel } from "./career";

export type LeagueTrendKey = "teamPoints" | "threeRate" | "threePct" | "ftRate" | "foreignShare" | "height";

export interface LeagueTrendMetric {
  key: LeagueTrendKey;
  /** 칩 표기 */
  label: string;
  /** 차트 제목·요약 문장 앞머리 */
  title: string;
  /** 값 뒤 단위 ("점", "%", "cm") */
  unit: string;
  /** 소수 자리 */
  digits: number;
  /** 세로축을 0 부터 시작하는가 (비율은 0~, 키는 값 근처만) */
  zeroBase: boolean;
  /** 차트 아래 한 줄 안내 */
  note: string;
}

export const LEAGUE_TREND_METRICS: readonly LeagueTrendMetric[] = [
  { key: "teamPoints", label: "팀 득점", title: "경기당 팀 득점", unit: "점", digits: 1, zeroBase: false, note: "리그 선수 득점 합 ÷ 팀 경기 수(끝난 경기 × 2)." },
  { key: "threeRate", label: "3점 비중", title: "3점 시도 비중", unit: "%", digits: 1, zeroBase: true, note: "야투 시도 가운데 3점슛의 비율." },
  { key: "threePct", label: "3점 성공률", title: "3점 성공률", unit: "%", digits: 1, zeroBase: false, note: "리그 3점 성공 합 ÷ 시도 합." },
  { key: "ftRate", label: "자유투 시도율", title: "자유투 시도율", unit: "%", digits: 1, zeroBase: true, note: "야투 100개당 자유투 시도. 높을수록 파울을 많이 얻어 낸 리그." },
  { key: "foreignShare", label: "외국 선수 득점", title: "외국 선수 득점 비중", unit: "%", digits: 1, zeroBase: true, note: "아시아쿼터도 외국 선수로 셉니다." },
  { key: "height", label: "평균 키", title: "평균 키 (출전 시간 가중)", unit: "cm", digits: 1, zeroBase: false, note: "선수 키는 지금 등록된 값이라 그 시즌 당시 키와 다를 수 있습니다." },
];

/** 시즌 합계 한 줄에서 쓰는 값만 */
export interface TrendPlayerLine {
  points: number;
  fga: number;
  tpm: number;
  tpa: number;
  fta: number;
  minutes: number;
  /** 외국 선수(아시아쿼터 포함) */
  foreign: boolean;
  /** 지금 등록 키. 없으면 null — 평균 키에서 빠진다 */
  heightCm: number | null;
}

export interface TrendSeasonInput {
  seasonCode: number;
  seasonLabel: string;
  /** 끝난 정규시즌 경기 수 (경기 목록에서). 목록이 없으면 null → 출전 시간으로 근사 */
  endedGames: number | null;
  ongoing: boolean;
  players: readonly TrendPlayerLine[];
}

export interface LeagueTrendRow {
  seasonCode: number;
  /** "97-98" */
  short: string;
  ongoing: boolean;
  teamGames: number;
  values: Record<LeagueTrendKey, number | null>;
}

/** 팀 경기 수: 끝난 경기 × 2, 경기 목록이 없으면 출전 시간 합 ÷ 200 (반올림) */
export function teamGamesOf(endedGames: number | null, minutesTotal: number): number {
  if (endedGames !== null && endedGames > 0) return endedGames * 2;
  return Math.round(minutesTotal / 200);
}

const ratio = (a: number, b: number): number | null => (b > 0 ? (a / b) * 100 : null);

/** 한 시즌 → 리그 지표 한 줄. 선수가 없으면 null */
export function leagueTrendRow(s: TrendSeasonInput): LeagueTrendRow | null {
  if (s.players.length === 0) return null;
  let points = 0, fga = 0, tpm = 0, tpa = 0, fta = 0, minutes = 0, foreignPts = 0, hMin = 0, hSum = 0;
  for (const p of s.players) {
    points += p.points;
    fga += p.fga;
    tpm += p.tpm;
    tpa += p.tpa;
    fta += p.fta;
    minutes += p.minutes;
    if (p.foreign) foreignPts += p.points;
    if (p.heightCm && p.minutes > 0) {
      hMin += p.minutes;
      hSum += p.heightCm * p.minutes;
    }
  }
  const teamGames = teamGamesOf(s.endedGames, minutes);
  return {
    seasonCode: s.seasonCode,
    short: seasonShortLabel(s.seasonLabel),
    ongoing: s.ongoing,
    teamGames,
    values: {
      teamPoints: teamGames > 0 ? points / teamGames : null,
      threeRate: ratio(tpa, fga),
      threePct: ratio(tpm, tpa),
      ftRate: ratio(fta, fga),
      foreignShare: ratio(foreignPts, points),
      // 키가 있는 선수의 출전 시간이 절반도 안 되면 평균이 한쪽으로 쏠리므로 비운다
      height: hMin > 0 && hMin >= minutes / 2 ? hSum / hMin : null,
    },
  };
}

/** 표기: 12.3 + 단위 ("78.1점", "39.2%", "193.4cm") */
export function formatTrendValue(v: number | null, m: Pick<LeagueTrendMetric, "digits" | "unit">): string {
  if (v === null || !Number.isFinite(v)) return "–";
  return `${v.toFixed(m.digits)}${m.unit}`;
}

/**
 * 지표별 한 줄 요약 (자동 문장): "3점 시도 비중 97-98 18.0% → 25-26 39.2%". withTitle false 면 지표 이름 없이 (차트 제목 아래)
 * - 비교 끝점 = 값이 있는 첫 시즌 → 끝난 시즌 중 마지막 (진행 중 시즌은 경기 수가 적어 뺀다)
 * - 최고·최저가 끝점이 아닌 시즌에서 나왔고 끝점보다 2% 넘게 차이 나면 " · 최고 04-05 …" 를 하나 덧붙인다 (변화 폭이 더 큰 쪽)
 */
export function trendTakeaway(rows: readonly LeagueTrendRow[], key: LeagueTrendKey, withTitle = true): string | null {
  const m = LEAGUE_TREND_METRICS.find((x) => x.key === key)!;
  const done = rows.filter((r) => !r.ongoing && r.values[key] !== null);
  if (done.length < 2) return null;
  const first = done[0];
  const last = done[done.length - 1];
  const fv = first.values[key]!;
  const lv = last.values[key]!;
  let text = `${withTitle ? `${m.title} ` : ""}${first.short} ${formatTrendValue(fv, m)} → ${last.short} ${formatTrendValue(lv, m)}`;
  const inner = done.slice(1, -1);
  if (inner.length > 0) {
    const max = inner.reduce((a, b) => (b.values[key]! > a.values[key]! ? b : a));
    const min = inner.reduce((a, b) => (b.values[key]! < a.values[key]! ? b : a));
    const hi = Math.max(fv, lv);
    const lo = Math.min(fv, lv);
    const upGap = max.values[key]! - hi;
    const downGap = lo - min.values[key]!;
    // 끝점보다 눈에 띄게(끝점 값의 2% 넘게) 더 높거나 낮았을 때만 — 작은 출렁임까지 말하지 않는다
    const minGap = Math.abs(hi) * 0.02;
    if (upGap > minGap && upGap >= downGap) text += ` · 최고 ${max.short} ${formatTrendValue(max.values[key], m)}`;
    else if (downGap > minGap) text += ` · 최저 ${min.short} ${formatTrendValue(min.values[key], m)}`;
  }
  return text;
}
