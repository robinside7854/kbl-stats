// 회원 표 읽기·쓰기 (SQL 한 곳). 데이터베이스 연결은 받아서 쓴다(Query) — 운영은 Neon(lib/server/db.ts),
// 테스트는 PGlite(tests/account.test.ts). 개인정보 최소(2026-10-04 사용자 결정): 이메일·실명·사진 열이 없다.
// 표 두 개 (2026-10-04 계정 연결):
//   members        회원 (회원 번호·닉네임·응원팀·즐겨찾기 배열)
//   member_logins  로그인 번호("google:…","naver:…") → 회원 번호. 회원 하나에 회사마다 하나씩.
// 로그인 쿠키에는 로그인 번호만 있다 → 함수들은 로그인 번호를 받아 회원을 찾는다(resolveMemberId).
// 연결 기능 이전 회원은 회원 번호 = 로그인 번호였다(표 준비 때 member_logins 에 옮겨 적음). 새 회원 번호는 "m:무작위".
import {
  LOGIN_PROVIDERS, MAX_FAVORITES, mergeFavorites, providerOfMemberId, sanitizeFavorites,
  type AdminMemberRow, type LoginProvider, type MemberView,
} from "../account";

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
  `CREATE TABLE IF NOT EXISTS member_logins (
    login_id text PRIMARY KEY,
    member_id text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    provider text NOT NULL,
    linked_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS member_logins_member ON member_logins (member_id)`,
  // 연결 기능 이전 회원(로그인 수단이 하나도 안 적힌 회원): 회원 번호가 곧 로그인 번호
  `INSERT INTO member_logins (login_id, member_id, provider)
    SELECT m.id, m.id, m.provider FROM members m
    WHERE NOT EXISTS (SELECT 1 FROM member_logins l WHERE l.member_id = m.id)
    ON CONFLICT (login_id) DO NOTHING`,
];

export async function ensureSchema(q: Query): Promise<void> {
  for (const s of SCHEMA_SQL) await q(s);
}

function newMemberId(): string {
  return `m:${globalThis.crypto.randomUUID()}`;
}

async function memberOfLogin(q: Query, loginId: string): Promise<string | null> {
  const rows = await q(`SELECT member_id FROM member_logins WHERE login_id = $1`, [loginId]);
  return (rows[0]?.member_id as string | undefined) ?? null;
}

/** 로그인 번호 → 회원 번호 (처음 보는 로그인이면 회원을 새로 만든다) */
export async function resolveMemberId(q: Query, loginId: string): Promise<string> {
  const provider = providerOfMemberId(loginId);
  if (!provider) throw new Error("bad login id");
  const found = await memberOfLogin(q, loginId);
  if (found) return found;
  const id = newMemberId();
  await q(`INSERT INTO members (id, provider) VALUES ($1, $2)`, [id, provider]);
  await q(`INSERT INTO member_logins (login_id, member_id, provider) VALUES ($1, $2, $3) ON CONFLICT (login_id) DO NOTHING`, [loginId, id, provider]);
  const owner = await memberOfLogin(q, loginId);
  // 거의 동시에 두 요청이 처음 들어온 경우: 먼저 적힌 회원을 쓰고 방금 만든 빈 회원은 지운다
  if (owner !== id) await q(`DELETE FROM members WHERE id = $1`, [id]);
  return owner ?? id;
}

function asProviders(v: unknown): LoginProvider[] {
  const list = Array.isArray(v) ? v : [];
  return LOGIN_PROVIDERS.filter((p) => list.includes(p));
}

async function loginsOf(q: Query, memberId: string): Promise<{ loginId: string; provider: LoginProvider }[]> {
  const rows = await q(`SELECT login_id, provider FROM member_logins WHERE member_id = $1`, [memberId]);
  return rows.flatMap((r) => {
    const provider = providerOfMemberId(String(r.login_id));
    return provider ? [{ loginId: String(r.login_id), provider }] : [];
  });
}

/** 회원에 붙은 로그인 번호 전부 (관리자 판정용) */
export async function loginIdsOfLogin(q: Query, loginId: string): Promise<string[]> {
  const memberId = await memberOfLogin(q, loginId);
  return memberId ? (await loginsOf(q, memberId)).map((l) => l.loginId) : [loginId];
}

async function viewOf(q: Query, memberId: string, loginId: string): Promise<MemberView> {
  const rows = await q(`SELECT nickname, team_code, favorites FROM members WHERE id = $1`, [memberId]);
  const row = rows[0];
  return {
    provider: providerOfMemberId(loginId),
    nickname: (row?.nickname as string | null) ?? null,
    teamCode: (row?.team_code as string | null) ?? null,
    favorites: sanitizeFavorites(row?.favorites ?? []),
    logins: asProviders((await loginsOf(q, memberId)).map((l) => l.provider)),
  };
}

/** 회원 정보 (없으면 만든다 — 로그인한 뒤 처음 부를 때) */
export async function getOrCreateMember(q: Query, loginId: string): Promise<MemberView> {
  return viewOf(q, await resolveMemberId(q, loginId), loginId);
}

export type ProfileResult = { ok: true; member: MemberView } | { ok: false; error: "nickname_taken" };

/** 닉네임·응원팀 저장 (값 검사는 부르는 쪽 — lib/account validateNickname·normalizeTeamCode) */
export async function updateProfile(q: Query, loginId: string, patch: { nickname?: string | null; teamCode?: string | null }): Promise<ProfileResult> {
  const id = await resolveMemberId(q, loginId);
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
  return { ok: true, member: await viewOf(q, id, loginId) };
}

