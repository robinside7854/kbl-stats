// raw → processed 변환
// data/raw/{season}/traditional_regular.json + advanced_regular.json + teams.json
//   (+ data/raw/players/players.json 선수 마스터 — 있으면 playerNo 로 조인해 포지션·국적·신장 등 프로필을 붙인다)
//   (+ data/raw/highs/{season}/{playerNo}.json 한 경기 최다 — 선수 seasonHighs, 시즌 seasonHighLeaders, 색인 careerHighs)
//   (+ data/raw/profiles/{playerNo}.json 프로필 — 색인 birthday·country·school)
//   (+ data/raw/gamelogs/{season}/{playerNo}.json 경기별 기록 — 한 경기 최다 3점·자유투·야투 성공에 그 경기 attempts·pct)
//   (+ data/raw/shots/{season}/{gmkey}.json 슛 차트 + data/raw/games/{season}/list.json 경기 목록 — 정규시즌 경기의 슛 좌표를
//      선수별로 모아 players[].shotZones·시즌 shotZoneLeague·coverage.shots, 점 좌표는 data/processed/{season}/shots.json)
//   → data/processed/{season}/players.json (lib/types.ts의 SeasonData 형태: coverage·teams·players)
// 모든 시즌을 가공한 뒤
//   → data/processed/seasons.json (시즌 목록), data/processed/players-index.json (선수 색인)
//
// raw 파일은 절대 수정하지 않는다. 이 스크립트는 몇 번 다시 돌려도 같은 결과가 나와야 한다.

import { awardRows, matchAwardPlayer, PROFILE_AWARD_KEYS, seasonTeamResults, type AwardRow } from "./awards";
import { championSeasonsOf, finalsChampion, playoffEntries, type PlayoffEntry, type SeasonChampion } from "./champions";
import { readdir, readFile, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, HIGHLIGHT_SOURCE, SEASON_CODES_FALLBACK } from "./config.js";
import { computeTeamShareStats, seasonCoverage, usgFromKbl } from "../lib/metrics.js";
import { playerPhotoUrl, teamLogoUrl } from "./image-urls.js";
import { teamShortNameKo } from "../lib/teams.js";
import { buildProfileMap, masterRows, EMPTY_PROFILE, EMPTY_PROFILE_EXTRA, isForeignPlayer, profileExtraFrom, type ProfileExtra } from "./player-master.js";
import { nationalityOf, rosterStatusOf } from "../lib/roster.js";
import { hasCareerHighs, parseMostGame, todayKst, type ParsedMostGame } from "./highs.js";
import { buildSeasonGames, parseBoxLog, type BoxLogRow } from "./boxscores.js";
import { matchHighlights, readSavedFeeds, type FeedEntry } from "./highlights.js";
import { attachShotAttempts, parseGameLog, type GameLogRow } from "./gamelogs.js";
import { computeSeasonHighLeaders, SHOT_HIGH_KEYS } from "../lib/highs.js";
import { regularGamesOf } from "./shots.js";
import { AWARD_SEEN_SEASONS, awardSeenKey, updateAwardSeen, type AwardSeenState } from "./award-seen.js";
import { leagueZoneAverages, normalizeShot, toShotPoint, zoneSummary, type NormalizedShot } from "../lib/shots.js";
import type { AwardKey, SeasonAwards, CareerHighs, HighsSet, Player, PlayerIndexEntry, PlayerProfile, PostseasonFile, PostseasonLine, SeasonData, Team, TeamColor } from "../lib/types.js";

type Raw = Record<string, any>;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

/** 선수 마스터 (playerNo → 프로필). main() 이 파일을 읽어 채운다. 파일이 없으면 빈 Map → 모두 EMPTY_PROFILE */
let profiles = new Map<string, PlayerProfile>();

/**
 * 통산 한 경기 최다 (playerNo → 그 선수의 가장 최근 시즌 raw 의 AllTimes). processSeason 이 시즌 오름차순으로 채우므로
 * 나중 시즌이 덮어쓴다 = 최신 시즌 raw 우선.
 */
let awardsRaw: unknown = null;
const careerHighsByPlayer = new Map<string, CareerHighs>();
/** 한 경기 최다 raw 가 있었던 시즌 수 (경고 한 줄용) */
let highsSeasonCount = 0;
const unknownHighsKeys = new Set<string>();

/**
 * 한 시즌의 한 경기 최다 raw (data/raw/highs/{season}/*.json) → playerNo → 파싱 결과. 폴더가 없으면 빈 Map.
 * 깨진 파일은 건너뛴다(그 선수만 null).
 */
/** 시즌 우승팀 (경기 목록 챔프전, scripts/champions.ts). 목록이 없거나 4승 팀이 없으면 null */
async function readSeasonChampion(seasonCode: number): Promise<SeasonChampion | null> {
  try {
    const list = JSON.parse(await readFile(join(DATA_DIR, "raw", "games", String(seasonCode), "list.json"), "utf8"));
    return finalsChampion(list, seasonCode);
  } catch {
    return null;
  }
}

/** 시즌 플레이오프 출전 팀 (경기 목록 03·04, scripts/champions.ts playoffEntries). 목록이 없으면 빈 배열 */
async function readSeasonPlayoffs(seasonCode: number): Promise<PlayoffEntry[]> {
  try {
    const list = JSON.parse(await readFile(join(DATA_DIR, "raw", "games", String(seasonCode), "list.json"), "utf8"));
    return playoffEntries(list, seasonCode);
  } catch {
    return [];
  }
}

/**
 * 시즌 경기 + 박스스코어 → data/processed/{시즌}/games.json (scripts/boxscores.ts, 2026-10-03 홈 "오늘의 경기"·팀 순위).
 * 경기 목록이 없으면 파일을 지운다. 선수 이름은 그 시즌 명단.
 */
