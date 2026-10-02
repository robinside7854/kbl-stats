// 팬 숏폼 C — "슛 차트만 보고 누군지 맞혀 봐" 퀴즈 에피소드 (2026-10-02)
//
// 실행: npx tsx scripts/build-short-quiz.ts [--season 47]
// 결과: shorts/episodes/{시즌}-shotchart-quiz/episode.json · upload.txt (렌더러 shorts/src/Quiz.tsx)
// 문제: 지난 시즌 경기당 득점 상위 20명(30경기 이상) 중 lib/shorts-formats pickQuiz 규칙(골밑형·3점형·득점 1위).

import fs from "node:fs";
import path from "node:path";
import { courtPoints, courtZoneShapes, courtGeometry, isThreePx, PX_PER_M, shotZone, type ShotPoint } from "../lib/shots";
import { sampleShots } from "../lib/shorts";
import { pickQuiz, quizAnswerLine, quizQuestionLine, type QuizCandidate } from "../lib/shorts-formats";
import { seasonShortLabel } from "../lib/career";
import { FOOTER, loadSeasons, PROCESSED, photoDirectory, readJson, teamDirectory, withSpeech, writeEpisode } from "./short-common";

const seasons = loadSeasons();
const argIdx = process.argv.indexOf("--season");
const season =
  argIdx >= 0 ? seasons.find((s) => s.seasonCode === Number(process.argv[argIdx + 1]))! : [...seasons].reverse().find((s) => s.players.some((p) => p.games >= 40))!;
const label = seasonShortLabel(season.seasonLabel);
const teams = teamDirectory([season]);
const photos = photoDirectory();
const shotsFile = path.join(PROCESSED, String(season.seasonCode), "shots.json");
const shotsBy: Record<string, ShotPoint[]> = fs.existsSync(shotsFile) ? readJson(shotsFile) : {};

const top = season.players
  .filter((p) => p.games >= 30 && p.shotZones)
  .sort((a, b) => b.points / b.games - a.points / a.games)
  .slice(0, 20);
const cands: QuizCandidate[] = top.map((p) => {
  const z = p.shotZones!.zones;
  const total = Object.values(z).reduce((a, v) => a + v.a, 0) || 1;
  const pct = (n: number) => Math.round((n / total) * 1000) / 10;
  return {
    playerNo: p.playerNo,
    name: p.nameKo,
    team: teams.get(p.teamCode)?.name ?? p.teamCode,
    position: p.positionLabel ?? null,
    ppg: Math.round((p.points / p.games) * 10) / 10,
    inside: pct(z.rim.a + z.paint.a),
    mid: pct(z.mid.a),
    three: pct(z.corner3.a + z.arc3.a),
    shots: total,
  };
});
const quiz = pickQuiz(cands);
if (quiz.length < 3) throw new Error(`퀴즈 문제가 ${quiz.length}개뿐`);

// 슛 점: [x, y, 성공, 출처 0 안쪽·1 미드·2 3점] — Quiz 화면은 출처마다 색을 다르게
const SOURCE_INDEX = { rim: 0, paint: 0, mid: 1, corner3: 2, arc3: 2 } as const;
const tag = (pt: ShotPoint): [number, number, number, number] => {
  const three = isThreePx(Math.abs(pt[0]) * PX_PER_M, Math.abs(pt[1]) * PX_PER_M);
  return [pt[0], pt[1], pt[2], SOURCE_INDEX[shotZone({ x: pt[0], y: pt[1], three })]];
};

const players = quiz.map((q) => {
  const pts = courtPoints(shotsBy[q.playerNo] ?? []);
  const p = season.players.find((x) => x.playerNo === q.playerNo)!;
  return {
    ...q,
    nameEn: p.nameEn ?? "",
    team: teams.get(p.teamCode)!,
    teamName: q.team,
    photoUrl: photos.get(q.playerNo) ?? null,
    shots: { missed: sampleShots(pts.missed, 320).map(tag), made: sampleShots(pts.made, 320).map(tag), total: q.shots },
  };
});

const scenes = [
  { id: "cover", kind: "cover" as const, caption: `${label} 슛 차트만 보고 누군지 맞혀 봐. 세 문제, 다 맞히면 진짜 찐팬.` },
  ...quiz.flatMap((q, i) => [
    { id: `q-${i}`, kind: "question" as const, playerNo: q.playerNo, caption: quizQuestionLine(q, i) },
    { id: `a-${i}`, kind: "answer" as const, playerNo: q.playerNo, caption: quizAnswerLine(q) },
  ]),
  { id: "outro", kind: "outro" as const, caption: "몇 개 맞혔어? 댓글로 점수 남겨 줘!" },
].map(withSpeech);

const court = courtGeometry();
const slug = `${season.seasonCode}-shotchart-quiz`;
writeEpisode(slug, {
  version: 1,
  slug,
  format: "quiz",
  composition: "Quiz",
  createdAt: new Date().toISOString(),
  seasonCode: season.seasonCode,
  seasonLabel: label,
  court: { viewBox: court.viewBox, lines: court.lines, rim: court.rim, zones: courtZoneShapes() },
  players,
  scenes,
  title: `슛 차트만 보고 KBL 선수 맞히기 (${label} 시즌) #KBL #농구 #shorts`,
  description: [
    `${label} KBL 정규시즌 공식 슛 차트로 만든 퀴즈입니다. 점만 보고 누구인지 맞혀 보세요.`,
    "",
    ...players.map((q, i) => `Q${i + 1}. ${q.kind === "inside" ? `골밑 ${Math.round(q.inside)}%·3점 ${Math.round(q.three)}%` : q.kind === "three" ? `3점 비중 ${Math.round(q.three)}%` : `경기당 ${q.ppg}점(득점 1위)`} → 정답은 영상에서`),
    "",
    "몇 개 맞혔는지 댓글로 남겨 주세요!",
    "",
    "· 슛 위치는 KBL 공식 슛 차트 좌표 기준",
    ...FOOTER.map((f) => `· ${f}`),
  ].join("\n"),
  casual: {
    title: `이 슛 차트 누구게? 3문제 다 맞히면 찐팬 (${label} KBL) #KBL #농구 #shorts`,
    description: ["점만 보고 맞혀 봐. 정답은 영상 끝까지 보면 나옴", "", "몇 개 맞혔어? 댓글로 점수 ㄱㄱ", "", ...FOOTER].join("\n"),
  },
  tags: ["KBL", "농구", "프로농구", "농구퀴즈", "슛차트", ...players.map((q) => q.name), "shorts"],
});
for (const s of scenes) console.log(`  [${s.id}] ${s.caption}`);
