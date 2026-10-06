// KBL 공식 기록 수집 스크립트
// 실행: npm run fetch            → 기본 시즌(DEFAULT_SEASONS)만 + 현재 시즌 선수의 한 경기 최다·경기별 기록·프로필
//       npm run fetch -- 45 47   → 지정 시즌만 (+ 한 경기 최다·프로필 — 대상 시즌은 규칙대로, 지정 시즌과 무관)
//       npm run fetch:all        → 코드표에 있는 모든 시즌 (한 경기 최다는 받지 않는다 — 과거 전체는 backfill-highs)
//       --no-highs               → 한 경기 최다·경기별 기록·프로필 건너뜀
//       --no-shots               → 슛 차트 건너뜀 (fetch:all 도 건너뜀)
//
// 슛 차트(서버 C, scripts/shots.ts·collect-shots.ts): 같은 대상 시즌의 경기 목록(시즌 전체 달, 약 10회 — 일정 화면용, 2026-10-03)을 다시 받아
// data/raw/games/{시즌}/list.json 에 저장하고, 끝난 정규시즌 경기 중 raw 가 없는 것만 data/raw/shots/{시즌}/{gmkey}.json (보통 하루 0~5회).
//
// 한 경기 최다·경기별 기록·프로필 대상(scripts/highs.ts highsTargetSeasons): 현재 시즌 선수만(~200명 × 3회, 1.5초 간격 ≈ 15분).
// 경기별 기록은 시즌 하이의 3점·자유투 성공에 그 경기 시도 수를 붙이는 데 쓴다 (scripts/gamelogs.ts).
// 최신 시즌에 선수가 생기면(개막) 직전 시즌 선수는 받지 않는다(2026-10-04, PREVIOUS_SEASON_GRACE_DAYS 0). 마감된 옛 시즌도 다시 받지 않는다.
//
// 원칙(CLAUDE.md): 응답은 가공하지 않고 data/raw/{seasonCode}/ 에 그대로 저장한다.
// 시즌 수집 전에 선수 마스터(서버 B)를 전부 받아 data/raw/players/players.json 에 저장한다 (실패해도 시즌 수집은 계속).

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  STATS_API, CODES_API, GAME_CODE, SEASON_CODES_FALLBACK,
  DEFAULT_SEASONS, REQUEST_INTERVAL_MS, PAGE_SIZE, DATA_DIR,
  PLAYER_MASTER_PATH, PLAYER_MASTER_REG_SC, PLAYER_MASTER_MAX_PAGES, AWARDS_PAGE_URL, SITE_ORIGIN,
  HIGHLIGHT_FEED_URLS, HIGHLIGHT_SOURCE, highlightApi,
} from "./config.js";
import { getJson, getText, saveRaw, sleep } from "./http.js";
import { bundleScriptSrc, extractAwardsData } from "./awards.js";
import { collectGameLogs, collectHighs, collectProfiles } from "./collect-extras.js";
import { collectSeasonShots } from "./collect-shots.js";
import { highsTargetSeasons, playerNosFromTraditional, todayKst, updateFirstSeen } from "./highs.js";
import { seasonLabelOf } from "./shots.js";
import { fetchHighlightSource, hasNewHighlight, readSavedFeeds } from "./highlights.js";
import { applyRosterCheck, EMPTY_ROSTER_LOG, rosterCheckDue, type RosterLog } from "./active-roster.js";
import { masterRows } from "./player-master.js";

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

/** 현역 등록 명단 확인 기록 (scripts/active-roster.ts RosterLog) */
const ROSTER_LOG_FILE = join(DATA_DIR, "active-roster-log.json");

/**
 * 현역 등록 명단(regSc=Y, 약 190명 · 1~2회 요청) — 일주일에 한 번만 받고(rosterCheckDue), 바뀌었을 때만
 * data/raw/players/active.json 을 다시 쓴다. 확인 날짜·변경은 data/active-roster-log.json.
 * 한 쪽이라도 실패하면 아무것도 쓰지 않는다(지난 명단·확인 날짜 그대로 → 다음 날 다시 시도).
 */
