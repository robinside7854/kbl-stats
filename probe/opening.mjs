// 개막 경기 조회 가능 여부 확인 (2026-10-03 조사용, main 에 넣지 않음)
const UA = "kbl-stats fan project (non-commercial; github.com/robinside7854/kbl-stats)";
const base = { Accept: "application/json", Referer: "https://kbl.or.kr/", Origin: "https://kbl.or.kr", "User-Agent": UA };
const site = { ...base, channel: "WEB", lang: "ko", teamcode: "XX", "X-Requested-With": "XMLHttpRequest" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, h = base) {
  await sleep(1500);
  try {
    const r = await fetch(url, { headers: h });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch {}
    console.log(`\n### ${r.status} ${url}\n${t.slice(0, 1500)}`);
    return j;
  } catch (e) { console.log(`\n### ERR ${url} ${e}`); return null; }
}
const list = await get("https://api.kbl.or.kr/match/list?fromDate=20261001&toDate=20261005&tcodeList=all", site);
const games = Array.isArray(list) ? list : [];
console.log("\nGAMES", games.length);
for (const g of games) console.log(g.gmkey, g.gameCode, g.gameDate, g.tcodeH, g.scoreH, g.tcodeA, g.scoreA, "ended=", g.isEnded);
const opener = games.filter((g) => g.gameDate?.replace(/-/g, "") === "20261003");
for (const g of opener.slice(0, 2)) {
  await get(`https://api.kbl.or.kr/match/${g.gmkey}`, site);
  const c = await get(`https://api.kbl.or.kr/match/${g.gmkey}/match-chart`, site);
  if (c?.shootLog) console.log("SHOTS players", c.shootLog.length, "points", c.shootLog.reduce((s, p) => s + (p.logs?.length ?? 0), 0));
  await get(`https://api.kbl.or.kr/league/${g.gmkey}/vs/team-statsByGmKey?teamA=${g.tcodeH}&teamB=${g.tcodeA}`, site);
}
const q = "gameCode=01&sortDataSc=SCORE&sortOrderSc=desc&listCn=200&pageNo=1&ruleCk=0&perCn=0&lastCn=0&partIfList=0&draftNo=0";
const tr = await get(`https://api-stats.kbl.or.kr/api/records/player/general/traditional?seasonCode=49&${q}`);
console.log("\nSTATS A season49 players", tr?.data?.length);
await get("https://kbl-api.sports2i.com/api/v1/season-leaders/persons?seasonCode=49&gameCode=01");
const p = tr?.data?.[0]?.playerNo;
if (p) await get(`https://kbl-api.sports2i.com/api/v1/players/categories/game/49/01/${p}`);
