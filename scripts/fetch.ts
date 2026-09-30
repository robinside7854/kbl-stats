// KBL 공식 기록 수집 스크립트
// 실행: npm run fetch            → 기본 시즌(DEFAULT_SEASONS)만 + 현재 시즌 선수의 한 경기 최다·프로필
//       npm run fetch -- 45 47   → 지정 시즌만 (+ 한 경기 최다·프로필 — 대상 시즌은 규칙대로, 지정 시즌과 무관)
//       npm run fetch:all        → 코드표에 있는 모든 시즌 (한 경기 최다는 받지 않는다 — 과거 전체는 backfill-highs)
//       --no-highs               → 한 경기 최다·프로필 건너뜀
//
// 한 경기 최다·프로필 대상(scripts/highs.ts highsTargetSeasons): 현재 시즌 선수만(~200명 × 2회, 1.5초 간격 ≈ 10분).
// 직전 시즌은 최신 시즌 첫 수집일(data/season-first-seen.json)부터 30일 동안만 같이 받고, 마감된 옛 시즌은 다시 받지 않는다.
//
// 원칙(CLAUDE.md): 응답은 가공하지 않고 data/raw/{seasonCode}/ 에 그대로 저장한다.
// 시즌 수집 전에 선수 마스터(서버 B)를 전부 받아 data/raw/players/players.json 에 저장한다 (실패해도 시즌 수집은 계속).

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  STATS_API, CODES_API, GAME_CODE, SEASON_CODES_FALLBACK,
  DEFAULT_SEASONS, REQUEST_INTERVAL_MS, PAGE_SIZE, DATA_DIR,
  PLAYER_MASTER_PATH, PLAYER_MASTER_REG_SC, PLAYER_MASTER_MAX_PAGES,
} from "./config.js";
import { getJson, saveRaw, sleep } from "./http.js";
import { collectHighs, collectProfiles } from "./collect-extras.js";
import { highsTargetSeasons, playerNosFromTraditional, todayKst, updateFirstSeen } from "./highs.js";

