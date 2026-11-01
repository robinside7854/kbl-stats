// 빌드 시점(서버)에서 data/processed/*.json 을 읽는 함수들.
// KBL API는 모른다 — 수집 결과 파일만 안다 (CLAUDE.md 원칙 1).
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type {
  CardPlayer,
  CardTeam,
  CareerSeason,
  LeaderPlayer,
  PlayerCareer,
  Player,
  PlayerIndexEntry,
  SeasonData,
  Team,
  SeasonOption,
  SeasonGame,
  SeasonGamesFile,
  PlayoffClutchFile,
  PlayoffClutchGame,
  PostseasonFile,
  PostseasonLine,
} from "./types";
import { decodeSeasonCards, encodeSeasonCards, type SeasonCards, type SeasonCardsFile } from "./cards";
import { toCardPlayers as convertCardPlayers, toCardTeams, toLeaderPlayers as convertLeaderPlayers } from "./convert";
import { careerHighAchievements, careerHighTabs, playoffLeaderRow, type CareerHighRow, type HighAchievement, type HighsTab } from "./career";
import { buildPlayerShotsFile, type PlayerShotsFile, type ShotPoint } from "./shots";
import {
  GAME_KINDS,
  clutchListKey,
  isActiveCareer,
  nextMilestones,
  rankAwardCounts,
  rankGameHighs,
  rankSeasonBests,
  RECORD_LIST_TOP,
  SEASON_BEST_STATS,
  seasonBestMinGames,
  sumCareerTotals,
  withRanks,
  type CareerTotal,
  type GameKind,
  type Milestone,
  type RecordListItem,
  type RecordListsData,
  type RecordPerson,
  type SeasonBestKey,
} from "./records";
import { buildSeasonHighCards, formatHighDate, formatHighShot, formatHighTimes, SEASON_HIGH_LEADER_KEYS, type SeasonHighCard } from "./highs";
import { AWARD_LABELS, gameRanges, seasonRangeLabel, seasonShortLabel, type GameRangeSet, type PlayerGameLine } from "./career";
import {
  attachRebResiduals, formatProfileRank, PROFILE_CAREER_MIN_GAMES, PROFILE_CAREER_MIN_TPA, PROFILE_RANK_DEFS, profileListKey, profileRankSub, rankProfile,
  seasonMinTpa, seasonOpeningDate, teamPathOf, type ProfileRankInput,
} from "./profile-ranks";
import { nationalityOf, schoolGroupOf } from "./roster";
import { findSimilar, toAxisVector, type SimilarEntry, type SimilarVector } from "./similar";
import { pickPrimeSeasons, primeCandidatesOf, type PrimeCandidate } from "./prime";
import { DEFAULT_QUALIFY, buildCardEntry, gradeGroupOf, isDomesticPool, isOngoingSeason, isQualified, seasonDefaultQualify } from "./metrics";
import { seasonContext } from "./cardview";
import { asOfLabel, computeStandings, headToHead, latestGameDay, playerRecentGames, teamGameStrip, type HeadToHeadRecord, type OppBrand, type PlayerRecentGame, type TeamHeadToHeadLine, type TeamStripGame } from "./games";
import { buildNotifItems, careerHighsFromIndex, careerSumsFromSeasons, featGroups, homeFeatItems, leagueSeasonRecords, type RecentFeat } from "./notifications";
import { FALLBACK_TEAM_COLOR } from "./teams";
import { CLUTCH_RECORD_DEFS, clutchFgMinAttempts, clutchFgPct, clutchRecordValue, collectPlayerClutch, shotInStage, sumClutchTotals, winningLabel, winningLine, type ClutchStage, type ClutchTotals, type PlayerClutchRaw, type WinningEntry } from "./clutch";
import { attachFeatContexts, domesticFromIndex, performancesFromGames } from "./feat-context";
import { oddsSeed, playoffOdds, priorFromSeason, teamRatings, upcomingWinProbs, type PlayoffOdds } from "./predict";
import { pickRegularChampions } from "./game-pool";
import teamLineage from "@/data/codes/team-lineage.json";
import {
  buildTenures, franchiseLeaders, franchiseTotals, lineageChain, longestTenures, nameSpans, pickLegends, playoffStage, TEAM_LEADER_STATS,
  type PlayerTenure, type RosterRow, type SeasonPlayerLine, type TeamAwardLine, type TeamBrand, type TeamIndexEntry, type TeamPageData, type TeamSeasonRow,
} from "./franchise";
import { previousLines, seasonLeaderMarks, type DayLine, type LeaderStatKey, type PrevLine, type StatMode } from "./leaders";
import { buildBadgeIndex, playerBadges, type BadgeCareer, type BadgeIndex, type BadgeSeasonRow, type PlayerBadge } from "./badges";

const PROCESSED_DIR = path.join(process.cwd(), "data", "processed");

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(PROCESSED_DIR, file), "utf8")) as T;
}

// 빌드 중 같은 파일을 여러 번 읽지 않도록 메모리에 캐시
const cache = new Map<number, SeasonData | null>();

export function loadSeasonData(seasonCode: number): SeasonData | null {
  if (cache.has(seasonCode)) return cache.get(seasonCode)!;
  const data = readSeasonFile(seasonCode);
  cache.set(seasonCode, data);
  return data;
}

function readSeasonFile(seasonCode: number): SeasonData | null {
  const file = path.join(String(seasonCode), "players.json");
  if (!fs.existsSync(path.join(PROCESSED_DIR, file))) return null;
  return readJson<SeasonData>(file);
}

/** 코드표(seasons.json)의 전체 시즌 — 개막 전(선수 0명) 시즌 포함, 최신 시즌이 먼저 */
export function listAllSeasons(): SeasonOption[] {
  return [...readJson<SeasonOption[]>("seasons.json")].sort((a, b) => b.seasonCode - a.seasonCode);
}

/** 선수가 1명 이상 있는 시즌만, 최신 시즌이 먼저 오도록 정렬 (개막 전 시즌은 숨김) */
/**
 * 진행 중 시즌인가 (선수 있는 가장 최근 시즌 + 우승팀 없음, lib/metrics isOngoingSeason).
 * 진행 중이면 표본 기준을 없앤다(seasonQualify) — 2026-10-03 사용자 요청.
 */
/** 시즌 경기 (data/processed/{시즌}/games.json, scripts/boxscores.ts). 파일이 없으면 빈 배열 */
const gamesCache = new Map<number, SeasonGame[]>();
export function loadSeasonGames(seasonCode: number): SeasonGame[] {
  if (gamesCache.has(seasonCode)) return gamesCache.get(seasonCode)!;
  const file = path.join(String(seasonCode), "games.json");
  const games = fs.existsSync(path.join(PROCESSED_DIR, file)) ? (readJson<SeasonGamesFile>(file).games ?? []) : [];
  gamesCache.set(seasonCode, games);
  return games;
}

/** 시즌 → 선수 번호 → 그 시즌 경기별 기록 (박스스코어가 있는 경기, 출전한 경기만). 선수 범위 막대(lib/career gameRanges)용 */
const gameLinesCache = new Map<number, Map<string, PlayerGameLine[]>>();
function seasonGameLines(seasonCode: number): Map<string, PlayerGameLine[]> {
  const hit = gameLinesCache.get(seasonCode);
  if (hit) return hit;
  const out = new Map<string, PlayerGameLine[]>();
  for (const g of loadSeasonGames(seasonCode)) {
    if (!g.ended || !g.box) continue;
    for (const r of [...g.box.home, ...g.box.away]) {
      if (r.sec <= 0) continue;
      const list = out.get(r.id) ?? [];
      list.push({ date: g.date, pts: r.pts, reb: r.reb, ast: r.ast });
      out.set(r.id, list);
    }
  }
  gameLinesCache.set(seasonCode, out);
  return out;
}

/** 이 선수의 시즌별 경기 범위 (시즌 코드 → 범위). 박스스코어가 있고 RANGE_MIN_GAMES 경기 이상 뛴 시즌만 */
export function loadPlayerGameRanges(playerNo: string, seasonCodes: readonly number[]): Record<number, GameRangeSet> {
  const out: Record<number, GameRangeSet> = {};
  for (const code of seasonCodes) {
    const r = gameRanges(seasonGameLines(code).get(playerNo) ?? []);
    if (r) out[code] = r;
  }
  return out;
}

/** 이 선수의 시즌별 최근 경기 (시즌 코드 → 최근 5경기, 최근 먼저). 박스스코어가 있는 시즌만 (2026-10-14 스포츠 앱 비교 5) */
export function loadPlayerRecentGames(playerNo: string, seasonCodes: readonly number[]): Record<number, (PlayerRecentGame & { opp: OppBrand })[]> {
  const out: Record<number, (PlayerRecentGame & { opp: OppBrand })[]> = {};
  for (const code of seasonCodes) {
    if (!seasonGameLines(code).has(playerNo)) continue;
    const list = playerRecentGames(loadSeasonGames(code), playerNo);
    if (list.length === 0) continue;
    const infos = gameTeamInfos(code);
    out[code] = list.map((g) => ({ ...g, opp: infos[g.oppCode] ?? { shortName: g.oppName, logoUrl: null, color: FALLBACK_TEAM_COLOR } }));
  }
  return out;
}

/**
 * 이 팀의 시즌별 상대 전적 (시즌 코드 → 상대 팀 줄, 승률 높은 순 → 이름). 경기 결과가 있는 시즌만 (2026-10-14 스포츠 앱 비교 A-1).
 */
