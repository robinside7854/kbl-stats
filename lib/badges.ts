// 칭호 배지 — 순수 함수만 둔다 (CLAUDE.md 원칙 5).
// 기록에서 바로 셀 수 있는 것만 배지로 만든다(추정·주관 금지). 정규시즌 기록만 센다.
// 재료: 선수 한 명의 시즌별 행(팀 코드·경기·더블더블·트리플더블) + 드래프트 연도 + 커리어 하이 득점(BadgeCareer),
//       시즌마다 "최다 경기 수"와 부문 1위(BadgeIndex — 시즌 파일 전체에서 한 번 만든다).
// 빌드 시점에 lib/data.ts 가 재료를 모아 부르고, 결과(라벨 목록)만 화면으로 넘긴다.
// 조건 문장은 BADGE_DEFS 에 같이 두어 용어 탭 "칭호 배지" 표(/glossary#badge-list)가 그대로 읽는다.

import { DEFAULT_QUALIFY } from "./metrics";
import { filterLeaders, rankMap, type LeaderStatKey } from "./leaders";
import type { LeaderPlayer } from "./types";

// ─────────────────────────────────────────────
// 문턱값 — 조건 문장(BADGE_DEFS)과 계산(playerBadges)이 같은 상수를 쓴다
// ─────────────────────────────────────────────

/** 원클럽맨: 뛴 시즌 이 수 이상 + 소속 팀 코드 하나 */
export const ONE_CLUB_MIN_SEASONS = 5;
/** 베테랑: 뛴 시즌 이 수 이상 */
export const VETERAN_MIN_SEASONS = 10;
/** 롱런(키는 legend — 용어 탭 앵커 #badge-legend 를 깨지 않으려고 유지): 뛴 시즌 이 수 이상 (베테랑 대신) */
export const LEGEND_MIN_SEASONS = 15;
/** 철인: 그 시즌 최다 경기를 전부 뛴 시즌이 이 수 이상 */
export const IRON_MAN_MIN_SEASONS = 3;
/** 40득점 클럽 / 50득점 클럽: 정규시즌 커리어 하이 득점 */
export const CLUB_40 = 40;
export const CLUB_50 = 50;
/** 더블더블 머신: 한 시즌 더블더블 이 수 이상 */
export const DD_MACHINE_MIN = 20;

/** 시즌 부문 1위(왕) 배지를 매기는 부문 — 순위표 부문 키(lib/leaders)와 같다 */
export const KING_STATS = ["points", "reb", "ast", "stl", "blk"] as const satisfies readonly LeaderStatKey[];
export type KingStat = (typeof KING_STATS)[number];

export type BadgeKey =
  | "scoringKing"
  | "reboundKing"
  | "assistKing"
  | "stealKing"
  | "blockKing"
  | "legend"
  | "club50"
  | "club40"
  | "tripleDouble"
  | "veteran"
  | "oneClub"
  | "ironMan"
  | "ddMachine"
  | "rookie";

export interface BadgeDef {
  key: BadgeKey;
  /** 배지 이름 (횟수가 붙는 배지는 2회 이상일 때 " ×n") */
  label: string;
  /** 붙는 조건 (사람이 읽는 문장 — 용어 탭 표) */
  condition: string;
  /** 한 줄 설명 */
  short: string;
}

const KING_RULE = `그 시즌 표본 기준(${DEFAULT_QUALIFY.minGames}경기·${DEFAULT_QUALIFY.minMinutes}분 이상) 선수 중 경기당`;

