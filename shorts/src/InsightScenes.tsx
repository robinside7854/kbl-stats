// 선수별 인사이트 장면 — 다섯 명이 같은 틀로 흘러가지 않게 특징마다 다른 화면 (2026-10-02 사용자 요청)
// shotmap: 슛 지도에서 그 출처 구역에 불 켜기 · split: 안/밖 저울 · lineup: 다섯 명 포지션 줄에서 혼자 다른 선수
// ladder: 한 출처 점수만으로 국내 선수 분포를 넘는 사다리 · counter: 자유투 계수기 + 국내 순위 막대
// 숫자는 전부 props(insight) 에서 온다 — 이 파일은 그리기만 한다.

import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, SAFE, SOURCE_COLOR, onDark } from "./theme";
import type { CourtZone, EpisodePlayer, EpisodeProps, EpisodeScene, Insight, ShotTuple, SourceKey } from "./types";
import { Caption, CountUp, Credits, Glow, Masthead, Photo, TeamMark, W_PAD, prog, rise, text } from "./TopScorers";

type SceneProps = { props: EpisodeProps; scene: EpisodeScene; p: EpisodePlayer };
type Of<L extends Insight["layout"]> = Extract<Insight, { layout: L }>;

/** 득점 출처 → 슛 차트 구역 (페인트 = 골밑 + 페인트) */
const ZONES_OF: Record<SourceKey, CourtZone["key"][]> = {
  paint: ["rim", "paint"],
  mid: ["mid"],
  three: ["corner3", "arc3"],
  ft: [],
};
const SOURCE_INDEX: Record<SourceKey, number> = { paint: 0, mid: 1, three: 2, ft: -1 };

/** 하프코트 (바스켓이 위). 강조 출처 구역을 칠하고 그 구역 성공 슛만 팀 색으로 크게 */
function Court({
  p,
  court,
  width,
  dots,
  zoneFill,
  focus,
  colors,
}: {
  p: EpisodePlayer;
  court: EpisodeProps["court"];
  width: number;
  /** 0 → 1 점이 나타나는 정도 */
  dots: number;
  /** 0 → 1 구역 색 진하기 */
  zoneFill: number;
  focus: SourceKey[];
  /** 출처별 색 (없으면 팀 색) */
  colors?: Partial<Record<SourceKey, string>>;
}) {
  const vb = "-7.6 -1.7 15.2 10.6";
  const height = (width * 10.6) / 15.2;
  const colorOf = (k: SourceKey) => colors?.[k] ?? p.team.color;
  const focusIdx = new Map(focus.map((k) => [SOURCE_INDEX[k], k]));
  const n = (arr: unknown[]) => Math.floor(arr.length * dots);
  const dot = (s: ShotTuple, i: number, made: boolean) => {
    const k = focusIdx.get(s[3]);
    if (!made) return <circle key={`m${i}`} cx={s[1]} cy={s[0]} r={0.1} fill={C.ink3} opacity={0.4} />;
    return k ? (
      <circle key={`o${i}`} cx={s[1]} cy={s[0]} r={0.17} fill={colorOf(k)} stroke={C.paper} strokeWidth={0.03} />
    ) : (
      <circle key={`o${i}`} cx={s[1]} cy={s[0]} r={0.12} fill={C.ink3} opacity={0.7} />
    );
  };
  return (
    <svg width={width} height={height} viewBox={vb} style={{ display: "block" }}>
      <defs>
        {court.zones.map((z, i) => (z.clip ? <clipPath key={i} id={`zclip-${z.key}`}><path d={z.clip} /></clipPath> : null))}
      </defs>
      {focus.flatMap((k) =>
        court.zones
          .filter((z) => ZONES_OF[k].includes(z.key))
          .map((z) => (
            <g key={`${k}-${z.key}`} clipPath={z.clip ? `url(#zclip-${z.key})` : undefined}>
              {z.paths.map((d, i) => (
                <path key={i} d={d} fill={colorOf(k)} fillRule={z.evenOdd ? "evenodd" : "nonzero"} opacity={0.17 * zoneFill} />
              ))}
            </g>
          )),
      )}
      <g fill="none" stroke={C.ink2} strokeWidth={0.06}>
        {court.lines.map((d, i) => (
          <path key={i} d={d} />
        ))}
        <circle cx={court.rim.cx} cy={court.rim.cy} r={court.rim.r} />
      </g>
      {p.shots.missed.slice(0, n(p.shots.missed)).map((s, i) => dot(s, i, false))}
      {p.shots.made.slice(0, n(p.shots.made)).map((s, i) => dot(s, i, true))}
    </svg>
  );
}

