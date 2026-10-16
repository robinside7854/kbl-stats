// 포맷 D — "순위표가 뒤집혔다" (2026-10-16 사용자: 삼성 + LG 한 편, 전광판 디자인)
// 포맷 B(Milestones)의 전광판 틀(검정 + 형광 노랑, 흐르는 띠, 외곽선 자막)을 그대로 쓰고,
// 장면마다 순위판·전광판 숫자·맞대결 점수판·전후 비교 막대를 그린다. 숫자·문장은 전부 props(scripts/build-short-flip.ts)에서 온다.

import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { FONT, FPS, SAFE, onDark } from "./theme";
import { prog, rise, text, useFont } from "./TopScorers";
import { Chip, Frame, K, PhotoPanel } from "./Milestones";
import type { EpisodeScene } from "./types";

const RED = "#FF4D4D";
const FOOTER = "기록 KBL 공식 홈페이지 · 정규리그 · 사진 © KBL 및 각 구단 · 비영리 팬 채널";
const PREFIX = "KBL STANDINGS FLIP";

interface FTeam {
  code: string;
  name: string;
  color: string;
  secondary: string;
  prevRank: number;
  prevW: number;
  prevL: number;
  nowRank: number;
  nowTied: boolean;
  nowW: number;
  nowL: number;
  results: ("W" | "L")[];
}
interface FPlayer {
  role: "upStar" | "downSlump" | "downBright" | "star";
  playerNo: string;
  name: string;
  team: { code: string; name: string; color: string; secondary: string; logoFile?: string | null };
  photoFile: string | null;
  prevPpg: number;
  nowPpg: number;
  prevMpg: number;
  nowMpg: number;
  prevTs: number | null;
  nowTs: number | null;
  riseRank: number | null;
  games: number;
}
type FScene = EpisodeScene & { teamCode?: string };
export interface FlipProps {
  seasonLabel: string;
  prevLabel: string;
  asOf: string;
  teams: { up: FTeam; down: FTeam };
  game: { meeting: number; date: string; upScore: number; downScore: number; star: { name: string; pts: number; up: boolean; playerNo: string; fg: string } } | null;
  players: FPlayer[];
  scenes: FScene[];
  narration?: string | null;
  bgm?: string | null;
  [key: string]: unknown;
}

/** 전광판 숫자 — 노란 글자 + 은은한 번짐 */
const led = (size: number, color = K.yellow, extra: CSSProperties = {}): CSSProperties =>
  text(size, 900, color, { lineHeight: 0.9, letterSpacing: -size * 0.04, fontVariantNumeric: "tabular-nums", textShadow: `0 0 ${Math.round(size / 8)}px ${color}66`, ...extra });

/** 팀 로고 — 선수 사진을 받을 때 같이 받은 파일 */
function Logo({ props, code, size }: { props: FlipProps; code: string; size: number }) {
  const file = props.players.find((p) => p.team.code === code)?.team.logoFile;
  const t = code === props.teams.up.code ? props.teams.up : props.teams.down;
  if (!file) return <div style={{ width: size, height: size, borderRadius: 12, background: onDark(t.color), ...text(size * 0.32, 900, "#fff", { display: "flex", alignItems: "center", justifyContent: "center" }) }}>{t.name}</div>;
  return (
    <div style={{ width: size, height: size, borderRadius: 16, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Img src={staticFile(file)} style={{ width: size * 0.78, height: size * 0.78, objectFit: "contain" }} />
    </div>
  );
}

const rankText = (t: FTeam) => `${t.nowRank}`;

/** 표지 — 작년 순위 → 지금 순위 전광판. 지금 순위 숫자는 슬롯처럼 굴러가다 멈춘다 */
function Cover({ props, scene }: { props: FlipProps; scene: FScene }) {
  const f = useCurrentFrame();
  const rows = [props.teams.up, props.teams.down];
  return (
    <Frame label={`${props.seasonLabel} 시즌 초반`} scene={scene} prefix={PREFIX} footer={FOOTER}>
      <div style={{ position: "absolute", left: SAFE.left, top: 230, ...rise(prog(f, 0, 10)) }}>
        <div style={text(44, 800, K.dim)}>작년 순위 vs 지금 순위</div>
        <div style={text(104, 900, K.white, { lineHeight: 1.05, marginTop: 6 })}>
          순위표가
          <br />
          <span style={{ color: K.yellow }}>뒤집혔다</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 600, background: K.panel, border: `3px solid ${K.line}`, borderRadius: 18, padding: "26px 34px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 14, borderBottom: `2px solid ${K.line}`, ...text(30, 800, K.dim) }}>
          <span>팀</span>
          <span style={{ display: "flex", gap: 70 }}>
            <span>{props.prevLabel}</span>
            <span style={{ width: 150, textAlign: "right" }}>{props.seasonLabel}</span>
          </span>
        </div>
        {rows.map((t, i) => {
          const start = 10 + i * 8;
          const spin = prog(f, start, 22);
          // 굴러가는 숫자: 멈추기 전에는 1~10 을 돈다
          const shown = spin < 1 ? ((Math.floor(f / 2) + i * 3) % 10) + 1 : t.nowRank;
          const up = t.nowRank < t.prevRank;
          return (
            <div key={t.code} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "30px 0", borderBottom: i === 0 ? `2px solid ${K.line}` : "none", ...rise(prog(f, 4 + i * 6, 10), 30) }}>
              <span style={{ display: "flex", alignItems: "center", gap: 22 }}>
                <Logo props={props} code={t.code} size={110} />
                <span style={text(64, 900, K.white)}>{t.name}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 26 }}>
                <span style={led(110, K.dim, { textShadow: "none" })}>{t.prevRank}</span>
                <span style={text(56, 900, up ? K.yellow : RED)}>{up ? "▲" : "▼"}</span>
                <span style={{ width: 150, textAlign: "right", ...led(150, up ? K.yellow : RED) }}>{shown}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: SAFE.left, top: 1150, ...rise(prog(f, 34, 10)), ...text(30, 700, K.dim) }}>
        {props.asOf.replace(/-/g, ".")} 경기까지
      </div>
    </Frame>
  );
}

