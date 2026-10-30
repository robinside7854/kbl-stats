// WKBL 공홈 조사 1단계 — 페이지를 따라가며 주소·응답 형식을 기록한다 (세션 환경은 wkbl.or.kr 차단이라 Actions 에서 실행)
import { mkdirSync, writeFileSync } from "node:fs";
const OUT = "probe/wkbl";
mkdirSync(`${OUT}/pages`, { recursive: true });
const BASE = "https://www.wkbl.or.kr";
const SEEDS = ["/", "/robots.txt", "/main/main.asp", "/game/sch/schedule1.asp", "/game/result.asp", "/game/totalrecord.asp",
  "/game/ranking.asp", "/game/team_rank.asp", "/player/player_list.asp", "/player/player_list.asp?player_group=12",
  "/player/player_list.asp?player_group=11", "/live11/", "/etc/agreement.asp", "/etc/privacy.asp", "/history/", "/record/"];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const queue = SEEDS.map((p) => [new URL(p, BASE).href, 0]);
const seen = new Set(queue.map((q) => q[0]));
const links = new Map(); // 경로 → 횟수
const ext = new Map();
const log = [];
let saved = 0;
function decode(buf, ctype) {
  const bytes = new Uint8Array(buf);
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 3000));
  const cs = (/charset=([\w-]+)/i.exec(ctype) || /charset=["']?([\w-]+)/i.exec(head) || [])[1]?.toLowerCase();
  try { return new TextDecoder(cs && cs !== "utf8" ? cs : "utf-8").decode(bytes); } catch { return new TextDecoder("utf-8").decode(bytes); }
}
while (queue.length && log.length < 260) {
  const [url, depth] = queue.shift();
  let row = { url, depth };
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9", Referer: BASE + "/" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    const ctype = res.headers.get("content-type") || "";
    const buf = await res.arrayBuffer();
    row = { ...row, status: res.status, final: res.url, ctype, bytes: buf.byteLength };
    if (/html|javascript|json|text|xml/i.test(ctype) || /\.(asp|js|json)$/i.test(new URL(url).pathname)) {
      const text = decode(buf, ctype);
      row.title = (/<title[^>]*>([^<]*)/i.exec(text) || [])[1]?.trim().slice(0, 80);
      if (saved < 160 && buf.byteLength < 600000) {
        const name = String(log.length).padStart(3, "0") + "_" + new URL(url).pathname.replace(/[^\w]+/g, "_").slice(0, 60) + (/javascript/.test(ctype) || url.endsWith(".js") ? ".js" : /json/.test(ctype) ? ".json" : ".html");
        writeFileSync(`${OUT}/pages/${name}`, `<!-- ${url} -->\n` + text); row.file = name; saved++;
      }
      const found = new Set();
      for (const m of text.matchAll(/(?:href|src|action)\s*=\s*["']([^"'#]+)["']/gi)) found.add(m[1]);
      for (const m of text.matchAll(/["'`](\/?[\w\-./]+\.(?:asp|aspx|php|jsp|do|json|js)(?:\?[^"'`\s]*)?)["'`]/gi)) found.add(m[1]);
      for (const m of text.matchAll(/(?:url|ajax|get|post|load)\s*[:(]\s*["'`]([^"'`]+)["'`]/gi)) found.add(m[1]);
      for (const f of found) {
        if (/^(javascript:|mailto:|tel:|data:)/i.test(f)) continue;
        let abs; try { abs = new URL(f, url); } catch { continue; }
        if (!/wkbl\.or\.kr$/.test(abs.hostname)) { ext.set(abs.hostname, (ext.get(abs.hostname) || 0) + 1); continue; }
        const key = abs.pathname + (abs.search ? abs.search.replace(/=[^&]*/g, "=") : "");
        links.set(key, (links.get(key) || 0) + 1);
        if (/\.(png|jpe?g|gif|svg|css|ico|woff2?|ttf|mp4|pdf|hwp|zip)$/i.test(abs.pathname)) continue;
        abs.hash = "";
        const href = abs.href;
        // 같은 경로 + 같은 쿼리 이름이면 3개까지만
        const shape = abs.hostname + key;
        const n = [...seen].filter((s) => { try { const u = new URL(s); return u.hostname + u.pathname + (u.search ? u.search.replace(/=[^&]*/g, "=") : "") === shape; } catch { return false; } }).length;
        if (!seen.has(href) && n < 3 && depth < 3) { seen.add(href); queue.push([href, depth + 1]); }
      }
    }
  } catch (e) { row.error = String(e).slice(0, 120); }
  log.push(row);
  await sleep(700);
}
writeFileSync(`${OUT}/log.tsv`, log.map((r) => [r.status ?? "ERR", r.bytes ?? "", r.ctype ?? "", r.depth, r.url, r.final !== r.url ? r.final ?? "" : "", r.title ?? r.error ?? "", r.file ?? ""].join("\t")).join("\n") + "\n");
writeFileSync(`${OUT}/links.txt`, [...links].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${v}\t${k}`).join("\n") + "\n");
writeFileSync(`${OUT}/external.txt`, [...ext].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}\t${k}`).join("\n") + "\n");
console.log(`pages ${log.length}, saved ${saved}, links ${links.size}, ext ${ext.size}`);