/** 이름 줄 — "5위" 작은 순위 + 팀 로고 + 큰 이름 + 소속 한 줄 */
function NameBlock({ p, size = 104, color = C.ink, sub = C.ink2 }: { p: EpisodePlayer; size?: number; color?: string; sub?: string }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={text(36, 900, color === C.ink ? onDark(p.team.color) : color)}>{p.rank}위</span>
        <TeamMark p={p} size={40} />
      </div>
      <div style={text(size, 900, color, { marginTop: 2 })}>{p.name}</div>
      <div style={text(28, 600, sub, { marginTop: 6 })}>{[p.team.name, p.position, `경기당 ${p.ppg}점`].filter(Boolean).join(" · ")}</div>
    </div>
  );
}

function Frame({ props, scene, p, children }: SceneProps & { children: ReactNode }) {
  return (
    <AbsoluteFill>
      <Glow color={p.team.color} />
      <Masthead season={props.seasonLabel} section={`${p.rank}위`} />
      {children}
      <Caption scene={scene} />
      <Credits />
    </AbsoluteFill>
  );
}

const pct0 = (v: number) => `${Math.round(v)}%`;

// ─────────────────────────────────────────────
// 1) 슛 지도 — "득점 절반이 3점" 을 지도에 불 켜서
// ─────────────────────────────────────────────
function ShotmapScene({ props, scene, p }: SceneProps) {
  const f = useCurrentFrame();
  const ins = p.insight as Of<"shotmap">;
  const label = { paint: "페인트", mid: "미드레인지", three: "3점", ft: "자유투" }[ins.focus];
  const jumper = ins.tpPctTop != null && !!ins.midTop;
  return (
    <Frame props={props} scene={scene} p={p}>
      <div style={{ position: "absolute", left: SAFE.left, top: 210, display: "flex", gap: 32, alignItems: "center", ...rise(prog(f, 0, 10)) }}>
        <Photo p={p} width={200} height={200} style={{ borderRadius: 100 }} />
        <NameBlock p={p} />
      </div>
      {/* 점퍼(3점 정확도 + 미드레인지) 장인이면 3점·미드 두 구역을 같이 켠다 */}
      {jumper ? (
        <div style={{ position: "absolute", left: SAFE.left, top: 440, ...rise(prog(f, 4, 12), 30) }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, ...rise(prog(f, 6, 10)) }}>
            <span style={{ background: C.accent, borderRadius: 8, padding: "6px 16px", ...text(30, 900, "#fff") }}>점퍼 장인</span>
          </div>
          <Court
            p={p}
            court={props.court}
            width={860}
            dots={prog(f, 6, 30)}
            zoneFill={prog(f, 26, 14)}
            focus={["three", "mid"]}
            colors={{ three: SOURCE_COLOR.three, mid: SOURCE_COLOR.mid }}
          />
        </div>
      ) : (
        <div style={{ position: "absolute", left: SAFE.left, top: 450, ...rise(prog(f, 4, 12), 30) }}>
          <Court p={p} court={props.court} width={960} dots={prog(f, 6, 30)} zoneFill={prog(f, 26, 14)} focus={[ins.focus]} colors={{ [ins.focus]: SOURCE_COLOR[ins.focus] }} />
        </div>
      )}
      {jumper ? (
        <div style={{ position: "absolute", left: SAFE.left, right: W_PAD, top: 1110, display: "flex", gap: 70 }}>
          {[
            { label: "3점 성공률", value: ins.tpPctTop!, color: SOURCE_COLOR.three, at: 24 },
            { label: "슛 중 미드레인지", value: ins.midTop!.share, color: SOURCE_COLOR.mid, at: 40 },
          ].map((b) => (
            <div key={b.label} style={rise(prog(f, b.at, 12))}>
              <div style={text(30, 700, C.ink2)}>{b.label}</div>
              <div style={text(96, 900, b.color, { lineHeight: 1.05 })}>
                <CountUp value={b.value} p={prog(f, b.at, 18)} />%
              </div>
              <div style={text(28, 800, C.ink)}>5명 중 1위</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ position: "absolute", left: SAFE.left, right: W_PAD, top: 1128, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={rise(prog(f, 24, 12))}>
            <div style={text(30, 700, C.ink2)}>득점 중 {label}</div>
            <div style={text(150, 900, SOURCE_COLOR[ins.focus], { lineHeight: 1 })}>
              <CountUp value={ins.share} p={prog(f, 24, 18)} decimals={0} />%
            </div>
          </div>
          {ins.lowFtShare !== null ? (
            <div style={{ background: C.ink, borderRadius: 8, padding: "16px 22px", marginBottom: 10, ...rise(prog(f, 44, 10)) }}>
              <div style={text(24, 600, C.paper2)}>자유투 비중</div>
              <div style={text(48, 900, C.paper)}>{pct0(ins.lowFtShare)} · 5명 중 최저</div>
            </div>
          ) : null}
        </div>
      )}
    </Frame>
  );
}

// ─────────────────────────────────────────────
// 2) 저울 — 안과 밖이 거의 같다
// ─────────────────────────────────────────────
function SplitScene({ props, scene, p }: SceneProps) {
  const f = useCurrentFrame();
  const ins = p.insight as Of<"split">;
  const isInOut = new Set([ins.a.key, ins.b.key]).has("paint") && new Set([ins.a.key, ins.b.key]).has("three");
  const [left, right] = isInOut ? (ins.a.key === "paint" ? [ins.a, ins.b] : [ins.b, ins.a]) : [ins.a, ins.b];
  const nameOf = (k: SourceKey, fallback: string) => (isInOut ? (k === "paint" ? "안" : "밖") : fallback);
  // 기운 저울이 거의 수평으로 — 차이 1%p 당 0.6도
  const finalTilt = (right.share - left.share) * 0.6;
  const tilt = -14 + (finalTilt + 14) * prog(f, 26, 24);
  const beam = 820;
  return (
    <Frame props={props} scene={scene} p={p}>
      <div style={{ position: "absolute", left: SAFE.left, top: 206, ...rise(prog(f, 0, 12), 40) }}>
        <Photo p={p} width={960} height={420} style={{ borderRadius: 10 }} />
        <div style={{ position: "absolute", left: 34, bottom: 26 }}>
          <NameBlock p={p} size={96} color="#fff" sub="rgba(255,255,255,0.85)" />
        </div>
      </div>
      {[left, right].map((s, i) => (
        <div
          key={s.key}
          style={{ position: "absolute", top: 680, width: 470, left: SAFE.left + i * 490, textAlign: i === 0 ? "left" : "right", ...rise(prog(f, 8 + i * 6, 12)) }}
        >
          <div style={text(40, 800, C.ink2)}>
            {nameOf(s.key, s.label)} <span style={text(28, 600, C.ink3)}>{isInOut ? s.label : ""}</span>
          </div>
          <div style={text(170, 900, SOURCE_COLOR[s.key], { lineHeight: 1 })}>
            <CountUp value={s.share} p={prog(f, 8 + i * 6, 18)} decimals={0} />%
          </div>
        </div>
      ))}
      {/* 저울 */}
      <div style={{ position: "absolute", left: (1080 - beam) / 2, top: 960, width: beam, height: 260 }}>
        <div style={{ position: "absolute", left: 0, top: 60, width: beam, transform: `rotate(${tilt}deg)`, transformOrigin: "50% 50%" }}>
          <div style={{ height: 12, background: C.ink, borderRadius: 6 }} />
          {[left, right].map((s, i) => {
            const r = 34 + s.share * 0.9;
            return (
              <div
                key={s.key}
                style={{
                  position: "absolute",
                  top: -r * 2 + 2,
                  left: i === 0 ? 30 : beam - 30 - r * 2,
                  width: r * 2,
                  height: r * 2,
                  borderRadius: r,
                  background: SOURCE_COLOR[s.key],
                }}
              />
            );
          })}
        </div>
        <div
          style={{
            position: "absolute",
            left: beam / 2 - 46,
            top: 72,
            width: 0,
            height: 0,
            borderLeft: "46px solid transparent",
            borderRight: "46px solid transparent",
            borderBottom: `90px solid ${C.ink}`,
          }}
        />
        <div style={{ position: "absolute", left: beam / 2 - 160, top: 162, width: 320, height: 8, background: C.ink, borderRadius: 4 }} />
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: W_PAD, top: 1214, textAlign: "center", ...rise(prog(f, 48, 12)) }}>
        <span style={text(56, 900)}>어딜 막아도 지옥의 이지선다</span>
      </div>
    </Frame>
  );
}