/** 배열 순서 = 우선순위 (히어로는 앞에서 5개, 선수 탭 그리드는 맨 앞 1개). 용어 탭 표 순서도 같다 */
export const BADGE_DEFS: readonly BadgeDef[] = [
  { key: "scoringKing", label: "득점왕", condition: `${KING_RULE} 득점 1위 (공동 1위 포함). 2회 이상이면 ×횟수`, short: "그 시즌 경기당 득점 1위" },
  { key: "reboundKing", label: "리바운드왕", condition: `${KING_RULE} 리바운드 1위 (공동 1위 포함). 2회 이상이면 ×횟수`, short: "그 시즌 경기당 리바운드 1위" },
  { key: "assistKing", label: "어시스트왕", condition: `${KING_RULE} 어시스트 1위 (공동 1위 포함). 2회 이상이면 ×횟수`, short: "그 시즌 경기당 어시스트 1위" },
  { key: "stealKing", label: "스틸왕", condition: `${KING_RULE} 스틸 1위 (공동 1위 포함). 2회 이상이면 ×횟수`, short: "그 시즌 경기당 스틸 1위" },
  { key: "blockKing", label: "블록왕", condition: `${KING_RULE} 블록 1위 (공동 1위 포함). 2회 이상이면 ×횟수`, short: "그 시즌 경기당 블록 1위" },
  // 2026-10-01 라벨 "레전드" → "15시즌 클럽": 레전드는 실력까지 뜻하는 말이라, 오래 뛴 사실만 담는 이름으로 (40득점 클럽과 같은 꼴)
  { key: "legend", label: "롱런", condition: `정규시즌을 뛴 시즌이 ${LEGEND_MIN_SEASONS}개 이상 (베테랑 대신 붙음)`, short: "KBL 에서 15시즌 이상 뛴 선수" },
  { key: "club50", label: "50득점 클럽", condition: `정규시즌 한 경기 최다 득점(커리어 하이) ${CLUB_50}점 이상 (40득점 클럽 대신 붙음)`, short: "한 경기 50점 이상을 넣어 본 선수" },
  { key: "club40", label: "40득점 클럽", condition: `정규시즌 한 경기 최다 득점(커리어 하이) ${CLUB_40}점 이상 ${CLUB_50}점 미만`, short: "한 경기 40점 이상을 넣어 본 선수" },
  { key: "tripleDouble", label: "트리플더블", condition: "정규시즌 통산 트리플더블 1회 이상. 2회 이상이면 ×횟수", short: "한 경기 세 부문 두 자릿수" },
  { key: "veteran", label: "베테랑", condition: `정규시즌을 뛴 시즌이 ${VETERAN_MIN_SEASONS}개 이상 ${LEGEND_MIN_SEASONS}개 미만`, short: "10시즌 넘게 뛴 선수" },
  { key: "oneClub", label: "원클럽맨", condition: `뛴 시즌 ${ONE_CLUB_MIN_SEASONS}개 이상이고 소속 팀 코드가 하나 (이름만 바뀐 구단은 같은 팀)`, short: "한 구단에서만 뛴 선수" },
  { key: "ironMan", label: "철인", condition: `그 시즌 선수 중 최다 경기 수만큼 출전한 시즌이 ${IRON_MAN_MIN_SEASONS}개 이상`, short: "여러 시즌 한 경기도 빠지지 않은 선수" },
  { key: "ddMachine", label: "더블더블 머신", condition: `한 시즌 더블더블 ${DD_MACHINE_MIN}회 이상인 시즌이 있음`, short: "더블더블을 밥 먹듯 한 시즌이 있는 선수" },
  // 2026-10-01 라벨 "신인" → "루키" (키 rookie·앵커 유지)
  { key: "rookie", label: "루키", condition: "뛴 시즌이 최신 시즌 하나뿐이고 드래프트 연도가 그 시즌 (예: 2025 드래프트 → 25-26)", short: "이번 시즌 데뷔한 드래프트 신인" },
];

const KING_BADGE: Record<KingStat, BadgeKey> = {
  points: "scoringKing",
  reb: "reboundKing",
  ast: "assistKing",
  stl: "stealKing",
  blk: "blockKing",
};

// ─────────────────────────────────────────────
// 재료
// ─────────────────────────────────────────────

/** 선수 한 명의 시즌 행 (정규시즌) */
export interface BadgeSeasonRow {
  seasonCode: number;
  teamCode: string;
  games: number;
  doubleDoubles: number;
  tripleDoubles: number;
}

