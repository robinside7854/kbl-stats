// 공유 미리보기 이미지 만들기 (2026-10-04 사용자 요청: 카카오톡·외부 공유 썸네일) — `npm run build` 전에 자동 실행(prebuild).
// data/processed → public/og/*.png (1200×630, git 제외). 페이지 metadata 는 lib/share ogImagePath 로 이 파일들을 가리킨다.
//   site.png(사이트) · records.png(역대 기록) · game.png(54-0) · leaders/{시즌}.png(리더보드) · player/{번호}.png(선수 1,300여 명)
// 그림은 Next 내장 next/og(satori) — 글꼴은 레포의 assets/fonts/Pretendard(OFL). 선수 사진·팀 로고는 넣지 않는다
// (빌드 때마다 KBL 서버를 1,300번 두드리지 않으려고 — 팀 색·이름·기록으로만 그린다).
// 외부 요청은 사이트 기본 이미지의 KBL 리그 로고 1건뿐(2026-10-04 사용자: 홈 썸네일에 KBL 로고) — site.json leagueLogoUrl 을
// 한 번 받아 .next/cache/og/league-logo.svg 에 두고 다음 빌드부터 재사용, 못 받으면 "KBL" 글자 배지로 대신 그린다.
// 같은 내용이면 다시 그리지 않는다: 내용 해시 → .next/cache/og/{해시}.png (Vercel 이 빌드 사이에 .next/cache 를 남겨 둔다).
import React from "react";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ImageResponse } from "next/og";
import site from "../data/codes/site.json";
import { seasonRangeLabel, seasonShortLabel } from "../lib/career.js";
import { mixHex } from "../lib/images.js";
import { isOngoingSeason, isQualified, perGame, seasonDefaultQualify } from "../lib/metrics.js";
import { OG_HEIGHT, OG_WIDTH } from "../lib/share.js";
import type { PlayerIndexEntry, SeasonData, SeasonOption } from "../lib/types.js";

const ROOT = process.cwd();
const PROCESSED = join(ROOT, "data", "processed");
const OUT = join(ROOT, "public", "og");
const CACHE = join(ROOT, ".next", "cache", "og");
/** 그림 틀을 바꾸면 올린다 (캐시를 버리게) */
const TEMPLATE_VERSION = 2;

const INK = "#111110";
/** KBL 리그 색 (리그 로고 SVG 의 남색·주황 — 2026-10-04 Actions 러너로 받은 logo-kbl.svg 의 fill 값) */
const LEAGUE_NAVY = "#011B6A";
const LEAGUE_ORANGE = "#EB6100";
const PAPER = "#F6F5F1";
const GOLD = "#E8C468";
const DOMAIN = site.siteUrl.replace(/^https?:\/\//, "");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8")) as T;
}

const fontsP = Promise.all([
  readFile(join(ROOT, "assets", "fonts", "Pretendard-Bold.otf")),
  readFile(join(ROOT, "assets", "fonts", "Pretendard-Regular.otf")),
]);

/** 리그 로고 SVG → data URI (캐시 우선, 없으면 한 번 받기). 실패하면 null */
async function leagueLogoDataUri(): Promise<string | null> {
  const cached = join(CACHE, "league-logo.svg");
  let svg: string | null = existsSync(cached) ? await readFile(cached, "utf8") : null;
  if (!svg) {
    try {
      const res = await fetch(site.leagueLogoUrl, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10_000) });
      const text = await res.text();
      if (res.ok && text.trimStart().startsWith("<svg")) {
        svg = text;
        await writeFile(cached, svg, "utf8");
      }
    } catch {
      svg = null;
    }
  }
  if (!svg) console.warn("리그 로고를 받지 못함 → 기본 이미지는 글자 배지로");
  return svg ? `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` : null;
}

let rendered = 0;
let reused = 0;
/** 내용(props)이 같으면 캐시에서 복사, 아니면 그려서 캐시에 넣고 복사 */
async function emit(file: string, props: unknown, draw: () => React.ReactElement): Promise<void> {
  const hash = createHash("sha1").update(JSON.stringify([TEMPLATE_VERSION, props])).digest("hex");
  const cached = join(CACHE, `${hash}.png`);
  const out = join(OUT, file);
  await mkdir(dirname(out), { recursive: true });
  if (existsSync(cached)) {
    reused++;
  } else {
    const [bold, regular] = await fontsP;
    const res = new ImageResponse(draw(), {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: [
        { name: "Pretendard", data: bold, weight: 700, style: "normal" },
        { name: "Pretendard", data: regular, weight: 400, style: "normal" },
      ],
    });
    await writeFile(cached, Buffer.from(await res.arrayBuffer()));
    rendered++;
  }
  await copyFile(cached, out);
}

