// 팬 참여 표 읽기·쓰기 (2026-10-16): member_votes(이번 주 팬 MVP)·member_picks(경기 승부 예측). 표는 members.ts SCHEMA_SQL 에서 만든다.
// 값 검사(후보인지·마감 전인지)는 부르는 쪽(API)이 정적 파일(lib/server/vote-data.ts)로 한다. 여기는 SQL 만.
// 탈퇴하면 같이 지워지고(ON DELETE CASCADE), 계정을 합치면 같이 합쳐진다(members.ts linkLogin).
import { PICK_RANKING_LIMIT, PICK_RANKING_MIN, rankPickRows, type MyPicks, type PickCounts, type PickRanking, type PickSide, type VoteTally } from "../votes";
import { normalizeTeamCodes } from "../account";
import { resolveMemberId, type Query } from "./members";

// ── 이번 주 팬 MVP ──

/** 한 표 (그 주에 이미 했으면 바꾼다) */
export async function castVote(q: Query, loginId: string, week: string, playerNo: string): Promise<void> {
  const id = await resolveMemberId(q, loginId);
  await q(
    `INSERT INTO member_votes (member_id, week, player_no) VALUES ($1, $2, $3)
     ON CONFLICT (member_id, week) DO UPDATE SET player_no = EXCLUDED.player_no, updated_at = now()`,
    [id, week, playerNo],
  );
}

/** 내 표 (주 이름 → 선수 번호) */
export async function myVotes(q: Query, loginId: string, weeks: readonly string[]): Promise<Record<string, string>> {
  const id = await resolveMemberId(q, loginId);
  const rows = await q(`SELECT week, player_no FROM member_votes WHERE member_id = $1 AND week = ANY($2::text[])`, [id, [...weeks]]);
  return Object.fromEntries(rows.map((r) => [String(r.week), String(r.player_no)]));
}

/** 주마다 선수별 표 수 (공개) */
export async function voteTallies(q: Query, weeks: readonly string[]): Promise<VoteTally[]> {
  const rows = await q(`SELECT week, player_no, count(*)::int AS n FROM member_votes WHERE week = ANY($1::text[]) GROUP BY week, player_no`, [[...weeks]]);
  return weeks.map((week) => {
    const counts: Record<string, number> = {};
    for (const r of rows) if (String(r.week) === week) counts[String(r.player_no)] = Number(r.n ?? 0);
    return { week, counts, total: Object.values(counts).reduce((s, n) => s + n, 0) };
  });
}

// ── 경기 승부 예측 ──

/** 예측 (그 경기에 이미 했으면 바꾼다) */
export async function setPick(q: Query, loginId: string, gmkey: string, side: PickSide): Promise<void> {
  const id = await resolveMemberId(q, loginId);
  await q(
    `INSERT INTO member_picks (member_id, gmkey, side) VALUES ($1, $2, $3)
     ON CONFLICT (member_id, gmkey) DO UPDATE SET side = EXCLUDED.side, updated_at = now()`,
    [id, gmkey, side],
  );
}

/** 경기 번호 앞부분(시즌, 예: "S49G") — LIKE 에 쓸 값 */
const prefixLike = (prefix: string) => `${prefix.replace(/[%_\\]/g, "")}%`;

/** 내 예측 (그 시즌) + 채점된 경기 적중 수 */
export async function myPicks(q: Query, loginId: string, prefix: string, settled: { gmkeys: string[]; winners: PickSide[] }): Promise<MyPicks> {
  const id = await resolveMemberId(q, loginId);
  const rows = await q(`SELECT gmkey, side FROM member_picks WHERE member_id = $1 AND gmkey LIKE $2`, [id, prefixLike(prefix)]);
  const picks: Record<string, PickSide> = {};
  for (const r of rows) if (r.side === "home" || r.side === "away") picks[String(r.gmkey)] = r.side;
  const winner = new Map(settled.gmkeys.map((k, i) => [k, settled.winners[i]]));
  let hits = 0;
  let total = 0;
  for (const [k, side] of Object.entries(picks)) {
    const w = winner.get(k);
    if (!w) continue;
    total += 1;
    if (w === side) hits += 1;
  }
  return { picks, hits, total };
}

/** 경기마다 [홈, 원정] 예측 수 (공개, 그 시즌) */
export async function pickCounts(q: Query, prefix: string): Promise<PickCounts> {
  const rows = await q(
    `SELECT gmkey, count(*) FILTER (WHERE side = 'home')::int AS h, count(*) FILTER (WHERE side = 'away')::int AS a
     FROM member_picks WHERE gmkey LIKE $1 GROUP BY gmkey`,
    [prefixLike(prefix)],
  );
  return Object.fromEntries(rows.map((r) => [String(r.gmkey), [Number(r.h ?? 0), Number(r.a ?? 0)] as [number, number]]));
}

/** 시즌 예측 순위: 닉네임을 정한 회원, 채점 경기 minPicks 이상 — 적중 수 → 적중률 → 닉네임 */
export async function pickRanking(
  q: Query,
  settled: { gmkeys: string[]; winners: PickSide[] },
  minPicks = PICK_RANKING_MIN,
  limit = PICK_RANKING_LIMIT,
): Promise<PickRanking> {
  if (settled.gmkeys.length === 0) return { rows: [], members: 0, minPicks };
  const rows = await q(
    `WITH settled AS (SELECT unnest($1::text[]) AS gmkey, unnest($2::text[]) AS winner),
     scored AS (
       SELECT p.member_id, count(*)::int AS total, count(*) FILTER (WHERE p.side = s.winner)::int AS hits
       FROM member_picks p JOIN settled s ON s.gmkey = p.gmkey GROUP BY p.member_id
     )
     SELECT sc.hits, sc.total, m.nickname, m.team_codes AS team_codes, count(*) OVER ()::int AS members
     FROM scored sc JOIN members m ON m.id = sc.member_id
     WHERE m.nickname IS NOT NULL AND sc.total >= $3
     ORDER BY sc.hits DESC, sc.hits::float / sc.total DESC, lower(m.nickname)
     LIMIT $4`,
    [settled.gmkeys, settled.winners, minPicks, limit],
  );
  const list = rankPickRows(
    rows.map((r) => ({
      nickname: String(r.nickname),
      teamCode: (normalizeTeamCodes(Array.isArray(r.team_codes) ? r.team_codes : []) ?? [])[0] ?? null,
      hits: Number(r.hits ?? 0),
      total: Number(r.total ?? 0),
    })),
  );
  return { rows: list, members: Number(rows[0]?.members ?? 0), minPicks };
}
