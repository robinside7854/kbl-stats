// 팬 숏폼 D — "순위표가 뒤집혔다" 에피소드 (2026-10-16 사용자: "삼성과 LG 를 합쳐서 만들자, 전광판 디자인으로")
//
// 실행: npx tsx scripts/build-short-flip.ts            (팀 자동: 작년 순위보다 가장 많이 오른 팀 · 가장 많이 떨어진 팀)
//       npx tsx scripts/build-short-flip.ts 35 50      (오른 팀 코드, 떨어진 팀 코드를 직접)
// 결과: shorts/episodes/{시즌}-flip-{오른팀}-{떨어진팀}/episode.json · upload.txt (렌더러 shorts/src/Flip.tsx)
// 재료: 최신 시즌·직전 시즌 data/processed/{시즌}/players.json(정규시즌 합계)·games.json(경기 결과·박스스코어). 대사 규칙은 lib/shorts-formats flipLines.

import fs from "node:fs";
import path from "node:path";
import { flipLines, type FlipPlayerLine, type FlipTeamLine } from "../lib/shorts-formats";
import { computeStandings, winnerSide } from "../lib/games";
import { seasonShortLabel } from "../lib/career";
import type { Player, SeasonData, SeasonGame } from "../lib/types";
import { FOOTER, PROCESSED, loadSeasons, photoDirectory, readJson, teamDirectory, withSpeech, writeEpisode } from "./short-common";

const seasons = loadSeasons();
const now = seasons[seasons.length - 1];
const prev = seasons[seasons.length - 2];
const gamesOf = (s: SeasonData) => {
  const f = path.join(PROCESSED, String(s.seasonCode), "games.json");
  return fs.existsSync(f) ? readJson<{ games: SeasonGame[] }>(f).games.filter((g) => g.ended) : [];
};
const nowGames = gamesOf(now);
const nowTable = computeStandings(nowGames);
const prevTable = computeStandings(gamesOf(prev));
if (nowTable.length < 2 || prevTable.length < 2) throw new Error("순위를 만들 경기 결과가 없음");

const teams = teamDirectory(seasons);
const photos = photoDirectory();

// 팀 고르기
const prevRank = new Map(prevTable.map((r) => [r.teamCode, r]));
const moves = nowTable.filter((r) => prevRank.has(r.teamCode)).map((r) => ({ r, d: prevRank.get(r.teamCode)!.rank - r.rank }));
const [argUp, argDown] = process.argv.slice(2);
const upRow = argUp ? nowTable.find((r) => r.teamCode === argUp) : [...moves].sort((a, b) => b.d - a.d)[0]?.r;
const downRow = argDown ? nowTable.find((r) => r.teamCode === argDown) : [...moves].sort((a, b) => a.d - b.d)[0]?.r;
if (!upRow || !downRow) throw new Error("팀을 찾지 못함");

const teamLine = (code: string): FlipTeamLine & { results: ("W" | "L")[] } => {
  const r = nowTable.find((x) => x.teamCode === code)!;
  const p = prevRank.get(code)!;
  const mine = nowGames.filter((g) => g.home.teamCode === code || g.away.teamCode === code).sort((a, b) => a.date.localeCompare(b.date));
  const first = mine[0];
  const firstMargin = first ? (first.home.teamCode === code ? 1 : -1) * (first.home.score! - first.away.score!) : null;
  return {
    name: teams.get(code)?.name ?? r.name,
    prevRank: p.rank, prevW: p.wins, prevL: p.losses,
    nowRank: r.rank, nowTied: nowTable.filter((x) => x.rank === r.rank).length > 1, nowW: r.wins, nowL: r.losses,
    firstMargin,
    results: mine.map((g) => (winnerSide(g) === (g.home.teamCode === code ? "home" : "away") ? "W" : "L")),
  };
};
const up = teamLine(upRow.teamCode);
const down = teamLine(downRow.teamCode);

// 선수 고르기 — 올해 3경기 이상, 작년 20경기 이상 (작은 표본으로 "확 올랐다"가 되지 않게 — 우리 규칙)
const NOW_MIN = 3, PREV_MIN = 20;
const prevById = new Map(prev.players.filter((p) => p.games >= PREV_MIN).map((p) => [p.playerNo, p]));
const ppg = (p: Player) => p.points / p.games;
const pairs = now.players
  .filter((p) => p.games >= NOW_MIN && prevById.has(p.playerNo))
  .map((p) => ({ p, q: prevById.get(p.playerNo)!, d: ppg(p) - ppg(prevById.get(p.playerNo)!) }));
