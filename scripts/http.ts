// KBL 서버 요청·raw 저장 공용 함수 (fetch.ts·backfill-highs.ts). API 주소는 config.ts 에만 둔다.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "./config.js";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      // 공홈 브라우저 요청과 동일한 형태로 보낸다. 별도 인증 없음 (2026-09-29 확인)
      // 서버 B 는 Referer/Origin/Accept 가 없으면 빈 응답 (2026-09-30 확인)
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

/**
 * data/raw/{dir}/{name}.json 에 응답을 그대로 저장 (원칙 2).
 * compact: 들여쓰기 없이 — 파일이 수천 개인 한 경기 최다·프로필은 용량을 줄이려고 한 줄로 (내용은 응답 그대로).
 */
export async function saveRaw(dir: number | string, name: string, body: unknown, compact = false) {
  const full = join(DATA_DIR, "raw", String(dir));
  await mkdir(full, { recursive: true });
  const file = join(full, `${name}.json`);
  await writeFile(file, compact ? JSON.stringify(body) : JSON.stringify(body, null, 2), "utf8");
  return file;
}