// ─────────────────────────────────────────────
// 3) 포지션 줄 — 다섯 명 중 혼자 다른 포지션
// ─────────────────────────────────────────────
function LineupScene({ props, scene, p }: SceneProps) {
  const f = useCurrentFrame();
  const ins = p.insight as Of<"lineup">;
  const byRank = [...props.players].sort((a, b) => a.rank - b.rank);
  const dim = prog(f, 16, 12);
  const cardW = 178;
  return (
    <Frame props={props} scene={scene} p={p}>
      <div style={{ position: "absolute", left: SAFE.left, top: 206, ...rise(prog(f, 0, 10)) }}>
        <div style={text(34, 800, C.ink2)}>득점 TOP 5 포지션</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, top: 270, display: "flex", gap: 17 }}>
        {byRank.map((q, i) => {
          const me = i === ins.me;
          const a = prog(f, 2 + i * 2, 10);
          return (
            <div
              key={q.playerNo}
              style={{
                width: cardW,
                opacity: a * (me ? 1 : 1 - 0.65 * dim),
                transform: `translateY(${(1 - a) * 40 - (me ? 18 * dim : 0)}px) scale(${me ? 1 + 0.1 * dim : 1})`,
                filter: me ? "none" : `grayscale(${dim})`,
              }}
            >
              <Photo p={q} width={cardW} height={230} style={{ borderRadius: 6, outline: me ? `6px solid ${q.team.color}` : "none", outlineOffset: -1 }} />
              <div style={text(30, 900, me ? onDark(q.team.color) : C.ink2, { textAlign: "center", marginTop: 12 })}>{ins.positions[i] ?? "–"}</div>
              <div style={text(24, 600, C.ink3, { textAlign: "center" })}>{q.name}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: W_PAD, top: 640, ...rise(prog(f, 22, 10)) }}>
        <div style={{ display: "inline-block", background: p.team.color, borderRadius: 8, padding: "10px 22px", ...text(40, 900, "#fff") }}>
          유일한 {ins.only}
        </div>
        <div style={text(96, 900, C.ink, { marginTop: 14 })}>{p.name}</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, top: 860, ...rise(prog(f, 30, 12), 30) }}>
        <Court p={p} court={props.court} width={560} dots={prog(f, 32, 24)} zoneFill={prog(f, 40, 12)} focus={[ins.focus]} colors={{ [ins.focus]: SOURCE_COLOR[ins.focus] }} />
      </div>
      <div style={{ position: "absolute", left: 660, right: W_PAD, top: 900, ...rise(prog(f, 40, 12)) }}>
        <div style={text(32, 700, C.ink2)}>득점 중 페인트</div>
        <div style={text(130, 900, SOURCE_COLOR[ins.focus], { lineHeight: 1 })}>
          <CountUp value={ins.share} p={prog(f, 40, 18)} decimals={0} />%
        </div>
        <div style={text(28, 700, C.ink, { marginTop: 10 })}>다섯 명 중 1위</div>
      </div>
    </Frame>
  );
}

