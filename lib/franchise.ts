// 팀 페이지 규칙 (2026-10-04 사용자 요청: 팀마다 역대 시즌 성적·로스터·우승·레전드, 지금은 없는 추억의 팀까지).
// 순수 함수만 — 재료는 lib/data loadFranchises 가 시즌 파일(data/processed)에서 모아 넘긴다.
// 팀 = 팀 코드 하나. KBL 은 이름만 바뀌면 코드를 유지하고(기아→현대모비스), 구단을 사고팔면 새 코드를 준다(SBS→KT&G).
// 기록은 코드마다 따로 세고, 매각 전후는 계보 줄(data/codes/team-lineage.json)로만 잇는다.

/** 플레이오프 결과 단계 */
export type PlayoffStage = "champion" | "runnerUp" | "semi" | "quarter";

export const PLAYOFF_STAGE_LABELS: Record<PlayoffStage, string> = {
  champion: "우승",
  runnerUp: "준우승",
  semi: "4강",
  quarter: "6강",
};

/** 정규시즌 이 순위까지는 6강을 건너뛰고 4강부터 (지금 KBL 방식 — 옛 시즌 방식이 달라도 이 규칙으로 센다) */
export const PLAYOFF_BYE_RANK = 2;

/**
 * 그 시즌 플레이오프 결과. entry = 경기 목록에서 센 출전 기록(6강·4강 상대 수, 챔프전 진출).
 * 챔프전에 나갔으면 우승/준우승, 아니면 6강·4강 상대가 둘이거나 정규 1·2위면 4강, 하나면 6강. 못 나갔으면 null.
 */
export function playoffStage(
  entry: { series: number; finals: boolean } | undefined,
  isChampion: boolean,
  regularRank: number | null,
): PlayoffStage | null {
  if (isChampion) return "champion";
  if (!entry) return null;
  if (entry.finals) return "runnerUp";
  if (entry.series >= 2) return "semi";
  if (regularRank !== null && regularRank <= PLAYOFF_BYE_RANK) return "semi";
  return "quarter";
}

// ── 레전드 (2026-10-04 사용자 결정: 이 팀에서 10시즌 이상 뛴 선수만) ──
export const LEGEND_MIN_SEASONS = 10;
/** 레전드 카드에 함께 보여 주는 큰 상 (이 팀 소속으로 받은 것) */
export const LEGEND_AWARD_KEYS = ["mvp", "foreignMvp", "finalsMvp"] as const;

export function isLegend(seasons: number): boolean {
  return seasons >= LEGEND_MIN_SEASONS;
}

/** 레전드 기준 안내 한 줄 */
export const LEGEND_RULE_TEXT = `이 팀에서 ${LEGEND_MIN_SEASONS}시즌 이상 뛴 선수`;

// ── 시즌 한 줄 ─────────────────────────────────────────
export interface TeamSeasonRow {
  seasonCode: number;
  /** "25-26" */
  label: string;
  /** 그 시즌 팀 이름 (예: "원주 동부") */
  name: string;
  shortName: string;
  logoUrl: string | null;
  wins: number;
  losses: number;
  /** 0~1, 경기가 없으면 null */
  pct: number | null;
  /** 정규시즌 순위 (경기 결과 기준), 경기가 없으면 null */
  rank: number | null;
  teamCount: number;
  regularFirst: boolean;
  stage: PlayoffStage | null;
  /** 진행 중 시즌 (우승팀 미정) */
  ongoing: boolean;
  /** 그 시즌 이 팀 경기당 득점 1위 */
  topScorer: { id: string; name: string; ppg: number } | null;
}

export interface FranchiseTotals {
  seasons: number;
  wins: number;
  losses: number;
  pct: number | null;
  /** 정규리그 1위 */
  regularFirsts: number;
  /** 챔프전 우승 */
  championships: number;
  runnerUps: number;
  /** 통합 우승 = 같은 시즌 정규리그 1위 + 챔프전 우승 */
  doubles: number;
  /** 플레이오프 진출 (6강 이상, 진행 중 시즌 제외) */
  playoffs: number;
}

