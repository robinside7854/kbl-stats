// raw → processed 변환
// data/raw/{season}/traditional_regular.json + advanced_regular.json + teams.json
//   → data/processed/{season}/players.json (lib/types.ts의 SeasonData 형태: coverage·teams·players)
// 모든 시즌을 가공한 뒤
//   → data/processed/seasons.json (시즌 목록), data/processed/players-index.json (선수 색인)
//
// raw 파일은 절대 수정하지 않는다. 이 스크립트는 몇 번 다시 돌려도 같은 결과가 나와야 한다.

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, SEASON_CODES_FALLBACK } from "./config.js";
import { seasonCoverage } from "../lib/metrics.js";
import { playerPhotoUrl, teamLogoUrl } from "./image-urls.js";
import type { Player, PlayerIndexEntry, SeasonData, Team, TeamColor } from "../lib/types.js";

type Raw = Record<string, any>;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

/**
 * 외국인 선수 판별 — KBL API에 국적 필드가 없어 이름으로 추정한다.
 * 한글 이름이 2~4자이고 공백이 없으면 국내 선수, 그 외(공백 포함 음역 이름)는 외국인으로 본다.
 * 예외: 귀화·혼혈 선수(라건아 등)는 한글 3자라 국내로 분류된다. 정확한 국적 데이터가 생기면 교체.
 */
function guessForeign(nameKo: string): boolean {
  return !/^[가-힣]{2,4}$/.test(nameKo.trim());
}

function toPlayer(t: Raw, a: Raw | undefined): Player {
  return {
    playerNo: String(t.playerNo),
    nameKo: t.kname ?? "",
    nameEn: t.ename ?? "",
    teamCode: String(t.teamCode ?? ""),
    teamName: t.teamName1 ?? "",
    teamShort: t.teamName4 ?? "",
    isForeign: guessForeign(t.kname ?? ""),

    games: num(t.gameCount),
    wins: num(t.win),
    losses: num(t.lose),
    minutes: Math.round(num(t.playSec) / 60),

    points: num(t.score),
    fgm: num(t.fg), fga: num(t.fgA), fgPct: num(t.fgRt),
    tpm: num(t.threep), tpa: num(t.threepA), tpPct: num(t.threepRt),
    twoPm: num(t.fdg), twoPa: num(t.fdgA), twoPPct: num(t.fdgRt),
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
    usgPct: num(a?.usgRt),
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
  return {
    teamCode,
    name: (t.teamName1 ?? "").trim(),
    shortName: (t.teamName4 ?? "").trim(),
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
    for (const p of season.players) {
      let e = byId.get(p.playerNo);
      if (!e) {
        e = {
          id: p.playerNo,
          nameKo: p.nameKo,
          nameEn: p.nameEn,
          isForeign: p.isForeign,
          photoUrl: playerPhotoUrl(p.playerNo),
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
      e.seasons.push({ seasonCode: season.seasonCode, teamCode: p.teamCode, teamShort: p.teamShort, games: p.games });
    }
  }
  return [...byId.values()]
    .map(({ latest: _latest, ...e }) => e)
    .sort((a, b) => a.nameKo.localeCompare(b.nameKo, "ko") || a.id.localeCompare(b.id));
}

async function main() {
  teamColors = await readTeamColors();
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
