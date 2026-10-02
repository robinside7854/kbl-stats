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
import { courtGeometry, courtPoints, courtZoneShapes, isThreePx, PX_PER_M, shotZone, type ShotPoint } from "../lib/shots";
import { OFFENSE_TYPES } from "../lib/glossary";
import { seasonShortLabel } from "../lib/career";
import {
  buildInsight,
  captionChunks,
  insightLine,
  insightSummary,
  insightCasual,
  pickCallouts,
  sampleShots,
  scoringBreakdown,
  SCORING_SOURCES,
  toSpeech,
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

// 다섯 명 중 포지션 묶음(가드·포워드·센터)이 혼자인 선수 — 대사에 "유일한 포워드" 처럼 쓴다
const GROUP_NAME: Record<string, string> = { G: "가드", F: "포워드", C: "센터" };
const groups = top.map(({ player }) => rawOf.get(player.id)!.positionGroup ?? null);
const onlyPositionOf = (i: number) => {
  const g = groups[i];
  return g && groups.filter((x) => x === g).length === 1 ? GROUP_NAME[g] ?? null : null;
};

// 인사이트 비교 집단 = 같은 국내 표본 충족 선수들 (득점 순위와 같은 집단)
const poolRaw = pool.map((l) => rawOf.get(l.id)!).filter((r) => r.games > 0);
const insightCtx = {
  five: top.map(({ player }, i) => ({ sources: breakdowns[i], callout: callouts[i], positionGroup: groups[i] })),
  leaguePpg: poolRaw.map((r) => r.points / r.games),
  leagueFta: poolRaw.map((r) => ({ id: r.playerNo, name: r.nameKo, value: r.fta / r.games })),
};

// 슛 점에 득점 출처 번호를 붙인다 (0 페인트(골밑 포함) · 1 미드 · 2 3점) — 장면이 그 구역 점만 강조
const SOURCE_INDEX = { rim: 0, paint: 0, mid: 1, corner3: 2, arc3: 2 } as const;
const tagShot = (pt: ShotPoint): [number, number, number, number] => {
  const three = isThreePx(Math.abs(pt[0]) * PX_PER_M, Math.abs(pt[1]) * PX_PER_M);
  return [pt[0], pt[1], pt[2], SOURCE_INDEX[shotZone({ x: pt[0], y: pt[1], three })]];
};

const players = top.map(({ player, value, rank }, i) => {
  const raw = rawOf.get(player.id)!;
  const team = teamOf.get(player.teamCode);
  const offense = raw.shotZones?.offenseType ?? null;
  const pts = courtPoints(shotsBy[player.id] ?? []);
  const insight = buildInsight(i, insightCtx, { id: player.id, ftm: raw.ftm, games: raw.games });
  const line = insightLine({
    rank,
    name: player.nameKo,
    ppg: Math.round(value * 10) / 10,
    sources: breakdowns[i],
    callout: callouts[i],
    tpPct: raw.tpPct,
    ftPct: raw.ftPct,
    onlyPosition: onlyPositionOf(i),
  }, insight);
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
    shots: {
      missed: sampleShots(pts.missed, 260).map(tagShot),
      made: sampleShots(pts.made, 260).map(tagShot),
      total: pts.missed.length + pts.made.length,
    },
    insight,
    line,
  };
});

// 장면 순서: 표지 → 5위부터 1위 (긴장감) → 다섯 명 한눈에 → 질문
const countdown = [...players].sort((a, b) => b.rank - a.rank);
const leader = players[0];
const threeTop = [...players].sort((a, b) => share(b, "three") - share(a, "three"))[0];
const paintTop = [...players].sort((a, b) => share(b, "paint") - share(a, "paint"))[0];
const perGame = (p: (typeof players)[number], k: string) => p.sources.find((s) => s.key === k)!.perGame;
const threePgTop = [...players].sort((a, b) => perGame(b, "three") - perGame(a, "three"))[0];
const ftTop = [...players].sort((a, b) => perGame(b, "ft") - perGame(a, "ft"))[0];
function share(p: (typeof players)[number], k: string) {
  return p.sources.find((s) => s.key === k)!.share;
}

