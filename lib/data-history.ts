// 기록 메뉴 "리그 변화"·"드래프트"·"외국 선수" 탭 재료 (2026-10-16) — 빌드 시점(서버)에서 data/processed 를 읽는다.
// 규칙은 lib/trends·lib/draft·lib/hall (순수 함수), 여기는 파일을 읽어 화면에 넘길 최소 필드로 바꾸기만 한다.
import "server-only";
import type { PlayerIndexEntry, TeamColor } from "./types";
import {
  findPlayerIndexEntry,
  isSeasonOngoing,
  listAllSeasons,
  listSeasonsWithPlayers,
  loadCareerTotals,
  loadPlayersIndex,
  loadSeasonData,
  loadSeasonGames,
} from "./data";
import { seasonRangeLabel, seasonShortLabel, teamStints } from "./career";
import { FALLBACK_TEAM_COLOR } from "./teams";
import { leagueTrendRow, type LeagueTrendRow } from "./trends";
import { draftClassHonors, draftOrder, draftYears, hasDuplicatePicks, pickShort, type DraftHonorRow } from "./draft";
import { hallReasons, honorChips, rankForeignSeasons, type HallReason, type HonorChip } from "./hall";
import { isActiveCareer, seasonBestMinGames, type CareerTotal } from "./records";
import type { PlayerAward } from "./types";

// ─────────────────────────────────────────────
// 공용
// ─────────────────────────────────────────────

/** 그 시즌 팀 색 (시즌 파일 teams). 없으면 회색 */
function teamColorIn(seasonCode: number, teamCode: string): TeamColor {
  return loadSeasonData(seasonCode)?.teams.find((t) => t.teamCode === teamCode)?.color ?? { ...FALLBACK_TEAM_COLOR };
}

/** 그 시즌 팀 로고 주소 (없으면 null) */
function teamLogoIn(seasonCode: number, teamCode: string): string | null {
  return loadSeasonData(seasonCode)?.teams.find((t) => t.teamCode === teamCode)?.logoUrl ?? null;
}

/** 선수의 마지막 시즌 팀 (색인 seasons 의 끝) */
function lastStint(e: PlayerIndexEntry): { seasonCode: number; teamCode: string; teamShort: string } | null {
  const s = e.seasons[e.seasons.length - 1];
  return s ? { seasonCode: s.seasonCode, teamCode: s.teamCode, teamShort: s.teamShort } : null;
}

let totalsById: Map<string, CareerTotal> | null = null;
function careerTotalOf(id: string): CareerTotal | null {
  if (!totalsById) totalsById = new Map(loadCareerTotals().map((t) => [t.id, t]));
  return totalsById.get(id) ?? null;
}

const latestCode = () => listSeasonsWithPlayers()[0]?.seasonCode ?? 0;
const per = (v: number, g: number) => (g > 0 ? Math.round((v / g) * 10) / 10 : 0);

// ─────────────────────────────────────────────
// 리그 변화 (lib/trends)
// ─────────────────────────────────────────────

/** 시즌 오름차순 리그 지표 (선수 있는 시즌만) */
export function loadLeagueTrends(): LeagueTrendRow[] {
  const out: LeagueTrendRow[] = [];
  for (const s of [...listSeasonsWithPlayers()].reverse()) {
    const season = loadSeasonData(s.seasonCode);
    if (!season) continue;
    const games = loadSeasonGames(s.seasonCode);
    const row = leagueTrendRow({
      seasonCode: season.seasonCode,
      seasonLabel: season.seasonLabel,
      endedGames: games.length > 0 ? games.filter((g) => g.ended).length : null,
      ongoing: isSeasonOngoing(season.seasonCode),
      players: season.players.map((p) => ({
        points: p.points,
        fga: p.fga,
        tpm: p.tpm,
        tpa: p.tpa,
        fta: p.fta,
        minutes: p.minutes,
        foreign: p.isForeign,
        heightCm: p.heightCm ?? findPlayerIndexEntry(p.playerNo)?.heightCm ?? null,
      })),
    });
    if (row) out.push(row);
  }
  return out;
}

// ─────────────────────────────────────────────
// 드래프트 (lib/draft)
// ─────────────────────────────────────────────

export interface DraftPlayerView {
  id: string;
  nameKo: string;
  photoUrl: string | null;
  color: TeamColor;
  round: number | null;
  pick: number | null;
  /** "1-3" */
  pickText: string;
  /** 뛴 시즌 수·구간("15-25") */
  seasons: number;
  span: string;
  lastTeam: string;
  active: boolean;
  games: number;
  ppg: number;
  rpg: number;
  apg: number;
  chips: HonorChip[];
}

