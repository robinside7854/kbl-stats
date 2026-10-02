// 팬 숏폼 — 새 포맷 2개의 규칙 (순수 함수, 2026-10-02 사용자: "개막 직전 주제, 이전과 디자인부터 완전 다른 포맷 여러 개로 반응 비교")
//
// B. 개막전 대기록 카운트다운 (milestones): 현역 선수 중 정규리그 통산 이정표(득점 1000 단위·3점 100 단위 등)에
//    가장 가까운 다섯 명 → "개막하자마자 깨질 수도 있는 기록". 숫자는 data/processed 정규시즌 합계에서만.
// C. 슛 차트 퀴즈 (quiz): 지난 시즌 득점 상위 선수 셋의 슛 차트만 보여 주고 맞히게 → 정답 공개.
// 말투는 lib/shorts insightLine 과 같은 반말·이어 말하기. 숫자를 읽는 말(toSpeech)로 바꿀 때 "2개"가 "이개"로 읽히지 않게
// 작은 개수는 고유어로 적는다(countWords).

import { eunNeun, iGa, nativeCount, particle } from "./shorts";

// ─────────────────────────────────────────────
// 공통
// ─────────────────────────────────────────────

const ADNOMINAL: Record<number, string> = { 1: "한", 2: "두", 3: "세", 4: "네", 20: "스무" };
/** 1~10 을 단위 앞에 쓰는 고유어로: 1 → 한, 2 → 두, 5 → 다섯 */
const adnominal = (n: number) => ADNOMINAL[n] ?? nativeCount(n);

/** 개수 + 단위를 말로: 개·경기는 10 이하면 고유어("두 개", "세 경기"), 점·승·큰 수는 숫자("15점", "1200개") */
export function countWords(n: number, unit: string): string {
  if ((unit === "개" || unit === "경기") && n >= 1 && n <= 10) return `${adnominal(n)} ${unit}`;
  return `${n}${unit}`;
}

/** 몇 번째: 1 → 첫 번째, 2 → 두 번째 … 10 까지 고유어, 그 뒤는 숫자 */
export function ordinalWords(n: number): string {
  if (n === 1) return "첫 번째";
  if (n >= 2 && n <= 10) return `${adnominal(n)} 번째`;
  return `${n}번째`;
}

// ─────────────────────────────────────────────
// B. 개막전 대기록 카운트다운
// ─────────────────────────────────────────────

export type MilestoneStat = "points" | "reb" | "ast" | "stl" | "blk" | "tpm" | "wins";

/** 이정표 간격 · 화면 이름 · 단위 (lib/records MILESTONE_STEPS 와 같은 간격, 경기 수는 뺌 — 기록이라기보다 출석이라) */
export const MILESTONE_DEFS: readonly { key: MilestoneStat; step: number; label: string; unit: string }[] = [
  { key: "points", step: 1000, label: "득점", unit: "점" },
  { key: "tpm", step: 100, label: "3점", unit: "개" },
  { key: "reb", step: 500, label: "리바운드", unit: "개" },
  { key: "ast", step: 500, label: "어시스트", unit: "개" },
  { key: "stl", step: 100, label: "스틸", unit: "개" },
  { key: "blk", step: 100, label: "블록", unit: "개" },
  { key: "wins", step: 100, label: "승리", unit: "승" },
];

export interface CareerLine {
  playerNo: string;
  name: string;
  games: number;
  points: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tpm: number;
  wins: number;
}

export interface MilestonePick {
  playerNo: string;
  name: string;
  key: MilestoneStat;
  label: string;
  unit: string;
  current: number;
  target: number;
  remaining: number;
  /** 지금까지 경기당 */
  perGame: number;
  /** 평소 속도로 몇 경기면 닿나 (올림) */
  gamesNeeded: number;
  /** 달성하면 정규리그 역대 몇 번째 */
  nth: number;
}

/**
 * 현역(active) 선수의 다음 이정표 후보 → 가까운 순 다섯 개.
 * 규칙: 이정표는 간격의 2배 이상(1000점·100개 같은 첫 단계는 뺌), 선수당 하나, 같은 부문 최대 2개,
 * 정렬은 평소 속도로 필요한 경기 수 → 남은 양 비율. 순서(5→1)는 "역대 몇 번째"가 큰 것부터(1위 자리가 가장 희귀한 기록).
 */