const h2hCache = new Map<number, Map<string, Map<string, HeadToHeadRecord>>>();
export function loadTeamHeadToHead(teamCode: string, seasonCodes: readonly number[]): Record<string, TeamHeadToHeadLine[]> {
  const out: Record<string, TeamHeadToHeadLine[]> = {};
  for (const code of seasonCodes) {
    let h = h2hCache.get(code);
    if (!h) h2hCache.set(code, (h = headToHead(loadSeasonGames(code))));
    const mine = h.get(teamCode);
    if (!mine || mine.size === 0) continue;
    const infos = gameTeamInfos(code);
    out[String(code)] = [...mine.entries()]
      .map(([opp, r]) => ({ teamCode: opp, ...(infos[opp] ?? { shortName: opp, logoUrl: null, color: FALLBACK_TEAM_COLOR }), ...r }))
      .sort((a, b) => b.wins / (b.wins + b.losses) - a.wins / (a.wins + a.losses) || b.wins - a.wins || a.shortName.localeCompare(b.shortName, "ko"));
  }
  return out;
}

/** 팀 페이지 맨 위 경기 띠 (지난 3 + 다음 2, 선수가 있는 최신 시즌). 그 시즌에 이 팀 경기가 없으면 null (2026-10-14 스포츠 앱 비교 B-3) */
export function loadTeamStrip(teamCode: string): { seasonCode: number; seasonShort: string; past: TeamStripGame[]; next: TeamStripGame[]; opps: Record<string, OppBrand> } | null {
  const latest = listSeasonsWithPlayers()[0];
  if (!latest) return null;
  const strip = teamGameStrip(loadSeasonGames(latest.seasonCode), teamCode);
  if (strip.past.length + strip.next.length === 0) return null;
  const infos = gameTeamInfos(latest.seasonCode);
  const opps: Record<string, OppBrand> = {};
  for (const g of [...strip.past, ...strip.next]) opps[g.oppCode] = infos[g.oppCode] ?? { shortName: g.oppName, logoUrl: null, color: FALLBACK_TEAM_COLOR };
  return { seasonCode: latest.seasonCode, seasonShort: seasonShortLabel(latest.seasonLabel), ...strip, opps };
}

/**
 * 경기 화면용 팀 이름·로고 (팀 코드 → 정보). 그 시즌 팀표가 먼저, 아직 기록이 없는 팀(개막 직후)은 직전 시즌 팀표.
 * 홈 "오늘의 경기"·일정 화면 공용.
 */
export function gameTeamInfos(seasonCode: number): Record<string, { shortName: string; logoUrl: string | null; color: CardTeam["color"] }> {
  const out: Record<string, { shortName: string; logoUrl: string | null; color: CardTeam["color"] }> = {};
  const prev = listSeasonsWithPlayers().find((s) => s.seasonCode < seasonCode);
  const prevSeason = prev ? loadSeasonData(prev.seasonCode) : null;
  const cur = loadSeasonData(seasonCode);
  for (const t of [...(prevSeason ? toCardTeams(prevSeason) : []), ...(cur ? toCardTeams(cur) : [])]) {
    out[t.teamCode] = { shortName: t.shortName, logoUrl: t.logoUrl, color: t.color };
  }
  return out;
}

/**
 * 기록이 어디까지 들어왔는지 (2026-10-08 토스 검토 — "오늘 13:16 기준"처럼 기준을 늘 보이게):
 * 선수가 있는 가장 최근 시즌에서 끝난 경기의 가장 늦은 날짜("2026-10-07"). 경기 파일이 없으면 null
 */
export function dataAsOfDate(): string | null {
  const latest = listSeasonsWithPlayers()[0];
  if (!latest) return null;
  return latestGameDay(loadSeasonGames(latest.seasonCode))?.date ?? null;
}
/** 위 날짜의 화면 문구 ("10월 7일 경기까지 반영"), 없으면 null */
export function dataAsOfLabel(): string | null {
  const d = dataAsOfDate();
  return d ? asOfLabel(d) : null;
}

/**
 * 리더보드 순위 변동 재료 (진행 중 시즌만, lib/leaders previousLines): 마지막 경기일 기록을 뺀 "그 전 경기일까지" 합계.
 * 마지막 경기일 경기 중 박스스코어가 없는 게 있거나, 그 전 경기일이 없으면(개막일) null
 */
export function loadLeaderPrevious(seasonCode: number): { date: string; lines: Record<string, PrevLine> } | null {
  if (!isSeasonOngoing(seasonCode)) return null;
  const season = loadSeasonData(seasonCode);
  const games = loadSeasonGames(seasonCode);
  const day = latestGameDay(games);
  if (!season || !day || day.games.some((g) => g.ended && !g.box)) return null;
  const prevDate = games.reduce<string | null>((m, g) => (g.ended && g.date < day.date && (!m || g.date > m) ? g.date : m), null);
  if (!prevDate) return null;
  const rows: DayLine[] = day.games.flatMap((g) => [...(g.box?.home ?? []), ...(g.box?.away ?? [])]);
  return { date: prevDate, lines: previousLines(toLeaderPlayers(season), rows) };
}

/**
 * 최근 7일(마지막 경기일부터) 대기록 — 커리어 하이·이번 시즌 리그 최고 갱신·통산 득점/출전 이정표 (2026-10-11 사용자 결정 A: 즐겨찾기와 상관없이 홈에서 모두에게).
 * 알림함과 같은 규칙(lib/notifications buildNotifItems)을 빌드 때 그대로 돌린다. 박스스코어가 없으면 빈 배열
 */
export function loadRecentFeats(seasonCode: number): RecentFeat[] {
  const games = loadSeasonGames(seasonCode);
  if (!games.some((g) => g.ended && g.box)) return [];
  const season = loadSeasonData(seasonCode);
  const teams = season ? toCardTeams(season) : [];
  const teamShort = Object.fromEntries((season?.teams ?? []).map((t) => [t.teamCode, t.shortNameKo]));
  const seasonFiles = listSeasonsWithPlayers().flatMap((s) => {
    const d = loadSeasonData(s.seasonCode);
    return d ? [d] : [];
  });
  const ctx = {
    seasonCode,
    teamShort,
    careerHighs: careerHighsFromIndex(loadPlayersIndex()),
    careerSums: careerSumsFromSeasons(seasonFiles),
  };
  // 홈 규칙(2026-10-11): 커리어 하이 + 이번 시즌 리그 최고 갱신 + 통산 득점·출전 이정표만
  // 맥락 꼬리표(2026-10-16, lib/feat-context): "올 시즌 40득점 이상은 리그 2번째" · "이보다 높이 올라간 국내 선수는 역대 7명"
  const items = attachFeatContexts(homeFeatItems(buildNotifItems(games, ctx), leagueSeasonRecords(games, ctx)), {
    performances: performancesFromGames(games),
    careerHighs: ctx.careerHighs,
    careerSums: ctx.careerSums as unknown as Record<string, Record<string, number>>,
    domestic: domesticFromIndex(loadPlayersIndex()),
  });
  const teamOfPlayer = new Map((season?.players ?? []).map((p) => [p.playerNo, p.teamCode]));
  return featGroups(items).map((g) => {
    const team = teams.find((t) => t.teamCode === teamOfPlayer.get(g.player));
    return { ...g, photoUrl: photoOf(g.player), teamShort: team?.shortName ?? "", color: team?.color ?? FALLBACK_TEAM_COLOR };
  });
}

let latestWithPlayers: number | null | undefined;
export function isSeasonOngoing(seasonCode: number): boolean {
  if (latestWithPlayers === undefined) latestWithPlayers = listSeasonsWithPlayers()[0]?.seasonCode ?? null;
  const latest = latestWithPlayers;
  return isOngoingSeason(seasonCode, latest, loadSeasonData(seasonCode)?.champion ?? null);
}
/** 시즌 기본 표본 기준 (진행 중 = 팀 경기 절반 이상(ongoingQualify), 마감 = DEFAULT_QUALIFY) */
export const seasonQualify = (seasonCode: number) => seasonDefaultQualify(isSeasonOngoing(seasonCode), loadSeasonData(seasonCode)?.players ?? []);

// ── 플레이오프 확률·경기 전 승률 (2026-10-16, 규칙 lib/predict — 우리 추정) ──
export interface SeasonPredictions {
  seasonCode: number;
  /** 6강 확률 순 */
  odds: PlayoffOdds[];
  /** 남은 경기 gmkey → 홈 승률 */
  winProbs: Record<string, number>;
  /** 끝난 경기 수 (0 이면 지난 시즌 성적만으로 본 값) */
  gamesPlayed: number;
}
const predictCache = new Map<number, SeasonPredictions | null>();
/** 진행 중 시즌만 (마감 시즌은 null). 출발점 = 바로 전 시즌(선수 있는 시즌 순서) 경기 결과 */
export function loadSeasonPredictions(seasonCode: number): SeasonPredictions | null {
  if (predictCache.has(seasonCode)) return predictCache.get(seasonCode)!;
  let out: SeasonPredictions | null = null;
  const games = loadSeasonGames(seasonCode);
  if (isSeasonOngoing(seasonCode) && games.length > 0) {
    const order = listSeasonsWithPlayers().map((s) => s.seasonCode);
    const prev = order.find((c) => c < seasonCode);
    const prior = prev !== undefined ? priorFromSeason(loadSeasonGames(prev)) : {};
    const ratings = teamRatings(games, prior);
    out = {
      seasonCode,
      odds: playoffOdds(games, ratings, { seed: oddsSeed(games) }),
      winProbs: upcomingWinProbs(games, ratings),
      gamesPlayed: games.filter((g) => g.ended).length,
    };
  }
  predictCache.set(seasonCode, out);
  return out;
}

export function listSeasonsWithPlayers(): SeasonOption[] {
  const seasons = readJson<SeasonOption[]>("seasons.json");
  return seasons
    .filter((s) => (loadSeasonData(s.seasonCode)?.players.length ?? 0) > 0)
    .sort((a, b) => b.seasonCode - a.seasonCode);
}

const photoOf = (playerNo: string) => findPlayerIndexEntry(playerNo)?.photoUrl ?? null;

