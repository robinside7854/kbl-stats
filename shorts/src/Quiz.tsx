// 포맷 C — "슛 차트만 보고 누군지 맞혀 봐" (게임쇼 디자인: 보라 바탕 + 분홍·하늘 네온, 둥근 카드, 물음표)
// 문제 장면: 이름·사진 없이 슛 점과 구역 비중만 → "셋, 둘, 하나" 동안 타이머 → 정답 장면: 사진이 튀어나오고 이름.
// 숫자·문장은 전부 props 에서 온다.

import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { ReactNode } from "react";
import { FONT, FPS, SAFE } from "./theme";
import { prog, rise, text, useFont } from "./TopScorers";
import type { EpisodeScene, ShotTuple } from "./types";

const Q = { bg1: "#2A0B5E", bg2: "#10031F", pink: "#FF3D8B", cyan: "#2CE5FF", lime: "#C6FF3D", white: "#FFFFFF", soft: "#C9B8F0", card: "#3B1680" };
const ZONE_COLOR = [Q.pink, Q.lime, Q.cyan]; // 안쪽 · 미드 · 3점

interface QPlayer {
  playerNo: string;
  name: string;
  teamName: string;
  team: { code: string; name: string; color: string; logoFile?: string | null };
  photoFile: string | null;
  position: string | null;
  ppg: number;
  inside: number;
  mid: number;
  three: number;
  kind: "inside" | "three" | "leader";
  shots: { missed: ShotTuple[]; made: ShotTuple[]; total: number };
}
export interface QuizProps {
  seasonLabel: string;
  court: { viewBox: string; lines: string[]; rim: { cx: number; cy: number; r: number } };
  players: QPlayer[];
  scenes: EpisodeScene[];
  narration?: string | null;
  bgm?: string | null;
  [key: string]: unknown;
}

function Sub({ scene }: { scene: EpisodeScene }) {
  const f = useCurrentFrame();
  const t = f / FPS;
  let idx = 0;
  if (scene.chunkStarts && scene.chunkStarts.length === scene.chunks.length) scene.chunkStarts.forEach((s, i) => t >= s && (idx = i));
  else idx = Math.min(scene.chunks.length - 1, Math.floor((f / Math.max(1, scene.seconds * FPS)) * scene.chunks.length));
  return (
    <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 1335, display: "flex", justifyContent: "center" }}>
      <div style={{ background: Q.white, borderRadius: 999, padding: "14px 34px", ...text(44, 900, Q.bg1, { whiteSpace: "nowrap" }) }}>{scene.chunks[idx] ?? ""}</div>
    </div>
  );
}