export interface BadgeCareer {
  playerNo: string;
  /** 뛴 시즌 (순서 무관) */
  seasons: readonly BadgeSeasonRow[];
  /** 드래프트 연도 (선수 마스터). 외국 선수 등 없으면 null */
  draftYear: number | null;
  /** 정규시즌 커리어 하이 득점 (색인 careerHighs.regular.pts). 없으면 null */
  careerHighPoints: number | null;
}

/** 시즌 하나의 배지 재료 */
export interface BadgeSeasonInfo {
  /** 그 시즌 선수 중 최다 경기 수 (시즌 파일 players 의 max games) */
  maxGames: number;
  /** 부문별 경기당 1위 선수 번호 (공동 1위면 여럿) */
  kings: Record<KingStat, string[]>;
}

export interface BadgeIndex {
  /** 시즌 코드 → 재료 */
  seasons: Record<number, BadgeSeasonInfo>;
  /** 선수가 있는 최신 시즌 코드 (신인 판정) */
  latestSeasonCode: number | null;
  /** 최신 시즌 시작 연도, 예: "2025-2026" → 2025 */
  latestStartYear: number | null;
}

/**
 * 한 시즌의 배지 재료. 부문 1위는 순위표와 같은 규칙: 기본 표본 기준(DEFAULT_QUALIFY) 충족 선수 중
 * 경기당 값 순위(lib/leaders rankMap — 동점 같은 순위)가 1인 선수 전부.
 */
export function buildBadgeSeasonInfo(players: readonly LeaderPlayer[]): BadgeSeasonInfo {
  const pool = filterLeaders(players, { origin: "all", teamCode: null, rule: DEFAULT_QUALIFY });
  const kings = {} as Record<KingStat, string[]>;
  for (const k of KING_STATS) {
    const ranks = rankMap(pool, k, "perGame");
    kings[k] = [...ranks].filter(([, r]) => r === 1).map(([id]) => id).sort();
  }
  return { maxGames: players.reduce((m, p) => Math.max(m, p.games), 0), kings };
}

/** 시즌 라벨의 시작 연도, 예: "2025-2026" → 2025, "1997" → 1997. 못 읽으면 null */
export function seasonStartYear(label: string): number | null {
  const m = /^(\d{4})/.exec(label.trim());
  return m ? Number(m[1]) : null;
}

/** 전 시즌 배지 재료. seasons = 선수가 1명 이상 있는 시즌 (순서 무관) */
export function buildBadgeIndex(seasons: readonly { seasonCode: number; seasonLabel: string; players: readonly LeaderPlayer[] }[]): BadgeIndex {
  const out: BadgeIndex = { seasons: {}, latestSeasonCode: null, latestStartYear: null };
  for (const s of seasons) {
    if (s.players.length === 0) continue;
    out.seasons[s.seasonCode] = buildBadgeSeasonInfo(s.players);
    if (out.latestSeasonCode === null || s.seasonCode > out.latestSeasonCode) {
      out.latestSeasonCode = s.seasonCode;
      out.latestStartYear = seasonStartYear(s.seasonLabel);
    }
  }
  return out;
}

// ─────────────────────────────────────────────
// 계산
// ─────────────────────────────────────────────

export interface PlayerBadge {
  key: BadgeKey;
  /** 화면 표기, 예: "득점왕 ×2" */
  label: string;
  /** 횟수 배지(왕·트리플더블)의 횟수, 그 외 1 */
  count: number;
}

const DEF_BY_KEY = new Map(BADGE_DEFS.map((d) => [d.key, d]));
const ORDER = new Map(BADGE_DEFS.map((d, i) => [d.key, i]));

function badge(key: BadgeKey, count = 1): PlayerBadge {
  const base = DEF_BY_KEY.get(key)!.label;
  return { key, label: count >= 2 ? `${base} ×${count}` : base, count };
}

