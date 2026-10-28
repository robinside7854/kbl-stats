// 문자중계·위닝샷 데이터가 공홈에 있는지 확인 (2026-10-28 조사용, main 에 넣지 않음)
// 1) 공홈 경기 기록 화면의 JS 번들에서 API 주소·관련 낱말을 찾고 2) 찾은 주소 + 짐작 주소를 실제로 불러 본다
import { writeFileSync, mkdirSync } from "node:fs";
const OUT = "probe/out";
mkdirSync(OUT, { recursive: true });
const UA = "Mozilla/5.0 (kbl-stats fan project; non-commercial)";
const site = { Accept: "application/json, text/plain, */*", Referer: "https://kbl.or.kr/", Origin: "https://kbl.or.kr", "User-Agent": UA, channel: "WEB", lang: "ko", teamcode: "XX", "X-Requested-With": "XMLHttpRequest" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const say = (s) => { console.log(s); log.push(s); };
async function text(url, headers = { "User-Agent": UA }) {
  await sleep(1200);
  try { const r = await fetch(url, { headers }); return { status: r.status, type: r.headers.get("content-type") ?? "", body: await r.text() }; }
  catch (e) { return { status: 0, type: "", body: String(e) }; }
}

// 1) 번들 모으기
const GAMES = ["S49G01N36", "S49G01N40", "S47G01N268"]; // 1점·2점·2점 차 경기
const page = await text(`https://kbl.or.kr/game/record/${GAMES[0]}`);
writeFileSync(`${OUT}/page.html`, page.body);
say(`page ${page.status} ${page.body.length}`);
const entry = [...page.body.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
const seen = new Set(); const queue = [...entry]; const js = {};
while (queue.length && seen.size < 120) {
  const p = queue.shift(); if (seen.has(p)) continue; seen.add(p);
  const r = await text(`https://kbl.or.kr${p}`);
  if (r.status !== 200) { say(`js ${r.status} ${p}`); continue; }
  js[p] = r.body;
  for (const m of r.body.matchAll(/["'`(]\.?\.?\/?(?:assets\/)?([A-Za-z0-9_\-.]+-[A-Za-z0-9_\-]{6,}\.js)["'`)]/g)) {
    const q = `/assets/${m[1]}`; if (!seen.has(q)) queue.push(q);
  }
}
say(`js files ${Object.keys(js).length}, total ${Object.values(js).reduce((s, b) => s + b.length, 0)} chars`);

// 2) 낱말 주변 글자 · 경로 문자열 · 외부 호스트
const WORDS = ["match-chart", "relay", "Relay", "RELAY", "문자", "중계", "pbp", "PlayByPlay", "playByPlay", "play-by-play", "timeline", "Timeline", "결승", "위닝", "버저", "클러치", "clutch", "lastShot", "gameLog", "livetext", "LiveText", "liveText", "quarter-score", "/match/"];
const ctx = []; const paths = new Set(); const hosts = new Set();
for (const [f, b] of Object.entries(js)) {
  for (const w of WORDS) {
    let i = -1, n = 0;
    while ((i = b.indexOf(w, i + 1)) >= 0 && n < 25) { n++; ctx.push(`[${w}] ${f} @${i}\n${b.slice(Math.max(0, i - 250), i + 250)}\n`); }
  }
  for (const m of b.matchAll(/["'`](\/(?:match|league|game|games|relay|live|record|records|player|team)[A-Za-z0-9_\-\/${}.?=&]*)["'`]/g)) paths.add(m[1]);
  for (const m of b.matchAll(/\/match\/\$\{[^}]{1,40}\}(\/[A-Za-z0-9_\-\/]+)/g)) paths.add(`/match/{gmkey}${m[1]}`);
  for (const m of b.matchAll(/"\/match\/"\s*\+\s*[\w.]+\s*\+\s*"(\/[A-Za-z0-9_\-\/]+)"/g)) paths.add(`/match/{gmkey}${m[1]}`);
  for (const m of b.matchAll(/https?:\/\/[a-z0-9.\-]+\.[a-z]{2,}/g)) hosts.add(m[0]);
}
writeFileSync(`${OUT}/context.txt`, ctx.join("\n"));
writeFileSync(`${OUT}/paths.txt`, [...paths].sort().join("\n"));
writeFileSync(`${OUT}/hosts.txt`, [...hosts].sort().join("\n"));
say(`context ${ctx.length}, paths ${paths.size}, hosts ${hosts.size}`);

// 3) 실제로 불러 보기 — 번들에서 찾은 /match/{gmkey}/… + 짐작 주소
const GUESS = ["relay", "text-relay", "textRelay", "match-relay", "relays", "live", "live-text", "livetext", "pbp", "play-by-play", "playbyplay", "timeline", "match-timeline", "log", "logs", "match-log", "game-log", "gamelog", "record", "records", "boxscore", "box-score", "match-record", "quarter", "match-quarter", "score", "scores", "events", "match-event", "highlight"];
const suffixes = new Set(GUESS.map((g) => `/${g}`));
for (const p of paths) if (p.startsWith("/match/{gmkey}")) suffixes.add(p.slice("/match/{gmkey}".length));
const results = [];
for (const s of suffixes) {
  const url = `https://api.kbl.or.kr/match/${GAMES[0]}${s}`;
  const r = await text(url, site);
  const line = `${r.status} ${r.body.length} ${url} ${r.type}`;
  say(line); results.push(line);
  if (r.status === 200 && r.body.length > 200 && !r.body.trimStart().startsWith("<")) {
    writeFileSync(`${OUT}/resp-${s.replace(/[^A-Za-z0-9]+/g, "_")}.json`, r.body);
    // 다른 경기로도 한 번
    for (const g of GAMES.slice(1)) {
      const r2 = await text(`https://api.kbl.or.kr/match/${g}${s}`, site);
      say(`  ${g} ${r2.status} ${r2.body.length}`);
      if (r2.status === 200) writeFileSync(`${OUT}/resp-${s.replace(/[^A-Za-z0-9]+/g, "_")}-${g}.json`, r2.body);
    }
  }
}
// 번들에서 찾은 그 밖의 경로(gmkey 자리 없이)도 /match 상세는 같이 받아 둔다
const detail = await text(`https://api.kbl.or.kr/match/${GAMES[0]}`, site);
writeFileSync(`${OUT}/match-detail.json`, detail.body);
writeFileSync(`${OUT}/results.txt`, results.join("\n"));
writeFileSync(`${OUT}/log.txt`, log.join("\n"));
