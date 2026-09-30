// 선수 검색 규칙 — 순수 함수만 둔다. 색인 만들기(buildSearchIndex)는 scripts/build-search-index.ts 가,
// 매칭(searchPlayers)은 상단 검색창(app/components/PlayerSearch)이 쓴다. 테스트: tests/search.test.ts

import { seasonShortLabel } from "./career";
import type { PlayerIndexEntry, SearchEntry } from "./types";

/** 비교용 정규화: 소문자 + 공백·마침표·하이픈·가운뎃점·작은따옴표 제거 ("Guy Terrance. Rucker" → "guyterrancerucker") */
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[\s.\-·'’]/g, "");
}

/**
 * 이름 매칭 점수 (작을수록 앞). 한글·영문 이름 중 더 잘 맞는 쪽으로:
 *  0 = 이름 전체 일치, 1 = 앞부분 일치, 2 = 영문 이름의 한 단어가 그 말로 시작, 3 = 중간 부분 일치, null = 불일치.
 * 공백은 무시한다 ("자밀워니" = "자밀 워니", "jameelwarney" = "Jameel Warney").
 */
export function matchScore(e: { nameKo: string; nameEn: string }, query: string): number | null {
  const q = normalizeName(query);
  if (!q) return null;
  let best: number | null = null;
  const take = (v: number) => {
    if (best === null || v < best) best = v;
  };
  for (const name of [e.nameKo, e.nameEn]) {
    const n = normalizeName(name);
    if (!n) continue;
    if (n === q) take(0);
    else if (n.startsWith(q)) take(1);
    else if (n.includes(q)) take(3);
  }
  // 영문 성·이름 어느 단어로 시작해도 앞쪽에 ("warney" → Jameel Warney)
  if (best === null || best > 2) {
    if (e.nameEn.toLowerCase().split(/[\s.\-]+/).some((w) => w && normalizeName(w).startsWith(q))) take(2);
  }
  return best;
}

/**
 * 검색: 매칭 점수 → 최근에 뛴 선수(마지막 시즌 코드 큰 순) → 한글 이름순 → 선수 번호순. 최대 limit 명.
 * 동명이인은 여러 명이 그대로 나오고, 화면이 "최근 팀 · 활동 기간"으로 구분해 보여준다.
 */
export function searchPlayers(entries: readonly SearchEntry[], query: string, limit = 10): SearchEntry[] {
  const hits: { e: SearchEntry; s: number }[] = [];
  for (const e of entries) {
    const s = matchScore(e, query);
    if (s !== null) hits.push({ e, s });
  }
  hits.sort(
    (a, b) => a.s - b.s || b.e.last - a.e.last || a.e.nameKo.localeCompare(b.e.nameKo, "ko") || a.e.id.localeCompare(b.e.id),
  );
  return hits.slice(0, limit).map((h) => h.e);
}

const GRAY = { primary: "#6B7280", text: "#fff" };

/**
 * 선수 색인(players-index.json) → 검색용 경량 색인. 시즌 라벨은 코드표(seasons.json)에서 받은 값을 짧게 바꿔 쓴다.
 * teamColor: (팀 코드, 시즌 코드) → 그 시즌 팀 색. 없으면 회색.
 */
export function buildSearchIndex(
  index: readonly PlayerIndexEntry[],
  seasonLabel: (seasonCode: number) => string,
  teamColor: (teamCode: string, seasonCode: number) => { primary: string; text: string } | undefined = () => undefined,
): SearchEntry[] {
  return index
    .filter((e) => e.seasons.length > 0)
    .map((e) => {
      const first = e.seasons[0];
      const last = e.seasons[e.seasons.length - 1];
      const c = teamColor(last.teamCode, last.seasonCode) ?? GRAY;
      return {
        id: e.id,
        nameKo: e.nameKo,
        nameEn: e.nameEn,
        team: last.teamShort,
        from: seasonShortLabel(seasonLabel(first.seasonCode)),
        to: seasonShortLabel(seasonLabel(last.seasonCode)),
        last: last.seasonCode,
        seasons: e.seasons.map((s) => s.seasonCode),
        photoUrl: e.photoUrl,
        // 선수 마스터 포지션 (옛 색인 파일이면 필드가 없을 수 있어 null)
        positionGroup: e.positionGroup ?? null,
        positionLabel: e.positionLabel ?? null,
        color: { primary: c.primary, text: c.text },
      };
    });
}

/** 검색 결과 한 줄의 활동 기간 표기: "2019-20 ~ 2025-26" (한 시즌이면 "2025-26") */
export function searchSpanLabel(e: { from: string; to: string }): string {
  return e.from === e.to ? e.from : `${e.from} ~ ${e.to}`;
}