export interface DraftYearData {
  year: number;
  /** 실제 지명 순 */
  players: DraftPlayerView[];
  /** 같은 라운드·순위가 둘씩 있는 해 (드래프트가 두 번 열림) */
  duplicate: boolean;
  /** 그 해 지명 선수들의 우승·수상 합계 (lib/draft draftClassHonors) */
  honors: DraftHonorRow[];
}

let draftCache: Map<number, DraftYearData> | null = null;

/** 드래프트 기록이 있는 연도 (최신 먼저) */
export function loadDraftYears(): number[] {
  return draftYears(loadPlayersIndex());
}

/** 연도별 드래프트 결과 (없는 연도면 null) */
export function loadDraftYear(year: number): DraftYearData | null {
  if (!draftCache) draftCache = new Map();
  if (draftCache.has(year)) return draftCache.get(year)!;
  const latest = latestCode();
  const entries = loadPlayersIndex().filter((e) => e.draft?.year === year);
  if (entries.length === 0) return null;
  const rows = entries.map((e) => {
    const t = careerTotalOf(e.id);
    return {
      e,
      t,
      id: e.id,
      round: e.draft!.round,
      pick: e.draft!.pick,
      games: t?.games ?? 0,
      points: t?.points ?? 0,
      reb: t?.reb ?? 0,
      ast: t?.ast ?? 0,
      stl: t?.stl ?? 0,
      blk: t?.blk ?? 0,
    };
  });
  const players: DraftPlayerView[] = draftOrder(rows).map((row) => {
      const { e, t } = row;
      const last = lastStint(e);
      return {
        id: e.id,
        nameKo: e.nameKo,
        photoUrl: e.photoUrl,
        color: last ? teamColorIn(last.seasonCode, last.teamCode) : { ...FALLBACK_TEAM_COLOR },
        round: row.round,
        pick: row.pick,
        pickText: pickShort(row.round, row.pick),
        seasons: e.seasons.length,
        span: t ? seasonRangeLabel(t.firstLabel, t.lastLabel) : "",
        lastTeam: last?.teamShort ?? "",
        active: t ? isActiveCareer(t, latest) : false,
        games: row.games,
        ppg: per(row.points, row.games),
        rpg: per(row.reb, row.games),
        apg: per(row.ast, row.games),
        chips: honorChips(e.awards, e.championships),
      };
    });
  const data: DraftYearData = {
    year,
    players,
    duplicate: hasDuplicatePicks(rows),
    honors: draftClassHonors(entries),
  };
  draftCache.set(year, data);
  return data;
}

// ─────────────────────────────────────────────
// 외국 선수 명예의 전당 (lib/hall)
// ─────────────────────────────────────────────

/** 거쳐 간 팀 하나 (같은 팀에 두 번 이상 있었으면 한 줄로 묶고 구간을 모두 적는다 — 2026-10-16 사용자: 점 대신 로고) */
export interface HallTeam {
  teamCode: string;
  teamShort: string;
  color: TeamColor;
  logoUrl: string | null;
  /** 그 팀에서 뛴 시즌 수 합 */
  seasons: number;
  /** ["08-12", "15-16"] */
  ranges: string[];
}

export interface HallMemberView {
  id: string;
  nameKo: string;
  photoUrl: string | null;
  color: TeamColor;
  seasons: number;
  span: string;
  active: boolean;
  games: number;
  points: number;
  ppg: number;
  rpg: number;
  apg: number;
  chips: HonorChip[];
  reasons: HallReason[];
  /** 처음 뛴 순서 */
  teams: HallTeam[];
  /** 정렬용 (lib/hall sortHall) */
  awards: PlayerAward[];
  championships: number[];
}

export interface ForeignSeasonView {
  rank: number;
  id: string;
  nameKo: string;
  photoUrl: string | null;
  color: TeamColor;
  seasonShort: string;
  teamShort: string;
  games: number;
  ppg: number;
  rpg: number;
  apg: number;
  /** 경기당 득+리+어 */
  value: number;
}

export interface ForeignHallData {
  members: HallMemberView[];
  /** 외국 선수(국적 '외국') 가운데 KBL 에 기록이 있는 선수 수 */
  pool: number;
  seasons: ForeignSeasonView[];
}

let hallCache: ForeignHallData | null = null;

