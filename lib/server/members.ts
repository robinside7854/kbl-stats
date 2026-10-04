// 회원 표 읽기·쓰기 (SQL 한 곳). 데이터베이스 연결은 받아서 쓴다(Query) — 운영은 Neon(lib/server/db.ts),
// 테스트는 PGlite(tests/account.test.ts). 표는 하나: members (회원 번호·로그인 회사·닉네임·응원팀·즐겨찾기 배열).
// 개인정보 최소(2026-10-04 사용자 결정): 이메일·실명·사진 열이 없다.
import { MAX_FAVORITES, providerOfMemberId, sanitizeFavorites, type MemberView } from "../account";

/** SQL 문장 + 값($1, $2 …) → 행 목록 */
export type Query = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

/** 표가 없으면 만든다 (첫 요청 때 한 번 — 관리 화면에서 SQL 을 따로 돌리지 않아도 되게) */
export const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS members (
    id text PRIMARY KEY,
    provider text NOT NULL,
    nickname text,
    team_code text,
    favorites text[] NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  // 닉네임은 대소문자를 무시하고 한 사람만
  `CREATE UNIQUE INDEX IF NOT EXISTS members_nickname_lower ON members (lower(nickname)) WHERE nickname IS NOT NULL`,
];

export async function ensureSchema(q: Query): Promise<void> {
  for (const s of SCHEMA_SQL) await q(s);
}

function toView(row: Record<string, unknown> | undefined, id: string): MemberView {
  return {
    provider: providerOfMemberId(id),
    nickname: (row?.nickname as string | null) ?? null,
    teamCode: (row?.team_code as string | null) ?? null,
    favorites: sanitizeFavorites(row?.favorites ?? []),
  };
}

/** 회원 정보 (없으면 만든다 — 로그인한 뒤 처음 부를 때) */
export async function getOrCreateMember(q: Query, id: string): Promise<MemberView> {
  const provider = providerOfMemberId(id);
  if (!provider) throw new Error("bad member id");
  await q(`INSERT INTO members (id, provider) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [id, provider]);
  const rows = await q(`SELECT nickname, team_code, favorites FROM members WHERE id = $1`, [id]);
  return toView(rows[0], id);
}

export type ProfileResult = { ok: true; member: MemberView } | { ok: false; error: "nickname_taken" };

/** 닉네임·응원팀 저장 (값 검사는 부르는 쪽 — lib/account validateNickname·normalizeTeamCode) */
export async function updateProfile(q: Query, id: string, patch: { nickname?: string | null; teamCode?: string | null }): Promise<ProfileResult> {
  await getOrCreateMember(q, id);
  if (patch.nickname) {
    const taken = await q(`SELECT 1 FROM members WHERE lower(nickname) = lower($1) AND id <> $2`, [patch.nickname, id]);
    if (taken.length > 0) return { ok: false, error: "nickname_taken" };
  }
  try {
    if (patch.nickname !== undefined) await q(`UPDATE members SET nickname = $2, updated_at = now() WHERE id = $1`, [id, patch.nickname]);
    if (patch.teamCode !== undefined) await q(`UPDATE members SET team_code = $2, updated_at = now() WHERE id = $1`, [id, patch.teamCode]);
  } catch (e) {
    // 거의 동시에 같은 닉네임을 저장한 경우 (유일 인덱스)
    if (String((e as { code?: string })?.code) === "23505") return { ok: false, error: "nickname_taken" };
    throw e;
  }
  return { ok: true, member: await getOrCreateMember(q, id) };
}

/** 즐겨찾기 목록 통째로 바꾸기 → 저장된 목록 */
export async function setFavorites(q: Query, id: string, list: readonly string[]): Promise<string[]> {
  const clean = sanitizeFavorites(list).slice(0, MAX_FAVORITES);
  await getOrCreateMember(q, id);
  await q(`UPDATE members SET favorites = $2::text[], updated_at = now() WHERE id = $1`, [id, clean]);
  return clean;
}

/** 탈퇴: 회원 행을 바로 지운다 (보관하지 않음) */
export async function deleteMember(q: Query, id: string): Promise<void> {
  await q(`DELETE FROM members WHERE id = $1`, [id]);
}
