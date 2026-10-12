// 좋은 소식 알림 더 (2026-10-12 사용자 결정: 제안 ①②③④⑦⑧⑨⑩⑬⑭ — ⑦ 더블더블은 lib/notifications buildNotifItems 안).
// 응원팀: 연승·연패 탈출(①), 순위 1위·6위 안 진입(②), 플레이오프·4강 직행·1위 확정(③), 경기 날 안내(④)
// 즐겨찾기 선수: 이번 시즌 리그 최고 기록(⑧), 경기당 부문 5위 안·1위(⑨), 통산 역대 순위 상승(⑩), 생일(⑬), 수상(⑭)
// 재료는 알림함과 같은 시즌 games.json·시즌 파일·선수 색인 (scripts/notif-feed.ts 가 모아서 부른다). 순수 함수만.
import { birthdaysOn } from "./home";
import { computeStandings, notableStreak, pctLabel, winnerSide, type StandingRow } from "./games";
import { leagueSeasonRecords, windowGames, NOTIF_WINDOW_DAYS, type CareerSums, type NotifItem } from "./notifications";
import type { GameBoxRow, SeasonGame } from "./types";

const NF = new Intl.NumberFormat("ko-KR");

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "10월 14일" */
function monthDay(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일`;
}

const ended = (g: SeasonGame) => g.ended && g.home.score !== null && g.away.score !== null;
const byDate = (a: SeasonGame, b: SeasonGame) => a.date.localeCompare(b.date) || a.gmkey.localeCompare(b.gmkey);

/** 알림 창 안의 경기 날짜들 (lib/notifications windowGames 와 같은 창) */
function windowDates(games: readonly SeasonGame[], windowDays: number): Set<string> {
  return new Set(windowGames(games, windowDays).map((g) => g.date));
}

const teamName = (teamShort: Record<string, string>, code: string, fallback: string) => teamShort[code] ?? fallback;

function scoreText(g: SeasonGame, side: "home" | "away", teamShort: Record<string, string>): string {
  const me = g[side];
  const opp = side === "home" ? g.away : g.home;
  return `${teamName(teamShort, me.teamCode, me.name)} ${me.score} : ${opp.score} ${teamName(teamShort, opp.teamCode, opp.name)}`;
}

const standingsHref = "/teams?view=table";

// ─────────────────────────────────────────────
// ① 연승·연패 탈출
// ─────────────────────────────────────────────

/** 연승을 알리는 최소 경기 수 (2연승은 흔해서 3연승부터 — 우리 규칙). 연패 탈출도 3연패 이상을 끊었을 때 */
export const STREAK_NOTIFY_MIN = 3;

export function teamStreakItems(allGames: readonly SeasonGame[], ctx: { seasonCode: number; teamShort: Record<string, string> }, windowDays = NOTIF_WINDOW_DAYS): NotifItem[] {
  const dates = windowDates(allGames, windowDays);
  const results = new Map<string, ("W" | "L")[]>();
  const items: NotifItem[] = [];
  for (const g of allGames.filter(ended).sort(byDate)) {
    const w = winnerSide(g);
    if (!w) continue;
    for (const side of ["home", "away"] as const) {
      const code = g[side].teamCode;
      const list = results.get(code) ?? [];
      const won = side === w;
      // 이 경기 전 이어지던 연패
      let lossRun = 0;
      for (let i = list.length - 1; i >= 0 && list[i] === "L"; i--) lossRun++;
      list.push(won ? "W" : "L");
      results.set(code, list);
      if (!won || !dates.has(g.date)) continue;
      let winRun = 0;
      for (let i = list.length - 1; i >= 0 && list[i] === "W"; i--) winRun++;
      const name = teamName(ctx.teamShort, code, g[side].name);
      const title = winRun >= STREAK_NOTIFY_MIN ? `${name} ${winRun}연승` : lossRun >= STREAK_NOTIFY_MIN ? `${name} ${lossRun}연패 탈출` : null;
      if (!title) continue;
      items.push({
        id: `st:${g.gmkey}:${code}`,
        kind: "team_streak",
        date: g.date,
        teams: [code],
        title,
        body: scoreText(g, side, ctx.teamShort),
        href: `/season/${ctx.seasonCode}/schedule?date=${g.date}`,
      });
    }
  }
  return items;
}

// ─────────────────────────────────────────────
// ② 순위 변화 · ③ 확정 소식
// ─────────────────────────────────────────────

/** 순위 소식은 팀들이 이만큼 치른 뒤부터 — 팀 경기 수 가운데값 기준 (시즌 초에는 하루마다 순위가 크게 흔들려서 — 우리 규칙).
 *  가운데값인 이유: 2026-27 SK 처럼 개막이 늦은 팀 하나 때문에 모두 기다리지 않게 */
export const TEAM_RANK_MIN_GAMES = 5;

export function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
/** KBL 플레이오프: 정규리그 6위까지 진출, 1·2위는 4강 직행 (리그 규정 — 바뀌면 여기만) */
export const PLAYOFF_SPOTS = 6;
export const DIRECT_SEMI_SPOTS = 2;

/** 날짜 D 까지(포함) 끝난 경기로 순위 */
function standingsUntil(games: readonly SeasonGame[], date: string, inclusive: boolean): Map<string, StandingRow> {
  const rows = computeStandings(games.filter((g) => ended(g) && (inclusive ? g.date <= date : g.date < date)));
  return new Map(rows.map((r) => [r.teamCode, r]));
}

/**
 * 순위 k 안을 확정했나 (보수적으로): 이 팀이 남은 경기를 다 지고, 다른 팀은 다 이긴다고 쳐도
 * 이 팀 승수 이상이 될 수 있는 팀이 k-1 개 이하면 확정. 동률 순위 규칙(상대 전적 등)은 모르므로 동률은 진다고 본다.
 */
export function clinchedSpot(team: string, wins: ReadonlyMap<string, number>, remaining: ReadonlyMap<string, number>, k: number): boolean {
  const mine = wins.get(team) ?? 0;
  let threats = 0;
  for (const [code, w] of wins) {
    if (code === team) continue;
    if (w + (remaining.get(code) ?? 0) >= mine) threats++;
  }
  return threats <= k - 1;
}

const CLINCH_LEVELS = [
  { k: 1, label: "정규리그 1위 확정" },
  { k: DIRECT_SEMI_SPOTS, label: "4강 플레이오프 직행 확정" },
  { k: PLAYOFF_SPOTS, label: "플레이오프 진출 확정" },
] as const;

export function teamRankItems(allGames: readonly SeasonGame[], ctx: { seasonCode: number; teamShort: Record<string, string> }, windowDays = NOTIF_WINDOW_DAYS): NotifItem[] {
  const dates = [...windowDates(allGames, windowDays)].sort();
  // 시즌 전체 일정에서 팀별 경기 수 (남은 경기 = 전체 - 치른 경기)
  const scheduled = new Map<string, number>();
  const names = new Map<string, string>();
  for (const g of allGames) {
    for (const side of [g.home, g.away]) {
      if (!side.teamCode) continue;
      scheduled.set(side.teamCode, (scheduled.get(side.teamCode) ?? 0) + 1);
      names.set(side.teamCode, teamName(ctx.teamShort, side.teamCode, side.name));
    }
  }
  const clinchState = (rows: Map<string, StandingRow>) => {
    const wins = new Map<string, number>();
    const remaining = new Map<string, number>();
    for (const [code, total] of scheduled) {
      const r = rows.get(code);
      wins.set(code, r?.wins ?? 0);
      remaining.set(code, total - (r?.games ?? 0));
    }
    // 팀마다 확정한 가장 높은 단계 (없으면 null)
    const out = new Map<string, number | null>();
    for (const code of scheduled.keys()) out.set(code, CLINCH_LEVELS.find((l) => clinchedSpot(code, wins, remaining, l.k))?.k ?? null);
    return out;
  };

  const items: NotifItem[] = [];
  for (const date of dates) {
    const before = standingsUntil(allGames, date, false);
    const after = standingsUntil(allGames, date, true);
    const settled = medianOf([...scheduled.keys()].map((c) => after.get(c)?.games ?? 0)) >= TEAM_RANK_MIN_GAMES;
    const recordLine = (r: StandingRow) => `${r.wins}승 ${r.losses}패 · 승률 ${pctLabel(r.pct)}`;

    // ③ 확정 (시즌 초 조건 없이 — 확정은 시즌 후반에만 생긴다)
    const cb = clinchState(before);
    const ca = clinchState(after);
    for (const [code, k] of ca) {
      const was = cb.get(code) ?? null;
      if (k === null || (was !== null && was <= k)) continue;
      const level = CLINCH_LEVELS.find((l) => l.k === k)!;
      const r = after.get(code);
      items.push({
        id: `cl:${date}:${code}:${k}`,
        kind: "team_clinch",
        date,
        teams: [code],
        title: `${names.get(code)} ${level.label}`,
        body: r ? recordLine(r) : "",
        href: standingsHref,
      });
    }

    // ② 1위·6위 안 진입
    if (!settled) continue;
    const firstCount = [...after.values()].filter((r) => r.rank === 1).length;
    const firstBefore = [...before.values()].filter((r) => r.rank === 1).length;
    for (const [code, r] of after) {
      const was = before.get(code)?.rank ?? Infinity;
      let title: string | null = null;
      // 1위가 되거나, 공동 1위에서 단독 1위가 됐을 때
      if (r.rank === 1 && (was !== 1 || (firstBefore > 1 && firstCount === 1))) title = `${names.get(code)} ${firstCount > 1 ? "공동 1위" : "단독 1위"}`;
      else if (r.rank <= PLAYOFF_SPOTS && was > PLAYOFF_SPOTS) title = `${names.get(code)} ${r.rank}위로, 플레이오프권 진입`;
      if (!title) continue;
      items.push({ id: `rk:${date}:${code}`, kind: "team_rank", date, teams: [code], title, body: recordLine(r), href: standingsHref });
    }
  }
  return items;
}

// ─────────────────────────────────────────────
// ④ 경기 날 안내 — 앞으로 며칠 치를 미리 넣고, 화면·폰 알림이 그날만 쓴다 (lib/notifications visibleNotifs)
// ─────────────────────────────────────────────

/** 오늘부터 며칠 치 경기 안내를 미리 넣나 (빌드가 매일 있지 않아도 비지 않게) */
export const PREVIEW_DAYS = 7;
/** 시작 시각을 모를 때 (평일 저녁 경기) */
const DEFAULT_START = "19:00";

export function teamPreviewItems(allGames: readonly SeasonGame[], ctx: { seasonCode: number; teamShort: Record<string, string> }, today: string): NotifItem[] {
  const until = addDays(today, PREVIEW_DAYS - 1);
  const table = new Map(computeStandings(allGames.filter(ended)).map((r) => [r.teamCode, r]));
  const context = (code: string, name: string) => {
    const r = table.get(code);
    if (!r || r.games === 0) return null;
    const streak = notableStreak(r);
    return `${name} ${r.rank}위${streak ? `(${streak.label} 중)` : ""}`;
  };
  return allGames
    .filter((g) => !g.ended && g.date >= today && g.date <= until && g.home.teamCode && g.away.teamCode)
    .map((g) => {
      const home = teamName(ctx.teamShort, g.home.teamCode, g.home.name);
      const away = teamName(ctx.teamShort, g.away.teamCode, g.away.name);
      const start = g.start ?? DEFAULT_START;
      const ranks = [context(g.home.teamCode, home), context(g.away.teamCode, away)].filter(Boolean).join(" · ");
      return {
        id: `pv:${g.gmkey}`,
        kind: "team_preview" as const,
        date: g.date,
        teams: [g.home.teamCode, g.away.teamCode],
        title: `오늘 ${start} ${home} vs ${away}`,
        body: [g.stadium, ranks].filter(Boolean).join(" · "),
        href: `/season/${ctx.seasonCode}/schedule?date=${g.date}`,
        startsAt: `${g.date}T${start}:00+09:00`,
      };
    });
}

// ─────────────────────────────────────────────
// ⑧ 이번 시즌 리그 최고 기록 — 홈 "새로 나온 기록"과 같은 규칙(leagueSeasonRecords)을 알림에도.
// 같은 경기·부문의 "개인 시즌 최다"는 리그 최고로 바꾸고, 커리어 하이와 겹치면 커리어 하이 한 줄에 덧붙인다.
// ─────────────────────────────────────────────

export function mergeLeagueRecords(items: readonly NotifItem[], allGames: readonly SeasonGame[], ctx: { seasonCode: number; teamShort: Record<string, string> }, windowDays = NOTIF_WINDOW_DAYS): NotifItem[] {
  const league = leagueSeasonRecords(allGames, ctx, windowDays);
  const byId = new Map(items.map((it) => [it.id, it]));
  const drop = new Set<string>();
  const extra: NotifItem[] = [];
  const patched = new Map<string, NotifItem>();
  for (const l of league) {
    const personalId = `h${l.id.slice(1)}`; // l:gm:pid:key → h:gm:pid:key
    const personal = byId.get(personalId);
    const item = { ...l, title: `${l.feat?.name ?? ""} 이번 시즌 리그 최고 ${l.feat?.text ?? ""}`.trim() };
    if (personal?.feat && (personal.feat.level === "career" || personal.feat.level === "careerTie")) {
      patched.set(personalId, { ...personal, body: `이번 시즌 리그 최고 기록 · ${personal.body}` });
      continue;
    }
    if (personal) drop.add(personalId);
    extra.push(item);
  }
  return [...items.filter((it) => !drop.has(it.id)).map((it) => patched.get(it.id) ?? it), ...extra];
}

// ─────────────────────────────────────────────
// ⑨ 경기당 부문 순위 (이번 시즌, 박스스코어 합계)
// ─────────────────────────────────────────────

export const LEADER_CATS = [
  { key: "pts", cat: "points", label: "득점", unit: "점" },
  { key: "reb", cat: "reb", label: "리바운드", unit: "개" },
  { key: "ast", cat: "ast", label: "어시스트", unit: "개" },
  { key: "stl", cat: "stl", label: "스틸", unit: "개" },
  { key: "blk", cat: "blk", label: "블록", unit: "개" },
  { key: "tpm", cat: "tpm", label: "3점슛", unit: "개" },
] as const;
type LeaderBoxKey = (typeof LEADER_CATS)[number]["key"];

/** 부문 순위 소식: 5위 안에 새로 들어오거나 1위가 됐을 때 */
export const LEADER_NOTIFY_TOP = 5;
/** 순위에 넣는 선수: 소속 팀 경기 수의 70% 이상 뛴 선수 (KBL 공식 규정이 아니라 우리 규칙 — 몇 경기 반짝한 선수가 1위가 되지 않게) */
export const LEADER_QUALIFY_SHARE = 0.7;

type Cum = { games: number; team: string; name: string } & Record<LeaderBoxKey, number>;

function leaderRanks(cum: ReadonlyMap<string, Cum>, teamGames: ReadonlyMap<string, number>): Map<LeaderBoxKey, Map<string, { rank: number; avg: number }>> {
  const qualified = [...cum.entries()].filter(([, c]) => c.games >= Math.ceil(LEADER_QUALIFY_SHARE * (teamGames.get(c.team) ?? 0)) && c.games > 0);
  const out = new Map<LeaderBoxKey, Map<string, { rank: number; avg: number }>>();
  for (const { key } of LEADER_CATS) {
    const avgs = qualified.map(([id, c]) => ({ id, avg: Math.round((c[key] / c.games) * 10) / 10 }));
    const m = new Map<string, { rank: number; avg: number }>();
    for (const a of avgs) m.set(a.id, { rank: 1 + avgs.filter((o) => o.avg > a.avg).length, avg: a.avg });
    out.set(key, m);
  }
  return out;
}

export function leaderRankItems(allGames: readonly SeasonGame[], ctx: { seasonCode: number }, windowDays = NOTIF_WINDOW_DAYS): NotifItem[] {
  const dates = windowDates(allGames, windowDays);
  const boxed = allGames.filter((g) => ended(g) && g.box).sort(byDate);
  const cum = new Map<string, Cum>();
  const teamGames = new Map<string, number>();
  const items: NotifItem[] = [];
  const days = [...new Set(boxed.map((g) => g.date))];
  for (const date of days) {
    const dayGames = boxed.filter((g) => g.date === date);
    const inWindow = dates.has(date);
    const before = inWindow ? leaderRanks(cum, teamGames) : null;
    const played = new Map<string, GameBoxRow>();
    for (const g of dayGames) {
      for (const side of ["home", "away"] as const) {
        teamGames.set(g[side].teamCode, (teamGames.get(g[side].teamCode) ?? 0) + 1);
        for (const r of g.box![side]) {
          if (r.sec <= 0) continue;
          const c = cum.get(r.id) ?? { games: 0, team: g[side].teamCode, name: r.nameKo, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0 };
          c.games += 1;
          c.team = g[side].teamCode;
          c.name = r.nameKo;
          for (const { key } of LEADER_CATS) c[key] += r[key];
          cum.set(r.id, c);
          played.set(r.id, r);
        }
      }
    }
    if (!before) continue;
    if (medianOf([...teamGames.values()]) < TEAM_RANK_MIN_GAMES) continue;
    const after = leaderRanks(cum, teamGames);
    for (const id of played.keys()) {
      const parts: { label: string; rank: number; avg: number; unit: string; cat: string }[] = [];
      for (const d of LEADER_CATS) {
        const now = after.get(d.key)!.get(id);
        if (!now || now.rank > LEADER_NOTIFY_TOP || now.avg <= 0) continue;
        const was = before.get(d.key)!.get(id)?.rank ?? Infinity;
        if ((now.rank === 1 && was !== 1) || was > LEADER_NOTIFY_TOP) parts.push({ label: d.label, rank: now.rank, avg: now.avg, unit: d.unit, cat: d.cat });
      }
      if (parts.length === 0) continue;
      parts.sort((a, b) => a.rank - b.rank);
      const name = cum.get(id)!.name;
      items.push({
        id: `lr:${date}:${id}`,
        kind: "leader_rank",
        date,
        player: id,
        title: `${name} 경기당 ${parts.map((p) => `${p.label} ${p.rank}위`).join(" · ")}`,
        body: `${parts.map((p) => `${p.label} ${p.avg.toFixed(1)}${p.unit}`).join(" · ")} · ${cum.get(id)!.games}경기`,
        href: `/season/${ctx.seasonCode}/leaders?cat=${parts[0].cat}`,
      });
    }
  }
  return items;
}

// ─────────────────────────────────────────────
// ⑩ 통산 역대 순위 상승 (정규시즌 통산 합계, 상위 ALLTIME_NOTIFY_TOP 안에서만)
// ─────────────────────────────────────────────

/** 역대 몇 위 안의 순위 상승만 알리나 (아래쪽은 하루에도 여러 번 바뀌어 소식이 아니라서 — 우리 규칙) */
export const ALLTIME_NOTIFY_TOP = 30;

const ALLTIME_CATS = [
  { key: "points", box: "pts", label: "득점", unit: "점" },
  { key: "reb", box: "reb", label: "리바운드", unit: "개" },
  { key: "ast", box: "ast", label: "어시스트", unit: "개" },
  { key: "stl", box: "stl", label: "스틸", unit: "개" },
  { key: "blk", box: "blk", label: "블록", unit: "개" },
  { key: "tpm", box: "tpm", label: "3점슛", unit: "개" },
] as const;

export function alltimeRankItems(
  allGames: readonly SeasonGame[],
  ctx: { careerSums: Record<string, CareerSums>; names: Record<string, string> },
  windowDays = NOTIF_WINDOW_DAYS,
): NotifItem[] {
  const dates = windowDates(allGames, windowDays);
  const boxed = allGames.filter((g) => ended(g) && g.box).sort(byDate);
  // 이번 시즌 뛴 선수: 날짜 끝 통산 값 (통산 합계에서 그 뒤 경기를 빼서 — 이정표와 같은 방법)
  const running = new Map<string, Record<string, number>>();
  for (const g of boxed) for (const side of ["home", "away"] as const) for (const r of g.box![side]) {
    const s = ctx.careerSums[r.id];
    if (s && !running.has(r.id)) running.set(r.id, { ...s });
  }
  const days = [...new Set(boxed.map((g) => g.date))].sort().reverse();
  const endOf = new Map<string, Map<string, Record<string, number>>>();
  const startOf = new Map<string, Map<string, Record<string, number>>>();
  const playedOn = new Map<string, Set<string>>();
  for (const date of days) {
    if (dates.has(date)) endOf.set(date, new Map([...running].map(([id, v]) => [id, { ...v }])));
    const ids = new Set<string>();
    for (const g of boxed.filter((x) => x.date === date)) for (const side of ["home", "away"] as const) for (const r of g.box![side]) {
      const cur = running.get(r.id);
      if (!cur || r.sec <= 0) continue;
      for (const c of ALLTIME_CATS) cur[c.key] -= r[c.box];
      ids.add(r.id);
    }
    if (dates.has(date)) {
      startOf.set(date, new Map([...running].map(([id, v]) => [id, { ...v }])));
      playedOn.set(date, ids);
    }
  }
  const everyone = Object.keys(ctx.careerSums);
  const items: NotifItem[] = [];
  for (const [date, ids] of playedOn) {
    const end = endOf.get(date)!;
    const start = startOf.get(date)!;
    const valAt = (snap: Map<string, Record<string, number>>, id: string, key: string) => snap.get(id)?.[key] ?? ctx.careerSums[id]?.[key as keyof CareerSums] ?? 0;
    for (const id of ids) {
      for (const c of ALLTIME_CATS) {
        const mineAfter = valAt(end, id, c.key);
        const mineBefore = valAt(start, id, c.key);
        if (mineAfter <= mineBefore) continue;
        let rankAfter = 1;
        let rankBefore = 1;
        let passed: { id: string; v: number } | null = null;
        for (const o of everyone) {
          if (o === id) continue;
          const oa = valAt(end, o, c.key);
          const ob = valAt(start, o, c.key);
          if (oa > mineAfter) rankAfter++;
          if (ob > mineBefore) rankBefore++;
          if (ob > mineBefore && oa < mineAfter && (!passed || oa > passed.v)) passed = { id: o, v: oa };
        }
        if (rankAfter > ALLTIME_NOTIFY_TOP || rankAfter >= rankBefore) continue;
        const name = ctx.names[id] ?? id;
        items.push({
          id: `at:${date}:${id}:${c.key}`,
          kind: "alltime_rank",
          date,
          player: id,
          title: `${name} 통산 ${c.label} 역대 ${rankAfter}위`,
          body: `${passed ? `${ctx.names[passed.id] ?? passed.id}(${NF.format(passed.v)}${c.unit}) 넘었어요 · ` : ""}지금 통산 ${NF.format(mineAfter)}${c.unit}`,
          href: `/records?cat=${c.key}`,
        });
      }
    }
  }
  return items;
}

// ─────────────────────────────────────────────
// ⑬ 생일 — 오늘 앞뒤 며칠 치를 미리 넣는다 (화면은 오늘까지만)
// ─────────────────────────────────────────────

export interface BirthdayPlayer {
  id: string;
  nameKo: string;
  birthday: string | null;
  teamShort: string;
}

/** 생일 소식: 지난 BIRTHDAY_PAST_DAYS 일 ~ 앞으로 PREVIEW_DAYS 일 */
export const BIRTHDAY_PAST_DAYS = 3;

export function birthdayItems(players: readonly BirthdayPlayer[], today: string, seasonCode: number): NotifItem[] {
  const items: NotifItem[] = [];
  for (let d = -BIRTHDAY_PAST_DAYS; d < PREVIEW_DAYS; d++) {
    const date = addDays(today, d);
    for (const { player, age } of birthdaysOn(players, date)) {
      items.push({
        id: `bd:${date}:${player.id}`,
        kind: "birthday",
        date,
        player: player.id,
        title: `${player.nameKo} 생일 (만 ${age}세)`,
        body: `${player.teamShort} · ${monthDay(date)}`,
        href: `/player/${player.id}?season=${seasonCode}`,
      });
    }
  }
  return items;
}

// ─────────────────────────────────────────────
// ⑭ 수상 — 공홈 수상 표에 새로 오른 날(data/award-first-seen.json, scripts/award-seen.ts)
// ─────────────────────────────────────────────

export interface SeenAward {
  seasonCode: number;
  seasonLabel: string;
  /** "정규리그 MVP" · "1라운드 MVP" */
  awardLabel: string;
  playerNo: string;
  name: string;
  team: string;
  /** 처음 본 한국 날짜 */
  date: string;
}

export function awardItems(awards: readonly SeenAward[], today: string, windowDays = NOTIF_WINDOW_DAYS): NotifItem[] {
  const from = addDays(today, -(windowDays - 1));
  return awards
    .filter((a) => a.date >= from && a.date <= today)
    .map((a) => ({
      id: `aw:${a.seasonCode}:${a.playerNo}:${a.awardLabel}`,
      kind: "award" as const,
      date: a.date,
      player: a.playerNo,
      title: `${a.name} ${a.awardLabel} 수상`,
      body: `${a.seasonLabel} 시즌${a.team ? ` · ${a.team}` : ""}`,
      href: `/records/awards?season=${a.seasonCode}`,
    }));
}
