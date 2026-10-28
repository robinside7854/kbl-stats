// 서버 A(api-stats) 404 조사 (2026-10-28 밤, main 에 넣지 않음): 지금 주소가 되는지 + 공홈 번들이 부르는 기록 주소
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("probe/out4", { recursive: true });
const H = { Accept: "application/json", Referer: "https://kbl.or.kr/", Origin: "https://kbl.or.kr", "User-Agent": "Mozilla/5.0 (kbl-stats fan project)" };
const log = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function hit(url, h = H) {
  await sleep(1200);
  try { const r = await fetch(url, { headers: h }); const t = await r.text(); log.push(`${r.status} ${r.headers.get("content-type")} ${url}\n  ${t.slice(0, 300).replace(/\s+/g, " ")}`); return t; }
  catch (e) { log.push(`ERR ${url} ${e}`); return ""; }
}
const q = "gameCode=01&sortDataSc=SCORE&sortOrderSc=desc&listCn=200&pageNo=1&ruleCk=0&perCn=0&lastCn=0&partIfList=0&draftNo=0";
await hit(`https://api-stats.kbl.or.kr/api/records/player/general/traditional?seasonCode=49&${q}`);
await hit(`https://api-stats.kbl.or.kr/api/records/player/general/advanced?seasonCode=49&${q}`);
await hit(`https://api-stats.kbl.or.kr/api/records/team/general/traditional?seasonCode=49&gameCode=01&sortDataSc=WIN_A&sortOrderSc=desc&perCn=0&lastCn=0&partIfList=0&draftNo=0`);
await hit(`https://api-stats.kbl.or.kr/`);
const page = await hit("https://kbl.or.kr/record/player", { "User-Agent": "Mozilla/5.0" });
const src = /src="(\/assets\/index-[^"]+\.js)"/.exec(page)?.[1];
log.push(`bundle ${src}`);
if (src) {
  const b = await hit(`https://kbl.or.kr${src}`, { "User-Agent": "Mozilla/5.0" });
  const hosts = [...new Set(b.match(/https?:\/\/[a-z0-9.-]*kbl[a-z0-9.-]*/g) ?? [])];
  log.push(`hosts ${hosts.join(" ")}`);
  const paths = [...new Set(b.match(/["'`]\/api\/records\/[^"'`]{0,80}/g) ?? [])];
  log.push(`paths ${paths.slice(0, 40).join(" ")}`);
  for (const m of b.matchAll(/records\/player\/general/g)) { log.push(`ctx ${b.slice(Math.max(0, m.index - 300), m.index + 200)}`); break; }
}
writeFileSync("probe/out4/log.txt", log.join("\n"));
