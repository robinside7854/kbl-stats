// 역대 통산 순위 (Basketball-Reference "Career Leaders" 참고, 2026-10-01) — 순수 함수만.
// 재료: 1997 시즌부터 모든 정규시즌 시즌 파일의 선수 합계를 선수 번호로 더한 값(lib/data loadCareerTotals 가 만든다).
// 통산 경기당 = 통산 합계 ÷ 통산 경기. 경기당 순위는 통산 RECORDS_MIN_GAMES 경기 이상만(몇 경기 뛰고 끝난 선수가 위에 오지 않게 — 우리 규칙).
// KBL 이 발표하는 공식 통산 기록과 다를 수 있다(기록 정정 등) → 화면·용어에 안내.

import { perGame } from "./metrics";
import type { RosterStatus } from "./roster";

export type RecordStatKey = "points" | "reb" | "ast" | "stl" | "blk" | "tpm" | "doubleDoubles" | "tripleDoubles" | "games" | "minutes" | "wins";
export type RecordMode = "total" | "perGame";
export type RecordOrigin = "all" | "domestic" | "foreign";

export interface RecordStatDef {
  key: RecordStatKey;
  label: string;
  /** 값 단위 (예: "점") */
  unit: string;
  /** 경기당 모드가 의미 있는가 (경기 수는 아님) */
  perGame: boolean;
}

/** 배열 순서 = 부문 칩 순서 */
export const RECORD_STATS: readonly RecordStatDef[] = [
  { key: "points", label: "득점", unit: "점", perGame: true },
  { key: "reb", label: "리바운드", unit: "개", perGame: true },
  { key: "ast", label: "어시스트", unit: "개", perGame: true },
  { key: "stl", label: "스틸", unit: "개", perGame: true },
  { key: "blk", label: "블록", unit: "개", perGame: true },
  { key: "tpm", label: "3점 성공", unit: "개", perGame: true },
  // 더블더블·트리플더블 (2026-10-03): KBL 시즌 기록 dd2·td3 를 더한 횟수. 경기당은 의미가 적어 합계만
  { key: "doubleDoubles", label: "더블더블", unit: "회", perGame: false },
  { key: "tripleDoubles", label: "트리플더블", unit: "회", perGame: false },
  { key: "games", label: "출전 경기", unit: "경기", perGame: false },
  { key: "minutes", label: "출전 시간", unit: "분", perGame: true },
  // 승리: 뛴 경기에서 팀이 이긴 횟수 (결장 제외). 경기당은 의미가 없어 합계만
  { key: "wins", label: "승리", unit: "승", perGame: false },
];

/** 경기당 순위에 들어가는 최소 통산 경기 (정규시즌 54경기 × 약 4시즌) */
export const RECORDS_MIN_GAMES = 200;
/** 첫 화면에 보이는 순위 수 ("더 보기"로 늘린다) */
export const RECORDS_PAGE_SIZE = 50;

/** 선수 한 명의 통산 합계 (정규시즌) */
export interface CareerTotal {
  id: string;
  nameKo: string;
  photoUrl: string | null;
  origin: "domestic" | "foreign";
  /** 뛴 시즌 수 · 첫/마지막 시즌 라벨 ("1997" / "2025-2026") */
  seasons: number;
  firstLabel: string;
  lastLabel: string;
  /** 마지막으로 뛴 시즌 코드 — 현역 판정(isActiveCareer)에 쓴다 */
  lastSeasonCode: number;
  /** KBL 등록 명단 기준 상태 (lib/roster rosterStatusOf). 없으면(명단 raw 없음) 마지막 시즌으로 현역을 판정 */
  rosterStatus?: RosterStatus | null;
  /** 마지막 시즌 팀 한글 약칭·색 */
  lastTeam: string;
  lastTeamColor: string;
  games: number;
  minutes: number;
  points: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tpm: number;
  doubleDoubles: number;
  tripleDoubles: number;
  /** 뛴 경기의 팀 승·패 */
  wins: number;
  losses: number;
}

