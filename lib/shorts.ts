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
 * 선수 한 명 대사 — 쇼츠용 짧은 말 (2026-10-02 사용자: 전체 30~40초, 속도감).
 * 한 장면 약 4초 = 두 마디. 첫마디는 "N위 이름", 둘째 마디에 숫자 하나. 정확한 값은 화면에.
 * 화면 자막 = 읽는 말 그대로.
 */
export function topScorerLine(p: TopScorerScriptInput): ScriptLine {
  const c = p.callout;
  const s = (k: ScoringSourceKey) => p.sources.find((x) => x.key === k)!;
  const n = p.name;
  const R = `${p.rank}위 ${n}`;
  let line: string;
  if (c.kind === "balanced") {
    const [a, b] = [...p.sources].sort((x, y) => y.share - x.share);
    line = `${p.rank}위 ${eunNeun(n)} 안팎 반반. ${a.label} ${Math.round(a.share)}%, ${b.label} ${Math.round(b.share)}%예요.`;
  } else if (c.source === "three" && c.kind === "shareTop") {
    const pct = pctFloorWords(p.tpPct);
    line = `${R}. 3점이 득점의 ${ieyo(shareNoun(s("three").share))}` + (pct ? `. 성공률도 ${pct} 넘어요.` : ".");
  } else if (c.source === "three") {
    line = `${R}, 3점으로만 경기당 ${pointsWords(s("three").perGame)} 넣었어요. 다섯 명 중 제일 많아요.`;
  } else if (c.source === "paint") {
    line = `${R}, 페인트가 득점의 ${ieyo(shareNoun(s("paint").share))}. 다섯 명 중 최고.`;
  } else if (c.source === "ft") {
    const pg = pointsWords(s("ft").perGame);
    line = p.rank === 1 ? `1위 ${eunNeun(n)} 의외로 자유투예요. 자유투로만 경기당 ${pg}!` : `${R}, 자유투로만 경기당 ${pg}.`;
  } else if (c.source === "mid") {
    line = `${R}, 미드레인지가 득점의 ${ieyo(shareNoun(s("mid").share))}.`;
  } else {
    const top = [...p.sources].sort((x, y) => y.share - x.share)[0];
    line = `${R}, ${iGa(top.label)} 득점의 ${ieyo(shareNoun(top.share))}.`;
  }
  return { caption: line, speech: line };
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
