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
await open("https://kbl.or.kr/player/player");
// 첫 선수 이름 클릭 (표 행)
const cell = page.getByText("강상재", { exact: true }).first();
if (await cell.count()) { await cell.click().catch(e => console.log("click: " + e.message)); await page.waitForTimeout(4000); console.log("    url after click=" + page.url()); }
else console.log("    no cell");
const txt = await page.evaluate(() => document.body.innerText.slice(0, 2500).replace(/\s+/g, " "));
console.log("    visibleText=" + txt);
// 상세 페이지 안 탭(경기별 기록 등) 클릭 시도
for (const label of ["경기별", "경기기록", "기록", "시즌별"]) {
  const t = page.getByText(label, { exact: false }).first();
  if (await t.count()) { console.log("\n===== CLICK tab " + label); await t.click().catch(e => console.log("click: " + e.message)); await page.waitForTimeout(3500); console.log("    url=" + page.url()); }
}
// 서버 A 경기별 후보 직접 호출
for (const u of [
  "https://api-stats.kbl.or.kr/api/records/player/game/traditional?seasonCode=47&gameCode=01&playerNo=291248&listCn=200&pageNo=1",
  "https://api-stats.kbl.or.kr/api/records/player/games?seasonCode=47&gameCode=01&playerNo=291248",
  "https://api-stats.kbl.or.kr/api/records/player/detail?seasonCode=47&gameCode=01&playerNo=291248",
]) {
  const r = await page.request.get(u, { headers: { Accept: "application/json", Referer: "https://kbl.or.kr/", Origin: "https://kbl.or.kr" } }).catch(e => null);
  console.log("\n--- " + u + " → " + (r ? r.status() + " " + (await r.text()).slice(0, 400) : "error"));
  await page.waitForTimeout(1500);
}
await browser.close();
