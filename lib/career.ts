// 선수 페이지(/player/[선수번호])의 표기·추이 규칙 — 순수 함수만 둔다 (CLAUDE.md 원칙 5).
// 통산 경기당 계산은 lib/metrics.ts careerSummary, 경기당 환산은 metrics.perGame 을 쓴다.

import { perGame } from "./metrics";
import { formatHighDate, formatHighShot, formatHighTimes, formatHighValue, HERO_HIGH_KEYS, highDef } from "./highs";
import { CLUB_40, CLUB_50 } from "./badges";
import type { CareerHighs, HighKey, HighRecord, HighsSet, SeasonHighLeader, SeasonHighLeaderKey } from "./types";

// ─────────────────────────────────────────────
// 시즌 표기
// ─────────────────────────────────────────────

/** 시즌 라벨(긴 "2025-2026"·짧은 "25-26"·한 해 "1997") → [시작 연도 두 자리, 끝 연도 두 자리(한 해 시즌은 null)] */
function seasonYears(label: string): [string, string | null] | null {
  const m = /^(\d{2}|\d{4})(?:-(\d{2}|\d{4}))?$/.exec(label.trim());
  return m ? [m[1].slice(-2), m[2] ? m[2].slice(-2) : null] : null;
}

/**
 * 시즌 짧은 표기 (2026-10-01 사용자: "2020-2021 이 아니라 20-21"): "2025-2026" → "25-26", "1997" → "97".
 * 시즌 라벨은 코드표(seasons.json)에서 온 값이라 형식만 바꾼다 (시즌 코드로 연도를 추측하지 않는다).
 */
export function seasonShortLabel(label: string): string {
  const y = seasonYears(label);
  if (!y) return label.trim();
  return y[1] ? `${y[0]}-${y[1]}` : y[0];
}

/** 그래프 가로축 표기 (지금은 seasonShortLabel 과 같다) */
export function seasonTickLabel(label: string): string {
  return seasonShortLabel(label);
}

/**
 * 연속 시즌 구간 표기 (2026-10-01 사용자: "연속으로 뛰었다면 20-23"): 첫 시즌의 시작 연도 - 마지막 시즌의 끝 연도.
 * "2020-2021"~"2022-2023" → "20-23", 같은 시즌이면 "25-26", "1997"~"1999-2000" → "97-00". 긴·짧은 라벨 모두 받는다.
 */
export function seasonRangeLabel(firstLabel: string, lastLabel: string): string {
  const a = seasonYears(firstLabel);
  const b = seasonYears(lastLabel);
  if (!a || !b) return firstLabel === lastLabel ? firstLabel : `${firstLabel}~${lastLabel}`;
  if (seasonShortLabel(firstLabel) === seasonShortLabel(lastLabel)) return seasonShortLabel(firstLabel);
  return `${a[0]}-${b[1] ?? b[0]}`;
}

/** 활동 기간: "19-26 · 7시즌" (한 시즌이면 "25-26 · 1시즌") */
export function activeSpanLabel(firstLabel: string, lastLabel: string, seasonCount: number): string {
  return `${seasonRangeLabel(firstLabel, lastLabel)} · ${seasonCount}시즌`;
}

// ─────────────────────────────────────────────
// 소속 팀 이력
// ─────────────────────────────────────────────

export interface TeamStint {
  teamCode: string;
  /** 첫·마지막 시즌 라벨 (원래 표기) */
  fromLabel: string;
  toLabel: string;
  seasons: number;
}

/**
 * 시즌 오름차순 목록 → 연속으로 같은 팀이었던 구간. 팀이 바뀌었다가 돌아오면 별도 구간.
 * 예: SK, SK, 삼성, SK → [SK 2시즌, 삼성 1시즌, SK 1시즌]
 */
export function teamStints(seasons: readonly { teamCode: string; seasonLabel: string }[]): TeamStint[] {
  const out: TeamStint[] = [];
  for (const s of seasons) {
    const last = out[out.length - 1];
    if (last && last.teamCode === s.teamCode) {
      last.toLabel = s.seasonLabel;
      last.seasons++;
    } else {
      out.push({ teamCode: s.teamCode, fromLabel: s.seasonLabel, toLabel: s.seasonLabel, seasons: 1 });
    }
  }
  return out;
}

