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

const particle = (word: string, withBatchim: string, without: string) => {
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
            note: `득점 중 ${src.label} 비중, TOP 5 중 1위`,
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
            note: `경기당 ${src.label} 득점, TOP 5 중 1위`,
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
        note: "어느 한쪽에 쏠리지 않은 균형형",
      };
    } else {
      pick = {
        kind: "biggest",
        source: biggest.key,
        headline: `${biggest.label} ${biggest.share}%`,
        note: `가장 큰 득점 출처`,
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
}

const pctText = (v: number) => `${r1(v)}%`;

/** 선수 한 명 대사 — 20대 해요체, 숫자는 2개 안팎만 */
export function topScorerLine(p: TopScorerScriptInput): ScriptLine {
  const head = p.rank === 1 ? `그리고 대망의 1위, ${p.name}. 경기당 ${p.ppg}점.` : `${p.rank}위 ${p.name}, 경기당 ${p.ppg}점.`;
  const c = p.callout;
  const s = (k: ScoringSourceKey) => p.sources.find((x) => x.key === k)!;
  let body: string;
  if (c.kind === "balanced") {
    const [a, b] = [...p.sources].sort((x, y) => y.share - x.share);
    body = `${a.label} ${a.share}%, ${b.label} ${b.share}%. 안팎을 가리지 않는 균형형이에요.`;
  } else if (c.kind === "shareTop" && c.source === "three") {
    body = `득점의 ${s("three").share}%가 3점이에요. 성공률도 ${pctText(p.tpPct)}.`;
  } else if (c.kind === "shareTop" && c.source === "paint") {
    body = `득점의 ${s("paint").share}%를 페인트에서 냈어요. 다섯 명 중 제일 많이 안으로 파고들었죠.`;
  } else if (c.kind === "shareTop" && c.source === "ft") {
    body = `비밀은 자유투. 득점의 ${s("ft").share}%, 성공률은 ${pctText(p.ftPct)}예요.`;
  } else if (c.kind === "perGameTop" && c.source === "ft") {
    body = `비밀은 자유투. 자유투로만 경기당 ${s("ft").perGame}점, 성공률 ${pctText(p.ftPct)}예요.`;
  } else if (c.kind === "perGameTop" && c.source === "three") {
    body = `3점으로만 경기당 ${s("three").perGame}점. 다섯 명 중 가장 많아요.`;
  } else if (c.source) {
    const x = s(c.source);
    body = `${x.label} 비중이 ${x.share}%예요.`;
  } else {
    body = "";
  }
  const caption = `${head} ${body}`.trim();
  return { caption, speech: caption };
}

/** 숫자를 TTS 가 자연스럽게 읽도록: "TOP 5" → "탑 파이브", "%" 는 그대로 (TTS 가 퍼센트로 읽음) */
export function toSpeech(text: string): string {
  return text.replace(/TOP\s*5/g, "탑 파이브").replace(/25-26/g, "이오 이육");
}

/** 자막을 한 화면에 들어갈 조각으로 — 문장 부호·쉼표 기준, 한 조각 최대 maxLen 글자 */
export function captionChunks(text: string, maxLen = 16): string[] {
  const parts = text
    .split(/(?<=[.,?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    if (part.length <= maxLen) {
      out.push(part);
      continue;
    }
    const words = part.split(/\s+/);
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

/** 대본 길이로 읽는 시간 추정 (초) — TTS 가 없을 때 장면 길이. 한국어 숏폼 내레이션 약 초당 7자 */
export function estimateSpeechSeconds(text: string): number {
  const chars = text.replace(/\s+/g, "").length;
  return Math.max(1.5, chars / 7);
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
