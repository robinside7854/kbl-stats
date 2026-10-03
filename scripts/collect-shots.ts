// 슛 차트 수집 루프 — 매일 수집(fetch.ts)과 백필(backfill-shots.ts)이 같이 쓴다.
// 저장: data/raw/games/{seasonCode}/list.json (월별 경기 목록 응답을 합친 배열, 각 항목 원본 그대로)
//       data/raw/shots/{seasonCode}/{gmkey}.json (슛 차트 응답 그대로, 한 줄 JSON)
// 이상한 응답(형식이 다름·빈 응답·HTML)은 저장하지 않고 실패로 센다. 연속 MAX_CONSECUTIVE_FAILURES 번이면 그 시즌 중단.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, MAX_CONSECUTIVE_FAILURES, matchChartUrl, matchListUrl, REQUEST_INTERVAL_MS } from "./config.js";
import { getJson, saveRaw, sleep } from "./http.js";
import {
  endedRegularGmkeys, isListFinal, isMatchListResponse, isShotChartResponse, mergeMatchLists,
  pendingGames, seasonMonthRanges, seasonWindowClosed, shotChartHasLogs,
} from "./shots.js";

export const gamesListFile = (seasonCode: number) => join(DATA_DIR, "raw", "games", String(seasonCode), "list.json");
export const shotsDir = (seasonCode: number) => join(DATA_DIR, "raw", "shots", String(seasonCode));

/** 저장된 경기 목록 (없거나 깨졌으면 null) */
export async function readGamesList(seasonCode: number): Promise<unknown[] | null> {
  try {
    const v = JSON.parse(await readFile(gamesListFile(seasonCode), "utf8"));
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export async function existingShotFiles(seasonCode: number): Promise<string[]> {
  try {
    return (await readdir(shotsDir(seasonCode))).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
}

/**
 * 월별 경기 목록을 받아 합쳐 저장. 한 달이라도 실패하면 저장하지 않고 에러 (전날 파일이 그대로 남는다).
 * untilDate 를 주면 그 날짜 뒤에 시작하는 달은 받지 않는다(매일 수집).
 */
export async function fetchGamesList(seasonCode: number, label: string, untilDate?: string): Promise<unknown[]> {
  const ranges = seasonMonthRanges(label, untilDate);
  if (ranges.length === 0) throw new Error(`시즌 라벨 "${label}" → 월 구간 없음`);
  const bodies: unknown[] = [];
  for (let i = 0; i < ranges.length; i++) {
    if (i > 0) await sleep(REQUEST_INTERVAL_MS);
    const { fromDate, toDate } = ranges[i];
    const body = await getJson(matchListUrl(fromDate, toDate));
    if (!isMatchListResponse(body)) throw new Error(`경기 목록 ${fromDate}~${toDate}: 예상 밖 응답 형식`);
    bodies.push(body);
  }
  const merged = mergeMatchLists(bodies);
  await saveRaw(join("games", String(seasonCode)), "list", merged);
  await sleep(REQUEST_INTERVAL_MS);
  return merged;
}

export interface ShotsResult {
  /** 목록의 정규시즌 끝난 경기 수 */
  games: number;
  saved: number;
  skipped: number;
  /** 슛 기록이 비어 있던 경기 수 (매일: 저장 안 함 / 백필: 저장함) */
  empty: number;
  failed: string[];
  aborted: boolean;
  /** 경기 목록 요청 수 (0 이면 저장된 목록을 그대로 씀) */
  listRequests: number;
}

interface ShotsOptions {
  seasonCode: number;
  label: string;
  /** 오늘 "YYYY-MM-DD" (KST) */
  today: string;
  /**
   * daily: 목록을 시즌 전체 달 다시 받고(일정 화면용, 시즌 달 구간이 끝났고 목록이 마감이면 안 받음), 빈 슛 차트는 저장하지 않는다(다음 날 다시 시도).
   * backfill: 마감된 목록이 이미 있으면 다시 받지 않고, 빈 슛 차트도 저장한다(옛 시즌에 차트가 없으면 이어받기 때 다시 두드리지 않게).
   */
  mode: "daily" | "backfill";
}

/** 한 시즌: 경기 목록 → 끝난 정규시즌 경기 중 raw 없는 gmkey 의 슛 차트 */
export async function collectSeasonShots(opts: ShotsOptions): Promise<ShotsResult> {
  const { seasonCode, label, today, mode } = opts;
  const tag = `슛 차트 ${seasonCode}`;
  const result: ShotsResult = { games: 0, saved: 0, skipped: 0, empty: 0, failed: [], aborted: false, listRequests: 0 };

  let list = await readGamesList(seasonCode);
  // 마감된 목록이 있고 (백필이거나) 시즌 달 구간이 이미 지났으면 목록을 다시 받지 않는다
  const reuse = !!list && isListFinal(list, seasonCode, today) && (mode === "backfill" || seasonWindowClosed(label, today));
  if (!reuse) {
    try {
      // 매일도 시즌 전체 달(약 10회)을 받는다 — 2026-10-03 사용자: 시즌 전체 경기 일정 화면. 예전엔 오늘까지 달만
      result.listRequests = seasonMonthRanges(label).length;
      list = await fetchGamesList(seasonCode, label);
    } catch (e) {
      result.failed.push(`경기 목록: ${(e as Error).message.split("\n")[0]}`);
      console.error(`[${tag}] 경기 목록 실패 — ${list ? "저장된 목록으로 계속" : "중단"}`);
      if (!list) return result;
    }
  }

  const gmkeys = endedRegularGmkeys(list, seasonCode, today);
  const todo = pendingGames(gmkeys, await existingShotFiles(seasonCode));
  result.games = gmkeys.length;
  result.skipped = gmkeys.length - todo.length;
  console.log(`[${tag}] 끝난 정규시즌 ${gmkeys.length}경기, 받을 것 ${todo.length}`);

  let streak = 0;
  for (let i = 0; i < todo.length; i++) {
    const gmkey = todo[i];
    try {
      const body = await getJson(matchChartUrl(gmkey));
      if (!isShotChartResponse(body)) throw new Error("예상 밖 응답 형식 (shootLog 없음)");
      const hasLogs = shotChartHasLogs(body);
      if (!hasLogs) result.empty++;
      if (hasLogs || mode === "backfill") {
        await saveRaw(join("shots", String(seasonCode)), gmkey, body, true);
        result.saved++;
      }
      streak = 0;
    } catch (e) {
      result.failed.push(`${gmkey}: ${(e as Error).message.split("\n")[0]}`);
      if (++streak >= MAX_CONSECUTIVE_FAILURES) {
        result.aborted = true;
        console.error(`[${tag}] 연속 ${streak}회 실패 → 중단 (남은 ${todo.length - i - 1}경기)`);
        break;
      }
    }
    if ((i + 1) % 50 === 0) console.log(`  [${tag}] ${i + 1}/${todo.length}`);
    await sleep(REQUEST_INTERVAL_MS);
  }
  console.log(
    `[${tag}] 저장 ${result.saved} · 건너뜀 ${result.skipped} · 빈 차트 ${result.empty} · 실패 ${result.failed.length}${result.aborted ? " (중단)" : ""}`,
  );
  return result;
}
