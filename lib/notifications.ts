// 알림 (2026-10-08 사용자 요청: 즐겨찾기 선수·응원팀 소식 알림). 1단계 = 사이트 안 알림함.
// 빌드 때 최근 경기(정규시즌 마지막 경기일부터 7일)로 "모두에게 같은" 알림 목록을 만들고(scripts/build-notifications.ts →
// public/notifications.json), 브라우저가 내 즐겨찾기 선수·응원팀 것만 골라 보여 준다 — 서버·DB 필요 없음.
// 2단계(폰 푸시)도 같은 목록을 쓴다. 순수 함수만.
import type { GameBoxRow, SeasonGame, TeamColor } from "./types";
import { MILESTONE_STEPS } from "./records";

export type NotifKind = "high" | "milestone" | "team_result" | "highlight" | "player_game";

export interface NotifItem {
  /** 고유 번호 (읽음 표시에 쓴다) */
  id: string;
  kind: NotifKind;
  /** 경기 날짜 "2026-10-03" */
  date: string;
  /** 이 팀 응원하는 사람에게 (팀 코드) */
  teams?: string[];
  /** 이 선수 즐겨찾기한 사람에게 (선수 번호) */
  player?: string;
  title: string;
  body: string;
  href: string;
  /** 대기록(high·milestone)만: 홈 "새로 나온 기록"이 쓰는 구조 값 (2026-10-11) */
  feat?: FeatInfo;
}

/** 대기록 한 줄의 재료 — 선수 이름을 뺀 문구와 단계, 경기 점수·그날 기록 */
export interface FeatInfo {
  level: FeatLevel;
  /** "33득점" · "통산 3,000득점 달성" */
  text: string;
  /** "삼성 88 : 85 소노" (선수 팀이 앞) */
  game: string;
  won: boolean;
  /** 그날 기록 "33득점 · 6어시스트" */
  stat: string;
  name: string;
}

/** season = 그 선수의 이번 시즌 최다(알림함), league = 이번 시즌 리그 전체 최고 기록 갱신(홈) */
export type FeatLevel = "career" | "careerTie" | "league" | "season" | "milestone";

export interface NotifFeed {
  version: 1;
  seasonCode: number;
  /** 목록을 만든 날짜(ISO) */
  builtAt: string;
  items: NotifItem[];
}

/** 최근 며칠 경기까지 알림을 만드나 (마지막 경기일 포함) */
export const NOTIF_WINDOW_DAYS = 7;

/** 같은 날짜 안 보여 줄 순서 — 대기록 먼저 */
const KIND_ORDER: Record<NotifKind, number> = { high: 0, milestone: 1, team_result: 2, highlight: 3, player_game: 4 };

/** 시즌 하이·커리어 하이로 알릴 부문과 최소 값 (1스틸 "시즌 최다" 같은 소식은 안 보낸다 — 우리 규칙) */
export const HIGH_KEYS = [
  { key: "pts", min: 15, text: (v: number) => `${v}득점` },
  { key: "reb", min: 8, text: (v: number) => `${v}리바운드` },
  { key: "ast", min: 6, text: (v: number) => `${v}어시스트` },
  { key: "tpm", min: 4, text: (v: number) => `3점슛 ${v}개` },
  { key: "stl", min: 4, text: (v: number) => `${v}스틸` },
  { key: "blk", min: 3, text: (v: number) => `${v}블록` },
] as const;
type HighKey = (typeof HIGH_KEYS)[number]["key"];

/** 시즌 최다로 알리려면 그 전에 이 시즌 몇 경기 뛰었어야 하나 (개막 첫 경기는 늘 시즌 최다라서) */
export const SEASON_HIGH_MIN_PRIOR_GAMES = 3;
/** 커리어 하이로 알리려면 그 전에 KBL 통산 몇 경기 뛰었어야 하나 (데뷔 몇 경기째 "커리어 하이"는 소식이 아니라서) */
export const CAREER_HIGH_MIN_PRIOR_GAMES = 20;

