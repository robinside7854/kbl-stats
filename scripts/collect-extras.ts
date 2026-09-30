// 선수별 추가 수집 — 한 경기 최다(mostgame)·프로필. 매일 수집(fetch.ts)과 백필(backfill-highs.ts)이 같이 쓴다.
// 저장: data/raw/highs/{seasonCode}/{playerNo}.json, data/raw/profiles/{playerNo}.json — 응답 그대로(한 줄 JSON).
// 이상한 응답(형식이 다름·빈 응답)은 저장하지 않고 실패로 센다 → 기존 파일이 그대로 남고, 백필은 다음 실행에서 다시 받는다.
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, MAX_CONSECUTIVE_FAILURES, playerHighsUrl, playerProfileUrl, REQUEST_INTERVAL_MS } from "./config.js";
import { getJson, saveRaw, sleep } from "./http.js";
import { isMostGameResponse, pendingPlayers } from "./highs.js";
import { isProfileResponse } from "./player-master.js";

export interface CollectResult {
  saved: number;
  skipped: number;
  failed: string[];
  /** 연속 실패로 중간에 멈췄으면 true */
  aborted: boolean;
}

interface Options {
  /** true 면 이미 raw 가 있는 선수는 건너뛴다 (백필 이어받기). 매일 수집은 false — 현재 시즌은 매일 새로 받는다 */
  skipExisting: boolean;
  label: string;
}

async function existingNames(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

/** 공통 루프: 요청 간격 REQUEST_INTERVAL_MS, 연속 실패 MAX_CONSECUTIVE_FAILURES 번이면 멈춤 */
async function collect(
  playerNos: readonly string[],
  opts: Options & { dir: string; url: (no: string) => string; valid: (body: unknown) => boolean; save: (no: string, body: unknown) => Promise<unknown> },
): Promise<CollectResult> {
  const todo = opts.skipExisting ? pendingPlayers(playerNos, await existingNames(opts.dir)) : [...playerNos];
  const result: CollectResult = { saved: 0, skipped: playerNos.length - todo.length, failed: [], aborted: false };
  let streak = 0;
  for (let i = 0; i < todo.length; i++) {
    const no = todo[i];
    try {
      const body = await getJson(opts.url(no));
      if (!opts.valid(body)) throw new Error("예상 밖 응답 형식");
      await opts.save(no, body);
      result.saved++;
      streak = 0;
    } catch (e) {
      result.failed.push(`${no}: ${(e as Error).message.split("\n")[0]}`);
      if (++streak >= MAX_CONSECUTIVE_FAILURES) {
        result.aborted = true;
        console.error(`[${opts.label}] 연속 ${streak}회 실패 → 중단 (남은 ${todo.length - i - 1}명)`);
        break;
      }
    }
    if ((i + 1) % 50 === 0) console.log(`  [${opts.label}] ${i + 1}/${todo.length}`);
    await sleep(REQUEST_INTERVAL_MS);
  }
  console.log(
    `[${opts.label}] 저장 ${result.saved} · 건너뜀 ${result.skipped} · 실패 ${result.failed.length}${result.aborted ? " (중단)" : ""}`,
  );
  return result;
}

/** 한 시즌 선수들의 한 경기 최다 (그 시즌 하이 + 통산) */
export function collectHighs(seasonCode: number, playerNos: readonly string[], opts: Omit<Options, "label">) {
  return collect(playerNos, {
    ...opts,
    label: `한 경기 최다 ${seasonCode}`,
    dir: join(DATA_DIR, "raw", "highs", String(seasonCode)),
    url: (no) => playerHighsUrl(seasonCode, no),
    valid: isMostGameResponse,
    save: (no, body) => saveRaw(join("highs", String(seasonCode)), no, body, true),
  });
}

/** 선수 프로필 (생년월일·국가·출신교) */
export function collectProfiles(playerNos: readonly string[], opts: Omit<Options, "label">) {
  return collect(playerNos, {
    ...opts,
    label: "프로필",
    dir: join(DATA_DIR, "raw", "profiles"),
    url: playerProfileUrl,
    valid: isProfileResponse,
    save: (no, body) => saveRaw("profiles", no, body, true),
  });
}

/** raw traditional 파일이 있는가 (시즌 선수 목록의 근거) */
export function hasTraditional(seasonCode: number): boolean {
  return existsSync(join(DATA_DIR, "raw", String(seasonCode), "traditional_regular.json"));
}
