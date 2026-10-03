// ElevenLabs 목소리 후보 듣기 — 공개 목소리 목록(Voice Library)에서 한국어 남성 목소리를 골라
// 우리 대본 두 줄을 같은 설정(eleven_v3 + 빠르기)으로 읽힌 샘플을 만든다. (2026-10-02 사용자: "목소리 추천해 줄 수 있어?")
//
// 실행(Actions): npx tsx scripts/eleven-voices.ts → shorts/out/voices/{번호}-{이름}.mp3 + voices.txt(번호·이름·설명·ID)
// 필요: ELEVENLABS_API_KEY. 고른 목소리는 내 목소리(My Voices)에 추가된 상태로 남는다 — voices.txt 의 ID 를
// GitHub Secrets ELEVENLABS_VOICE_ID 에 넣으면 다음 렌더부터 그 목소리. (Starter 는 내 목소리 10개까지)

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { toSpeech } from "../lib/shorts";

const ROOT = path.resolve(import.meta.dirname, "..");
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error("ELEVENLABS_API_KEY 가 없습니다");
const API = "https://api.elevenlabs.io/v1";
const headers = { "xi-api-key": KEY, "Content-Type": "application/json" };
const outDir = path.join(ROOT, "shorts", "out", "voices");
fs.mkdirSync(outDir, { recursive: true });

/** 후보 수 */
const COUNT = Number(process.env.VOICE_CANDIDATES || 6);
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_v3";
const TEMPO = Number(process.env.SHORTS_TEMPO || 1.12);

interface SharedVoice {
  public_owner_id: string;
  voice_id: string;
  name: string;
  description?: string | null;
  descriptive?: string | null;
  accent?: string | null;
  age?: string | null;
  gender?: string | null;
  use_case?: string | null;
  language?: string | null;
  cloned_by_count?: number;
  usage_character_count_1y?: number;
}

async function listShared(params: Record<string, string>): Promise<SharedVoice[]> {
  const q = new URLSearchParams({ page_size: "50", language: "ko", gender: "male", sort: "usage_character_count_1y", ...params });
  const res = await fetch(`${API}/shared-voices?${q}`, { headers });
  if (!res.ok) throw new Error(`shared-voices ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as { voices: SharedVoice[] }).voices ?? [];
}

// 20대 느낌 → age=young 먼저, 모자라면 middle_aged 로 채운다. 많이 쓰인 순
const young = await listShared({ age: "young" });
const pool = young.length >= COUNT ? young : [...young, ...(await listShared({ age: "middle_aged" }))];
const seen = new Set<string>();
const picks = pool.filter((v) => !seen.has(v.voice_id) && seen.add(v.voice_id)).slice(0, COUNT);
if (!picks.length) throw new Error("한국어 남성 공개 목소리를 찾지 못함");
console.log(`후보 ${picks.length}개 (young ${young.length}개 중)`);

// 우리 대본 두 줄 (표지 + 1위)
const episode = JSON.parse(fs.readFileSync(path.join(ROOT, "shorts", "episodes", "47-domestic-top5-scoring", "episode.json"), "utf8"));
const lines = [episode.scenes[0].speech, episode.scenes.find((s: { id: string }) => s.id === "rank-1").speech].map(toSpeech);
const sample = (/v3|v4/.test(MODEL) ? "[excited] " : "") + lines.join("\n\n");

const rows: string[] = [];
for (const [i, v] of picks.entries()) {
  const n = String(i + 1).padStart(2, "0");
  try {
    // 내 목소리에 추가해야 API 로 읽힐 수 있다 (이미 있으면 그 ID 를 그대로 쓴다)
    const add = await fetch(`${API}/voices/add/${v.public_owner_id}/${v.voice_id}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ new_name: `KBL 후보 ${n} ${v.name}`.slice(0, 60) }),
    });
    const addText = await add.text();
    const myId = add.ok ? (JSON.parse(addText) as { voice_id: string }).voice_id : v.voice_id;
    if (!add.ok) console.log(`  ${n} 추가 실패 ${add.status} (이미 있으면 정상): ${addText.slice(0, 160)}`);
    const tts = await fetch(`${API}/text-to-speech/${myId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: sample, model_id: MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.8 } }),
    });
    if (!tts.ok) throw new Error(`TTS ${tts.status}: ${(await tts.text()).slice(0, 200)}`);
    const safe = v.name.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 30);
    const file = path.join(outDir, `${n}-${safe}.mp3`);
    fs.writeFileSync(file, Buffer.from(await tts.arrayBuffer()));
    if (Math.abs(TEMPO - 1) > 0.01) {
      const fast = file.replace(/\.mp3$/, ".tmp.mp3");
      execFileSync("npx", ["remotion", "ffmpeg", "-y", "-loglevel", "error", "-i", file, "-filter:a", `atempo=${TEMPO}`, fast], { cwd: path.join(ROOT, "shorts") });
      fs.renameSync(fast, file);
    }
    const desc = [v.age, v.accent, v.descriptive, v.use_case].filter(Boolean).join(" · ");
    rows.push(`${n}. ${v.name} — ${desc}\n    ${(v.description ?? "").replace(/\s+/g, " ").slice(0, 160)}\n    ELEVENLABS_VOICE_ID = ${myId}`);
    console.log(`  ${n} ${v.name} ✓`);
  } catch (e) {
    rows.push(`${n}. ${v.name} — 실패: ${(e as Error).message}`);
    console.log(`  ${n} ${v.name} 실패: ${(e as Error).message}`);
  }
}
fs.writeFileSync(
  path.join(outDir, "voices.txt"),
  [`목소리 후보 (모델 ${MODEL}, 빠르기 ×${TEMPO}, 대본: 표지 + 1위)`, "", ...rows, "", "마음에 드는 번호의 ID 를 GitHub Secrets ELEVENLABS_VOICE_ID 에 넣으면 다음 렌더부터 그 목소리입니다.", ""].join("\n"),
);