function Frame({ scene, badge, children }: { scene: EpisodeScene; badge: string; children: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 30%, ${Q.bg1} 0%, ${Q.bg2} 75%)` }}>
      <div style={{ position: "absolute", left: SAFE.left, top: SAFE.top, display: "flex", gap: 14, alignItems: "center" }}>
        <span style={{ background: Q.pink, borderRadius: 999, padding: "8px 22px", ...text(30, 900, Q.white) }}>{badge}</span>
        <span style={text(28, 800, Q.soft)}>슛 차트 퀴즈</span>
      </div>
      {children}
      <Sub scene={scene} />
      <div style={{ position: "absolute", left: SAFE.left, top: SAFE.bottom - 4, ...text(20, 500, Q.soft) }}>
        KBL 공식 슛 차트 · 사진 © KBL 및 각 구단 · 비영리 팬 채널
      </div>
    </AbsoluteFill>
  );
}

function Court({ p, court, width, dots }: { p: QPlayer; court: QuizProps["court"]; width: number; dots: number }) {
  const vb = "-7.6 -1.7 15.2 10.6";
  const height = (width * 10.6) / 15.2;
  const n = (a: unknown[]) => Math.floor(a.length * dots);
  return (
    <svg width={width} height={height} viewBox={vb} style={{ display: "block" }}>
      <rect x={-7.6} y={-1.7} width={15.2} height={10.6} rx={0.4} fill="#1B0840" />
      <g fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={0.06}>
        {court.lines.map((d, i) => (
          <path key={i} d={d} />
        ))}
        <circle cx={court.rim.cx} cy={court.rim.cy} r={court.rim.r} />
      </g>
      {p.shots.missed.slice(0, n(p.shots.missed)).map((s, i) => (
        <circle key={`m${i}`} cx={s[1]} cy={s[0]} r={0.09} fill="rgba(255,255,255,0.25)" />
      ))}
      {p.shots.made.slice(0, n(p.shots.made)).map((s, i) => (
        <circle key={`o${i}`} cx={s[1]} cy={s[0]} r={0.15} fill={ZONE_COLOR[s[3]] ?? Q.white} />
      ))}
    </svg>
  );
}

/** 구역 비중 막대 세 줄 */
function ZoneBars({ p, appear }: { p: QPlayer; appear: number }) {
  const rows = [
    { label: "페인트 안", v: p.inside, c: Q.pink },
    { label: "미드레인지", v: p.mid, c: Q.lime },
    { label: "3점", v: p.three, c: Q.cyan },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ width: 170, ...text(28, 800, Q.soft) }}>{r.label}</span>
          <div style={{ flex: 1, height: 30, borderRadius: 999, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
            <div style={{ width: `${r.v * appear}%`, height: "100%", borderRadius: 999, background: r.c }} />
          </div>
          <span style={{ width: 96, textAlign: "right", ...text(32, 900, Q.white) }}>{Math.round(r.v * appear)}%</span>
        </div>
      ))}
    </div>
  );
}

function Cover({ props, scene }: { props: QuizProps; scene: EpisodeScene }) {
  const f = useCurrentFrame();
  return (
    <Frame scene={scene} badge={`${props.seasonLabel} 시즌`}>
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 250, textAlign: "center", ...rise(prog(f, 0, 12)) }}>
        <div style={text(150, 900, Q.white, { lineHeight: 1 })}>WHO&apos;S</div>
        <div style={text(150, 900, Q.cyan, { lineHeight: 1 })}>THIS?</div>
        <div style={text(56, 900, Q.white, { marginTop: 30 })}>슛 차트만 보고 맞혀 봐</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 840, display: "flex", justifyContent: "center", gap: 30 }}>
        {props.players.map((p, i) => {
          const s = spring({ frame: f - 8 - i * 4, fps: FPS, config: { damping: 9 } });
          return (
            <div
              key={p.playerNo}
              style={{ width: 240, height: 300, borderRadius: 28, background: Q.card, border: `6px solid ${[Q.pink, Q.lime, Q.cyan][i]}`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${s}) rotate(${(i - 1) * 6}deg)` }}
            >
              <span style={text(180, 900, Q.white)}>?</span>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

function Question({ props, scene, i }: { props: QuizProps; scene: EpisodeScene; i: number }) {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = props.players.find((x) => x.playerNo === scene.playerNo)!;
  // "셋, 둘, 하나" 는 장면 마지막 약 35% — 그동안 링이 줄어든다
  const tStart = Math.round(durationInFrames * 0.62);
  const ring = interpolate(f, [tStart, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const count = f < tStart ? null : Math.max(1, 3 - Math.floor(((f - tStart) / Math.max(1, durationInFrames - tStart)) * 3));
  return (
    <Frame scene={scene} badge={`Q${i + 1}`}>
      <div style={{ position: "absolute", left: SAFE.left, top: 230, ...rise(prog(f, 0, 12), 30) }}>
        <Court p={p} court={props.court} width={960} dots={prog(f, 4, 30)} />
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 930, ...rise(prog(f, 14, 12)) }}>
        <ZoneBars p={p} appear={prog(f, 14, 20)} />
        <div style={{ display: "flex", gap: 14, marginTop: 24 }}>
          <span style={{ borderRadius: 999, padding: "10px 22px", background: Q.card, ...text(30, 900, Q.white) }}>경기당 {p.ppg}점</span>
          {p.position ? <span style={{ borderRadius: 999, padding: "10px 22px", background: Q.card, ...text(30, 900, Q.white) }}>{p.position}</span> : null}
        </div>
      </div>
      {count ? (
        <div style={{ position: "absolute", right: 1080 - SAFE.right + 16, top: 246, width: 150, height: 150 }}>
          <svg width={150} height={150} viewBox="0 0 150 150">
            <circle cx={75} cy={75} r={64} fill={Q.bg2} stroke="rgba(255,255,255,0.15)" strokeWidth={12} />
            <circle cx={75} cy={75} r={64} fill="none" stroke={Q.pink} strokeWidth={12} strokeDasharray={`${2 * Math.PI * 64 * ring} 999`} transform="rotate(-90 75 75)" strokeLinecap="round" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", ...text(80, 900, Q.white) }}>{count}</div>
        </div>
      ) : null}
    </Frame>
  );
}

