// KBL 공식 기록 수집 스크립트
// 실행: npm run fetch            → 기본 시즌(DEFAULT_SEASONS)만
//       npm run fetch -- 45 47   → 지정 시즌만
//       npm run fetch:all        → 코드표에 있는 모든 시즌
//
// 원칙(CLAUDE.md): 응답은 가공하지 않고 data/raw/{seasonCode}/ 에 그대로 저장한다.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  STATS_API, CODES_API, GAME_CODE, SEASON_CODES_FALLBACK,
  DEFAULT_SEASONS, REQUEST_INTERVAL_MS, PAGE_SIZE, DATA_DIR,
} from "./config.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      // 공홈 브라우저 요청과 동일한 형태로 보낸다. 별도 인증 없음 (2026-09-29 확인)
      Accept: "application/json",
      Referer: "https://kbl.or.kr/",
      Origin: "https://kbl.or.kr",
      "User-Agent": "kbl-stats fan project (non-commercial; github.com/robinside7854/kbl-stats)",
    },
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`HTTP ${res.status} ${url}\n    ${detail}`);
  }
  return res.json();
}

async function saveRaw(seasonCode: number, name: string, body: unknown) {
  const dir = join(DATA_DIR, "raw", String(seasonCode));
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${name}.json`);
  await writeFile(file, JSON.stringify(body, null, 2), "utf8");
  return file;
}

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

  const knownSeasons = await fetchCodes();
  const targets = all ? knownSeasons : explicit.length > 0 ? explicit : DEFAULT_SEASONS;

  console.log(`수집 대상 시즌 코드: ${targets.join(", ")}`);
  const failed: string[] = [];

  for (const seasonCode of targets) {
    try {
      await fetchSeason(seasonCode);
    } catch (e) {
      // 한 시즌이 실패해도 나머지는 계속 (CLAUDE.md 코딩 규칙)
      failed.push(`${seasonCode}: ${(e as Error).message}`);
      console.error(`[${seasonCode}] 실패: ${(e as Error).message}`);
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