// ─────────────────────────────────────────────
// 공통 조각
// ─────────────────────────────────────────────

/** 왼쪽 위 사이트 표시 (작은 막대 세 개 + 이름) */
function Brand({ color = "#ffffff" }: { color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, color }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 30 }}>
        <div style={{ width: 8, height: 14, background: color, opacity: 0.6, borderRadius: 2 }} />
        <div style={{ width: 8, height: 22, background: color, opacity: 0.8, borderRadius: 2 }} />
        <div style={{ width: 8, height: 30, background: color, borderRadius: 2 }} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>KBL Stats Reference</div>
    </div>
  );
}

function Frame({ bg, children, footer = true }: { bg: string; children: React.ReactNode; footer?: boolean }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: bg, fontFamily: "Pretendard", color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "44px 56px 0" }}>
        <Brand />
        {footer ? <div style={{ fontSize: 24, opacity: 0.6 }}>{DOMAIN}</div> : <div />}
      </div>
      {children}
    </div>
  );
}

function Chip({ text, gold = false }: { text: string; gold?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "8px 20px",
        borderRadius: 999,
        fontSize: 28,
        fontWeight: 700,
        background: gold ? GOLD : "rgba(255,255,255,0.14)",
        color: gold ? INK : "#fff",
      }}
    >
      {text}
    </div>
  );
}

const NF1 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NF0 = new Intl.NumberFormat("ko-KR");

// ─────────────────────────────────────────────
// 화면별 그림
// ─────────────────────────────────────────────

/**
 * 사이트 기본 이미지 (홈·그 밖의 화면): 밝은 종이색 바탕 + KBL 로고 + 사이트 이름 + 한 줄 설명, 아래 리그 남색 띠에 화면 이름·주소.
 * 같은 말을 두 번 쓰지 않는다(2026-10-04 사용자) — "KBL" 은 로고로만, 주소는 띠에 한 번.
 */
function DefaultImage({ logo, tagline }: { logo: string | null; tagline: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, fontFamily: "Pretendard", color: LEAGUE_NAVY }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} width={231} height={140} alt="" />
        ) : (
          <div style={{ display: "flex", padding: "10px 26px", borderRadius: 16, background: LEAGUE_NAVY, color: "#fff", fontSize: 72, fontWeight: 700 }}>KBL</div>
        )}
        <div style={{ fontSize: 104, fontWeight: 700, letterSpacing: -3, marginTop: 18, lineHeight: 1.1 }}>Stats Reference</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 18, fontSize: 36, color: "#3b4466" }}>
          <div style={{ width: 14, height: 14, borderRadius: 999, background: LEAGUE_ORANGE }} />
          {tagline}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: LEAGUE_NAVY, color: "#fff", padding: "26px 56px" }}>
        <div style={{ display: "flex", gap: 30, fontSize: 30, fontWeight: 700 }}>
          {["선수 카드", "리더보드", "경기 일정", "역대 기록", "54-0"].map((t) => (
            <div key={t} style={{ display: "flex" }}>{t}</div>
          ))}
        </div>
        <div style={{ fontSize: 24, opacity: 0.75 }}>{DOMAIN}</div>
      </div>
    </div>
  );
}

