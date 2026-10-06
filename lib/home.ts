// 홈(/) "이번 시즌 한눈에" 규칙 — 순수 함수만 둔다. 부문 순위는 lib/leaders.ts topLeaders 를 그대로 쓴다.
import type { LeaderStatKey } from "./leaders";
import { perGame } from "./metrics";
import type { LeaderPlayer, SeasonOption } from "./types";

/** 홈 부문별 1~3위 카드 (경기당, 기본 표본 기준). 순서 = 화면 순서 */
export const HOME_CATEGORIES: readonly LeaderStatKey[] = ["points", "reb", "ast", "stl", "blk", "tpm"];

/** 부문 값 단위 (히어로 "경기당 23.2점"·카드 값 옆) */
export const HOME_UNITS: Partial<Record<LeaderStatKey, string>> = {
  points: "점",
  reb: "개",
  ast: "개",
  stl: "개",
  blk: "개",
  tpm: "개",
};

export interface HomeSeasonPick {
  /** 홈에 보여줄 시즌 (선수가 있는 가장 최근 시즌). 선수 있는 시즌이 하나도 없으면 null */
  shown: SeasonOption | null;
  /** 코드표의 최신 시즌이 아직 선수 0명(개막 전)이면 그 시즌, 아니면 null */
  upcoming: SeasonOption | null;
}

/**
 * 홈 시즌 고르기. 시즌 코드를 박지 않고 코드표(seasons.json)의 최신 시즌과 "선수 있는 시즌" 목록을 비교한다.
 *  - all: 코드표 전체 시즌 (순서 무관), withPlayers: 선수 1명 이상 시즌 (순서 무관)
 *  - 코드표 최신 시즌이 선수 있는 시즌이면 → 그 시즌, 안내 없음
 *  - 아니면(개막 전) → 선수 있는 가장 최근 시즌 + upcoming = 코드표 최신 시즌
 */
export function pickHomeSeason(all: readonly SeasonOption[], withPlayers: readonly SeasonOption[]): HomeSeasonPick {
  const latestOf = (list: readonly SeasonOption[]) =>
    list.reduce<SeasonOption | null>((best, s) => (!best || s.seasonCode > best.seasonCode ? s : best), null);
  const shown = latestOf(withPlayers);
  const latest = latestOf(all);
  const upcoming = latest && (!shown || latest.seasonCode > shown.seasonCode) ? latest : null;
  return { shown, upcoming };
}

// ─────────────────────────────────────────────
// 오늘 생일인 현역 선수 (2026-10-01 사용자 요청) — 홈 "오늘 생일" 줄
// ─────────────────────────────────────────────
// 현역 = 홈 시즌(선수 있는 가장 최근 시즌) 명단. 생년월일은 프로필 API(data/processed/players-index.json birthday "YYYY-MM-DD").
// "오늘"은 브라우저에서 한국 시간으로 정한다 — 사이트는 하루 한 번 빌드되는 정적 HTML 이라 빌드 시각으로 정하면 하루가 어긋날 수 있다.

export interface BirthdayCandidate {
  id: string;
  nameKo: string;
  birthday: string | null;
}

/** 한국 시간 기준 날짜 "YYYY-MM-DD" */
export function kstDateString(now: Date): string {
  // en-CA 는 YYYY-MM-DD 모양
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * today("YYYY-MM-DD")가 생일인 선수 + 그날 맞는 만 나이. 2월 29일생은 윤년이 아니면 2월 28일에 넣는다.
 * 순서: 나이 많은 순 → 이름순 (같은 날 여럿이면 고참 먼저).
 */
export function birthdaysOn<T extends BirthdayCandidate>(players: readonly T[], today: string): { player: T; age: number }[] {
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!t) return [];
  const year = Number(t[1]);
  const md = `${t[2]}-${t[3]}`;
  const seen = new Set<string>();
  const out: { player: T; age: number }[] = [];
  for (const p of players) {
    const b = p.birthday ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.birthday) : null;
    if (!b || seen.has(p.id)) continue;
    let bmd = `${b[2]}-${b[3]}`;
    if (bmd === "02-29" && !isLeapYear(year)) bmd = "02-28";
    const age = year - Number(b[1]);
    if (bmd !== md || age <= 0) continue;
    seen.add(p.id);
    out.push({ player: p, age });
  }
  return out.sort((a, b) => b.age - a.age || a.player.nameKo.localeCompare(b.player.nameKo, "ko"));
}

/**
 * 홈 표지 부문 돌리기 (2026-10-01 사용자: "새로고침할 때마다 부문별로 롤링").
 * 지난번에 보여 준 부문 키(last, 이 브라우저 localStorage)의 다음 부문을 고른다. 지난 기록이 없거나 목록에 없으면 random(0~1)으로 하나.
 * 순서는 HOME_CATEGORIES(득점 → 리바운드 → 어시스트 → 스틸 → 블록 → 3점 성공).
 */
export function nextHeroIndex(keys: readonly string[], last: string | null, random: number): number {
  if (keys.length === 0) return -1;
  const i = last === null ? -1 : keys.indexOf(last);
  if (i < 0) return Math.min(keys.length - 1, Math.floor(random * keys.length));
  return (i + 1) % keys.length;
}

/** 표지 부문 기억 키 (localStorage) */
export const HOME_HERO_STORAGE_KEY = "kbl-stats:home-hero:v1";

/** 홈 표지 PC 가운데 칸: 그 선수의 이번 시즌 경기당 기록 6개 (HOME_CATEGORIES 순서, 2026-10-06 사용자: PC 표지 가운데가 비어 있다) */
export interface HeroStat {
  key: LeaderStatKey;
  value: number;
}
export function heroStatLine(p: Pick<LeaderPlayer, "games" | "points" | "reb" | "ast" | "stl" | "blk" | "tpm">): HeroStat[] {
  return HOME_CATEGORIES.map((key) => ({ key, value: perGame(p[key as "points" | "reb" | "ast" | "stl" | "blk" | "tpm"], p.games) }));
}