async function fetchActiveRoster(today: string): Promise<void> {
  const log: RosterLog = await readFile(ROSTER_LOG_FILE, "utf8").then((t) => JSON.parse(t) as RosterLog).catch(() => EMPTY_ROSTER_LOG);
  if (!rosterCheckDue(log.checkedAt, today)) {
    console.log(`[현역 명단] 이번 주 확인함(${log.checkedAt}) — 건너뜀`);
    return;
  }
  type Page = { totalCn?: string | number; playerList?: unknown[] };
  const url = (pageNo: number) =>
    `${CODES_API}${PLAYER_MASTER_PATH}?${new URLSearchParams({ regSc: "Y", pageNo: String(pageNo), listCn: String(PAGE_SIZE) })}`;
  const pages: unknown[] = [];
  let count = 0;
  let total = Infinity;
  for (let page = 1; page <= PLAYER_MASTER_MAX_PAGES && count < total; page++) {
    await sleep(REQUEST_INTERVAL_MS);
    const body = await getJson(url(page));
    const parsed = (typeof body === "string" ? JSON.parse(body) : body) as Page;
    const list = Array.isArray(parsed?.playerList) ? parsed.playerList : null;
    if (!list) throw new Error(`${page}쪽: 예상 밖 응답 (playerList 없음)`);
    if (list.length === 0) break;
    if (page === 1) total = Number(parsed.totalCn) || Infinity;
    pages.push(body);
    count += list.length;
  }
  if (count === 0) throw new Error("0명 (헤더 누락 등으로 빈 응답)");
  const file = join(DATA_DIR, "raw", "players", "active.json");
  const oldRows = await readFile(file, "utf8").then((t) => masterRows(JSON.parse(t))).catch(() => null);
  const r = applyRosterCheck(log, oldRows, masterRows(pages), today);
  if (r.changed) {
    await saveRaw("players", "active", pages);
    console.log(`[현역 명단] ${count}명 — 바뀜(들어옴 ${r.changed.added.length} · 빠짐 ${r.changed.removed.length} · 정보 바뀜 ${r.changed.updated}) → 저장`);
  } else {
    console.log(`[현역 명단] ${count}명 — 지난번과 같음`);
  }
  await writeFile(ROSTER_LOG_FILE, `${JSON.stringify(r.log, null, 2)}\n`, "utf8");
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
 * 매일 추가 수집(한 경기 최다·경기별 기록·프로필·슛 차트)의 대상 시즌 — 시즌 첫 수집일 파일도 여기서 갱신한다.
 * 규칙은 scripts/highs.ts highsTargetSeasons (현재 시즌만 — 개막 전에는 직전 시즌이 "현재").
 */
async function dailyTargetSeasons(knownSeasons: number[], fetchedToday: number[]) {
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
  return { today, targets: highsTargetSeasons({ seasons, firstSeen, today }), nosBySeason };
}

/**
 * 선수·경기 하나씩 받는 요청에서 몇 건만 실패한 것은 "경고" — 그날 수집을 실패로 치지 않는다(다음 날 다시 받는다).
 * 연속 실패로 중단(aborted, 서버가 막힘)됐을 때만 "실패" → 수집 단계가 실패로 끝나 그날 몫이 기록되지 않고 다음 깨어남에 다시 돈다.
 * (2026-10-04: 700여 건 중 503 한 건 때문에 하루 수집 전체가 실패로 기록된 일이 있어서)
 */
export interface Issues {
  failed: string[];
  warnings: string[];
}
function noteIssue(out: Issues, label: string, r: { failed: string[]; aborted?: boolean }, unit: string): void {
  if (!r.failed.length) return;
  const msg = `${label}: ${r.failed.length}${unit} 실패${r.aborted ? "(중단)" : ""} — 예: ${r.failed[0]}`;
  (r.aborted ? out.failed : out.warnings).push(msg);
}

/**
 * 현재 시즌 선수의 한 경기 최다 + 경기별 기록 + 프로필. 시즌 수집이 끝난 뒤 raw traditional 의 선수 목록으로 돈다.
 * 반환: 실패·경고 요약 (선수별 실패는 개수만 — 목록이 길어지지 않게)
 */
async function fetchHighsAndProfiles(targets: number[], nosBySeason: Map<number, string[]>): Promise<Issues> {
  console.log(`\n한 경기 최다·경기별 기록·프로필 대상 시즌: ${targets.join(", ") || "없음"}`);
  const out: Issues = { failed: [], warnings: [] };
  const profileNos = new Set<string>();
  for (const code of targets) {
    const nos = nosBySeason.get(code) ?? [];
    nos.forEach((no) => profileNos.add(no));
    const r = await collectHighs(code, nos, { skipExisting: false });
    noteIssue(out, `highs ${code}`, r, "명");
    // 경기별 기록: 시즌 하이 3점·자유투 성공의 시도 수용. 매일 새로 받는다(시즌 중 경기가 늘어난다)
    const g = await collectGameLogs(code, nos, { skipExisting: false });
    noteIssue(out, `gamelogs ${code}`, g, "명");
  }
  if (profileNos.size > 0) {
    const r = await collectProfiles([...profileNos], { skipExisting: false });
    noteIssue(out, "profiles", r, "명");
  }
  return out;
}

/**
 * 현재 시즌 슛 차트: 경기 목록(시즌 전체 달, 약 10회)을 다시 받고 끝난 정규시즌 경기 중 raw 없는 것만 (보통 하루 0~5회).
 * 대상 시즌은 한 경기 최다와 같다. 반환: 실패·경고 요약 (경기 목록 실패는 collectSeasonShots 가 aborted 로 알린다)
 */
async function fetchShots(targets: number[], today: string): Promise<Issues> {
  const codesFile = await readJsonOr<unknown>(join(DATA_DIR, "codes", "seasons.json"), null);
  const out: Issues = { failed: [], warnings: [] };
  console.log(`\n슛 차트 대상 시즌: ${targets.join(", ") || "없음"}`);
  for (const code of targets) {
    const label = seasonLabelOf(code, codesFile, SEASON_CODES_FALLBACK);
    if (!label) {
      out.failed.push(`shots ${code}: 시즌 라벨 없음`);
      continue;
    }
    const r = await collectSeasonShots({ seasonCode: code, label, today, mode: "daily" });
    // 경기 목록(점수·끝남 여부)을 못 받으면 오늘 경기가 화면에 안 들어간다 → 몇 건이어도 실패로 쳐서 다음 깨어남에 다시
    const listFailed = r.failed.some((f) => f.startsWith("경기 목록"));
    noteIssue(out, `shots ${code}`, { ...r, aborted: r.aborted || listFailed }, "건");
  }
  return out;
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

  // 플레이오프(6강~챔프전, "03,04")·챔피언결정전("04") 시즌 합계 (2026-10-03 사용자: 역대 기록 "한 시즌 최다" 플옵·챔프전 별도).
  // 정규시즌과 같은 주소·형식. 없는 시즌(진행 중·옛 시즌)은 빈 data 로 온다. 실패해도 시즌은 버리지 않는다
  for (const [name, gameCode] of [["playoff", GAME_CODE.playoff], ["finals", GAME_CODE.finals]] as const) {
    try {
      const body = await fetchAllPages("traditional", seasonCode, gameCode);
      await saveRaw(seasonCode, `traditional_${name}`, body);
      results.push(`${name} ${body.data!.length}행`);
    } catch (e) {
      results.push(`${name} 실패(${(e as Error).message.split("\n")[0]})`);
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

/**
 * 역대 수상 (공홈 역대수상현황 화면의 JS 번들 안 표) → data/raw/awards/awards.json (표 데이터 그대로, scripts/awards.ts).
 * 요청 2회(화면 HTML + 번들 약 6MB). 표를 못 찾거나 형식이 다르면 저장하지 않는다(전날 파일 유지).
 */
async function fetchAwards(): Promise<void> {
  const html = await getText(AWARDS_PAGE_URL);
  const src = bundleScriptSrc(html);
  if (!src) throw new Error("화면 HTML 에서 번들 주소를 못 찾음");
  await sleep(REQUEST_INTERVAL_MS);
  const data = extractAwardsData(await getText(`${SITE_ORIGIN}${src}`));
  if (!data) throw new Error(`번들(${src})에서 수상 표를 못 찾음 — 화면 구조가 바뀌었을 수 있음`);
  const file = await saveRaw("awards", "awards", data, true);
  console.log(`[역대 수상] 섹션 ${data.length}개 → ${file}`);
}

/**
 * 경기 하이라이트 RSS (TVING SPORTS 유튜브, 2026-10-04) → data/raw/highlights/tving/{시각}.xml (응답 그대로).
 * RSS 는 최근 15개뿐이라 매일 쌓는다. 새 경기 하이라이트가 없으면 저장하지 않는다(같은 파일이 쌓이지 않게).
 * KBL 서버가 아니라 유튜브라 실패해도 경고만.
 */
async function fetchHighlights(): Promise<void> {
  const src = await fetchHighlightSource(HIGHLIGHT_FEED_URLS, highlightApi());
  const entries = src.entries;
  const dir = join(DATA_DIR, "raw", "highlights", HIGHLIGHT_SOURCE);
  const known = new Set((await readSavedFeeds(dir)).map((e) => e.videoId));
  if (!hasNewHighlight(entries, known)) {
    console.log(`[하이라이트] 새 경기 영상 없음 (RSS ${entries.length}개)`);
    return;
  }
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13); // 20261004T1426
  await writeFile(join(dir, `${stamp}.${src.ext}`), src.body, "utf8");
  console.log(`[하이라이트] 새 영상 있음 → ${dir}/${stamp}.${src.ext}`);
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const explicit = args.filter((a) => /^\d+$/.test(a)).map(Number);

  const skipHighs = all || args.includes("--no-highs");
  const skipShots = all || args.includes("--no-shots");
  const knownSeasons = await fetchCodes();
  const targets = all ? knownSeasons : explicit.length > 0 ? explicit : DEFAULT_SEASONS;

  const failed: string[] = [];
  // 몇 건만 실패한 선수·경기 요청 — 출력만 하고 종료 코드는 0 (Issues 주석)
  const warnings: string[] = [];

  // 선수 마스터 (포지션·국적·신장·드래프트) — 실패해도 시즌 수집은 계속하고 실패 목록에 남긴다
  try {
    await fetchPlayerMaster();
  } catch (e) {
    failed.push(`players(선수 마스터): ${(e as Error).message}`);
    console.error(`[선수 마스터] 실패: ${(e as Error).message}`);
    await sleep(REQUEST_INTERVAL_MS);
  }

  // 역대 수상 (MVP·베스트5 등) — 실패해도 계속
  try {
    await sleep(REQUEST_INTERVAL_MS);
    await fetchAwards();
  } catch (e) {
    failed.push(`awards(역대 수상): ${(e as Error).message}`);
    console.error(`[역대 수상] 실패: ${(e as Error).message}`);
  }
  await sleep(REQUEST_INTERVAL_MS);

  // 경기 하이라이트 영상 (유튜브 RSS 1회) — 실패해도 경고만
  if (!all) {
    try {
      await fetchHighlights();
    } catch (e) {
      warnings.push(`highlights(하이라이트 RSS): ${(e as Error).message}`);
    }
  }

  // 현역 등록 명단 (주 1회) — 실패해도 경고만 (다음 날 다시 시도)
  if (!all) {
    try {
      await fetchActiveRoster(todayKst());
    } catch (e) {
      warnings.push(`active(현역 등록 명단): ${(e as Error).message}`);
    }
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

  // 한 경기 최다·경기별 기록·프로필 (현재 시즌 선수)·슛 차트 (현재 시즌 경기) — 실패해도 시즌 기록은 이미 저장됨
  if (!skipHighs || !skipShots) {
    try {
      const daily = await dailyTargetSeasons(knownSeasons, targets);
      if (!skipHighs) {
        try {
          const r = await fetchHighsAndProfiles(daily.targets, daily.nosBySeason);
          failed.push(...r.failed);
          warnings.push(...r.warnings);
        } catch (e) {
          failed.push(`highs: ${(e as Error).message}`);
        }
      }
      if (!skipShots) {
        try {
          const r = await fetchShots(daily.targets, daily.today);
          failed.push(...r.failed);
          warnings.push(...r.warnings);
        } catch (e) {
          failed.push(`shots: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      failed.push(`daily targets: ${(e as Error).message}`);
    }
  }

  await writeFile(
    join(DATA_DIR, "last_fetch.json"),
    JSON.stringify({ at: new Date().toISOString(), targets, failed, warnings }, null, 2),
  );

  if (warnings.length > 0) console.warn(`\n경고 ${warnings.length}건 (몇 건만 실패 — 다음 수집 때 다시 받음, 오늘 수집은 성공으로 친다):\n- ${warnings.join("\n- ")}`);
  if (failed.length > 0) {
    console.error(`\n실패 ${failed.length}건:\n- ${failed.join("\n- ")}`);
    process.exitCode = 1;
  } else {
    console.log("\n모든 시즌 수집 완료");
  }
}

main();
