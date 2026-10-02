// "지난 시즌 국내 득점 TOP 5 — 득점 유형" 숏폼 (1080×1920, 30fps)
// 장면: 표지 → 5위…1위 → 한눈에 비교 → 질문. 장면 길이는 목소리 길이(props.scenes[].seconds).
// 숫자·문장은 전부 props 에서 온다 — 이 파일은 그리기만 한다.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, FONT, FPS, SAFE, SOURCE_COLOR } from "./theme";
import type { EpisodePlayer, EpisodeProps, EpisodeScene, ScoringSource } from "./types";

// ─────────────────────────────────────────────
// 공통
// ─────────────────────────────────────────────

const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
/** frame 이 start 에서 dur 프레임 동안 0 → 1 */
const prog = (frame: number, start: number, dur: number) =>
  interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
/** 아래에서 올라오며 나타남 */
const rise = (p: number, dist = 36): CSSProperties => ({ opacity: p, transform: `translateY(${(1 - p) * dist}px)` });

function useFont() {
  const [handle] = useState(() => delayRender("Pretendard"));
  useEffect(() => {
    const face = new FontFace("Pretendard Variable", `url(${staticFile("fonts/PretendardVariable.woff2")}) format("woff2")`, {
      weight: "100 900",
    });
    face
      .load()
      .then((f) => {
        document.fonts.add(f);
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  }, [handle]);
}

const text = (size: number, weight: number, color: string = C.ink, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: FONT,
  fontSize: size,
  fontWeight: weight,
  color,
  lineHeight: 1.15,
  letterSpacing: size >= 80 ? -size * 0.03 : -size * 0.01,
  fontFeatureSettings: '"tnum" 1',
  ...extra,
});

function Masthead({ season, section }: { season: string; section: string }) {
  return (
    <div style={{ position: "absolute", left: SAFE.left, right: W_PAD, top: SAFE.top }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={text(30, 900, C.ink, { letterSpacing: 6 })}>STATS REFERENCE</span>
        <span style={text(26, 600, C.ink2)}>
          {season} 시즌 리뷰 · {section}
        </span>
      </div>
      <div style={{ height: 4, background: C.rule, marginTop: 14 }} />
      <div style={{ height: 1.5, background: C.rule, marginTop: 5 }} />
    </div>
  );
}
const W_PAD = 1080 - SAFE.right;

function Credits() {
  return (
    <div style={{ position: "absolute", left: SAFE.left, right: W_PAD, top: SAFE.bottom - 4, ...text(20, 500, C.ink3) }}>
      기록 KBL 공식 홈페이지 · 사진 © KBL 및 각 구단 · 비영리 팬 채널
    </div>
  );
}

/** 자막 — 대본 조각을 글자 수 비율로 나눠 보여 준다 */
function Caption({ scene }: { scene: EpisodeScene }) {
  const frame = useCurrentFrame();
  const speak = Math.max(1, (scene.seconds - 0.25) * FPS);
  const lens = scene.chunks.map((c) => c.replace(/\s+/g, "").length || 1);
  const total = lens.reduce((a, b) => a + b, 0);
  let acc = 0;
  let idx = scene.chunks.length - 1;
  if (scene.chunkStarts && scene.chunkStarts.length === scene.chunks.length) {
    // 실제 말 시각 — 그 조각을 말하기 시작한 순간부터 보인다
    const t = frame / FPS;
    idx = 0;
    scene.chunkStarts.forEach((s, i) => {
      if (t >= s) idx = i;
    });
    return <CaptionBox text={scene.chunks[idx] ?? ""} />;
  }
  for (let i = 0; i < lens.length; i++) {
    acc += lens[i];
    if (frame < (acc / total) * speak) {
      idx = i;
      break;
    }
  }
  return <CaptionBox text={scene.chunks[idx] ?? ""} />;
}

function CaptionBox({ text: chunk }: { text: string }) {
  return (
    <div style={{ position: "absolute", left: SAFE.left, right: W_PAD, top: 1340, display: "flex", justifyContent: "center" }}>
      <div style={{ background: C.ink, padding: "14px 28px", borderRadius: 8, maxWidth: 960 }}>
        <span style={text(44, 700, C.paper, { letterSpacing: -0.5, whiteSpace: "nowrap" })}>{chunk}</span>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name.length <= 3 ? name.slice(1) : name.slice(0, 2);
}

/** 선수 사진 — 없으면 팀 색 바탕 + 이름 글자 (사이트 대체 디자인과 같은 규칙) */
function Photo({ p, width, height, style }: { p: EpisodePlayer; width: number; height: number; style?: CSSProperties }) {
  return (
    <div style={{ position: "relative", width, height, background: p.team.color, overflow: "hidden", ...style }}>
      {p.photoFile ? (
        <Img
          src={staticFile(p.photoFile)}
          style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 12%" }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            right: Math.round(width * 0.06),
            top: Math.round(height * 0.04),
            ...text(Math.round(Math.min(height * 0.3, width * 0.32)), 900, "rgba(255,255,255,0.28)"),
          }}
        >
          {initials(p.name)}
        </div>
      )}
    </div>
  );
}

function TeamMark({ p, size }: { p: EpisodePlayer; size: number }) {
  if (!p.team.logoFile) return null;
  return <Img src={staticFile(p.team.logoFile)} style={{ width: size, height: size, objectFit: "contain" }} />;
}

/** 득점 출처 막대 — 조각 사이 2px 종이색 틈, 양 끝 4px 둥글게. grow 0→1 로 왼쪽부터 자란다 */
function SourceBar({ sources, height, grow, width = 960 }: { sources: ScoringSource[]; height: number; grow: number; width?: number }) {
  const gap = 3;
  const usable = width - gap * (sources.length - 1);
  let x = 0;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <clipPath id={`grow-${height}-${width}`}>
          <rect x={0} y={0} width={width * grow} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#grow-${height}-${width})`}>
        {sources.map((s, i) => {
          const w = (usable * s.share) / 100;
          const r = <rect key={s.key} x={x} y={0} width={Math.max(0, w)} height={height} rx={i === 0 || i === sources.length - 1 ? 4 : 0} fill={SOURCE_COLOR[s.key]} />;
          x += w + gap;
          return r;
        })}
      </g>
    </svg>
  );
}

