// 문자중계(text-cast) 2차 조사 — 번들 저장(동작 코드 뜻 찾기), 쿼리로 다른 쿼터 받기, 옛 시즌 있는지 (2026-10-28, main 에 넣지 않음)
import { writeFileSync, mkdirSync } from "node:fs";
const OUT = "probe/out2";
mkdirSync(OUT, { recursive: true });
const UA = "Mozilla/5.0 (kbl-stats fan project; non-commercial)";
const site = { Accept: "application/json, text/plain, */*", Referer: "https://kbl.or.kr/", Origin: "https://kbl.or.kr", "User-Agent": UA, channel: "WEB", lang: "ko", teamcode: "XX", "X-Requested-With": "XMLHttpRequest" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const say = (s) => { console.log(s); log.push(s); };
async function text(url, headers = { "User-Agent": UA }) {
  await sleep(1200);
  try { const r = await fetch(url, { headers }); return { status: r.status, body: await r.text() }; }
  catch (e) { return { status: 0, body: String(e) }; }
}
const summary = (b) => { try { const d = JSON.parse(b); if (!Array.isArray(d)) return `obj keys=${Object.keys(d).join(",")}`; const qs = {}; for (const x of d) qs[x.q] = (qs[x.q] ?? 0) + 1; return `len=${d.length} n=${d[0]?.n}..${d.at(-1)?.n} q=${JSON.stringify(qs)}`; } catch { return `not json ${b.slice(0, 80)}`; } };

// 1) 번들 통째로 (뜻 찾기는 세션에서)
const page = await text("https://kbl.or.kr/game/record/S49G01N36");
for (const m of page.body.matchAll(/src="(\/assets\/[^"]+\.js)"/g)) {
  const r = await text(`https://kbl.or.kr${m[1]}`);
  writeFileSync(`${OUT}/bundle-${m[1].split("/").pop()}`, r.body);
  // text-cast 를 부르는 곳 주변
  const b = r.body; let i = -1; const ctx = [];
  while ((i = b.indexOf("text-cast", i + 1)) >= 0) ctx.push(b.slice(Math.max(0, i - 3000), i + 3000));
  writeFileSync(`${OUT}/textcast-context-${m[1].split("/").pop()}.txt`, ctx.join("\n\n=====\n\n"));
}

// 2) 다른 쿼터 받는 법 — 쿼리 짐작
const G = "S49G01N36";
const params = ["", "?quarter=Q1", "?q=Q1", "?qt=Q1", "?quarter=1", "?qtr=1", "?period=1", "?gameQuarter=Q1", "?n=0", "?lastNo=0", "?seqNo=0", "?no=0", "?start=0", "?page=1", "?all=true", "/Q1", "/1", "/0"];
for (const p of params) {
  const r = await text(`https://api.kbl.or.kr/match/${G}/text-cast${p}`, site);
  say(`${r.status} text-cast${p} ${summary(r.body)}`);
}

// 3) 시즌별로 있는지 (정규시즌 1번 경기 + 플레이오프 하나)
const keys = ["S47G01N1", "S45G01N100", "S41G01N100", "S35G01N100", "S25G01N100", "S15G01N100", "S11G01N100", "S10G01N100", "S5G01N100", "S1G01N10", "S47G04N1", "S45G04N7"];
for (const k of keys) {
  const r = await text(`https://api.kbl.or.kr/match/${k}/text-cast`, site);
  say(`${k} ${r.status} ${summary(r.body)}`);
  if (r.status === 200) writeFileSync(`${OUT}/tc-${k}.json`, r.body);
}
writeFileSync(`${OUT}/log.txt`, log.join("\n"));