/** 화면에 넘길 최소 필드만 추린다 (규칙은 lib/convert.ts). 사진 주소는 선수 색인(players-index.json)에서 playerNo로 찾는다 */
export function toCardPlayers(season: SeasonData): CardPlayer[] {
  return convertCardPlayers(season, photoOf, (no) => findPlayerIndexEntry(no)?.birthday ?? null);
}

/** 순위표에 넘길 최소 필드만 추린다 (Player 전체를 클라이언트로 보내지 않는다) */
export function toLeaderPlayers(season: SeasonData): LeaderPlayer[] {
  return convertLeaderPlayers(season, photoOf);
}

export { toCardTeams };

let playersIndexCache: PlayerIndexEntry[] | null = null;

/** 선수 색인 (전 시즌 선수 목록, 한글 이름순). 파일이 없으면 빈 배열 — npm run process 로 생성 */
export function loadPlayersIndex(): PlayerIndexEntry[] {
  if (playersIndexCache) return playersIndexCache;
  const file = "players-index.json";
  playersIndexCache = fs.existsSync(path.join(PROCESSED_DIR, file)) ? readJson<PlayerIndexEntry[]>(file) : [];
  return playersIndexCache;
}

// ─────────────────────────────────────────────
// 선수 페이지 (/player/[선수번호])
// ─────────────────────────────────────────────

let indexByIdCache: Map<string, PlayerIndexEntry> | null = null;

/** 선수 번호 → 색인 항목 */
export function findPlayerIndexEntry(playerNo: string): PlayerIndexEntry | null {
  if (!indexByIdCache) indexByIdCache = new Map(loadPlayersIndex().map((e) => [e.id, e]));
  return indexByIdCache.get(playerNo) ?? null;
}

// 시즌별 변환 결과 캐시 — 선수 페이지 1,329개가 같은 시즌을 여러 번 변환하지 않도록 (빌드 시간)
const leaderRowsCache = new Map<number, Map<string, LeaderPlayer>>();
const teamsCache = new Map<number, CardTeam[]>();

function seasonLeaderRows(season: SeasonData): Map<string, LeaderPlayer> {
  let m = leaderRowsCache.get(season.seasonCode);
  if (!m) {
    m = new Map(toLeaderPlayers(season).map((p) => [p.id, p]));
    leaderRowsCache.set(season.seasonCode, m);
  }
  return m;
}

const leaderMarksCache = new Map<number, Record<StatMode, Map<string, LeaderStatKey[]>>>();

/** 시즌 리그 1위 부문 (경기당·합계·30분당) — 선수 페이지 기록표의 굵은 숫자 */
function seasonMarks(season: SeasonData): Record<StatMode, Map<string, LeaderStatKey[]>> {
  let m = leaderMarksCache.get(season.seasonCode);
  if (!m) {
    const rows = [...seasonLeaderRows(season).values()];
    const rule = seasonQualify(season.seasonCode);
    m = {
      perGame: seasonLeaderMarks(rows, "perGame", rule),
      total: seasonLeaderMarks(rows, "total", rule),
      per30: seasonLeaderMarks(rows, "per30", rule),
    };
    leaderMarksCache.set(season.seasonCode, m);
  }
  return m;
}

function seasonTeams(season: SeasonData): CardTeam[] {
  let t = teamsCache.get(season.seasonCode);
  if (!t) {
    t = toCardTeams(season);
    teamsCache.set(season.seasonCode, t);
  }
  return t;
}

/**
 * 한 선수의 전 시즌 기록: 색인의 시즌 목록을 따라 각 시즌 파일(메모리 캐시)에서 그 선수 행을 모은다.
 * 시즌 파일에 그 선수가 없으면(색인과 어긋남) 그 시즌은 건너뛴다. 색인에 없는 번호면 null.
 * 클라이언트로는 순위표 행과 같은 최소 필드(LeaderPlayer) + 시즌 라벨 + 그 시즌 팀 정보만 넘긴다.
 */
export function loadPlayerCareer(playerNo: string): PlayerCareer | null {
  const entry = findPlayerIndexEntry(playerNo);
  if (!entry) return null;
  const seasons: CareerSeason[] = [];
  for (const s of entry.seasons) {
    const season = loadSeasonData(s.seasonCode);
    const row = season && seasonLeaderRows(season).get(playerNo);
    if (!season || !row) continue;
    seasons.push({
      ...row,
      seasonCode: season.seasonCode,
      seasonLabel: season.seasonLabel,
      team: seasonTeams(season).find((t) => t.teamCode === row.teamCode) ?? null,
      leaderMarks: (() => {
        const marks = seasonMarks(season);
        const out: CareerSeason["leaderMarks"] = {};
        for (const mode of ["perGame", "total", "per30"] as const) {
          const keys = marks[mode].get(playerNo);
          if (keys?.length) out[mode] = keys;
        }
        return out;
      })(),
    });
  }
  // 플레이오프(6강~챔프전) 시즌 합계 — 그 시즌 postseason.json 에 이 선수가 있을 때만
  const playoffSeasons: CareerSeason[] = [];
  for (const base of seasons) {
    const line = readPostseason(base.seasonCode)?.playoff?.find((l) => l.playerNo === playerNo);
    if (!line || line.games <= 0) continue;
    const season = loadSeasonData(base.seasonCode);
    playoffSeasons.push({
      ...playoffLeaderRow(line, base),
      seasonCode: base.seasonCode,
      seasonLabel: base.seasonLabel,
      team: (season && seasonTeams(season).find((t) => t.teamCode === line.teamCode)) ?? base.team,
      leaderMarks: {},
    });
  }
  return { entry, seasons, playoffSeasons };
}

// ─────────────────────────────────────────────
// 시즌 카드 데이터 — public/cards/{코드}.json 과 똑같은 내용 (scripts/build-cards.ts 와 같은 encode)
// ─────────────────────────────────────────────

const cardsFileCache = new Map<number, SeasonCardsFile | null>();
const cardsCache = new Map<number, SeasonCards | null>();

/**
 * 시즌 카드 파일 내용(열 형식). 선수 탭은 최신 시즌 것을 정적 HTML에 그대로 넣고, 다른 시즌은 브라우저가
 * public/cards 에서 같은 형식을 받는다 → 서버·브라우저가 같은 decode·계산(lib/cardview)을 거친다.
 */
export function loadSeasonCardsFile(seasonCode: number): SeasonCardsFile | null {
  if (cardsFileCache.has(seasonCode)) return cardsFileCache.get(seasonCode)!;
  const season = loadSeasonData(seasonCode);
  const file =
    season && season.players.length > 0
      ? encodeSeasonCards(
          { seasonCode: season.seasonCode, seasonLabel: season.seasonLabel, coverage: season.coverage, teams: seasonTeams(season) },
          toCardPlayers(season),
          seasonQualify(seasonCode),
        )
      : null;
  cardsFileCache.set(seasonCode, file);
  return file;
}

/** 풀어낸 시즌 카드 데이터 (선수 상세·비교 탭의 첫 화면 카드 계산용, lib/cardview buildSeasonCardView) */
export function loadSeasonCards(seasonCode: number): SeasonCards | null {
  if (cardsCache.has(seasonCode)) return cardsCache.get(seasonCode)!;
  const file = loadSeasonCardsFile(seasonCode);
  const cards = file ? decodeSeasonCards(file) : null;
  cardsCache.set(seasonCode, cards);
  return cards;
}

// ─────────────────────────────────────────────
// 한 경기 최다 — 시즌 파일 seasonHighLeaders(순위표 카드 줄), 색인 careerHighs(선수 페이지 커리어 하이)
// 백필 전 processed 파일에는 필드가 없다 → 빈 배열 (화면은 섹션을 숨긴다)
// ─────────────────────────────────────────────

/** 그 시즌 팀 목록에서 팀 코드 → 한글 약칭. 시즌 파일·팀이 없으면 null */
export function teamNameInSeason(teamCode: string, seasonCode: number | null): string | null {
  if (seasonCode === null) return null;
  return loadSeasonData(seasonCode)?.teams.find((t) => t.teamCode === teamCode)?.shortNameKo ?? null;
}

/** 순위표 "이 시즌 한 경기 최다" 카드 (lib/highs buildSeasonHighCards). 데이터 없으면 [] */
export function loadSeasonHighCards(season: SeasonData): SeasonHighCard[] {
  return buildSeasonHighCards(season.seasonHighLeaders, toLeaderPlayers(season), (code) =>
    teamNameInSeason(code, season.seasonCode),
  );
}

/** 선수 페이지 커리어 하이 업적 카드 (lib/career careerHighAchievements). 데이터 없으면 [] */
export function loadCareerHighAchievements(entry: PlayerIndexEntry): HighAchievement[] {
  const labels = new Map(listAllSeasons().map((s) => [s.seasonCode, s.seasonLabel]));
  return careerHighAchievements(
    entry.careerHighs,
    teamNameInSeason,
    (code, key) => loadSeasonData(code)?.seasonHighLeaders?.[key] ?? null,
    (code) => labels.get(code) ?? null,
  );
}

/** 선수 페이지 커리어 하이 탭 (정규시즌/플레이오프/챔프전, 행 없는 탭은 빠짐). 데이터 없으면 [] */
export function loadCareerHighTabs(entry: PlayerIndexEntry): { key: HighsTab; label: string; rows: CareerHighRow[] }[] {
  return careerHighTabs(entry.careerHighs, teamNameInSeason);
}

// ─────────────────────────────────────────────
// 칭호 배지 (lib/badges) — 선수 색인 + 시즌 파일에서 빌드 시점에 계산해 결과(라벨)만 넘긴다
// ─────────────────────────────────────────────

let badgeIndexCache: BadgeIndex | null = null;