/** 즐겨찾기 목록 통째로 바꾸기 → 저장된 목록 */
export async function setFavorites(q: Query, loginId: string, list: readonly string[]): Promise<string[]> {
  const clean = sanitizeFavorites(list).slice(0, MAX_FAVORITES);
  const id = await resolveMemberId(q, loginId);
  await q(`UPDATE members SET favorites = $2::text[], updated_at = now() WHERE id = $1`, [id, clean]);
  return clean;
}

/** 탈퇴: 회원 행과 연결된 로그인 수단을 바로 지운다 (보관하지 않음) */
export async function deleteMember(q: Query, loginId: string): Promise<void> {
  const id = await memberOfLogin(q, loginId);
  if (id) await q(`DELETE FROM members WHERE id = $1`, [id]);
}

export type LinkOutcome = { ok: true; merged: boolean } | { ok: false; error: "conflict" | "bad" };

/**
 * 계정 연결: 지금 회원(currentLoginId 로 로그인한 사람)에 새 로그인 번호를 붙인다.
 * - 처음 보는 로그인 → 그대로 붙임
 * - 이미 따로 가입한 로그인 → 그 회원을 지금 회원에 합침: 즐겨찾기는 합치고(지금 회원 순서 먼저),
 *   닉네임·응원팀은 지금 회원 값(비어 있으면 그쪽 값), 그쪽 로그인 수단은 모두 옮기고 그 회원은 지운다
 * - 같은 회사 로그인이 두 회원에 다 있으면(합치면 한 회사가 둘) → conflict
 */
export async function linkLogin(q: Query, currentLoginId: string, newLoginId: string): Promise<LinkOutcome> {
  const provider = providerOfMemberId(newLoginId);
  if (!provider || !providerOfMemberId(currentLoginId)) return { ok: false, error: "bad" };
  const me = await resolveMemberId(q, currentLoginId);
  const owner = await memberOfLogin(q, newLoginId);
  if (owner === me) return { ok: true, merged: false };
  const mine = await loginsOf(q, me);
  if (mine.some((l) => l.provider === provider)) return { ok: false, error: "conflict" };
  if (!owner) {
    await q(`INSERT INTO member_logins (login_id, member_id, provider) VALUES ($1, $2, $3)`, [newLoginId, me, provider]);
    await q(`UPDATE members SET updated_at = now() WHERE id = $1`, [me]);
    return { ok: true, merged: false };
  }
  const theirs = await loginsOf(q, owner);
  if (theirs.some((t) => mine.some((m) => m.provider === t.provider))) return { ok: false, error: "conflict" };

  const [a] = await q(`SELECT nickname, team_code, favorites FROM members WHERE id = $1`, [me]);
  const [b] = await q(`SELECT nickname, team_code, favorites FROM members WHERE id = $1`, [owner]);
  const favorites = mergeFavorites(sanitizeFavorites(a?.favorites ?? []), sanitizeFavorites(b?.favorites ?? []));
  // 순서: 즐겨찾기·응원팀 → 로그인 수단 옮기기 → 그 회원 지우기 → 닉네임(유일 인덱스라 그 회원을 지운 뒤에)
  await q(`UPDATE members SET favorites = $2::text[], team_code = COALESCE(team_code, $3), updated_at = now() WHERE id = $1`, [
    me, favorites, (b?.team_code as string | null) ?? null,
  ]);
  await q(`UPDATE member_logins SET member_id = $1, linked_at = now() WHERE member_id = $2`, [me, owner]);
  await q(`DELETE FROM members WHERE id = $1`, [owner]);
  if (!a?.nickname && b?.nickname) await q(`UPDATE members SET nickname = $2 WHERE id = $1 AND nickname IS NULL`, [me, b.nickname]);
  return { ok: true, merged: true };
}

export type UnlinkOutcome = { ok: true; member: MemberView } | { ok: false; error: "last" | "current" | "missing" };

/** 연결 해제: 로그인 수단이 하나만 남으면 안 되고, 지금 로그인한 수단은 풀 수 없다 */
export async function unlinkLogin(q: Query, currentLoginId: string, provider: LoginProvider): Promise<UnlinkOutcome> {
  const me = await resolveMemberId(q, currentLoginId);
  const mine = await loginsOf(q, me);
  if (!mine.some((l) => l.provider === provider)) return { ok: false, error: "missing" };
  if (providerOfMemberId(currentLoginId) === provider) return { ok: false, error: "current" };
  if (mine.length <= 1) return { ok: false, error: "last" };
  await q(`DELETE FROM member_logins WHERE member_id = $1 AND provider = $2`, [me, provider]);
  await q(`UPDATE members SET updated_at = now() WHERE id = $1`, [me]);
  return { ok: true, member: await viewOf(q, me, currentLoginId) };
}

/** 관리자 화면: 전체 회원 (새로 가입한 순) */
export async function listMembers(q: Query): Promise<AdminMemberRow[]> {
  const rows = await q(`SELECT m.id, m.nickname, m.team_code, cardinality(m.favorites) AS fav,
      m.created_at, m.updated_at, array_remove(array_agg(l.provider), NULL) AS logins
    FROM members m LEFT JOIN member_logins l ON l.member_id = m.id
    GROUP BY m.id ORDER BY m.created_at DESC`);
  return rows.map((r) => ({
    shortId: String(r.id).replace(/[^A-Za-z0-9]/g, "").slice(-6),
    nickname: (r.nickname as string | null) ?? null,
    teamCode: (r.team_code as string | null) ?? null,
    favoriteCount: Number(r.fav ?? 0),
    logins: asProviders(r.logins),
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  }));
}
