// 현역 등록 선수 명단 (서버 B 선수 마스터 regSc=Y, 약 186명) → data/raw/players/active.json
//
// 숏폼 "개막전 대기록" 이 은퇴 선수를 고르지 않게 쓴다(scripts/build-short-milestones.ts). 매일 수집(fetch.ts)의
// 전체 마스터(regSc=N)에는 은퇴 선수도 마지막 팀 코드가 그대로 남아 있어 현역을 가를 수 없다.
// 매일 수집(fetch.ts fetchActiveRoster)이 주 1회 같은 명단을 받고 바뀔 때만 저장한다(2026-10-06) — 이 파일은 손으로 한 번 받을 때만.
// 실행(Actions — 세션 환경은 KBL 차단): npx tsx scripts/fetch-active.ts
// 저장: 페이지 응답을 받은 그대로 배열로 (원칙 2). 실패하면 파일을 쓰지 않는다 → 빌더는 지난 시즌 명단으로 대신한다.

import { CODES_API, PAGE_SIZE, PLAYER_MASTER_MAX_PAGES, PLAYER_MASTER_PATH, REQUEST_INTERVAL_MS } from "./config.js";
import { getJson, saveRaw, sleep } from "./http.js";

type Page = { totalCn?: string | number; playerList?: unknown[] };
const url = (pageNo: number) =>
  `${CODES_API}${PLAYER_MASTER_PATH}?${new URLSearchParams({ regSc: "Y", pageNo: String(pageNo), listCn: String(PAGE_SIZE) })}`;

const pages: unknown[] = [];
let count = 0;
let total = Infinity;
for (let page = 1; page <= PLAYER_MASTER_MAX_PAGES && count < total; page++) {
  if (page > 1) await sleep(REQUEST_INTERVAL_MS);
  const body = await getJson(url(page));
  const parsed = (typeof body === "string" ? JSON.parse(body) : body) as Page;
  const list = Array.isArray(parsed?.playerList) ? parsed.playerList : null;
  if (!list) throw new Error(`현역 명단 ${page}쪽: 예상 밖 응답 (playerList 없음)`);
  if (list.length === 0) break;
  if (page === 1) total = Number(parsed.totalCn) || Infinity;
  pages.push(body);
  count += list.length;
}
if (count === 0) throw new Error("현역 명단: 0명");
await saveRaw("players", "active", pages);
console.log(`[현역 명단] ${count}명`);