/** 시즌 합계 행들을 선수별로 더한다 (같은 선수의 여러 시즌 → 하나). 순서 무관 */
export function sumCareerTotals<T extends Omit<CareerTotal, "seasons" | "firstLabel" | "lastLabel" | "lastSeasonCode" | "lastTeam" | "lastTeamColor"> & { seasonCode: number; seasonLabel: string; teamShort: string; teamColor: string }>(
  rows: readonly T[],
): CareerTotal[] {
  const by = new Map<string, CareerTotal & { firstCode: number; lastCode: number }>();
  const add = ["games", "minutes", "points", "reb", "ast", "stl", "blk", "tpm", "doubleDoubles", "tripleDoubles", "wins", "losses"] as const;
  for (const r of rows) {
    const cur = by.get(r.id);
    if (!cur) {
      by.set(r.id, {
        id: r.id, nameKo: r.nameKo, photoUrl: r.photoUrl, origin: r.origin,
        rosterStatus: r.rosterStatus ?? null,
        seasons: 1, firstLabel: r.seasonLabel, lastLabel: r.seasonLabel, lastSeasonCode: r.seasonCode, lastTeam: r.teamShort, lastTeamColor: r.teamColor,
        firstCode: r.seasonCode, lastCode: r.seasonCode,
        games: r.games, minutes: r.minutes, points: r.points, reb: r.reb, ast: r.ast, stl: r.stl, blk: r.blk, tpm: r.tpm,
        doubleDoubles: r.doubleDoubles, tripleDoubles: r.tripleDoubles, wins: r.wins, losses: r.losses,
      });
      continue;
    }
    cur.seasons += 1;
    for (const k of add) cur[k] += r[k];
    if (r.seasonCode < cur.firstCode) {
      cur.firstCode = r.seasonCode;
      cur.firstLabel = r.seasonLabel;
    }
    if (r.seasonCode > cur.lastCode) {
      cur.lastCode = r.seasonCode;
      cur.lastLabel = r.seasonLabel;
      cur.lastSeasonCode = r.seasonCode;
      cur.lastTeam = r.teamShort;
      cur.lastTeamColor = r.teamColor;
      cur.nameKo = r.nameKo;
      cur.origin = r.origin;
    }
  }
  return [...by.values()].map(({ firstCode: _f, lastCode: _l, ...t }) => t);
}

/**
 * 현역 판정: KBL 등록 명단(rosterStatus)이 있으면 그것 — 명단에 있으면 현역(2026-10-06).
 * 명단 raw 가 없을 때만 예전 규칙: 기록이 있는 가장 최근 시즌(latestSeasonCode)에 뛰었으면 현역.
 */
export function isActiveCareer(t: Pick<CareerTotal, "lastSeasonCode" | "rosterStatus">, latestSeasonCode: number): boolean {
  if (t.rosterStatus) return t.rosterStatus === "active";
  return t.lastSeasonCode === latestSeasonCode;
}

/** 화면 값: 합계 그대로, 경기당은 통산 합계 ÷ 통산 경기 (경기 수 부문은 항상 합계) */
export function recordValue(t: CareerTotal, key: RecordStatKey, mode: RecordMode): number {
  if (mode === "perGame" && RECORD_STATS.find((d) => d.key === key)?.perGame) return perGame(t[key], t.games);
  return t[key];
}

export interface RecordRow {
  rank: number;
  total: CareerTotal;
  value: number;
}

/**
 * 통산 순위: 국적·현역 필터 → (경기당이면 RECORDS_MIN_GAMES 경기 이상) → 값 큰 순.
 * 같은 값은 같은 순위(1, 2, 2, 4), 같은 값 안에서는 경기 많은 순 → 이름순.
 */
export function rankCareerTotals(
  totals: readonly CareerTotal[],
  key: RecordStatKey,
  mode: RecordMode,
  origin: RecordOrigin,
  /** 주면 그 시즌에 뛴 선수(현역, isActiveCareer)만 — 순위도 현역끼리 다시 매긴다 */
  activeSeasonCode?: number,
): RecordRow[] {
  const effMode: RecordMode = RECORD_STATS.find((d) => d.key === key)?.perGame ? mode : "total";
  const pool = totals.filter(
    (t) =>
      (origin === "all" || t.origin === origin) &&
      (activeSeasonCode === undefined || isActiveCareer(t, activeSeasonCode)) &&
      (effMode === "total" || t.games >= RECORDS_MIN_GAMES) &&
      t[key] > 0,
  );
  const sorted = pool
    .map((t) => ({ total: t, value: recordValue(t, key, effMode) }))
    .sort((a, b) => b.value - a.value || b.total.games - a.total.games || a.total.nameKo.localeCompare(b.total.nameKo, "ko") || a.total.id.localeCompare(b.total.id));
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || r.value !== sorted[i - 1].value) rank = i + 1;
    return { rank, ...r };
  });
}

