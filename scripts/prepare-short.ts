// 팬 숏폼 렌더 준비 — AI 목소리 + 사진·로고 내려받기 → 렌더러 입력(props.json)
//
// 실행: npx tsx scripts/prepare-short.ts shorts/episodes/{slug}/episode.json
// 결과(전부 git 제외): shorts/public/{slug}/audio/{장면}.mp3, shorts/public/{slug}/img/*, shorts/public/{slug}/props.json
//
// 목소리 공급자 (위에서부터 쓸 수 있는 것):
//   0) ElevenLabs — ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID 가 있으면 (2026-10-02 사용자 선택, 권장).
//      대본 전체를 "한 번에" 읽혀(장면 사이 빈 줄) 사람처럼 호흡이 이어지게 하고, 글자별 시각(with-timestamps)으로
//      장면 길이·자막 시각을 정한다(lib/shorts sceneTimingsFromAlignment). 모델 ELEVENLABS_MODEL(기본 eleven_multilingual_v2),
//      말투 ELEVENLABS_STABILITY(기본 0.35 — 낮을수록 억양이 살아남)·ELEVENLABS_STYLE(0.3)·ELEVENLABS_SPEED(1.05)
//   1) Google Cloud TTS — 환경변수 GOOGLE_TTS_API_KEY 가 있으면 (공식 API, 권장). 목소리 SHORTS_TTS_VOICE(기본 ko-KR-Chirp3-HD-Puck)
//   2) edge-tts (pip install edge-tts) — 키 없이 되는 시제품용. 목소리 SHORTS_EDGE_VOICE(기본 ko-KR-HyunsuMultilingualNeural, 20대 남성 느낌, 속도 +20%)
//      Microsoft Edge 읽어주기 기능을 쓰는 비공식 도구라 언제든 막힐 수 있다 → 정식 운영은 1) 로
//   3) 없음 — 목소리 없이 대본 길이로 장면 시간을 추정 (화면 확인용)
// 사진·로고는 사이트처럼 KBL 주소에서 받는다. 실패하면 null → 화면은 팀 색 + 이니셜 대체 디자인.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { estimateSpeechSeconds, SCENE_JOINER, sceneTimingsFromAlignment, toSpeech, type Alignment } from "../lib/shorts";

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

type Provider = "elevenlabs" | "google" | "edge" | "none";
function pickProvider(): Provider {
  if (process.env.SHORTS_TTS === "none") return "none";
  if (process.env.ELEVENLABS_API_KEY) {
    if (!process.env.ELEVENLABS_VOICE_ID) throw new Error("ELEVENLABS_VOICE_ID 가 없습니다 — ElevenLabs 목소리 ID 를 GitHub Secrets 에 넣어 주세요");
    return "elevenlabs";
  }
  if (process.env.GOOGLE_TTS_API_KEY) return "google";
  try {
    execFileSync("edge-tts", ["--help"], { stdio: "ignore" });
    return "edge";
  } catch {
    return "none";
  }
}

async function ttsGoogle(text: string, file: string) {
  const voice = process.env.SHORTS_TTS_VOICE || "ko-KR-Chirp3-HD-Puck";
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "ko-KR", name: voice },
      audioConfig: { audioEncoding: "MP3", speakingRate: Number(process.env.SHORTS_TTS_RATE || 1.1) },
    }),
  });
  if (!res.ok) throw new Error(`Google TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { audioContent: string };
  fs.writeFileSync(file, Buffer.from(json.audioContent, "base64"));
}

/** ElevenLabs 한 번에 읽기 — 글자별 시각 포함. with-timestamps 가 안 되는 모델이면 일반 읽기 + null */
async function ttsElevenLabs(text: string, file: string): Promise<Alignment | null> {
  const voice = process.env.ELEVENLABS_VOICE_ID!;
  const body = JSON.stringify({
    text,
    model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
    voice_settings: {
      stability: Number(process.env.ELEVENLABS_STABILITY || 0.35),
      similarity_boost: Number(process.env.ELEVENLABS_SIMILARITY || 0.8),
      style: Number(process.env.ELEVENLABS_STYLE || 0.3),
      use_speaker_boost: true,
      speed: Number(process.env.ELEVENLABS_SPEED || 1.05),
    },
  });
  const headers = { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" };
  const base = `https://api.elevenlabs.io/v1/text-to-speech/${voice}`;
  const res = await fetch(`${base}/with-timestamps?output_format=mp3_44100_128`, { method: "POST", headers, body });
  if (res.ok) {
    const json = (await res.json()) as { audio_base64: string; alignment: Alignment | null };
    fs.writeFileSync(file, Buffer.from(json.audio_base64, "base64"));
    return json.alignment;
  }
  console.log(`  with-timestamps 실패 ${res.status}: ${(await res.text()).slice(0, 200)} → 일반 읽기`);
  const plain = await fetch(`${base}?output_format=mp3_44100_128`, { method: "POST", headers, body });
  if (!plain.ok) throw new Error(`ElevenLabs ${plain.status}: ${(await plain.text()).slice(0, 300)}`);
  fs.writeFileSync(file, Buffer.from(await plain.arrayBuffer()));
  return null;
}

