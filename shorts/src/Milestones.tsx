// 포맷 B — "개막전에 깨질 수도 있는 기록" (전광판 디자인: 검정 + 형광 노랑, 굵은 숫자, 흐르는 띠)
// 앞 포맷(TopScorers, 어두운 잡지 톤)과 일부러 완전히 다르게: 사진은 크게 잘라 왼쪽 판, 가운데 거대한 "남은 숫자", 칸 막대.
// 숫자·문장은 전부 props 에서 온다.

import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { FONT, FPS, SAFE, onDark } from "./theme";
import { prog, rise, text, useFont } from "./TopScorers";
import type { EpisodeScene } from "./types";

const K = { bg: "#07080A", panel: "#15171C", yellow: "#FFD400", white: "#FFFFFF", dim: "#8A8F99", line: "#2A2D35" };

interface MPlayer {
  playerNo: string;
  name: string;
  team: { code: string; name: string; color: string; secondary: string; logoFile?: string | null };
  photoFile: string | null;
  label: string;
  unit: string;
  current: number;
  target: number;
  remaining: number;
  perGame: number;
  gamesNeeded: number;
  nth: number;
  goal: string;
  movedFrom: string | null;
}
export interface MilestoneProps {
  seasonLabel: string;
  players: MPlayer[];
  scenes: EpisodeScene[];
  narration?: string | null;
  bgm?: string | null;
  [key: string]: unknown;
}

/** 위 띠 — 노란 바탕 검정 글자가 왼쪽으로 흐른다 */
function Ticker({ label }: { label: string }) {
  const f = useCurrentFrame();
  const item = `KBL OPENING WATCH  ·  ${label}  ·  `;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: SAFE.top - 10, height: 64, background: K.yellow, overflow: "hidden" }}>
      <div style={{ whiteSpace: "nowrap", transform: `translateX(${-((f * 3) % 900)}px)`, ...text(34, 900, K.bg, { lineHeight: "64px", letterSpacing: 2 }) }}>
        {item.repeat(6)}
      </div>
    </div>
  );
}

/** 자막 — 상자 없이 흰 글자 + 검정 외곽선 (앞 포맷의 흰 상자와 다르게) */
function Sub({ scene }: { scene: EpisodeScene }) {
  const f = useCurrentFrame();
  const t = f / FPS;
  let idx = 0;
  if (scene.chunkStarts && scene.chunkStarts.length === scene.chunks.length) scene.chunkStarts.forEach((s, i) => t >= s && (idx = i));
  else idx = Math.min(scene.chunks.length - 1, Math.floor((f / Math.max(1, scene.seconds * FPS)) * scene.chunks.length));
  return (
    <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 1330, textAlign: "center" }}>
      <span style={text(54, 900, K.white, { WebkitTextStroke: "10px #000", paintOrder: "stroke fill", whiteSpace: "nowrap" } as CSSProperties)}>
        {scene.chunks[idx] ?? ""}
      </span>
    </div>
  );
}

function Frame({ label, scene, children }: { label: string; scene: EpisodeScene; children: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: K.bg }}>
      {/* 사선 줄무늬 바탕 */}
      <AbsoluteFill style={{ background: "repeating-linear-gradient(135deg, #0D0F13 0 18px, #07080A 18px 36px)", opacity: 0.9 }} />
      <Ticker label={label} />
      {children}
      <Sub scene={scene} />
      <div style={{ position: "absolute", left: SAFE.left, top: SAFE.bottom - 4, ...text(20, 500, K.dim) }}>
        기록 KBL 공식 홈페이지 · 정규리그 통산 · 사진 © KBL 및 각 구단 · 비영리 팬 채널
      </div>
    </AbsoluteFill>
  );
}