const NF0 = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 표기: 합계는 정수(천 단위 쉼표), 경기당은 소수 1자리 */
export function formatRecord(value: number, key: RecordStatKey, mode: RecordMode): string {
  return mode === "perGame" && key !== "games" ? NF1.format(value) : NF0.format(Math.round(value));
}

// ─────────────────────────────────────────────
// 통산 이정표 (2026-10-01 — Basketball-Reference 의 통산 기록 맥락 참고): "통산 5,000점까지 123점 · 지금 역대 41위"
// 현역 선수만 (은퇴 선수는 더 쌓이지 않는다). 부문별 다음 이정표 = 지금 값보다 큰 가장 가까운 단계(STEP 의 배수).
// ─────────────────────────────────────────────

/** 부문별 이정표 간격 (우리 규칙: KBL 정규시즌 54경기 기준으로 2~3시즌에 한 번쯤 닿는 크기) */
export const MILESTONE_STEPS: Readonly<Partial<Record<RecordStatKey, number>>> = {
  points: 1000,
  reb: 500,
  ast: 500,
  stl: 100,
  blk: 100,
  tpm: 100,
  games: 100,
  wins: 100,
};

/** 화면에 보이는 이정표 수 (가장 가까운 것부터) */
export const MILESTONE_COUNT = 3;

export interface Milestone {
  key: RecordStatKey;
  label: string;
  unit: string;
  /** 지금 통산 값 */
  current: number;
  /** 다음 이정표 값 */
  target: number;
  /** 남은 값 */
  remaining: number;
  /** 지금 이 부문 역대 순위 (통산 합계, 같은 값은 같은 순위) */
  rank: number;
}

/**
 * 한 선수의 다음 이정표 MILESTONE_COUNT 개 — 남은 양이 간격에 비해 작은 순(곧 닿는 것부터).
 * 0 인 부문(예: 3점을 안 던지는 센터)은 뺀다. all: 역대 순위를 매길 전체 통산 목록(자기 자신 포함).
 */
export function nextMilestones(t: CareerTotal, all: readonly CareerTotal[], n = MILESTONE_COUNT): Milestone[] {
  const out: Milestone[] = [];
  const ratio = new Map<RecordStatKey, number>();
  for (const def of RECORD_STATS) {
    const step = MILESTONE_STEPS[def.key];
    const current = t[def.key];
    if (!step || current <= 0) continue;
    const target = (Math.floor(current / step) + 1) * step;
    const remaining = target - current;
    const rank = 1 + all.filter((o) => o[def.key] > current).length;
    out.push({ key: def.key, label: def.label, unit: def.unit, current, target, remaining, rank });
    ratio.set(def.key, remaining / step);
  }
  const order = (k: RecordStatKey) => RECORD_STATS.findIndex((d) => d.key === k);
  return out.sort((a, b) => ratio.get(a.key)! - ratio.get(b.key)! || order(a.key) - order(b.key)).slice(0, n);
}

// ─────────────────────────────────────────────
// 역대 기록 하위 탭 (2026-10-03 사용자 요청: 누적 / 한 경기 최다 / 한 시즌 최다 / 수상·우승)
// 화면에는 부문·구분마다 상위 RECORD_LIST_TOP 개만 서버에서 골라 보낸다(lib/data) — 아래는 그 순위 규칙.
// ─────────────────────────────────────────────

/** 경기 구분: 정규시즌 / 플레이오프(6강~챔프전 전체) / 챔피언결정전 */
export type GameKind = "regular" | "playoff" | "finals";
export const GAME_KINDS: readonly { value: GameKind; label: string }[] = [
  { value: "regular", label: "정규시즌" },
  { value: "playoff", label: "플레이오프" },
  { value: "finals", label: "챔프전" },
];

