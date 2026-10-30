// WKBL 조사 3차 — 박스스코어·문자중계 원본·슛 분포·옛 시즌 범위·데이터랩(datalab.wkbl.or.kr)
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
const OUT = process.env.OUT_DIR;
mkdirSync(OUT, { recursive: true });
const B = "https://www.wkbl.or.kr";
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "ko-KR" });
const page = await ctx.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const save = (name, head, body) => writeFileSync(`${OUT}/${String(n++).padStart(3, "0")}_${name.replace(/[^\w]+/g, "_").slice(0, 70)}.txt`, head + "\n\n" + body);
async function req(method, name, url, form) {
  const full = url.startsWith("http") ? url : B + url;
  try { const r = method === "GET" ? await ctx.request.get(full, { headers: { Referer: B + "/" } }) : await ctx.request.post(full, { form, headers: { Referer: B + "/" } });
    const t = await r.text(); save(name, `${method} ${full} ${form ? JSON.stringify(form) : ""}\n${r.status()} ${r.headers()["content-type"]} ${t.length}`, t.slice(0, 150000)); return t; }
  catch (e) { save(name, `${method} ${full}`, String(e)); return ""; } finally { await sleep(800); }
}
const g = { season_gu: "046", game_type: "01", game_no: "1", ym: "" };
for (const k of [2, 3, 4, 5]) await req("POST", `game_result_${k}`, `/game/ajax/ajax_game_result_${k}.asp`, g);
// 옛 시즌 박스스코어 (013 = 2003여름 추정)
await req("POST", "game_result_2_old013", `/game/ajax/ajax_game_result_2.asp`, { season_gu: "013", game_type: "01", game_no: "1", ym: "" });
await req("POST", "game_result_2_old031", `/game/ajax/ajax_game_result_2.asp`, { season_gu: "031", game_type: "01", game_no: "1", ym: "" });
await req("GET", "inc_player_record_013", `/game/inc_player_record.asp?season_gu=013&season_name=2003&game_type=01&part=point&part_name=a&part_name_en=a`);
// 문자중계 스크립트
const js1 = await req("GET", "live_js_sms", `/live11/common/livePlayer_sms_12.js`);
const js2 = await req("GET", "live_js_player", `/live11/common/livePlayer_12.js`);
const urls = new Set([...(js1 + js2).matchAll(/["']([^"']*\.(?:xml|asp|json|txt)[^"']*)["']/g)].map((m) => m[1]));
writeFileSync(`${OUT}/live_urls.txt`, [...urls].join("\n"));
// 선수 상세 — 김단비(095104)
for (const tab of ["season", "shoot", "mass", "personal", "prize", "draft"]) await req("POST", `kdb_${tab}`, `/player/ajax/ajax_detail_${tab}.asp`, { season_gu: "046", player_no: "095104" });
await req("GET", "kdb_detail_page", `/player/detail.asp?player_group=12&tcode=&pno=095104`);
// 브라우저: 문자중계 화면이 실제로 받는 데이터 + 데이터랩
page.on("response", async (res) => {
  const rq = res.request(); const t = rq.resourceType();
  if (!["xhr", "fetch", "document", "script"].includes(t) || /google|facebook|kakao|youtube|instagram|jquery|cdn/.test(rq.url())) return;
  let body = ""; try { body = await res.text(); } catch {}
  appendFileSync(`${OUT}/net.tsv`, [t, rq.method(), res.status(), res.headers()["content-type"] ?? "", rq.url(), (rq.postData() ?? "").slice(0, 300), body.length].join("\t") + "\n");
  if (t === "xhr" || t === "fetch" || (t === "document" && /datalab|realtime/.test(rq.url()))) save("net_" + new URL(rq.url()).host + new URL(rq.url()).pathname, `${rq.method()} ${rq.url()}\n${rq.postData() ?? ""}\n${res.status()} ${res.headers()["content-type"]}`, body.slice(0, 150000));
});
try {
  await page.goto(B + "/game/sch/schedule1.asp?season_gu=046&ym=202511", { waitUntil: "networkidle", timeout: 45000 });
  await page.evaluate(() => { const f = document.getElementById("GameForm"); f.target = "_self"; f.action = "/live11/realtime2.asp";
    document.getElementById("season_gu0").value = "046"; document.getElementById("game_type0").value = "01"; document.getElementById("game_no0").value = "1"; f.submit(); });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}); await sleep(6000);
  await page.screenshot({ path: `${OUT}/shot_live.png`, fullPage: true });
} catch (e) { appendFileSync(`${OUT}/errors.txt`, `live\t${e}\n`); }
const DL = "https://datalab.wkbl.or.kr";
const seen = new Set();
async function dl(url) {
  if (seen.has(url) || seen.size > 25) return; seen.add(url);
  try { await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }); await sleep(2500);
    await page.screenshot({ path: `${OUT}/shot_dl_${seen.size}.png`, fullPage: false });
    const links = await page.$$eval("a", (as) => as.map((a) => [a.textContent?.trim().replace(/\s+/g, " ").slice(0, 30), a.href]));
    appendFileSync(`${OUT}/datalab_links.txt`, `## ${url}\n` + links.map((l) => l.join("\t")).join("\n") + "\n");
    return links;
  } catch (e) { appendFileSync(`${OUT}/errors.txt`, `${url}\t${e}\n`); }
}
const first = (await dl(DL + "/")) ?? [];
for (const [, href] of first) if (href.startsWith(DL) && !href.includes("#")) await dl(href);
await req("GET", "datalab_robots", DL + "/robots.txt");
await browser.close();