let highlightEntries: FeedEntry[] | undefined;
async function writeSeasonGames(seasonCode: number, players: readonly { playerNo: string; nameKo: string }[]): Promise<string> {
  const outFile = join(DATA_DIR, "processed", String(seasonCode), "games.json");
  let list: unknown;
  try {
    list = JSON.parse(await readFile(join(DATA_DIR, "raw", "games", String(seasonCode), "list.json"), "utf8"));
  } catch {
    await rm(outFile, { force: true });
    return "";
  }
  const logs = new Map<string, BoxLogRow[]>();
  const dir = join(DATA_DIR, "raw", "gamelogs", String(seasonCode));
  for (const f of await readdir(dir).catch(() => [] as string[])) {
    if (!f.endsWith(".json")) continue;
    try {
      logs.set(f.replace(/\.json$/, ""), parseBoxLog(JSON.parse(await readFile(join(dir, f), "utf8"))));
    } catch {
      /* 깨진 파일은 건너뜀 — 그 경기는 득점 합이 안 맞아 box null */
    }
  }
  const names = new Map(players.map((p) => [p.playerNo, p.nameKo]));
  const games = buildSeasonGames(list, seasonCode, logs, (id) => names.get(id) ?? null, todayKst());
  // 하이라이트 영상 (쌓아 둔 유튜브 RSS — 2026-10-04)
  highlightEntries ??= await readSavedFeeds(join(DATA_DIR, "raw", "highlights", HIGHLIGHT_SOURCE));
  const clips = matchHighlights(games, highlightEntries);
  for (const g of games) {
    const v = clips.get(g.gmkey);
    if (v) g.highlight = v;
  }
  if (games.length === 0) {
    await rm(outFile, { force: true });
    return "";
  }
  // 한 줄 = 경기 하나 (git diff 가 읽히게)
  await writeFile(outFile, `{"seasonCode":${seasonCode},"games":[\n${games.map((g) => JSON.stringify(g)).join(",\n")}\n]}\n`, "utf8");
  const boxed = games.filter((g) => g.box).length;
  return `, 경기 ${games.length}${boxed ? `(박스스코어 ${boxed}${clips.size ? `·하이라이트 ${clips.size}` : ""})` : ""}`;
}

async function readSeasonHighs(seasonCode: number): Promise<Map<string, ParsedMostGame>> {
  const dir = join(DATA_DIR, "raw", "highs", String(seasonCode));
  const out = new Map<string, ParsedMostGame>();
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return out;
  }
  for (const f of files) {
    try {
      const parsed = parseMostGame(JSON.parse(await readFile(join(dir, f), "utf8")));
      parsed.unknownKeys.forEach((k) => unknownHighsKeys.add(k));
      out.set(f.replace(/\.json$/, ""), parsed);
    } catch {
      console.warn(`[${seasonCode}] 한 경기 최다 파일 읽기 실패: ${f}`);
    }
  }
  return out;
}

/**
 * 경기별 기록 (시즌 코드 → 선수 번호 → 경기 목록). main() 이 data/raw/gamelogs/{시즌}/{선수}.json 을 전부 읽어 채운다.
 * 없으면 빈 Map → 한 경기 최다에 시도 수가 붙지 않는다(attempts 필드 없음 → 화면은 개수만).
 */
let gameLogs = new Map<number, Map<string, GameLogRow[]>>();
/** 시도 수를 붙인 슛 기록 수 / 경기별 raw 는 있는데 그날 경기를 못 찾은 수 (로그용) */
const shotStats = { attached: 0, missing: 0 };

async function readGameLogs(): Promise<Map<number, Map<string, GameLogRow[]>>> {
  const root = join(DATA_DIR, "raw", "gamelogs");
  const out = new Map<number, Map<string, GameLogRow[]>>();
  let dirs: string[];
  try {
    dirs = (await readdir(root)).filter((d) => /^\d+$/.test(d));
  } catch {
    console.warn(`경기별 기록 없음(${root}) → 한 경기 최다 시도 수 없음`);
    return out;
  }
  let files = 0;
  for (const d of dirs) {
    const bySeason = new Map<string, GameLogRow[]>();
    for (const f of (await readdir(join(root, d))).filter((x) => x.endsWith(".json"))) {
      try {
        bySeason.set(f.replace(/\.json$/, ""), parseGameLog(JSON.parse(await readFile(join(root, d, f), "utf8"))));
        files++;
      } catch {
        console.warn(`[${d}] 경기별 기록 파일 읽기 실패: ${f}`);
      }
    }
    out.set(Number(d), bySeason);
  }
  console.log(`경기별 기록: ${files}개 파일 (시즌 ${out.size}개)`);
  return out;
}

/** 한 선수의 세트에 슛 시도 수를 붙이고 로그용으로 센다 */
function withShots(set: HighsSet | null, playerNo: string, fallbackSeason: number | null): HighsSet | null {
  const out = attachShotAttempts(set, (season) => gameLogs.get(season)?.get(playerNo), fallbackSeason);
  for (const k of SHOT_HIGH_KEYS) {
    const r = out?.[k];
    if (!r || r.attempts === undefined) continue;
    if (r.attempts === null) shotStats.missing++;
    else shotStats.attached++;
  }
  return out;
}

/** 슛 차트를 읽은 시즌 수·점 수 (로그용) */
const shotChartStats = { seasons: 0, points: 0, skipped: 0 };

/**
 * 한 시즌의 슛 차트 raw → 선수 번호 → 정규화한 점 목록 (lib/shots normalizeShot). 폴더가 없거나 점이 0개면 null.
 * 대상 경기: 경기 목록(data/raw/games/{시즌}/list.json)에서 seasonCode 가 같고 gameCode "01"(정규시즌)인 gmkey.
 * 목록이 없으면 gmkey 모양(S{시즌}G01N…)으로 거른다. 깨진 파일·형식이 다른 파일은 건너뛴다.
 */