/** 부문·구분마다 보여 주는 순위 수 */
export const RECORD_LIST_TOP = 50;

/** 같은 값은 같은 순위 (1, 2, 2, 4). sorted 는 이미 값 큰 순 */
export function withRanks<T>(sorted: readonly T[], valueOf: (t: T) => number): (T & { rank: number })[] {
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || valueOf(r) !== valueOf(sorted[i - 1])) rank = i + 1;
    return { ...r, rank };
  });
}

/** 한 경기 최다 한 줄 재료 (선수의 통산 최고 기록 — 선수마다 한 번) */
export interface GameHighEntry {
  id: string;
  value: number;
  date: string | null;
}

/**
 * 한 경기 최다 순위: 값 큰 순 → 같으면 먼저 세운 기록(날짜 없음은 뒤) → 선수 번호. 0 은 뺀다.
 * 재료가 선수별 통산 최고 기록이라 한 선수는 한 번만 나온다(같은 선수의 두 번째 기록은 없음 — 화면 안내).
 */
export function rankGameHighs<T extends GameHighEntry>(entries: readonly T[], top = RECORD_LIST_TOP): (T & { rank: number })[] {
  const sorted = entries
    .filter((e) => e.value > 0)
    .sort(
      (a, b) =>
        b.value - a.value ||
        (a.date && b.date ? a.date.localeCompare(b.date) : a.date ? -1 : b.date ? 1 : 0) ||
        a.id.localeCompare(b.id),
    );
  return withRanks(sorted, (e) => e.value).filter((r) => r.rank <= top);
}

/** 한 시즌 최다 부문 */
export type SeasonBestKey = "points" | "reb" | "ast" | "stl" | "blk" | "tpm" | "ftm" | "doubleDoubles" | "tripleDoubles";
export const SEASON_BEST_STATS: readonly { key: SeasonBestKey; label: string; unit: string; perGame: boolean }[] = [
  { key: "points", label: "득점", unit: "점", perGame: true },
  { key: "reb", label: "리바운드", unit: "개", perGame: true },
  { key: "ast", label: "어시스트", unit: "개", perGame: true },
  { key: "stl", label: "스틸", unit: "개", perGame: true },
  { key: "blk", label: "블록", unit: "개", perGame: true },
  { key: "tpm", label: "3점 성공", unit: "개", perGame: true },
  { key: "ftm", label: "자유투 성공", unit: "개", perGame: true },
  { key: "doubleDoubles", label: "더블더블", unit: "회", perGame: false },
  { key: "tripleDoubles", label: "트리플더블", unit: "회", perGame: false },
];

/**
 * 한 시즌 경기당 순위에 드는 최소 경기 (우리 규칙 — KBL 공식 시상 기준 아님):
 * 정규시즌 = 그 시즌 최다 출전 경기의 60%(올림, 1997 시즌처럼 경기 수가 다른 시즌도 같은 비율),
 * 플레이오프 = 5경기, 챔프전 = 4경기(시리즈 최소 경기).
 */
export const POSTSEASON_MIN_GAMES: Readonly<Record<Exclude<GameKind, "regular">, number>> = { playoff: 5, finals: 4 };
export const REGULAR_MIN_GAMES_SHARE = 0.6;

export function seasonBestMinGames(kind: GameKind, seasonMaxGames: number): number {
  return kind === "regular" ? Math.max(1, Math.ceil(seasonMaxGames * REGULAR_MIN_GAMES_SHARE)) : POSTSEASON_MIN_GAMES[kind];
}

/** 한 시즌 기록 한 줄 (선수 × 시즌 — 한 선수가 여러 번 나올 수 있다) */
export interface SeasonLineEntry {
  id: string;
  seasonCode: number;
  games: number;
  /** 경기당 순위 자격 (최소 경기 충족 + 끝난 시즌) — lib/data 가 seasonBestMinGames 로 정한다 */
  perGameOk: boolean;
  stats: Record<SeasonBestKey, number>;
}

