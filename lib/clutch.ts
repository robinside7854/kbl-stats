// 클러치·위닝샷·버저비터 판정 (2026-10-28 사용자 기준) — 순수 함수 (process·화면·테스트 공용, 문자중계 해석은 scripts/textcast.ts).
//
// 클러치 상황: 4쿼터·연장, 남은 시간 2분 미만(1:59 부터), 득점(시도) 직전 두 팀 점수 차 6점 이내(2 포제션).
//   그때 던진 야투·자유투와 넣은 점수를 선수별로 센다 (클러치 득점·클러치 야투).
// 위닝샷: 이긴 팀이 동점·지는 상황에서 앞서 나간 득점이고, 그 득점을 끝으로 경기가 끝난 것(2026-10-29 사용자 기준 —
//   뒤에 어느 팀이든 득점이 나오면 위닝샷이 아니다. 같은 선수가 같은 시각에 이어 넣은 자유투(앤드원·두 번째 자유투)만 예외)
//   + 클러치 시간(4쿼터·연장 남은 2분 미만)에 나온 것. 직전 점수는 동점이거나 지고 있었으므로 클러치 상황에 늘 들어간다.
//   자유투로 앞서 나갔으면 "결승 자유투"로 표시한다(종류 ft).
// 버저비터: 위닝샷 중 야투이고, 남은 시간 0초에 넣었고, 그 뒤 상대 팀이 슛·작전시간·턴오버를 하지 못했고 리바운드도 없이 끝난 것.
//   문자중계는 초 단위까지만 적혀 0.3초 같은 시각도 "0초"로 온다 → 0.x 초를 남기고 넣은 슛 가운데
//   상대가 마지막 공격을 한 경우는 걸러지지만, 상대가 아무것도 못 하고 끝났으면 버저비터와 구분할 수 없다.
import type { ClutchLine, ClutchShotKind, SeasonGame, TextCastAction, TextCastEvent, WinningShot } from "./types";

/** 클러치 시간: 남은 시간이 이 초보다 적을 때 (2분 미만) */
export const CLUTCH_REMAINING_UNDER = 120;
/** 클러치 점수 차: 이 점수 이내 (6점 = 2 포제션) */
export const CLUTCH_MARGIN_MAX = 6;

const MADE: Partial<Record<TextCastAction, { kind: ClutchShotKind; pts: number }>> = {
  made2: { kind: "2", pts: 2 },
  madeDunk: { kind: "dunk", pts: 2 },
  made3: { kind: "3", pts: 3 },
  madeFt: { kind: "ft", pts: 1 },
};
const MISS: Partial<Record<TextCastAction, ClutchShotKind>> = { miss2: "2", missDunk: "dunk", miss3: "3", missFt: "ft" };

/** 4쿼터·연장인가 */
export function isClutchPeriod(period: string): boolean {
  return period === "Q4" || /^X\d+$/.test(period);
}

/** 클러치 상황인가 (점수 차는 그 득점·시도 직전) */
export function isClutchMoment(period: string, remaining: number, margin: number): boolean {
  return isClutchPeriod(period) && remaining < CLUTCH_REMAINING_UNDER && Math.abs(margin) <= CLUTCH_MARGIN_MAX;
}

/** "Q4" → "4쿼터", "X1" → "연장", "X2" → "2차 연장" */
export function periodLabel(period: string): string {
  if (period === "Q4") return "4쿼터";
  const m = /^X(\d+)$/.exec(period);
  if (m) return m[1] === "1" ? "연장" : `${m[1]}차 연장`;
  const q = /^Q(\d)$/.exec(period);
  return q ? `${q[1]}쿼터` : period;
}

