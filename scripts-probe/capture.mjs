// 조사용: KBL 공홈 선수 목록·상세 페이지를 실제 브라우저로 열어 JSON 응답을 잡는다 (요청 수 최소, 대기 1.5초)
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36" });
const seen = new Set();
page.on("response", async (res) => {
  const url = res.url();
  const ct = res.headers()["content-type"] ?? "";
  if (!/json/i.test(ct) || seen.has(url)) return;
  seen.add(url);
  let body = "";
  try { body = await res.text(); } catch { return; }
  const hit = /pcode|position|posi|height|birth|pname/i.test(body);
  console.log(`\n### ${res.request().method()} ${url}\n    status=${res.status()} bytes=${body.length} keywordHit=${hit}`);
  const req = res.request();
  const pd = req.postData(); if (pd) console.log("    postData=" + pd.slice(0, 300));
  if (hit) console.log("    body=" + body.slice(0, 1200).replace(/\s+/g, " "));
});
for (const u of ["https://kbl.or.kr/player/list", "https://kbl.or.kr/player/detail?playerNo=291248"]) {
  console.log("\n===== OPEN " + u);
  try { await page.goto(u, { waitUntil: "networkidle", timeout: 45000 }); } catch (e) { console.log("goto: " + e.message); }
  await page.waitForTimeout(3000);
  // 화면에 포지션 글자가 보이는지
  const txt = await page.evaluate(() => document.body.innerText.slice(0, 1500).replace(/\s+/g, " "));
  console.log("    visibleText=" + txt);
}
await browser.close();