async function readSeasonShots(seasonCode: number): Promise<Map<string, NormalizedShot[]> | null> {
  const dir = join(DATA_DIR, "raw", "shots", String(seasonCode));
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return null;
  }
  let isRegular: (gmkey: string) => boolean;
  try {
    const list = JSON.parse(await readFile(join(DATA_DIR, "raw", "games", String(seasonCode), "list.json"), "utf8"));
    const keys = new Set(regularGamesOf(list, seasonCode).map((g) => g.gmkey));
    isRegular = (k) => keys.has(k);
  } catch {
    console.warn(`[${seasonCode}] 경기 목록 없음 → 슛 차트 gmkey 모양(S${seasonCode}G01N…)으로 정규시즌을 거름`);
    const re = new RegExp(`^S${seasonCode}G01N\\d+$`);
    isRegular = (k) => re.test(k);
  }
  const out = new Map<string, NormalizedShot[]>();
  let points = 0;
  for (const f of files.sort()) {
    const gmkey = f.replace(/\.json$/, "");
    if (!isRegular(gmkey)) continue;
    let body: unknown;
    try {
      body = JSON.parse(await readFile(join(dir, f), "utf8"));
      if (typeof body === "string") body = JSON.parse(body);
    } catch {
      console.warn(`[${seasonCode}] 슛 차트 파일 읽기 실패: ${f}`);
      continue;
    }
    const log = (body as Raw | null)?.shootLog;
    if (!Array.isArray(log)) continue;
    for (const p of log as Raw[]) {
      const playerNo = String(p?.pcode ?? "").trim();
      if (!playerNo || !Array.isArray(p.logs)) continue;
      let list = out.get(playerNo);
      if (!list) out.set(playerNo, (list = []));
      for (const l of p.logs as Raw[]) {
        const s = normalizeShot(l as never);
        if (s) {
          list.push(s);
          points++;
        } else shotChartStats.skipped++;
      }
    }
  }
  if (points === 0) return null;
  shotChartStats.seasons++;
  shotChartStats.points += points;
  return out;
}

function toPlayer(t: Raw, a: Raw | undefined): Player {
  const profile = profiles.get(String(t.playerNo)) ?? EMPTY_PROFILE;
  return {
    playerNo: String(t.playerNo),
    nameKo: t.kname ?? "",
    nameEn: t.ename ?? "",
    teamCode: String(t.teamCode ?? ""),
    teamName: t.teamName1 ?? "",
    teamShort: t.teamName4 ?? "",
    // 마스터 국적이 있으면 nationality !== "domestic", 없으면 이름 추정 (scripts/player-master.ts isForeignPlayer)
    isForeign: isForeignPlayer(profile.nationality, t.kname ?? ""),
    ...profile,

    games: num(t.gameCount),
    wins: num(t.win),
    losses: num(t.lose),
    minutes: Math.round(num(t.playSec) / 60),

    points: num(t.score),
    // ⚠️ KBL 필드 이름과 뜻이 엇갈린다: fg/fgA/fgRt = 2점슛, fdg/fdgA/fdgRt = 전체 야투(2점+3점).
    //    근거(2026-09-30, 1997·2011-12·2025-26 전 선수 확인): fdg = fg + threep, fdgA = fgA + threepA,
    //    score = 2×fg + 3×threep + ft. 예: 2025-26 워니 야투 482/1091(44.2%), 2점 396/794(49.9%).
    fgm: num(t.fdg), fga: num(t.fdgA), fgPct: num(t.fdgRt),
    tpm: num(t.threep), tpa: num(t.threepA), tpPct: num(t.threepRt),
    twoPm: num(t.fg), twoPa: num(t.fgA), twoPPct: num(t.fgRt),
    ftm: num(t.ft), fta: num(t.ftA), ftPct: num(t.ftRt),
    dunks: num(t.dk),
    oreb: num(t.oR), dreb: num(t.dR), reb: num(t.rb),
    ast: num(t.aS), stl: num(t.sT), blk: num(t.bS), tov: num(t.tO),
    goodDef: num(t.gd),
    fouls: num(t.foulTot),
    doubleDoubles: num(t.dd2),
    tripleDoubles: num(t.td3),
    plusMinus: num(t.margin),
    screenAst: num(t.sA),
    deflections: num(t.df),

    per: num(a?.perRt),
    offRtg: num(a?.offrtg), defRtg: num(a?.defrtg), netRtg: num(a?.netrtg),
    efgPct: num(a?.efgRt), tsPct: num(a?.tsRt),
    astPct: num(a?.astRt), astTo: num(a?.astTo), astRatio: num(a?.astRatio),
    orebPct: num(a?.orebRt), drebPct: num(a?.drebRt), rebPct: num(a?.rebRt),
    // KBL USG% 는 표준식의 1/5 → 표준 척도로 (lib/metrics.ts usgFromKbl 주석). 원값은 usgPctRaw
    usgPct: usgFromKbl(num(a?.usgRt)),
    usgPctRaw: num(a?.usgRt),
    pace: num(a?.pace),
    tovPct: num(a?.tovRt), toRatio: num(a?.toRatio),
    pie: num(a?.pie),
    poss: num(a?.poss),
  };
}

/**
 * raw teams.json 읽기. 수집 시 응답이 문자열로 한 번 더 감싸져 저장된 시즌이 많아
 * (파일 내용이 "{\r\n \"teamList\": [...]}" 형태) JSON.parse 결과가 문자열이면 한 번 더 푼다.
 * 파일이 없거나 형식이 다르면 null.
 */