function Legend({ size = 26 }: { size?: number }) {
  const items: { key: keyof typeof SOURCE_COLOR; label: string }[] = [
    { key: "paint", label: "페인트" },
    { key: "mid", label: "미드레인지" },
    { key: "three", label: "3점" },
    { key: "ft", label: "자유투" },
  ];
  return (
    <div style={{ display: "flex", gap: 28 }}>
      {items.map((it) => (
        <span key={it.key} style={{ display: "flex", alignItems: "center", gap: 10, ...text(size, 600, C.ink2) }}>
          <span style={{ width: size * 0.7, height: size * 0.7, borderRadius: 3, background: SOURCE_COLOR[it.key] }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** 하프코트 슛 점 (바스켓이 위) — 성공 = 팀 색 점, 실패 = 회색 작은 점 */
function ShotInset({ p, court, width, appear }: { p: EpisodePlayer; court: EpisodeProps["court"]; width: number; appear: number }) {
  // 바스켓 쪽 약 9m 만 (대부분의 슛) — 아래 하프라인 쪽은 잘라 점을 크게 본다
  const vb = "-7.6 -1.7 15.2 10.6";
  const height = (width * 10.6) / 15.2;
  const n = (arr: unknown[]) => Math.floor(arr.length * appear);
  return (
    <svg width={width} height={height} viewBox={vb} style={{ display: "block" }}>
      <g fill="none" stroke={C.ink2} strokeWidth={0.06}>
        {court.lines.map((d, i) => (
          <path key={i} d={d} />
        ))}
        <circle cx={court.rim.cx} cy={court.rim.cy} r={court.rim.r} />
      </g>
      <g fill={C.ink3} opacity={0.55}>
        {p.shots.missed.slice(0, n(p.shots.missed)).map((s, i) => (
          <circle key={i} cx={s[1]} cy={s[0]} r={0.11} />
        ))}
      </g>
      <g fill={p.team.color} stroke={C.paper2} strokeWidth={0.03}>
        {p.shots.made.slice(0, n(p.shots.made)).map((s, i) => (
          <circle key={i} cx={s[1]} cy={s[0]} r={0.15} />
        ))}
      </g>
    </svg>
  );
}

function CountUp({ value, p, decimals = 1 }: { value: number; p: number; decimals?: number }) {
  return <>{(value * p).toFixed(decimals)}</>;
}

// ─────────────────────────────────────────────
// 장면
// ─────────────────────────────────────────────

function CoverScene({ props, scene }: { props: EpisodeProps; scene: EpisodeScene }) {
  const frame = useCurrentFrame();
  const byRank = [...props.players].sort((a, b) => a.rank - b.rank);
  const lead = byRank[0];
  return (
    <AbsoluteFill>
      <Masthead season={props.seasonLabel} section="득점 특집" />
      <div style={{ position: "absolute", left: SAFE.left, top: 250, ...rise(prog(frame, 0, 10)) }}>
        <div style={text(40, 700, C.ink2)}>{props.seasonLabel} 정규시즌 · 국내 선수</div>
        <div style={text(150, 900, C.ink, { marginTop: 10 })}>득점 TOP</div>
      </div>
      <div
        style={{
          position: "absolute",
          right: W_PAD,
          top: 210,
          ...text(470, 900, lead.team.color, { lineHeight: 1 }),
          ...rise(prog(frame, 4, 12), 80),
        }}
      >
        5
      </div>
      <div style={{ position: "absolute", left: SAFE.left, top: 700, width: 960, ...rise(prog(frame, 8, 12)) }}>
        <div style={{ height: 4, background: C.rule, width: 120, marginBottom: 26 }} />
        <div style={text(76, 900)}>점수 내는 방법은</div>
        <div style={text(76, 900)}>전부 달랐다</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, top: 990, display: "flex", gap: 15 }}>
        {byRank.map((p, i) => {
          const a = prog(frame, 12 + i * 3, 10);
          return (
            <div key={p.playerNo} style={{ width: 180, ...rise(a, 60) }}>
              <div style={{ position: "relative" }}>
                <Photo p={p} width={180} height={230} style={{ borderRadius: 6 }} />
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    background: C.ink,
                    padding: "4px 12px",
                    borderBottomRightRadius: 6,
                    borderTopLeftRadius: 6,
                    ...text(30, 900, C.paper),
                  }}
                >
                  {p.rank}
                </div>
              </div>
              <div style={text(30, 800, C.ink, { marginTop: 10, textAlign: "center" })}>{p.name}</div>
            </div>
          );
        })}
      </div>
      <Caption scene={scene} />
      <Credits />
    </AbsoluteFill>
  );
}

function PlayerScene({ props, scene }: { props: EpisodeProps; scene: EpisodeScene }) {
  const frame = useCurrentFrame();
  const p = props.players.find((x) => x.playerNo === scene.playerNo)!;
  const meta = [p.team.name, p.position, `${p.games}경기 · 경기당 ${p.mpg}분`].filter(Boolean).join(" · ");
  const bar = prog(frame, 14, 22);
  const top = [...p.sources].sort((a, b) => b.share - a.share)[0];
  return (
    <AbsoluteFill>
      <Masthead season={props.seasonLabel} section={`국내 득점 ${p.rank}위`} />
      {/* 순위 숫자 + 이름 */}
      <div style={{ position: "absolute", left: SAFE.left - 8, top: 196, ...text(330, 900, p.team.color, { lineHeight: 1 }), ...rise(prog(frame, 0, 10), 60) }}>
        {p.rank}
      </div>
      <div style={{ position: "absolute", left: 300, top: 262, right: W_PAD, ...rise(prog(frame, 3, 10)) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span style={text(30, 700, C.ink2)}>국내 득점 {p.rank}위</span>
          <TeamMark p={p} size={44} />
        </div>
        <div style={text(116, 900, C.ink, { marginTop: 4 })}>{p.name}</div>
        <div style={text(28, 600, C.ink2, { marginTop: 8 })}>{meta}</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: W_PAD, top: 566, height: 2, background: C.rule }} />

      {/* 사진 + 경기당 득점 / 슛 위치 */}
      <div style={{ position: "absolute", left: SAFE.left, top: 592, display: "flex", gap: 16 }}>
        <div style={{ position: "relative", ...rise(prog(frame, 4, 12), 40) }}>
          <Photo p={p} width={560} height={420} style={{ borderRadius: 8 }} />
          <div style={{ position: "absolute", left: 28, bottom: 18 }}>
            <div style={text(150, 900, "#fff", { lineHeight: 1, textShadow: "0 2px 12px rgba(0,0,0,0.25)" })}>
              <CountUp value={p.ppg} p={prog(frame, 6, 18)} />
            </div>
            <div style={text(30, 700, "#fff", { textShadow: "0 1px 6px rgba(0,0,0,0.3)" })}>경기당 득점</div>
          </div>
        </div>
        <div style={{ width: 384, height: 420, background: C.paper2, borderRadius: 8, padding: "18px 18px 0", boxSizing: "border-box", ...rise(prog(frame, 8, 12), 40) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={text(24, 800)}>슛 위치</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, ...text(20, 600, C.ink2) }}>
              <span style={{ width: 12, height: 12, borderRadius: 6, background: p.team.color }} /> 성공
              <span style={{ width: 10, height: 10, borderRadius: 5, background: C.ink3, marginLeft: 8 }} /> 실패
            </span>
          </div>
          <div style={{ marginTop: 10 }}>
            <ShotInset p={p} court={props.court} width={348} appear={prog(frame, 10, 30)} />
          </div>
          <div style={text(20, 600, C.ink2, { marginTop: 4 })}>{p.offenseType ? `주 공격 유형 · ${p.offenseType}` : ""}</div>
        </div>
      </div>

      {/* 득점 출처 막대 + 범례 수치 */}
      <div style={{ position: "absolute", left: SAFE.left, top: 1036 }}>
        <SourceBar sources={p.sources} height={52} grow={bar} />
        <div style={{ display: "flex", marginTop: 16 }}>
          {p.sources.map((s, i) => (
            <div key={s.key} style={{ width: 240, opacity: prog(frame, 18 + i * 3, 8) }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, ...text(24, 600, C.ink2) }}>
                <span style={{ width: 16, height: 16, borderRadius: 3, background: SOURCE_COLOR[s.key] }} />
                {s.label}
              </div>
              <div style={text(46, s.key === top.key ? 900 : 700, s.key === top.key ? C.ink : C.ink2, { marginTop: 2 })}>
                {s.share.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 한 줄 특징 */}
      <div style={{ position: "absolute", left: SAFE.left, right: W_PAD, top: 1214, display: "flex", gap: 22, ...rise(prog(frame, 30, 12)) }}>
        <div style={{ width: 10, background: p.team.color, borderRadius: 2 }} />
        <div>
          <div style={text(64, 900)}>{p.callout.headline}</div>
          <div style={text(28, 600, C.ink2, { marginTop: 6 })}>{p.callout.note}</div>
        </div>
      </div>
      <Caption scene={scene} />
      <Credits />
    </AbsoluteFill>
  );
}

function CompareScene({ props, scene }: { props: EpisodeProps; scene: EpisodeScene }) {
  const frame = useCurrentFrame();
  const byRank = [...props.players].sort((a, b) => a.rank - b.rank);
  const best: Record<string, string> = {};
  for (const k of ["paint", "mid", "three", "ft"] as const) {
    best[k] = [...byRank].sort((a, b) => share(b, k) - share(a, k))[0].playerNo;
  }
  return (
    <AbsoluteFill>
      <Masthead season={props.seasonLabel} section="한눈에 비교" />
      <div style={{ position: "absolute", left: SAFE.left, top: 236, ...rise(prog(frame, 0, 10)) }}>
        <div style={text(84, 900)}>득점은 어디서 나왔나</div>
        <div style={text(26, 600, C.ink2, { marginTop: 10 })}>득점 중 비중 · 2점은 슛 위치(공식 슛 차트) 기준으로 나눔</div>
        <div style={{ marginTop: 26 }}>
          <Legend />
        </div>
      </div>
      {byRank.map((p, i) => {
        const a = prog(frame, 6 + i * 4, 14);
        return (
          <div key={p.playerNo} style={{ position: "absolute", left: SAFE.left, top: 520 + i * 160, width: 960, ...rise(a, 30) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                <span style={text(40, 900, p.team.color)}>{p.rank}</span>
                <span style={text(42, 800)}>{p.name}</span>
                <span style={text(26, 600, C.ink2)}>{p.team.name}</span>
              </span>
              <span style={text(32, 800, C.ink2)}>{p.ppg}점</span>
            </div>
            <SourceBar sources={p.sources} height={50} grow={a} />
            <div style={{ position: "relative", height: 34, marginTop: 6 }}>
              {labelPositions(p.sources, 960).map((l) =>
                l.share >= 9 ? (
                  <span
                    key={l.key}
                    style={{
                      position: "absolute",
                      left: l.x,
                      transform: "translateX(-50%)",
                      ...text(24, best[l.key] === p.playerNo ? 900 : 600, best[l.key] === p.playerNo ? C.ink : C.ink2),
                    }}
                  >
                    {l.share.toFixed(0)}%
                  </span>
                ) : null,
              )}
            </div>
          </div>
        );
      })}
      <Caption scene={scene} />
      <Credits />
    </AbsoluteFill>
  );
}

function share(p: EpisodePlayer, k: string) {
  return p.sources.find((s) => s.key === k)!.share;
}
function labelPositions(sources: ScoringSource[], width: number) {
  const gap = 3;
  const usable = width - gap * (sources.length - 1);
  let x = 0;
  return sources.map((s) => {
    const w = (usable * s.share) / 100;
    const center = x + w / 2;
    x += w + gap;
    return { key: s.key, share: s.share, x: center };
  });
}

function OutroScene({ props, scene }: { props: EpisodeProps; scene: EpisodeScene }) {
  const frame = useCurrentFrame();
  const byRank = [...props.players].sort((a, b) => a.rank - b.rank);
  return (
    <AbsoluteFill>
      <Masthead season={props.seasonLabel} section="득점 특집" />
      <div style={{ position: "absolute", left: SAFE.left, top: 270, right: W_PAD, ...rise(prog(frame, 0, 10)) }}>
        <div style={text(96, 900)}>여러분 팀 에이스는</div>
        <div style={text(96, 900)}>어떤 유형인가요?</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: W_PAD, top: 560 }}>
        {byRank.map((p, i) => (
          <div
            key={p.playerNo}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: "18px 0",
              borderTop: `1.5px solid ${C.rule}`,
              ...rise(prog(frame, 4 + i * 3, 10), 24),
            }}
          >
            <span style={{ width: 44, ...text(40, 900, p.team.color) }}>{p.rank}</span>
            <span style={{ width: 200, ...text(40, 800) }}>{p.name}</span>
            <span style={text(34, 700, C.ink2)}>{p.callout.headline}</span>
          </div>
        ))}
        <div style={{ height: 1.5, background: C.rule }} />
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: W_PAD, top: 1150, ...rise(prog(frame, 18, 10)) }}>
        <div style={text(48, 900)}>댓글로 알려주세요</div>
        <div style={text(28, 600, C.ink2, { marginTop: 12 })}>선수별 기록 전체 · kbl-stats-reference.vercel.app</div>
      </div>
      <Caption scene={scene} />
      <Credits />
    </AbsoluteFill>
  );
}

