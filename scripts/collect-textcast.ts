// 문자중계(4쿼터·연장) 수집 루프 — 매일 수집(fetch.ts)과 백필(backfill-textcast.ts)이 같이 쓴다. 규칙은 scripts/textcast.ts.
// 저장: data/raw/textcast/{seasonCode}/{gmkey}.json (4쿼터·연장 응답 항목을 이어 붙인 배열, 각 항목 원본 그대로, 한 줄 JSON)
// 경기 목록은 슛 차트 수집이 먼저 받아 둔 data/raw/games/{시즌}/list.json 을 쓴다(목록을 따로 받지 않는다).
// 요청: 쿼리 없이 1회(= 마지막 쿼터) → 연장이 있었으면 4쿼터·앞 연장을 쿼터마다 1회. 보통 경기당 1회.
// 매일: 게임 종료(009)가 없거나 빈 응답이면 저장하지 않는다(입력 중 — 다음 날 다시). 백필: 빈 응답도 저장(옛 경기를 다시 두드리지 않게).
// 연속 MAX_CONSECUTIVE_FAILURES 번 실패면 그 시즌 중단.
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, MAX_CONSECUTIVE_FAILURES, REQUEST_INTERVAL_MS, textCastUrl } from "./config.js";
import { getJson, saveRaw, sleep } from "./http.js";
import { readGamesList } from "./collect-shots.js";
import { endedRegularGmkeys, pendingGames } from "./shots.js";
import { extraQuarters, hasGameEnd, isTextCastResponse, mergeQuarters, playoffGamesOf, quarterOf, TEXTCAST_FIRST_SEASON } from "./textcast.js";

export const textCastDir = (seasonCode: number) => join(DATA_DIR, "raw", "textcast", String(seasonCode));

export async function existingTextCastFiles(seasonCode: number): Promise<string[]> {
  try {
    return (await readdir(textCastDir(seasonCode))).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
}

export interface TextCastResult {
  games: number;
  saved: number;
  skipped: number;
  /** 빈 응답(옛 시즌·아직 입력 전) 경기 수 */
  empty: number;
  /** 게임 종료가 없어 저장하지 않은 경기 수 (매일) */
  incomplete: number;
  failed: string[];
  aborted: boolean;
}

/** 한 경기: 마지막 쿼터 → (연장이면) 4쿼터·앞 연장. 반환: 쿼터별 응답 */
async function fetchGame(gmkey: string): Promise<unknown[]> {
  const last = await getJson(textCastUrl(gmkey));
  if (!isTextCastResponse(last)) throw new Error("예상 밖 응답 형식 (배열 아님)");
  const q = quarterOf(last);
  const bodies: unknown[] = [last];
  for (const extra of q ? extraQuarters(q) : []) {
    await sleep(REQUEST_INTERVAL_MS);
    const body = await getJson(textCastUrl(gmkey, extra));
    if (!isTextCastResponse(body)) throw new Error(`${extra}: 예상 밖 응답 형식`);
    if (quarterOf(body) !== extra) throw new Error(`${extra} 을 달라 했는데 ${quarterOf(body) ?? "빈 응답"}`);
    bodies.push(body);
  }
  return bodies;
}

/** 한 시즌: 저장된 경기 목록의 끝난 정규시즌·플레이오프 경기 중 raw 없는 것 */
export async function collectSeasonTextCasts(opts: { seasonCode: number; today: string; mode: "daily" | "backfill" }): Promise<TextCastResult> {
  const { seasonCode, today, mode } = opts;
  const tag = `문자중계 ${seasonCode}`;
  const result: TextCastResult = { games: 0, saved: 0, skipped: 0, empty: 0, incomplete: 0, failed: [], aborted: false };
  if (seasonCode < TEXTCAST_FIRST_SEASON) return result;
  const list = await readGamesList(seasonCode);
  if (!list) {
    result.failed.push("경기 목록 없음 (슛 차트 수집이 먼저 받는다)");
    return result;
  }
  // 정규시즌 + 플레이오프·챔프전 (2026-10-28 사용자: 플레이오프 위닝샷도)
  const gmkeys = [
    ...endedRegularGmkeys(list, seasonCode, today),
    ...playoffGamesOf(list, seasonCode, today).filter((g) => g.ended).map((g) => g.gmkey),
  ];
  const todo = pendingGames(gmkeys, await existingTextCastFiles(seasonCode));
  result.games = gmkeys.length;
  result.skipped = gmkeys.length - todo.length;
  console.log(`[${tag}] 끝난 정규시즌·플레이오프 ${gmkeys.length}경기, 받을 것 ${todo.length}`);

  let streak = 0;
  for (let i = 0; i < todo.length; i++) {
    const gmkey = todo[i];
    try {
      const bodies = await fetchGame(gmkey);
      const merged = mergeQuarters(bodies);
      const ended = hasGameEnd(bodies[0]);
      if (merged.length === 0) result.empty++;
      else if (!ended) result.incomplete++;
      if (mode === "backfill" ? merged.length === 0 || ended : merged.length > 0 && ended) {
        await saveRaw(join("textcast", String(seasonCode)), gmkey, merged, true);
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
    `[${tag}] 저장 ${result.saved} · 건너뜀 ${result.skipped} · 빈 응답 ${result.empty} · 종료 전 ${result.incomplete} · 실패 ${result.failed.length}${result.aborted ? " (중단)" : ""}`,
  );
  return result;
}
