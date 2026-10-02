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
  SeasonOption,
} from "./types";
import { decodeSeasonCards, encodeSeasonCards, type SeasonCards, type SeasonCardsFile } from "./cards";
import { toCardPlayers as convertCardPlayers, toCardTeams, toLeaderPlayers as convertLeaderPlayers } from "./convert";
import { buildSeasonHighCards, type SeasonHighCard } from "./highs";
import { careerHighAchievements, careerHighTabs, type CareerHighRow, type HighAchievement, type HighsTab } from "./career";
import { buildPlayerShotsFile, type PlayerShotsFile, type ShotPoint } from "./shots";
import { isActiveCareer, nextMilestones, sumCareerTotals, type CareerTotal, type Milestone } from "./records";
import { nationalityOf, schoolGroupOf } from "./roster";
import { findSimilar, toAxisVector, type SimilarEntry, type SimilarVector } from "./similar";
import { pickPrimeSeasons, primeCandidatesOf, type PrimeCandidate } from "./prime";
import { buildCardEntry, gradeGroupOf, isQualified } from "./metrics";
import { seasonContext } from "./cardview";
import { seasonLeaderMarks, type LeaderStatKey, type StatMode } from "./leaders";
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
export function listSeasonsWithPlayers(): SeasonOption[] {
  const seasons = readJson<SeasonOption[]>("seasons.json");
  return seasons
    .filter((s) => (loadSeasonData(s.seasonCode)?.players.length ?? 0) > 0)
    .sort((a, b) => b.seasonCode - a.seasonCode);
}

const photoOf = (playerNo: string) => findPlayerIndexEntry(playerNo)?.photoUrl ?? null;

/** 화면에 넘길 최소 필드만 추린다 (규칙은 lib/convert.ts). 사진 주소는 선수 색인(players-index.json)에서 playerNo로 찾는다 */
export function toCardPlayers(season: SeasonData): CardPlayer[] {
  return convertCardPlayers(season, photoOf);
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
    m = {
      perGame: seasonLeaderMarks(rows, "perGame"),
      total: seasonLeaderMarks(rows, "total"),
      per30: seasonLeaderMarks(rows, "per30"),
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
  return { entry, seasons };
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
      if (!isQualified(p, cards.defaults.rule)) continue;
      const e = buildCardEntry(p, ctx);
      const axes = toAxisVector(e.radar.axes);
      if (!axes) continue;
      out.push({
        id: p.id,
        seasonCode: s.seasonCode,
        pool: gradeGroupOf(p, ctx.grading.mergeAsia) === "domestic" ? "domestic" : "foreign",
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
    for (const p of seasonLeaderRows(season).values()) {
      const team = teams.find((t) => t.teamCode === p.teamCode);
      const idx = findPlayerIndexEntry(p.id);
      rows.push({
        id: p.id,
        nameKo: p.nameKo,
        photoUrl: idx?.photoUrl ?? p.photoUrl,
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
