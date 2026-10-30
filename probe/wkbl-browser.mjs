// WKBL 조사 2 — 브라우저로 주요 화면을 열어 화면이 부르는 데이터 주소(XHR·fetch)와 응답 앞부분을 기록
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
const OUT = process.env.OUT_DIR ?? "probe/wkbl/net";
mkdirSync(OUT, { recursive: true });
const PAGES = ["/", "/game/sch/schedule1.asp", "/game/result.asp", "/game/totalrecord.asp", "/player/player_list.asp", "/game/ranking.asp", "/live11/"];
const browser = await chromium.launch();
const page = await browser.newPage({ locale: "ko-KR" });
let n = 0;
page.on("response", async (res) => {
  const req = res.request();
  const t = req.resourceType();
  if (!["xhr", "fetch", "document"].includes(t)) return;
  let body = "";
  try { body = (await res.text()).slice(0, 4000); } catch {}
  const id = String(n++).padStart(3, "0");
  appendFileSync(`${OUT}/requests.tsv`, [id, t, req.method(), res.status(), res.headers()["content-type"] ?? "", req.url(), (req.postData() ?? "").slice(0, 300)].join("\t") + "\n");
  if (t !== "document") writeFileSync(`${OUT}/${id}.txt`, `${req.method()} ${req.url()}\n${req.postData() ?? ""}\n\n${body}`);
});
for (const p of PAGES) {
  try {
    await page.goto("https://www.wkbl.or.kr" + p, { waitUntil: "networkidle", timeout: 40000 });
    await page.waitForTimeout(2500);
    const shot = p.replace(/[^\w]+/g, "_") || "root";
    await page.screenshot({ path: `${OUT}/shot${shot}.png`, fullPage: false });
    const navLinks = await page.$$eval("a", (as) => as.map((a) => `${a.textContent?.trim().replace(/\s+/g, " ").slice(0, 30)}\t${a.href}`));
    writeFileSync(`${OUT}/links${shot}.txt`, [...new Set(navLinks)].join("\n"));
  } catch (e) { appendFileSync(`${OUT}/errors.txt`, `${p}\t${e}\n`); }
}
await browser.close();