/**
 * 한 시즌 최다 순위: 합계는 값 큰 순, 경기당은 자격 있는 줄만 합계 ÷ 경기.
 * 같은 값 → 경기 적은 쪽(합계)·많은 쪽(경기당)이 앞 → 이른 시즌 → 선수 번호. 0 은 뺀다.
 */
export function rankSeasonBests<T extends SeasonLineEntry>(
  lines: readonly T[],
  key: SeasonBestKey,
  mode: RecordMode,
  top = RECORD_LIST_TOP,
): (T & { rank: number; value: number })[] {
  const per = mode === "perGame" && SEASON_BEST_STATS.find((d) => d.key === key)?.perGame;
  const rows = lines
    .filter((l) => l.stats[key] > 0 && (!per || l.perGameOk))
    .map((l) => ({ ...l, value: per ? perGame(l.stats[key], l.games) : l.stats[key] }))
    .sort(
      (a, b) =>
        b.value - a.value ||
        (per ? b.games - a.games : a.games - b.games) ||
        a.seasonCode - b.seasonCode ||
        a.id.localeCompare(b.id),
    );
  return withRanks(rows, (r) => r.value).filter((r) => r.rank <= top);
}

/** 수상·우승 순위: 받은 시즌 수 큰 순 → 같으면 먼저 받은 선수 → 선수 번호. 0 회는 뺀다 */
export function rankAwardCounts<T extends { id: string; seasonCodes: readonly number[] }>(entries: readonly T[], top = RECORD_LIST_TOP): (T & { rank: number; count: number })[] {
  const rows = entries
    .map((e) => ({ ...e, count: new Set(e.seasonCodes).size }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count || Math.min(...a.seasonCodes) - Math.min(...b.seasonCodes) || a.id.localeCompare(b.id));
  return withRanks(rows, (r) => r.count).filter((r) => r.rank <= top);
}

/** 화면에 보내는 사람 정보 (목록마다 반복하지 않게 선수 번호로 한 번만) */
export interface RecordPerson {
  nameKo: string;
  photoUrl: string | null;
  /** 아바타 대체 색 (마지막 팀 주 색) */
  color: string;
}

/** 화면에 보내는 순위 한 줄 (표기는 서버에서 끝낸다) */
export interface RecordListItem {
  /** 전체(필터 없음) 기준 순위 — 화면은 필터 뒤 filterRecordList 로 다시 매긴다 */
  rank: number;
  id: string;
  /** 순위를 다시 매길 때 쓰는 값 (같은 값 = 같은 순위) */
  num: number;
  /** 국내 / 외국인(외국+아시아쿼터) — 선수 마스터 국적 */
  origin: "domestic" | "foreign";
  /** 현역 (기록 있는 최신 시즌에 뛴 선수, isActiveCareer 와 같은 뜻) */
  active: boolean;
  /** 큰 숫자, 예: "52" · "31.4" */
  value: string;
  /** 단위, 예: "점" */
  unit: string;
  /** 둘째 줄, 예: "05-06 · 모비스 · vs 삼성 · 2006.03.05" */
  sub: string;
  /** 숫자 아래 작은 글씨, 예: "8/12 · 66.7%" · "2회" */
  note?: string | null;
  /** 그 경기 일정 화면 (정규시즌만) */
  gameHref?: string | null;
}

export interface RecordListsData {
  people: Record<string, RecordPerson>;
  /** 키는 화면마다 다르다: 한 경기 "구분:부문", 한 시즌 "구분:부문:단위", 수상 "부문" */
  lists: Record<string, RecordListItem[]>;
}

/**
 * 국적·현역 필터 → 순위 다시 매기기 → 상위 top. items 는 서버가 이미 순위 순서로 줄 세운 목록(필터마다 상위 top 이 다 들어 있다,
 * lib/data unionForFilters) — 순서는 그대로 두고 순위만 새로 센다.
 */
export function filterRecordList(items: readonly RecordListItem[], origin: RecordOrigin, activeOnly: boolean, top = RECORD_LIST_TOP): RecordListItem[] {
  const kept = items.filter((r) => (origin === "all" || r.origin === origin) && (!activeOnly || r.active));
  return withRanks(kept, (r) => r.num).filter((r) => r.rank <= top);
}