/** 통산 이정표 부문 (lib/records MILESTONE_STEPS 와 같은 간격) */
// text: 통산 값 → "8,000득점" 꼴
const MILESTONE_DEFS = [
  { key: "points", box: "pts", text: (n: string) => `${n}득점` },
  { key: "reb", box: "reb", text: (n: string) => `${n}리바운드` },
  { key: "ast", box: "ast", text: (n: string) => `${n}어시스트` },
  { key: "stl", box: "stl", text: (n: string) => `${n}스틸` },
  { key: "blk", box: "blk", text: (n: string) => `${n}블록` },
  { key: "tpm", box: "tpm", text: (n: string) => `3점슛 ${n}개` },
  { key: "games", box: null, text: (n: string) => `${n}경기 출전` },
  { key: "wins", box: null, text: (n: string) => `${n}승` },
] as const;
export type MilestoneKey = (typeof MILESTONE_DEFS)[number]["key"];
export type CareerSums = Record<MilestoneKey, number>;

export interface NotifContext {
  seasonCode: number;
  /** 팀 코드 → 한글 약칭 */
  teamShort: Record<string, string>;
  /** 선수 번호 → 정규시즌 커리어 하이 (players-index careerHighs.regular) */
  careerHighs: Record<string, Partial<Record<HighKey, { value: number; date: string; seasonCode: number }>>>;
  /** 선수 번호 → 지금까지 통산 합계 (이번 시즌 포함) */
  careerSums: Record<string, CareerSums>;
}

const NF = new Intl.NumberFormat("ko-KR");

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 알림을 만들 경기: 끝났고 박스스코어가 있는 정규시즌 경기 중 마지막 경기일부터 windowDays 일 */
export function windowGames(games: readonly SeasonGame[], windowDays = NOTIF_WINDOW_DAYS): SeasonGame[] {
  const done = games.filter((g) => g.ended && g.home.score !== null && g.away.score !== null);
  if (done.length === 0) return [];
  const last = done.reduce((m, g) => (g.date > m ? g.date : m), done[0].date);
  const from = addDays(last, -(windowDays - 1));
  return done.filter((g) => g.date >= from);
}

function scoreLine(g: SeasonGame, side: "home" | "away", ctx: Pick<NotifContext, "teamShort">): { text: string; won: boolean } {
  const me = g[side];
  const opp = side === "home" ? g.away : g.home;
  const name = (code: string, fallback: string) => ctx.teamShort[code] ?? fallback;
  const won = (me.score ?? 0) > (opp.score ?? 0);
  return { text: `${name(me.teamCode, me.name)} ${me.score} : ${opp.score} ${name(opp.teamCode, opp.name)}`, won };
}

/** 선수 한 경기 한 줄: "24득점 · 5리바운드 · 7어시스트" (리바·어시는 3개 이상만) */
export function playerStatLine(r: GameBoxRow): string {
  const parts = [`${r.pts}득점`];
  if (r.reb >= 3) parts.push(`${r.reb}리바운드`);
  if (r.ast >= 3) parts.push(`${r.ast}어시스트`);
  if (r.stl >= 3) parts.push(`${r.stl}스틸`);
  if (r.blk >= 3) parts.push(`${r.blk}블록`);
  return parts.join(" · ");
}

function shootingLine(r: GameBoxRow): string {
  const parts: string[] = [];
  if (r.tpa > 0) parts.push(`3점 ${r.tpm}/${r.tpa}`);
  parts.push(`${Math.round(r.sec / 60)}분`);
  return parts.join(" · ");
}

function scheduleHref(seasonCode: number, date: string) {
  return `/season/${seasonCode}/schedule?date=${date}`;
}

/**
 * 최근 경기 → 알림 목록 (모두에게 같은 목록, 날짜 최신 → 같은 날은 대기록 먼저).
 * - 응원팀: 경기 결과(+ 우리 팀 득점 1위), 하이라이트 영상
 * - 즐겨찾기 선수: 그날 기록, 시즌 최다·커리어 하이(타이), 통산 이정표 돌파
 */