async function readRawTeams(rawDir: string): Promise<Raw[] | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(join(rawDir, "teams.json"), "utf8"));
  } catch {
    return null;
  }
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  const list = (parsed as Raw | null)?.teamList;
  return Array.isArray(list) ? list : null;
}

/**
 * 팀 색상표 (data/codes/team-colors.json) — 손으로 관리하는 파일. 팀 코드별 색, 없으면 default.
 * 파일이 없거나 깨졌으면 회색 기본값으로 계속 진행한다.
 */
interface TeamColorTable {
  byTeamCode: Record<string, TeamColor>;
  fallback: TeamColor;
}
const GRAY: TeamColor = { primary: "#6B7280", secondary: "#9CA3AF", text: "#fff" };

async function readTeamColors(): Promise<TeamColorTable> {
  try {
    const raw = JSON.parse(await readFile(join(DATA_DIR, "codes", "team-colors.json"), "utf8"));
    return { byTeamCode: raw.byTeamCode ?? {}, fallback: raw.default ?? GRAY };
  } catch (e) {
    console.warn(`team-colors.json 읽기 실패 → 전 팀 회색 기본값: ${(e as Error).message}`);
    return { byTeamCode: {}, fallback: GRAY };
  }
}

/**
 * 사진 덮어쓰기 목록 (data/codes/photo-overrides.json) — 손으로 관리하는 파일.
 * KBL 이 코치가 된 선수의 사진을 코치 사진으로 바꿔 두어 옛 기록에도 그 사진이 뜨는 경우, 사용자가 선수 번호를 hide 에 적는다.
 * hide 에 있는 선수는 photoUrl 을 null 로 → 화면은 대체 디자인(팀 색 + 이니셜). 파일이 없거나 깨졌으면 빈 목록.
 */
let hiddenPhotos = new Set<string>();

async function readPhotoOverrides(): Promise<Set<string>> {
  try {
    const raw = JSON.parse(await readFile(join(DATA_DIR, "codes", "photo-overrides.json"), "utf8"));
    const hide: unknown[] = Array.isArray(raw.hide) ? raw.hide : [];
    const set = new Set(hide.map((x) => String(x).trim()).filter(Boolean));
    if (set.size > 0) console.log(`사진 숨김(photo-overrides.json): ${set.size}명`);
    return set;
  } catch (e) {
    console.warn(`photo-overrides.json 읽기 실패 → 사진 숨김 없음: ${(e as Error).message}`);
    return new Set();
  }
}

/** 선수 사진 주소. 덮어쓰기 목록(hide)에 있으면 null */
function photoUrlOf(playerNo: string): string | null {
  return hiddenPhotos.has(playerNo) ? null : playerPhotoUrl(playerNo);
}

function teamColor(table: TeamColorTable, teamCode: string): TeamColor {
  // 표에 name 등 설명 필드가 있어도 세 값만 골라 쓴다
  const c = table.byTeamCode[teamCode] ?? table.fallback;
  return { primary: c.primary, secondary: c.secondary, text: c.text };
}

let teamColors: TeamColorTable = { byTeamCode: {}, fallback: GRAY };

function toTeam(t: Raw): Team {
  const teamCode = String(t.teamCode ?? "");
  const logoName = (t.teamLogoName ?? "").trim();
  const name = (t.teamName1 ?? "").trim();
  return {
    teamCode,
    name,
    shortName: (t.teamName4 ?? "").trim(),
    shortNameKo: teamShortNameKo(name),
    fullName: (t.teamName2 ?? "").trim(),
    nameEn: (t.teamName3 ?? "").trim(),
    logoName,
    order: num(t.orderNo),
    logoUrl: teamLogoUrl(logoName),
    color: teamColor(teamColors, teamCode),
  };
}

/** teams.json이 없거나 비어 있는 시즌: 선수 데이터의 팀 코드·이름으로 대체 (첫 등장 순서) */
function teamsFromPlayers(players: Player[]): Team[] {
  const seen = new Map<string, Team>();
  for (const p of players) {
    if (!p.teamCode || seen.has(p.teamCode)) continue;
    seen.set(p.teamCode, {
      teamCode: p.teamCode,
      name: p.teamName,
      shortName: p.teamShort,
      shortNameKo: teamShortNameKo(p.teamName),
      fullName: p.teamName,
      nameEn: "",
      logoName: "",
      order: seen.size + 1,
      logoUrl: null,
      color: teamColor(teamColors, p.teamCode),
    });
  }
  return [...seen.values()];
}

/**
 * 플레이오프·챔프전 시즌 합계 raw(traditional_playoff/finals.json) → data/processed/{시즌}/postseason.json.
 * 둘 다 raw 가 없으면 파일을 만들지 않는다(옛 파일은 지움 — 재실행해도 같은 결과). 반환: 줄 수 요약
 */