/** 남은 시간 표기 "0:03" */
export function remainingLabel(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/** 득점 종류 표기 */
export function shotKindLabel(kind: ClutchShotKind): string {
  return kind === "3" ? "3점슛" : kind === "dunk" ? "덩크" : kind === "ft" ? "자유투" : "2점슛";
}

/** 위닝샷 칭호: 버저비터 / 결승 자유투 / 위닝샷 */
export function winningLabel(w: Pick<WinningShot, "buzzer" | "kind">): string {
  return w.buzzer ? "버저비터" : w.kind === "ft" ? "결승 자유투" : "위닝샷";
}

/** 위닝샷 순간: "4쿼터 0:03 2점슛" */
export function winningMoment(w: Pick<WinningShot, "period" | "remaining" | "kind">): string {
  return `${periodLabel(w.period)} ${remainingLabel(w.remaining)} ${shotKindLabel(w.kind)}`;
}

/** 위닝샷 점수 변화: "107-107 → 109-107" — 넣은 팀 먼저 */
export function winningScore(w: Pick<WinningShot, "teamCode" | "before" | "after">, homeCode: string): string {
  const mineFirst = (s: [number, number]) => (w.teamCode === homeCode ? `${s[0]}-${s[1]}` : `${s[1]}-${s[0]}`);
  return `${mineFirst(w.before)} → ${mineFirst(w.after)}`;
}

/** 위닝샷 한 줄: "4쿼터 0:03 2점슛 107-107 → 109-107" — 점수는 넣은 팀 먼저 */
export function winningLine(w: WinningShot, homeCode: string): string {
  return `${winningMoment(w)} ${winningScore(w, homeCode)}`;
}

/** 버저비터 판정: 남은 0초 야투이고, 뒤에 상대 슛·작전시간·턴오버·스틸이나 누구든 리바운드가 없다 (교체·어시스트·파울·자유투(앤드원)·종료는 괜찮다) */
export function isBuzzerBeater(events: readonly TextCastEvent[], index: number): boolean {
  const e = events[index];
  if (!e || e.remaining !== 0 || e.action === "madeFt") return false;
  for (const x of events.slice(index + 1)) {
    if (x.period !== e.period) return false;
    if (x.action === "rebound") return false;
    if (x.teamCode !== e.teamCode && x.teamCode !== "") {
      if (MADE[x.action] || MISS[x.action] || x.action === "timeout" || x.action === "turnover" || x.action === "steal") return false;
    }
  }
  return true;
}

export interface ClutchAnalysis {
  winning: WinningShot | null;
  lines: ClutchLine[];
}

const normName = (s: string) => s.replace(/\s+/g, "");

/** 위닝샷 뒤에 와도 되는 득점: 같은 선수가 같은 시각(같은 쿼터·같은 남은 초)에 넣은 자유투 — 앤드원·자유투 두 개 중 두 번째 */
function isSamePlayFt(shot: TextCastEvent, e: TextCastEvent): boolean {
  return e.action === "madeFt" && e.teamCode === shot.teamCode && normName(e.nameKo) === normName(shot.nameKo) && e.period === shot.period && e.remaining === shot.remaining;
}

/**
 * 4쿼터·연장 문자중계 + 최종 점수 → 위닝샷·선수별 클러치 기록.
 * 4쿼터 시작 점수 = 최종 점수 − 받은 쿼터 득점. 음수가 되거나(빠진 기록) 비기거나 이벤트가 없으면 null.
 * idOf: (이름, 팀 코드) → 선수 번호 (못 찾으면 null).
 */
export function analyzeClutch(
  events: readonly TextCastEvent[],
  home: { teamCode: string; score: number },
  away: { teamCode: string; score: number },
  idOf: (nameKo: string, teamCode: string) => string | null,
): ClutchAnalysis | null {
  if (events.length === 0 || home.score === away.score) return null;
  const sideOf = (code: string): number => (code === home.teamCode ? 0 : code === away.teamCode ? 1 : -1);
  const got = [0, 0];
  for (const e of events) {
    const m = MADE[e.action];
    const s = sideOf(e.teamCode);
    if (m && s >= 0) got[s] += m.pts;
  }
  const score: [number, number] = [home.score - got[0], away.score - got[1]];
  if (score[0] < 0 || score[1] < 0) return null;

  const win = home.score > away.score ? 0 : 1;
  const lead = () => (win === 0 ? score[0] - score[1] : score[1] - score[0]);
  const lines = new Map<string, ClutchLine>();
  let cand: { index: number; before: [number, number] } | null = null;

  events.forEach((e, index) => {
    const s = sideOf(e.teamCode);
    const made = MADE[e.action];
    const miss = MISS[e.action];
    if (s < 0 || (!made && !miss)) return;
    const before: [number, number] = [score[0], score[1]];
    if (isClutchMoment(e.period, e.remaining, before[0] - before[1]) && e.nameKo) {
      const key = `${e.teamCode}|${normName(e.nameKo)}`;
      let l = lines.get(key);
      if (!l) {
        l = { id: idOf(e.nameKo, e.teamCode), nameKo: e.nameKo, teamCode: e.teamCode, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 };
        lines.set(key, l);
      }
      const kind = made?.kind ?? miss!;
      if (kind === "ft") {
        l.fta++;
        if (made) l.ftm++;
      } else {
        l.fga++;
        if (made) l.fgm++;
        if (kind === "3") {
          l.tpa++;
          if (made) l.tpm++;
        }
      }
      if (made) l.pts += made.pts;
    }
    if (!made) return;
    const leadBefore = lead();
    score[s as 0 | 1] += made.pts;
    if (s === win && leadBefore <= 0 && lead() > 0) cand = { index, before };
    else if (cand && !isSamePlayFt(events[(cand as { index: number }).index], e)) cand = null;
  });

  let winning: WinningShot | null = null;
  const c = cand as { index: number; before: [number, number] } | null;
  if (c) {
    const e = events[c.index];
    if (isClutchPeriod(e.period) && e.remaining < CLUTCH_REMAINING_UNDER) {
      const m = MADE[e.action]!;
      const after: [number, number] = sideOf(e.teamCode) === 0 ? [c.before[0] + m.pts, c.before[1]] : [c.before[0], c.before[1] + m.pts];
      winning = {
        id: idOf(e.nameKo, e.teamCode),
        nameKo: e.nameKo,
        teamCode: e.teamCode,
        period: e.period,
        remaining: e.remaining,
        kind: m.kind,
        before: c.before,
        after,
        buzzer: isBuzzerBeater(events, c.index),
      };
    }
  }
  const out = [...lines.values()].sort((a, b) => b.pts - a.pts || b.fgm + b.ftm - (a.fgm + a.ftm) || a.nameKo.localeCompare(b.nameKo, "ko"));
  return { winning, lines: out };
}

/** 선수 클러치 합계 */
export interface ClutchTotals {
  pts: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  /** 클러치 상황에 슛·자유투를 던진 경기 수 */
  games: number;
  winning: number;
  buzzer: number;
}

export const emptyClutchTotals = (): ClutchTotals => ({ pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, games: 0, winning: 0, buzzer: 0 });

/** 합계에 한 경기 줄 더하기 */
export function addClutchLine(t: ClutchTotals, l: ClutchLine): void {
  t.pts += l.pts;
  t.fgm += l.fgm;
  t.fga += l.fga;
  t.tpm += l.tpm;
  t.tpa += l.tpa;
  t.ftm += l.ftm;
  t.fta += l.fta;
  t.games++;
}

/** 클러치 야투율 (시도 0 이면 null) */
export const clutchFgPct = (t: Pick<ClutchTotals, "fgm" | "fga">): number | null => (t.fga > 0 ? (t.fgm / t.fga) * 100 : null);

// ─────────────────────────────────────────────
// 선수별 모으기 (선수 페이지·기록 탭 — 빌드 때 lib/data 가 전 시즌 games.json·playoff-clutch.json 으로)
// ─────────────────────────────────────────────

/** 경기 구분: 정규시즌 / 플레이오프(6강~챔프전 전체) / 챔프전 — lib/records GameKind 와 같은 값 */
export type ClutchStage = "regular" | "playoff" | "finals";

/** 한 선수의 위닝샷 하나 (경기 정보 포함) */
export interface WinningEntry {
  seasonCode: number;
  /** 그 경기의 구분 (6강·4강 = playoff, 챔프전 = finals) */
  stage: ClutchStage;
  gmkey: string;
  date: string;
  shot: WinningShot;
  homeCode: string;
  /** 넣은 팀·상대 팀 */
  teamCode: string;
  oppCode: string;
  teamScore: number;
  oppScore: number;
}

export interface PlayerClutchRaw {
  /** 구분 → 시즌 코드 → 합계. playoff 는 챔프전까지 합친 값, finals 는 챔프전만 */
  stages: Record<ClutchStage, Map<number, ClutchTotals>>;
  /** 최근 먼저 (구분 섞임 — WinningEntry.stage) */
  shots: WinningEntry[];
}

type ClutchGame = Pick<SeasonGame, "gmkey" | "date" | "home" | "away" | "winning" | "clutch">;

/** 한 시즌 재료: 정규시즌 경기(games.json) + 플레이오프 경기(playoff-clutch.json, 2026-10-28) */
export interface ClutchSeasonInput {
  seasonCode: number;
  games: readonly ClutchGame[];
  playoffGames?: readonly (ClutchGame & { stage: "playoff" | "finals" })[];
}

/** 전 시즌 경기 → 선수 번호별 클러치 합계·위닝샷 (이름으로 못 찾은 줄은 뺀다) */
export function collectPlayerClutch(seasons: readonly ClutchSeasonInput[]): Map<string, PlayerClutchRaw> {
  const out = new Map<string, PlayerClutchRaw>();
  const of = (id: string) => {
    let p = out.get(id);
    if (!p) out.set(id, (p = { stages: { regular: new Map(), playoff: new Map(), finals: new Map() }, shots: [] }));
    return p;
  };
  const totalsOf = (p: PlayerClutchRaw, stage: ClutchStage, code: number) => {
    let t = p.stages[stage].get(code);
    if (!t) p.stages[stage].set(code, (t = emptyClutchTotals()));
    return t;
  };
  for (const s of seasons) {
    const all: { g: ClutchGame; stage: ClutchStage }[] = [
      ...s.games.map((g) => ({ g, stage: "regular" as const })),
      ...(s.playoffGames ?? []).map((g) => ({ g, stage: g.stage })),
    ];
    for (const { g, stage } of all) {
      // 챔프전은 플레이오프 합계에도 들어간다
      const buckets: ClutchStage[] = stage === "regular" ? ["regular"] : stage === "finals" ? ["playoff", "finals"] : ["playoff"];
      for (const l of g.clutch ?? []) if (l.id) for (const b of buckets) addClutchLine(totalsOf(of(l.id), b, s.seasonCode), l);
      const w = g.winning;
      if (!w?.id || g.home.score === null || g.away.score === null) continue;
      const p = of(w.id);
      for (const b of buckets) {
        const t = totalsOf(p, b, s.seasonCode);
        t.winning++;
        if (w.buzzer) t.buzzer++;
      }
      const mineHome = w.teamCode === g.home.teamCode;
      p.shots.push({
        seasonCode: s.seasonCode,
        stage,
        gmkey: g.gmkey,
        date: g.date,
        shot: w,
        homeCode: g.home.teamCode,
        teamCode: w.teamCode,
        oppCode: mineHome ? g.away.teamCode : g.home.teamCode,
        teamScore: mineHome ? g.home.score : g.away.score,
        oppScore: mineHome ? g.away.score : g.home.score,
      });
    }
  }
  for (const p of out.values()) p.shots.sort((a, b) => b.date.localeCompare(a.date) || b.gmkey.localeCompare(a.gmkey));
  return out;
}

/** 이 구분에 들어가는 위닝샷인가 (플레이오프 = 6강~챔프전) */
export const shotInStage = (s: Pick<WinningEntry, "stage">, stage: ClutchStage): boolean =>
  stage === "playoff" ? s.stage !== "regular" : s.stage === stage;

/** 시즌 합계들 → 통산 */
export function sumClutchTotals(list: Iterable<ClutchTotals>): ClutchTotals {
  const t = emptyClutchTotals();
  for (const x of list) {
    t.pts += x.pts; t.fgm += x.fgm; t.fga += x.fga; t.tpm += x.tpm; t.tpa += x.tpa; t.ftm += x.ftm; t.fta += x.fta;
    t.games += x.games; t.winning += x.winning; t.buzzer += x.buzzer;
  }
  return t;
}

/**
 * 기록 탭 부문: 위닝샷 횟수·버저비터·클러치 득점.
 * 클러치 야투율은 2026-11-01 사용자 요청으로 따로 칩을 두지 않고 클러치 득점 줄 숫자 아래에 같이 보인다("야투율 40.0%", 성공/시도는 둘째 줄).
 * fgPct 키·clutchRecordValue 의 야투율 계산은 남겨 둔다(예전 주소 ?cat=fgPct 는 첫 부문으로).
 */
export type ClutchRecordKey = "winning" | "buzzer" | "pts" | "fgPct";

export const CLUTCH_RECORD_DEFS: readonly { key: ClutchRecordKey; label: string; unit: string }[] = [
  { key: "winning", label: "위닝샷", unit: "회" },
  { key: "buzzer", label: "버저비터", unit: "회" },
  { key: "pts", label: "클러치 득점", unit: "점" },
];

/**
 * 클러치 야투율 순위에 들려면 클러치 야투 시도가 이만큼 (우리 규칙 — 몇 개 던져 100% 가 1위가 되지 않게).
 * 플레이오프·한 시즌은 경기가 적어 낮춘다 (2026-10-28 사용자: 시즌별·플레이오프도).
 */
export const CLUTCH_FG_MIN_ATTEMPTS: Record<ClutchStage, { career: number; season: number }> = {
  regular: { career: 50, season: 15 },
  playoff: { career: 15, season: 5 },
  finals: { career: 8, season: 3 },
};

export const clutchFgMinAttempts = (stage: ClutchStage, scope: "career" | "season"): number => CLUTCH_FG_MIN_ATTEMPTS[stage][scope];

/** 부문 값 (순위에 안 드는 선수는 null). minFga = 야투율 최소 시도 */
export function clutchRecordValue(t: ClutchTotals, key: ClutchRecordKey, minFga = CLUTCH_FG_MIN_ATTEMPTS.regular.career): number | null {
  if (key === "fgPct") return t.fga >= minFga ? clutchFgPct(t) : null;
  const v = t[key];
  return v > 0 ? v : null;
}
