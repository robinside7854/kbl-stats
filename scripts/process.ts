// raw → processed 변환
// data/raw/{season}/traditional_regular.json + advanced_regular.json + teams.json
//   (+ data/raw/players/players.json 선수 마스터 — 있으면 playerNo 로 조인해 포지션·국적·신장 등 프로필을 붙인다)
//   → data/processed/{season}/players.json (lib/types.ts의 SeasonData 형태: coverage·teams·players)
// 모든 시즌을 가공한 뒤
//   → data/processed/seasons.json (시즌 목록), data/processed/players-index.json (선수 색인)
//
// raw 파일은 절대 수정하지 않는다. 이 스크립트는 몇 번 다시 돌려도 같은 결과가 나와야 한다.

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, SEASON_CODES_FALLBACK } from "./config.js";
import { seasonCoverage, usgFromKbl } from "../lib/metrics.js";
import { playerPhotoUrl, teamLogoUrl } from "./image-urls.js";
import { teamShortNameKo } from "../lib/teams.js";
import { buildProfileMap, EMPTY_PROFILE, isForeignPlayer } from "./player-master.js";
import type { Player, PlayerIndexEntry, PlayerProfile, SeasonData, Team, TeamColor } from "../lib/types.js";

type Raw = Record<string, any>;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

/** 선수 마스터 (playerNo → 프로필). main() 이 파일을 읽어 채운다. 파일이 없으면 빈 Map → 모두 EMPTY_PROFILE */
let profiles = new Map<string, PlayerProfile>();

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

  const out: SeasonData = {
    seasonCode,
    seasonLabel: SEASON_CODES_FALLBACK[seasonCode] ?? String(seasonCode),
    gameType: "regular",
    fetchedAt: new Date().toISOString(),
    coverage: seasonCoverage(players),
    teams,
    players,
  };

  const outDir = join(DATA_DIR, "processed", String(seasonCode));
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "players.json"), JSON.stringify(out, null, 2), "utf8");
  const cov = Object.entries(out.coverage).filter(([, v]) => v).map(([k]) => k).join(",") || "-";
  console.log(`[${out.seasonLabel}] ${players.length}명, 팀 ${teams.length}개, coverage: ${cov} → ${join(outDir, "players.json")}`);
  return out;
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
          photoUrl: playerPhotoUrl(p.playerNo),
          ...(profiles.get(p.playerNo) ?? EMPTY_PROFILE),
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

async function main() {
  teamColors = await readTeamColors();
  profiles = await readProfiles();
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
  const playersIndex = buildPlayersIndex(done);
  const indexJson = `[\n${playersIndex.map((e) => JSON.stringify(e)).join(",\n")}\n]\n`;
  await writeFile(join(DATA_DIR, "processed", "players-index.json"), indexJson, "utf8");
  console.log(`선수 색인: ${playersIndex.length}명 → ${join(DATA_DIR, "processed", "players-index.json")}`);

  if (failed.length) { console.error(`실패:\n- ${failed.join("\n- ")}`); process.exitCode = 1; }
}

main();