/** 승패 칸 — 이기면 노랑, 지면 빈 칸 */
function ResultCells({ results, appear }: { results: ("W" | "L")[]; appear: number }) {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      {results.map((r, i) => {
        const on = i < results.length * appear;
        return (
          <div
            key={i}
            style={{
              width: 116,
              height: 116,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: on && r === "W" ? K.yellow : K.panel,
              border: `3px solid ${on ? (r === "W" ? K.yellow : RED) : K.line}`,
              opacity: on ? 1 : 0.35,
              ...text(54, 900, r === "W" ? K.bg : RED),
            }}
          >
            {on ? (r === "W" ? "승" : "패") : ""}
          </div>
        );
      })}
    </div>
  );
}

/** 팀 장면 — 작년 성적(흐리게, 줄 긋기) → 올해 성적(크게), 경기별 승패 칸 */
function TeamScene({ props, scene }: { props: FlipProps; scene: FScene }) {
  const f = useCurrentFrame();
  const t = scene.teamCode === props.teams.down.code ? props.teams.down : props.teams.up;
  const up = t === props.teams.up;
  const hot = up ? K.yellow : RED;
  const pop = interpolate(prog(f, 12, 10), [0, 0.6, 1], [0.4, 1.12, 1]);
  const strike = prog(f, 8, 8);
  return (
    <Frame label={`${t.name} ${up ? "돌풍" : "주춤"}`} scene={scene} prefix={PREFIX} footer={FOOTER}>
      <div style={{ position: "absolute", left: SAFE.left, top: 230, display: "flex", alignItems: "center", gap: 28, ...rise(prog(f, 0, 10)) }}>
        <Logo props={props} code={t.code} size={150} />
        <div>
          <div style={text(96, 900, K.white, { lineHeight: 1 })}>{t.name}</div>
          <div style={{ marginTop: 12, display: "inline-block", background: hot, borderRadius: 8, padding: "4px 16px", ...text(34, 900, K.bg) }}>
            지금 {t.nowTied ? "공동 " : ""}
            {rankText(t)}위
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, top: 470, ...rise(prog(f, 4, 10)) }}>
        <div style={text(34, 800, K.dim)}>작년 {props.prevLabel} · {t.prevRank}위</div>
        <div style={{ position: "relative", display: "inline-block", marginTop: 6 }}>
          <span style={led(150, K.dim, { textShadow: "none" })}>
            {t.prevW}-{t.prevL}
          </span>
          <div style={{ position: "absolute", left: -6, top: "48%", height: 10, width: `${strike * 104}%`, background: hot, borderRadius: 5 }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, top: 720 }}>
        <div style={{ ...text(34, 800, K.dim), ...rise(prog(f, 10, 10)) }}>올해 {props.seasonLabel}</div>
        <span style={{ display: "inline-block", transform: `scale(${pop})`, transformOrigin: "left bottom", ...led(300, hot) }}>
          {t.nowW}-{t.nowL}
        </span>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, top: 1070 }}>
        <div style={{ ...text(30, 800, K.dim, { marginBottom: 14 }) }}>경기별</div>
        <ResultCells results={t.results} appear={prog(f, 22, 20)} />
      </div>
    </Frame>
  );
}

