// 팬 숏폼(YouTube Shorts) 에피소드 규칙 — 순수 함수만 (2026-10-02)
//
// 영상은 사이트 밖 산출물이다(SCOPE "팬 숏폼"). 이 파일은 data/processed 의 숫자를 받아
// "에피소드 JSON"(장면·대본·숫자)을 만든다. 영상 렌더러(shorts/)는 그 JSON 만 읽는다 — 원칙 1 과 같은 분리.
// 대본의 숫자는 전부 여기서 계산한 값을 그대로 쓴다 (AI 가 숫자를 만들지 않는다).

import type { ShotPoint } from "./shots";

// ─────────────────────────────────────────────
// 득점 출처 4개 (페인트 2점 · 미드레인지 2점 · 3점 · 자유투)
// ─────────────────────────────────────────────

export const SCORING_SOURCES = [
  { key: "paint", label: "페인트", long: "페인트 존" },
  { key: "mid", label: "미드레인지", long: "미드레인지" },
  { key: "three", label: "3점", long: "3점" },
  { key: "ft", label: "자유투", long: "자유투" },
] as const;
export type ScoringSourceKey = (typeof SCORING_SOURCES)[number]["key"];

export interface ScoringInput {
  games: number;
  points: number;
  twoPm: number;
  tpm: number;
  ftm: number;
  /** 슛 차트 구역 성공 개수 (골밑 + 페인트 = 안쪽, 미드레인지) — 없으면 2점은 전부 페인트로 보지 않고 null */
  zoneMade: { rim: number; paint: number; mid: number } | null;
}