/** 전 시즌 배지 재료 (시즌별 최다 경기·부문 1위) */
export function loadBadgeIndex(): BadgeIndex {
  if (badgeIndexCache) return badgeIndexCache;
  const seasons = listSeasonsWithPlayers().flatMap((s) => {
    const data = loadSeasonData(s.seasonCode);
    return data ? [{ seasonCode: data.seasonCode, seasonLabel: data.seasonLabel, players: [...seasonLeaderRows(data).values()] }] : [];
  });
  badgeIndexCache = buildBadgeIndex(seasons);
  return badgeIndexCache;
}

// 시즌 파일 선수 행 (더블더블·트리플더블 — 화면용 LeaderPlayer 에는 없는 필드)
const rawRowsCache = new Map<number, Map<string, Player>>();
function seasonRawRows(season: SeasonData): Map<string, Player> {
  let m = rawRowsCache.get(season.seasonCode);
  if (!m) {
    m = new Map(season.players.map((p) => [p.playerNo, p]));
    rawRowsCache.set(season.seasonCode, m);
  }
  return m;
}

/** 배지 계산 재료: 색인 항목의 시즌을 따라 시즌 파일에서 팀·경기·더블더블·트리플더블을 모은다 */
export function badgeCareerOf(entry: PlayerIndexEntry): BadgeCareer {
  const seasons: BadgeSeasonRow[] = [];
  for (const s of entry.seasons) {
    const season = loadSeasonData(s.seasonCode);
    const p = season && seasonRawRows(season).get(entry.id);
    if (!p) continue;
    seasons.push({ seasonCode: s.seasonCode, teamCode: p.teamCode, games: p.games, doubleDoubles: p.doubleDoubles, tripleDoubles: p.tripleDoubles });
  }
  return {
    playerNo: entry.id,
    seasons,
    draftYear: entry.draft?.year ?? null,
    careerHighPoints: entry.careerHighs?.regular?.pts?.value ?? null,
  };
}

const badgesCache = new Map<string, PlayerBadge[]>();

/** 한 선수의 칭호 배지 (우선순위 순). 색인에 없으면 [] */
export function loadPlayerBadges(playerNo: string): PlayerBadge[] {
  const hit = badgesCache.get(playerNo);
  if (hit) return hit;
  const entry = findPlayerIndexEntry(playerNo);
  const list = entry ? playerBadges(badgeCareerOf(entry), loadBadgeIndex()) : [];
  badgesCache.set(playerNo, list);
  return list;
}

/** 선수 탭 그리드용: 배지가 있는 선수만 → 우선순위 1번 배지 라벨 (예: { "291248": "득점왕 ×3" }) */
export function loadTopBadgeLabels(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of loadPlayersIndex()) {
    const top = loadPlayerBadges(e.id)[0];
    if (top) out[e.id] = top.label;
  }
  return out;
}

// ─────────────────────────────────────────────
// 슛 차트 (data/processed/{시즌}/shots.json — 선수별 점 좌표). 브라우저는 public/shots/{시즌}/{선수}.json(빌드 전 생성)을 받고,
// 선수 상세 첫 화면(최신 시즌)은 여기서 같은 형식(lib/shots buildPlayerShotsFile)으로 정적 HTML 에 넣는다.
// ─────────────────────────────────────────────

const shotsCache = new Map<number, Record<string, ShotPoint[]> | null>();

function loadSeasonShotPoints(seasonCode: number): Record<string, ShotPoint[]> | null {
  if (shotsCache.has(seasonCode)) return shotsCache.get(seasonCode)!;
  const file = path.join(String(seasonCode), "shots.json");
  const data = fs.existsSync(path.join(PROCESSED_DIR, file)) ? readJson<Record<string, ShotPoint[]>>(file) : null;
  shotsCache.set(seasonCode, data);
  return data;
}

/** 한 선수·한 시즌 슛 파일. 그 시즌 슛 데이터가 없거나 선수 슛이 0개면 null */
export function loadPlayerShots(seasonCode: number, playerNo: string): PlayerShotsFile | null {
  const season = loadSeasonData(seasonCode);
  if (!season) return null;
  return buildPlayerShotsFile(season, playerNo, loadSeasonShotPoints(seasonCode)?.[playerNo]);
}

/** 그 선수 슛 차트가 있는 시즌 코드 (시즌 파일의 shotZones 기준) — 화면이 없는 시즌은 받지 않고 바로 "기록 없음" */
export function playerShotSeasons(playerNo: string, seasonCodes: readonly number[]): number[] {
  return seasonCodes.filter((c) => !!loadSeasonData(c)?.players.find((p) => p.playerNo === playerNo)?.shotZones);
}

// ─────────────────────────────────────────────
// 비슷한 선수 (lib/similar) — 전 시즌 표본 충족 선수의 6축 백분위 벡터를 한 번 만들어 둔다
// ─────────────────────────────────────────────

let similarPool: SimilarVector[] | null = null;

/** "선수번호:시즌코드" → 그 시즌 역할 유형 라벨 (비슷한 시즌 줄에 표시) */
const similarRoleLabels = new Map<string, string>();

function loadSimilarPool(): SimilarVector[] {
  if (similarPool) return similarPool;
  const out: SimilarVector[] = [];
  for (const s of listSeasonsWithPlayers()) {
    const cards = loadSeasonCards(s.seasonCode);
    if (!cards) continue;
    const ctx = seasonContext(cards, "all");
    for (const p of cards.players) {
      // 시즌을 가로지르는 비교라 진행 중 시즌도 기본 기준(DEFAULT_QUALIFY) — 1~2경기 표본이 끼지 않게
      if (!isQualified(p, DEFAULT_QUALIFY)) continue;
      const e = buildCardEntry(p, ctx);
      const axes = toAxisVector(e.radar.axes);
      if (!axes) continue;
      out.push({
        id: p.id,
        seasonCode: s.seasonCode,
        pool: isDomesticPool(gradeGroupOf(p, ctx.grading.mergeAsia)) ? "domestic" : "foreign",
        pos: p.positionGroup,
        axes,
        overall: e.overallPct,
        role: e.type.key,
        offense: p.offenseType ?? null,
      });
      similarRoleLabels.set(`${p.id}:${s.seasonCode}`, e.type.label);
    }
  }
  similarPool = out;
  return out;
}

/** 한 선수의 시즌별 비슷한 시즌 5개 (표본 미달 시즌은 없음) */
export function loadSimilarPlayers(playerNo: string): Record<number, SimilarEntry[]> {
  const pool = loadSimilarPool();
  const out: Record<number, SimilarEntry[]> = {};
  for (const v of pool) {
    if (v.id !== playerNo) continue;
    out[v.seasonCode] = findSimilar(v, pool).map((m) => {
      const cards = loadSeasonCards(m.seasonCode)!;
      const p = cards.players.find((x) => x.id === m.id)!;
      const team = cards.teams.find((t) => t.teamCode === p.teamCode);
      return {
        id: m.id,
        nameKo: p.nameKo,
        seasonCode: m.seasonCode,
        seasonLabel: cards.seasonLabel,
        teamShort: team?.shortName ?? p.teamShort,
        teamColor: team?.color.primary ?? "#6b7280",
        photoUrl: p.photoUrl,
        score: Math.round(m.score * 10) / 10,
        roleLabel: similarRoleLabels.get(`${m.id}:${m.seasonCode}`) ?? null,
        sameRole: m.sameRole,
      };
    });
  }
  return out;
}

// ─────────────────────────────────────────────
// 프라임 시즌 (lib/prime) — 전 시즌을 한 번 훑어 선수 번호 → 시즌 코드
// ─────────────────────────────────────────────

let primeSeasons: Map<string, number> | null = null;

/** 그 선수의 프라임 시즌 코드 (표본 충족 시즌이 2개 미만이면 null) */
export function loadPrimeSeason(playerNo: string): number | null {
  if (!primeSeasons) {
    const cands: PrimeCandidate[] = [];
    for (const s of listSeasonsWithPlayers()) {
      const cards = loadSeasonCards(s.seasonCode);
      if (cards) cands.push(...primeCandidatesOf(cards));
    }
    primeSeasons = pickPrimeSeasons(cands);
  }
  return primeSeasons.get(playerNo) ?? null;
}

// ─────────────────────────────────────────────
// 역대 통산 순위 (lib/records) — 전 시즌 선수 합계를 선수 번호로 더한다
// ─────────────────────────────────────────────

let careerTotals: CareerTotal[] | null = null;

export function loadCareerTotals(): CareerTotal[] {
  if (careerTotals) return careerTotals;
  const rows = [];
  for (const s of listSeasonsWithPlayers()) {
    const season = loadSeasonData(s.seasonCode);
    if (!season) continue;
    const teams = seasonTeams(season);
    const dd = new Map(season.players.map((x) => [x.playerNo, x]));
    for (const p of seasonLeaderRows(season).values()) {
      const team = teams.find((t) => t.teamCode === p.teamCode);
      const idx = findPlayerIndexEntry(p.id);
      rows.push({
        id: p.id,
        nameKo: p.nameKo,
        photoUrl: idx?.photoUrl ?? p.photoUrl,
        rosterStatus: idx?.rosterStatus ?? null,
        origin: (nationalityOf(idx ?? p) === "domestic" ? "domestic" : "foreign") as "domestic" | "foreign",
        seasonCode: season.seasonCode,
        seasonLabel: season.seasonLabel,
        teamShort: team?.shortName ?? p.teamShort,
        teamColor: team?.color.primary ?? "#6b7280",
        games: p.games,
        minutes: p.minutes,
        points: p.points,
        reb: p.reb,
        ast: p.ast,
        stl: p.stl,
        blk: p.blk,
        tpm: p.tpm,
        doubleDoubles: dd.get(p.id)?.doubleDoubles ?? 0,
        tripleDoubles: dd.get(p.id)?.tripleDoubles ?? 0,
        wins: p.wins,
        losses: p.losses,
      });
    }
  }
  careerTotals = sumCareerTotals(rows);
  return careerTotals;
}

