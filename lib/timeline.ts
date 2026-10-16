// 선수 커리어 타임라인 (2026-10-16 "우리만의 기능"): 이미 가진 기록으로 시즌마다 무슨 일이 있었는지 짧게 모은다. 순수 함수만.
// 재료: 선수 색인(드래프트·수상·우승·커리어 하이) + 시즌별 기록(팀·누적 합계) + 프라임 시즌(lib/prime).
// 화면은 app/components/CareerTimeline, 재료 모으기는 lib/data-career-extra.
import { AWARD_LABELS, seasonShortLabel } from "./career";
import { formatHighDate } from "./highs";
import type { DraftInfo, HighKey, HighsSet, PlayerAward } from "./types";

export type TimelineKind = "debut" | "move" | "return" | "rename" | "prime" | "champion" | "award" | "high" | "milestone";

export interface TimelineItem {
  kind: TimelineKind;
  /** 한 줄 (해요체 아님 — 기록 꼬리표처럼 짧게) */
  text: string;
  /** 작은 글자 보조 줄 (드래프트·상대·날짜) */
  sub: string | null;
}

export interface TimelineSeason {
  seasonCode: number;
  /** "25-26" */
  season: string;
  teamCode: string;
  teamName: string;
  items: TimelineItem[];
}

/** 시즌 한 줄 재료 (시즌 오름차순) — 누적 합계는 정규시즌 시즌 기록 */
export interface TimelineSeasonInput {
  seasonCode: number;
  seasonLabel: string;
  teamCode: string;
  teamName: string;
  games: number;
  points: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tpm: number;
}

export interface TimelineInput {
  seasons: readonly TimelineSeasonInput[];
  /** 선수가 있는 모든 시즌 코드(오름차순) — 쉬었다 돌아온 시즌 수를 센다 */
  allSeasonCodes: readonly number[];
  draft: DraftInfo | null;
  awards?: readonly PlayerAward[];
  championships?: readonly number[];
  primeSeason: number | null;
  /** 정규시즌 통산 한 경기 최다 (색인 careerHighs.regular) */
  careerHighs: HighsSet | null | undefined;
  /** 팀 코드 a 에서 b 로 구단이 이어졌나 (매각으로 코드가 바뀐 경우, data/codes/team-lineage.json) */
  isSuccessor?: (fromCode: string, toCode: string) => boolean;
  /** 상대 팀 이름 (커리어 하이 보조 줄) */
  opponentName?: (teamCode: string, seasonCode: number | null) => string | null;
}

/**
 * 통산 이정표 간격 (타임라인 전용). 머리말 "다음 이정표"(lib/records MILESTONE_STEPS)보다 리바운드를 넓히고 스틸·블록·승리는 뺐다 —
 * 주전은 거의 매 시즌 100스틸을 넘어 줄이 지저분해진다. 한 시즌에 여러 번 넘으면 가장 큰 값 하나만.
 */
export const TIMELINE_MILESTONE_STEPS = [
  { key: "points", step: 1000, text: (n: string) => `${n}득점` },
  { key: "games", step: 100, text: (n: string) => `${n}경기` },
  { key: "reb", step: 1000, text: (n: string) => `${n}리바운드` },
  { key: "ast", step: 500, text: (n: string) => `${n}어시스트` },
  { key: "tpm", step: 100, text: (n: string) => `3점슛 ${n}개` },
] as const satisfies readonly { key: keyof TimelineSeasonInput; step: number; text: (n: string) => string }[];

/** 커리어 하이로 보여 줄 부문 (네 개만 — 타임라인이 길어지지 않게) */
export const TIMELINE_HIGH_KEYS: readonly { key: HighKey; text: (v: number) => string }[] = [
  { key: "pts", text: (v) => `${v}득점` },
  { key: "reb", text: (v) => `${v}리바운드` },
  { key: "ast", text: (v) => `${v}어시스트` },
  { key: "tpm", text: (v) => `3점슛 ${v}개` },
];

/** 처음 보이는 시즌 줄 수 (나머지는 "더 보기") */
export const TIMELINE_VISIBLE = 8;

const NF = new Intl.NumberFormat("ko-KR");