async function writePostseason(seasonCode: number): Promise<string | null> {
  const rawDir = join(DATA_DIR, "raw", String(seasonCode));
  const read = async (name: string): Promise<PostseasonLine[] | null> => {
    let raw: Raw;
    try {
      raw = JSON.parse(await readFile(join(rawDir, `traditional_${name}.json`), "utf8"));
    } catch {
      return null;
    }
    if (!Array.isArray(raw?.data)) return null;
    return (raw.data as Raw[])
      .map((t) => {
        const p = toPlayer(t, undefined);
        return {
          playerNo: p.playerNo, nameKo: p.nameKo, teamCode: p.teamCode,
          games: p.games, minutes: p.minutes, points: p.points, reb: p.reb, ast: p.ast, stl: p.stl, blk: p.blk,
          tpm: p.tpm, ftm: p.ftm, doubleDoubles: p.doubleDoubles, tripleDoubles: p.tripleDoubles,
          // 선수 상세 시즌별 기록 "플레이오프" 보기용 (2026-10-05)
          wins: p.wins, losses: p.losses, tov: p.tov, fouls: p.fouls, fgm: p.fgm, fga: p.fga, tpa: p.tpa, fta: p.fta,
        };
      })
      .filter((l) => l.games > 0);
  };
  const out: PostseasonFile = { seasonCode, playoff: await read("playoff"), finals: await read("finals") };
  const file = join(DATA_DIR, "processed", String(seasonCode), "postseason.json");
  if (!out.playoff && !out.finals) {
    await rm(file, { force: true });
    return null;
  }
  // 한 줄 = 선수 한 명 (git diff 가 읽히게)
  const list = (l: PostseasonLine[] | null) => (l ? `[\n${l.map((x) => JSON.stringify(x)).join(",\n")}\n]` : "null");
  await writeFile(file, `{"seasonCode":${seasonCode},\n"playoff":${list(out.playoff)},\n"finals":${list(out.finals)}}\n`, "utf8");
  return `플옵 ${out.playoff?.length ?? "-"}·챔프 ${out.finals?.length ?? "-"}`;
}

async function processSeason(seasonCode: number): Promise<SeasonData> {
  const rawDir = join(DATA_DIR, "raw", String(seasonCode));
  const trad = JSON.parse(await readFile(join(rawDir, "traditional_regular.json"), "utf8"));
  let adv: Raw = { data: [] };
  try {
    adv = JSON.parse(await readFile(join(rawDir, "advanced_regular.json"), "utf8"));
  } catch {
    console.warn(`[${seasonCode}] advanced 파일 없음 → 2차 스탯 0으로 채움`);
  }

  const advByPlayer = new Map<string, Raw>();
  for (const row of adv.data ?? []) advByPlayer.set(String(row.playerNo), row);

  const players: Player[] = (trad.data ?? []).map((t: Raw) => toPlayer(t, advByPlayer.get(String(t.playerNo))));

  // USG%·AST%·REB%(OREB/DREB%): KBL 값이 시즌 선수 절반 이상에 있으면(2025-26) 그대로, 아니면 전원 표준식으로 계산
  // (lib/metrics computeTeamShareStats — 2023-24·2024-25 처럼 일부만 있는 시즌도 섞지 않고 전원 계산값으로 통일)
  const advancedSource: "kbl" | "computed" = seasonCoverage(players).advanced ? "kbl" : "computed";
  if (advancedSource === "computed" && players.length > 0) {
    const est = computeTeamShareStats(players);
    players.forEach((p, i) => Object.assign(p, est[i]));
  }

  // 한 경기 최다: 그 시즌 raw 가 있는 선수만 seasonHighs, 없으면 null. 통산은 최신 시즌 raw 가 이긴다
  const highs = await readSeasonHighs(seasonCode);
  if (highs.size > 0) highsSeasonCount++;
  for (const p of players) {
    const h = highs.get(p.playerNo);
    // 슛 부문(3점·자유투·야투 성공)에 그 경기 시도 수 — 같은 선수·시즌·날짜의 경기별 기록 (scripts/gamelogs.ts)
    p.seasonHighs = withShots(h?.season ?? null, p.playerNo, seasonCode);
    if (h && hasCareerHighs(h.career)) {
      // 통산은 정규시즌만 붙인다 (경기별 기록은 정규시즌 raw 뿐). 기록의 달성 시즌 raw 에서 찾는다
      careerHighsByPlayer.set(p.playerNo, { ...h.career, regular: withShots(h.career.regular, p.playerNo, null) });
    }
  }

  const rawTeams = await readRawTeams(rawDir);
  const teams =
    rawTeams && rawTeams.length > 0
      ? rawTeams.map(toTeam).sort((a, b) => a.order - b.order)
      : teamsFromPlayers(players);
  if (!rawTeams || rawTeams.length === 0) {
    if (players.length > 0) console.warn(`[${seasonCode}] teams.json 없음/비어 있음 → 선수 데이터로 팀 ${teams.length}개 대체`);
  } else {
    // 선수 쪽에만 있는 팀 코드가 있으면 알려만 준다 (raw 코드표를 우선)
    const known = new Set(teams.map((t) => t.teamCode));
    const missing = [...new Set(players.map((p) => p.teamCode))].filter((c) => c && !known.has(c));
    if (missing.length) console.warn(`[${seasonCode}] teams.json에 없는 선수 팀 코드: ${missing.join(", ")}`);
  }

  // 슛 차트: 선수별 구역 집계(없으면 null) + 리그 합계 + 커버리지(선수 50% 이상에 슛 좌표) — lib/shots.ts
  const shots = await readSeasonShots(seasonCode);
  for (const p of players) {
    const list = shots?.get(p.playerNo);
    p.shotZones = list && list.length > 0 ? zoneSummary(list) : null;
  }
  const shotPlayers = players.filter((p) => p.shotZones).length;

  const out: SeasonData = {
    seasonCode,
    seasonLabel: SEASON_CODES_FALLBACK[seasonCode] ?? String(seasonCode),
    gameType: "regular",
    fetchedAt: new Date().toISOString(),
    coverage: { ...seasonCoverage(players), shots: players.length > 0 && shotPlayers / players.length >= 0.5 },
    advancedSource,
    teams,
    players,
    // 부문별 시즌 하이 1위 (기록 부문 11개, 동률은 먼저 달성) — raw 가 없으면 null (lib/highs.ts)
    seasonHighLeaders: computeSeasonHighLeaders(players),
    shotZoneLeague: shots ? leagueZoneAverages(players.map((p) => p.shotZones)) : null,
    // 우승팀 (챔프전 4승, scripts/champions.ts) — 경기 목록이 없거나 시즌 진행 중·취소면 null
    champion: await readSeasonChampion(seasonCode),
    // 플레이오프 출전 팀 (6강·4강 상대 수·챔프전 진출) — 팀 페이지 시즌별 성적 (lib/franchise playoffStage)
    playoffs: await readSeasonPlayoffs(seasonCode),
  };

  const outDir = join(DATA_DIR, "processed", String(seasonCode));
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "players.json"), JSON.stringify(out, null, 2), "utf8");
  const post = await writePostseason(seasonCode);
  if (post) postseasonSummary.push(`${seasonCode}: ${post}`);
  // 선수별 점 좌표 — 한 줄 = 선수 한 명 (git diff 가 읽히게). 시즌 선수 명단에 있는 선수만. 슛이 없으면 파일을 지운다(재실행해도 같은 결과)
  const shotsFile = join(outDir, "shots.json");
  if (shots && shotPlayers > 0) {
    const lines = players
      .filter((p) => p.shotZones)
      .map((p) => `${JSON.stringify(p.playerNo)}:${JSON.stringify(shots.get(p.playerNo)!.map(toShotPoint))}`);
    await writeFile(shotsFile, `{\n${lines.join(",\n")}\n}\n`, "utf8");
  } else {
    await rm(shotsFile, { force: true });
  }
  const gamesNote = await writeSeasonGames(seasonCode, players);
  const cov = Object.entries(out.coverage).filter(([, v]) => v).map(([k]) => k).join(",") || "-";
  const highsNote = (highs.size > 0 ? `, 한 경기 최다 ${highs.size}명` : "") + (shotPlayers > 0 ? `, 슛 차트 ${shotPlayers}명` : "");
  console.log(`[${out.seasonLabel}] ${players.length}명, 팀 ${teams.length}개, coverage: ${cov}${highsNote}${gamesNote} → ${join(outDir, "players.json")}`);
  return out;
}

