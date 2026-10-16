// 우리 팀 올타임 베스트 5 (2026-10-16 "우리만의 기능"): 팀 페이지에서 그 팀을 거친 선수로 주전 다섯 명을 뽑는다. 순수 함수만.
// 자리는 54-0 과 같다(가드 2·포워드 2·센터 1, GF·FC 는 두 칸, 외국 선수 2명까지 — lib/game).
// 선수마다 "이 팀에서의 최고 시즌" 한 시즌(종합 점수 = 카드와 같은 계산, 같은 국적 풀 안 백분위)으로 보여 준다.
// 후보 파일은 빌드 때 팀마다 하나(/team-best/{팀코드}.json) — 재료는 lib/data-career-extra, 화면 app/components/TeamBestFive.
import { GAME_FOREIGN_MAX, GAME_SLOTS, slotGroupsFor, type SlotGroup } from "./game";
import { seasonRangeLabel, seasonShortLabel } from "./career";
import type { Position } from "./types";

/** 이 팀에서 이만큼 뛴 선수만 후보 (파일 크기·의미 둘 다 — 잠깐 거쳐 간 선수는 뺀다) */
export const TEAM_BEST_MIN_GAMES = 30;
/** 처음 보이는 후보 수 */
export const TEAM_BEST_VISIBLE = 12;

export interface BestCandidate {
  id: string;
  name: string;
  photoUrl: string | null;
  position: Position;
  /** 외국 선수 (아시아쿼터는 false — 54-0 과 같다) */
  foreign: boolean;
  /** 이 팀에서의 최고 시즌 */
  seasonCode: number;
  /** "08-09" */
  season: string;
  /** 그 시즌 종합 점수 1~99 */
  score: number;
  /** 그 시즌 경기당 */
  ppg: number;
  rpg: number;
  apg: number;
  /** 이 팀 통산 경기 수·시즌 수·기간 "04-20" */
  games: number;
  seasons: number;
  span: string;
}

export interface TeamBestFile {
  teamCode: string;
  candidates: BestCandidate[];
}