/** 현역 선수의 다음 통산 이정표 (lib/records nextMilestones). 은퇴 선수·기록 없는 선수는 [] */
export function loadMilestones(playerNo: string): Milestone[] {
  const all = loadCareerTotals();
  const me = all.find((t) => t.id === playerNo);
  const latest = listSeasonsWithPlayers()[0]?.seasonCode;
  if (!me || latest === undefined || !isActiveCareer(me, latest)) return [];
  return nextMilestones(me, all);
}

/** 선수 탭 "칭호로 찾기": 선수 번호 → 칭호 배지 키 목록 (배지 없는 선수는 없음) */
export function loadBadgeKeys(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const e of loadPlayersIndex()) {
    const keys = loadPlayerBadges(e.id).map((b) => b.key);
    if (keys.length) out[e.id] = keys;
  }
  return out;
}

/** 선수 탭 "출신교" 필터: 선수 번호 → 출신교 묶음 이름 (lib/roster schoolGroupOf, 학교 정보 없는 선수는 없음) */
export function loadSchoolGroups(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of loadPlayersIndex()) {
    const g = schoolGroupOf(e.school, nationalityOf(e) !== "domestic");
    if (g) out[e.id] = g;
  }
  return out;
}

// ─────────────────────────────────────────────
// 역대 기록 하위 탭 (2026-10-03): 한 경기 최다 · 한 시즌 최다 · 수상·우승 — 순위 규칙은 lib/records, 여기는 재료 모으기와 표기
// ─────────────────────────────────────────────

const NF1 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NF0 = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

/** (시즌, 팀 코드) → 한글 약칭·주 색. 그 시즌 팀표에 없으면 코드 그대로 */
const teamInfoCache = new Map<number, Map<string, { short: string; color: string }>>();
function teamInfoIn(seasonCode: number, teamCode: string | null): { short: string; color: string } {
  if (!teamInfoCache.has(seasonCode)) {
    const season = loadSeasonData(seasonCode);
    teamInfoCache.set(seasonCode, new Map((season ? toCardTeams(season) : []).map((t) => [t.teamCode, { short: t.shortName, color: t.color.primary }])));
  }
  return (teamCode && teamInfoCache.get(seasonCode)!.get(teamCode)) || { short: teamCode ?? "", color: "#6b7280" };
}

const seasonLabelCache = new Map<number, string>();
function seasonShortOf(seasonCode: number): string {
  if (seasonLabelCache.size === 0) for (const s of listAllSeasons()) seasonLabelCache.set(s.seasonCode, seasonShortLabel(s.seasonLabel));
  return seasonLabelCache.get(seasonCode) ?? String(seasonCode);
}

/** 선수 색인 → 사람 정보 (마지막 시즌 팀 색) */
function personOf(e: PlayerIndexEntry): RecordPerson {
  const last = e.seasons[e.seasons.length - 1];
  return { nameKo: e.nameKo, photoUrl: e.photoUrl, color: last ? teamInfoIn(last.seasonCode, last.teamCode).color : "#6b7280" };
}

function collectPeople(lists: Record<string, RecordListItem[]>): Record<string, RecordPerson> {
  const people: Record<string, RecordPerson> = {};
  for (const list of Object.values(lists)) {
    for (const r of list) {
      if (people[r.id]) continue;
      const e = findPlayerIndexEntry(r.id);
      if (e) people[r.id] = personOf(e);
    }
  }
  return people;
}

/** 선수 번호 → 국적(국내/외국인)·현역 — 역대 기록 필터용 */
let filterMetaCache: Map<string, { origin: "domestic" | "foreign"; active: boolean }> | null = null;
function filterMetaOf(id: string): { origin: "domestic" | "foreign"; active: boolean } {
  if (!filterMetaCache) {
    const latest = listSeasonsWithPlayers()[0]?.seasonCode;
    filterMetaCache = new Map(
      loadPlayersIndex().map((e) => [
        e.id,
        {
          origin: nationalityOf(e) === "domestic" ? "domestic" : "foreign",
          active: latest !== undefined && isActiveCareer({ lastSeasonCode: e.seasons[e.seasons.length - 1]?.seasonCode ?? -1, rosterStatus: e.rosterStatus }, latest),
        },
      ]),
    );
  }
  return filterMetaCache.get(id) ?? { origin: "foreign", active: false };
}

/**
 * 필터(국내·외국인 × 전체·현역) 네 가지 각각의 상위 목록을 합친 것 — 전체·현역만 목록도 이 합집합 안에 다 들어 있다.
 * rank: (재료) → 순위 순서 목록. 반환은 합집합을 전체 순서로 다시 줄 세운 것 (화면이 filterRecordList 로 거른다)
 */
function unionForFilters<T extends { id: string }, R extends T>(entries: readonly T[], rank: (pool: T[], top?: number) => R[], keyOf: (t: T) => string): R[] {
  const keep = new Set<string>();
  for (const origin of ["domestic", "foreign"] as const) {
    for (const activeOnly of [false, true]) {
      const pool = entries.filter((e) => {
        const m = filterMetaOf(e.id);
        return m.origin === origin && (!activeOnly || m.active);
      });
      for (const r of rank(pool)) keep.add(keyOf(r));
    }
  }
  return rank(entries.filter((e) => keep.has(keyOf(e))), Number.POSITIVE_INFINITY);
}

/** 한 경기 최다: 구분(정규·플옵·챔프) × 부문 11개, 선수별 통산 최고 기록(색인 careerHighs)으로 순위.
 *  빌드 때 페이지 하나 + 목록 파일 33개(app/records/data)가 같이 부르므로 한 번만 계산한다 */
let gameHighListsCache: RecordListsData | null = null;
export function loadGameHighLists(): RecordListsData {
  return (gameHighListsCache ??= buildGameHighLists());
}
function buildGameHighLists(): RecordListsData {
  const index = loadPlayersIndex();
  const scheduled = new Set(listSeasonsWithPlayers().map((s) => s.seasonCode));
  const lists: Record<string, RecordListItem[]> = {};
  for (const { value: kind } of GAME_KINDS) {
    for (const key of SEASON_HIGH_LEADER_KEYS) {
      const entries = index.flatMap((e) => {
        const r = e.careerHighs?.[kind]?.[key];
        return r ? [{ id: e.id, value: r.value, date: r.date, rec: r, seasons: e.seasons }] : [];
      });
      lists[`${kind}:${key}`] = unionForFilters(entries, (p, top) => rankGameHighs(p, top), (x) => x.id).map((x) => {
        const code = x.rec.seasonCode;
        const own = code !== null ? x.seasons.find((s) => s.seasonCode === code) : undefined;
        const parts = [
          code !== null ? seasonShortOf(code) : null,
          own ? teamInfoIn(code!, own.teamCode).short : null,
          x.rec.opponentTeamCode && code !== null ? `vs ${teamInfoIn(code, x.rec.opponentTeamCode).short}` : null,
          x.rec.date ? formatHighDate(x.rec.date) : null,
        ];
        const times = x.rec.times && x.rec.times > 1 ? formatHighTimes(x.rec.times) : null;
        return {
          rank: x.rank,
          id: x.id,
          num: x.value,
          ...filterMetaOf(x.id),
          value: NF0.format(x.value),
          unit: key === "pts" ? "점" : "개",
          sub: parts.filter(Boolean).join(" · "),
          note: [formatHighShot(x.rec, key), times].filter(Boolean).join(" · ") || null,
          gameHref: kind === "regular" && code !== null && x.rec.date && scheduled.has(code) ? `/season/${code}/schedule?date=${x.rec.date}` : null,
        };
      });
    }
  }
  return { people: collectPeople(lists), lists };
}

function readPostseason(seasonCode: number): PostseasonFile | null {
  const file = path.join(String(seasonCode), "postseason.json");
  return fs.existsSync(path.join(PROCESSED_DIR, file)) ? readJson<PostseasonFile>(file) : null;
}

/** 플레이오프·챔프전 시즌 합계 파일이 하나라도 있는가 (없으면 화면이 "수집 중" 안내) */
export function hasPostseasonData(): boolean {
  return listSeasonsWithPlayers().some((s) => readPostseason(s.seasonCode) !== null);
}

