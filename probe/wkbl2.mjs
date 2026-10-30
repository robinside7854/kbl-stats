// WKBL 조사 4차 — 문자중계 원본(path_live_sms)·슛 좌표(ajax_shooting) 실제 응답, 옛 시즌 범위
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
const OUT = process.env.OUT_DIR;
mkdirSync(OUT, { recursive: true });
const B = "https://www.wkbl.or.kr";
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "ko-KR" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
async function req(method, name, url, form) {
  try { const r = method === "GET" ? await ctx.request.get(B + url, { headers: { Referer: B + "/live11/realtime2.asp" } }) : await ctx.request.post(B + url, { form, headers: { Referer: B + "/player/detail.asp" } });
    const t = await r.text(); writeFileSync(`${OUT}/${String(n++).padStart(3, "0")}_${name}.txt`, `${method} ${url} ${form ? JSON.stringify(form) : ""}\n${r.status()} ${r.headers()["content-type"]} ${t.length}\n\n${t.slice(0, 150000)}`); }
  catch (e) { writeFileSync(`${OUT}/${String(n++).padStart(3, "0")}_${name}.txt`, String(e)); } finally { await sleep(900); }
}
const live = (s, g, q, seq) => `/live11/path_live_sms.asp?season_gu0=${s}&game_type0=01&game_no0=${g}&quarter_gu0=${q}&seq0=${seq}`;
for (const q of ["1", "4", "Q4", "01", "04"]) await req("GET", `live046_q${q}`, live("046", "1", q, "0"));
await req("GET", "live046_q4_seq1", live("046", "1", "4", "1"));
await req("GET", "live046_q_empty", live("046", "1", "", ""));
for (const s of ["031", "023", "013"]) await req("GET", `live${s}_q4`, live(s, "1", "4", "0"));
await req("GET", "liveplayer046", `/live11/path_live_player.asp?ckey=046|01|1|`);
await req("GET", "liveplayer013", `/live11/path_live_player.asp?ckey=013|01|1|`);
// 슛 좌표 — 김단비(095104)
await req("POST", "shooting_all", "/player/ajax/ajax_shooting.asp", { st_player_no: "095104", st_game_date: "", st_other_team: "" });
await req("POST", "shooting_046", "/player/ajax/ajax_shooting.asp", { st_player_no: "095104", st_game_date: "", st_other_team: "", season_gu: "046", st_season_gu: "046" });
await req("POST", "shoot_tab_046", "/player/ajax/ajax_detail_shoot.asp", { season_gu: "046", player_no: "095104" });
await req("POST", "shoot_tab_046b", "/player/ajax/ajax_detail_shoot.asp", { season_gu: "045", player_no: "095104", st_season_gu: "045" });
// 시즌 기록 탭 — 2점 이름 다르게
await req("POST", "season_tab_b", "/player/ajax/ajax_detail_season.asp", { season_gu: "046", player_no: "095104", pno: "095104" });
await req("GET", "detail2_kdb", "/player/detail2.asp?player_group=12&tcode=&pno=095104");
await browser.close();