interface FactRow {
  label: string;
  name: string;
  value: string;
}
function RecordsImage({ facts }: { facts: FactRow[] }) {
  return (
    <Frame bg={INK}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>KBL 역대 기록</div>
        <div style={{ fontSize: 34, opacity: 0.75 }}>누적 · 한 경기 최다 · 한 시즌 최다 · 수상·우승</div>
        <div style={{ display: "flex", gap: 20, marginTop: 30 }}>
          {facts.map((f) => (
            <div key={f.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 330, padding: "22px 0", borderRadius: 20, background: "rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 26, opacity: 0.7 }}>{f.label}</div>
              <div style={{ fontSize: 34, fontWeight: 700, marginTop: 6 }}>{f.name}</div>
              <div style={{ fontSize: 46, fontWeight: 700, color: GOLD }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function GameImage() {
  return (
    <Frame bg={INK}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <div style={{ fontSize: 220, fontWeight: 700, letterSpacing: -8, lineHeight: 1, color: GOLD }}>54-0</div>
        <div style={{ fontSize: 44, fontWeight: 700 }}>KBL 역대 선수 5명으로 54전 전승에 도전</div>
        <div style={{ fontSize: 30, opacity: 0.7 }}>시즌·팀 슬롯을 돌려 주전 다섯 명을 뽑으세요</div>
      </div>
    </Frame>
  );
}

interface LeaderRow {
  name: string;
  team: string;
  color: string;
  value: string;
}
function LeadersImage({ season, label, rows }: { season: string; label: string; rows: LeaderRow[] }) {
  return (
    <Frame bg={INK}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -2 }}>{`${season} 리더보드`}</div>
        <div style={{ fontSize: 32, opacity: 0.75 }}>{label}</div>
        <div style={{ display: "flex", gap: 20, marginTop: 30 }}>
          {rows.map((r, i) => (
            <div key={r.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 330, paddingBottom: 24, borderRadius: 20, overflow: "hidden", background: "rgba(255,255,255,0.08)" }}>
              <div style={{ width: "100%", height: 10, background: r.color, marginBottom: 18 }} />
              <div style={{ fontSize: 30, fontWeight: 700, color: i === 0 ? GOLD : "rgba(255,255,255,0.7)" }}>{`${i + 1}위`}</div>
              <div style={{ fontSize: 40, fontWeight: 700, marginTop: 4 }}>{r.name}</div>
              <div style={{ fontSize: 26, opacity: 0.7 }}>{r.team}</div>
              <div style={{ fontSize: 56, fontWeight: 700, marginTop: 6 }}>{r.value}</div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

interface PlayerProps {
  name: string;
  nameEn: string;
  meta: string;
  chips: string[];
  stats: { label: string; value: string }[];
  primary: string;
}
function PlayerImage(p: PlayerProps) {
  const top = mixHex(p.primary, "#000000", 0.25);
  const floor = mixHex(p.primary, "#000000", 0.72);
  return (
    <Frame bg={top}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 34, opacity: 0.85 }}>{p.meta}</div>
        <div style={{ fontSize: p.name.length > 6 ? 104 : 128, fontWeight: 700, letterSpacing: -3, lineHeight: 1.15 }}>{p.name}</div>
        {p.nameEn ? <div style={{ fontSize: 28, opacity: 0.7, letterSpacing: 1 }}>{p.nameEn}</div> : <div />}
        {p.chips.length > 0 ? (
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            {p.chips.map((c) => (
              <Chip key={c} text={c} gold />
            ))}
          </div>
        ) : (
          <div />
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 0, background: floor, padding: "26px 40px 32px" }}>
        {p.stats.map((s, i) => (
          <div
            key={s.label}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 250, borderLeft: i === 0 ? "none" : "2px solid rgba(255,255,255,0.15)" }}
          >
            <div style={{ fontSize: 26, opacity: 0.7 }}>{s.label}</div>
            <div style={{ fontSize: 60, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ─────────────────────────────────────────────
// 데이터 → 그림
// ─────────────────────────────────────────────

async function main() {
  const seasonsList = await readJson<SeasonOption[]>(join(PROCESSED, "seasons.json"), []);
  const index = await readJson<PlayerIndexEntry[]>(join(PROCESSED, "players-index.json"), []);
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await mkdir(CACHE, { recursive: true });

  const logo = await leagueLogoDataUri();
  const tagline = "1997년부터 모든 선수 기록을 한눈에";
  await emit("site.png", { k: "default", t: tagline, logo: !!logo }, () => <DefaultImage logo={logo} tagline={tagline} />);
  await emit("game.png", { k: "game" }, () => <GameImage />);
  if (seasonsList.length === 0) {
    console.log("processed 없음 → 기본 이미지만");
    return;
  }

  const seasons = new Map<number, SeasonData>();
  for (const s of seasonsList) {
    const d = await readJson<SeasonData | null>(join(PROCESSED, String(s.seasonCode), "players.json"), null);
    if (d && d.players.length > 0) seasons.set(s.seasonCode, d);
  }
  const labelOf = new Map(seasonsList.map((s) => [s.seasonCode, s.seasonLabel]));
  const latest = seasons.size ? Math.max(...seasons.keys()) : null;
  const teamOf = (code: number, teamCode: string) => seasons.get(code)?.teams.find((t) => t.teamCode === teamCode);

  // 선수별 정규시즌 통산 (경기·득점·리바·어시) — lib/data loadCareerTotals 와 같은 합
  const career = new Map<string, { games: number; points: number; reb: number; ast: number }>();
  for (const d of seasons.values()) {
    for (const p of d.players) {
      const c = career.get(p.playerNo) ?? { games: 0, points: 0, reb: 0, ast: 0 };
      c.games += p.games;
      c.points += p.points;
      c.reb += p.reb;
      c.ast += p.ast;
      career.set(p.playerNo, c);
    }
  }

  // 리더보드: 시즌마다 경기당 득점 1~3위 (마감 시즌은 기본 표본 기준, 진행 중 시즌은 전원 — 리더보드 기본과 같다)
  for (const [code, d] of seasons) {
    const rule = seasonDefaultQualify(isOngoingSeason(code, latest, d.champion ?? null));
    const top = d.players
      .filter((p) => p.games > 0 && isQualified(p, rule))
      .map((p) => ({ p, v: perGame(p.points, p.games) }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .map(({ p, v }) => {
        const t = teamOf(code, p.teamCode);
        return { name: p.nameKo, team: t?.shortNameKo ?? p.teamShort, color: t?.color.primary ?? "#6b7280", value: `${NF1.format(v)}점` };
      });
    const props = { season: seasonShortLabel(d.seasonLabel), label: "경기당 득점 TOP 3", rows: top };
    await emit(`leaders/${code}.png`, props, () => <LeadersImage {...props} />);
  }

  // 역대 기록: 통산 득점 1위 · 한 경기 최다 득점 · 최다 우승
  const nameOf = new Map(index.map((e) => [e.id, e.nameKo]));
  const pointsTop = [...career.entries()].sort((a, b) => b[1].points - a[1].points)[0];
  const gameTop = index
    .map((e) => ({ e, v: e.careerHighs?.regular?.pts?.value ?? 0 }))
    .sort((a, b) => b.v - a.v || (a.e.careerHighs?.regular?.pts?.date ?? "").localeCompare(b.e.careerHighs?.regular?.pts?.date ?? ""))[0];
  const champTop = index.map((e) => ({ e, n: new Set(e.championships ?? []).size })).sort((a, b) => b.n - a.n)[0];
  const facts: FactRow[] = [];
  if (pointsTop) facts.push({ label: "통산 득점 1위", name: nameOf.get(pointsTop[0]) ?? "", value: `${NF0.format(pointsTop[1].points)}점` });
  if (gameTop && gameTop.v > 0) facts.push({ label: "한 경기 최다 득점", name: gameTop.e.nameKo, value: `${gameTop.v}점` });
  if (champTop && champTop.n > 0) facts.push({ label: "최다 우승", name: champTop.e.nameKo, value: `${champTop.n}회` });
  await emit("records.png", { facts }, () => <RecordsImage facts={facts} />);

  // 선수 (뛴 정규시즌이 있는 선수 = 선수 상세 페이지가 있는 선수)
  for (const e of index) {
    const rows = e.seasons.filter((s) => seasons.has(s.seasonCode));
    const c = career.get(e.id);
    if (rows.length === 0 || !c || c.games === 0) continue;
    const first = rows[0];
    const last = rows[rows.length - 1];
    const team = teamOf(last.seasonCode, last.teamCode);
    const span = seasonRangeLabel(labelOf.get(first.seasonCode) ?? "", labelOf.get(last.seasonCode) ?? "");
    const meta = [team?.shortNameKo ?? last.teamShort, e.positionLabel, span].filter(Boolean).join(" · ");
    const count = (key: string) => new Set((e.awards ?? []).filter((a) => a.key === key).map((a) => a.seasonCode)).size;
    const champs = new Set(e.championships ?? []).size;
    const chips = [
      champs ? `우승 ${champs}회` : null,
      count("mvp") ? `MVP ${count("mvp")}회` : null,
      count("finalsMvp") ? `챔프전 MVP ${count("finalsMvp")}회` : null,
      count("foreignMvp") ? `외국선수 MVP ${count("foreignMvp")}회` : null,
    ].filter((x): x is string => !!x);
    const props: PlayerProps = {
      name: e.nameKo,
      nameEn: e.nameEn ?? "",
      meta,
      chips,
      primary: team?.color.primary ?? "#374151",
      stats: [
        { label: "통산 경기", value: NF0.format(c.games) },
        { label: "경기당 득점", value: NF1.format(perGame(c.points, c.games)) },
        { label: "경기당 리바", value: NF1.format(perGame(c.reb, c.games)) },
        { label: "경기당 어시", value: NF1.format(perGame(c.ast, c.games)) },
      ],
    };
    await emit(`player/${e.id}.png`, props, () => <PlayerImage {...props} />);
  }
  console.log(`공유 이미지: 새로 그림 ${rendered} · 캐시 재사용 ${reused} → ${OUT}`);
}

main().catch((e) => {
  // 공유 이미지가 없어도 사이트는 돌아가야 한다 — 빌드는 멈추지 않는다
  console.error("공유 이미지 만들기 실패:", e);
});