/** 이전 시즌과 팀이 다른 시즌인가 (첫 시즌은 false). 추이 그래프에서 "이적" 표시에 쓴다 */
export function teamChangedAt(seasons: readonly { teamCode: string }[], i: number): boolean {
  return i > 0 && seasons[i].teamCode !== seasons[i - 1].teamCode;
}

// ─────────────────────────────────────────────
// 시즌별 추이 그래프 지표
// ─────────────────────────────────────────────

export type TrendKey = "points" | "reb" | "ast" | "stl" | "blk" | "fgPct" | "tpPct" | "per";

export interface TrendMetric {
  key: TrendKey;
  /** 전환 버튼 표기 */
  label: string;
  /** 그래프 제목·툴팁 표기 */
  title: string;
  /** perGame: 시즌 누적 ÷ 경기 / pct: KBL 계산 비율(%) 그대로 / index: KBL 계산 지수(PER) 그대로 */
  kind: "perGame" | "pct" | "index";
}

/**
 * 전환 버튼 순서 = 배열 순서. 첫 번째가 기본값.
 * 2026-09-30 사용자 피드백: 스틸·블록 추가, TS% 대신 3점% (팬이 바로 읽는 기록 위주).
 */
export const TREND_METRICS: readonly TrendMetric[] = [
  { key: "points", label: "득점", title: "경기당 득점", kind: "perGame" },
  { key: "reb", label: "리바운드", title: "경기당 리바운드", kind: "perGame" },
  { key: "ast", label: "어시스트", title: "경기당 어시스트", kind: "perGame" },
  { key: "stl", label: "스틸", title: "경기당 스틸", kind: "perGame" },
  { key: "blk", label: "블록", title: "경기당 블록", kind: "perGame" },
  { key: "fgPct", label: "야투%", title: "야투 성공률", kind: "pct" },
  { key: "tpPct", label: "3점%", title: "3점 성공률", kind: "pct" },
  { key: "per", label: "PER", title: "PER (생산성 지수)", kind: "index" },
];

export interface TrendInput {
  games: number;
  points: number; reb: number; ast: number; stl: number; blk: number; // 시즌 누적
  fgPct: number; tpPct: number; per: number; // KBL 계산값
}

/** 그 시즌의 지표 값: 누적은 경기당(perGame), 비율·지수는 그대로 */
export function trendValue(s: TrendInput, key: TrendKey): number {
  const m = TREND_METRICS.find((t) => t.key === key)!;
  return m.kind === "perGame" ? perGame(s[key], s.games) : s[key];
}

const NF1 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 추이 값 표기: 소수 한 자리, 비율은 "%" */
export function formatTrend(value: number, key: TrendKey): string {
  if (!Number.isFinite(value)) return "–";
  const m = TREND_METRICS.find((t) => t.key === key)!;
  return `${NF1.format(value)}${m.kind === "pct" ? "%" : ""}`;
}

export interface TrendRow {
  seasonCode: number;
  seasonLabel: string;
  /** 그 시즌 값. 그 시즌에 뛰지 않았으면 null (선이 끊긴다) */
  value: number | null;
  /** 그 시즌 팀 코드 (뛰지 않은 시즌은 null) */
  teamCode: string | null;
  games: number;
  /** 직전에 뛴 시즌과 팀이 다르면 true */
  teamChanged: boolean;
}

/**
 * 추이 그래프 행: 첫 시즌부터 마지막 시즌까지 코드표 시즌을 빠짐없이 깔고(군 복무 등 빈 시즌은 value=null),
 * 뛴 시즌에는 지표 값을 넣는다. allSeasons 는 코드표 시즌 목록(순서 무관), career 는 선수 시즌 기록(순서 무관).
 */
