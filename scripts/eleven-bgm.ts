// 숏폼 배경음악 만들기 — ElevenLabs 음악(Eleven Music)으로 스포츠 하이라이트풍 연주곡을 만든다 (2026-10-02 사용자 요청)
//
// 실행(Actions): npx tsx scripts/eleven-bgm.ts → shorts/out/bgm/sports-a.mp3, sports-b.mp3 (두 가지 느낌)
// 한 번 만들어 shorts-renders 브랜치 bgm/ 에 두고 매 렌더가 재사용한다(매번 만들면 사용량이 든다).
// 기본은 a(shorts-renders bgm/sports.mp3). 목소리 밑에 깔리므로 보컬 없이, 처음부터 끝까지 같은 세기로.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error("ELEVENLABS_API_KEY 가 없습니다");
const outDir = path.join(ROOT, "shorts", "out", "bgm");
fs.mkdirSync(outDir, { recursive: true });

const LENGTH_MS = Number(process.env.BGM_LENGTH_MS || 45000);
const PROMPTS: Record<string, string> = {
  a:
    "Energetic modern sports highlight background music for a basketball stats short. Punchy hip-hop drums, crisp trap hi-hats, " +
    "deep 808 bass, bright synth stabs, 100 BPM, confident hype mood like a broadcast intro. Instrumental, no vocals, " +
    "steady energy from start to end with no long intro or breakdown, mixed to sit under a voice-over.",
  b:
    "Upbeat electronic sports bed for a fast-paced basketball recap. Driving four-on-the-floor kick, claps, plucky synth arpeggio, " +
    "rising energy, 120 BPM, modern and clean like an NBA social media edit. Instrumental, no vocals, consistent loudness, " +
    "no big drops, leaves room for narration.",
};

const failures: string[] = [];
for (const [key, prompt] of Object.entries(PROMPTS)) {
  const res = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, music_length_ms: LENGTH_MS, model_id: "music_v1", force_instrumental: true }),
  });
  if (!res.ok) {
    const msg = `${key}: ${res.status} ${(await res.text()).slice(0, 300)}`;
    failures.push(msg);
    console.log(`실패 ${msg}`);
    continue;
  }
  const file = path.join(outDir, `sports-${key}.mp3`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log(`배경음악 ${key}: ${(fs.statSync(file).size / 1024).toFixed(0)}KB`);
}
if (failures.length === Object.keys(PROMPTS).length) throw new Error(`배경음악을 하나도 못 만듦:\n${failures.join("\n")}`);
