// 슛 차트 백필 — .github/workflows/backfill-shots.yml 이 시즌마다 부른다.
// 실행: npm run backfill:shots -- --count          → 시즌별 끝난 정규시즌 경기 수·아직 raw 없는 수 (저장된 경기 목록 기준, 없으면 추정)
//       npm run backfill:shots -- --list-seasons   → 대상 시즌 코드(선수 raw 가 있는 시즌, 최신 먼저)를 공백으로 출력
//       npm run backfill:shots -- --season 47      → 그 시즌 경기 목록(월별 10회) + 슛 차트(정규시즌 약 270회)
//
// 이어받기: 이미 raw 가 있는 경기는 건너뛰고, 마감된 경기 목록(data/raw/games/{시즌}/list.json)이 있으면 목록도 다시 받지 않는다.
// 빈 슛 차트(shootLog 는 있지만 슛 기록 0)도 저장한다 — 옛 시즌에 차트가 없으면 다음 실행에서 다시 두드리지 않게.
// 요청 간격 1.5초, 연속 10회 실패면 그 시즌 중단(종료 코드 1).
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, SEASON_CODES_FALLBACK } from "./config.js";
import { collectSeasonShots, existingShotFiles, readGamesList } from "./collect-shots.js";
import { playerNosFromTraditional, todayKst } from "./highs.js";
import { endedRegularGmkeys, pendingGames, seasonLabelOf, seasonMonthRanges } from "./shots.js";

/** 시즌 목록을 모를 때 쓰는 시즌당 정규시즌 경기 수 추정 (10팀 × 54경기 ÷ 2) */
const ESTIMATED_GAMES_PER_SEASON = 270;

async function readJsonOr<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** 선수 raw(traditional)가 1명 이상 있는 시즌, 최신 먼저 — 개막 전 시즌(0명)은 경기도 없다 */
async function seasonsWithPlayers(): Promise<number[]> {
  const dirs = (await readdir(join(DATA_DIR, "raw"), { withFileTypes: true }))
    .filter((d) => d.isDirectory() && /^\d+$/.test(d.name))
    .map((d) => Number(d.name));
  const out: number[] = [];
  for (const code of dirs) {
    const nos = playerNosFromTraditional(await readJsonOr(join(DATA_DIR, "raw", String(code), "traditional_regular.json"), null));
    if (nos.length > 0) out.push(code);
  }
  return out.sort((a, b) => b - a);
}

async function main() {
  const args = process.argv.slice(2);
  const today = todayKst();
  const codesFile = await readJsonOr<unknown>(join(DATA_DIR, "codes", "seasons.json"), null);
  const labelOf = (code: number) => seasonLabelOf(code, codesFile, SEASON_CODES_FALLBACK);

  if (args.includes("--list-seasons")) {
    console.log((await seasonsWithPlayers()).join(" "));
    return;
  }
  if (args.includes("--count")) {
    const seasons = await seasonsWithPlayers();
    let pending = 0;
    let listReq = 0;
    for (const code of seasons) {
      const list = await readGamesList(code);
      if (list) {
        const keys = endedRegularGmkeys(list, code, today);
        const left = pendingGames(keys, await existingShotFiles(code)).length;
        pending += left;
        console.log(`  시즌 ${code}: 끝난 정규시즌 ${keys.length}경기, 아직 raw 없음 ${left}`);
      } else {
        const months = seasonMonthRanges(labelOf(code) ?? "").length;
        pending += ESTIMATED_GAMES_PER_SEASON;
        listReq += months;
        console.log(`  시즌 ${code}: 경기 목록 없음 → 목록 ${months}회 + 약 ${ESTIMATED_GAMES_PER_SEASON}경기로 추정`);
      }
    }
    const total = pending + listReq;
    console.log(`슛 차트 백필: 시즌 ${seasons.length}개, 요청 약 ${total}회 (슛 차트 ${pending} + 경기 목록 ${listReq}) ≈ ${Math.ceil((total * 1.6) / 60)}분`);
    return;
  }

  const i = args.indexOf("--season");
  const seasonCode = i >= 0 ? Number(args[i + 1]) : NaN;
  if (!Number.isInteger(seasonCode)) {
    console.error("사용법: backfill-shots.ts --count | --list-seasons | --season <시즌 코드>");
    process.exitCode = 2;
    return;
  }
  const label = labelOf(seasonCode);
  if (!label) {
    console.error(`[슛 차트 백필 ${seasonCode}] 코드표·백업 상수에 시즌 라벨 없음`);
    process.exitCode = 1;
    return;
  }
  console.log(`[슛 차트 백필 ${seasonCode}] 시즌 ${label}`);
  const r = await collectSeasonShots({ seasonCode, label, today, mode: "backfill" });
  if (r.games === 0 && r.failed.length === 0) console.warn(`[슛 차트 백필 ${seasonCode}] 경기 목록에 끝난 정규시즌 경기 0 — 이 시즌은 서버 C 에 없을 수 있다`);
  if (r.empty > 0) console.warn(`[슛 차트 백필 ${seasonCode}] 슛 기록이 빈 차트 ${r.empty}경기 (저장함)`);
  if (r.failed.length) {
    console.error(`[슛 차트 백필 ${seasonCode}] 실패 ${r.failed.length} (다음 실행에서 이어받음)`);
    for (const f of r.failed.slice(0, 5)) console.error(`  - ${f}`);
    process.exitCode = 1;
  }
}

main();
