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
  PlayerIndexEntry,
  SeasonData,
  SeasonOption,
} from "./types";
import {
  attemptsNote,
  axisSetFor,
  buildCardContext,
  buildCardEntry,
  DEFAULT_QUALIFY,
  qualifyLabel,
  type CardContext,
  type CardEntryOf,
  type RadarAxisSet,
} from "./metrics";

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

/** 선수가 1명 이상 있는 시즌만, 최신 시즌이 먼저 오도록 정렬 (개막 전 시즌은 숨김) */
export function listSeasonsWithPlayers(): SeasonOption[] {
  const seasons = readJson<SeasonOption[]>("seasons.json");
  return seasons
    .filter((s) => (loadSeasonData(s.seasonCode)?.players.length ?? 0) > 0)
    .sort((a, b) => b.seasonCode - a.seasonCode);
}

/** 팀 코드 → 한글 약칭 (Team.shortNameKo). 팀 목록에 없는 선수 팀은 선수 기록의 약칭 그대로 */
function koShortOf(season: SeasonData): (p: { teamCode: string; teamShort: string }) => string {
  const byCode = new Map(season.teams.map((t) => [t.teamCode, t.shortNameKo || t.shortName]));
  return (p) => byCode.get(p.teamCode) ?? p.teamShort;
}

/** 화면에 넘길 최소 필드만 추린다. 사진 주소는 선수 색인(players-index.json)에서 playerNo로 찾는다 */
export function toCardPlayers(season: SeasonData): CardPlayer[] {
  const koShort = koShortOf(season);
  return season.players.map((p) => ({
    id: p.playerNo,
    nameKo: p.nameKo,
    nameEn: p.nameEn,
    teamName: p.teamName,
    teamShort: koShort(p),
    teamCode: p.teamCode,
    isForeign: p.isForeign,
    photoUrl: findPlayerIndexEntry(p.playerNo)?.photoUrl ?? null,
    games: p.games,
    minutes: p.minutes,
    points: p.points,
    reb: p.reb,
    ast: p.ast,
    stl: p.stl,
    blk: p.blk,
    tov: p.tov,
    fga: p.fga,
    tpa: p.tpa,
    fta: p.fta,
    fgPct: p.fgPct,
    tpPct: p.tpPct,
    ftPct: p.ftPct,
    per: p.per,
    usgPct: p.usgPct,
    tsPct: p.tsPct,
    astPct: p.astPct,
    rebPct: p.rebPct,
    pie: p.pie,
  }));
}

/** 순위표에 넘길 최소 필드만 추린다 (Player 전체를 클라이언트로 보내지 않는다) */
export function toLeaderPlayers(season: SeasonData): LeaderPlayer[] {
  const koShort = koShortOf(season);
  return season.players.map((p) => ({
    id: p.playerNo,
    nameKo: p.nameKo,
    nameEn: p.nameEn,
    teamCode: p.teamCode,
    teamShort: koShort(p),
    isForeign: p.isForeign,
    photoUrl: findPlayerIndexEntry(p.playerNo)?.photoUrl ?? null,
    games: p.games,
    minutes: p.minutes,
    points: p.points,
    reb: p.reb,
    ast: p.ast,
    stl: p.stl,
    blk: p.blk,
    tov: p.tov,
    fgm: p.fgm,
    fga: p.fga,
    tpm: p.tpm,
    tpa: p.tpa,
    ftm: p.ftm,
    fta: p.fta,
    fgPct: p.fgPct,
    tpPct: p.tpPct,
    ftPct: p.ftPct,
    tsPct: p.tsPct,
    per: p.per,
  }));
}

/** 화면에 넘길 팀 정보 (한글 약칭·로고·색만). 옛 processed 파일(shortNameKo 없음)이면 영문 약칭으로 */
export function toCardTeams(season: SeasonData): CardTeam[] {
  return season.teams.map((t) => ({
    teamCode: t.teamCode,
    shortName: t.shortNameKo || t.shortName,
    logoUrl: t.logoUrl ?? null,
    color: t.color,
  }));
}

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
    });
  }
  return { entry, seasons };
}

/** 선수 페이지에 넣을 플레이어 카드 한 장 — 서버에서 계산해 결과만 넘긴다 (시즌 선수 전체를 보내지 않기 위해) */
export interface PlayerCardData {
  entry: CardEntryOf<CardPlayer>;
  team: CardTeam | null;
  seasonCode: number;
  seasonLabel: string;
  axisSet: RadarAxisSet;
  ruleLabel: string;
  qualifiedCount: number;
  attemptsLabel: string;
}

const cardSeasonCache = new Map<number, { players: Map<string, CardPlayer>; ctx: CardContext }>();

/**
 * 그 시즌 플레이어 카드: 비교 집단은 플레이어 카드 화면의 기본값(DEFAULT_QUALIFY)과 같다 →
 * 같은 선수·시즌이면 /season/[코드] 의 기본 카드와 순위·등급이 같다.
 */
export function loadPlayerCard(playerNo: string, seasonCode: number): PlayerCardData | null {
  const season = loadSeasonData(seasonCode);
  if (!season) return null;
  let c = cardSeasonCache.get(seasonCode);
  if (!c) {
    const players = toCardPlayers(season);
    c = {
      players: new Map(players.map((p) => [p.id, p])),
      ctx: buildCardContext(players, DEFAULT_QUALIFY, axisSetFor(season.coverage)),
    };
    cardSeasonCache.set(seasonCode, c);
  }
  const p = c.players.get(playerNo);
  if (!p) return null;
  return {
    entry: buildCardEntry(p, c.ctx),
    team: seasonTeams(season).find((t) => t.teamCode === p.teamCode) ?? null,
    seasonCode,
    seasonLabel: season.seasonLabel,
    axisSet: c.ctx.set,
    ruleLabel: qualifyLabel(c.ctx.rule),
    qualifiedCount: c.ctx.qualifiedCount,
    attemptsLabel: attemptsNote(c.ctx.thresholds),
  };
}
