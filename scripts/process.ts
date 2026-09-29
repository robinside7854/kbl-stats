// raw → processed 변환
// data/raw/{season}/traditional_regular.json + advanced_regular.json
//   → data/processed/{season}/players.json (lib/types.ts의 SeasonData 형태)
//
// raw 파일은 절대 수정하지 않는다. 이 스크립트는 몇 번 다시 돌려도 같은 결과가 나와야 한다.

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, SEASON_CODES_FALLBACK } from "./config.js";
import type { Player, SeasonData } from "../lib/types.js";

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

async function processSeason(seasonCode: number) {
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

  const out: SeasonData = {
    seasonCode,
    seasonLabel: SEASON_CODES_FALLBACK[seasonCode] ?? String(seasonCode),
    gameType: "regular",
    fetchedAt: new Date().toISOString(),
    players,
  };

  const outDir = join(DATA_DIR, "processed", String(seasonCode));
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "players.json"), JSON.stringify(out, null, 2), "utf8");
  console.log(`[${out.seasonLabel}] ${players.length}명 → ${join(outDir, "players.json")}`);
}

async function main() {
  const seasons = (await readdir(join(DATA_DIR, "raw"), { withFileTypes: true }))
    .filter((d) => d.isDirectory() && /^\d+$/.test(d.name))
    .map((d) => Number(d.name))
    .sort((a, b) => a - b);

  const failed: string[] = [];
  for (const s of seasons) {
    try { await processSeason(s); }
    catch (e) { failed.push(`${s}: ${(e as Error).message}`); }
  }

  // 시즌 목록 인덱스 — 화면의 시즌 선택 드롭다운이 이 파일을 읽는다
  const index = seasons
    .filter((s) => !failed.some((f) => f.startsWith(`${s}:`)))
    .map((s) => ({ seasonCode: s, seasonLabel: SEASON_CODES_FALLBACK[s] ?? String(s) }));
  await writeFile(join(DATA_DIR, "processed", "seasons.json"), JSON.stringify(index, null, 2), "utf8");

  if (failed.length) { console.error(`실패:\n- ${failed.join("\n- ")}`); process.exitCode = 1; }
}

main();
