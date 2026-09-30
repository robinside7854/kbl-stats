// 조사용: 공홈 선수 상세 페이지가 쓰는 API(경기별 기록·커리어 하이) 캡처
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36" });
const seen = new Set();
page.on("response", async (res) => {
  const url = res.url(); const ct = res.headers()["content-type"] ?? "";
  if (!/json/i.test(ct) || seen.has(url) || /social\/list|teamList|search-index/.test(url)) return;
  seen.add(url);
  let body = ""; try { body = await res.text(); } catch { return; }
  console.log(`\n### ${res.request().method()} ${url}\n    status=${res.status()} bytes=${body.length}`);
  const pd = res.request().postData(); if (pd) console.log("    postData=" + pd.slice(0, 300));
  console.log("    body=" + body.slice(0, 900).replace(/\s+/g, " "));
});
const open = async (u) => { console.log("\n===== OPEN " + u); try { await page.goto(u, { waitUntil: "networkidle", timeout: 45000 }); } catch (e) { console.log("goto: " + e.message); } await page.waitForTimeout(2500); };
await open("https://kbl.or.kr/player/player/291248");
const dump = async (tag) => { const t = await page.evaluate(() => document.body.innerText.slice(0, 1800).replace(/\s+/g, " ")); console.log(`    [${tag}] text=` + t); };
await dump("open");
// 시즌 선택: 2025-2026 으로
const sel = page.locator("select").first();
if (await sel.count()) {
  const opts = await sel.locator("option").allTextContents(); console.log("    select options=" + JSON.stringify(opts.slice(0, 8)));
  const target = opts.findIndex(o => o.includes("2025")); if (target >= 0) { await sel.selectOption({ index: target }); await page.waitForTimeout(3500); await dump("season47"); }
} else console.log("    no select");
for (const label of ["한경기최다", "경기별", "부문별"]) {
  const t = page.locator(`button:has-text("${label}"), a:has-text("${label}"), li:has-text("${label}")`).first();
  console.log("\n===== CLICK tab " + label + " count=" + await t.count());
  if (await t.count()) { await t.click({ force: true }).catch(e => console.log("click: " + e.message)); await page.waitForTimeout(3500); await dump(label); }
}
// 후보 직접 호출
for (const u of [
  "https://kbl-api.sports2i.com/api/v1/players/categories/game/47/01/291248",
  "https://kbl-api.sports2i.com/api/v1/players/categories/game/47/48/291248",
  "https://kbl-api.sports2i.com/api/v1/players/categories/high/291248",
  "https://kbl-api.sports2i.com/api/v1/players/categories/max/291248",
  "https://kbl-api.sports2i.com/api/v1/players/categories/best/291248",
  "https://kbl-api.sports2i.com/api/v1/players/categories/game-high/291248",
]) {
  const r = await page.request.get(u, { headers: { Accept: "application/json", Referer: "https://kbl.or.kr/", Origin: "https://kbl.or.kr" } }).catch(() => null);
  console.log("\n--- " + u + " → " + (r ? r.status() + " " + (await r.text()).slice(0, 500).replace(/\s+/g, " ") : "error"));
  await page.waitForTimeout(1500);
}
await browser.close();