/** 한 시즌 최다: 구분 × 부문 × 합계/경기당. 정규시즌은 시즌 파일, 플옵·챔프전은 postseason.json (한 번만 계산 — 위와 같은 이유) */
let seasonBestListsCache: RecordListsData | null = null;
export function loadSeasonBestLists(): RecordListsData {
  return (seasonBestListsCache ??= buildSeasonBestLists());
}
function buildSeasonBestLists(): RecordListsData {
  type Line = { id: string; seasonCode: number; teamCode: string; games: number; perGameOk: boolean; stats: Record<SeasonBestKey, number> };
  const byKind: Record<GameKind, Line[]> = { regular: [], playoff: [], finals: [] };
  const statsOf = (p: Pick<PostseasonLine, "points" | "reb" | "ast" | "stl" | "blk" | "tpm" | "ftm" | "doubleDoubles" | "tripleDoubles">) => ({
    points: p.points, reb: p.reb, ast: p.ast, stl: p.stl, blk: p.blk, tpm: p.tpm, ftm: p.ftm, doubleDoubles: p.doubleDoubles, tripleDoubles: p.tripleDoubles,
  });
  for (const s of listSeasonsWithPlayers()) {
    const season = loadSeasonData(s.seasonCode);
    if (!season) continue;
    // 진행 중 시즌은 경기당 순위에서 뺀다 (몇 경기 치르지 않은 기록이 역대 1위가 되지 않게). 합계는 넣는다
    const ongoing = isSeasonOngoing(s.seasonCode);
    const maxGames = Math.max(0, ...season.players.map((p) => p.games));
    for (const p of season.players) {
      if (p.games <= 0) continue;
      byKind.regular.push({ id: p.playerNo, seasonCode: s.seasonCode, teamCode: p.teamCode, games: p.games, perGameOk: !ongoing && p.games >= seasonBestMinGames("regular", maxGames), stats: statsOf(p) });
    }
    const post = readPostseason(s.seasonCode);
    for (const kind of ["playoff", "finals"] as const) {
      for (const p of post?.[kind] ?? []) {
        byKind[kind].push({ id: p.playerNo, seasonCode: s.seasonCode, teamCode: p.teamCode, games: p.games, perGameOk: !ongoing && p.games >= seasonBestMinGames(kind, 0), stats: statsOf(p) });
      }
    }
  }
  const lists: Record<string, RecordListItem[]> = {};
  for (const { value: kind } of GAME_KINDS) {
    for (const def of SEASON_BEST_STATS) {
      for (const mode of def.perGame ? (["total", "perGame"] as const) : (["total"] as const)) {
        const ranked = unionForFilters(byKind[kind], (p, top) => rankSeasonBests(p, def.key, mode, top), (x) => `${x.id}:${x.seasonCode}`);
        lists[`${kind}:${def.key}:${mode}`] = ranked.map((x) => ({
          rank: x.rank,
          id: x.id,
          num: x.value,
          ...filterMetaOf(x.id),
          value: mode === "perGame" ? NF1.format(x.value) : NF0.format(x.value),
          unit: def.unit,
          sub: `${seasonShortOf(x.seasonCode)} · ${teamInfoIn(x.seasonCode, x.teamCode).short} · ${x.games}경기`,
          note: mode === "perGame" ? `합계 ${NF0.format(x.stats[def.key])}` : null,
        }));
      }
    }
  }
  return { people: collectPeople(lists), lists };
}

/** 수상·우승 횟수: 우승 + 개인상(lib/career AWARD_LABELS) */
export const AWARD_RANK_DEFS: readonly { key: string; label: string }[] = [
  { key: "champion", label: "우승" },
  // 신인상은 한 번뿐이고 식스맨상·기량 발전상도 횟수 순위가 의미 없어 뺀다 (2026-10-03 사용자 요청)
  ...AWARD_LABELS.filter((d) => !["rookie", "sixthMan", "mip"].includes(d.key)).map((d) => ({ key: d.key as string, label: d.label })),
];

export function loadAwardLists(): RecordListsData {
  const index = loadPlayersIndex();
  const lists: Record<string, RecordListItem[]> = {};
  for (const def of AWARD_RANK_DEFS) {
    const entries = index.map((e) => ({
      id: e.id,
      seasonCodes: def.key === "champion" ? [...(e.championships ?? [])] : (e.awards ?? []).filter((a) => a.key === def.key).map((a) => a.seasonCode),
    }));
    lists[def.key] = unionForFilters(entries, (p, top) => rankAwardCounts(p, top), (x) => x.id).map((x) => ({
      rank: x.rank,
      id: x.id,
      num: x.count,
      ...filterMetaOf(x.id),
      value: String(x.count),
      unit: "회",
      sub: [...new Set(x.seasonCodes)].sort((a, b) => a - b).map(seasonShortOf).join(" · "),
    }));
  }
  return { people: collectPeople(lists), lists };
}

// ─────────────────────────────────────────────
// 클러치·위닝샷 (2026-10-28, 규칙은 lib/clutch — 재료는 시즌 games.json·playoff-clutch.json 의 winning·clutch)
// ─────────────────────────────────────────────

/** 시즌 플레이오프 클러치 (data/processed/{시즌}/playoff-clutch.json). 파일이 없으면 빈 배열 */
export function loadPlayoffClutch(seasonCode: number): PlayoffClutchGame[] {
  const file = path.join(String(seasonCode), "playoff-clutch.json");
  return fs.existsSync(path.join(PROCESSED_DIR, file)) ? (readJson<PlayoffClutchFile>(file).games ?? []) : [];
}

let clutchCache: Map<string, PlayerClutchRaw> | null = null;
/** 전 시즌 선수별 클러치 합계·위닝샷 (빌드 때 한 번) */
export function loadClutchIndex(): Map<string, PlayerClutchRaw> {
  if (clutchCache) return clutchCache;
  const seasons = listSeasonsWithPlayers().map((s) => ({
    seasonCode: s.seasonCode,
    games: loadSeasonGames(s.seasonCode),
    playoffGames: loadPlayoffClutch(s.seasonCode),
  }));
  return (clutchCache = collectPlayerClutch(seasons));
}

/** 클러치 위닝샷 한 줄 (선수 페이지·기록 탭) */
export interface ClutchShotRow {
  gmkey: string;
  seasonCode: number;
  seasonShort: string;
  /** 정규시즌 / 플레이오프(6강·4강) / 챔프전 */
  stage: ClutchStage;
  date: string;
  label: string;
  line: string;
  buzzer: boolean;
  opp: OppBrand;
  home: boolean;
  teamScore: number;
  oppScore: number;
}

/** 선수 페이지 "클러치" 한 구분 (정규시즌 또는 플레이오프) */
export interface PlayerClutchStageView {
  career: ClutchTotals;
  /** 최근 시즌 먼저 */
  seasons: { seasonCode: number; seasonShort: string; totals: ClutchTotals }[];
  shots: ClutchShotRow[];
}

/** 선수 페이지 "클러치": 정규시즌 + 플레이오프(6강~챔프전, 없으면 null) */
export interface PlayerClutchView {
  regular: PlayerClutchStageView | null;
  playoff: PlayerClutchStageView | null;
}

function clutchShotRow(s: WinningEntry): ClutchShotRow {
  const info = gameTeamInfos(s.seasonCode)[s.oppCode];
  return {
    gmkey: s.gmkey,
    seasonCode: s.seasonCode,
    seasonShort: seasonShortOf(s.seasonCode),
    stage: s.stage,
    date: s.date,
    label: winningLabel(s.shot),
    line: winningLine(s.shot, s.homeCode),
    buzzer: s.shot.buzzer,
    opp: info ?? { shortName: teamNameInSeason(s.oppCode, s.seasonCode) ?? s.oppCode, logoUrl: null, color: FALLBACK_TEAM_COLOR },
    home: s.homeCode === s.teamCode,
    teamScore: s.teamScore,
    oppScore: s.oppScore,
  };
}

/** 선수 페이지 "클러치" (문자중계가 있는 2006-07 이후 — 클러치 상황에 던진 적이 없으면 null) */
export function loadPlayerClutch(playerNo: string): PlayerClutchView | null {
  const raw = loadClutchIndex().get(playerNo);
  if (!raw) return null;
  const stageView = (stage: "regular" | "playoff"): PlayerClutchStageView | null => {
    const map = raw.stages[stage];
    if (map.size === 0) return null;
    const seasons = [...map.entries()].sort((a, b) => b[0] - a[0]).map(([seasonCode, totals]) => ({ seasonCode, seasonShort: seasonShortOf(seasonCode), totals }));
    return { career: sumClutchTotals(map.values()), seasons, shots: raw.shots.filter((s) => shotInStage(s, stage)).map(clutchShotRow) };
  };
  const view = { regular: stageView("regular"), playoff: stageView("playoff") };
  return view.regular || view.playoff ? view : null;
}

/** 기록 탭 "클러치" 기간 고르기: 통산 + 문자중계가 있는 시즌 (최신 먼저) */
export function clutchSeasonOptions(): { seasonCode: number; seasonShort: string }[] {
  const have = new Set<number>();
  for (const p of loadClutchIndex().values()) for (const m of Object.values(p.stages)) for (const code of m.keys()) have.add(code);
  return [...have].sort((a, b) => b - a).map((seasonCode) => ({ seasonCode, seasonShort: seasonShortOf(seasonCode) }));
}

/**
 * 기록 탭 "클러치": 구분(정규·플옵·챔프전) × 기간(통산·시즌) × 부문(위닝샷·버저비터·클러치 득점 — 숫자 아래 야투율) 순위.
 * 키 = lib/records clutchListKey("regular", "all", "winning") — 국적·현역 필터용으로 넉넉히(unionForFilters). 빌드 때 한 번
 */