const riseOrder = [...pairs].sort((a, b) => b.d - a.d).map((x) => x.p.playerNo);
const ofTeam = (code: string) => pairs.filter((x) => x.p.teamCode === code);
const upStarPair = [...ofTeam(upRow.teamCode)].sort((a, b) => b.d - a.d)[0];
const slumpPair = [...ofTeam(downRow.teamCode)].sort((a, b) => a.d - b.d)[0];
const brightPair = [...ofTeam(downRow.teamCode)].sort((a, b) => b.d - a.d)[0];
if (!upStarPair || !slumpPair) throw new Error("선수 비교 대상이 없음");
const r1 = (v: number) => Math.round(v * 10) / 10;
const playerLine = ({ p, q }: { p: Player; q: Player }): FlipPlayerLine => ({
  name: p.nameKo,
  prevPpg: r1(ppg(q)), nowPpg: r1(ppg(p)),
  prevMpg: r1(q.minutes / q.games), nowMpg: r1(p.minutes / p.games),
  prevTs: q.tsPct ? r1(q.tsPct) : null, nowTs: p.tsPct ? r1(p.tsPct) : null,
  riseRank: riseOrder.indexOf(p.playerNo) + 1 || null,
});
const bright = brightPair && brightPair.d >= 3 ? brightPair : null;

// 맞대결 — 올 시즌 두 팀 경기 중 마지막
const meetings = nowGames
  .filter((g) => [g.home.teamCode, g.away.teamCode].sort().join() === [upRow.teamCode, downRow.teamCode].sort().join())
  .sort((a, b) => a.date.localeCompare(b.date));
const last = meetings[meetings.length - 1];
let game = null as null | { meeting: number; upScore: number; downScore: number; star: { name: string; pts: number; up: boolean; playerNo: string; fg: string } ; date: string };
if (last) {
  const upHome = last.home.teamCode === upRow.teamCode;
  const rows = [...(last.box?.home ?? []).map((b) => ({ b, home: true })), ...(last.box?.away ?? []).map((b) => ({ b, home: false }))];
  const top = rows.sort((a, b) => b.b.pts - a.b.pts)[0];
  if (top) {
    game = {
      meeting: meetings.length,
      date: last.date,
      upScore: (upHome ? last.home.score : last.away.score)!,
      downScore: (upHome ? last.away.score : last.home.score)!,
      star: { name: top.b.nameKo, pts: top.b.pts, up: top.home === upHome, playerNo: top.b.id, fg: `${top.b.fgm}/${top.b.fga}` },
    };
  }
}

const lines = flipLines({
  teamCount: prevTable.length,
  up, down,
  game: game && { meeting: game.meeting, upScore: game.upScore, downScore: game.downScore, star: game.star },
  upStar: playerLine(upStarPair),
  downSlump: playerLine(slumpPair),
  downBright: bright ? playerLine(bright) : null,
});

const teamInfo = (code: string) => teams.get(code) ?? { code, name: code, color: "#6B7280", secondary: "#9CA3AF", logoUrl: null };
const roleOf = (role: string, pair: { p: Player; q: Player }) => ({
  role,
  playerNo: pair.p.playerNo,
  name: pair.p.nameKo,
  nameEn: "",
  team: teamInfo(pair.p.teamCode),
  photoUrl: photos.get(pair.p.playerNo) ?? null,
  ...playerLine(pair),
  games: pair.p.games,
});
const players = [roleOf("upStar", upStarPair), roleOf("downSlump", slumpPair), ...(bright ? [roleOf("downBright", bright)] : [])];
// 맞대결 주인공이 셋 밖이면 사진용으로 더한다
if (game && !players.some((p) => p.playerNo === game!.star.playerNo)) {
  const sp = now.players.find((p) => p.playerNo === game!.star.playerNo);
  if (sp) players.push({ role: "star", playerNo: sp.playerNo, name: sp.nameKo, nameEn: "", team: teamInfo(sp.teamCode), photoUrl: photos.get(sp.playerNo) ?? null, ...playerLine({ p: sp, q: prevById.get(sp.playerNo) ?? sp }), games: sp.games });
}