// ─────────────────────────────────────────────
// 4) 사다리 — 3점 점수만으로 국내 선수 분포를 넘는다
// ─────────────────────────────────────────────
function LadderScene({ props, scene, p }: SceneProps) {
  const f = useCurrentFrame();
  const ins = p.insight as Of<"ladder">;
  const color = SOURCE_COLOR[ins.focus];
  const maxX = Math.ceil(Math.max(...ins.ppgs, ins.value) / 5) * 5;
  const width = 960;
  const xOf = (v: number) => (v / maxX) * width;
  // 1점 칸 히스토그램 — 점을 쌓는다
  const bins = new Map<number, number>();
  const dots = ins.ppgs.map((v) => {
    const b = Math.floor(v);
    const k = bins.get(b) ?? 0;
    bins.set(b, k + 1);
    return { v, b, k };
  });
  const base = 330;
  // 가장 높은 칸이 제목에 닿지 않게 점 간격을 줄인다
  const maxCount = Math.max(1, ...bins.values());
  const step = Math.min(21, (base - 16) / maxCount);
  const r = Math.min(9, step / 2 - 0.8);
  const marker = prog(f, 30, 26);
  const mx = xOf(ins.value * marker);
  return (
    <Frame props={props} scene={scene} p={p}>
      <div style={{ position: "absolute", left: SAFE.left, top: 206, ...rise(prog(f, 0, 12), 40) }}>
        <Photo p={p} width={380} height={520} style={{ borderRadius: 10 }} />
      </div>
      <div style={{ position: "absolute", left: 470, right: W_PAD, top: 220, ...rise(prog(f, 4, 12)) }}>
        <NameBlock p={p} size={96} />
        {ins.volume ? (
          <div style={{ display: "inline-block", marginTop: 28, background: C.accent, borderRadius: 8, padding: "6px 16px", ...text(30, 900, "#fff") }}>볼륨 슈터</div>
        ) : null}
        <div style={text(36, 800, C.ink2, { marginTop: ins.volume ? 14 : 40 })}>3점으로만</div>
        <div style={text(200, 900, color, { lineHeight: 1 })}>
          <CountUp value={ins.value} p={prog(f, 8, 20)} />
        </div>
        <div style={text(32, 700, C.ink2)}>경기당 득점</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, top: 780, ...rise(prog(f, 22, 12)) }}>
        <div style={text(30, 800)}>국내 선수 {ins.total}명의 경기당 득점</div>
        <svg width={width} height={base + 50} style={{ display: "block", marginTop: 14, overflow: "visible" }}>
          {dots.map((d, i) => {
            const below = d.v < ins.value * marker;
            return (
              <circle
                key={i}
                cx={xOf(d.b + 0.5)}
                cy={base - r - d.k * step}
                r={r}
                fill={below ? color : C.ink3}
                opacity={below ? 0.9 : 0.45}
              />
            );
          })}
          <line x1={0} x2={width} y1={base + 2} y2={base + 2} stroke={C.ink} strokeWidth={2} />
          {Array.from({ length: maxX / 5 + 1 }, (_, i) => i * 5).map((t) => (
            <text key={t} x={xOf(t)} y={base + 38} textAnchor="middle" fill={C.ink2} style={text(24, 600, C.ink2)}>
              {t}점
            </text>
          ))}
          <line x1={mx} x2={mx} y1={6} y2={base + 2} stroke={onDark(p.team.color)} strokeWidth={5} />
        </svg>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: W_PAD, top: 1214, ...rise(prog(f, 50, 10)) }}>
        <span style={text(54, 900)}>
          {ins.total}명 중 {ins.beaten}명<span style={text(36, 700, C.ink2)}>은 다 합쳐도 이만큼 못 넣음</span>
        </span>
      </div>
    </Frame>
  );
}

