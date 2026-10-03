// 매일 수집을 "그날 경기가 끝난 뒤"에 돌리는 문지기 (2026-10-03 사용자 요청: 주말 낮 경기·평일 저녁 경기 시간이 달라서).
// fetch.yml 이 저녁에 여러 번(18:40·20:40·22:10·23:40 KST) 깨우면, 이 스크립트가 서버 C 오늘 경기 목록(요청 1회)을 보고
// 수집할지 정한다. 하루 한 번만 수집한다(data/last-fetch.json) — 서버 부하 원칙(하루 1회) 유지.
//   - 오늘 경기가 모두 끝나고 마지막 경기 종료 + WAIT_AFTER_END_MIN 이 지났으면 → 수집
//     (개막일 2026-10-03 14시 경기는 그날 19시 반에 선수 기록·경기별 기록·슛 차트가 다 들어와 있었다)
//   - 경기가 없거나 아직 안 끝났어도 마지막 시각(23시 이후, 늦게 깨어 자정을 넘긴 경우 포함)이면 → 수집 (예전처럼 하루 1회 보장)
// 사용: tsx scripts/fetch-gate.ts check  → GITHUB_OUTPUT 에 run=true|false (FORCE=1 이면 항상 true), mark=오늘 몫으로 기록할지
//       tsx scripts/fetch-gate.ts mark   → 오늘(수집 기준 날짜) 수집했다고 기록
import { readFile, writeFile } from "node:fs/promises";
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR, matchListUrl } from "./config.js";
import { getJson } from "./http.js";
import { isEndedGame } from "./shots.js";

/** 마지막 경기가 끝나고 이만큼 지나야 기록 입력이 끝났다고 본다 (분) */
export const WAIT_AFTER_END_MIN = 60;
/** 이 시각(KST, 분) 이후의 깨움은 "마지막 기회" — 경기와 관계없이 수집 */
export const LAST_SLOT_MIN = 23 * 60;
/** 새벽 이 시각(KST) 전까지는 전날로 친다 — 23:40 예약이 늦게 돌아 자정을 넘겨도 그날 몫으로 */
export const DAY_ROLLOVER_HOUR = 4;

const LAST_FETCH_FILE = join(DATA_DIR, "last-fetch.json");

/** KST 기준 { date: "YYYY-MM-DD", minutes } — 새벽 4시 전은 전날 날짜에 24시간을 더한 분 */
export function serviceClock(now: Date): { date: string; minutes: number } {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  let minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  if (kst.getUTCHours() < DAY_ROLLOVER_HOUR) {
    kst.setUTCDate(kst.getUTCDate() - 1);
    minutes += 24 * 60;
  }
  return { date: kst.toISOString().slice(0, 10), minutes };
}

/** "1556" → 956분, 없거나 이상하면 null */
export function hhmmToMinutes(v: unknown): number | null {
  const s = String(v ?? "").replace(/\D/g, "");
  if (s.length !== 4) return null;
  const h = Number(s.slice(0, 2)), m = Number(s.slice(2));
  return h < 30 && m < 60 ? h * 60 + m : null;
}

export interface GateDecision {
  run: boolean;
  reason: string;
}

/**
 * 수집할지 정한다 (순수).
 * games: 서버 C 경기 목록 응답(배열) 또는 null(조회 실패). 날짜가 오늘(수집 기준 날짜)인 경기만 본다(경기 구분 무관).
 */
export function decideFetch(opts: { now: Date; games: unknown; lastDate: string | null; force?: boolean }): GateDecision {
  const { date, minutes } = serviceClock(opts.now);
  if (opts.force) return { run: true, reason: "수동 실행" };
  if (opts.lastDate === date) return { run: false, reason: `${date} 은 이미 수집함` };
  const last = minutes >= LAST_SLOT_MIN;
  if (!Array.isArray(opts.games)) {
    return last ? { run: true, reason: "경기 목록 조회 실패 — 마지막 시각이라 수집" } : { run: false, reason: "경기 목록 조회 실패 — 다음 시각에" };
  }
  const ymd = date.replace(/-/g, "");
  const today = opts.games.filter((g) => String((g as Record<string, unknown>)?.gameDate ?? "").replace(/\D/g, "") === ymd) as Record<string, unknown>[];
  if (today.length === 0) {
    return last ? { run: true, reason: "오늘 경기 없음 — 하루 1회 수집" } : { run: false, reason: "오늘 경기 없음 — 마지막 시각(23시 이후)에 수집" };
  }
  const allEnded = today.every((g) => isEndedGame(g));
  if (allEnded) {
    const ends = today.map((g) => hhmmToMinutes(g.gameEnd)).filter((m): m is number => m !== null);
    const lastEnd = ends.length > 0 ? Math.max(...ends) : null;
    if (lastEnd === null || minutes >= lastEnd + WAIT_AFTER_END_MIN) {
      return { run: true, reason: `오늘 ${today.length}경기 모두 끝남 — 수집` };
    }
  }
  if (last) return { run: true, reason: "마지막 시각 — 끝나지 않은 경기가 있어도 수집" };
  return { run: false, reason: allEnded ? `경기 끝난 지 ${WAIT_AFTER_END_MIN}분이 안 됨 — 다음 시각에` : "아직 진행 중인 경기 있음 — 다음 시각에" };
}

async function readLastDate(): Promise<string | null> {
  try {
    const body = JSON.parse(await readFile(LAST_FETCH_FILE, "utf8"));
    return typeof body?.date === "string" ? body.date : null;
  } catch {
    return null;
  }
}

async function main() {
  const cmd = process.argv[2];
  const now = new Date();
  const { date } = serviceClock(now);
  if (cmd === "mark") {
    await writeFile(LAST_FETCH_FILE, JSON.stringify({ date, at: now.toISOString() }, null, 2) + "\n", "utf8");
    console.log(`수집 기록: ${date}`);
    return;
  }
  if (cmd !== "check") throw new Error("사용: fetch-gate.ts check | mark");
  const force = process.env.FORCE === "1";
  const lastDate = await readLastDate();
  let games: unknown = null;
  if (!force && lastDate !== date) {
    const ymd = date.replace(/-/g, "");
    games = await getJson(matchListUrl(ymd, ymd)).catch((e) => {
      console.log(`경기 목록 조회 실패: ${e instanceof Error ? e.message : e}`);
      return null;
    });
  }
  if (force && lastDate !== date) {
    // 수동 실행도 경기 목록을 본다: 오늘 경기가 끝난 뒤의 수동 실행만 "오늘 몫"으로 기록(mark)하고,
    // 경기 전에 돌린 수동 실행은 기록하지 않아 저녁 예약 수집이 그대로 돈다
    const ymd = date.replace(/-/g, "");
    games = await getJson(matchListUrl(ymd, ymd)).catch(() => null);
  }
  const d = decideFetch({ now, games, lastDate, force });
  const counts = force ? decideFetch({ now, games, lastDate }).run : d.run;
  console.log(`${date} ${d.run ? "수집" : "건너뜀"}: ${d.reason}${d.run && !counts ? " (오늘 몫으로 기록하지 않음)" : ""}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `run=${d.run}\nmark=${counts}\n`);
}

if (process.argv[1]?.endsWith("fetch-gate.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