const nowLabel = seasonShortLabel(now.seasonLabel);
const prevLabel = seasonShortLabel(prev.seasonLabel);
const scenes = [
  { id: "cover", kind: "cover" as const, caption: lines.cover },
  { id: "up-team", kind: "team" as const, teamCode: upRow.teamCode, caption: lines.upTeam },
  { id: "up-star", kind: "player" as const, playerNo: upStarPair.p.playerNo, caption: lines.upStar },
  ...(lines.clash ? [{ id: "clash", kind: "clash" as const, caption: lines.clash }] : []),
  { id: "down-team", kind: "team" as const, teamCode: downRow.teamCode, caption: lines.downTeam },
  { id: "down-slump", kind: "player" as const, playerNo: slumpPair.p.playerNo, caption: lines.downSlump },
  ...(lines.downBright && bright ? [{ id: "down-bright", kind: "player" as const, playerNo: bright.p.playerNo, caption: lines.downBright }] : []),
  { id: "outro", kind: "outro" as const, caption: lines.outro },
].map(withSpeech);

const team = (t: FlipTeamLine & { results: ("W" | "L")[] }, code: string) => ({ ...t, ...teamInfo(code), name: t.name });
const asOf = nowGames.map((g) => g.date).sort().pop() ?? "";
const slug = `${now.seasonCode}-flip-${upRow.teamCode}-${downRow.teamCode}`;
const tag = (n: string) => n.replace(/\s/g, "");
writeEpisode(slug, {
  version: 1,
  slug,
  format: "flip",
  composition: "Flip",
  createdAt: new Date().toISOString(),
  seasonLabel: nowLabel,
  prevLabel,
  asOf,
  teams: { up: team(up, upRow.teamCode), down: team(down, downRow.teamCode) },
  game,
  players,
  scenes,
  title: `작년 ${up.prevRank}위 ${up.name} vs 작년 ${down.prevRank}위 ${down.name}, 순위표가 뒤집혔다 | ${nowLabel} KBL #KBL #농구 #shorts`,
  description: [
    `${nowLabel} KBL 시즌 초반(${asOf.replace(/-/g, ".")} 경기까지), 지난 시즌과 순위가 정반대로 간 두 팀입니다.`,
    "",
    `· ${up.name}: ${prevLabel} ${up.prevW}승 ${up.prevL}패(${up.prevRank}위) → ${up.nowW}승 ${up.nowL}패(${up.nowTied ? "공동 " : ""}${up.nowRank}위)`,
    `· ${down.name}: ${prevLabel} ${down.prevW}승 ${down.prevL}패(${down.prevRank}위) → ${down.nowW}승 ${down.nowL}패(${down.nowTied ? "공동 " : ""}${down.nowRank}위)`,
    ...(game ? [`· 맞대결: ${up.name} ${game.upScore} - ${game.downScore} ${down.name}, ${game.star.name} ${game.star.pts}점`] : []),
    ...players.filter((p) => p.role !== "star").map((p) => `· ${p.name}(${p.team.name}) 경기당 ${p.prevPpg}점 → ${p.nowPpg}점`),
    "",
    `${up.name} 돌풍이 계속될지, ${down.name}가 반등할지 댓글로 예상해 주세요!`,
    "",
    "· 정규리그 기준, 올 시즌은 초반 몇 경기라 표본이 작아요",
    ...FOOTER.map((f) => `· ${f}`),
  ].join("\n"),
  casual: {
    title: `작년 꼴찌가 1위, 작년 1위는…? ${up.name} vs ${down.name} 근황 #KBL #농구 #shorts`,
    description: [
      `${up.name} ${up.prevW}승 ${up.prevL}패 → ${up.nowW}승 ${up.nowL}패`,
      `${down.name} ${down.prevW}승 ${down.prevL}패 → ${down.nowW}승 ${down.nowL}패`,
      ...(game ? [`맞대결은 ${game.upScore}:${game.downScore}, ${game.star.name} 혼자 ${game.star.pts}점`] : []),
      "",
      "이 흐름 계속 갈까? 댓글로 찍어 줘",
      "",
      ...FOOTER,
    ].join("\n"),
  },
  tags: ["KBL", "농구", "프로농구", tag(up.name), tag(down.name), ...players.map((p) => tag(p.name)), "순위", "shorts"],
});
for (const s of scenes) console.log(`  [${s.id}] ${s.caption}`);
