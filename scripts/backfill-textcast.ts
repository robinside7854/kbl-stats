// 문자중계(4쿼터·연장) 백필 — .github/workflows/backfill-textcast.yml 이 시즌마다 부른다 (2026-10-28 클러치·위닝샷).
// 실행: npm run backfill:textcast -- --count          → 시즌별 끝난 정규시즌 경기 수·아직 raw 없는 수
//       npm run backfill:textcast -- --list-seasons   → 대상 시즌(경기 목록이 있고 2006-07 이후, 최신 먼저)을 공백으로 출력
//       npm run backfill:textcast -- --season 47      → 그 시즌 정규시즌 약 270경기 (경기당 보통 1회, 연장 경기는 2~3회)
// 이어받기: 이미 raw 가 있는 경기는 건너뛴다. 경기 목록은 슛 차트 백필이 받아 둔 것을 쓴다(없는 시즌은 건너뜀).
// 요청 간격 1.5초, 연속 10회 실패면 그 시즌 중단(종료 코드 1).
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "./config.js";
import { readGamesList } from "./collect-shots.js";
import { collectSeasonTextCasts, existingTextCastFiles } from "./collect-textcast.js";
import { todayKst } from "./highs.js";
import { endedRegularGmkeys, pendingGames } from "./shots.js";
import { TEXTCAST_FIRST_SEASON } from "./textcast.js";

/** 경기 목록이 있는 시즌(문자중계가 있는 2006-07 이후), 최신 먼저 */
async function seasonsWithList(): Promise<number[]> {
  const dirs = await readdir(join(DATA_DIR, "raw", "games"), { withFileTypes: true }).catch(() => []);
  const out: number[] = [];
  for (const d of dirs) {
    if (!d.isDirectory() || !/^\d+$/.test(d.name)) continue;
    const code = Number(d.name);
    if (code >= TEXTCAST_FIRST_SEASON && (await readGamesList(code))) out.push(code);
  }
  return out.sort((a, b) => b - a);
}

async function main() {
  const args = process.argv.slice(2);
  const today = todayKst();
  if (args.includes("--list-seasons")) {
    console.log((await seasonsWithList()).join(" "));
    return;
  }
  if (args.includes("--count")) {
    let pending = 0;
    const seasons = await seasonsWithList();
    for (const code of seasons) {
      const keys = endedRegularGmkeys(await readGamesList(code), code, today);
      const left = pendingGames(keys, await existingTextCastFiles(code)).length;
      pending += left;
      console.log(`  시즌 ${code}: 끝난 정규시즌 ${keys.length}경기, 아직 raw 없음 ${left}`);
    }
    // 연장 경기(약 6%)는 2~3회 — 1.07배로 어림
    console.log(`문자중계 백필: 시즌 ${seasons.length}개, 경기 ${pending} (요청 약 ${Math.round(pending * 1.07)}회) ≈ ${Math.ceil((pending * 1.07 * 1.6) / 60)}분`);
    return;
  }
  const i = args.indexOf("--season");
  const seasonCode = i >= 0 ? Number(args[i + 1]) : NaN;
  if (!Number.isInteger(seasonCode)) {
    console.error("사용법: backfill-textcast.ts --count | --list-seasons | --season <시즌 코드>");
    process.exitCode = 2;
    return;
  }
  const r = await collectSeasonTextCasts({ seasonCode, today, mode: "backfill" });
  if (r.empty > 0) console.warn(`[문자중계 백필 ${seasonCode}] 빈 응답 ${r.empty}경기 (저장함)`);
  if (r.incomplete > 0) console.warn(`[문자중계 백필 ${seasonCode}] 게임 종료가 없는 응답 ${r.incomplete}경기 (저장 안 함 — 다음 실행에서 다시)`);
  if (r.failed.length) {
    console.error(`[문자중계 백필 ${seasonCode}] 실패 ${r.failed.length} (다음 실행에서 이어받음)`);
    for (const f of r.failed.slice(0, 5)) console.error(`  - ${f}`);
    process.exitCode = 1;
  }
}

main();
