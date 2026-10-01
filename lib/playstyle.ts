// 플레이스타일 탭 (2026-10-01 사용자 요청 — 팀 분포 탭을 대신함) — 순수 함수만.
// 한 시즌의 표본 충족 선수를 "유형"별로 묶고, 유형 안에서 순위를 매긴다.
//   - 역할 유형: 플레이어 카드의 유형 라벨 (lib/glossary PLAYER_TYPES, lib/metrics playerType)
//   - 공격 유형: 슛 구역 비중으로 붙인 주 공격 유형 (lib/glossary OFFENSE_TYPES — 슛 차트가 있는 2006-07 이후만)
// 유형 안 순위 = 종합 점수(6축 가중 평균의 같은 국적 풀 안 백분위, 카드 종합 등급과 같은 값) 높은 순 → 같으면 PER → 이름.
import { seasonContext } from "./cardview";
import { buildCardEntry, gradeScore, perGame, type Grade } from "./metrics";
import { OFFENSE_TYPES, PLAYER_TYPES, type OffenseTypeKey, type PlayerTypeKey } from "./glossary";
import { nationalityOf } from "./roster";
import type { SeasonCards } from "./cards";
import type { Nationality, Position } from "./types";

export type StyleKind = "role" | "offense";
export type StyleOrigin = "all" | "domestic" | "foreign";

/** 한 선수 한 줄 (화면에 넘기는 최소 필드) */
export interface StyleRow {
  id: string;
  nameKo: string;
  teamCode: string;
  teamShort: string;
  photoUrl: string | null;
  position: Position | null;
  /** 국내 / 외국인(외국·아시아쿼터) — 국적 필터 */
  origin: "domestic" | "foreign";
  role: PlayerTypeKey;
  offense: OffenseTypeKey | null;
  grade: Grade | "-";
  /** 종합 점수 1~99 (gradeScore) */
  score: number | null;
  /** 정렬용 종합 백분위 */
  overallPct: number;
  per: number;
  ppg: number;
}

/** 시즌 카드 데이터 → 표본 충족 선수의 플레이스타일 줄 */
export function buildStyleRows(cards: SeasonCards): StyleRow[] {
  const ctx = seasonContext(cards, "all");
  const out: StyleRow[] = [];
  for (const p of cards.players) {
    const e = buildCardEntry(p, ctx);
    if (!e.qualified || e.overallPct === null) continue;
    const nat: Nationality = nationalityOf(p);
    out.push({
      id: p.id,
      nameKo: p.nameKo,
      teamCode: p.teamCode,
      teamShort: p.teamShort,
      photoUrl: p.photoUrl,
      position: p.position,
      origin: nat === "domestic" ? "domestic" : "foreign",
      role: e.type.key,
      offense: p.offenseType ?? null,
      grade: e.overall,
      score: gradeScore(e.overallPct),
      overallPct: e.overallPct,
      per: p.per,
      ppg: perGame(p.points, p.games),
    });
  }
  return out;
}

export interface StyleGroup {
  key: string;
  label: string;
  /** 유형 한 줄 설명 */
  short: string;
  rows: StyleRow[];
}

const byRank = (a: StyleRow, b: StyleRow) =>
  b.overallPct - a.overallPct || b.per - a.per || a.nameKo.localeCompare(b.nameKo, "ko") || a.id.localeCompare(b.id);

/** 유형별 묶음 (유형 정의 순서, 선수 0명 유형은 뺀다). 국적 필터를 먼저 적용 */
export function groupStyles(rows: readonly StyleRow[], kind: StyleKind, origin: StyleOrigin = "all"): StyleGroup[] {
  const pool = rows.filter((r) => origin === "all" || r.origin === origin);
  const defs =
    kind === "role"
      ? PLAYER_TYPES.filter((t) => t.key !== "unknown").map((t) => ({ key: t.key as string, label: t.label, short: t.short }))
      : OFFENSE_TYPES.map((t) => ({ key: t.key as string, label: t.label, short: t.short }));
  return defs
    .map((d) => ({ ...d, rows: pool.filter((r) => (kind === "role" ? r.role : r.offense) === d.key).sort(byRank) }))
    .filter((g) => g.rows.length > 0);
}

/** 상위 몇 명을 프로필 카드로 크게 보여 주는가 (나머지는 "더 보기") */
export const STYLE_TOP = 10;

/** 주소 쿼리 ?kind=offense&type=shooter&origin=domestic (기본값은 생략) */
export interface StyleQuery {
  kind: StyleKind;
  type: string | null;
  origin: StyleOrigin;
}

export function parseStyleQuery(search: string): StyleQuery {
  const q = new URLSearchParams(search);
  const kind = q.get("kind") === "offense" ? "offense" : "role";
  const o = q.get("origin");
  return { kind, type: q.get("type"), origin: o === "domestic" || o === "foreign" ? o : "all" };
}

export function styleQueryString(s: StyleQuery): string {
  const q = new URLSearchParams();
  if (s.kind !== "role") q.set("kind", s.kind);
  if (s.type) q.set("type", s.type);
  if (s.origin !== "all") q.set("origin", s.origin);
  const t = q.toString();
  return t ? `?${t}` : "";
}