export function trendRows<T extends TrendInput & { seasonCode: number; seasonLabel: string; teamCode: string }>(
  career: readonly T[],
  allSeasons: readonly { seasonCode: number; seasonLabel: string }[],
  key: TrendKey,
): TrendRow[] {
  if (career.length === 0) return [];
  const played = new Map(career.map((s) => [s.seasonCode, s]));
  const codes = career.map((s) => s.seasonCode);
  const first = Math.min(...codes);
  const last = Math.max(...codes);
  const labels = new Map(allSeasons.map((s) => [s.seasonCode, s.seasonLabel]));
  for (const s of career) labels.set(s.seasonCode, s.seasonLabel);
  const span = [...labels.keys()].filter((c) => c >= first && c <= last).sort((a, b) => a - b);
  let prevTeam: string | null = null;
  return span.map((code) => {
    const s = played.get(code);
    const teamChanged = !!s && prevTeam !== null && s.teamCode !== prevTeam;
    if (s) prevTeam = s.teamCode;
    return {
      seasonCode: code,
      seasonLabel: labels.get(code)!,
      value: s ? trendValue(s, key) : null,
      teamCode: s ? s.teamCode : null,
      games: s ? s.games : 0,
      teamChanged,
    };
  });
}

// ─────────────────────────────────────────────
// 선수 프로필 (히어로의 포지션·키·몸무게·등번호·드래프트) — 값은 선수 마스터(lib/types PlayerProfile)
// ─────────────────────────────────────────────

export interface ProfileFact {
  label: string;
  value: string;
}

/**
 * 프로필 한 줄씩: 포지션 · 키 · 몸무게 · 등번호 · 드래프트. 값이 없는 항목은 뺀다.
 * 드래프트 표기: "2015 1라운드 3순위" (라운드·순위가 없으면 있는 것만). 등번호는 "0"과 "00"을 구분하려고 문자열 그대로.
 */
export function profileFacts(p: {
  positionLabel: string | null;
  heightCm: number | null;
  weightKg: number | null;
  backNumber: string | null;
  draft: { year: number; round: number | null; pick: number | null } | null;
}): ProfileFact[] {
  const out: ProfileFact[] = [];
  if (p.positionLabel) out.push({ label: "포지션", value: p.positionLabel });
  if (p.heightCm) out.push({ label: "키", value: `${p.heightCm}cm` });
  if (p.weightKg) out.push({ label: "몸무게", value: `${p.weightKg}kg` });
  if (p.backNumber) out.push({ label: "등번호", value: `#${p.backNumber}` });
  if (p.draft) {
    const parts = [`${p.draft.year}`];
    if (p.draft.round) parts.push(`${p.draft.round}라운드`);
    if (p.draft.pick) parts.push(`${p.draft.pick}순위`);
    out.push({ label: "드래프트", value: parts.join(" ") });
  }
  return out;
}

// ─────────────────────────────────────────────
// 나이·국가·출신교 (히어로) — 값은 서버 B 프로필(색인 birthday·country·school)
// ─────────────────────────────────────────────

/** 한국 시간 기준 오늘 날짜 "YYYY-MM-DD". 정적 사이트라 "오늘" = 빌드 시각 (매일 데이터 커밋 → 재배포로 갱신) */
export function seoulDateIso(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * 만 나이: 생년월일 "1994-01-31" 과 오늘 "2026-09-30" → 32. 올해 생일 전이면 한 살 적게.
 * 형식이 다르거나 오늘보다 늦은 생일이면 null.
 */
export function ageOn(birthday: string | null | undefined, today: string): number | null {
  const b = birthday ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday) : null;
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!b || !t) return null;
  let age = Number(t[1]) - Number(b[1]);
  if (`${t[2]}${t[3]}` < `${b[2]}${b[3]}`) age--;
  return age >= 0 ? age : null;
}

/**
 * 히어로 프로필 한 줄 추가분: 나이("만 32세") · 국적(국가명) · 출신교. 값이 없는 항목은 뺀다.
 * 은퇴 선수도 "지금 나이"를 보여 준다 (생년월일 대신 나이만 — 한 줄이 짧게).
 */
export function personalFacts(
  p: { birthday?: string | null; country?: string | null; school?: string | null },
  today: string,
): ProfileFact[] {
  const out: ProfileFact[] = [];
  const age = ageOn(p.birthday, today);
  // 나이 옆 태어난 해 (2026-10-01 사용자 요청): "만 32세 (1994년생)"
  if (age !== null) out.push({ label: "나이", value: `만 ${age}세 (${p.birthday!.slice(0, 4)}년생)` });
  if (p.country) out.push({ label: "국적", value: p.country });
  if (p.school) out.push({ label: "출신교", value: p.school });
  return out;
}

// ─────────────────────────────────────────────
// 커리어 하이 표 (선수 페이지 "커리어 하이" 섹션) — 통산 한 경기 최다, 정규시즌/플레이오프/챔프전 탭
// ─────────────────────────────────────────────

