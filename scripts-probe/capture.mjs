// 조사용: api.kbl.or.kr 요청에 브라우저가 붙이는 헤더 캡처
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36" });
let shown = 0;
page.on("request", (req) => {
  const u = req.url();
  if (!/api\.kbl\.or\.kr/.test(u) || shown >= 6) return;
  shown++;
  const h = req.headers();
  const redacted = Object.fromEntries(Object.entries(h).map(([k, v]) => [k, /authorization|cookie|token|key/i.test(k) ? v.slice(0, 12) + "…(len " + v.length + ")" : v]));
  console.log("\n### REQ " + req.method() + " " + u + "\n    headers=" + JSON.stringify(redacted));
});
page.on("response", async (res) => { const u = res.url(); if (/api\.kbl\.or\.kr\/match\/list/.test(u)) console.log("    resp " + res.status() + " " + u); });
await page.goto("https://kbl.or.kr/match/schedule", { waitUntil: "networkidle", timeout: 45000 }).catch(e => console.log("goto: " + e.message));
await page.waitForTimeout(3000);
// localStorage / cookie 에 토큰이 있는지 (값은 길이만)
const ls = await page.evaluate(() => Object.keys(localStorage).map(k => k + "=" + String(localStorage.getItem(k)).length));
console.log("    localStorage=" + JSON.stringify(ls));
const cookies = await page.context().cookies();
console.log("    cookies=" + JSON.stringify(cookies.map(c => c.name + "@" + c.domain + "(len " + c.value.length + ")")));
await browser.close();