export function franchiseTotals(rows: readonly TeamSeasonRow[]): FranchiseTotals {
  const wins = rows.reduce((s, r) => s + r.wins, 0);
  const losses = rows.reduce((s, r) => s + r.losses, 0);
  return {
    seasons: rows.length,
    wins,
    losses,
    pct: wins + losses > 0 ? wins / (wins + losses) : null,
    regularFirsts: rows.filter((r) => r.regularFirst).length,
    championships: rows.filter((r) => r.stage === "champion").length,
    runnerUps: rows.filter((r) => r.stage === "runnerUp").length,
    doubles: rows.filter((r) => r.regularFirst && r.stage === "champion").length,
    playoffs: rows.filter((r) => !r.ongoing && r.stage !== null).length,
  };
}

/** 가장 좋은 정규시즌 (팀 페이지 "역대 실적", 2026-10-14) — 끝난 시즌 중 승률 → 승수 → 최근 순. 없으면 null */
export function bestRegularSeason(rows: readonly TeamSeasonRow[]): TeamSeasonRow | null {
  let best: TeamSeasonRow | null = null;
  for (const r of rows) {
    if (r.ongoing || r.pct === null) continue;
    if (!best || r.pct > best.pct! || (r.pct === best.pct && (r.wins > best.wins || (r.wins === best.wins && r.seasonCode > best.seasonCode)))) best = r;
  }
  return best;
}

/** 승률 표기 ".667" */
export function pctText(p: number | null): string {
  if (p === null) return "–";
  return p >= 1 ? "1.000" : p.toFixed(3).replace(/^0/, "");
}

// ── 선수 (로스터·레전드·팀 기록) ───────────────────────────
export interface RosterRow {
  id: string;
  name: string;
  /** 포지션 약자 G/F/C/GF/FC, 없으면 null */
  pos: string | null;
  foreign: boolean;
  gp: number;
  /** 경기당 분·득점·리바·어시 (소수 1자리) */
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  /** 경기당 스틸·블록·턴오버·3점 성공 (소수 1자리, 2026-10-30 로스터 표 열 늘림) */
  spg: number;
  bpg: number;
  tpg: number;
  tpmPg: number;
  /** 시즌 합계 성공·시도 — 성공률은 화면에서 rosterPct 로 (시도 0 이면 "–") */
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  photoUrl: string | null;
}

/** 로스터 표 정렬 열 (2026-10-30 사용자: 머리글을 눌러 정렬, 다른 기록 표처럼 열 더) */
export type RosterSortKey = "gp" | "mpg" | "ppg" | "rpg" | "apg" | "spg" | "bpg" | "tpg" | "tpmPg" | "fgPct" | "tpPct" | "ftPct";

/** 성공률 정렬은 시즌 시도가 이만큼 이상인 선수만 위로 (적게 던진 100% 가 1위가 되지 않게 — 우리 규칙). 모자란 선수는 방향과 상관없이 뒤 */
export const ROSTER_PCT_MIN_ATTEMPTS = 10;

/** 성공률 % (시도 0 이면 null) */
export function rosterPct(r: RosterRow, key: "fgPct" | "tpPct" | "ftPct"): number | null {
  const [m, a] = key === "fgPct" ? [r.fgm, r.fga] : key === "tpPct" ? [r.tpm, r.tpa] : [r.ftm, r.fta];
  return a > 0 ? (m / a) * 100 : null;
}

/**
 * 로스터 줄 세우기. 기본(asc false) = 큰 값부터(턴오버도), asc = 같은 머리글을 한 번 더 누른 반대 순서.
 * 성공률 열은 시도가 ROSTER_PCT_MIN_ATTEMPTS 미만이면 어느 방향이든 맨 뒤. 같으면 경기당 득점 → 경기 수 → 이름.
 */