export interface ScoringSource {
  key: ScoringSourceKey;
  label: string;
  /** 시즌 합계 점수 */
  points: number;
  /** 경기당 점수 (소수 1자리) */
  perGame: number;
  /** 득점 중 비중 % (소수 1자리) */
  share: number;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * 득점을 네 출처로 나눈다.
 * 2점·3점·자유투 점수는 공식 기록(2점 성공·3점 성공·자유투 성공) 그대로라 합이 공식 득점과 같다.
 * 2점을 페인트/미드레인지로 가르는 비율만 슛 차트 좌표(구역 성공 개수)에서 온다 — 좌표 판정은 공식과 1~2% 다를 수 있다.
 * 슛 차트가 없는 시즌(2005-06 이전)은 null.
 */
export function scoringBreakdown(p: ScoringInput): ScoringSource[] | null {
  if (!p.zoneMade || p.games <= 0) return null;
  const inside = p.zoneMade.rim + p.zoneMade.paint;
  const twoMade = inside + p.zoneMade.mid;
  if (twoMade <= 0) return null;
  const twoPts = 2 * p.twoPm;
  const paintPts = Math.round((twoPts * inside) / twoMade);
  const pts: Record<ScoringSourceKey, number> = {
    paint: paintPts,
    mid: twoPts - paintPts,
    three: 3 * p.tpm,
    ft: p.ftm,
  };
  const total = pts.paint + pts.mid + pts.three + pts.ft;
  if (total <= 0) return null;
  return SCORING_SOURCES.map((s) => ({
    key: s.key,
    label: s.label,
    points: pts[s.key],
    perGame: r1(pts[s.key] / p.games),
    share: r1((pts[s.key] / total) * 100),
  }));
}

// ─────────────────────────────────────────────
// 선수별 "한 줄 특징" — 다섯 명 안에서 가장 튀는 사실 하나
// ─────────────────────────────────────────────

export type CalloutKind = "shareTop" | "perGameTop" | "balanced" | "biggest";

export interface Callout {
  kind: CalloutKind;
  source: ScoringSourceKey | null;
  /** 화면 큰 글씨 (예: "3점이 득점의 51.8%") */
  headline: string;
  /** 화면 작은 글씨 (예: "TOP 5 중 3점 비중 1위") */
  note: string;
}

/** 가장 큰 출처 비중이 이 값 미만이면 "균형형" — 한쪽으로 쏠리지 않은 득점 */
export const BALANCED_MAX_SHARE = 40;

export const particle = (word: string, withBatchim: string, without: string) => {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) {
    // 숫자·영문 끝: "3점" 처럼 한글로 끝나는 경우만 받침 판정, 그 밖은 받침 없음 처리
    return without;
  }
  return (last - 0xac00) % 28 !== 0 ? withBatchim : without;
};
/** 이/가 */
export const iGa = (w: string) => w + particle(w, "이", "가");
/** 을/를 */
export const eulReul = (w: string) => w + particle(w, "을", "를");
/** 으로/로 (ㄹ 받침도 "로") */
export const euroRo = (w: string) => {
  const last = w.charCodeAt(w.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return w + "로";
  const jong = (last - 0xac00) % 28;
  return w + (jong === 0 || jong === 8 ? "로" : "으로");
};

/** 선수를 규정하는 특징으로 볼 최소 비중(%) — 미드레인지 13% 처럼 작은 출처의 1위는 특징으로 내세우지 않는다 */
export const MIN_TRAIT_SHARE = 20;

/**
 * 선수마다 특징 하나를 고른다. 순서:
 * 1) 출처 비중 1위(다섯 명 중) — 2위와 차이가 가장 큰 출처
 * 2) 경기당 출처 점수 1위
 * 3) (1·2 가 없고) 가장 큰 비중 < 40% → 균형형
 * 4) 그 밖 → 가장 큰 출처
 * 같은 사실(종류+출처)을 두 선수가 갖지 않게 앞 선수(높은 순위)부터 정한다.
 */
export function pickCallouts(list: readonly ScoringSource[][]): Callout[] {
  const used = new Set<string>();
  const shareTop = (key: ScoringSourceKey) => topOf(list, (s) => s.find((x) => x.key === key)!.share);
  const pgTop = (key: ScoringSourceKey) => topOf(list, (s) => s.find((x) => x.key === key)!.perGame);
  const order = list.map((_, i) => i);
  const result: Callout[] = new Array(list.length);
  for (const i of order) {
    const mine = list[i];
    const cands: { margin: number; c: Callout }[] = [];
    for (const src of SCORING_SOURCES) {
      const s = mine.find((x) => x.key === src.key)!;
      const st = shareTop(src.key);
      if (s.share < MIN_TRAIT_SHARE) continue;
      if (st.index === i && st.margin > 0 && !used.has(`shareTop:${src.key}`)) {
        cands.push({
          margin: st.margin / Math.max(1, st.value),
          c: {
            kind: "shareTop",
            source: src.key,
            headline: `${src.label} ${s.share}%`,
            note: `다섯 명 중 ${src.label} 비중 1위`,
          },
        });
      }
      const pt = pgTop(src.key);
      if (pt.index === i && pt.margin > 0 && !used.has(`perGameTop:${src.key}`) && !used.has(`shareTop:${src.key}`)) {
        cands.push({
          margin: (pt.margin / Math.max(0.1, pt.value)) * 0.9,
          c: {
            kind: "perGameTop",
            source: src.key,
            headline: `${euroRo(src.label)}만 ${s.perGame}점`,
            note: `다섯 명 중 경기당 ${src.label} 득점 1위`,
          },
        });
      }
    }
    cands.sort((a, b) => b.margin - a.margin);
    const biggest = [...mine].sort((a, b) => b.share - a.share)[0];
    let pick: Callout;
    if (cands.length) {
      pick = cands[0].c;
    } else if (biggest.share < BALANCED_MAX_SHARE) {
      const second = [...mine].sort((a, b) => b.share - a.share)[1];
      pick = {
        kind: "balanced",
        source: null,
        headline: `${biggest.label} ${biggest.share}% · ${second.label} ${second.share}%`,
        note: "안쪽과 3점이 거의 반반",
      };
    } else {
      pick = {
        kind: "biggest",
        source: biggest.key,
        headline: `${biggest.label} ${biggest.share}%`,
        note: `가장 많이 나온 득점 출처`,
      };
    }
    if (pick.source) used.add(`${pick.kind}:${pick.source}`);
    result[i] = pick;
  }
  return result;
}

function topOf(list: readonly ScoringSource[][], value: (s: ScoringSource[]) => number) {
  let index = -1;
  let best = -Infinity;
  let second = -Infinity;
  list.forEach((s, i) => {
    const v = value(s);
    if (v > best) {
      second = best;
      best = v;
      index = i;
    } else if (v > second) second = v;
  });
  return { index, value: best, margin: best - second };
}

// ─────────────────────────────────────────────
// 대본 — 화면 자막(caption)과 읽기용(speech)을 따로 둔다 (TTS 가 "TOP 5" 를 "탑 파이브"로 읽게)
// ─────────────────────────────────────────────

export interface ScriptLine {
  caption: string;
  speech: string;
}

export interface TopScorerScriptInput {
  rank: number;
  name: string;
  ppg: number;
  sources: ScoringSource[];
  callout: Callout;
  tpPct: number;
  ftPct: number;
  /** 포지션 묶음 이름("가드"·"포워드"·"센터") — 다섯 명 중 이 포지션이 이 선수 하나뿐일 때만, 아니면 null */
  onlyPosition?: string | null;
  /** 소속 팀 짧은 이름 ("SK") — 대사에서 "SK의 안영준" 처럼 늘 같이 부른다 */
  team?: string | null;
  /** 바로 앞에 소개한 선수(한 순위 아래)의 팀 — 같으면 "같은 KCC의 허웅" */
  prevTeam?: string | null;
}

// 말로 하는 숫자는 사람처럼 둥글게 — 정확한 값은 화면(막대·특징 칸)에 있다.
// AI 내레이션 티가 나는 것: 문장마다 소수점 숫자, "비밀은 ~", "대망의", "~형이에요" 같은 라벨 붙이기, 같은 길이 문장 반복.

/** 비중을 말로 (서술어까지): 50 이상 "전체 득점의 절반이 넘어요", 43~50 "거의 절반이에요", 33.3 이상 "3분의 1이 넘어요", 그 밖은 반올림 % */
export function sharePredicate(share: number): string {
  if (share >= 50) return "전체 득점의 절반이 넘어요";
  if (share >= 43) return "전체의 거의 절반이에요";
  if (share >= 100 / 3) return "전체의 3분의 1이 넘어요";
  return `${Math.round(share)}%예요`;
}

/** 경기당 점수를 말로: 6점 이상이면 "8점 넘게"(내림), 작으면 소수 한 자리 그대로 (4.5점) */
export function pointsWords(v: number): string {
  if (v >= 6) return Number.isInteger(v) ? `${v}점` : `${Math.floor(v)}점 넘게`;
  return `${r1(v)}점`;
}

/** 성공률을 5 단위로 내려서 "40%를 넘기고" 처럼 — 35% 미만이면 null (자랑할 숫자가 아님) */
export function pctFloorWords(pct: number): string | null {
  if (pct < 35) return null;
  return `${Math.floor(pct / 5) * 5}%`;
}

/** 은/는 */
export const eunNeun = (w: string) => w + particle(w, "은", "는");
/** 이랑/랑 */
const irang = (w: string) => w + particle(w, "이랑", "랑");
/** 이에요/예요 */
const ieyo = (w: string) => w + particle(w, "이에요", "예요");
/** 인데/인데 — 이름 뒤 "이정현인데" (받침 없으면 "인데"도 그대로 자연스러움) */
const inde = (w: string) => w + "인데";

/** 비중을 짧은 명사로: 50 이상 "절반 이상", 43~50 "거의 절반", 33.3 이상 "3분의 1 이상", 그 밖은 반올림 % */
export function shareNoun(share: number): string {
  if (share >= 50) return "절반 이상";
  if (share >= 43) return "거의 절반";
  if (share >= 100 / 3) return "3분의 1 이상";
  return `${Math.round(share)}%`;
}

/**
 * 선수 한 명 대사 — 쇼츠 말투 (2026-10-02 사용자: 30~40초·속도감, "뉴스 같지 않게 편한 말투").
 * 한 장면 약 4초 = 두 마디. 첫마디 "N위 이름", 둘째 마디에 숫자 하나. 정확한 값은 화면에.
 * 말투: 해요체 + 짧은 감탄("진짜", "!", "~죠"), 기사체(“~를 기록”, “~로 나타났다”, “의외로”) 금지.
 * 다섯 명 중 유일한 포지션이면 그걸 이유로 붙인다(예: 유일한 포워드 → 페인트 득점이 많은 이유).
 * 화면 자막 = 읽는 말 그대로.
 */
export function topScorerLine(p: TopScorerScriptInput): ScriptLine {
  const c = p.callout;
  const s = (k: ScoringSourceKey) => p.sources.find((x) => x.key === k)!;
  const n = p.name;
  const R = `${p.rank}위 ${n}`;
  const only = p.onlyPosition ?? null;
  let line: string;
  if (c.kind === "balanced") {
    const [a, b] = [...p.sources].sort((x, y) => y.share - x.share);
    line = `${p.rank}위 ${eunNeun(n)} 완전 반반! ${a.label} ${Math.round(a.share)}%, ${b.label} ${Math.round(b.share)}%.`;
  } else if (c.source === "three" && c.kind === "shareTop") {
    const pct = pctFloorWords(p.tpPct);
    line = `${R}! 득점 ${iGa(shareNoun(s("three").share))} 3점이에요.` + (pct ? ` 성공률도 ${pct} 넘고요.` : "");
  } else if (c.source === "three") {
    line = `${R}, 3점으로만 경기당 ${pointsWords(s("three").perGame)} 넣어요. 이 중 1등!`;
  } else if (c.source === "paint") {
    const noun = shareNoun(s("paint").share);
    line =
      only && only !== "가드"
        ? `${R}, 다섯 명 중 유일한 ${ieyo(only)}. 그래서 득점 ${iGa(noun)} 페인트!`
        : `${R}, 득점 ${iGa(noun)} 페인트! 안쪽은 이 선수예요.`;
  } else if (c.source === "ft") {
    line = `${R}, 자유투를 진짜 잘 뜯어내요. 자유투로만 경기당 ${pointsWords(s("ft").perGame)}!`;
  } else if (c.source === "mid") {
    line = `${R}, 득점 ${iGa(shareNoun(s("mid").share))} 미드레인지예요. 요즘 보기 드문 스타일!`;
  } else {
    const top = [...p.sources].sort((x, y) => y.share - x.share)[0];
    line = `${R}, 득점 ${iGa(shareNoun(top.share))} ${ieyo(top.label)}.`;
  }
  return { caption: line, speech: line };
}

// ─────────────────────────────────────────────
// 선수별 인사이트 — 장면마다 다른 화면(layout)과 "숫자를 읽는 게 아니라 뜻을 말하는" 대사
// (2026-10-02 사용자: "다섯 명이 같은 틀로 흘러가 단조롭다, 특징을 인사이트로")
// 규칙: 그 선수의 특징(callout) → 화면 하나. 숫자는 전부 데이터에서, 비교 대상(다섯 명·국내 선수)을 같이 말한다.
// ─────────────────────────────────────────────

export type InsightLayout = "shotmap" | "split" | "lineup" | "ladder" | "counter" | "classic";

export type Insight =
  /** 슛 지도 — 그 출처 구역에 불을 켠다. lowFtShare: 다섯 명 중 자유투 비중 꼴찌면 그 값 */
  | {
      layout: "shotmap";
      focus: ScoringSourceKey;
      share: number;
      lowFtShare: number | null;
      /** 다섯 명 중 3점 성공률 1위면 그 값 (같은 3점형 선수와 구분 — 정확도) */
      tpPctTop?: number | null;
      /** 다섯 명 중 슛 시도 중 미드레인지 비중 1위면 그 값·미드 성공률 */
      midTop?: { share: number; pct: number } | null;
    }
  /** 저울 — 두 출처가 거의 같다 */
  | { layout: "split"; a: ScoringSource; b: ScoringSource }
  /** 다섯 명 포지션 줄 — 혼자 다른 포지션 → 그래서 이 출처 */
  | { layout: "lineup"; positions: (string | null)[]; me: number; only: string; focus: ScoringSourceKey; share: number }
  /** 사다리 — 한 출처 점수만으로 국내 선수 몇 %의 전체 득점을 넘나 */
  | { layout: "ladder"; focus: ScoringSourceKey; value: number; beatPct: number; beaten: number; total: number; ppgs: number[]; /** 다섯 명 중 다른 3점형 선수가 있으면 "양으로 승부" 로 구분 */ volume?: boolean }
  /** 계수기 — 자유투 시도 국내 순위 + 시즌 자유투 성공 개수 */
  | { layout: "counter"; ftm: number; ftPerGame: number; rank: number; ratioToNext: number | null; leaders: { name: string; value: number; me: boolean }[] }
  | { layout: "classic" };

export interface InsightContext {
  /** 다섯 명 (순위 순) */
  five: {
    sources: ScoringSource[];
    callout: Callout;
    positionGroup: string | null;
    /** 3점 성공률 (%) */
    tpPct?: number;
    /** 슛 차트 시도 중 미드레인지 비중 (%)·미드 성공률 — 슛 차트 없으면 null */
    mid?: { share: number; pct: number } | null;
  }[];
  /** 비교 집단(국내 표본 충족) 선수의 경기당 득점 */
  leaguePpg: number[];
  /** 비교 집단의 경기당 자유투 시도 (이름 포함) */
  leagueFta: { id: string; name: string; value: number }[];
}

const POSITION_NAME: Record<string, string> = { G: "가드", F: "포워드", C: "센터" };

/** 다섯 명 중 i 번째 선수의 화면·대사 재료 */
export function buildInsight(i: number, ctx: InsightContext, me: { id: string; ftm: number; games: number }): Insight {
  const p = ctx.five[i];
  const c = p.callout;
  const src = (k: ScoringSourceKey) => p.sources.find((x) => x.key === k)!;
  const groups = ctx.five.map((x) => x.positionGroup);
  const onlyGroup = p.positionGroup && groups.filter((g) => g === p.positionGroup).length === 1 ? p.positionGroup : null;

  if (c.source === "ft") {
    const sorted = [...ctx.leagueFta].sort((a, b) => b.value - a.value);
    const rank = sorted.findIndex((x) => x.id === me.id) + 1;
    const next = sorted[rank] ?? null;
    const mine = sorted[rank - 1];
    return {
      layout: "counter",
      ftm: me.ftm,
      ftPerGame: src("ft").perGame,
      rank,
      ratioToNext: rank === 1 && next && next.value > 0 ? mine.value / next.value : null,
      leaders: sorted.slice(0, 5).map((x) => ({ name: x.name, value: r1(x.value), me: x.id === me.id })),
    };
  }
  if (c.source === "three" && c.kind === "perGameTop") {
    const v = src("three").perGame;
    const beaten = ctx.leaguePpg.filter((x) => x < v).length;
    return {
      layout: "ladder",
      focus: "three",
      value: v,
      beaten,
      total: ctx.leaguePpg.length,
      beatPct: Math.floor((beaten / Math.max(1, ctx.leaguePpg.length)) * 10) * 10,
      ppgs: [...ctx.leaguePpg].sort((a, b) => a - b).map(r1),
      volume: ctx.five.some((x, j) => j !== i && x.callout.source === "three"),
    };
  }
  if (c.kind === "balanced") {
    const [a, b] = [...p.sources].sort((x, y) => y.share - x.share);
    return { layout: "split", a, b };
  }
  if (c.source === "paint" && onlyGroup && onlyGroup !== "G") {
    return {
      layout: "lineup",
      positions: groups.map((g) => (g ? (POSITION_NAME[g] ?? null) : null)),
      me: i,
      only: POSITION_NAME[onlyGroup] ?? onlyGroup,
      focus: "paint",
      share: src("paint").share,
    };
  }
  if (c.source === "three" || c.source === "mid" || c.source === "paint") {
    const ftShares = ctx.five.map((x) => x.sources.find((s) => s.key === "ft")!.share);
    const myFt = ftShares[i];
    // 다섯 명 안에 3점형이 둘이면(예: 서명진·허웅) 정확도·점프슛으로 구분한다 (2026-10-02 사용자: "둘 다 3점 베이스라 차별화")
    const tps = ctx.five.map((x) => x.tpPct ?? -1);
    const mids = ctx.five.map((x) => x.mid?.share ?? -1);
    const me = ctx.five[i];
    const tpPctTop = me.tpPct != null && tps[i] === Math.max(...tps) ? me.tpPct : null;
    const midTop = me.mid && mids[i] === Math.max(...mids) ? me.mid : null;
    return {
      layout: "shotmap",
      focus: c.source,
      share: src(c.source).share,
      lowFtShare: myFt === Math.min(...ftShares) ? myFt : null,
      tpPctTop: c.source === "three" ? tpPctTop : null,
      midTop: c.source === "three" ? midTop : null,
    };
  }
  return { layout: "classic" };
}

/** 몇 배를 말로 — 소수 한 자리 내림 (1.55 → "1.5배") */
export function timesWords(ratio: number): string {
  return `${Math.floor(ratio * 10) / 10}배`;
}

/** 인사이트 → 대사 (쇼츠 말투, 두 마디). classic 이면 기존 topScorerLine */
export function insightLine(p: TopScorerScriptInput, insight: Insight): ScriptLine {
  // 2026-10-02 사용자: "호흡이 짧게 끊기고 선수마다 틀이 뻔하다, 기계 같다" → 한 선수를 한두 문장으로 이어 말한다.
  // 늘 "팀의 이름"으로 소개(SK의 안영준), 앞 선수와 같은 팀이면 "같은 KCC의", 1위는 "그리고 1위"로 받는다.
  // 반말·친구한테 말하듯. 숫자는 전부 데이터에서.
  const who = p.team ? `${p.team === p.prevTeam ? "같은 " : ""}${p.team}의 ${p.name}` : p.name;
  const rank = `${p.rank}위`;
  let line: string;
  switch (insight.layout) {
    case "counter": {
      const ratio = insight.ratioToNext && insight.ratioToNext >= 1.2 ? `, 2위보다 ${timesWords(insight.ratioToNext)}나 많아` : "야";
      const body = `파울을 진짜 잘 뜯어내서 자유투 시도가 국내 ${insight.rank}위${ratio}.`;
      line = p.rank === 1 ? `그리고 1위, ${who}! ${body}` : `${rank} ${eunNeun(who)} ${body}`;
      break;
    }
    case "ladder": {
      const body = `3점만으로 경기당 ${pointsWords(insight.value)} 넣는데, 국내 선수 열에 ${nativeCount(outOfTen(insight.beaten, insight.total))}은 이만큼도 못 넣어.`;
      const lead = insight.volume ? "이쪽은 양으로 승부하는 슈터야. " : "";
      line = p.rank === 1 ? `그리고 1위, ${who}! ${lead}${body}` : `${eunNeun(rank)} ${who}. ${lead}${body}`;
      break;
    }
    case "split": {
      const inOut = new Set([insight.a.key, insight.b.key]);
      const pair =
        inOut.has("paint") && inOut.has("three")
          ? `안에서 ${Math.round(insight.a.key === "paint" ? insight.a.share : insight.b.share)}%, 밖에서 ${Math.round(insight.a.key === "three" ? insight.a.share : insight.b.share)}%`
          : `${insight.a.label} ${Math.round(insight.a.share)}%, ${insight.b.label} ${Math.round(insight.b.share)}%`;
      line = `${eunNeun(rank)} ${who}인데, ${pair}로 거의 반반이라 수비 입장에선 어딜 막아도 지옥의 이지선다야.`;
      break;
    }
    case "lineup":
      line = `${rank} ${eunNeun(who)} 유일하게 ${insight.only}인데, 아무래도 다른 선수들보다 인사이드 득점이 눈에 띄지. 득점 ${iGa(shareNoun(insight.share))} 페인트야.`;
      break;
    case "shotmap": {
      const label = SCORING_SOURCES.find((x) => x.key === insight.focus)!.label;
      const head = `${rank} ${eunNeun(who)} 득점 ${iGa(shareNoun(insight.share))} ${label}`;
      if (insight.tpPctTop != null && insight.midTop) {
        const pct = pctFloorWords(insight.tpPctTop) ?? `${Math.floor(insight.tpPctTop)}%`;
        line = `${rank} ${eunNeun(who)} 3점 성공률 ${pct}로 다섯 명 중 최고고, 미드레인지도 제일 많이 던지는 점퍼 장인이야.`;
      } else if (insight.lowFtShare !== null && insight.focus === "three") line = `${head}이라 자유투가 다섯 명 중 제일 적어. 밖에서 끝내는 스타일.`;
      else {
        const pct = insight.focus === "three" ? pctFloorWords(p.tpPct) : null;
        line = pct ? `${head}인데, 성공률도 ${pct}가 넘어.` : `${head}${particle(label, "이야", "야")}.`;
      }
      break;
    }
    default:
      return topScorerLine(p);
  }
  return { caption: line, speech: line };
}

/** 이야/야 — "포워드야", "센터야" */
const iya = (w: string) => w + particle(w, "이야", "야");

const NATIVE_COUNT = ["", "하나", "둘", "셋", "넷", "다섯", "여섯", "일곱", "여덟", "아홉", "열"];
/** 1~10 고유어 (읽을 때 "팔"이 아니라 "여덟") */
export function nativeCount(n: number): string {
  return NATIVE_COUNT[Math.max(0, Math.min(10, Math.floor(n)))] || String(n);
}

/** 인사이트 → 유튜브 설명란 한 줄 (영상보다 정확한 숫자, 소수 한 자리) */
export function insightSummary(insight: Insight, callout: Callout): string {
  switch (insight.layout) {
    case "counter": {
      const me = insight.leaders.find((l) => l.me);
      const ratio = insight.ratioToNext && insight.ratioToNext >= 1.2 ? `, 2위의 ${timesWords(insight.ratioToNext)}` : "";
      return `자유투 시도 국내 ${insight.rank}위${me ? `(경기당 ${me.value}개${ratio})` : ""}, 자유투로만 경기당 ${insight.ftPerGame}점`;
    }
    case "ladder":
      return `${insight.volume ? "TOP 5 중 경기당 3점 성공 1위(볼륨 슈터), " : ""}3점으로만 경기당 ${insight.value}점, 국내 선수 ${insight.total}명 중 ${insight.beaten}명은 전체 득점이 이보다 적음`;
    case "lineup":
      return `TOP 5 중 유일한 ${insight.only}, 득점 ${Math.round(insight.share)}%가 페인트`;
    case "split":
      return `${insight.a.label} ${Math.round(insight.a.share)}% · ${insight.b.label} ${Math.round(insight.b.share)}%, 안팎 반반`;
    case "shotmap": {
      if (insight.tpPctTop != null && insight.midTop)
        return `3점 성공률 ${insight.tpPctTop.toFixed(1)}%·슛 중 미드레인지 비중 ${insight.midTop.share}%, 둘 다 TOP 5 중 1위`;
      const label = SCORING_SOURCES.find((x) => x.key === insight.focus)!.label;
      const low = insight.lowFtShare !== null ? `, 자유투 비중은 5명 중 최저(${Math.round(insight.lowFtShare)}%)` : "";
      return `득점 ${Math.round(insight.share)}%가 ${label}${low}`;
    }
    default:
      return callout.headline;
  }
}

/** 열 명 중 몇 명 (내림) — "10명 중 8명" */
export function outOfTen(part: number, total: number): number {
  return Math.floor((part / Math.max(1, total)) * 10);
}

/**
 * 인사이트 → 캐주얼 설명란 한 줄 (2026-10-02 사용자: "정제된 리포트 같다, 캐주얼 버전도").
 * 반말·커뮤니티 말투, 숫자는 데이터 그대로(내림). 이모지는 쓰지 않는다.
 */
export function insightCasual(insight: Insight, callout: Callout): string {
  switch (insight.layout) {
    case "counter": {
      const ratio = insight.ratioToNext && insight.ratioToNext >= 1.2 ? `, 2위보다 ${timesWords(insight.ratioToNext)}` : "";
      return `파울 뜯어내기 장인. 자유투 시도 국내 ${insight.rank}위${ratio}`;
    }
    case "ladder":
      return `${insight.volume ? "양으로 승부하는 볼륨 슈터. " : ""}3점만 쏴도 경기당 ${insight.value}점, 국내 선수 10명 중 ${outOfTen(insight.beaten, insight.total)}명은 다 합쳐도 이것보다 적게 넣음`;
    case "lineup":
      return `5명 중 유일한 ${insight.only}, 인사이드 득점이 확 눈에 띔. 득점 ${iGa(shareNoun(insight.share))} 페인트`;
    case "split":
      return `안 ${Math.round(insight.a.key === "paint" ? insight.a.share : insight.b.share)}% 밖 ${Math.round(insight.a.key === "paint" ? insight.b.share : insight.a.share)}%, 수비 입장에선 지옥의 이지선다`;
    case "shotmap": {
      if (insight.tpPctTop != null && insight.midTop)
        return `점퍼 장인. 3점 성공률 ${insight.tpPctTop.toFixed(1)}%, 슛 중 미드레인지 ${insight.midTop.share}% 둘 다 5명 중 1위`;
      const label = SCORING_SOURCES.find((x) => x.key === insight.focus)!.label;
      const low = insight.lowFtShare !== null ? ". 자유투는 5명 중 제일 적음, 그냥 밖에서 끝냄" : "";
      return `득점 ${iGa(shareNoun(insight.share))} ${label}${low}`;
    }
    default:
      return callout.headline;
  }
}

/** 마무리 비교 한 줄 — "밖에서는 A, 안에서는 B, 자유투는 C" (같은 사람이 겹치면 묶는다) */
export function compareLine(names: { threeShare: string; threePerGame: string; paint: string; ft: string }): string {
  const outside = names.threeShare === names.threePerGame ? names.threeShare : `${irang(names.threeShare)} ${names.threePerGame}`;
  return `정리하면 3점은 ${outside}, 안쪽은 ${names.paint}, 자유투는 ${ieyo(names.ft)}.`;
}

const SINO_DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
/** 정수를 한자어 수로 (0~9999): 158 → 백오십팔, 10 → 십, 0 → 영 */
export function sinoNumber(n: number): string {
  if (n === 0) return "영";
  const units = ["", "십", "백", "천"];
  let out = "";
  const digits = String(Math.floor(n)).split("").map(Number);
  digits.forEach((d, i) => {
    const place = digits.length - 1 - i;
    if (d === 0) return;
    out += (d === 1 && place > 0 ? "" : SINO_DIGITS[d]) + units[place];
  });
  return out;
}

/**
 * 읽는 말로 바꾸기 (자막은 그대로, 목소리만). 표준 발음 기준(.claude/skills/super-video-agent/references/readout-ko.md):
 * 소수점은 [쩜], %는 "퍼센트", 우리 대본의 숫자(위·점·%·분의)는 전부 한자어 수. "TOP 5" → "탑 파이브", "25-26 " → "지난 시즌 ".
 */
export function toSpeech(text: string): string {
  return text
    .replace(/TOP\s*5/g, "탑 파이브")
    .replace(/\b\d{2}-\d{2} /g, "지난 시즌 ")
    .replace(/(\d+)(?:\.(\d+))?(%)?/g, (_, int: string, dec: string | undefined, pct: string | undefined) => {
      let w = sinoNumber(Number(int));
      if (dec) w += "쩜" + dec.split("").map((d) => (d === "0" ? "영" : SINO_DIGITS[Number(d)])).join("");
      return pct ? `${w} 퍼센트` : w;
    });
}

/** 자막을 한 화면에 들어갈 조각으로 — 문장 부호·쉼표 기준, 한 조각 최대 maxLen 글자 */
export function captionChunks(text: string, maxLen = 16): string[] {
  // "TOP 5" 는 한 단어로 (자막이 "TOP / 5." 로 끊기지 않게)
  const parts = text
    .replace(/TOP 5/g, "TOP\u00a05")
    .split(/(?<=[.,?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    if (part.length <= maxLen) {
      out.push(part);
      continue;
    }
    const words = part.split(/ +/); // 일반 공백만 — "TOP\u00a05" 는 한 단어
    let cur = "";
    for (const w of words) {
      if (cur && (cur + " " + w).length > maxLen) {
        out.push(cur);
        cur = w;
      } else cur = cur ? `${cur} ${w}` : w;
    }
    if (cur) out.push(cur);
  }
  return out;
}

/** 대본 길이로 읽는 시간 추정 (초) — TTS 가 없을 때 장면 길이. 2026-10-02 edge-tts +12% 실측 약 초당 5자 */
export function estimateSpeechSeconds(text: string): number {
  const chars = text.replace(/\s+/g, "").length;
  return Math.max(1.5, chars / 5);
}

// ─────────────────────────────────────────────
// 슛 점 줄이기 — 영상 한 장에 다 그리면 무거워서 고르게 솎는다 (순서 유지, 같은 결과)
// ─────────────────────────────────────────────

export function sampleShots(points: readonly ShotPoint[], max: number): ShotPoint[] {
  if (points.length <= max) return [...points];
  const step = points.length / max;
  const out: ShotPoint[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)]);
  return out;
}

// ─────────────────────────────────────────────
// 한 번에 읽힌 내레이션(ElevenLabs with-timestamps) → 장면 길이·자막 시작 시각
// ─────────────────────────────────────────────
// 장면마다 따로 읽히면 문장 사이 호흡이 끊겨 기계처럼 들린다. 대본 전체를 한 번에 읽히고,
// 글자별 시작 시각(alignment)으로 장면이 바뀌는 순간과 자막 조각이 바뀌는 순간을 찾는다.

/** 장면 사이에 넣는 문자열 — 빈 줄은 ElevenLabs 가 문단 사이처럼 조금 더 쉰다 */
export const SCENE_JOINER = "\n\n";
/** 다음 장면 첫 말보다 이만큼(초) 먼저 화면을 바꾼다 — 말과 그림이 같이 시작하는 느낌 */
export const SCENE_LEAD = 0.12;
/** 마지막 장면 뒤 여백(초) */
export const END_TAIL = 0.8;

export interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface SceneTiming {
  /** 장면 길이(초) */
  seconds: number;
  /** 장면 안 자막 조각별 시작 시각(장면 시작 기준, 초) */
  chunkStarts: number[];
}

/** ElevenLabs v3 말투 태그("[excited]" 등) 지우기 — 화면 자막·시각 찾기에는 태그가 없다 */
export const stripVoiceTags = (t: string) => t.replace(/\[[a-z ]+\]\s*/gi, "");

/** 시각 찾기용 비교 글자: 공백·문장부호 없이 (ElevenLabs 가 숫자·태그를 읽는 방식이 달라도 한글 글자는 그대로라서) */
const keyChars = (t: string) => stripVoiceTags(t).replace(/[^0-9A-Za-z\u3131-\u318e\uac00-\ud7a3]/g, "");

/**
 * texts: 장면별 읽는 말, chunks: 장면별 자막 조각(읽는 말 기준), alignment: 전체를 한 번에 읽힌 결과의 글자 시각.
 * 글자 위치를 그대로 믿지 않고, 각 장면·조각의 첫 글자 몇 개를 alignment 글자열에서 순서대로 찾아 시각을 정한다
 * (v3 말투 태그·숫자 읽기 변환으로 글자 수가 달라져도 어긋나지 않게). 못 찾으면 글자 수 비율로 추정.
 * tempo: 읽힌 소리를 나중에 빠르게 돌린 배율 (시각을 1/tempo 로 줄인다).
 */
export function sceneTimingsFromAlignment(
  texts: readonly string[],
  chunks: readonly (readonly string[])[],
  a: Alignment,
  audioSeconds: number,
  tempo = 1,
): SceneTiming[] {
  // alignment 의 비교 글자열과 각 글자의 시작 시각
  const ac: string[] = [];
  const at: number[] = [];
  a.characters.forEach((ch, i) => {
    if (keyChars(ch)) {
      ac.push(ch);
      at.push(a.character_start_times_seconds[i] / tempo);
    }
  });
  const hay = ac.join("");
  let cursor = 0;
  const find = (text: string): number | null => {
    const k = keyChars(text).slice(0, 4);
    if (!k) return null;
    const i = hay.indexOf(k, cursor);
    if (i < 0) return null;
    cursor = i + 1;
    return at[i];
  };
  const total = audioSeconds;
  const lens = texts.map((t) => keyChars(t).length || 1);
  const sum = lens.reduce((x, y) => x + y, 0);
  const sceneStart: number[] = [];
  let acc = 0;
  const chunkAbs: (number | null)[][] = [];
  texts.forEach((t, i) => {
    const found = find(t);
    const est = (acc / sum) * total;
    sceneStart.push(i === 0 ? 0 : Math.max(0, (found ?? est) - SCENE_LEAD));
    acc += lens[i];
    // 이 장면의 자막 조각 (첫 조각은 장면 시작)
    const cs = chunks[i].map((c, j) => (j === 0 ? null : find(c)));
    chunkAbs.push(cs);
  });
  return texts.map((_, i) => {
    const begin = sceneStart[i];
    const end = i + 1 < texts.length ? sceneStart[i + 1] : total + END_TAIL;
    const n = chunks[i].length;
    const chunkStarts = chunkAbs[i].map((abs, j) => {
      if (j === 0) return 0;
      const rel = abs === null ? ((end - begin) * j) / n : abs - begin;
      return Math.round(Math.min(Math.max(0, rel), end - begin) * 100) / 100;
    });
    return { seconds: Math.round((end - begin) * 100) / 100, chunkStarts };
  });
}