let clutchListsCache: RecordListsData | null = null;
export function loadClutchLists(): RecordListsData {
  if (clutchListsCache) return clutchListsCache;
  const index = [...loadClutchIndex().entries()];
  const lists: Record<string, RecordListItem[]> = {};
  const scopes: (number | "all")[] = ["all", ...clutchSeasonOptions().map((s) => s.seasonCode)];
  for (const { value: stage } of GAME_KINDS) {
    for (const scope of scopes) {
      const totals = index.flatMap(([id, p]) => {
        const map = p.stages[stage];
        const t = scope === "all" ? (map.size ? sumClutchTotals(map.values()) : null) : (map.get(scope) ?? null);
        if (!t) return [];
        const shots = p.shots.filter((s) => shotInStage(s, stage) && (scope === "all" || s.seasonCode === scope));
        return [{ id, t, shots }];
      });
      const minFga = clutchFgMinAttempts(stage, scope === "all" ? "career" : "season");
      for (const def of CLUTCH_RECORD_DEFS) {
        const entries = totals.flatMap((x) => {
          const v = clutchRecordValue(x.t, def.key, minFga);
          return v === null ? [] : [{ ...x, v }];
        });
        const rankNum = (v: number) => (def.key === "fgPct" ? Math.round(v * 10) : v);
        const rank = (pool: typeof entries, top = RECORD_LIST_TOP) =>
          withRanks(
            [...pool].sort((a, b) => b.v - a.v || b.t.games - a.t.games || a.id.localeCompare(b.id)),
            (r) => rankNum(r.v),
          ).filter((r) => r.rank <= top);
        const list = unionForFilters(entries, rank, (x) => x.id).map((x) => {
          // 클러치 득점 줄: 야투 성공/시도·야투율을 숫자 아래에 (2026-11-01 사용자 — 야투율 부문을 따로 두지 않고 같이)
          const fgPct = clutchFgPct(x.t);
          // 숫자 아래는 짧게(폰에서 이름 칸이 좁아지지 않게) — 성공/시도는 둘째 줄로
          const fgNote = fgPct === null ? null : `야투율 ${fgPct.toFixed(1)}%`;
          let sub: string;
          if (def.key === "winning" || def.key === "buzzer") {
            const last = (def.key === "buzzer" ? x.shots.filter((s) => s.shot.buzzer) : x.shots)[0];
            sub = last
              ? `${scope === "all" ? "최근 " : ""}${seasonShortOf(last.seasonCode)} · ${last.date.slice(5).replace("-", ".")} vs ${teamNameInSeason(last.oppCode, last.seasonCode) ?? last.oppCode}`
              : "";
          } else {
            sub = `야투 ${x.t.fgm}/${x.t.fga} · 자유투 ${x.t.ftm}/${x.t.fta} · ${x.t.games}경기${x.t.winning > 0 ? ` · 위닝샷 ${x.t.winning}회` : ""}`;
          }
          return {
            rank: x.rank,
            id: x.id,
            num: rankNum(x.v),
            ...filterMetaOf(x.id),
            value: def.key === "fgPct" ? x.v.toFixed(1) : String(x.v),
            unit: def.unit,
            sub,
            note: def.key === "winning" && x.t.buzzer > 0 ? `버저비터 ${x.t.buzzer}회` : def.key === "pts" ? fgNote : null,
          };
        });
        lists[clutchListKey(stage, scope, def.key)] = list;
      }
    }
  }
  return (clutchListsCache = { people: collectPeople(lists), lists });
}

/** 위닝샷 목록 (모든 선수, 최근 먼저 n개) — 기록 탭 "클러치" 아래. 구분·기간마다 (키 = clutchListKey(구분, 기간, "shots")) */
let winningListsCache: Record<string, (ClutchShotRow & { id: string; nameKo: string; photoUrl: string | null; color: string })[]> | null = null;
export function loadWinningShotLists(n = 20): Record<string, (ClutchShotRow & { id: string; nameKo: string; photoUrl: string | null; color: string })[]> {
  if (winningListsCache) return winningListsCache;
  const all: { id: string; s: WinningEntry }[] = [];
  for (const [id, p] of loadClutchIndex()) for (const s of p.shots) all.push({ id, s });
  all.sort((a, b) => b.s.date.localeCompare(a.s.date) || b.s.gmkey.localeCompare(a.s.gmkey));
  const out: Record<string, (ClutchShotRow & { id: string; nameKo: string; photoUrl: string | null; color: string })[]> = {};
  const scopes: (number | "all")[] = ["all", ...clutchSeasonOptions().map((s) => s.seasonCode)];
  for (const { value: stage } of GAME_KINDS) {
    for (const scope of scopes) {
      out[clutchListKey(stage, scope, "shots")] = all
        .filter(({ s }) => shotInStage(s, stage) && (scope === "all" || s.seasonCode === scope))
        .slice(0, n)
        .map(({ id, s }) => {
          const e = findPlayerIndexEntry(id);
          const person = e ? personOf(e) : { nameKo: s.shot.nameKo, photoUrl: null, color: "#6b7280" };
          return { ...clutchShotRow(s), id, nameKo: person.nameKo, photoUrl: person.photoUrl, color: person.color };
        });
    }
  }
  return (winningListsCache = out);
}

/** 응원팀 고르기·관리자 화면용 팀 목록 = 선수 기록이 있는 최신 시즌 + 직전 시즌의 팀 (개막 직후 아직 경기를 안 한 팀을 채우려고, 같은 코드는 최신 시즌 값) */
export function loadAccountTeams(): { teamCode: string; name: string; logoUrl: string | null; color: Team["color"] }[] {
  const byCode = new Map<string, Team>();
  for (const s of listSeasonsWithPlayers().slice(0, 2)) for (const t of loadSeasonData(s.seasonCode)?.teams ?? []) if (!byCode.has(t.teamCode)) byCode.set(t.teamCode, t);
  return [...byCode.values()]
    .sort((a, b) => a.order - b.order)
    .map((t) => ({ teamCode: t.teamCode, name: t.shortNameKo, logoUrl: t.logoUrl, color: t.color }));
}

// ─────────────────────────────────────────────
// 팀 페이지 (/teams, /team/[팀코드], 2026-10-04) — 규칙은 lib/franchise
// ─────────────────────────────────────────────

let franchiseCache: Map<string, TeamPageData> | null = null;

/** 모든 팀 코드의 팀 페이지 재료 (빌드 때 한 번) */
export function loadFranchises(): Map<string, TeamPageData> {
  if (franchiseCache) return franchiseCache;
  const seasons = [...listSeasonsWithPlayers()].sort((a, b) => a.seasonCode - b.seasonCode);
  const recent = new Set(seasons.slice(-2).map((s) => s.seasonCode));
  const photo = new Map(loadPlayersIndex().map((e) => [e.id, e.photoUrl ?? null]));
  type Acc = {
    brand: TeamBrand;
    rows: TeamSeasonRow[];
    names: { seasonCode: number; name: string }[];
    rosters: Record<string, RosterRow[]>;
    lines: SeasonPlayerLine[];
    awards: TeamAwardLine[];
    awardRefs: { playerNo: string; key: string; seasonCode: number }[];
    active: boolean;
  };
  const acc = new Map<string, Acc>();
  const awardLabel = new Map<string, string>(AWARD_LABELS.map((a) => [a.key, a.label]));
  for (const s of seasons) {
    const data = loadSeasonData(s.seasonCode);
    if (!data) continue;
    const ongoing = isSeasonOngoing(s.seasonCode);
    const standings = computeStandings(loadSeasonGames(s.seasonCode));
    const top = standings.filter((r) => r.pct === standings[0]?.pct && r.wins === standings[0]?.wins);
    const namesOf = (code: string) => data.teams.filter((t) => t.teamCode === code).flatMap((t) => [t.shortNameKo, t.name, t.shortName]);
    const firsts = new Set(
      ongoing ? [] : pickRegularChampions(top.map((r) => ({ teamCode: r.teamCode, names: namesOf(r.teamCode) })), data.seasonAwards?.regular?.first ?? null),
    );
    const label = seasonShortLabel(data.seasonLabel);
    // 승패가 같은 맨 위 팀들은 공식 1위(firsts)를 앞에 두고 순위를 다시 매긴다 (경기 결과로는 상대 전적 동률 규칙을 모른다)
    // 공동 1위(19-20 DB·SK)는 둘 다 1위, 공식 1위가 아닌 동률 팀은 그다음 순위
    const others = top.map((r) => r.teamCode).filter((c) => !firsts.has(c));
    const rankOf = (code: string, fallback: number | null) =>
      firsts.size === 0 ? fallback : firsts.has(code) ? 1 : others.includes(code) ? firsts.size + others.indexOf(code) + 1 : fallback;
    for (const t of data.teams) {
      const players = data.players.filter((p) => p.teamCode === t.teamCode && p.games > 0);
      const st = standings.find((r) => r.teamCode === t.teamCode);
      if (players.length === 0 && !st) continue;
      let a = acc.get(t.teamCode);
      const brand: TeamBrand = { teamCode: t.teamCode, name: t.name, shortName: t.shortNameKo, logoUrl: t.logoUrl, color: t.color };
      if (!a) {
        a = { brand, rows: [], names: [], rosters: {}, lines: [], awards: [], awardRefs: [], active: false };
        acc.set(t.teamCode, a);
      }
      a.brand = brand; // 가장 최근 시즌 이름·로고
      if (recent.has(s.seasonCode)) a.active = true;
      a.names.push({ seasonCode: s.seasonCode, name: t.name });
      const per = (v: number, g: number) => (g > 0 ? Math.round((v / g) * 10) / 10 : 0);
      const roster: RosterRow[] = players
        .map((p) => ({
          id: p.playerNo,
          name: p.nameKo,
          pos: p.position ?? null,
          foreign: p.isForeign,
          gp: p.games,
          mpg: per(p.minutes, p.games),
          ppg: per(p.points, p.games),
          rpg: per(p.reb, p.games),
          apg: per(p.ast, p.games),
          spg: per(p.stl, p.games),
          bpg: per(p.blk, p.games),
          tpg: per(p.tov, p.games),
          tpmPg: per(p.tpm, p.games),
          fgm: p.fgm, fga: p.fga, tpm: p.tpm, tpa: p.tpa, ftm: p.ftm, fta: p.fta,
          photoUrl: photo.get(p.playerNo) ?? null,
        }))
        .sort((x, y) => y.ppg - x.ppg || y.gp - x.gp);
      a.rosters[String(s.seasonCode)] = roster;
      for (const p of players) {
        a.lines.push({
          id: p.playerNo, name: p.nameKo, photoUrl: photo.get(p.playerNo) ?? null, seasonCode: s.seasonCode,
          games: p.games, pts: p.points, reb: p.reb, ast: p.ast, stl: p.stl, blk: p.blk, tpm: p.tpm,
        });
      }
      const qualified = roster.filter((r) => r.gp >= Math.max(5, Math.round((st ? st.wins + st.losses : 0) * 0.3)));
      const scorer = (qualified.length > 0 ? qualified : roster)[0];
      const isChampion = data.champion?.teamCode === t.teamCode;
      const entry = data.playoffs?.find((e) => e.teamCode === t.teamCode);
      a.rows.push({
        seasonCode: s.seasonCode,
        label,
        name: t.name,
        shortName: t.shortNameKo,
        logoUrl: t.logoUrl,
        wins: st?.wins ?? 0,
        losses: st?.losses ?? 0,
        pct: st && st.wins + st.losses > 0 ? st.pct : null,
        rank: rankOf(t.teamCode, st?.rank ?? null),
        teamCount: data.teams.length,
        regularFirst: firsts.has(t.teamCode),
        stage: ongoing ? null : playoffStage(entry, isChampion, rankOf(t.teamCode, st?.rank ?? null)),
        ongoing,
        topScorer: scorer ? { id: scorer.id, name: scorer.name, ppg: scorer.ppg } : null,
      });
      for (const aw of data.seasonAwards?.awards ?? []) {
        if (!awardLabel.has(aw.key)) continue;
        for (const w of aw.winners) {
          if (w.teamCode !== t.teamCode || !w.playerNo) continue;
          a.awardRefs.push({ playerNo: w.playerNo, key: aw.key, seasonCode: s.seasonCode });
          a.awards.push({ seasonCode: s.seasonCode, label, key: aw.key, awardLabel: awardLabel.get(aw.key)!, playerNo: w.playerNo, name: w.name });
        }
      }
    }
  }
  const lineageMap = (teamLineage as { successor: Record<string, string> }).successor;
  const labelOf = new Map(seasons.map((s) => [s.seasonCode, seasonShortLabel(s.seasonLabel)]));
  const spanOf = (codes: readonly number[]) => {
    if (codes.length === 0) return "";
    const from = labelOf.get(codes[0]) ?? "";
    const to = labelOf.get(codes[codes.length - 1]) ?? "";
    return from === to ? from : `${from} ~ ${to}`;
  };
  franchiseCache = new Map();
  for (const [code, a] of acc) {
    const rows = [...a.rows].sort((x, y) => y.seasonCode - x.seasonCode);
    const codes = rows.map((r) => r.seasonCode).sort((x, y) => x - y);
    const tenures = buildTenures(a.lines, a.awardRefs);
    const withSpan = (t: PlayerTenure) => ({ ...t, span: spanOf(t.seasonCodes) });
    const legends = pickLegends(tenures).map(withSpan);
    franchiseCache.set(code, {
      brand: a.brand,
      active: a.active,
      spanLabel: a.active ? `${labelOf.get(codes[0]) ?? ""} ~` : spanOf(codes),
      names: nameSpans(a.names).reverse().map((n) => ({ name: n.name, span: spanOf([n.from, n.to]) })),
      rows,
      totals: franchiseTotals(rows),
      rosters: a.rosters,
      legends,
      longest: legends.length > 0 ? [] : longestTenures(tenures).map(withSpan),
      leaders: TEAM_LEADER_STATS.map((s) => ({ key: s.key, label: s.label, list: franchiseLeaders(tenures, s.key) })),
      awards: [...a.awards].sort((x, y) => y.seasonCode - x.seasonCode),
      lineage: [],
    });
  }
  for (const [code, page] of franchiseCache) {
    const chain = lineageChain(code, lineageMap).filter((c) => franchiseCache!.has(c));
    page.lineage = chain.length > 1
      ? chain.map((c) => {
          const p = franchiseCache!.get(c)!;
          return { ...p.brand, active: p.active, span: p.spanLabel };
        })
      : [];
  }
  return franchiseCache;
}