export function sortRoster(rows: readonly RosterRow[], key: RosterSortKey, asc = false): RosterRow[] {
  const isPct = key === "fgPct" || key === "tpPct" || key === "ftPct";
  const attempts = (r: RosterRow) => (key === "fgPct" ? r.fga : key === "tpPct" ? r.tpa : r.fta);
  const low = (r: RosterRow) => isPct && attempts(r) < ROSTER_PCT_MIN_ATTEMPTS;
  const val = (r: RosterRow) => (isPct ? (rosterPct(r, key) ?? -1) : r[key]);
  const dir = asc ? -1 : 1;
  return [...rows].sort(
    (a, b) => Number(low(a)) - Number(low(b)) || dir * (val(b) - val(a)) || b.ppg - a.ppg || b.gp - a.gp || a.name.localeCompare(b.name, "ko"),
  );
}

/** 한 선수가 이 팀에서 남긴 합계 (시즌 기록 합) */
export interface PlayerTenure {
  id: string;
  name: string;
  photoUrl: string | null;
  seasonCodes: number[];
  games: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tpm: number;
  /** 이 팀 소속으로 받은 큰 상 (LEGEND_AWARD_KEYS) */
  majorAwards: { key: string; seasonCode: number }[];
}

export interface SeasonPlayerLine {
  id: string;
  name: string;
  photoUrl: string | null;
  seasonCode: number;
  games: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tpm: number;
}

/** 시즌 기록 줄 → 선수별 이 팀 합계 (경기 0 인 줄은 뺀다) */
export function buildTenures(lines: readonly SeasonPlayerLine[], awards: readonly { playerNo: string; key: string; seasonCode: number }[]): PlayerTenure[] {
  const by = new Map<string, PlayerTenure>();
  for (const l of lines) {
    if (l.games <= 0) continue;
    let t = by.get(l.id);
    if (!t) {
      t = { id: l.id, name: l.name, photoUrl: l.photoUrl, seasonCodes: [], games: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0, majorAwards: [] };
      by.set(l.id, t);
    }
    if (!t.seasonCodes.includes(l.seasonCode)) t.seasonCodes.push(l.seasonCode);
    t.games += l.games;
    t.pts += l.pts;
    t.reb += l.reb;
    t.ast += l.ast;
    t.stl += l.stl;
    t.blk += l.blk;
    t.tpm += l.tpm;
    t.name = l.name; // 가장 최근 줄의 이름
    if (l.photoUrl) t.photoUrl = l.photoUrl;
  }
  const major = new Set<string>(LEGEND_AWARD_KEYS);
  for (const a of awards) {
    const t = by.get(a.playerNo);
    if (t && major.has(a.key)) t.majorAwards.push({ key: a.key, seasonCode: a.seasonCode });
  }
  for (const t of by.values()) t.seasonCodes.sort((a, b) => a - b);
  return [...by.values()];
}

/** 레전드: 기준을 넘은 선수, 시즌 수 → 경기 수 → 득점 순 */
export function pickLegends(tenures: readonly PlayerTenure[]): PlayerTenure[] {
  return tenures
    .filter((t) => isLegend(t.seasonCodes.length))
    .sort((a, b) => b.seasonCodes.length - a.seasonCodes.length || b.games - a.games || b.pts - a.pts);
}

/** 레전드가 없는 팀(짧게 있었던 팀)은 가장 오래 뛴 선수 몇 명을 대신 보여 준다 */
export function longestTenures(tenures: readonly PlayerTenure[], n = 5): PlayerTenure[] {
  return [...tenures].sort((a, b) => b.seasonCodes.length - a.seasonCodes.length || b.games - a.games || b.pts - a.pts).slice(0, n);
}

export const TEAM_LEADER_STATS = [
  { key: "pts", label: "득점" },
  { key: "reb", label: "리바운드" },
  { key: "ast", label: "어시스트" },
  { key: "stl", label: "스틸" },
  { key: "blk", label: "블록" },
  { key: "tpm", label: "3점 성공" },
  { key: "games", label: "출전 경기" },
] as const;
export type TeamLeaderKey = (typeof TEAM_LEADER_STATS)[number]["key"];