export function loadForeignHall(): ForeignHallData {
  if (hallCache) return hallCache;
  const latest = latestCode();
  const labelOf = new Map(listAllSeasons().map((s) => [s.seasonCode, s.seasonLabel]));
  const foreign = loadPlayersIndex().filter((e) => e.nationality === "foreign");
  const members: HallMemberView[] = [];
  let pool = 0;
  for (const e of foreign) {
    const t = careerTotalOf(e.id);
    if (!t) continue;
    pool++;
    const awards = e.awards ?? [];
    const reasons = hallReasons({ id: e.id, seasons: t.seasons, games: t.games, points: t.points, awards });
    if (reasons.length === 0) continue;
    const last = lastStint(e);
    const teams: HallTeam[] = [];
    for (const st of teamStints(e.seasons.map((s) => ({ teamCode: s.teamCode, seasonLabel: labelOf.get(s.seasonCode) ?? String(s.seasonCode) })))) {
      const seasonOf = e.seasons.find((s) => s.teamCode === st.teamCode && (labelOf.get(s.seasonCode) ?? "") === st.toLabel);
      const range = seasonRangeLabel(st.fromLabel, st.toLabel);
      const had = teams.find((t) => t.teamCode === st.teamCode);
      if (had) {
        had.seasons += st.seasons;
        had.ranges.push(range);
        continue;
      }
      teams.push({
        teamCode: st.teamCode,
        teamShort: seasonOf?.teamShort ?? "",
        color: seasonOf ? teamColorIn(seasonOf.seasonCode, st.teamCode) : { ...FALLBACK_TEAM_COLOR },
        logoUrl: seasonOf ? teamLogoIn(seasonOf.seasonCode, st.teamCode) : null,
        seasons: st.seasons,
        ranges: [range],
      });
    }
    members.push({
      id: e.id,
      nameKo: e.nameKo,
      photoUrl: e.photoUrl,
      color: last ? teamColorIn(last.seasonCode, last.teamCode) : { ...FALLBACK_TEAM_COLOR },
      seasons: t.seasons,
      span: seasonRangeLabel(t.firstLabel, t.lastLabel),
      active: isActiveCareer(t, latest),
      games: t.games,
      points: t.points,
      ppg: per(t.points, t.games),
      rpg: per(t.reb, t.games),
      apg: per(t.ast, t.games),
      chips: honorChips(awards, e.championships),
      reasons,
      teams,
      awards: [...awards],
      championships: [...(e.championships ?? [])],
    });
  }

  // 한 시즌 순위: 외국 선수 · 끝난 시즌 · 그 시즌 최다 출전의 60% 이상 (한 시즌 최다 탭과 같은 최소 경기)
  const foreignIds = new Set(foreign.map((e) => e.id));
  const lines = [];
  const meta = new Map<string, { teamCode: string; teamShort: string; seasonLabel: string }>();
  for (const s of listSeasonsWithPlayers()) {
    const season = loadSeasonData(s.seasonCode);
    if (!season) continue;
    const ongoing = isSeasonOngoing(s.seasonCode);
    const minGames = seasonBestMinGames("regular", Math.max(0, ...season.players.map((p) => p.games)));
    for (const p of season.players) {
      if (!foreignIds.has(p.playerNo)) continue;
      lines.push({ id: p.playerNo, seasonCode: s.seasonCode, games: p.games, points: p.points, reb: p.reb, ast: p.ast, ok: !ongoing && p.games >= minGames });
      const team = season.teams.find((x) => x.teamCode === p.teamCode);
      meta.set(`${p.playerNo}:${s.seasonCode}`, { teamCode: p.teamCode, teamShort: team?.shortNameKo ?? p.teamShort, seasonLabel: season.seasonLabel });
    }
  }
  const seasons: ForeignSeasonView[] = rankForeignSeasons(lines, 30).map((r) => {
    const e = findPlayerIndexEntry(r.id);
    const m = meta.get(`${r.id}:${r.seasonCode}`);
    return {
      rank: r.rank,
      id: r.id,
      nameKo: e?.nameKo ?? r.id,
      photoUrl: e?.photoUrl ?? null,
      color: m ? teamColorIn(r.seasonCode, m.teamCode) : { ...FALLBACK_TEAM_COLOR },
      seasonShort: m ? seasonShortLabel(m.seasonLabel) : String(r.seasonCode),
      teamShort: m?.teamShort ?? "",
      games: r.games,
      ppg: per(r.points, r.games),
      rpg: per(r.reb, r.games),
      apg: per(r.ast, r.games),
      value: Math.round(r.value * 10) / 10,
    };
  });

  hallCache = { members, pool, seasons };
  return hallCache;
}