export type HighsTab = "regular" | "playoff" | "finals";

export const HIGHS_TABS: readonly { key: HighsTab; label: string }[] = [
  { key: "regular", label: "정규시즌" },
  { key: "playoff", label: "플레이오프" },
  { key: "finals", label: "챔프전" },
];

export interface CareerHighRow {
  key: HighKey;
  label: string;          // 부문, 예: "득점"
  value: string;          // "46" / "66.7%"
  opponent: string;       // 상대 팀 한글 약칭 (모르면 코드, 코드도 없으면 "–")
  date: string;           // "2023.10.21"
  times: string;          // "3회" / "–"
  rate: boolean;          // 성공률 부문 (시도 수 조건 없음 — 화면에서 흐리게·안내). HERO_HIGH_KEYS 에는 없어 지금은 늘 false
  shot: string | null;    // 슛 부문의 그 경기 성공/시도·성공률 "5/8 · 62.5%" (lib/highs formatHighShot, 없으면 null)
}

/**
 * 한 구분의 통산 세트 → 표 행 (부문·순서 = lib/highs HERO_HIGH_KEYS 7개, 기록 없는 부문·값 0 은 뺀다).
 * teamName(코드, 달성 시즌) → 한글 약칭. 그 시즌 팀 목록에 없으면 null → 코드를 그대로 쓴다.
 */
export function careerHighRows(
  set: HighsSet | null | undefined,
  teamName: (teamCode: string, seasonCode: number | null) => string | null,
): CareerHighRow[] {
  if (!set) return [];
  const out: CareerHighRow[] = [];
  for (const key of HERO_HIGH_KEYS) {
    const d = highDef(key);
    const r = set[key];
    if (!r || !(r.value > 0)) continue;
    out.push({
      key: d.key,
      label: d.label,
      value: formatHighValue(r.value, d.key),
      opponent: r.opponentTeamCode ? (teamName(r.opponentTeamCode, r.seasonCode) ?? r.opponentTeamCode) : "–",
      date: formatHighDate(r.date),
      times: formatHighTimes(r.times),
      rate: d.kind === "rate",
      shot: formatHighShot(r, key),
    });
  }
  return out;
}

/** 세 탭의 행을 한 번에. 행이 없는 탭은 빠진다 → 결과가 빈 배열이면 섹션을 숨긴다 */
export function careerHighTabs(
  highs: CareerHighs | null | undefined,
  teamName: (teamCode: string, seasonCode: number | null) => string | null,
): { key: HighsTab; label: string; rows: CareerHighRow[] }[] {
  if (!highs) return [];
  return HIGHS_TABS.map((t) => ({ ...t, rows: careerHighRows(highs[t.key], teamName) })).filter((t) => t.rows.length > 0);
}

// ─────────────────────────────────────────────
// 커리어 하이 "업적 카드" (2026-09-30 피드백 5차 #3) — 표 대신 부문 7개를 카드로
// ─────────────────────────────────────────────

/** 업적 카드 한 장. 정규시즌이 주인공, 플레이오프·챔프전은 보조 숫자 한 줄 */
export interface HighAchievement {
  key: SeasonHighLeaderKey;
  /** 부문 이름, 예: "득점" */
  label: string;
  /** 정규시즌 커리어 하이 값 (없으면 null — PO·챔프전만 있는 부문) */
  value: string | null;
  /** 슛 부문의 그 경기 성공/시도·성공률 "5/8 · 62.5%" */
  shot: string | null;
  /** 상대 팀 한글 약칭 (모르면 코드, 없으면 null) */
  opponent: string | null;
  /** "2023.10.21" (없으면 "–") */
  date: string;
  /** 달성 횟수 (1회 이상일 때 숫자, 모르면 null) */
  times: number | null;
  /** 그 기록이 그 시즌 리그 한 경기 최다(1위와 같은 값)이면 그 시즌 짧은 표기 "2023-24", 아니면 null */
  seasonBest: string | null;
  /** 배지 조건과 겹치는 기록 (득점 40·50 이상 → lib/badges 40득점·50득점 클럽) */
  milestone: "club50" | "club40" | null;
  /** 보조 숫자: 플레이오프·챔프전 통산 한 경기 최다 (없으면 null) */
  playoff: string | null;
  finals: string | null;
}