/** 팀 목록 (/teams): 지금 팀(최신 시즌 순서) + 추억의 팀(첫 시즌 순) */
export function loadTeamIndex(): TeamIndexEntry[] {
  const all = loadFranchises();
  const latest = listSeasonsWithPlayers()[0]?.seasonCode;
  const prev = listSeasonsWithPlayers()[1]?.seasonCode;
  const orderOf = new Map<string, number>();
  for (const code of [prev, latest]) for (const t of (code ? loadSeasonData(code)?.teams : null) ?? []) orderOf.set(t.teamCode, t.order);
  const lineageMap = (teamLineage as { successor: Record<string, string> }).successor;
  return [...all.values()].map((p) => {
    const chain = lineageChain(p.brand.teamCode, lineageMap);
    const last = chain[chain.length - 1];
    const successor = !p.active && last !== p.brand.teamCode ? all.get(last) : undefined;
    return {
      brand: p.brand,
      active: p.active,
      spanLabel: p.spanLabel,
      seasons: p.totals.seasons,
      championships: p.totals.championships,
      regularFirsts: p.totals.regularFirsts,
      order: p.active ? (orderOf.get(p.brand.teamCode) ?? 99) : (p.rows[p.rows.length - 1]?.seasonCode ?? 0),
      successorName: successor?.brand.name ?? null,
    };
  }).sort((a, b) => Number(b.active) - Number(a.active) || a.order - b.order);
}

/**
 * 기록 탭 "프로필" (2026-10-30, 규칙 lib/profile-ranks): 기간(역대 전체 · 시즌마다) × 부문 12개.
 * 시즌 기간 = 그 시즌 정규시즌에 뛴 선수(팀·시즌 수는 그 시즌까지), 역대 = 색인 전원. 키 대비 기록의 표본은 시즌 = 그 시즌 기본 기준(seasonQualify), 역대 = 통산 200경기.
 * 빌드 때 페이지 하나 + 목록 파일(app/records/data/profile)이 같이 부르므로 한 번만 계산한다.
 */
let profileListsCache: RecordListsData | null = null;
export function loadProfileRankLists(): RecordListsData {
  if (profileListsCache) return profileListsCache;
  const successor = (teamLineage as { successor: Record<string, string> }).successor;
  const index = loadPlayersIndex();
  const seasons = listSeasonsWithPlayers().map((s) => s.seasonCode).sort((a, b) => a - b);
  const labelOf = new Map(listAllSeasons().map((s) => [s.seasonCode, s.seasonLabel]));
  // 선수 → 시즌 → 그 시즌 기록 (키 대비 기록·역대 합계 재료)
  const statOf = new Map<string, Map<number, { games: number; minutes: number; reb: number; blk: number; tpm: number; tpa: number }>>();
  const maxGames = new Map<number, number>();
  for (const code of seasons) {
    const season = loadSeasonData(code);
    for (const p of season?.players ?? []) {
      if (!statOf.has(p.playerNo)) statOf.set(p.playerNo, new Map());
      statOf.get(p.playerNo)!.set(code, { games: p.games, minutes: p.minutes, reb: p.reb, blk: p.blk, tpm: p.tpm ?? 0, tpa: p.tpa });
      maxGames.set(code, Math.max(maxGames.get(code) ?? 0, p.games));
    }
  }
  const inputFor = (e: PlayerIndexEntry, upTo: number | "all"): ProfileRankInput | null => {
    const played = e.seasons.filter((s) => s.games > 0 && (upTo === "all" || s.seasonCode <= upTo));
    if (played.length === 0) return null;
    const first = played[0];
    const last = played[played.length - 1];
    const path = teamPathOf(played.map((s) => s.teamCode), successor);
    const meta = filterMetaOf(e.id);
    const lastLabel = labelOf.get(last.seasonCode) ?? "";
    const firstLabel = labelOf.get(first.seasonCode) ?? "";
    let stat: ProfileRankInput["stat"] = null;
    let minTpa = PROFILE_CAREER_MIN_TPA;
    const rows = statOf.get(e.id);
    if (upTo === "all") {
      const sum = { games: 0, reb: 0, blk: 0, tpm: 0, tpa: 0 };
      for (const r of rows?.values() ?? []) {
        sum.games += r.games;
        sum.reb += r.reb;
        sum.blk += r.blk;
        sum.tpm += r.tpm;
        sum.tpa += r.tpa;
      }
      if (sum.games >= PROFILE_CAREER_MIN_GAMES) stat = sum;
    } else {
      const r = rows?.get(upTo);
      if (r && isQualified(r, seasonQualify(upTo))) stat = { games: r.games, reb: r.reb, blk: r.blk, tpm: r.tpm, tpa: r.tpa };
      minTpa = seasonMinTpa(maxGames.get(upTo) ?? 0);
    }
    return {
      id: e.id,
      origin: meta.origin,
      heightCm: e.heightCm ?? null,
      weightKg: e.weightKg ?? null,
      birthday: e.birthday ?? null,
      oldOn: seasonOpeningDate(lastLabel),
      youngOn: seasonOpeningDate(upTo === "all" ? firstLabel : lastLabel),
      seasons: played.length,
      teams: path.teams,
      teamPath: path.stints.map((i) => played[i].teamShort),
      positionLabel: e.positionLabel ?? null,
      teamShort: last.teamShort,
      span: seasonRangeLabel(firstLabel, lastLabel),
      stat,
      minTpa,
    };
  };
  const lists: Record<string, RecordListItem[]> = {};
  const scopes: (number | "all")[] = ["all", ...seasons];
  for (const scope of scopes) {
    // 시즌 기간 = 그 시즌에 뛴 선수만 (마지막 뛴 시즌 = 그 시즌)
    const pool = attachRebResiduals(
      index.flatMap((e) => {
        if (scope !== "all" && !e.seasons.some((s) => s.seasonCode === scope && s.games > 0)) return [];
        const x = inputFor(e, scope);
        return x ? [x] : [];
      }),
    );
    for (const def of PROFILE_RANK_DEFS) {
      const rank = (p: ProfileRankInput[], top = RECORD_LIST_TOP) => withRanks(rankProfile(p, def.key), (r) => r.num).filter((r) => r.rank <= top);
      lists[profileListKey(scope, def.key)] = unionForFilters(pool, rank, (x) => x.id).map((x) => {
        const f = formatProfileRank(x, def.key, x.value);
        return {
          rank: x.rank,
          id: x.id,
          num: x.num,
          ...filterMetaOf(x.id),
          value: f.value,
          unit: def.unit,
          sub: profileRankSub(x, def.key),
          note: f.note,
        };
      });
    }
  }
  return (profileListsCache = { people: collectPeople(lists), lists });
}
