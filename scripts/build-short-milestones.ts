// 팬 숏폼 B — "개막전에 깨질 수도 있는 기록" 에피소드 (2026-10-02, 26-27 개막 하루 전)
//
// 실행: npx tsx scripts/build-short-milestones.ts
// 결과: shorts/episodes/opening-milestones/episode.json · upload.txt (렌더러 shorts/src/Milestones.tsx)
// 현역 판정: data/raw/players/active.json(현역 등록 명단, Actions 에서 fetch-active 가 받음)이 있으면 그것,
//            없으면 지난 시즌에 뛴 선수 중 선수 마스터에 팀이 있는 선수(은퇴가 섞일 수 있어 경고).
// 지금 팀: 선수 마스터 팀 코드(이적 반영). 지난 시즌 팀과 다르면 "이번에 ○○로 옮긴".

import { milestoneLine, milestoneName, pickMilestones, type CareerLine } from "../lib/shorts-formats";
import { seasonShortLabel } from "../lib/career";
import { FOOTER, loadActive, loadMaster, loadSeasons, photoDirectory, teamDirectory, withSpeech, writeEpisode } from "./short-common";

const seasons = loadSeasons();
const latest = seasons[seasons.length - 1];
const teams = teamDirectory(seasons);
const photos = photoDirectory();
const master = new Map(loadMaster().map((m) => [String(m.playerNo), m]));

// 정규리그 통산 합계 (processed 시즌 파일 = 정규시즌)
const totals = new Map<string, CareerLine>();
for (const s of seasons) {
  for (const p of s.players) {
    if (p.games <= 0) continue;
    const t = totals.get(p.playerNo) ?? { playerNo: p.playerNo, name: p.nameKo, games: 0, points: 0, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0, wins: 0 };
    t.games += p.games;
    t.points += p.points;
    t.reb += p.reb;
    t.ast += p.ast;
    t.stl += p.stl;
    t.blk += p.blk;
    t.tpm += p.tpm;
    t.wins += p.wins ?? 0;
    t.name = p.nameKo;
    totals.set(p.playerNo, t);
  }
}

const activeRows = loadActive();
let active: Set<string>;
if (activeRows) {
  active = new Set(activeRows.map((r) => String(r.playerNo)));
  console.log(`현역: 현역 등록 명단 ${active.size}명`);
} else {
  active = new Set(latest.players.filter((p) => p.games > 0 && master.get(p.playerNo)?.teamCode).map((p) => p.playerNo));
  console.warn(`경고: 현역 등록 명단(data/raw/players/active.json)이 없어 ${seasonShortLabel(latest.seasonLabel)} 출전 선수 ${active.size}명으로 대신함 — 은퇴 선수가 섞일 수 있음`);
}

const picks = pickMilestones([...totals.values()], active);
if (picks.length < 3) throw new Error(`이정표 후보가 ${picks.length}명뿐`);
const lastTeamOf = new Map(latest.players.map((p) => [p.playerNo, p.teamCode]));
const activeTeam = new Map((activeRows ?? []).map((r) => [String(r.playerNo), r.teamCode]));

const players = picks.map((m, i) => {
  const code = activeTeam.get(m.playerNo) || master.get(m.playerNo)?.teamCode || lastTeamOf.get(m.playerNo) || "";
  const team = teams.get(code) ?? { code, name: code, color: "#6B7280", secondary: "#9CA3AF", logoUrl: null };
  const prevCode = lastTeamOf.get(m.playerNo);
  const movedFrom = prevCode && prevCode !== code ? (teams.get(prevCode)?.name ?? null) : null;
  const line = milestoneLine({ pick: m, team: team.name, movedFrom, index: i, last: i === picks.length - 1 });
  return {
    ...m,
    perGame: Math.round(m.perGame * 10) / 10,
    nameEn: "",
    team,
    movedFrom,
    photoUrl: photos.get(m.playerNo) ?? null,
    goal: milestoneName(m),
    line,
  };
});

const nextLabel = (() => {
  const [a, b] = seasonShortLabel(latest.seasonLabel).split("-").map(Number);
  return Number.isFinite(b) ? `${String(a + 1).padStart(2, "0")}-${String(b + 1).padStart(2, "0")}` : "새 시즌";
})();

const scenes = [
  { id: "cover", kind: "cover" as const, caption: "내일 드디어 개막! 근데 개막하자마자 깨질 수도 있는 기록들이 있어. 하나씩 보자." },
  ...players.map((p, i) => ({ id: `m-${i}`, kind: "milestone" as const, playerNo: p.playerNo, caption: p.line })),
  { id: "outro", kind: "outro" as const, caption: "개막전에서 몇 개나 터질까? 네 예상 댓글로 남겨 줘!" },
].map(withSpeech);

const slug = "opening-milestones";
const lines = players.map((p) => `${p.name}(${p.team.name}) ${p.goal}까지 ${p.remaining}${p.unit === "점" ? "점" : p.unit === "승" ? "승" : "개"}`);
writeEpisode(slug, {
  version: 1,
  slug,
  format: "milestones",
  composition: "Milestones",
  createdAt: new Date().toISOString(),
  seasonLabel: nextLabel,
  players,
  scenes,
  title: `개막전에 깨질 수도 있는 기록 ${players.length}개 | ${nextLabel} KBL 개막 #KBL #농구 #shorts`,
  description: [
    `${nextLabel} KBL 개막을 앞두고, 정규리그 통산 기록 달성이 가장 가까운 현역 선수 ${players.length}명입니다.`,
    "",
    ...players.map((p) => `· ${p.name}(${p.team.name}) ${p.goal}까지 ${p.remaining}${p.unit === "승" ? "승" : p.unit} 남음 — 경기당 ${p.perGame}${p.unit === "승" ? "승" : p.unit}${p.nth <= 10 ? `, 달성 시 KBL 역대 ${p.nth}번째` : ""}`),
    "",
    "개막전에서 몇 개나 나올지 댓글로 예상해 주세요!",
    "",
    "· 정규리그 통산 기준(플레이오프 제외), 지난 시즌까지 합계",
    ...FOOTER.map((f) => `· ${f}`),
  ].join("\n"),
  casual: {
    title: `개막하자마자 깨질 수도 있는 기록 ㄷㄷ (${nextLabel} KBL) #KBL #농구 #shorts`,
    description: [
      "내일 개막인데 이 기록들 바로 나올 수도 있음",
      "",
      ...lines.map((l, i) => `${i + 1}. ${l}`),
      "",
      "개막전에서 몇 개 나올지 댓글로 찍어 줘",
      "",
      ...FOOTER,
    ].join("\n"),
  },
  tags: ["KBL", "농구", "프로농구", "KBL개막", "개막전", "대기록", ...players.map((p) => p.name), ...new Set(players.map((p) => p.team.name)), "shorts"],
});
for (const s of scenes) console.log(`  [${s.id}] ${s.caption}`);
