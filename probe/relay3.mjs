// 문자중계 3차 — 쿼터별로 받아 경기 전체를 모은다(공홈은 ?quarterList=Q1 꼴), 옛 시즌 포함 (2026-10-28, main 에 넣지 않음)
import { writeFileSync, mkdirSync } from "node:fs";
const OUT = "probe/out3";
mkdirSync(OUT, { recursive: true });
const UA = "Mozilla/5.0 (kbl-stats fan project; non-commercial)";
const site = { Accept: "application/json, text/plain, */*", Referer: "https://kbl.or.kr/", Origin: "https://kbl.or.kr", "User-Agent": UA, channel: "WEB", lang: "ko", teamcode: "XX", "X-Requested-With": "XMLHttpRequest" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const GAMES = ["S49G01N36", "S49G01N38", "S49G01N40", "S47G01N1", "S47G01N268", "S47G04N1", "S41G01N100", "S25G01N100", "S15G01N100", "S11G01N100", "S11G01N1"];
const QS = ["Q1", "Q2", "Q3", "Q4", "X1", "X2", "X3"];
for (const g of GAMES) {
  const all = [];
  for (const q of QS) {
    await sleep(1200);
    let d = null;
    try { const r = await fetch(`https://api.kbl.or.kr/match/${g}/text-cast?quarterList=${q}`, { headers: site }); d = r.status === 200 ? await r.json() : null; say(`${g} ${q} ${r.status} ${Array.isArray(d) ? d.length : "-"} ${Array.isArray(d) && d[0] ? d[0].q : ""}`); }
    catch (e) { say(`${g} ${q} ERR ${e}`); }
    if (!Array.isArray(d) || d.length === 0) { if (q.startsWith("X")) break; continue; }
    if (d[0].q !== q) say(`  ! 다른 쿼터가 옴 ${d[0].q}`);
    all.push(...d);
  }
  writeFileSync(`${OUT}/${g}.json`, JSON.stringify(all));
}
writeFileSync(`${OUT}/log.txt`, log.join("\n"));
