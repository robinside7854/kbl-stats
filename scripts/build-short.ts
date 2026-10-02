// 팬 숏폼 에피소드 JSON 만들기 — "지난 시즌 국내 득점 TOP 5 득점 유형" (2026-10-02 첫 시제품)
//
// 실행: npx tsx scripts/build-short.ts [--season 47]
// 결과: shorts/episodes/{slug}/episode.json (커밋 대상 — 대본·숫자 기록)
// 영상 렌더러(shorts/)는 이 JSON 만 읽는다. KBL 서버를 부르지 않고 data/processed 만 읽는다(원칙 1).
// 숫자 계산은 lib/(leaders·shorts·shots) 한 곳 — 사이트와 영상의 숫자가 항상 같다(원칙 5).

import fs from "node:fs";
import path from "node:path";
import { toLeaderPlayers } from "../lib/convert";
import { filterLeaders, topLeaders } from "../lib/leaders";
import { DEFAULT_QUALIFY } from "../lib/metrics";
import { courtGeometry, courtPoints, type ShotPoint } from "../lib/shots";
import { OFFENSE_TYPES } from "../lib/glossary";
import { seasonShortLabel } from "../lib/career";
import {
  captionChunks,
  pickCallouts,
  sampleShots,
  scoringBreakdown,
  SCORING_SOURCES,
  toSpeech,
  topScorerLine,
  type ScoringSource,
} from "../lib/shorts";
import type { SeasonData } from "../lib/types";

const ROOT = path.resolve(import.meta.dirname, "..");
const PROCESSED = path.join(ROOT, "data", "processed");

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

/** "지난 시즌" = 경기를 40경기 이상 치른 선수가 있는 가장 최근 시즌 (개막 직후 새 시즌은 몇 경기뿐이라 건너뛴다) */
function latestCompleteSeason(): number {
  const seasons = readJson<{ seasonCode: number }[]>(path.join(PROCESSED, "seasons.json"));
  const withPlayers = seasons
    .map((s) => s.seasonCode)
    .filter((c) => {
      const f = path.join(PROCESSED, String(c), "players.json");
      return fs.existsSync(f) && readJson<SeasonData>(f).players.some((p) => p.games >= 40);
    });
  return Math.max(...withPlayers);
}

const seasonCode = Number(arg("season") ?? latestCompleteSeason());
const season = readJson<SeasonData>(path.join(PROCESSED, String(seasonCode), "players.json"));
const index = readJson<{ id: string; photoUrl: string | null }[]>(path.join(PROCESSED, "players-index.json"));
const photoOf = new Map(index.map((p) => [p.id, p.photoUrl]));
const shotsFile = path.join(PROCESSED, String(seasonCode), "shots.json");
const shotsBy: Record<string, ShotPoint[]> = fs.existsSync(shotsFile) ? readJson(shotsFile) : {};

const leaders = toLeaderPlayers(season, (no) => photoOf.get(no) ?? null);
const pool = filterLeaders(leaders, { origin: "domestic", teamCode: null, rule: DEFAULT_QUALIFY });
const top = topLeaders(pool, "points", "perGame", 5);
if (top.length < 5) throw new Error(`국내 득점 상위 5명을 찾지 못함 (시즌 ${seasonCode})`);

const rawOf = new Map(season.players.map((p) => [p.playerNo, p]));
const teamOf = new Map(season.teams.map((t) => [t.teamCode, t]));
const seasonLabel = seasonShortLabel(season.seasonLabel);

const breakdowns: ScoringSource[][] = top.map(({ player }) => {
  const raw = rawOf.get(player.id)!;
  const z = raw.shotZones?.zones;
  const b = scoringBreakdown({
    games: raw.games,
    points: raw.points,
    twoPm: raw.twoPm,
    tpm: raw.tpm,
    ftm: raw.ftm,
    zoneMade: z ? { rim: z.rim.m, paint: z.paint.m, mid: z.mid.m } : null,
  });
  if (!b) throw new Error(`${player.nameKo}: 슛 차트 구역이 없어 득점 출처를 나눌 수 없음`);
  const sum = b.reduce((a, s) => a + s.points, 0);
  if (sum !== raw.points) throw new Error(`${player.nameKo}: 출처 합 ${sum} ≠ 공식 득점 ${raw.points}`);
  return b;
});
const callouts = pickCallouts(breakdowns);

