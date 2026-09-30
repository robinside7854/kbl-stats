// 조사용: 슛 차트(shoot-chart) 데이터 API 찾기 — 경기 페이지·선수 페이지에서 JSON 응답 캡처
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36" });
const seen = new Set();
page.on("response", async (res) => {
  const url = res.url(); const ct = res.headers()["content-type"] ?? "";
  if (!/json/i.test(ct) || seen.has(url) || /social\/list|teamList|search-index|banner|popup/.test(url)) return;
  seen.add(url);
  let body = ""; try { body = await res.text(); } catch { return; }
  const hit = /shoot|shot|zone|x\b|posX|coord/i.test(body);
  console.log(`\n### ${res.request().method()} ${url}\n    status=${res.status()} bytes=${body.length} shotHit=${hit}`);
  console.log("    body=" + body.slice(0, hit ? 1500 : 400).replace(/\s+/g, " "));
});
const open = async (u) => { console.log("\n===== OPEN " + u); try { await page.goto(u, { waitUntil: "networkidle", timeout: 45000 }); } catch (e) { console.log("goto: " + e.message); } await page.waitForTimeout(2500); const t = await page.evaluate(() => document.body.innerText.slice(0, 900).replace(/\s+/g, " ")); console.log("    text=" + t); };
await open("https://kbl.or.kr/match/schedule");
// 경기 행의 "기록" 버튼(button.sm.grey) 클릭
const btn = page.locator("button.sm.grey").filter({ hasText: /^기록$/ }).first();
console.log("\n===== CLICK game 기록 button count=" + await btn.count());
if (await btn.count()) { await btn.scrollIntoViewIfNeeded().catch(() => {}); await btn.click().catch(e => console.log("click: " + e.message)); await page.waitForTimeout(6000); console.log("    url=" + page.url()); const t = await page.evaluate(() => document.body.innerText.slice(0, 2000).replace(/\s+/g, " ")); console.log("    text=" + t);
  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll("button, a, li")).map(e => (e.textContent || "").trim()).filter(t => t.length > 0 && t.length < 12)); console.log("    tabs=" + JSON.stringify([...new Set(tabs)].slice(0, 60)));
  for (const label of ["슛차트", "슛 차트", "샷차트", "슈팅", "차트", "슛"]) {
    const t = page.locator(`button:has-text("${label}"), a:has-text("${label}"), li:has-text("${label}")`).first();
    const n = await t.count(); console.log("\n===== tab " + label + " count=" + n);
    if (n) { await t.click({ force: true }).catch(e => console.log("click: " + e.message)); await page.waitForTimeout(4000); console.log("    url=" + page.url()); const tx = await page.evaluate(() => document.body.innerText.slice(0, 800).replace(/\s+/g, " ")); console.log("    text=" + tx); break; }
  }
}
// 보너스: 팀 기록·라인업 기록 API
for (const u of ["https://kbl.or.kr/record/team", "https://kbl.or.kr/record/lineup"]) { await open(u); }
// 화면에 shoot-chart 요소가 있는지
const sc = await page.evaluate(() => Array.from(document.querySelectorAll("[class*='shoot'],[class*='shot'],[class*='chart']")).slice(0, 10).map(e => e.className + " | " + (e.textContent || "").trim().slice(0, 60)));
console.log("    chartEls=" + JSON.stringify(sc));
await browser.close();
