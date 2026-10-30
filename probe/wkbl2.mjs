// WKBL 조사 2차 — 기록 주소에 실제 값을 넣어 응답을 저장하고, 경기 결과·문자중계·선수 상세 화면이 부르는 주소를 브라우저로 잡는다
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
async function get(name, path) {
  try { const r = await ctx.request.get(B + path, { headers: { Referer: B + "/" } }); const t = await r.text(); save(name, `GET ${path}\n${r.status()} ${r.headers()["content-type"]} ${t.length}`, t.slice(0, 120000)); }
  catch (e) { save(name, `GET ${path}`, String(e)); }
  await sleep(800);
}
async function post(name, path, form) {
  try { const r = await ctx.request.post(B + path, { form, headers: { Referer: B + "/" } }); const t = await r.text(); save(name, `POST ${path} ${JSON.stringify(form)}\n${r.status()} ${r.headers()["content-type"]} ${t.length}`, t.slice(0, 120000)); }
  catch (e) { save(name, `POST ${path}`, String(e)); }
  await sleep(800);
}
// 1) 선수 기록 (부문별) — 시즌 046 = 2025-26 으로 가정
for (const part of ["point", "rebound", "assist"]) await get(`player_record_${part}`, `/game/ajax/ajax_player_record.asp?season_gu=046&part=${part}`);
await get("inc_player_record", `/game/inc_player_record.asp?season_gu=046&season_name=2025-2026&game_type=01&part=point&part_name=%EB%93%9D%EC%A0%90&part_name_en=Points`);
await get("player_record_page_046", `/game/player_record.asp?season_gu=046`);
// 2) 선수 상세 탭 (095937 = 현역 첫 선수, 002008 = 은퇴 선수)
for (const tab of ["season", "sum", "shoot", "mass", "personal", "prize", "draft", "game", "record"]) await post(`detail_${tab}`, `/player/ajax/ajax_detail_${tab}.asp`, { season_gu: "046", player_no: "095937" });
await post("detail_personal_2_old", `/player/ajax/ajax_detail_personal_2.asp`, { season_gu: "046", player_no: "002008" });
await post("detail_season_old", `/player/ajax/ajax_detail_season.asp`, { season_gu: "046", player_no: "002008" });
// 3) 팀 순위·팀 기록·리포트·MVP
await get("team_rank", `/game/ajax/ajax_team_rank.asp?season_gu=046&gun=1`);
await post("team_total_record", `/game/ajax/ajax_team_total_record.asp`, { season_gu: "046", team_code: "05" });
await post("report", `/game/ajax/ajax_report.asp`, { season_gu: "046" });
await post("today_mvp", `/game/ajax/ajax_today_mvp.asp`, { season_gu: "046" });
// 4) 일정 (2025-11) — 경기 번호 찾기
await get("schedule_202511", `/game/sch/inc_list_1_new.asp?season_gu=046&ym=202511&viewType=1&gun=1`);
await get("schedule_202602", `/game/sch/inc_list_1_new.asp?season_gu=046&ym=202602&viewType=1&gun=1`);
// 5) 문자중계·경기 팝업 (폼 POST)
await post("live_realtime2", `/live11/realtime2.asp`, { season_gu0: "046", game_type0: "01", game_no0: "1", season_gu: "046", game_type: "01", game_no: "1" });
await post("pop_todaygame", `/game/pop_todaygame.asp`, { season_gu0: "046", game_type0: "01", game_no0: "1", season_gu: "046", game_type: "01", game_no: "1" });
// 6) 브라우저로 잡기
page.on("response", async (res) => {
  const req = res.request(); const t = req.resourceType();
  if (!["xhr", "fetch", "document"].includes(t) || /google|facebook|kakao|youtube|instagram/.test(req.url())) return;
  let body = ""; try { body = await res.text(); } catch {}
  appendFileSync(`${OUT}/net.tsv`, [t, req.method(), res.status(), res.headers()["content-type"] ?? "", req.url(), (req.postData() ?? "").slice(0, 300), body.length].join("\t") + "\n");
  if (t !== "document" || /realtime|result|detail/.test(req.url())) save("net_" + new URL(req.url()).pathname, `${req.method()} ${req.url()}\n${req.postData() ?? ""}\n${res.status()}`, body.slice(0, 120000));
});
async function visit(path, after) {
  try { await page.goto(B + path, { waitUntil: "networkidle", timeout: 45000 }); await sleep(2000); if (after) await after(); await page.screenshot({ path: `${OUT}/shot_${path.replace(/[^\w]+/g, "_").slice(0, 60)}.png`, fullPage: true }); }
  catch (e) { appendFileSync(`${OUT}/errors.txt`, `${path}\t${e}\n`); }
}
await visit("/game/result.asp?season_gu=046&gun=1&game_type=01&game_no=1");
await visit("/game/player_record.asp");
await visit("/player/detail.asp?player_group=12&tcode=&pno=095937", async () => {
  for (const sel of await page.$$("[onclick*='tab'], .tab a, ul.tab li a")) { try { await sel.click({ timeout: 2000 }); await sleep(1500); } catch {} }
});
// 문자중계: 일정 화면 폼을 직접 채워 제출
await visit("/game/sch/schedule1.asp?season_gu=046&ym=202602", async () => {
  await page.evaluate(() => { const f = document.getElementById("GameForm"); if (!f) return; f.target = "_self"; f.action = "/live11/realtime2.asp";
    document.getElementById("season_gu0").value = "046"; document.getElementById("game_type0").value = "01"; document.getElementById("game_no0").value = "100"; f.submit(); });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}); await sleep(4000);
});
await browser.close();
