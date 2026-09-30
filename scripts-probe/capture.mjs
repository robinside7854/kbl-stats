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
for (const u of ["https://kbl.or.kr/match/schedule", "https://kbl.or.kr/game/schedule", "https://kbl.or.kr/match/record"]) { await open(u); }
// 일정 페이지에서 지난 경기 링크 수집
const links = await page.evaluate(() => Array.from(document.querySelectorAll("a[href]")).map(a => a.getAttribute("href")).filter(h => /game|match/i.test(h) && /\d{3,}/.test(h)).slice(0, 15));
console.log("    gameLinks=" + JSON.stringify(links));
// 지난 시즌 경기 하나 직접 열어보기 (gameNo 265 = 2026-04-06 SK vs 삼성, 시즌 47)
for (const u of ["https://kbl.or.kr/match/detail?seasonCode=47&gameCode=01&gameNo=265", "https://kbl.or.kr/game/detail/47/01/265", "https://kbl.or.kr/match/record/47/01/265"]) { await open(u); }
for (const label of ["슛차트", "슛 차트", "샷차트", "기록", "박스스코어"]) {
  const t = page.locator(`button:has-text("${label}"), a:has-text("${label}"), li:has-text("${label}")`).first();
  if (await t.count()) { console.log("\n===== CLICK " + label); await t.click({ force: true }).catch(e => console.log("click: " + e.message)); await page.waitForTimeout(3000); }
}
// 후보 직접 호출
for (const u of [
  "https://kbl-api.sports2i.com/api/v1/game/shootchart/47/01/265",
  "https://kbl-api.sports2i.com/api/v1/games/47/01/265/shoot-chart",
  "https://kbl-api.sports2i.com/api/v1/players/categories/shoot/47/291248",
  "https://kbl-api.sports2i.com/api/v1/players/shootchart/47/291248",
  "https://api-stats.kbl.or.kr/api/records/player/shot?seasonCode=47&gameCode=01&playerNo=291248",
]) {
  const r = await page.request.get(u, { headers: { Accept: "application/json", Referer: "https://kbl.or.kr/", Origin: "https://kbl.or.kr" } }).catch(() => null);
  console.log("\n--- " + u + " → " + (r ? r.status() + " " + (await r.text()).slice(0, 400).replace(/\s+/g, " ") : "error"));
  await page.waitForTimeout(1500);
}
await browser.close();