/** 수상 행 + 연결된 선수 (scripts/awards.ts matchAwardPlayer). 못 찾으면 playerNo null */
interface MatchedAward {
  row: AwardRow;
  seasonCode: number;
  playerNo: string | null;
  teamCode: string | null;
}
let matchedAwards: MatchedAward[] = [];

/** 수상 raw 전체 → 시즌·이름·팀으로 선수 번호 연결. 결과는 matchedAwards (색인·시즌 어워즈가 같이 쓴다) */
function matchAwards(seasons: SeasonData[]): void {
  if (!awardsRaw) {
    console.warn("역대 수상 raw 없음(data/raw/awards/awards.json) → awards 는 빈 배열, seasonAwards null");
    return;
  }
  const codeByLabel = new Map(seasons.map((s) => [s.seasonLabel, s.seasonCode]));
  const allByName = new Map<string, string[]>();
  for (const season of seasons) {
    for (const p of season.players) {
      const k = p.nameKo.replace(/[\s·.\-]/g, "");
      const ids = allByName.get(k) ?? [];
      if (!ids.includes(p.playerNo)) allByName.set(k, [...ids, p.playerNo]);
    }
  }
  const rosterBySeason = new Map(
    seasons.map((season) => {
      const ko = new Map(season.teams.map((t) => [t.teamCode, t.shortNameKo]));
      return [season.seasonCode, season.players.map((p) => ({ playerNo: p.playerNo, nameKo: p.nameKo, teamShort: ko.get(p.teamCode) ?? "", teamName: p.teamName, teamCode: p.teamCode }))];
    }),
  );
  const unmatched: string[] = [];
  for (const row of awardRows(awardsRaw)) {
    const code = codeByLabel.get(row.seasonLabel);
    if (code === undefined) continue;
    const roster = rosterBySeason.get(code) ?? [];
    const playerNo = matchAwardPlayer(row, roster, allByName);
    if (!playerNo) unmatched.push(`${row.seasonLabel} ${row.key} ${row.name}(${row.team})`);
    matchedAwards.push({ row, seasonCode: code, playerNo, teamCode: roster.find((p) => p.playerNo === playerNo)?.teamCode ?? null });
  }
  console.log(`역대 수상: ${matchedAwards.length}건, 선수 연결 실패 ${unmatched.length}건${unmatched.length ? ` — ${unmatched.join(", ")}` : ""}`);
}

/** 시즌 어워즈 (부문 순서는 수상 표 순서, 화면 순서는 lib/awards). 그 시즌 수상 행이 없으면 null */
function seasonAwardsOf(season: SeasonData): SeasonAwards | null {
  const rows = matchedAwards.filter((m) => m.seasonCode === season.seasonCode);
  const results = awardsRaw ? seasonTeamResults(awardsRaw).get(season.seasonLabel) : undefined;
  if (rows.length === 0) return null;
  const byKey = new Map<string, SeasonAwards["awards"][number]>();
  for (const m of rows) {
    let e = byKey.get(m.row.key);
    if (!e) byKey.set(m.row.key, (e = { key: m.row.key, winners: [] }));
    e.winners.push({ playerNo: m.playerNo, name: m.row.name, team: m.row.team, teamCode: m.teamCode, note: m.row.note });
  }
  return { awards: [...byKey.values()], regular: results?.regular ?? null, finals: results?.finals ?? null };
}

/** 수상 알림용 처음 본 날 (scripts/award-seen.ts) — 선수가 있는 최근 시즌들의 수상 칸 → data/award-first-seen.json */
async function writeAwardSeen(seasons: SeasonData[]): Promise<void> {
  const file = join(DATA_DIR, "award-first-seen.json");
  let prev: AwardSeenState | null = null;
  try {
    prev = JSON.parse(await readFile(file, "utf8")) as AwardSeenState;
  } catch {
    prev = null;
  }
  const recent = seasons.filter((s) => s.players.length > 0).map((s) => s.seasonCode).sort((a, b) => b - a).slice(0, AWARD_SEEN_SEASONS);
  const keys: string[] = [];
  for (const s of seasons) {
    if (!recent.includes(s.seasonCode)) continue;
    for (const a of s.seasonAwards?.awards ?? []) for (const w of a.winners) if (w.playerNo) keys.push(awardSeenKey(s.seasonCode, a.key, w.playerNo, w.note));
  }
  const next = updateAwardSeen(prev, keys, todayKst());
  await writeFile(file, JSON.stringify(next, null, 2) + "\n", "utf8");
}