/**
 * 그 기록이 그 시즌 리그 1위 기록과 같거나 높은가 (seasonHighLeaders 는 동률이면 먼저 달성한 선수 한 명 —
 * 같은 값을 낸 다른 선수도 "그 시즌 최다"를 기록한 것이라 값만 비교한다). 1위 정보가 없으면 false.
 */
export function isSeasonBest(record: HighRecord | null | undefined, leader: SeasonHighLeader | null | undefined): boolean {
  if (!record || !leader) return false;
  return record.value > 0 && record.value >= leader.value;
}

/**
 * 통산 세트 → 업적 카드 (부문·순서 = HERO_HIGH_KEYS 7개). 세 구분 모두 기록이 없는 부문은 뺀다.
 * teamName: (팀 코드, 달성 시즌) → 한글 약칭. leaderOf: (달성 시즌, 부문) → 그 시즌 리그 1위 (없으면 null).
 * seasonLabel: 시즌 코드 → "2023-2024" 꼴 (짧은 표기는 seasonShortLabel).
 */
export function careerHighAchievements(
  highs: CareerHighs | null | undefined,
  teamName: (teamCode: string, seasonCode: number | null) => string | null,
  leaderOf: (seasonCode: number, key: SeasonHighLeaderKey) => SeasonHighLeader | null,
  seasonLabel: (seasonCode: number) => string | null,
): HighAchievement[] {
  if (!highs) return [];
  const out: HighAchievement[] = [];
  const valueOf = (set: HighsSet | null, key: SeasonHighLeaderKey) => {
    const r = set?.[key];
    return r && r.value > 0 ? r : null;
  };
  for (const key of HERO_HIGH_KEYS) {
    const reg = valueOf(highs.regular, key);
    const po = valueOf(highs.playoff, key);
    const fi = valueOf(highs.finals, key);
    if (!reg && !po && !fi) continue;
    const best =
      reg && reg.seasonCode !== null && isSeasonBest(reg, leaderOf(reg.seasonCode, key)) ? seasonLabel(reg.seasonCode) : null;
    out.push({
      key,
      label: highDef(key).label,
      value: reg ? formatHighValue(reg.value, key) : null,
      shot: reg ? formatHighShot(reg, key) : null,
      opponent: reg?.opponentTeamCode ? (teamName(reg.opponentTeamCode, reg.seasonCode) ?? reg.opponentTeamCode) : null,
      date: formatHighDate(reg?.date ?? null),
      times: reg?.times && reg.times > 0 ? reg.times : null,
      seasonBest: best ? seasonShortLabel(best) : null,
      milestone: key === "pts" && reg ? (reg.value >= CLUB_50 ? "club50" : reg.value >= CLUB_40 ? "club40" : null) : null,
      playoff: po ? formatHighValue(po.value, key) : null,
      finals: fi ? formatHighValue(fi.value, key) : null,
    });
  }
  return out;
}

// ─────────────────────────────────────────────
// 우승 횟수 (2026-10-02 사용자 요청) — 선수 히어로 칩 "우승 6회" + 시즌 목록 "06-07 모비스 · 09-10 모비스"
// 재료: 색인 championships(정규시즌 소속 팀이 그 시즌 챔프전 우승팀인 시즌, scripts/champions.ts)
// ─────────────────────────────────────────────

export interface ChampionshipSummary {
  count: number;
  /** 오래된 시즌부터 "06-07 모비스" */
  items: string[];
}

export function championshipSummary(
  codes: readonly number[] | undefined,
  seasons: readonly { seasonCode: number; seasonLabel: string; teamShort?: string; team?: { shortName: string } | null }[],
): ChampionshipSummary | null {
  if (!codes || codes.length === 0) return null;
  const byCode = new Map(seasons.map((s) => [s.seasonCode, s]));
  const items = [...codes]
    .sort((a, b) => a - b)
    .map((c) => {
      const s = byCode.get(c);
      if (!s) return null;
      const team = s.team?.shortName ?? s.teamShort ?? "";
      return `${seasonShortLabel(s.seasonLabel)}${team ? ` ${team}` : ""}`;
    })
    .filter((x): x is string => x !== null);
  return items.length > 0 ? { count: items.length, items } : null;
}