const players = top.map(({ player, value, rank }, i) => {
  const raw = rawOf.get(player.id)!;
  const team = teamOf.get(player.teamCode);
  const offense = raw.shotZones?.offenseType ?? null;
  const pts = courtPoints(shotsBy[player.id] ?? []);
  const line = topScorerLine({
    rank,
    name: player.nameKo,
    ppg: Math.round(value * 10) / 10,
    sources: breakdowns[i],
    callout: callouts[i],
    tpPct: raw.tpPct,
    ftPct: raw.ftPct,
  });
  return {
    rank,
    playerNo: player.id,
    name: player.nameKo,
    nameEn: player.nameEn,
    position: raw.positionLabel ?? null,
    backNumber: raw.backNumber ?? null,
    team: {
      code: player.teamCode,
      name: team?.shortNameKo ?? player.teamShort,
      color: team?.color?.primary ?? "#6B7280",
      secondary: team?.color?.secondary ?? "#9CA3AF",
      logoUrl: team?.logoUrl ?? null,
    },
    photoUrl: player.photoUrl,
    ppg: Math.round(value * 10) / 10,
    games: raw.games,
    mpg: Math.round((raw.minutes / raw.games) * 10) / 10,
    tpPct: Math.round(raw.tpPct * 10) / 10,
    ftPct: Math.round(raw.ftPct * 10) / 10,
    sources: breakdowns[i],
    callout: callouts[i],
    offenseType: offense ? (OFFENSE_TYPES.find((t) => t.key === offense)?.label ?? null) : null,
    // 슛 점: 실패 먼저·성공 나중 (성공이 위에 그려지게), 각 최대 260개
    shots: { missed: sampleShots(pts.missed, 260), made: sampleShots(pts.made, 260), total: pts.missed.length + pts.made.length },
    line,
  };
});

// 장면 순서: 표지 → 5위부터 1위 (긴장감) → 다섯 명 한눈에 → 질문
const countdown = [...players].sort((a, b) => b.rank - a.rank);
const leader = players[0];
const threeTop = [...players].sort((a, b) => share(b, "three") - share(a, "three"))[0];
const paintTop = [...players].sort((a, b) => share(b, "paint") - share(a, "paint"))[0];
function share(p: (typeof players)[number], k: string) {
  return p.sources.find((s) => s.key === k)!.share;
}

const scenes = [
  {
    id: "cover",
    kind: "cover" as const,
    caption: `${seasonLabel} 국내 득점 TOP 5. 점수 내는 방법이 전부 달랐어요.`,
  },
  ...countdown.map((p) => ({ id: `rank-${p.rank}`, kind: "player" as const, playerNo: p.playerNo, caption: p.line.caption })),
  {
    id: "compare",
    kind: "compare" as const,
    caption: `3점은 ${threeTop.name}, 페인트는 ${paintTop.name}, 자유투는 ${leader.name}.`,
  },
  {
    id: "outro",
    kind: "outro" as const,
    caption: "여러분 팀 에이스는 어떤 유형? 댓글로 알려주세요.",
  },
].map((s) => ({ ...s, speech: toSpeech(s.caption), chunks: captionChunks(s.caption) }));

const slug = `${seasonCode}-domestic-top5-scoring`;
const court = courtGeometry();
const episode = {
  version: 1,
  slug,
  format: "top5-scoring-types",
  createdAt: new Date().toISOString(),
  seasonCode,
  seasonLabel,
  title: `${seasonLabel} 국내 득점 TOP 5, 점수 내는 방법은 전부 달랐다 #KBL #농구 #shorts`,
  description: [
    `${seasonLabel} KBL 정규시즌 국내 선수 경기당 득점 1~5위의 득점 출처(페인트·미드레인지·3점·자유투)를 비교했습니다.`,
    "",
    ...players.map((p) => `${p.rank}위 ${p.name}(${p.team.name}) ${p.ppg}점 — ${p.callout.headline}`),
    "",
    "· 2점을 페인트/미드레인지로 나눈 비율은 공식 슛 차트 좌표 기준이라 공식 기록과 조금 다를 수 있습니다.",
    "· 기록: KBL 공식 홈페이지 · 사진 © KBL 및 각 구단 · 비영리 팬 채널",
    "· 더 많은 기록: https://kbl-stats-mu.vercel.app",
  ].join("\n"),
  tags: ["KBL", "농구", "프로농구", ...players.map((p) => p.name), "shorts"],
  sourceSources: SCORING_SOURCES.map((s) => ({ key: s.key, label: s.label })),
  court: { viewBox: court.viewBox, lines: court.lines, rim: court.rim },
  players,
  scenes,
};

const outDir = path.join(ROOT, "shorts", "episodes", slug);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "episode.json"), JSON.stringify(episode, null, 2) + "\n");
console.log(`에피소드 저장: shorts/episodes/${slug}/episode.json`);
for (const s of scenes) console.log(`  [${s.id}] ${s.caption}`);