/** 이 팀 통산 부문별 상위 n명 (같으면 경기 적은 순 → 이름) */
export function franchiseLeaders(tenures: readonly PlayerTenure[], key: TeamLeaderKey, n = 5): { id: string; name: string; photoUrl: string | null; value: number }[] {
  return tenures
    .filter((t) => t[key] > 0)
    .sort((a, b) => b[key] - a[key] || a.games - b.games || a.name.localeCompare(b.name, "ko"))
    .slice(0, n)
    .map((t) => ({ id: t.id, name: t.name, photoUrl: t.photoUrl, value: t[key] }));
}

// ── 이름 이력·계보 ─────────────────────────────────────
/** 시즌 순(오래된 순) 이름 → 연속 구간 [{name, from, to}] */
export function nameSpans(rows: readonly { seasonCode: number; name: string }[]): { name: string; from: number; to: number }[] {
  const out: { name: string; from: number; to: number }[] = [];
  for (const r of [...rows].sort((a, b) => a.seasonCode - b.seasonCode)) {
    const last = out[out.length - 1];
    if (last && last.name === r.name) last.to = r.seasonCode;
    else out.push({ name: r.name, from: r.seasonCode, to: r.seasonCode });
  }
  return out;
}

/** 계보 줄: 이 코드의 앞 구단들 → 이 코드 → 뒤 구단들 (successor = 코드 → 다음 구단 코드). 고리가 있어도 멈춘다 */
export function lineageChain(code: string, successor: Readonly<Record<string, string>>): string[] {
  const before: string[] = [];
  const prevOf = new Map(Object.entries(successor).map(([from, to]) => [to, from]));
  const seen = new Set([code]);
  for (let c = prevOf.get(code); c && !seen.has(c); c = prevOf.get(c)) {
    before.unshift(c);
    seen.add(c);
  }
  const after: string[] = [];
  for (let c = successor[code]; c && !seen.has(c); c = successor[c]) {
    after.push(c);
    seen.add(c);
  }
  return [...before, code, ...after];
}

// ── 화면에 넘기는 모양 ─────────────────────────────────
export interface TeamBrand {
  teamCode: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  color: { primary: string; secondary: string; text: string };
}

export interface TeamAwardLine {
  seasonCode: number;
  label: string;
  key: string;
  awardLabel: string;
  playerNo: string;
  name: string;
}

export interface TeamPageData {
  brand: TeamBrand;
  /** 지금 리그에 있는 팀 (최근 두 시즌 안에 기록) */
  active: boolean;
  /** "97 - 08-09" 같은 활동 기간 */
  spanLabel: string;
  names: { name: string; span: string }[];
  /** 최신 시즌 먼저 */
  rows: TeamSeasonRow[];
  totals: FranchiseTotals;
  /** 시즌 코드 → 로스터 (경기당 득점 순) */
  rosters: Record<string, RosterRow[]>;
  legends: (PlayerTenure & { span: string })[];
  /** 레전드가 없을 때 대신 보여 주는 오래 뛴 선수 */
  longest: (PlayerTenure & { span: string })[];
  leaders: { key: TeamLeaderKey; label: string; list: { id: string; name: string; photoUrl: string | null; value: number }[] }[];
  awards: TeamAwardLine[];
  lineage: (TeamBrand & { active: boolean; span: string })[];
}

export interface TeamIndexEntry {
  brand: TeamBrand;
  active: boolean;
  spanLabel: string;
  seasons: number;
  championships: number;
  regularFirsts: number;
  /** 지금 팀 순서(활동 중) / 첫 시즌(추억의 팀) */
  order: number;
  /** 추억의 팀이면 지금 이어지는 팀 이름 */
  successorName: string | null;
}

const MAJOR_AWARD_SHORT: Record<string, string> = { mvp: "MVP", foreignMvp: "외국선수 MVP", finalsMvp: "챔프전 MVP" };

/** 큰 상 요약 "MVP 2회 · 챔프전 MVP 1회" (LEGEND_AWARD_KEYS 순서, 없으면 빈 문자열) */
export function majorAwardSummary(awards: readonly { key: string }[]): string {
  return LEGEND_AWARD_KEYS.map((k) => [MAJOR_AWARD_SHORT[k], awards.filter((a) => a.key === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `${label} ${n}회`)
    .join(" · ");
}
