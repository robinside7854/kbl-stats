// 시즌 경기 + 선수 박스스코어 — 순수 함수 (process.ts·테스트). 2026-10-03 사용자 요청: 홈 "오늘의 경기"·팀 순위.
// 재료 (둘 다 이미 매일 받는 raw):
//   - 경기 목록 data/raw/games/{시즌}/list.json (서버 C, 항목 { gmkey, gameCode, gameNo, gameDate, gameStart, tcodeH/A, tnameH/A, scoreH/A, isEnded, stadiumname })
//   - 경기별 기록 data/raw/gamelogs/{시즌}/{선수}.json (서버 B RegularGameRecords: { gameNo, gameDate, teamCode(그 선수 팀), awayTeam(상대 팀 —
//     홈/원정이 아니라 "상대"), playSec, pts, fdg/fdgA(전체 야투), threep/threepA, ft/ftA, oR, dR, rb, aS, sT, bS, tO, foulTot })
// 박스스코어 = 경기별 기록을 (경기 번호, 날짜, 팀)으로 경기에 붙인 것. 매일 수집은 현재 시즌 선수 전원이라 현재 시즌은 다 맞고,
// 과거 시즌은 커리어 하이 경기만 있어 득점 합이 점수와 다르다 → 그 경기는 box null (잘못된 표를 보여 주지 않게).
// KBL 원본 필드명은 이 파일에서만 다룬다.
import type { GameBoxRow, SeasonGame } from "../lib/types.js";
import { isEndedGame } from "./shots.js";
import { toIsoDate } from "./highs.js";

type Raw = Record<string, any>;

function unwrap(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

const num = (v: unknown) => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? 0 : n;
};
const numOrNull = (v: unknown) => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n;
};

/** 선수 한 명의 경기별 기록 한 줄 (박스스코어 재료) */
export interface BoxLogRow extends Omit<GameBoxRow, "id" | "nameKo"> {
  gameNo: string | null;
  date: string | null;
  teamCode: string;
  oppCode: string;
}

/** 경기별 기록 raw → 정규시즌 경기 줄 (형태가 다르면 빈 배열) */
export function parseBoxLog(parsed: unknown): BoxLogRow[] {
  const o = unwrap(parsed) as Raw | null;
  const list = o && typeof o === "object" ? unwrap(o.RegularGameRecords) : null;
  if (!Array.isArray(list)) return [];
  return list
    .filter((g): g is Raw => !!g && typeof g === "object")
    .map((g) => ({
      gameNo: g.gameNo === null || g.gameNo === undefined || g.gameNo === "" ? null : String(g.gameNo),
      date: toIsoDate(g.gameDate),
      teamCode: String(g.teamCode ?? ""),
      oppCode: String(g.awayTeam ?? ""),
      sec: num(g.playSec),
      pts: num(g.pts),
      oreb: num(g.oR),
      dreb: num(g.dR),
      reb: num(g.rb),
      ast: num(g.aS),
      stl: num(g.sT),
      blk: num(g.bS),
      tov: num(g.tO),
      pf: num(g.foulTot),
      fgm: num(g.fdg),
      fga: num(g.fdgA),
      tpm: num(g.threep),
      tpa: num(g.threepA),
      ftm: num(g.ft),
      fta: num(g.ftA),
    }));
}

/** "1400" → "14:00" */
function hhmm(v: unknown): string | null {
  const s = String(v ?? "").replace(/\D/g, "");
  return s.length === 4 ? `${s.slice(0, 2)}:${s.slice(2)}` : null;
}

/**
 * 경기 목록 + 선수별 경기별 기록 → 시즌 정규시즌 경기 (날짜·경기 번호 순, gmkey 중복은 처음 것).
 * logs: 선수 번호 → 경기별 기록 줄, nameOf: 선수 번호 → 이름(시즌 명단, 없으면 번호).
 * today("YYYY-MM-DD")는 옛 시즌 끝남 판정용(isEndedGame).
 */
export function buildSeasonGames(
  list: unknown,
  seasonCode: number,
  logs: ReadonlyMap<string, readonly BoxLogRow[]>,
  nameOf: (id: string) => string | null,
  today?: string,
): SeasonGame[] {
  const arr = unwrap(list);
  if (!Array.isArray(arr)) return [];
  // 경기 번호 → 팀 코드 → 선수 줄
  const byGame = new Map<string, Map<string, GameBoxRow[]>>();
  const dateOf = new Map<string, string | null>();
  for (const [id, rows] of logs) {
    for (const r of rows) {
      if (!r.gameNo || !r.teamCode) continue;
      const key = `${r.gameNo}|${r.date ?? ""}`;
      dateOf.set(key, r.date);
      let teams = byGame.get(key);
      if (!teams) byGame.set(key, (teams = new Map()));
      const list = teams.get(r.teamCode) ?? [];
      const { gameNo: _g, date: _d, teamCode: _t, oppCode: _o, ...stats } = r;
      list.push({ id, nameKo: nameOf(id) ?? id, ...stats });
      teams.set(r.teamCode, list);
    }
  }
  const seen = new Set<string>();
  const out: SeasonGame[] = [];
  for (const item of arr as Raw[]) {
    if (!item || typeof item !== "object") continue;
    const gmkey = String(item.gmkey ?? "");
    const sc = Number(item.seasonCode ?? /^S(\d+)G/.exec(gmkey)?.[1]);
    if (!gmkey || sc !== seasonCode || String(item.gameCode ?? "") !== "01" || seen.has(gmkey)) continue;
    seen.add(gmkey);
    const date = toIsoDate(item.gameDate);
    if (!date) continue;
    const ended = isEndedGame(item, today);
    const home = { teamCode: String(item.tcodeH ?? ""), name: String(item.tnameH ?? ""), score: numOrNull(item.scoreH) };
    const away = { teamCode: String(item.tcodeA ?? ""), name: String(item.tnameA ?? ""), score: numOrNull(item.scoreA) };
    const teams = byGame.get(`${item.gameNo}|${date}`);
    let box: SeasonGame["box"] = null;
    if (ended && teams && home.score !== null && away.score !== null) {
      const h = teams.get(home.teamCode) ?? [];
      const a = teams.get(away.teamCode) ?? [];
      const sum = (rows: GameBoxRow[]) => rows.reduce((s, r) => s + r.pts, 0);
      if (h.length > 0 && a.length > 0 && sum(h) === home.score && sum(a) === away.score) {
        const order = (x: GameBoxRow, y: GameBoxRow) => y.sec - x.sec || y.pts - x.pts || x.nameKo.localeCompare(y.nameKo, "ko");
        box = { home: [...h].sort(order), away: [...a].sort(order) };
      }
    }
    out.push({ gmkey, date, start: hhmm(item.gameStart), stadium: item.stadiumname ? String(item.stadiumname) : null, ended, home, away, box });
  }
  const no = (g: SeasonGame) => Number(/N(\d+)$/.exec(g.gmkey)?.[1] ?? 0);
  return out.sort((a, b) => a.date.localeCompare(b.date) || no(a) - no(b));
}