export function pickMilestones(all: readonly CareerLine[], active: ReadonlySet<string>, n = 5): MilestonePick[] {
  const cands: MilestonePick[] = [];
  for (const t of all) {
    if (!active.has(t.playerNo) || t.games <= 0) continue;
    for (const d of MILESTONE_DEFS) {
      const current = t[d.key];
      const target = (Math.floor(current / d.step) + 1) * d.step;
      if (target < d.step * 2) continue;
      const remaining = target - current;
      const perGame = current / t.games;
      if (perGame <= 0) continue;
      cands.push({
        playerNo: t.playerNo,
        name: t.name,
        key: d.key,
        label: d.label,
        unit: d.unit,
        current,
        target,
        remaining,
        perGame,
        gamesNeeded: Math.max(1, Math.ceil(remaining / perGame)),
        nth: 1 + all.filter((o) => o[d.key] >= target).length,
      });
    }
  }
  cands.sort((a, b) => a.remaining / a.perGame - b.remaining / b.perGame || a.remaining / a.target - b.remaining / b.target);
  const out: MilestonePick[] = [];
  const perKey = new Map<string, number>();
  for (const c of cands) {
    if (out.some((o) => o.playerNo === c.playerNo)) continue;
    if ((perKey.get(c.key) ?? 0) >= 2) continue;
    out.push(c);
    perKey.set(c.key, (perKey.get(c.key) ?? 0) + 1);
    if (out.length >= n) break;
  }
  // 카운트다운: 덜 희귀한 것 먼저, 가장 희귀한(역대 몇 번째가 작은) 기록이 마지막
  return out.sort((a, b) => b.nth - a.nth || b.gamesNeeded - a.gamesNeeded);
}

/** "3점 1200개" — 화면·대사 공용 (쉼표 없이: 읽을 때 "천이백 개") */
export const milestoneName = (m: Pick<MilestonePick, "label" | "target" | "unit">) =>
  m.unit === "승" ? `통산 ${m.target}승` : `${m.label} ${m.target}${m.unit === "점" ? "점" : "개"}`;

export interface MilestoneLineInput {
  pick: MilestonePick;
  team: string;
  /** 지난 시즌 팀과 다르면 그 팀 (이적) */
  movedFrom: string | null;
  /** 카운트다운에서 몇 번째 장면인지 (0 = 첫 장면) · 마지막인지 */
  index: number;
  last: boolean;
}

/** 이정표 한 장면 대사 — 장면마다 여는 말·이유를 다르게 (같은 틀 반복 금지) */
export function milestoneLine({ pick: m, team, movedFrom, index, last }: MilestoneLineInput): string {
  const who = movedFrom ? `이번에 ${team}${particle(team, "으로", "로")} 옮긴 ${m.name}` : `${team}의 ${m.name}`;
  const left = countWords(m.remaining, m.unit);
  const goal = milestoneName(m);
  const pace = m.gamesNeeded <= 1 ? "평소대로면 개막전에서 바로 나와" : `평소 페이스면 ${countWords(m.gamesNeeded, "경기")} 안에 나와`;
  const nthText = m.nth <= 10 ? `달성하면 KBL 역대 ${ordinalWords(m.nth)}야` : null;
  if (last) {
    return `그리고 마지막, ${who}! ${goal}까지 딱 ${left} 남았는데, ${nthText ?? pace}.`;
  }
  if (index === 0) return `먼저 ${eunNeun(who)} ${goal}까지 ${left} 남았어. ${pace}.`;
  if (nthText) return `${eunNeun(who)} ${goal}까지 ${left}. ${nthText}.`;
  // 가운데 장면은 문장 틀을 돌려 쓴다 (사용자: "선수마다 틀이 뻔하다")
  const unitWord = m.unit === "승" ? "승" : m.unit;
  const perGame = Math.round(m.perGame * 10) / 10;
  const middle = [
    `${who}도 ${goal}까지 ${left} 남았고, ${pace}.`,
    m.unit === "승"
      ? `${eunNeun(who)} ${iGa(goal)} 코앞이야. 딱 ${m.remaining <= 10 ? `${adnominal(m.remaining)} 번` : `${m.remaining}번`}만 이기면 돼.`
      : `${eunNeun(who)} ${iGa(goal)} 코앞이야. 경기당 ${perGame}${unitWord}씩 하니까 ${countWords(m.gamesNeeded, "경기")}면 충분해.`,
    m.gamesNeeded <= 3
      ? `${who}, ${goal}까지 딱 ${left}! 이건 개막 첫 주 안에 볼 수 있을 듯.`
      : `${who}, ${goal}까지 ${left}. ${pace}.`,
  ];
  return middle[(index - 1) % middle.length];
}