const scenes = [
  {
    id: "cover",
    kind: "cover" as const,
    caption: `${seasonLabel} 국내 득점 TOP 5! 근데 점수 내는 법이 다 달라.`,
  },
  ...countdown.map((p) => ({ id: `rank-${p.rank}`, kind: "player" as const, playerNo: p.playerNo, caption: p.line.caption })),
  // 비교 막대 화면 위에서 질문으로 끝낸다 (30~40초 맞추려고 정리 대사·마무리 장면을 합침)
  {
    id: "compare",
    kind: "compare" as const,
    caption: "올 시즌 득점왕 누가 될 것 같아? 댓글로 찍어 줘!",
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
  title: `국내 득점 TOP 5, 점수 내는 법이 전부 달랐다 | ${seasonLabel} KBL #KBL #농구 #shorts`,
  description: [
    `${seasonLabel} KBL 국내 득점 TOP 5, 다섯 명 모두 점수 내는 방식이 달랐습니다.`,
    "",
    ...players.map((p) => `${p.rank}위 ${p.name}(${p.team.name}) 경기당 ${p.ppg}점 — ${insightSummary(p.insight, p.callout)}`),
    "",
    "올 시즌 득점왕은 누가 될까요? 댓글로 예측해 주세요!",
    "",
    "· 국내 선수 = 정규시즌 표본 기준(경기·출전 시간)을 채운 국내 선수",
    "· 2점을 페인트/미드레인지로 나눈 비율은 공식 슛 차트 좌표 기준이라 공식 기록과 조금 다를 수 있습니다.",
    "· 기록: KBL 공식 홈페이지 · 사진 © KBL 및 각 구단 · 비영리 팬 채널",
    "· 더 많은 기록: https://kbl-stats-reference.vercel.app",
  ].join("\n"),
  // 캐주얼 버전 (커뮤니티 말투) — 업로드할 때 둘 중 고른다
  casual: {
    title: `득점 TOP 5인데 점수 내는 법이 다 다름 (${seasonLabel} KBL) #KBL #농구 #shorts`,
    description: [
      `${seasonLabel} 국내 득점 TOP 5, 근데 점수 내는 방식이 전부 다름`,
      "",
      ...players.map((p) => `${p.rank}위 ${p.name}(${p.team.name}) ${p.ppg}점: ${insightCasual(p.insight, p.callout)}`),
      "",
      "올 시즌 득점왕 누구 찍음? 댓글로 ㄱㄱ",
      "",
      "기록: KBL 공식 홈페이지 · 사진 © KBL 및 각 구단 · 비영리 팬 채널",
      "더 많은 기록: https://kbl-stats-reference.vercel.app",
    ].join("\n"),
  },
  tags: ["KBL", "농구", "프로농구", "득점왕", ...players.map((p) => p.name), ...new Set(players.map((p) => p.team.name)), "shorts"],
  sourceSources: SCORING_SOURCES.map((s) => ({ key: s.key, label: s.label })),
  court: { viewBox: court.viewBox, lines: court.lines, rim: court.rim, zones: courtZoneShapes() },
  players,
  scenes,
};

const outDir = path.join(ROOT, "shorts", "episodes", slug);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "episode.json"), JSON.stringify(episode, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "upload.txt"), uploadText(episode));
console.log(`에피소드 저장: shorts/episodes/${slug}/episode.json`);
for (const s of scenes) console.log(`  [${s.id}] ${s.caption}`);

/** 업로드 글 — 정리형 + 캐주얼 (prepare-short 도 같은 글을 렌더 결과 옆에 둔다) */
export function uploadText(e: { title: string; description: string; tags: string[]; casual?: { title: string; description: string } }): string {
  const out = ["===== 정리형 =====", "[제목]", e.title, "", "[설명]", e.description, ""];
  if (e.casual) out.push("===== 캐주얼 =====", "[제목]", e.casual.title, "", "[설명]", e.casual.description, "");
  out.push("[태그 — 공통]", e.tags.join(", "), "");
  return out.join("\n");
}