function Answer({ props, scene, i }: { props: QuizProps; scene: EpisodeScene; i: number }) {
  const f = useCurrentFrame();
  const p = props.players.find((x) => x.playerNo === scene.playerNo)!;
  const pop = spring({ frame: f, fps: FPS, config: { damping: 10 } });
  return (
    <Frame scene={scene} badge={`A${i + 1}`}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 250, display: "flex", justifyContent: "center" }}>
        <div style={{ width: 600, height: 600, borderRadius: 300, overflow: "hidden", background: p.team.color, border: `12px solid ${Q.cyan}`, transform: `scale(${pop})` }}>
          {p.photoFile ? (
            <Img src={staticFile(p.photoFile)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 10%" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", ...text(220, 900, "rgba(255,255,255,0.35)") }}>{p.name.slice(-2)}</div>
          )}
        </div>
      </div>
      <div
        style={{ position: "absolute", left: 640, top: 250, transform: `rotate(12deg) scale(${spring({ frame: f - 8, fps: FPS, config: { damping: 8 } })})`, background: Q.lime, borderRadius: 18, padding: "10px 26px", ...text(54, 900, Q.bg1) }}
      >
        정답!
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 900, textAlign: "center", ...rise(prog(f, 6, 12)) }}>
        <div style={text(120, 900, Q.white, { lineHeight: 1 })}>{p.name}</div>
        <div style={text(40, 800, Q.soft, { marginTop: 18 })}>
          {p.teamName} · {p.position ?? ""} · 경기당 {p.ppg}점
        </div>
      </div>
    </Frame>
  );
}

function Outro({ props, scene }: { props: QuizProps; scene: EpisodeScene }) {
  const f = useCurrentFrame();
  const tiers = [
    { n: "3개", t: "찐팬 인정", c: Q.lime },
    { n: "2개", t: "꽤 보는 사람", c: Q.cyan },
    { n: "0~1개", t: "이번 시즌부터 같이 보자", c: Q.pink },
  ];
  return (
    <Frame scene={scene} badge="결과">
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 250, textAlign: "center", ...rise(prog(f, 0, 10)) }}>
        <div style={text(100, 900, Q.white)}>몇 개 맞혔어?</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 470, display: "flex", flexDirection: "column", gap: 22 }}>
        {tiers.map((t, i) => (
          <div key={t.n} style={{ display: "flex", alignItems: "center", gap: 24, borderRadius: 28, background: Q.card, padding: "26px 34px", border: `5px solid ${t.c}`, ...rise(prog(f, 4 + i * 4, 10), 30) }}>
            <span style={{ width: 200, ...text(64, 900, t.c) }}>{t.n}</span>
            <span style={text(48, 900, Q.white)}>{t.t}</span>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 1080, display: "flex", justifyContent: "center", gap: 20 }}>
        {props.players.map((p) => (
          <div key={p.playerNo} style={{ width: 150, height: 150, borderRadius: 75, overflow: "hidden", background: p.team.color, border: `5px solid ${Q.white}` }}>
            {p.photoFile ? <Img src={staticFile(p.photoFile)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 10%" }} /> : null}
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function Quiz(props: QuizProps) {
  useFont();
  const { durationInFrames } = useVideoConfig();
  let from = 0;
  return (
    <AbsoluteFill style={{ background: Q.bg2, fontFamily: FONT }}>
      {props.narration ? <Audio src={staticFile(props.narration)} /> : null}
      {props.bgm ? (
        <Audio
          src={staticFile(props.bgm)}
          loop
          volume={(fr) => 0.14 * interpolate(fr, [0, 9, durationInFrames - 36, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      ) : null}
      {props.scenes.map((scene) => {
        const dur = Math.round(scene.seconds * FPS);
        const start = from;
        from += dur;
        const i = props.players.findIndex((p) => p.playerNo === scene.playerNo);
        const body =
          scene.kind === "cover" ? (
            <Cover props={props} scene={scene} />
          ) : scene.kind === "question" ? (
            <Question props={props} scene={scene} i={i} />
          ) : scene.kind === "answer" ? (
            <Answer props={props} scene={scene} i={i} />
          ) : (
            <Outro props={props} scene={scene} />
          );
        return (
          <Sequence key={scene.id} from={start} durationInFrames={dur} name={scene.id}>
            {body}
            {scene.audio ? <Audio src={staticFile(scene.audio)} /> : null}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