// ─────────────────────────────────────────────
// C. 슛 차트 퀴즈
// ─────────────────────────────────────────────

export interface QuizCandidate {
  playerNo: string;
  name: string;
  team: string;
  position: string | null;
  ppg: number;
  /** 슛 시도 구역 비중 (%) — 골밑+페인트 / 미드 / 3점 */
  inside: number;
  mid: number;
  three: number;
  shots: number;
}

export type QuizKind = "inside" | "three" | "leader";

export interface QuizPick extends QuizCandidate {
  kind: QuizKind;
}

/**
 * 문제 셋 (쉬움 → 어려움 아니라 "모양이 다른" 순): ① 3점을 거의 안 던지는 골밑형(3점 비중 10% 미만 중 안쪽 비중 최고)
 * ② 3점 비중 최고 ③ 득점 1위(모양보다 "누가 1위였지"로 맞히는 마무리). 같은 선수는 한 번만, 슛 200개 이상만.
 */
export function pickQuiz(cands: readonly QuizCandidate[]): QuizPick[] {
  const pool = cands.filter((c) => c.shots >= 200);
  const used = new Set<string>();
  const take = (kind: QuizKind, list: QuizCandidate[]): QuizPick | null => {
    const c = list.find((x) => !used.has(x.playerNo));
    if (!c) return null;
    used.add(c.playerNo);
    return { ...c, kind };
  };
  const leader = [...pool].sort((a, b) => b.ppg - a.ppg);
  const inside = pool.filter((c) => c.three < 10).sort((a, b) => b.inside - a.inside);
  const three = [...pool].sort((a, b) => b.three - a.three);
  // 득점 1위는 마지막 문제로 아껴 둔다
  if (leader[0]) used.add(leader[0].playerNo);
  const q1 = take("inside", inside);
  const q2 = take("three", three);
  used.delete(leader[0]?.playerNo ?? "");
  const q3 = take("leader", leader);
  return [q1, q2, q3].filter((x): x is QuizPick => !!x);
}

const ORDINAL = ["첫 번째", "두 번째", "마지막"];

/** 문제 장면 대사 — 힌트 하나 + "셋, 둘, 하나" (목소리가 세는 동안 화면은 슛 차트) */
export function quizQuestionLine(q: QuizPick, i: number): string {
  const hint =
    q.kind === "inside"
      ? `3점은 ${q.three < 5 ? "거의 안 던지고" : "가끔만 던지고"}, 슛 ${Math.round(q.inside)}%가 페인트 안이야`
      : q.kind === "three"
        ? `슛의 ${Math.round(q.three)}%가 3점, 경기당 ${q.ppg}점 넣은 ${q.position ?? "선수"}야`
        : `이 선수가 지난 시즌 득점 1위야`;
  return `${ORDINAL[i] ?? `${i + 1}번째`} 문제. ${hint}. 누굴까? 셋, 둘, 하나!`;
}

/** 정답 장면 대사 */
export function quizAnswerLine(q: QuizPick): string {
  const tail = q.kind === "inside" ? "골밑 지배자" : q.kind === "three" ? "3점 기계" : `경기당 ${q.ppg}점`;
  return `정답은 ${q.team}의 ${q.name}! ${tail}${particle(tail, "이었어", "였어")}.`;
}