/**
 * 선수 색인: playerNo 기준으로 전 시즌 등장 기록을 모은다.
 * 이름·영문명·외국인 여부는 가장 최근 시즌 값. 시즌은 오름차순, 선수는 한글 이름순(같으면 playerNo순).
 */
function buildPlayersIndex(seasons: SeasonData[]): PlayerIndexEntry[] {
  const byId = new Map<string, PlayerIndexEntry & { latest: number }>();
  for (const season of [...seasons].sort((a, b) => a.seasonCode - b.seasonCode)) {
    const koByTeam = new Map(season.teams.map((t) => [t.teamCode, t.shortNameKo]));
    for (const p of season.players) {
      let e = byId.get(p.playerNo);
      if (!e) {
        e = {
          id: p.playerNo,
          nameKo: p.nameKo,
          nameEn: p.nameEn,
          isForeign: p.isForeign,
          photoUrl: photoUrlOf(p.playerNo),
          ...(profiles.get(p.playerNo) ?? EMPTY_PROFILE),
          ...(profileExtras.get(p.playerNo) ?? EMPTY_PROFILE_EXTRA),
          careerHighs: careerHighsByPlayer.get(p.playerNo) ?? null,
          seasons: [],
          latest: -1,
        };
        byId.set(p.playerNo, e);
      }
      if (season.seasonCode >= e.latest) {
        e.latest = season.seasonCode;
        e.nameKo = p.nameKo;
        e.nameEn = p.nameEn;
        e.isForeign = p.isForeign;
      }
      e.seasons.push({ seasonCode: season.seasonCode, teamCode: p.teamCode, teamShort: koByTeam.get(p.teamCode) ?? teamShortNameKo(p.teamName), games: p.games });
    }
  }
  // 우승 시즌: 정규시즌 소속 팀 = 그 시즌 우승팀 (scripts/champions.ts championSeasonsOf)
  const champions = new Map(seasons.filter((s) => s.champion).map((s) => [s.seasonCode, s.champion!.teamCode]));
  for (const e of byId.values()) e.championships = championSeasonsOf(e.seasons, champions);
  // 역대 수상 (선수 프로필 부문만 — 시즌 어워즈 화면은 시즌 파일 seasonAwards)
  for (const m of matchedAwards) {
    if (!m.playerNo || !PROFILE_AWARD_KEYS.has(m.row.key)) continue;
    const e = byId.get(m.playerNo);
    if (e) (e.awards ??= []).push({ key: m.row.key as AwardKey, seasonCode: m.seasonCode });
  }
  for (const e of byId.values()) e.awards = (e.awards ?? []).sort((a, b) => a.seasonCode - b.seasonCode);
  return [...byId.values()]
    .map(({ latest: _latest, ...e }) => e)
    .sort((a, b) => a.nameKo.localeCompare(b.nameKo, "ko") || a.id.localeCompare(b.id));
}

/**
 * 선수 마스터 raw 읽기 (data/raw/players/players.json, fetch.ts 가 저장). 없거나 깨졌으면 경고 한 줄 → 빈 Map
 * (프로필 필드는 전부 null, isForeign 은 이름 추정). 빌드는 계속된다.
 */
async function readProfiles(): Promise<Map<string, PlayerProfile>> {
  const file = join(DATA_DIR, "raw", "players", "players.json");
  try {
    const map = buildProfileMap(JSON.parse(await readFile(file, "utf8")));
    if (map.size === 0) console.warn(`선수 마스터 비어 있음(${file}) → 포지션·국적 등은 null, 외국 선수는 이름 추정`);
    else console.log(`선수 마스터: ${map.size}명`);
    return map;
  } catch {
    console.warn(`선수 마스터 없음(${file}) → 포지션·국적 등은 null, 외국 선수는 이름 추정`);
    return new Map();
  }
}

/** 프로필 raw (playerNo → 생년월일·국가·출신교). main() 이 채운다 */
let profileExtras = new Map<string, ProfileExtra>();

/** data/raw/profiles/*.json 전부 읽기. 폴더가 없으면 경고 한 줄 → 빈 Map (색인의 birthday·country·school 은 null) */
async function readProfileExtras(): Promise<Map<string, ProfileExtra>> {
  const dir = join(DATA_DIR, "raw", "profiles");
  const out = new Map<string, ProfileExtra>();
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    console.warn(`선수 프로필 없음(${dir}) → 생년월일·국가·출신교는 null`);
    return out;
  }
  for (const f of files) {
    try {
      out.set(f.replace(/\.json$/, ""), profileExtraFrom(JSON.parse(await readFile(join(dir, f), "utf8"))));
    } catch {
      console.warn(`프로필 파일 읽기 실패: ${f}`);
    }
  }
  console.log(`선수 프로필: ${out.size}명`);
  return out;
}

/**
 * 현역·미등록·은퇴 (lib/roster rosterStatusOf) — 재료는 KBL 현역 등록 명단 raw(data/raw/players/active.json, fetch.ts 가 주 1회).
 * 명단이 없거나 비었으면 전부 null(화면은 예전 규칙 "최신 시즌에 뛰었으면 현역")
 */