/** 전후 비교 막대 한 줄 — 작년(회색)·올해(노랑/빨강) */
function CompareRow({ label, unit, prev, now, max, hot, appear }: { label: string; unit: string; prev: number; now: number; max: number; hot: string; appear: number }) {
  // 득점은 소수 한 자리(17 → 17.0), 분·%는 정수
  const fmt = (v: number) => (unit ? String(v) : v.toFixed(1));
  const w = 660;
  const bar = (v: number, color: string, txt: string, solid: boolean) => (
    <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 10 }}>
      <div style={{ width: w, height: 54, background: K.panel, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(1, v / max) * 100 * appear}%`, height: "100%", background: solid ? color : "transparent", border: solid ? "none" : `3px solid ${color}`, borderRadius: 8, boxSizing: "border-box" }} />
      </div>
      <span style={led(58, solid ? color : K.dim, solid ? {} : { textShadow: "none" })}>{txt}</span>
    </div>
  );
  return (
    <div>
      <div style={text(34, 800, K.white)}>{label}</div>
      {bar(prev, K.dim, `${fmt(prev)}${unit}`, false)}
      {bar(now, hot, `${fmt(now)}${unit}`, true)}
    </div>
  );
}

function PlayerScene({ props, scene }: { props: FlipProps; scene: FScene }) {
  const f = useCurrentFrame();
  const p = props.players.find((x) => x.playerNo === scene.playerNo)!;
  const rising = p.nowPpg >= p.prevPpg;
  const hot = rising ? K.yellow : RED;
  const diff = Math.round((p.nowPpg - p.prevPpg) * 10) / 10;
  const rows: { label: string; unit: string; prev: number; now: number; max: number }[] = [
    { label: "경기당 득점", unit: "", prev: p.prevPpg, now: p.nowPpg, max: Math.max(p.prevPpg, p.nowPpg) * 1.1 },
    p.role === "upStar"
      ? { label: "경기당 출전", unit: "분", prev: Math.round(p.prevMpg), now: Math.round(p.nowMpg), max: 40 }
      : { label: "슛 효율 (TS%)", unit: "%", prev: Math.round(p.prevTs ?? 0), now: Math.round(p.nowTs ?? 0), max: 75 },
  ];
  return (
    <Frame label={`${p.team.name} ${p.name}`} scene={scene} prefix={PREFIX} footer={FOOTER}>
      <div style={{ position: "absolute", left: SAFE.left, top: 230, ...rise(prog(f, 0, 10), 60) }}>
        <PhotoPanel p={p} w={400} h={500} />
      </div>
      <div style={{ position: "absolute", left: 500, right: 1080 - SAFE.right, top: 240, ...rise(prog(f, 3, 10)) }}>
        <div style={{ display: "inline-block", background: onDark(p.team.color), borderRadius: 6, padding: "4px 14px", ...text(30, 900, "#fff") }}>{p.team.name}</div>
        <div style={text(78, 900, K.white, { marginTop: 14, lineHeight: 1.05 })}>{p.name}</div>
        <div style={text(30, 700, K.dim, { marginTop: 22 })}>경기당 득점 변화</div>
        <div style={{ ...led(150, hot), marginTop: 8, ...rise(prog(f, 10, 10)) }}>
          {diff > 0 ? "+" : ""}
          {diff}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24, ...rise(prog(f, 16, 10)) }}>
          {p.role === "downBright" && p.riseRank === 1 ? <Chip hot>리그 득점 상승 1위</Chip> : null}
          {p.role === "upStar" && props.game?.star.playerNo === p.playerNo ? <Chip hot>{props.teams.down.name}전 {props.game.star.pts}점</Chip> : null}
          <Chip>올해 {p.games}경기</Chip>
        </div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 790, display: "flex", flexDirection: "column", gap: 34 }}>
        {rows.map((r, i) => (
          <div key={r.label} style={rise(prog(f, 14 + i * 6, 10), 30)}>
            <CompareRow {...r} hot={hot} appear={prog(f, 16 + i * 6, 18)} />
          </div>
        ))}
        <div style={{ display: "flex", gap: 28, ...text(26, 700, K.dim), ...rise(prog(f, 26, 10)) }}>
          <span>빈 막대 = 작년 {props.prevLabel}</span>
          <span>찬 막대 = 올해 {props.seasonLabel}</span>
        </div>
      </div>
    </Frame>
  );
}

/** 맞대결 점수판 */
function ClashScene({ props, scene }: { props: FlipProps; scene: FScene }) {
  const f = useCurrentFrame();
  const g = props.game!;
  const { up, down } = props.teams;
  const star = props.players.find((p) => p.playerNo === g.star.playerNo);
  // 점수는 0 에서 올라간다
  const c = prog(f, 6, 26);
  const side = (t: FTeam, score: number, win: boolean) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: 380 }}>
      <Logo props={props} code={t.code} size={150} />
      <span style={text(54, 900, K.white)}>{t.name}</span>
      <span style={led(200, win ? K.yellow : K.dim, win ? {} : { textShadow: "none" })}>{Math.round(score * c)}</span>
    </div>
  );
  return (
    <Frame label={`${up.name} vs ${down.name}`} scene={scene} prefix={PREFIX} footer={FOOTER}>
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 220, textAlign: "center", ...rise(prog(f, 0, 10)) }}>
        <span style={{ display: "inline-block", background: K.yellow, borderRadius: 8, padding: "6px 22px", ...text(36, 900, K.bg) }}>
          올 시즌 {g.meeting === 1 ? "첫" : `${g.meeting}번째`} 맞대결 · FINAL
        </span>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 330, display: "flex", justifyContent: "space-between", alignItems: "flex-end", background: K.panel, border: `3px solid ${K.line}`, borderRadius: 18, padding: "34px 10px", ...rise(prog(f, 2, 10)) }}>
        {side(up, g.upScore, g.upScore > g.downScore)}
        <span style={{ paddingBottom: 70, ...text(80, 900, K.dim) }}>:</span>
        {side(down, g.downScore, g.downScore > g.upScore)}
      </div>
      {star ? (
        <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 900, display: "flex", alignItems: "center", gap: 34, ...rise(prog(f, 30, 12), 40) }}>
          <PhotoPanel p={star} w={250} h={300} />
          <div>
            <div style={text(34, 800, K.dim)}>
              {star.team.name} {star.name}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
              <span style={led(190)}>{g.star.pts}</span>
              <span style={{ paddingBottom: 18, ...text(60, 900, K.white) }}>점</span>
            </div>
            <div style={text(32, 800, K.white)}>야투 {g.star.fg}</div>
          </div>
        </div>
      ) : null}
    </Frame>
  );
}

function Outro({ props, scene }: { props: FlipProps; scene: FScene }) {
  const f = useCurrentFrame();
  const { up, down } = props.teams;
  const card = (t: FTeam, q: string, color: string, i: number) => (
    <div style={{ display: "flex", alignItems: "center", gap: 26, background: K.panel, border: `3px solid ${color}`, borderRadius: 18, padding: "28px 30px", ...rise(prog(f, 6 + i * 6, 10), 40) }}>
      <Logo props={props} code={t.code} size={120} />
      <div>
        <div style={text(60, 900, K.white)}>{q}</div>
        <div style={text(30, 700, K.dim, { marginTop: 6 })}>
          지금 {t.nowW}승 {t.nowL}패 · 작년 {t.prevRank}위
        </div>
      </div>
    </div>
  );
  return (
    <Frame label="댓글로 예상 ㄱㄱ" scene={scene} prefix={PREFIX} footer={FOOTER}>
      <div style={{ position: "absolute", left: SAFE.left, top: 240, ...rise(prog(f, 0, 10)) }}>
        <div style={text(92, 900, K.white, { lineHeight: 1.1 })}>이 흐름,</div>
        <div style={text(92, 900, K.yellow, { lineHeight: 1.1 })}>계속 갈까?</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: 1080 - SAFE.right, top: 560, display: "flex", flexDirection: "column", gap: 30 }}>
        {card(up, `${up.name} 돌풍 계속`, K.yellow, 0)}
        {card(down, `${down.name} 반등`, RED, 1)}
      </div>
    </Frame>
  );
}

export function Flip(props: FlipProps) {
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
        const body: ReactNode =
          scene.kind === "cover" ? (
            <Cover props={props} scene={scene} />
          ) : scene.kind === "team" ? (
            <TeamScene props={props} scene={scene} />
          ) : scene.kind === "clash" ? (
            <ClashScene props={props} scene={scene} />
          ) : scene.kind === "outro" ? (
            <Outro props={props} scene={scene} />
          ) : (
            <PlayerScene props={props} scene={scene} />
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
