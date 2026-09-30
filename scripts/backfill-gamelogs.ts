// 경기별 기록 백필 — .github/workflows/backfill-gamelogs.yml 이 시즌마다 부른다.
// 실행: npm run backfill:gamelogs -- --count          → 대상 (선수, 시즌) 수·시즌 수·아직 raw 없는 수 출력
//       npm run backfill:gamelogs -- --list-seasons   → 대상 시즌 코드(최신 먼저)를 공백으로 출력
//       npm run backfill:gamelogs -- --season 47      → 그 시즌 대상 선수의 game/{47}/01/{선수}
//
// 대상(scripts/gamelogs.ts gamelogTargets): 정규시즌 커리어 하이의 득점·3점 성공·자유투 성공 기록이 나온 (선수, 시즌)만
// — data/processed/players-index.json 의 careerHighs.regular 기준, 선수당 최대 3개. 과거 시즌의 "시즌 하이" 시도 수는 범위 밖.
// 이어받기: 이미 raw 파일이 있는 조합은 건너뛴다. 요청 간격 1.5초, 연속 10회 실패면 그 시즌 중단(종료 코드 1).
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "./config.js";
import { collectGameLogs } from "./collect-extras.js";
import { gamelogTargets, groupTargetsBySeason } from "./gamelogs.js";
import { pendingPlayers } from "./highs.js";

async function loadTargets(): Promise<Map<number, string[]>> {
  const file = join(DATA_DIR, "processed", "players-index.json");
  let index: unknown = [];
  try {
    index = JSON.parse(await readFile(file, "utf8"));
  } catch {
    console.error(`${file} 없음 → 대상 0 (먼저 npm run process)`);
  }
  return groupTargetsBySeason(gamelogTargets(Array.isArray(index) ? index : []));
}

async function existing(seasonCode: number): Promise<string[]> {
  try {
    return await readdir(join(DATA_DIR, "raw", "gamelogs", String(seasonCode)));
  } catch {
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  const bySeason = await loadTargets();
  if (args.includes("--list-seasons")) {
    console.log([...bySeason.keys()].join(" "));
    return;
  }
  if (args.includes("--count")) {
    let total = 0;
    let pending = 0;
    for (const [s, nos] of bySeason) {
      total += nos.length;
      pending += pendingPlayers(nos, await existing(s)).length;
    }
    console.log(`경기별 기록 백필 대상: ${total}회 (시즌 ${bySeason.size}개), 아직 raw 없음 ${pending}회 ≈ ${Math.ceil((pending * 1.6) / 60)}분`);
    return;
  }
  const i = args.indexOf("--season");
  const seasonCode = i >= 0 ? Number(args[i + 1]) : NaN;
  if (!Number.isInteger(seasonCode)) {
    console.error("사용법: backfill-gamelogs.ts --count | --list-seasons | --season <시즌 코드>");
    process.exitCode = 2;
    return;
  }
  const nos = bySeason.get(seasonCode) ?? [];
  console.log(`[경기별 기록 백필 ${seasonCode}] 대상 선수 ${nos.length}명`);
  const r = await collectGameLogs(seasonCode, nos, { skipExisting: true });
  if (r.failed.length) {
    console.error(`[경기별 기록 백필 ${seasonCode}] 실패 ${r.failed.length} (다음 실행에서 이어받음)`);
    for (const f of r.failed.slice(0, 5)) console.error(`  - ${f}`);
    process.exitCode = 1;
  }
}

main();
