// 54-0 게임 후보 풀 만들기 (scripts/build-game.ts 가 빌드 전에 부른다 — 브라우저는 결과 파일만 받는다). 순수 함수만.
// 시즌 카드 데이터(public/cards 와 같은 값) → 시대 구간 7개 × 팀 × 후보 선수.
//   - 후보: 표본 기준(카드 기본값 10경기·100분)을 넘기고 포지션이 있는 선수
//   - 같은 구간·같은 팀에 여러 시즌 뛰었으면 종합 점수가 가장 높은 시즌 하나 (82-0 의 "그 연대 최고 시즌")
//   - 점수·축은 카드와 같은 계산 (lib/metrics buildCardEntry — 같은 국적 풀 안 백분위)
import { seasonContext } from "./cardview";
import { seasonShortLabel, seasonRangeLabel } from "./career";
import { buildCardEntry, gradeScore, isQualified, perGame, RADAR_AXES } from "./metrics";
import { nationalityOf } from "./roster";
import { splitEras, type GameCandidate, type GameEra, type GamePool, type GameTeam } from "./game";
import type { SeasonCards } from "./cards";

const r1 = (v: number) => Math.round(v * 10) / 10;

/** 시즌 카드들(순서 무관) → 게임 풀 */
export function buildGamePool(all: readonly SeasonCards[]): GamePool {
  const seasons = [...all].filter((c) => c.players.length > 0).sort((a, b) => a.seasonCode - b.seasonCode);
  const eras: GameEra[] = splitEras(seasons).map((chunk, index) => {
    const teams = new Map<string, GameTeam>();
    const best = new Map<string, GameCandidate>(); // 팀|선수 → 후보
    for (const cards of chunk) {
      const ctx = seasonContext(cards, "all");
      for (const t of cards.teams) {
        // 구간 마지막 시즌의 이름·로고로 (오래된 순으로 돌며 덮어쓴다)
        const prev = teams.get(t.teamCode);
        teams.set(t.teamCode, { teamCode: t.teamCode, name: t.shortName, logoUrl: t.logoUrl, color: t.color, candidates: prev?.candidates ?? [] });
      }
      for (const p of cards.players) {
        if (!p.position || !isQualified(p, cards.defaults.rule)) continue;
        const e = buildCardEntry(p, ctx);
        const score = gradeScore(e.overallPct);
        if (score === null) continue;
        const c: GameCandidate = {
          id: p.id,
          nameKo: p.nameKo,
          seasonCode: cards.seasonCode,
          season: seasonShortLabel(cards.seasonLabel),
          position: p.position,
          foreign: nationalityOf(p) !== "domestic",
          photoUrl: p.photoUrl,
          score,
          axes: RADAR_AXES.map((a) => Math.round(e.pct[a] ?? 0)),
          ppg: r1(perGame(p.points, p.games)),
          rpg: r1(perGame(p.reb, p.games)),
          apg: r1(perGame(p.ast, p.games)),
        };
        const key = `${p.teamCode}|${p.id}`;
        const b = best.get(key);
        if (!b || c.score > b.score || (c.score === b.score && c.seasonCode > b.seasonCode)) best.set(key, c);
      }
    }
    for (const [key, c] of best) teams.get(key.split("|")[0])?.candidates.push(c);
    return {
      index,
      label: seasonRangeLabel(chunk[0].seasonLabel, chunk[chunk.length - 1].seasonLabel),
      seasonCodes: chunk.map((c) => c.seasonCode),
      teams: [...teams.values()]
        .filter((t) => t.candidates.length > 0)
        .map((t) => ({ ...t, candidates: t.candidates.sort((a, b) => b.score - a.score || b.ppg - a.ppg) }))
        .sort((a, b) => a.name.localeCompare(b.name, "ko")),
    };
  });
  return { eras };
}
