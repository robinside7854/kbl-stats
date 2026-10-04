// 54-0 게임 후보 풀 만들기 (scripts/build-game.ts 가 빌드 전에 부른다 — 브라우저는 결과 파일만 받는다). 순수 함수만.
// 시즌 카드 데이터(public/cards 와 같은 값) → 시즌 × 팀 × 후보 선수 (2026-10-02 부터 구간 = 시즌 하나).
//   - 후보: 표본 기준(카드 기본값 10경기·100분)을 넘기고 포지션이 있는 선수
//   - 점수·축은 카드와 같은 계산 (lib/metrics buildCardEntry — 같은 국적 풀 안 백분위). 화면에는 안 보인다
//   - 화면에 보이는 기록(경기당 득점·리바·어시·스틸·블록·3점%)은 그 시즌 기록
//   - 아래 합산 코드는 구간이 여러 시즌이던 때(시대 구간 7개)의 것 — 한 시즌이면 평균 = 그 시즌 값, span = 그 시즌 표기
import { seasonContext } from "./cardview";
import { seasonShortLabel, seasonRangeLabel } from "./career";
import { DEFAULT_QUALIFY, buildCardEntry, gradeScore, isQualified, perGame, RADAR_AXES } from "./metrics";
import { nationalityOf } from "./roster";
import { type GameCandidate, type GameEra, type GamePool, type GameTeam } from "./game";
import type { SeasonCards } from "./cards";

const r1 = (v: number) => Math.round(v * 10) / 10;

/** 가산점 재료 (scripts/build-game.ts 가 processed 에서 모은다). 없으면 가산점 없음 */
export interface GamePoolExtras {
  /** 선수 번호 → 출신교 묶음 (해외·정보 없음은 넣지 않는다) */
  schools?: ReadonlyMap<string, string>;
  /** 선수 번호 → 프라임 시즌 코드 (lib/prime pickPrimeSeasons) */
  primes?: ReadonlyMap<string, number>;
  /** 시즌 코드 → 정규리그 1위 팀 코드들 (공동 1위면 둘) */
  regularChampions?: ReadonlyMap<number, ReadonlySet<string>>;
}

/**
 * 정규리그 1위 팀: 경기 결과 순위(lib/games computeStandings)에서 승률·승이 같은 맨 위 팀들 중
 * 공식 1위 이름(수상 표 seasonAwards.regular.first, 예: "모비스" · "공동1위\n원주DB 서울SK")에 들어간 팀.
 * 동률인데 공식 이름이 없거나 아무 팀도 안 맞으면 동률 팀 전부(공동 1위로 본다). 공식 이름이 없는 시즌(진행 중)은 빈 배열.
 */
export function pickRegularChampions(
  top: readonly { teamCode: string; names: readonly string[] }[],
  officialFirst: string | null | undefined,
): string[] {
  if (!officialFirst || top.length === 0) return [];
  if (top.length === 1) return [top[0].teamCode];
  const norm = (v: string) => v.replace(/\s+/g, "");
  const official = norm(officialFirst);
  const hit = top.filter((t) => t.names.some((n) => n && (official.includes(norm(n)) || norm(n).includes(official))));
  return (hit.length > 0 ? hit : top).map((t) => t.teamCode);
}

/** 시즌 카드들(순서 무관) → 게임 풀 */
export function buildGamePool(all: readonly SeasonCards[], extras: GamePoolExtras = {}): GamePool {
  const seasons = [...all].filter((c) => c.players.length > 0).sort((a, b) => a.seasonCode - b.seasonCode);
  const eras: GameEra[] = seasons.map((c) => [c]).map((chunk, index) => {
    const teams = new Map<string, GameTeam>();
    const best = new Map<string, GameCandidate>(); // 팀|선수 → 후보 (점수 최고 시즌)
    const totals = new Map<string, { games: number; pts: number; reb: number; ast: number; stl: number; blk: number; tpm: number; tpa: number; labels: string[] }>();
    for (const cards of chunk) {
      const ctx = seasonContext(cards, "all");
      for (const t of cards.teams) {
        // 구간 마지막 시즌의 이름·로고로 (오래된 순으로 돌며 덮어쓴다)
        const prev = teams.get(t.teamCode);
        teams.set(t.teamCode, { teamCode: t.teamCode, name: t.shortName, logoUrl: t.logoUrl, color: t.color, candidates: prev?.candidates ?? [] });
      }
      for (const p of cards.players) {
                // 진행 중 시즌의 1~2경기 표본은 후보에서 뺀다 (항상 기본 기준)
if (!p.position || !isQualified(p, DEFAULT_QUALIFY)) continue;
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
          spg: r1(perGame(p.stl, p.games)),
          bpg: r1(perGame(p.blk, p.games)),
          tpPct: p.tpa > 0 ? r1((p.tpm / p.tpa) * 100) : null,
          span: seasonShortLabel(cards.seasonLabel),
          seasonCount: 1,
          school: extras.schools?.get(p.id) ?? null,
          prime: extras.primes?.get(p.id) === cards.seasonCode,
          regularChamp: extras.regularChampions?.get(cards.seasonCode)?.has(p.teamCode) ?? false,
        };
        const key = `${p.teamCode}|${p.id}`;
        const t = totals.get(key) ?? { games: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0, tpa: 0, labels: [] };
        t.games += p.games;
        t.pts += p.points;
        t.reb += p.reb;
        t.ast += p.ast;
        t.stl += p.stl;
        t.blk += p.blk;
        t.tpm += p.tpm;
        t.tpa += p.tpa;
        t.labels.push(cards.seasonLabel);
        totals.set(key, t);
        const b = best.get(key);
        if (!b || c.score > b.score || (c.score === b.score && c.seasonCode > b.seasonCode)) best.set(key, c);
      }
    }
    for (const [key, c] of best) {
      const t = totals.get(key)!;
      teams.get(key.split("|")[0])?.candidates.push({
        ...c,
        ppg: r1(perGame(t.pts, t.games)),
        rpg: r1(perGame(t.reb, t.games)),
        apg: r1(perGame(t.ast, t.games)),
        spg: r1(perGame(t.stl, t.games)),
        bpg: r1(perGame(t.blk, t.games)),
        tpPct: t.tpa > 0 ? r1((t.tpm / t.tpa) * 100) : null,
        span: seasonRangeLabel(t.labels[0], t.labels[t.labels.length - 1]),
        seasonCount: t.labels.length,
      });
    }
    return {
      index,
      label: seasonRangeLabel(chunk[0].seasonLabel, chunk[chunk.length - 1].seasonLabel),
      seasonCodes: chunk.map((c) => c.seasonCode),
      teams: [...teams.values()]
        .filter((t) => t.candidates.length > 0)
        .map((t) => ({ ...t, candidates: t.candidates.sort((a, b) => b.ppg - a.ppg || a.nameKo.localeCompare(b.nameKo, "ko")) }))
        .sort((a, b) => a.name.localeCompare(b.name, "ko")),
    };
  });
  return { eras };
}
