// 한 경기 최다(시즌 하이·통산)·프로필 과거 전체 백필 — .github/workflows/backfill-highs.yml 이 시즌마다 부른다.
// 실행: npm run backfill:highs -- --list-seasons   → 대상 시즌 코드(선수 있는 raw 시즌, 최신 먼저)를 공백으로 출력
//       npm run backfill:highs -- --season 47      → 그 시즌 선수 전원의 mostgame/{47}/{선수} + 아직 없는 선수 프로필
//
// mostgame/{시즌}/{선수} 한 요청이 "그 시즌 하이 + 통산"을 같이 주므로 선수-시즌 조합당 1회 (약 4,900회).
// 이어받기: 이미 raw 파일이 있는 조합·프로필은 건너뛴다 → 중간에 끊겨도 다시 돌리면 남은 것만 받는다.
// 요청 간격 1.5초(config REQUEST_INTERVAL_MS), 연속 10회 실패면 그 시즌 중단(종료 코드 1, 워크플로는 다음 시즌 계속).
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "./config.js";
import { collectHighs, collectProfiles, hasTraditional } from "./collect-extras.js";
import { playerNosFromTraditional } from "./highs.js";

async function seasonPlayerNos(seasonCode: number): Promise<string[]> {
  if (!hasTraditional(seasonCode)) return [];
  const file = join(DATA_DIR, "raw", String(seasonCode), "traditional_regular.json");
  return playerNosFromTraditional(JSON.parse(await readFile(file, "utf8")));
}

/** raw 에 선수가 1명 이상 있는 시즌, 최신 먼저 (최근 기록이 더 쓸모 있어서 먼저 받는다) */
async function listSeasons(): Promise<number[]> {
  const dirs = (await readdir(join(DATA_DIR, "raw"), { withFileTypes: true }))
    .filter((d) => d.isDirectory() && /^\d+$/.test(d.name))
    .map((d) => Number(d.name))
    .sort((a, b) => b - a);
  const out: number[] = [];
  for (const s of dirs) if ((await seasonPlayerNos(s)).length > 0) out.push(s);
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list-seasons")) {
    console.log((await listSeasons()).join(" "));
    return;
  }
  const i = args.indexOf("--season");
  const seasonCode = i >= 0 ? Number(args[i + 1]) : NaN;
  if (!Number.isInteger(seasonCode)) {
    console.error("사용법: backfill-highs.ts --list-seasons | --season <시즌 코드>");
    process.exitCode = 2;
    return;
  }
  const nos = await seasonPlayerNos(seasonCode);
  console.log(`[백필 ${seasonCode}] 선수 ${nos.length}명`);
  const highs = await collectHighs(seasonCode, nos, { skipExisting: true });
  const profiles = await collectProfiles(nos, { skipExisting: true });
  if (highs.failed.length || profiles.failed.length) {
    console.error(`[백필 ${seasonCode}] 실패: 한 경기 최다 ${highs.failed.length} · 프로필 ${profiles.failed.length} (다음 실행에서 이어받음)`);
    for (const f of [...highs.failed, ...profiles.failed].slice(0, 5)) console.error(`  - ${f}`);
    process.exitCode = 1;
  }
}

main();
