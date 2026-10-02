// 팬 숏폼 렌더 준비 — 장면별 AI 목소리 + 사진·로고 내려받기 → 렌더러 입력(props.json)
//
// 실행: npx tsx scripts/prepare-short.ts shorts/episodes/{slug}/episode.json
// 결과(전부 git 제외): shorts/public/{slug}/audio/{장면}.mp3, shorts/public/{slug}/img/*, shorts/public/{slug}/props.json
//
// 목소리 공급자 (위에서부터 쓸 수 있는 것):
//   1) Google Cloud TTS — 환경변수 GOOGLE_TTS_API_KEY 가 있으면 (공식 API, 권장). 목소리 SHORTS_TTS_VOICE(기본 ko-KR-Chirp3-HD-Puck)
//   2) edge-tts (pip install edge-tts) — 키 없이 되는 시제품용. 목소리 SHORTS_EDGE_VOICE(기본 ko-KR-HyunsuMultilingualNeural, 20대 남성 느낌, 속도 +20%)
//      Microsoft Edge 읽어주기 기능을 쓰는 비공식 도구라 언제든 막힐 수 있다 → 정식 운영은 1) 로
//   3) 없음 — 목소리 없이 대본 길이로 장면 시간을 추정 (화면 확인용)
// 사진·로고는 사이트처럼 KBL 주소에서 받는다. 실패하면 null → 화면은 팀 색 + 이니셜 대체 디자인.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { estimateSpeechSeconds } from "../lib/shorts";

const ROOT = path.resolve(import.meta.dirname, "..");
const episodePath = process.argv[2];
if (!episodePath) throw new Error("사용법: npx tsx scripts/prepare-short.ts shorts/episodes/{slug}/episode.json");
const episode = JSON.parse(fs.readFileSync(path.resolve(ROOT, episodePath), "utf8"));
const slug: string = episode.slug;
const outDir = path.join(ROOT, "shorts", "public", slug);
fs.mkdirSync(path.join(outDir, "audio"), { recursive: true });
fs.mkdirSync(path.join(outDir, "img"), { recursive: true });

/** 장면 끝에 남기는 여백(초) — 다음 장면으로 넘어가기 전 숨 */
const SCENE_TAIL = 0.25;

type Provider = "google" | "edge" | "none";
function pickProvider(): Provider {
  if (process.env.SHORTS_TTS === "none") return "none";
  if (process.env.GOOGLE_TTS_API_KEY) return "google";
  try {
    execFileSync("edge-tts", ["--help"], { stdio: "ignore" });
    return "edge";
  } catch {
    return "none";
  }
}

async function ttsGoogle(text: string, file: string) {
  const voice = process.env.SHORTS_TTS_VOICE ?? "ko-KR-Chirp3-HD-Puck";
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "ko-KR", name: voice },
      audioConfig: { audioEncoding: "MP3", speakingRate: Number(process.env.SHORTS_TTS_RATE ?? 1.1) },
    }),
  });
  if (!res.ok) throw new Error(`Google TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { audioContent: string };
  fs.writeFileSync(file, Buffer.from(json.audioContent, "base64"));
}

function ttsEdge(text: string, file: string) {
  const voice = process.env.SHORTS_EDGE_VOICE ?? "ko-KR-HyunsuMultilingualNeural";
  execFileSync("edge-tts", ["--voice", voice, "--rate", process.env.SHORTS_EDGE_RATE ?? "+20%", "--text", text, "--write-media", file], {
    stdio: "ignore",
  });
}

function durationOf(file: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim();
  const d = Number(out);
  if (!Number.isFinite(d) || d <= 0) throw new Error(`길이를 읽지 못함: ${file}`);
  return d;
}

async function download(url: string | null, file: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { Referer: "https://kbl.or.kr/" } });
    const type = res.headers.get("content-type") ?? "";
    // 사진이 없으면 200 이지만 HTML 이 온다 — 이미지가 아니면 버린다
    if (!res.ok || !type.startsWith("image/")) return null;
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    return path.relative(path.join(ROOT, "shorts", "public"), file).split(path.sep).join("/");
  } catch {
    return null;
  }
}

// 글꼴: 사이트와 같은 Pretendard (shorts/node_modules/pretendard — shorts 에서 npm ci 한 뒤)
const fontSrc = path.join(ROOT, "shorts", "node_modules", "pretendard", "dist", "web", "variable", "woff2", "PretendardVariable.woff2");
fs.mkdirSync(path.join(ROOT, "shorts", "public", "fonts"), { recursive: true });
if (fs.existsSync(fontSrc)) fs.copyFileSync(fontSrc, path.join(ROOT, "shorts", "public", "fonts", "PretendardVariable.woff2"));
else console.log("경고: Pretendard 글꼴이 없음 — shorts 폴더에서 npm ci 먼저");

const provider = pickProvider();
console.log(`목소리: ${provider}`);
const failures: string[] = [];

const scenes = [];
for (const s of episode.scenes) {
  let audio: string | null = null;
  let seconds = estimateSpeechSeconds(s.speech);
  if (provider !== "none") {
    const file = path.join(outDir, "audio", `${s.id}.mp3`);
    try {
      if (provider === "google") await ttsGoogle(s.speech, file);
      else ttsEdge(s.speech, file);
      seconds = durationOf(file);
      audio = `${slug}/audio/${s.id}.mp3`;
    } catch (e) {
      failures.push(`${s.id}: ${(e as Error).message}`);
    }
  }
  scenes.push({ ...s, audio, seconds: Math.round((seconds + SCENE_TAIL) * 100) / 100 });
  console.log(`  ${s.id} ${seconds.toFixed(2)}초${audio ? "" : " (추정)"}`);
}

const players = [];
for (const p of episode.players) {
  const photo = await download(p.photoUrl, path.join(outDir, "img", `${p.playerNo}.png`));
  const logoExt = (p.team.logoUrl ?? "").split(".").pop() || "svg";
  const logo = await download(p.team.logoUrl, path.join(outDir, "img", `team-${p.team.code}.${logoExt}`));
  if (p.photoUrl && !photo) failures.push(`사진 ${p.name}`);
  players.push({ ...p, photoFile: photo, team: { ...p.team, logoFile: logo } });
}

const props = { ...episode, players, scenes, voice: provider };
fs.writeFileSync(path.join(outDir, "props.json"), JSON.stringify(props));
// 유튜브 올릴 때 붙여 넣을 제목·설명·태그
fs.writeFileSync(
  path.join(outDir, "upload.txt"),
  [`[제목]`, episode.title, ``, `[설명]`, episode.description, ``, `[태그]`, episode.tags.join(", "), ``].join("\n"),
);
const total = scenes.reduce((a, s) => a + s.seconds, 0);
console.log(`렌더 입력: shorts/public/${slug}/props.json (약 ${total.toFixed(1)}초)`);
if (failures.length) console.log(`실패 ${failures.length}건 (대체 디자인으로 진행):\n  ${failures.join("\n  ")}`);