/**
 * 한 선수의 칭호 배지 (우선순위 = BADGE_DEFS 순서). 조건:
 * - 원클럽맨: 뛴 시즌 ≥ 5 이고 소속 팀 코드가 하나 (팀 코드 기준 — 이름만 바뀐 구단은 같은 팀)
 * - 롱런(키 legend): 뛴 시즌 ≥ 15 / 베테랑: 10 ≤ 뛴 시즌 < 15 (둘 중 하나만)
 * - 득점왕·리바운드왕·어시스트왕·스틸왕·블록왕: 그 시즌 기본 표본 기준 경기당 1위(공동 포함) 횟수 ≥ 1, 2회 이상 "×n"
 * - 철인: games === 그 시즌 최다 경기 수 인 시즌 ≥ 3
 * - 50득점 클럽: 정규시즌 커리어 하이 득점 ≥ 50 / 40득점 클럽: ≥ 40 (높은 쪽 하나만)
 * - 트리플더블: 통산 ≥ 1 ("×n")
 * - 더블더블 머신: 한 시즌 더블더블 ≥ 20 인 시즌이 있음
 * - 신인: 뛴 시즌이 최신 시즌 하나뿐이고 드래프트 연도 = 최신 시즌 시작 연도
 * "뛴 시즌"은 출전 1경기 이상인 시즌만 센다.
 */
export function playerBadges(career: BadgeCareer, index: BadgeIndex): PlayerBadge[] {
  const played = career.seasons.filter((s) => s.games > 0);
  const nSeasons = new Set(played.map((s) => s.seasonCode)).size;
  const teams = new Set(played.map((s) => s.teamCode)).size;
  const out: PlayerBadge[] = [];

  // 부문 1위
  for (const k of KING_STATS) {
    const n = played.filter((s) => index.seasons[s.seasonCode]?.kings[k].includes(career.playerNo)).length;
    if (n > 0) out.push(badge(KING_BADGE[k], n));
  }
  // 오래 뛴 선수
  if (nSeasons >= LEGEND_MIN_SEASONS) out.push(badge("legend"));
  else if (nSeasons >= VETERAN_MIN_SEASONS) out.push(badge("veteran"));
  // 커리어 하이 득점
  const hi = career.careerHighPoints;
  if (hi !== null && Number.isFinite(hi)) {
    if (hi >= CLUB_50) out.push(badge("club50"));
    else if (hi >= CLUB_40) out.push(badge("club40"));
  }
  // 트리플더블·더블더블
  const td = played.reduce((sum, s) => sum + (Number.isFinite(s.tripleDoubles) ? s.tripleDoubles : 0), 0);
  if (td >= 1) out.push(badge("tripleDouble", td));
  if (played.some((s) => s.doubleDoubles >= DD_MACHINE_MIN)) out.push(badge("ddMachine"));
  // 소속 팀
  if (nSeasons >= ONE_CLUB_MIN_SEASONS && teams === 1) out.push(badge("oneClub"));
  // 철인
  const iron = played.filter((s) => {
    const max = index.seasons[s.seasonCode]?.maxGames ?? 0;
    return max > 0 && s.games === max;
  }).length;
  if (iron >= IRON_MAN_MIN_SEASONS) out.push(badge("ironMan"));
  // 신인
  if (
    nSeasons === 1 &&
    index.latestSeasonCode !== null &&
    played[0]?.seasonCode === index.latestSeasonCode &&
    career.draftYear !== null &&
    career.draftYear === index.latestStartYear
  ) {
    out.push(badge("rookie"));
  }
  return out.sort((a, b) => ORDER.get(a.key)! - ORDER.get(b.key)!);
}

/** 히어로에 한 번에 보이는 배지 수 (나머지는 "+n" 으로 접는다) */
export const HERO_BADGE_LIMIT = 5;

/** 보이는 배지와 접힌 수, 예: 7개 → 앞 5개 + hidden 2 */
export function splitBadges<T>(list: readonly T[], limit = HERO_BADGE_LIMIT): { shown: T[]; hidden: number } {
  return { shown: list.slice(0, limit), hidden: Math.max(0, list.length - limit) };
}