// ─────────────────────────────────────────────
// 5) 계수기 — 자유투를 얼마나 뜯어냈나
// ─────────────────────────────────────────────
function CounterScene({ props, scene, p }: SceneProps) {
  const f = useCurrentFrame();
  const ins = p.insight as Of<"counter">;
  const max = Math.max(...ins.leaders.map((l) => l.value));
  const barMax = 620;
  return (
    <Frame props={props} scene={scene} p={p}>
      <div style={{ position: "absolute", right: 1080 - SAFE.right, top: 206, ...rise(prog(f, 0, 12), 40) }}>
        <Photo p={p} width={360} height={430} style={{ borderRadius: 10 }} />
      </div>
      <div style={{ position: "absolute", left: SAFE.left, top: 220, width: 560, ...rise(prog(f, 3, 12)) }}>
        <NameBlock p={p} size={110} />
        <div style={text(200, 900, SOURCE_COLOR.ft, { lineHeight: 1, marginTop: 40 })}>
          <CountUp value={ins.ftm} p={prog(f, 6, 30)} decimals={0} />
        </div>
        <div style={text(32, 700, C.ink2)}>시즌 자유투 성공 · 경기당 {ins.ftPerGame}점</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: W_PAD, top: 800 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", ...rise(prog(f, 20, 10)) }}>
          <span style={text(32, 800)}>경기당 자유투 시도 · 국내</span>
          {ins.ratioToNext && ins.ratioToNext >= 1.2 ? (
            <span style={{ background: C.ink, borderRadius: 8, padding: "6px 16px", ...text(30, 900, C.paper), opacity: prog(f, 56, 8) }}>
              2위의 {Math.floor(ins.ratioToNext * 10) / 10}배
            </span>
          ) : null}
        </div>
        {ins.leaders.map((l, i) => {
          const g = prog(f, 26 + i * 4, 18);
          return (
            <div key={l.name} style={{ display: "flex", alignItems: "center", marginTop: 18, opacity: prog(f, 24 + i * 4, 6) }}>
              <span style={{ width: 52, ...text(34, 900, l.me ? onDark(p.team.color) : C.ink3) }}>{i + 1}</span>
              <span style={{ width: 150, ...text(32, l.me ? 900 : 700, l.me ? C.ink : C.ink2) }}>{l.name}</span>
              <div style={{ height: 52, width: (l.value / max) * barMax * g, background: l.me ? SOURCE_COLOR.ft : C.ink3, opacity: l.me ? 1 : 0.45, borderRadius: 4 }} />
              <span style={{ marginLeft: 14, ...text(34, 800, l.me ? C.ink : C.ink2) }}>{(l.value * g).toFixed(1)}</span>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

export const INSIGHT_SCENES: Record<Exclude<Insight["layout"], "classic">, (x: SceneProps) => ReactNode> = {
  shotmap: ShotmapScene,
  split: SplitScene,
  lineup: LineupScene,
  ladder: LadderScene,
  counter: CounterScene,
};