async function saveCodes(name: string, body: unknown) {
  const dir = join(DATA_DIR, "codes");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${name}.json`), JSON.stringify(body, null, 2), "utf8");
}

/** 서버 A: 선수 기록 (traditional | advanced) */
function playerRecordsUrl(kind: "traditional" | "advanced", seasonCode: number, gameCode: string, pageNo: number) {
  const q = new URLSearchParams({
    seasonCode: String(seasonCode),
    gameCode,
    sortDataSc: "SCORE",   // advanced에서도 SCORE만 안전. 다른 열 이름은 500 에러 (CLAUDE.md 참고)
    sortOrderSc: "desc",
    listCn: String(PAGE_SIZE),
    pageNo: String(pageNo),
    ruleCk: "0", perCn: "0", lastCn: "0", partIfList: "0", draftNo: "0",
  });
  return `${STATS_API}/api/records/player/general/${kind}?${q}`;
}

type RecordsBody = { resultCode?: number; message?: string; data?: Array<Record<string, unknown>> };

/** 모든 페이지를 받아 하나의 응답 형태로 합친다. 각 행의 totalCn이 전체 행 수. */
async function fetchAllPages(kind: "traditional" | "advanced", seasonCode: number, gameCode: string): Promise<RecordsBody> {
  const first = (await getJson(playerRecordsUrl(kind, seasonCode, gameCode, 1))) as RecordsBody;
  if (first.resultCode !== 200 || !Array.isArray(first.data)) {
    throw new Error(`${kind}: 예상 밖 응답 (resultCode=${first.resultCode}, ${first.message ?? ""})`);
  }
  const total = Number(first.data[0]?.totalCn ?? first.data.length);
  const rows = [...first.data];
  for (let page = 2; rows.length < total; page++) {
    await sleep(REQUEST_INTERVAL_MS);
    const next = (await getJson(playerRecordsUrl(kind, seasonCode, gameCode, page))) as RecordsBody;
    if (!Array.isArray(next.data) || next.data.length === 0) break;
    rows.push(...next.data);
  }
  return { ...first, data: rows };
}

/** 코드표 수집 (시즌·팀·경기구분). 실패해도 수집은 계속한다. */
async function fetchCodes(): Promise<number[]> {
  let seasons: number[] = Object.keys(SEASON_CODES_FALLBACK).map(Number);
  try {
    const recent = await getJson(`${CODES_API}/api/v1/Common/recent-seasons?seriesCd=1`);
    await saveCodes("seasons", recent);
    // 응답 구조가 문서화돼 있지 않아, 숫자형 seasonCode 필드를 넓게 찾는다
    // recent-seasons는 현재 시즌 1개만 돌려준다(2026-09-29 확인). 백업 상수와 합쳐 새 시즌만 추가한다.
    const found = JSON.stringify(recent).match(/"seasonCode"\s*:\s*(\d+)/gi)?.map((m) => Number(m.replace(/\D/g, ""))) ?? [];
    seasons = [...new Set([...seasons, ...found])].sort((a, b) => a - b);
    console.log(`코드표: API ${found.length}개 + 백업 → 시즌 ${seasons.length}개`);
  } catch (e) {
    console.warn(`코드표 수집 실패 → 백업 상수 사용: ${(e as Error).message}`);
  }
  await sleep(REQUEST_INTERVAL_MS);
  return seasons;
}

/**
 * 선수 마스터 전 페이지 수집 → data/raw/players/players.json.
 * 저장 형태: 페이지 응답을 받은 그대로 배열로 모은 것 [{ totalCn, playerList: [...] }, ...] (원칙 2: 가공하지 않음).
 * 첫 페이지의 totalCn 만큼 모이거나, 빈 페이지가 오거나, 페이지 상한에 닿으면 멈춘다.
 * 한 페이지라도 실패하면 파일을 쓰지 않고 에러 — 기존 파일(전날 수집분)이 그대로 남는다.
 */
async function fetchPlayerMaster(): Promise<void> {
  type MasterPage = { totalCn?: string | number; playerList?: unknown[] };
  const url = (pageNo: number) =>
    `${CODES_API}${PLAYER_MASTER_PATH}?${new URLSearchParams({ regSc: PLAYER_MASTER_REG_SC, pageNo: String(pageNo), listCn: String(PAGE_SIZE) })}`;
  const asPage = (body: unknown): MasterPage => (typeof body === "string" ? JSON.parse(body) : body) as MasterPage;

  const pages: unknown[] = [];
  let count = 0;
  let total = Infinity;
  for (let page = 1; page <= PLAYER_MASTER_MAX_PAGES && count < total; page++) {
    if (page > 1) await sleep(REQUEST_INTERVAL_MS);
    const body = await getJson(url(page));
    const parsed = asPage(body);
    const list = Array.isArray(parsed?.playerList) ? parsed.playerList : null;
    if (!list) throw new Error(`선수 마스터 ${page}쪽: 예상 밖 응답 (playerList 없음)`);
    if (list.length === 0) break;
    if (page === 1) total = Number(parsed.totalCn) || Infinity;
    pages.push(body);
    count += list.length;
  }
  if (count === 0) throw new Error("선수 마스터: 0명 (헤더 누락 등으로 빈 응답)");
  if (Number.isFinite(total) && count < total) console.warn(`선수 마스터: ${count}/${total}명만 받음 (페이지 상한 또는 빈 페이지)`);
  await saveRaw("players", "players", pages);
  console.log(`[선수 마스터] ${count}명 (${pages.length}쪽)`);
  await sleep(REQUEST_INTERVAL_MS);
}

/** 시즌 첫 수집일 기록 파일 (시즌 코드 → "YYYY-MM-DD"). 한 경기 최다 대상 선정에 쓴다 */
const FIRST_SEEN_FILE = join(DATA_DIR, "season-first-seen.json");

async function readJsonOr<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** raw traditional 파일의 선수 번호 (없으면 빈 배열) */
async function rawPlayerNos(seasonCode: number): Promise<string[]> {
  return playerNosFromTraditional(await readJsonOr(join(DATA_DIR, "raw", String(seasonCode), "traditional_regular.json"), null));
}

/**
 * 현재 시즌 선수의 한 경기 최다 + 프로필. 시즌 수집이 끝난 뒤 raw traditional 의 선수 목록으로 돈다.
 * 반환: 실패 요약 (선수별 실패는 개수만 — 목록이 길어지지 않게)
 */
async function fetchHighsAndProfiles(knownSeasons: number[], fetchedToday: number[]): Promise<string[]> {
  const today = todayKst();
  let firstSeen = await readJsonOr<Record<string, string>>(FIRST_SEEN_FILE, {});
  const seasons: { seasonCode: number; playerCount: number }[] = [];
  const nosBySeason = new Map<number, string[]>();
  for (const code of knownSeasons) {
    const nos = await rawPlayerNos(code);
    nosBySeason.set(code, nos);
    seasons.push({ seasonCode: code, playerCount: nos.length });
    // 오늘 받은 시즌만 첫 수집일을 기록 (옛 raw 가 있다고 오늘 날짜를 찍지 않는다)
    if (fetchedToday.includes(code)) firstSeen = updateFirstSeen(firstSeen, code, nos.length, today);
  }
  await writeFile(FIRST_SEEN_FILE, JSON.stringify(firstSeen, null, 2) + "\n", "utf8");

  const targets = highsTargetSeasons({ seasons, firstSeen, today });
  console.log(`\n한 경기 최다·프로필 대상 시즌: ${targets.join(", ") || "없음"}`);
  const failed: string[] = [];
  const profileNos = new Set<string>();
  for (const code of targets) {
    const nos = nosBySeason.get(code) ?? [];
    nos.forEach((no) => profileNos.add(no));
    const r = await collectHighs(code, nos, { skipExisting: false });
    if (r.failed.length) failed.push(`highs ${code}: ${r.failed.length}명 실패${r.aborted ? "(중단)" : ""} — 예: ${r.failed[0]}`);
  }
  if (profileNos.size > 0) {
    const r = await collectProfiles([...profileNos], { skipExisting: false });
    if (r.failed.length) failed.push(`profiles: ${r.failed.length}명 실패${r.aborted ? "(중단)" : ""} — 예: ${r.failed[0]}`);
  }
  return failed;
}

async function fetchSeason(seasonCode: number) {
  const label = SEASON_CODES_FALLBACK[seasonCode] ?? String(seasonCode);
  const results: string[] = [];

  // traditional은 필수, advanced는 옛 시즌에 없을 수 있어 실패해도 시즌 전체를 버리지 않는다
  for (const kind of ["traditional", "advanced"] as const) {
    try {
      const body = await fetchAllPages(kind, seasonCode, GAME_CODE.regular);
      await saveRaw(seasonCode, `${kind}_regular`, body);
      results.push(`${kind} ${body.data!.length}행`);
    } catch (e) {
      if (kind === "traditional") throw e;
      results.push(`advanced 없음(${(e as Error).message.split("\n")[0]})`);
    }
    await sleep(REQUEST_INTERVAL_MS);
  }

  // 팀 코드표는 시즌별로 다를 수 있어 시즌 폴더에 함께 저장
  try {
    const teams = await getJson(
      `${CODES_API}/api/v1/Common/team?seasonCodeList=${seasonCode}&gameCodeList=${GAME_CODE.regular}&startsDs=&endDs=`,
    );
    await saveRaw(seasonCode, "teams", teams);
    results.push("teams");
  } catch (e) {
    results.push(`teams 실패(${(e as Error).message})`);
  }
  await sleep(REQUEST_INTERVAL_MS);

  console.log(`[${label}] ${results.join(", ")}`);
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const explicit = args.filter((a) => /^\d+$/.test(a)).map(Number);

  const skipHighs = all || args.includes("--no-highs");
  const knownSeasons = await fetchCodes();
  const targets = all ? knownSeasons : explicit.length > 0 ? explicit : DEFAULT_SEASONS;

  const failed: string[] = [];

  // 선수 마스터 (포지션·국적·신장·드래프트) — 실패해도 시즌 수집은 계속하고 실패 목록에 남긴다
  try {
    await fetchPlayerMaster();
  } catch (e) {
    failed.push(`players(선수 마스터): ${(e as Error).message}`);
    console.error(`[선수 마스터] 실패: ${(e as Error).message}`);
    await sleep(REQUEST_INTERVAL_MS);
  }

  console.log(`수집 대상 시즌 코드: ${targets.join(", ")}`);

  for (const seasonCode of targets) {
    try {
      await fetchSeason(seasonCode);
    } catch (e) {
      // 한 시즌이 실패해도 나머지는 계속 (CLAUDE.md 코딩 규칙)
      failed.push(`${seasonCode}: ${(e as Error).message}`);
      console.error(`[${seasonCode}] 실패: ${(e as Error).message}`);
    }
  }

  // 한 경기 최다·프로필 (현재 시즌 선수) — 실패해도 시즌 기록은 이미 저장됨
  if (!skipHighs) {
    try {
      failed.push(...(await fetchHighsAndProfiles(knownSeasons, targets)));
    } catch (e) {
      failed.push(`highs: ${(e as Error).message}`);
    }
  }

  await writeFile(
    join(DATA_DIR, "last_fetch.json"),
    JSON.stringify({ at: new Date().toISOString(), targets, failed }, null, 2),
  );

  if (failed.length > 0) {
    console.error(`\n실패 ${failed.length}건:\n- ${failed.join("\n- ")}`);
    process.exitCode = 1;
  } else {
    console.log("\n모든 시즌 수집 완료");
  }
}

main();