async function attachRosterStatus(index: PlayerIndexEntry[], seasons: SeasonData[]): Promise<void> {
  const file = join(DATA_DIR, "raw", "players", "active.json");
  let registered: Set<string> | null = null;
  try {
    const rows = masterRows(JSON.parse(await readFile(file, "utf8")));
    if (rows.length > 0) registered = new Set(rows.map((r) => String(r.playerNo)));
  } catch {
    // 없음
  }
  if (!registered) {
    console.warn(`현역 등록 명단 없음(${file}) → rosterStatus null (화면은 최신 시즌 출전으로 현역 판정)`);
    for (const e of index) e.rosterStatus = null;
    return;
  }
  const codes = seasons.filter((s) => s.players.length > 0).map((s) => s.seasonCode);
  const tally: Record<string, number> = {};
  for (const e of index) {
    const last = e.seasons[e.seasons.length - 1]?.seasonCode ?? -1;
    e.rosterStatus = rosterStatusOf(registered.has(e.id), last, codes, nationalityOf(e));
    tally[e.rosterStatus] = (tally[e.rosterStatus] ?? 0) + 1;
  }
  console.log(`현역 등록 명단: ${registered.size}명 → 상태 ${JSON.stringify(tally)}`);
}

const postseasonSummary: string[] = [];

async function main() {
  try {
    awardsRaw = JSON.parse(await readFile(join(DATA_DIR, "raw", "awards", "awards.json"), "utf8"));
  } catch {
    awardsRaw = null;
  }
  teamColors = await readTeamColors();
  hiddenPhotos = await readPhotoOverrides();
  profiles = await readProfiles();
  profileExtras = await readProfileExtras();
  gameLogs = await readGameLogs();
  const seasons = (await readdir(join(DATA_DIR, "raw"), { withFileTypes: true }))
    .filter((d) => d.isDirectory() && /^\d+$/.test(d.name))
    .map((d) => Number(d.name))
    .sort((a, b) => a - b);

  const failed: string[] = [];
  const done: SeasonData[] = [];
  for (const s of seasons) {
    try { done.push(await processSeason(s)); }
    catch (e) { failed.push(`${s}: ${(e as Error).message}`); }
  }

  if (highsSeasonCount === 0) console.warn("한 경기 최다 raw 없음(data/raw/highs) → seasonHighs·seasonHighLeaders·careerHighs 는 null");
  else console.log(`한 경기 최다: ${highsSeasonCount}개 시즌, 통산 ${careerHighsByPlayer.size}명`);
  if (gameLogs.size > 0) console.log(`한 경기 최다 슛 시도 수: 붙임 ${shotStats.attached} · 그날 경기 못 찾음 ${shotStats.missing} (시즌별·통산 합계, 중복 포함)`);
  if (shotChartStats.seasons === 0) console.warn("슛 차트 raw 없음(data/raw/shots) → shotZones·shotZoneLeague 는 null, coverage.shots false");
  else console.log(`슛 차트: ${shotChartStats.seasons}개 시즌, 점 ${shotChartStats.points}개${shotChartStats.skipped ? ` (좌표 이상으로 건너뜀 ${shotChartStats.skipped})` : ""}`);
  console.log(postseasonSummary.length ? `플레이오프·챔프전 합계: ${postseasonSummary.join(" / ")}` : "플레이오프·챔프전 raw 없음 → postseason.json 없음");
  if (unknownHighsKeys.size > 0) console.warn(`한 경기 최다 응답의 모르는 배열(무시함): ${[...unknownHighsKeys].join(", ")}`);

  // 팀 한글 약칭 점검표 (teamName1 → shortNameKo, 등장 시즌) — 이상한 값이 없는지 눈으로 확인
  const koTable = new Map<string, { ko: string; seasons: number[] }>();
  for (const season of done) {
    for (const t of season.teams) {
      const e = koTable.get(t.name) ?? { ko: t.shortNameKo, seasons: [] };
      e.seasons.push(season.seasonCode);
      koTable.set(t.name, e);
    }
  }
  console.log("팀 한글 약칭 (teamName1 → shortNameKo):");
  for (const [name, e] of koTable) console.log(`  ${name} → ${e.ko}  [${e.seasons.join(",")}]`);

  // 시즌 목록 인덱스 — 화면의 시즌 선택 드롭다운이 이 파일을 읽는다
  const index = seasons
    .filter((s) => !failed.some((f) => f.startsWith(`${s}:`)))
    .map((s) => ({ seasonCode: s, seasonLabel: SEASON_CODES_FALLBACK[s] ?? String(s) }));
  await writeFile(join(DATA_DIR, "processed", "seasons.json"), JSON.stringify(index, null, 2), "utf8");

  // 선수 색인 — 검색·선수 페이지가 읽는다. 크기를 줄이면서 git diff는 읽히도록 "한 줄 = 선수 한 명"으로 저장
  // 역대 수상 → 시즌 어워즈(시즌 파일에 덧붙여 다시 저장) + 색인 awards
  matchAwards(done);
  for (const season of done) {
    const sa = seasonAwardsOf(season);
    if (!sa && !season.seasonAwards) continue;
    season.seasonAwards = sa;
    await writeFile(join(DATA_DIR, "processed", String(season.seasonCode), "players.json"), JSON.stringify(season, null, 2), "utf8");
  }
  await writeAwardSeen(done);
  const playersIndex = buildPlayersIndex(done);
  await attachRosterStatus(playersIndex, done);
  const indexJson = `[\n${playersIndex.map((e) => JSON.stringify(e)).join(",\n")}\n]\n`;
  await writeFile(join(DATA_DIR, "processed", "players-index.json"), indexJson, "utf8");
  console.log(`선수 색인: ${playersIndex.length}명 → ${join(DATA_DIR, "processed", "players-index.json")}`);

  if (failed.length) { console.error(`실패:\n- ${failed.join("\n- ")}`); process.exitCode = 1; }
}

main();