// ─────────────────────────────────────────────
// 전체
// ─────────────────────────────────────────────

const SCENE: Record<EpisodeScene["kind"], (x: { props: EpisodeProps; scene: EpisodeScene }) => ReactNode> = {
  cover: CoverScene,
  player: PlayerScene,
  compare: CompareScene,
  outro: OutroScene,
};

export function TopScorers(props: EpisodeProps) {
  useFont();
  const { durationInFrames } = useVideoConfig();
  let from = 0;
  return (
    <AbsoluteFill style={{ background: C.paper, fontFamily: FONT }}>
      {props.narration ? <Audio src={staticFile(props.narration)} /> : null}
      {props.bgm ? (
        // 배경음악: 목소리 밑에 작게 깔고(0.14), 처음 0.3초 올라오고 마지막 1.2초 사라진다
        <Audio
          src={staticFile(props.bgm)}
          loop
          volume={(f) =>
            0.14 *
            interpolate(f, [0, 9, durationInFrames - 36, durationInFrames], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      ) : null}
      {props.scenes.map((scene) => {
        const dur = Math.round(scene.seconds * FPS);
        const start = from;
        from += dur;
        const Comp = SCENE[scene.kind];
        return (
          <Sequence key={scene.id} from={start} durationInFrames={dur} name={scene.id}>
            <Comp props={props} scene={scene} />
            {scene.audio ? <Audio src={staticFile(scene.audio)} /> : null}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