function ttsEdge(text: string, file: string) {
  const voice = process.env.SHORTS_EDGE_VOICE || "ko-KR-HyunsuMultilingualNeural";
  execFileSync("edge-tts", ["--voice", voice, "--rate", process.env.SHORTS_EDGE_RATE || "+20%", "--text", text, "--write-media", file], {
    stdio: "ignore",
  });
}

/** 소리 파일 길이(초). ffprobe 가 없으면 Remotion 에 들어 있는 ffprobe 를 쓴다 (Actions 에서 ffmpeg 를 따로 설치하지 않으려고) */
function durationOf(file: string): number {
  const args = ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file];
  let out: string;
  try {
    out = execFileSync("ffprobe", args).toString().trim();
  } catch {
    out = execFileSync("npx", ["remotion", "ffprobe", ...args], { cwd: path.join(ROOT, "shorts") }).toString().trim();
  }
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

let scenes: Record<string, unknown>[] = [];
let narration: string | null = null;
if (provider === "elevenlabs") {
  // 전체를 한 번에 — 장면 사이 빈 줄
  const texts: string[] = episode.scenes.map((s: { speech: string }) => s.speech);
  const file = path.join(outDir, "audio", "narration.mp3");
  const alignment = await ttsElevenLabs(texts.join(SCENE_JOINER), file);
  const total = durationOf(file);
  narration = `${slug}/audio/narration.mp3`;
  let timings;
  if (alignment) {
    // 자막 조각은 읽는 말로 바꿔 대본에서 찾는다 (자막 "4.5점" ↔ 말 "사쩜오점")
    const spokenChunks = episode.scenes.map((s: { chunks: string[] }) => s.chunks.map(toSpeech));
    timings = sceneTimingsFromAlignment(texts, spokenChunks, alignment, total);
  } else {
    // 글자 시각이 없으면 글자 수 비율로 나눈다
    const lens = texts.map((t) => t.replace(/\s+/g, "").length);
    const sum = lens.reduce((a, b) => a + b, 0);
    timings = lens.map((l, i) => ({ seconds: Math.round(((total * l) / sum + (i === lens.length - 1 ? 0.8 : 0)) * 100) / 100, chunkStarts: null }));
  }
  scenes = episode.scenes.map((s: Record<string, unknown>, i: number) => ({ ...s, audio: null, seconds: timings[i].seconds, chunkStarts: timings[i].chunkStarts }));
  for (const s of scenes) console.log(`  ${s.id} ${(s.seconds as number).toFixed(2)}초`);
} else {
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
}

const players = [];
for (const p of episode.players) {
  const photo = await download(p.photoUrl, path.join(outDir, "img", `${p.playerNo}.png`));
  const logoExt = (p.team.logoUrl ?? "").split(".").pop() || "svg";
  const logo = await download(p.team.logoUrl, path.join(outDir, "img", `team-${p.team.code}.${logoExt}`));
  if (p.photoUrl && !photo) failures.push(`사진 ${p.name}`);
  players.push({ ...p, photoFile: photo, team: { ...p.team, logoFile: logo } });
}

const props = { ...episode, players, scenes, narration, voice: provider };
fs.writeFileSync(path.join(outDir, "props.json"), JSON.stringify(props));
// 유튜브 올릴 때 붙여 넣을 제목·설명·태그
fs.writeFileSync(
  path.join(outDir, "upload.txt"),
  [`[제목]`, episode.title, ``, `[설명]`, episode.description, ``, `[태그]`, episode.tags.join(", "), ``].join("\n"),
);
const total = scenes.reduce((a, s) => a + (s.seconds as number), 0);
console.log(`렌더 입력: shorts/public/${slug}/props.json (약 ${total.toFixed(1)}초)`);
if (failures.length) console.log(`실패 ${failures.length}건 (대체 디자인으로 진행):\n  ${failures.join("\n  ")}`);
