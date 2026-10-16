// 빌드 시점(서버) 재료 모으기 — 2026-10-16 "우리만의 기능": 선수 커리어 타임라인 · 슛 습관의 변화 · 팀 올타임 베스트 5.
// 규칙은 lib/timeline · lib/shot-habit · lib/team-best (순수 함수), 여기는 data/processed 를 lib/data 로 읽어 넘기기만.
import "server-only";
import teamLineage from "@/data/codes/team-lineage.json";
import type { PlayerCareer } from "./types";
import { listSeasonsWithPlayers, loadPrimeSeason, loadSeasonCards, loadSeasonData, teamNameInSeason } from "./data";
import { careerTimeline, type TimelineSeason } from "./timeline";
import { shotHabitRows, type ShotHabitRow } from "./shot-habit";
import { buildTeamBest, type BestCandidate, type TeamBestSeasonRow } from "./team-best";
import { seasonContext } from "./cardview";
import { DEFAULT_QUALIFY, buildCardEntry, gradeScore, isQualified } from "./metrics";
import { nationalityOf } from "./roster";

const successor = (teamLineage as { successor: Record<string, string> }).successor;

/** 선수 커리어 타임라인 (일이 있는 시즌만, 오래된 시즌 먼저) */
export function loadCareerTimeline(career: PlayerCareer): TimelineSeason[] {
  const { entry, seasons } = career;
  return careerTimeline({
    seasons: seasons.map((s) => ({
      seasonCode: s.seasonCode,
      seasonLabel: s.seasonLabel,
      teamCode: s.teamCode,
      teamName: s.team?.shortName ?? s.teamShort,
      games: s.games,
      points: s.points,
      reb: s.reb,
      ast: s.ast,
      stl: s.stl,
      blk: s.blk,
      tpm: s.tpm,
    })),
    allSeasonCodes: listSeasonsWithPlayers().map((s) => s.seasonCode).sort((a, b) => a - b),
    draft: entry.draft,
    awards: entry.awards,
    championships: entry.championships,
    primeSeason: loadPrimeSeason(entry.id),
    careerHighs: entry.careerHighs?.regular ?? null,
    isSuccessor: (from, to) => successor[from] === to,
    opponentName: (code, season) => teamNameInSeason(code, season),
  });
}

/** 슛 습관의 변화: 시즌 파일의 그 선수 shotZones (슛 50개 이상 시즌만) */
export function loadShotHabits(career: PlayerCareer): ShotHabitRow[] {
  return shotHabitRows(
    career.seasons.map((s) => ({
      seasonCode: s.seasonCode,
      seasonLabel: s.seasonLabel,
      shotZones: loadSeasonData(s.seasonCode)?.players.find((p) => p.playerNo === career.entry.id)?.shotZones ?? null,
    })),
  );
}

let teamBestCache: Map<string, BestCandidate[]> | null = null;

/** 팀 코드 → 올타임 베스트 5 후보 (전 시즌을 한 번 훑는다 — 점수는 카드와 같은 계산) */
export function loadTeamBest(teamCode: string): BestCandidate[] {
  if (!teamBestCache) {
    const rows: TeamBestSeasonRow[] = [];
    for (const s of listSeasonsWithPlayers()) {
      const cards = loadSeasonCards(s.seasonCode);
      if (!cards) continue;
      const ctx = seasonContext(cards, "all");
      for (const p of cards.players) {
        const score = isQualified(p, DEFAULT_QUALIFY) ? gradeScore(buildCardEntry(p, ctx).overallPct) : null;
        rows.push({
          teamCode: p.teamCode,
          id: p.id,
          name: p.nameKo,
          photoUrl: p.photoUrl,
          position: p.position,
          foreign: nationalityOf(p) === "foreign",
          seasonCode: cards.seasonCode,
          seasonLabel: cards.seasonLabel,
          games: p.games,
          points: p.points,
          reb: p.reb,
          ast: p.ast,
          score,
        });
      }
    }
    teamBestCache = buildTeamBest(rows);
  }
  return teamBestCache.get(teamCode) ?? [];
}