export function buildNotifItems(allGames: readonly SeasonGame[], ctx: NotifContext, windowDays = NOTIF_WINDOW_DAYS): NotifItem[] {
  const recent = windowGames(allGames, windowDays);
  const ordered = allGames.filter((g) => g.ended && g.box).slice().sort((a, b) => a.date.localeCompare(b.date) || a.gmkey.localeCompare(b.gmkey));

  // 이정표: 이 경기 "뒤" 이번 시즌 경기 기록을 통산 합계에서 빼면 이 경기 직후 통산 값
  const after = new Map<string, Map<string, CareerSums>>(); // gmkey → 선수 → 그 경기 직후 통산
  const running = new Map<string, CareerSums>();
  for (const [id, sums] of Object.entries(ctx.careerSums)) running.set(id, { ...sums });
  for (let i = ordered.length - 1; i >= 0; i--) {
    const g = ordered[i];
    const snap = new Map<string, CareerSums>();
    for (const side of ["home", "away"] as const) {
      const won = (g[side].score ?? 0) > (g[side === "home" ? "away" : "home"].score ?? 0);
      for (const r of g.box![side]) {
        const cur = running.get(r.id);
        if (!cur || r.sec <= 0) continue;
        snap.set(r.id, { ...cur });
        cur.points -= r.pts; cur.reb -= r.reb; cur.ast -= r.ast; cur.stl -= r.stl; cur.blk -= r.blk; cur.tpm -= r.tpm;
        cur.games -= 1;
        if (won) cur.wins -= 1;
      }
    }
    after.set(g.gmkey, snap);
  }
  // 시즌 최다: 이 경기 전까지 이번 시즌 최고 기록·경기 수
  const seasonBest = new Map<string, { games: number } & Record<HighKey, number>>();
  const prior = new Map<string, Map<string, { games: number } & Record<HighKey, number>>>();
  for (const g of ordered) {
    const snap = new Map<string, { games: number } & Record<HighKey, number>>();
    for (const side of ["home", "away"] as const) {
      for (const r of g.box![side]) {
        if (r.sec <= 0) continue;
        const b = seasonBest.get(r.id) ?? { games: 0, pts: 0, reb: 0, ast: 0, tpm: 0, stl: 0, blk: 0 };
        snap.set(r.id, { ...b });
        b.games += 1;
        for (const h of HIGH_KEYS) b[h.key] = Math.max(b[h.key], r[h.key]);
        seasonBest.set(r.id, b);
      }
    }
    prior.set(g.gmkey, snap);
  }

  const items: NotifItem[] = [];
  for (const g of recent) {
    const href = scheduleHref(ctx.seasonCode, g.date);
    for (const side of ["home", "away"] as const) {
      const me = g[side];
      const { text, won } = scoreLine(g, side, ctx);
      const rows = g.box?.[side] ?? [];
      const top = rows.filter((r) => r.sec > 0).sort((a, b) => b.pts - a.pts)[0];
      items.push({
        id: `r:${g.gmkey}:${me.teamCode}`,
        kind: "team_result",
        date: g.date,
        teams: [me.teamCode],
        title: `${text} ${won ? "승리" : "패배"}`,
        body: top ? `${top.nameKo} ${playerStatLine(top)}` : g.stadium ?? "",
        href,
      });
      if (g.highlight) {
        items.push({
          id: `v:${g.gmkey}:${me.teamCode}`,
          kind: "highlight",
          date: g.date,
          teams: [me.teamCode],
          title: `${text} 하이라이트`,
          body: "경기 하이라이트 영상이 올라왔어요",
          href,
        });
      }
      for (const r of rows) {
        if (r.sec <= 0) continue;
        items.push({
          id: `p:${g.gmkey}:${r.id}`,
          kind: "player_game",
          date: g.date,
          player: r.id,
          title: `${r.nameKo} ${playerStatLine(r)}`,
          body: `${text} ${won ? "승" : "패"} · ${shootingLine(r)}`,
          href: `/player/${r.id}?season=${ctx.seasonCode}`,
        });
        // 커리어 하이 / 시즌 최다 (한 부문에 하나 — 커리어가 먼저)
        const before = prior.get(g.gmkey)?.get(r.id);
        const sumAfter = after.get(g.gmkey)?.get(r.id);
        const veteran = (sumAfter?.games ?? 0) - 1 >= CAREER_HIGH_MIN_PRIOR_GAMES;
        for (const h of HIGH_KEYS) {
          const v = r[h.key];
          if (v < h.min) continue;
          const career = ctx.careerHighs[r.id]?.[h.key];
          let label: string | null = null;
          if (veteran && career && career.seasonCode === ctx.seasonCode && career.value === v) {
            label = career.date === g.date ? "커리어 하이" : "커리어 하이 타이";
          } else if (before && before.games >= SEASON_HIGH_MIN_PRIOR_GAMES && v > before[h.key]) {
            label = "이번 시즌 최다";
          }
          if (!label) continue;
          const level: FeatLevel = label === "커리어 하이" ? "career" : label === "커리어 하이 타이" ? "careerTie" : "season";
          items.push({
            id: `h:${g.gmkey}:${r.id}:${h.key}`,
            kind: "high",
            date: g.date,
            player: r.id,
            title: `${r.nameKo} ${label} ${h.text(v)}`,
            body: `${text} · ${playerStatLine(r)}`,
            href: `/player/${r.id}?season=${ctx.seasonCode}`,
            feat: { level, text: h.text(v), game: text, won, stat: playerStatLine(r), name: r.nameKo },
          });
        }
        // 통산 이정표 돌파
        if (sumAfter) {
          for (const m of MILESTONE_DEFS) {
            const step = MILESTONE_STEPS[m.key];
            if (!step) continue;
            const add = m.box ? r[m.box] : m.key === "games" ? 1 : won ? 1 : 0;
            const now = sumAfter[m.key];
            const was = now - add;
            if (add <= 0 || Math.floor(was / step) === Math.floor(now / step)) continue;
            const target = Math.floor(now / step) * step;
            items.push({
              id: `m:${g.gmkey}:${r.id}:${m.key}`,
              kind: "milestone",
              date: g.date,
              player: r.id,
              title: `${r.nameKo} 통산 ${m.text(NF.format(target))} 달성`,
              body: `${text} · 지금 통산 ${m.text(NF.format(now))}`,
              href: `/player/${r.id}?season=${ctx.seasonCode}`,
              feat: { level: "milestone", text: `통산 ${m.text(NF.format(target))}`, game: text, won, stat: playerStatLine(r), name: r.nameKo },
            });
          }
        }
      }
    }
  }
  return sortNotifs(items);
}