/** 시즌 한 줄 재료 (선수 × 시즌 × 팀) — score 는 표본 기준을 못 넘었으면 null */
export interface TeamBestSeasonRow {
  teamCode: string;
  id: string;
  name: string;
  photoUrl: string | null;
  position: Position | null;
  foreign: boolean;
  seasonCode: number;
  seasonLabel: string;
  games: number;
  points: number;
  reb: number;
  ast: number;
  score: number | null;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * 시즌 줄 → 팀 코드마다 후보 목록. 후보 = 그 팀 통산 TEAM_BEST_MIN_GAMES 경기 이상 + 포지션 있음 + 점수 있는 시즌이 하나 이상.
 * 최고 시즌 = 점수가 가장 높은 시즌(같으면 최근). 후보는 점수 높은 순(같으면 경기 많은 순)
 */
export function buildTeamBest(rows: readonly TeamBestSeasonRow[]): Map<string, BestCandidate[]> {
  type Acc = { best: TeamBestSeasonRow | null; games: number; labels: { code: number; label: string }[]; last: TeamBestSeasonRow };
  const acc = new Map<string, Acc>();
  for (const r of [...rows].sort((a, b) => a.seasonCode - b.seasonCode)) {
    if (r.games <= 0) continue;
    const key = `${r.teamCode}|${r.id}`;
    const a = acc.get(key) ?? { best: null, games: 0, labels: [], last: r };
    a.games += r.games;
    a.labels.push({ code: r.seasonCode, label: r.seasonLabel });
    a.last = r;
    if (r.score !== null && (!a.best || a.best.score === null || r.score >= a.best.score)) a.best = r;
    acc.set(key, a);
  }
  const out = new Map<string, BestCandidate[]>();
  for (const [key, a] of acc) {
    const b = a.best;
    const position = a.last.position ?? b?.position ?? null;
    if (!b || b.score === null || !position || a.games < TEAM_BEST_MIN_GAMES) continue;
    const teamCode = key.split("|")[0];
    const list = out.get(teamCode) ?? [];
    list.push({
      id: b.id,
      name: a.last.name,
      photoUrl: a.last.photoUrl ?? b.photoUrl,
      position,
      foreign: a.last.foreign,
      seasonCode: b.seasonCode,
      season: seasonShortLabel(b.seasonLabel),
      score: b.score,
      ppg: r1(b.points / b.games),
      rpg: r1(b.reb / b.games),
      apg: r1(b.ast / b.games),
      games: a.games,
      seasons: a.labels.length,
      span: seasonRangeLabel(a.labels[0].label, a.labels[a.labels.length - 1].label),
    });
    out.set(teamCode, list);
  }
  for (const list of out.values()) list.sort((x, y) => y.score - x.score || y.games - x.games || x.name.localeCompare(y.name, "ko"));
  return out;
}

export const teamBestFileUrl = (teamCode: string) => `/team-best/${teamCode}.json`;

// ─────────────────────────────────────────────
// 다섯 칸 (54-0 과 같은 자리 규칙)

export type BestLineup = (BestCandidate | null)[];
export const emptyBestLineup = (): BestLineup => GAME_SLOTS.map(() => null);

export function bestOpenSlots(lineup: BestLineup, c: Pick<BestCandidate, "position">): number[] {
  const groups = slotGroupsFor(c.position);
  return GAME_SLOTS.flatMap((g, i) => (lineup[i] === null && groups.includes(g) ? [i] : []));
}

const foreignIn = (lineup: BestLineup) => lineup.filter((p) => p?.foreign).length;

/** 못 넣는 까닭 (넣을 수 있으면 null) */
export function bestBlockReason(lineup: BestLineup, c: BestCandidate): string | null {
  if (lineup.some((p) => p?.id === c.id)) return "이미 뽑음";
  if (c.foreign && foreignIn(lineup) >= GAME_FOREIGN_MAX) return `외국 선수 ${GAME_FOREIGN_MAX}명 다 참`;
  if (bestOpenSlots(lineup, c).length === 0) return "자리 다 참";
  return null;
}

/** 맞는 첫 빈칸에 넣는다. 못 넣으면 그대로 */
export function placeBest(lineup: BestLineup, c: BestCandidate): BestLineup {
  if (bestBlockReason(lineup, c)) return lineup;
  const slot = bestOpenSlots(lineup, c)[0];
  const next = lineup.slice();
  next[slot] = c;
  return next;
}

export const isBestFull = (lineup: BestLineup) => lineup.every((p) => p !== null);

/** 위치 필터 칩: 전체 / 가드 / 포워드 / 센터 (GF·FC 는 두 칩에 다 나온다) */
export type BestPosChip = "all" | SlotGroup;
export function filterBestByPos(cs: readonly BestCandidate[], chip: BestPosChip): BestCandidate[] {
  return chip === "all" ? [...cs] : cs.filter((c) => slotGroupsFor(c.position).includes(chip));
}

/** 공유 주소 값 "번호:시즌,번호:시즌,…" (칸 순서). 다 차지 않았으면 "" */
export function encodeBestParam(lineup: BestLineup): string {
  return isBestFull(lineup) ? lineup.map((p) => `${p!.id}:${p!.seasonCode}`).join(",") : "";
}

/**
 * 주소 값 → 라인업. 선수는 번호로 찾는다(시즌은 참고 — 데이터가 바뀌어 최고 시즌이 달라져도 그 선수는 살린다).
 * 다섯 명이 아니거나, 없는 선수·같은 선수 두 번·칸에 안 맞는 포지션·외국 선수 한도 초과면 null
 */
export function decodeBestParam(cs: readonly BestCandidate[], value: string | null): BestLineup | null {
  if (!value) return null;
  const ids = value.split(",").map((v) => v.split(":")[0]?.trim());
  if (ids.length !== GAME_SLOTS.length) return null;
  const byId = new Map(cs.map((c) => [c.id, c]));
  const lineup = emptyBestLineup();
  for (let i = 0; i < ids.length; i++) {
    const c = byId.get(ids[i] ?? "");
    if (!c || lineup.some((p) => p?.id === c.id)) return null;
    if (!slotGroupsFor(c.position).includes(GAME_SLOTS[i])) return null;
    lineup[i] = c;
  }
  if (foreignIn(lineup) > GAME_FOREIGN_MAX) return null;
  return lineup;
}

/** 다섯 명 경기당 합계·평균 종합 점수 */
export function bestTotals(players: readonly BestCandidate[]): { ppg: number; rpg: number; apg: number; avgScore: number } {
  const sum = (k: "ppg" | "rpg" | "apg") => r1(players.reduce((s, p) => s + p[k], 0));
  return {
    ppg: sum("ppg"),
    rpg: sum("rpg"),
    apg: sum("apg"),
    avgScore: players.length ? Math.round(players.reduce((s, p) => s + p.score, 0) / players.length) : 0,
  };
}
