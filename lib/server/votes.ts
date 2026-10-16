// 팬 참여 표 읽기·쓰기 (2026-10-16): member_votes(이번 주 팬 MVP). 표는 members.ts SCHEMA_SQL 에서 만든다.
// 값 검사(후보인지)는 부르는 쪽(API)이 정적 파일(lib/server/vote-data.ts)로 한다. 여기는 SQL 만.
// 탈퇴하면 같이 지워지고(ON DELETE CASCADE), 계정을 합치면 같이 합쳐진다(members.ts linkLogin).
import type { VoteTally } from "../votes";
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