export function sortNotifs(items: NotifItem[]): NotifItem[] {
  return items.slice().sort((a, b) => b.date.localeCompare(a.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.id.localeCompare(b.id));
}

// ─────────────────────────────────────────────
// 브라우저: 내 것만 고르기 · 읽음
// ─────────────────────────────────────────────

/** 내 즐겨찾기 선수·응원팀 알림만 (같은 경기의 선수 기록은 즐겨찾기 선수만) */
export function myNotifs(items: readonly NotifItem[], favorites: readonly string[], teams: readonly string[]): NotifItem[] {
  const fav = new Set(favorites);
  const team = new Set(teams);
  return items.filter((it) => (it.player && fav.has(it.player)) || (it.teams?.some((t) => team.has(t)) ?? false));
}

/** 처음 쓰는 브라우저: 가장 최근 경기일 소식만 "새 알림", 그 전 것은 읽은 것으로 */
export function initialSeen(mine: readonly NotifItem[]): string[] {
  if (mine.length === 0) return [];
  const latest = mine.reduce((m, it) => (it.date > m ? it.date : m), mine[0].date);
  return mine.filter((it) => it.date < latest).map((it) => it.id);
}

/** 읽음 목록 상한 (오래된 것부터 버린다) */
export const SEEN_MAX = 2000;

export function unreadCount(mine: readonly NotifItem[], seen: ReadonlySet<string>): number {
  return mine.filter((it) => !seen.has(it.id)).length;
}

/** 읽음 목록 합치기 (새 것을 뒤에, 상한 넘으면 앞에서 자름) */
export function mergeSeen(seen: readonly string[], add: readonly string[]): string[] {
  const set = new Set(seen);
  const out = [...seen];
  for (const id of add) if (!set.has(id)) { set.add(id); out.push(id); }
  return out.length > SEEN_MAX ? out.slice(out.length - SEEN_MAX) : out;
}

export const NOTIF_KIND_LABEL: Record<NotifKind, string> = {
  high: "대기록",
  milestone: "이정표",
  team_result: "경기 결과",
  highlight: "하이라이트",
  player_game: "선수 기록",
};

// ─────────────────────────────────────────────
// 종류별 켜기·끄기 (2026-10-08 토스 검토 B-7) — 알림함·폰 알림 공용. 저장은 "끈 묶음" 목록
// (새 종류가 생기면 기본으로 켜지게). 로그인 회원은 계정(members.notif_off), 아니면 이 브라우저.
// ─────────────────────────────────────────────

export type NotifGroup = "team" | "player" | "highlight" | "record";

export const NOTIF_GROUPS: { key: NotifGroup; label: string; desc: string; kinds: NotifKind[] }[] = [
  { key: "team", label: "응원팀 경기 결과", desc: "응원팀이 이기거나 졌을 때 점수와 팀 득점 1위", kinds: ["team_result"] },
  { key: "player", label: "즐겨찾기 선수 기록", desc: "그 경기 득점·리바운드·어시스트", kinds: ["player_game"] },
  { key: "highlight", label: "하이라이트 영상", desc: "응원팀 경기 하이라이트가 올라오면", kinds: ["highlight"] },
  { key: "record", label: "기록 달성", desc: "커리어 하이, 이번 시즌 최다, 통산 이정표", kinds: ["high", "milestone"] },
];

const GROUP_OF_KIND = new Map<NotifKind, NotifGroup>(NOTIF_GROUPS.flatMap((g) => g.kinds.map((k) => [k, g.key] as const)));

export function notifGroupOf(kind: NotifKind): NotifGroup {
  return GROUP_OF_KIND.get(kind) ?? "record";
}

/** 저장된 값 → 끈 묶음 목록 (모르는 값·중복은 버린다) */
export function parseNotifOff(input: unknown): NotifGroup[] {
  if (!Array.isArray(input)) return [];
  const keys = new Set<string>(NOTIF_GROUPS.map((g) => g.key));
  return NOTIF_GROUPS.map((g) => g.key).filter((k) => input.includes(k) && keys.has(k));
}

/** 끈 묶음 소식 빼기 */
export function withoutOffGroups(items: readonly NotifItem[], off: readonly string[]): NotifItem[] {
  if (off.length === 0) return items.slice();
  const set = new Set(off);
  return items.filter((it) => !set.has(notifGroupOf(it.kind)));
}

// ─────────────────────────────────────────────
// 홈 "새로 나온 기록" (2026-10-11 사용자 결정 — 즐겨찾기와 상관없이 모두에게)
// 알림 목록의 대기록(커리어 하이·시즌 최다·통산 이정표)을 선수-경기 하나로 묶는다.
// ─────────────────────────────────────────────

export interface FeatGroup {
  /** 경기 번호:선수 번호 */
  key: string;
  date: string;
  player: string;
  name: string;
  href: string;
  game: string;
  won: boolean;
  stat: string;
  /** 단계 높은 것 먼저 */
  lines: { level: FeatLevel; text: string }[];
}

/** 홈 한 칸 (featGroups + 사진·팀 색 — lib/data loadRecentFeats) */
export interface RecentFeat extends FeatGroup {
  photoUrl: string | null;
  teamShort: string;
  color: TeamColor;
}

export const FEAT_LEVEL_LABEL: Record<FeatLevel, string> = {
  career: "커리어 하이",
  careerTie: "커리어 하이 타이",
  league: "시즌 최다",
  season: "개인 시즌 최다",
  milestone: "이정표",
};

const LEVEL_ORDER: Record<FeatLevel, number> = { career: 0, careerTie: 1, league: 2, milestone: 3, season: 4 };

/** 대기록만 골라 선수-경기로 묶기 → 날짜 최신 → 가장 높은 단계 → 줄 많은 순 */
export function featGroups(items: readonly NotifItem[]): FeatGroup[] {
  const map = new Map<string, FeatGroup>();
  for (const it of items) {
    if (!it.feat || !it.player) continue;
    const gmkey = it.id.split(":")[1] ?? it.date;
    const key = `${gmkey}:${it.player}`;
    let g = map.get(key);
    if (!g) {
      g = { key, date: it.date, player: it.player, name: it.feat.name, href: it.href, game: it.feat.game, won: it.feat.won, stat: it.feat.stat, lines: [] };
      map.set(key, g);
    }
    g.lines.push({ level: it.feat.level, text: it.feat.text });
  }
  const groups = [...map.values()];
  for (const g of groups) g.lines.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  const best = (g: FeatGroup) => LEVEL_ORDER[g.lines[0].level];
  return groups.sort((a, b) => b.date.localeCompare(a.date) || best(a) - best(b) || b.lines.length - a.lines.length || a.name.localeCompare(b.name, "ko"));
}

/** 선수 색인 → 정규시즌 커리어 하이 (build-notifications·홈 공용) */
export function careerHighsFromIndex(index: readonly { id: string; careerHighs?: unknown }[]): NotifContext["careerHighs"] {
  const out: NotifContext["careerHighs"] = {};
  for (const p of index) {
    const reg = (p.careerHighs as { regular?: NotifContext["careerHighs"][string] } | null | undefined)?.regular;
    if (reg) out[p.id] = reg;
  }
  return out;
}

/** 시즌 파일 선수들 → 선수별 통산 합계 (이정표 계산 재료) */
export function careerSumsFromSeasons(
  seasons: readonly { players: readonly { playerNo: string; points: number; reb: number; ast: number; stl: number; blk: number; tpm: number; games: number; wins: number }[] }[],
): Record<string, CareerSums> {
  const out: Record<string, CareerSums> = {};
  for (const season of seasons) {
    for (const p of season.players) {
      const c = (out[p.playerNo] ??= { points: 0, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0, games: 0, wins: 0 });
      c.points += p.points; c.reb += p.reb; c.ast += p.ast; c.stl += p.stl; c.blk += p.blk; c.tpm += p.tpm;
      c.games += p.games; c.wins += p.wins;
    }
  }
  return out;
}

// ─────────────────────────────────────────────
// 홈 "새로 나온 기록" 고르는 규칙 (2026-10-11 사용자 결정)
// - 커리어 하이(타이 포함)는 그대로
// - 이정표는 통산 득점·출전 경기만
// - 시즌 최다는 선수 본인 것이 아니라 "이번 시즌 그 부문 리그 최고 기록"을 새로 쓴 경우만 (leagueSeasonRecords)
// ─────────────────────────────────────────────

export const HOME_MILESTONE_KEYS: readonly MilestoneKey[] = ["points", "games"];

/**
 * 이번 시즌 리그 최고 기록 갱신: 그 경기 날짜 전까지 누구의 한 경기 기록보다도 높고(같으면 갱신 아님) 그날 가장 높은 값.
 * 시즌 첫 경기일은 비교할 기록이 없어 빼고, 부문별 최소 값(HIGH_KEYS min)도 지킨다. 최근 windowDays 경기만 알린다.
 */
export function leagueSeasonRecords(allGames: readonly SeasonGame[], ctx: Pick<NotifContext, "seasonCode" | "teamShort">, windowDays = NOTIF_WINDOW_DAYS): NotifItem[] {
  const done = allGames.filter((g) => g.ended && g.box && g.home.score !== null && g.away.score !== null);
  const recentKeys = new Set(windowGames(allGames, windowDays).map((g) => g.gmkey));
  const dates = [...new Set(done.map((g) => g.date))].sort();
  const best: Record<HighKey, number> = { pts: 0, reb: 0, ast: 0, tpm: 0, stl: 0, blk: 0 };
  const items: NotifItem[] = [];
  dates.forEach((date, di) => {
    const dayGames = done.filter((g) => g.date === date);
    const rows = dayGames.flatMap((g) => (["home", "away"] as const).flatMap((side) => g.box![side].filter((r) => r.sec > 0).map((r) => ({ g, side, r }))));
    for (const h of HIGH_KEYS) {
      const dayMax = rows.reduce((m, x) => Math.max(m, x.r[h.key]), 0);
      if (di > 0 && dayMax > best[h.key] && dayMax >= h.min) {
        for (const { g, side, r } of rows) {
          if (r[h.key] !== dayMax || !recentKeys.has(g.gmkey)) continue;
          const { text, won } = scoreLine(g, side, ctx);
          items.push({
            id: `l:${g.gmkey}:${r.id}:${h.key}`,
            kind: "high",
            date,
            player: r.id,
            title: `${r.nameKo} 이번 시즌 최고 ${h.text(r[h.key])}`,
            body: `${text} · ${playerStatLine(r)}`,
            href: `/player/${r.id}?season=${ctx.seasonCode}`,
            feat: { level: "league", text: h.text(r[h.key]), game: text, won, stat: playerStatLine(r), name: r.nameKo },
          });
        }
      }
      best[h.key] = Math.max(best[h.key], dayMax);
    }
  });
  return items;
}

/** 알림 목록 + 리그 최고 갱신 → 홈에 보일 대기록만 (커리어 하이·리그 시즌 최고·득점/출전 이정표) */
export function homeFeatItems(items: readonly NotifItem[], league: readonly NotifItem[]): NotifItem[] {
  const keep = items.filter((it) => {
    if (!it.feat) return false;
    if (it.feat.level === "career" || it.feat.level === "careerTie") return true;
    if (it.feat.level === "milestone") return (HOME_MILESTONE_KEYS as readonly string[]).includes(it.id.split(":")[3] ?? "");
    return false;
  });
  return [...keep, ...league];
}