/** 받침 있는 한글로 끝나면 "으로", 아니면 "로" (ㄹ 받침도 "로"). 영문·숫자 팀 이름(DB·KT·SK)은 읽으면 모음으로 끝나 "로" */
export function withRo(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${word}로`;
  const jong = code % 28;
  return `${word}${jong === 0 || jong === 8 ? "로" : "으로"}`;
}

export function draftText(d: DraftInfo | null): string | null {
  if (!d || !d.year) return null;
  const parts = [`${d.year} 드래프트`];
  if (d.round) parts.push(`${d.round}라운드`);
  if (d.pick) parts.push(`${d.pick}순위`);
  return parts.join(" ");
}

/** 시즌마다 무슨 일이 있었나 — 일이 있는 시즌만, 오래된 시즌 먼저 */
export function careerTimeline(input: TimelineInput): TimelineSeason[] {
  const { seasons } = input;
  if (seasons.length === 0) return [];
  const items = new Map<number, TimelineItem[]>(seasons.map((s) => [s.seasonCode, []]));
  const push = (code: number, it: TimelineItem) => items.get(code)?.push(it);
  const order = new Map(input.allSeasonCodes.map((c, i) => [c, i]));

  // 데뷔·이적·복귀
  seasons.forEach((s, i) => {
    if (i === 0) {
      push(s.seasonCode, { kind: "debut", text: `${s.teamName}에서 데뷔`, sub: draftText(input.draft) });
      return;
    }
    const prev = seasons[i - 1];
    const gap = (order.get(s.seasonCode) ?? 0) - (order.get(prev.seasonCode) ?? 0);
    if (gap > 1) {
      push(s.seasonCode, { kind: "return", text: `${gap - 1}시즌 쉬고 복귀`, sub: s.teamCode === prev.teamCode ? null : `${withRo(s.teamName)} 옮김` });
    } else if (s.teamCode !== prev.teamCode) {
      if (input.isSuccessor?.(prev.teamCode, s.teamCode)) {
        push(s.seasonCode, { kind: "rename", text: `구단이 ${withRo(s.teamName)} 바뀜`, sub: `${prev.teamName} 인수` });
      } else {
        push(s.seasonCode, { kind: "move", text: `${withRo(s.teamName)} 이적`, sub: null });
      }
    }
  });

  // 우승·수상
  for (const c of input.championships ?? []) push(c, { kind: "champion", text: "챔피언결정전 우승", sub: null });
  const awardsBySeason = new Map<number, string[]>();
  for (const d of AWARD_LABELS) {
    for (const a of input.awards ?? []) {
      if (a.key !== d.key) continue;
      const list = awardsBySeason.get(a.seasonCode) ?? [];
      if (!list.includes(d.label)) list.push(d.label);
      awardsBySeason.set(a.seasonCode, list);
    }
  }
  for (const [code, labels] of awardsBySeason) push(code, { kind: "award", text: labels.join(" · "), sub: null });

  // 프라임 시즌
  if (input.primeSeason !== null) push(input.primeSeason, { kind: "prime", text: "프라임 시즌", sub: "종합 점수가 가장 높았던 시즌" });

  // 커리어 하이 (정규시즌) — 같은 경기(상대·날짜가 같음)에서 나온 부문은 한 줄로
  const highs = new Map<string, { seasonCode: number; texts: string[]; sub: string | null }>();
  for (const h of TIMELINE_HIGH_KEYS) {
    const r = input.careerHighs?.[h.key];
    if (!r || r.seasonCode === null || r.value <= 0) continue;
    const opp = r.opponentTeamCode ? input.opponentName?.(r.opponentTeamCode, r.seasonCode) : null;
    const sub = [opp ? `vs ${opp}` : null, r.date ? formatHighDate(r.date) : null].filter(Boolean).join(" ") || null;
    const key = `${r.seasonCode}|${sub ?? ""}`;
    const g = highs.get(key) ?? { seasonCode: r.seasonCode, texts: [], sub };
    g.texts.push(h.text(r.value));
    highs.set(key, g);
  }
  for (const g of highs.values()) push(g.seasonCode, { kind: "high", text: g.texts.join(" · "), sub: g.sub });

  // 통산 이정표 (그 시즌에 넘은 것, 부문마다 가장 큰 값 하나)
  const sum: Record<string, number> = {};
  for (const s of seasons) {
    const parts: string[] = [];
    for (const m of TIMELINE_MILESTONE_STEPS) {
      const was = sum[m.key] ?? 0;
      const now = was + s[m.key];
      sum[m.key] = now;
      const crossed = Math.floor(now / m.step);
      if (crossed > Math.floor(was / m.step)) parts.push(m.text(NF.format(crossed * m.step)));
    }
    if (parts.length) push(s.seasonCode, { kind: "milestone", text: `통산 ${parts.join(" · ")}`, sub: null });
  }

  const rank: Record<TimelineKind, number> = { debut: 0, return: 1, move: 2, rename: 3, champion: 4, award: 5, prime: 6, high: 7, milestone: 8 };
  return seasons
    .map((s) => ({
      seasonCode: s.seasonCode,
      season: seasonShortLabel(s.seasonLabel),
      teamCode: s.teamCode,
      teamName: s.teamName,
      items: [...(items.get(s.seasonCode) ?? [])].sort((a, b) => rank[a.kind] - rank[b.kind]),
    }))
    .filter((s) => s.items.length > 0);
}