function PhotoPanel({ p, w, h, style }: { p: MPlayer; w: number; h: number; style?: CSSProperties }) {
  return (
    <div style={{ position: "relative", width: w, height: h, overflow: "hidden", background: p.team.color, clipPath: "polygon(0 0, 100% 0, 100% 88%, 82% 100%, 0 100%)", ...style }}>
      {p.photoFile ? (
        <Img src={staticFile(p.photoFile)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 10%" }} />
      ) : (
        <div style={{ position: "absolute", right: 20, top: 10, ...text(Math.round(h * 0.28), 900, "rgba(255,255,255,0.25)") }}>{p.name.slice(-2)}</div>
      )}
    </div>
  );
}

function Cover({ props, scene }: { props: MilestoneProps; scene: EpisodeScene }) {
  const f = useCurrentFrame();
  return (
    <Frame label={`${props.seasonLabel} 개막 D-1`} scene={scene}>
      <div style={{ position: "absolute", left: SAFE.left, top: 230, ...rise(prog(f, 0, 10)) }}>
        <div style={text(44, 800, K.dim)}>{props.seasonLabel} KBL 개막</div>
        <div style={text(330, 900, K.yellow, { lineHeight: 0.95, letterSpacing: -12 })}>D-1</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, top: 640, width: 960, ...rise(prog(f, 6, 12)) }}>
        <div style={text(84, 900, K.white, { lineHeight: 1.1 })}>개막전에 깨질 수도</div>
        <div style={text(84, 900, K.white, { lineHeight: 1.1 })}>
          있는 기록 <span style={{ color: K.yellow }}>{props.players.length}</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, top: 940, display: "flex", gap: 18 }}>
        {props.players.map((p, i) => (
          <div key={p.playerNo} style={{ ...rise(prog(f, 12 + i * 3, 10), 50) }}>
            <PhotoPanel p={p} w={176} h={230} />
            <div style={text(26, 800, K.white, { marginTop: 8, textAlign: "center" })}>{p.name}</div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** 칸 막대 — 목표까지 20칸, 남은 칸은 깜빡인다 */
function Segments({ p, appear }: { p: MPlayer; appear: number }) {
  const f = useCurrentFrame();
  const n = 20;
  const done = Math.min(n - 1, Math.floor((p.current / p.target) * n));
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {Array.from({ length: n }, (_, i) => {
        const filled = i < done * appear;
        const blink = !filled && Math.floor(f / 8) % 2 === 0;
        return (
          <div
            key={i}
            style={{ width: 42, height: 56, borderRadius: 4, background: filled ? K.yellow : blink ? "#3A3200" : K.panel, border: `2px solid ${filled ? K.yellow : "#3A3D45"}` }}
          />
        );
      })}
    </div>
  );
}

function MilestoneScene({ props, scene, index }: { props: MilestoneProps; scene: EpisodeScene; index: number }) {
  const f = useCurrentFrame();
  const p = props.players.find((x) => x.playerNo === scene.playerNo)!;
  // 큰 숫자는 쾅 하고 커졌다 자리 잡는다
  const pop = interpolate(prog(f, 8, 10), [0, 0.6, 1], [0.4, 1.12, 1]);
  const unit = p.unit === "승" ? "승" : p.unit;
  return (
    <Frame label={`RECORD ${index + 1} / ${props.players.length}`} scene={scene}>
      <div style={{ position: "absolute", left: SAFE.left, top: 230, ...rise(prog(f, 0, 10), 60) }}>
        <PhotoPanel p={p} w={430} h={560} />
      </div>
      <div style={{ position: "absolute", left: 530, right: 1080 - SAFE.right, top: 240, ...rise(prog(f, 3, 10)) }}>
        <div style={{ display: "inline-block", background: onDark(p.team.color), borderRadius: 6, padding: "4px 14px", ...text(30, 900, "#fff") }}>
          {p.team.name}
        </div>
        <div style={text(84, 900, K.white, { marginTop: 14, lineHeight: 1.05 })}>{p.name}</div>
        {p.movedFrom ? <div style={text(28, 700, K.yellow, { marginTop: 8 })}>{p.movedFrom} → {p.team.name} 이적</div> : null}
        <div style={text(30, 700, K.dim, { marginTop: 26 })}>정규리그 통산</div>
        <div style={text(64, 900, K.yellow, { lineHeight: 1.1 })}>{p.goal}</div>
        <div style={text(30, 700, K.dim, { marginTop: 6 })}>
          지금 {p.current.toLocaleString("ko-KR")}
          {unit}
        </div>
      </div>
      {/* 거대한 남은 숫자 */}
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 820, display: "flex", alignItems: "flex-end", gap: 24 }}>
        <span style={{ display: "inline-block", transform: `scale(${pop})`, transformOrigin: "left bottom", ...text(300, 900, K.yellow, { lineHeight: 0.85, letterSpacing: -10 }) }}>{p.remaining}</span>
        <span style={{ paddingBottom: 26, ...text(64, 900, K.white) }}>
          {unit} 남음
        </span>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, top: 1100 }}>
        <Segments p={p} appear={prog(f, 10, 24)} />
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 1190, display: "flex", gap: 14, ...rise(prog(f, 28, 10)) }}>
        <Chip>경기당 {p.perGame}{unit}</Chip>
        <Chip>{p.gamesNeeded <= 1 ? "개막전 달성 페이스" : `${p.gamesNeeded}경기 페이스`}</Chip>
        {p.nth <= 10 ? <Chip hot>KBL 역대 {p.nth}번째</Chip> : null}
      </div>
    </Frame>
  );
}

function Chip({ children, hot }: { children: ReactNode; hot?: boolean }) {
  return (
    <span style={{ borderRadius: 999, padding: "10px 22px", background: hot ? K.yellow : K.panel, border: `2px solid ${hot ? K.yellow : K.line}`, ...text(32, 900, hot ? K.bg : K.white) }}>
      {children}
    </span>
  );
}

function Outro({ props, scene }: { props: MilestoneProps; scene: EpisodeScene }) {
  const f = useCurrentFrame();
  return (
    <Frame label="개막전 예상 ㄱㄱ" scene={scene}>
      <div style={{ position: "absolute", left: SAFE.left, top: 240, ...rise(prog(f, 0, 10)) }}>
        <div style={text(88, 900, K.white, { lineHeight: 1.1 })}>개막전에서</div>
        <div style={text(88, 900, K.yellow, { lineHeight: 1.1 })}>몇 개 터질까?</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 520 }}>
        {props.players.map((p, i) => (
          <div
            key={p.playerNo}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 0", borderBottom: `2px solid ${K.line}`, ...rise(prog(f, 4 + i * 3, 10), 30) }}
          >
            <span style={text(40, 900, K.white)}>
              {p.name} <span style={text(28, 700, K.dim)}>{p.team.name}</span>
            </span>
            <span style={text(36, 900, K.yellow)}>
              {p.goal}까지 {p.remaining}
              {p.unit === "승" ? "승" : p.unit}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function Milestones(props: MilestoneProps) {
  useFont();
  const { durationInFrames } = useVideoConfig();
  let from = 0;
  return (
    <AbsoluteFill style={{ background: K.bg, fontFamily: FONT }}>
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
        const mi = props.players.findIndex((p) => p.playerNo === scene.playerNo);
        const body =
          scene.kind === "cover" ? (
            <Cover props={props} scene={scene} />
          ) : scene.kind === "outro" ? (
            <Outro props={props} scene={scene} />
          ) : (
            <MilestoneScene props={props} scene={scene} index={mi} />
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
