// 회원 표 읽기·쓰기 (SQL 한 곳). 데이터베이스 연결은 받아서 쓴다(Query) — 운영은 Neon(lib/server/db.ts),
// 테스트는 PGlite(tests/account.test.ts). 개인정보 최소(2026-10-04 사용자 결정): 이메일·실명·사진 열이 없다.
// 표 두 개 (2026-10-04 계정 연결):
//   members        회원 (회원 번호·닉네임·응원팀·즐겨찾기 배열)
//   member_logins  로그인 번호("google:…","naver:…") → 회원 번호. 회원 하나에 회사마다 하나씩.
// 로그인 쿠키에는 로그인 번호만 있다 → 함수들은 로그인 번호를 받아 회원을 찾는다(resolveMemberId).
// 연결 기능 이전 회원은 회원 번호 = 로그인 번호였다(표 준비 때 member_logins 에 옮겨 적음). 새 회원 번호는 "m:무작위".
import {
  GAME_BONUS_KEYS, GAME_HISTORY_LIMIT, MAX_GAME_RECORDS, type GameHistory, type GameRecord, type GameRecordInput,
  LOGIN_PROVIDERS, MAX_FAVORITES, MAX_LIKES, MAX_TEAMS, mergeFavorites, normalizeTeamCodes, providerOfMemberId, sanitizeFavorites,
  type AdminMemberRow, type GameRanking, type GameRankRow, type LikeCounts, type RankingWeek, GAME_RANKING_LIMIT, kstWeekStart, type LikeKind, type LoginProvider, type MemberView, type MyLikes,
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
  // 응원팀 여러 팀 (옛 회원은 대표 팀 하나를 옮겨 적음)
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS team_codes text[] NOT NULL DEFAULT '{}'`,
  `UPDATE members SET team_codes = ARRAY[team_code] WHERE team_code IS NOT NULL AND cardinality(team_codes) = 0`,
  `CREATE TABLE IF NOT EXISTS member_likes (
    member_id text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    kind text NOT NULL,
    target text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, kind, target)
  )`,
  `CREATE INDEX IF NOT EXISTS member_likes_target ON member_likes (kind, target)`,
  // 54-0 내 기록 (2026-10-04) — 라인업 하나에 한 줄(같은 라인업 = 같은 성적), 회원마다 최근 MAX_GAME_RECORDS 개
  `CREATE TABLE IF NOT EXISTS member_games (
    member_id text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    lineup text NOT NULL,
    wins int NOT NULL,
    rating real NOT NULL,
    bonuses text[] NOT NULL DEFAULT '{}',
    names text[] NOT NULL DEFAULT '{}',
    played_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, lineup)
  )`,
  `CREATE INDEX IF NOT EXISTS member_games_recent ON member_games (member_id, played_at DESC)`,
  // 54-0 주간 순위 (2026-10-05) — 서버가 라인업으로 다시 계산해 맞춘 기록만 순위에 (그 전 기록은 false)
  `ALTER TABLE member_games ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false`,
  `CREATE INDEX IF NOT EXISTS member_games_week ON member_games (played_at) WHERE verified`,
  // 업데이트 소식 삭제 (2026-10-05) — 글은 코드(lib/updates)에 있으니 관리자가 지운 글 번호만 적어 두고 화면이 숨긴다
  `CREATE TABLE IF NOT EXISTS hidden_updates (
    slug text PRIMARY KEY,
    hidden_at timestamptz NOT NULL DEFAULT now()
  )`,
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

function teamsOf(v: unknown): string[] {
  return normalizeTeamCodes(Array.isArray(v) ? v : []) ?? [];
}

async function likesOf(q: Query, memberId: string): Promise<MyLikes> {
  const rows = await q(`SELECT kind, target FROM member_likes WHERE member_id = $1 ORDER BY created_at`, [memberId]);
  return {
    players: rows.filter((r) => r.kind === "player").map((r) => String(r.target)),
    teams: rows.filter((r) => r.kind === "team").map((r) => String(r.target)),
  };
}

async function viewOf(q: Query, memberId: string, loginId: string): Promise<MemberView> {
  const rows = await q(`SELECT nickname, team_codes, favorites FROM members WHERE id = $1`, [memberId]);
  const row = rows[0];
  const teamCodes = teamsOf(row?.team_codes);
  return {
    provider: providerOfMemberId(loginId),
    nickname: (row?.nickname as string | null) ?? null,
    teamCode: teamCodes[0] ?? null,
    teamCodes,
    favorites: sanitizeFavorites(row?.favorites ?? []),
    likes: await likesOf(q, memberId),
    logins: asProviders((await loginsOf(q, memberId)).map((l) => l.provider)),
  };
}

/** 회원 정보 (없으면 만든다 — 로그인한 뒤 처음 부를 때) */
export async function getOrCreateMember(q: Query, loginId: string): Promise<MemberView> {
  return viewOf(q, await resolveMemberId(q, loginId), loginId);
}

export type ProfileResult = { ok: true; member: MemberView } | { ok: false; error: "nickname_taken" };

/** 닉네임·응원팀 저장 (값 검사는 부르는 쪽 — lib/account validateNickname·normalizeTeamCodes). teamCode 하나만 오면 그 팀 하나로 */
export async function updateProfile(
  q: Query,
  loginId: string,
  patch: { nickname?: string | null; teamCode?: string | null; teamCodes?: string[] },
): Promise<ProfileResult> {
  const id = await resolveMemberId(q, loginId);
  if (patch.nickname) {
    const taken = await q(`SELECT 1 FROM members WHERE lower(nickname) = lower($1) AND id <> $2`, [patch.nickname, id]);
    if (taken.length > 0) return { ok: false, error: "nickname_taken" };
  }
  try {
    if (patch.nickname !== undefined) await q(`UPDATE members SET nickname = $2, updated_at = now() WHERE id = $1`, [id, patch.nickname]);
    const teams = patch.teamCodes !== undefined ? patch.teamCodes.slice(0, MAX_TEAMS) : patch.teamCode !== undefined ? (patch.teamCode ? [patch.teamCode] : []) : null;
    if (teams) await q(`UPDATE members SET team_codes = $2::text[], team_code = $3, updated_at = now() WHERE id = $1`, [id, teams, teams[0] ?? null]);
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

  const [a] = await q(`SELECT nickname, team_codes, favorites FROM members WHERE id = $1`, [me]);
  const [b] = await q(`SELECT nickname, team_codes, favorites FROM members WHERE id = $1`, [owner]);
  const favorites = mergeFavorites(sanitizeFavorites(a?.favorites ?? []), sanitizeFavorites(b?.favorites ?? []));
  const myTeams = teamsOf(a?.team_codes);
  const teams = myTeams.length > 0 ? myTeams : teamsOf(b?.team_codes);
  // 순서: 즐겨찾기·응원팀·좋아요 → 로그인 수단 옮기기 → 그 회원 지우기 → 닉네임(유일 인덱스라 그 회원을 지운 뒤에)
  await q(`UPDATE members SET favorites = $2::text[], team_codes = $3::text[], team_code = $4, updated_at = now() WHERE id = $1`, [
    me, favorites, teams, teams[0] ?? null,
  ]);
  // 좋아요는 합친다 (같은 대상은 한 번)
  await q(`INSERT INTO member_likes (member_id, kind, target, created_at)
    SELECT $1, kind, target, created_at FROM member_likes WHERE member_id = $2
    ON CONFLICT (member_id, kind, target) DO NOTHING`, [me, owner]);
  // 54-0 기록도 합친다 (같은 라인업은 지금 회원 것)
  await q(`INSERT INTO member_games (member_id, lineup, wins, rating, bonuses, names, played_at, verified)
    SELECT $1, lineup, wins, rating, bonuses, names, played_at, verified FROM member_games WHERE member_id = $2
    ON CONFLICT (member_id, lineup) DO NOTHING`, [me, owner]);
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
  const rows = await q(`SELECT m.id, m.nickname, m.team_codes, cardinality(m.favorites) AS fav,
      (SELECT count(*) FROM member_likes k WHERE k.member_id = m.id) AS likes,
      m.created_at, m.updated_at, array_remove(array_agg(l.provider), NULL) AS logins
    FROM members m LEFT JOIN member_logins l ON l.member_id = m.id
    GROUP BY m.id ORDER BY m.created_at DESC`);
  return rows.map((r) => ({
    shortId: String(r.id).replace(/[^A-Za-z0-9]/g, "").slice(-6),
    nickname: (r.nickname as string | null) ?? null,
    teamCodes: teamsOf(r.team_codes),
    favoriteCount: Number(r.fav ?? 0),
    likeCount: Number(r.likes ?? 0),
    logins: asProviders(r.logins),
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  }));
}

export type LikeOutcome = { ok: true; likes: MyLikes } | { ok: false; error: "limit" };

/** 좋아요 켜기·끄기 (대상 검사는 부르는 쪽 — lib/account validLikeTarget) */
export async function setLike(q: Query, loginId: string, kind: LikeKind, target: string, liked: boolean): Promise<LikeOutcome> {
  const id = await resolveMemberId(q, loginId);
  if (liked) {
    const [c] = await q(`SELECT count(*)::int AS n FROM member_likes WHERE member_id = $1`, [id]);
    const exists = await q(`SELECT 1 FROM member_likes WHERE member_id = $1 AND kind = $2 AND target = $3`, [id, kind, target]);
    if (exists.length === 0 && Number(c?.n ?? 0) >= MAX_LIKES) return { ok: false, error: "limit" };
    await q(`INSERT INTO member_likes (member_id, kind, target) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [id, kind, target]);
  } else {
    await q(`DELETE FROM member_likes WHERE member_id = $1 AND kind = $2 AND target = $3`, [id, kind, target]);
  }
  return { ok: true, likes: await likesOf(q, id) };
}

/** 좋아요 수 전부 (공개 — 선수·팀별 회원 수) */
export async function likeCounts(q: Query): Promise<LikeCounts> {
  const rows = await q(`SELECT kind, target, count(*)::int AS n FROM member_likes GROUP BY kind, target`);
  const out: LikeCounts = { players: {}, teams: {}, fans: {} };
  for (const r of rows) {
    const n = Number(r.n ?? 0);
    if (r.kind === "player") out.players[String(r.target)] = n;
    else if (r.kind === "team") out.teams[String(r.target)] = n;
  }
  // 팀 팬 수: 응원팀으로 고른 회원 (여러 팀이면 팀마다)
  const fans = await q(`SELECT code, count(DISTINCT id)::int AS n FROM members, unnest(team_codes) AS code GROUP BY code`);
  for (const r of fans) out.fans[String(r.code)] = Number(r.n ?? 0);
  return out;
}

// ── 54-0 내 기록 ──

/** 기록 저장 (같은 라인업이면 시각·값만 새로) — 오래된 것부터 MAX_GAME_RECORDS 넘는 만큼 지운다 */
export async function saveGameRecord(q: Query, loginId: string, rec: GameRecordInput): Promise<void> {
  const id = await resolveMemberId(q, loginId);
  await q(
    `INSERT INTO member_games (member_id, lineup, wins, rating, bonuses, names, verified) VALUES ($1, $2, $3, $4, $5::text[], $6::text[], $7)
     ON CONFLICT (member_id, lineup) DO UPDATE SET wins = EXCLUDED.wins, rating = EXCLUDED.rating, bonuses = EXCLUDED.bonuses,
       names = EXCLUDED.names, verified = EXCLUDED.verified, played_at = now()`,
    [id, rec.lineup, rec.wins, rec.rating, rec.bonuses, rec.names, rec.verified === true],
  );
  await q(
    `DELETE FROM member_games WHERE member_id = $1 AND lineup IN (
      SELECT lineup FROM member_games WHERE member_id = $1 ORDER BY played_at DESC, lineup OFFSET $2)`,
    [id, MAX_GAME_RECORDS],
  );
}

/** 내 기록: 최근 GAME_HISTORY_LIMIT 판 + 판 수·최고 승수·전승 횟수 */
export async function gameHistory(q: Query, loginId: string): Promise<GameHistory> {
  const id = await resolveMemberId(q, loginId);
  const rows = await q(
    `SELECT lineup, wins, rating, bonuses, names, played_at FROM member_games WHERE member_id = $1 ORDER BY played_at DESC, lineup LIMIT $2`,
    [id, GAME_HISTORY_LIMIT],
  );
  const [sum] = await q(
    `SELECT count(*)::int AS plays, max(wins) AS best, count(*) FILTER (WHERE wins = 54)::int AS perfect FROM member_games WHERE member_id = $1`,
    [id],
  );
  const records: GameRecord[] = rows.map((r) => ({
    lineup: String(r.lineup),
    wins: Number(r.wins),
    rating: Math.round(Number(r.rating) * 10) / 10,
    bonuses: GAME_BONUS_KEYS.filter((k) => (Array.isArray(r.bonuses) ? r.bonuses : []).includes(k)),
    names: Array.isArray(r.names) ? r.names.map(String) : [],
    playedAt: new Date(r.played_at as string).toISOString(),
  }));
  return {
    records,
    plays: Number(sum?.plays ?? 0),
    best: sum?.best === null || sum?.best === undefined ? null : Number(sum.best),
    perfect: Number(sum?.perfect ?? 0),
  };
}

/** 기록 한 줄 지우기 */
export async function deleteGameRecord(q: Query, loginId: string, lineup: string): Promise<void> {
  const id = await resolveMemberId(q, loginId);
  await q(`DELETE FROM member_games WHERE member_id = $1 AND lineup = $2`, [id, lineup]);
}

// ── 54-0 주간 순위 (2026-10-05) ──

/** 그 주(한국 시간 월~일) 회원마다 가장 좋은 판 하나 → 순위. 닉네임을 정한 회원·서버가 맞춘 기록만 */
export async function weeklyGameRanking(q: Query, week: RankingWeek, now = new Date()): Promise<GameRanking> {
  const from = kstWeekStart(now, week === "last" ? -1 : 0);
  const to = kstWeekStart(now, week === "last" ? 0 : 1);
  const rows = await q(
    `WITH week_games AS (
       SELECT g.* FROM member_games g JOIN members m ON m.id = g.member_id
       WHERE g.verified AND g.played_at >= $1 AND g.played_at < $2 AND m.nickname IS NOT NULL
     ), best AS (
       SELECT DISTINCT ON (member_id) member_id, lineup, wins, rating, names, played_at
       FROM week_games ORDER BY member_id, wins DESC, rating DESC, played_at ASC
     )
     SELECT b.*, m.nickname, m.team_codes[1] AS team_code,
       (SELECT count(*)::int FROM week_games w WHERE w.member_id = b.member_id) AS plays,
       count(*) OVER ()::int AS total
     FROM best b JOIN members m ON m.id = b.member_id
     ORDER BY b.wins DESC, b.rating DESC, b.played_at ASC
     LIMIT $3`,
    [from.toISOString(), to.toISOString(), GAME_RANKING_LIMIT],
  );
  const list: GameRankRow[] = rows.map((r, i) => ({
    rank: i + 1,
    nickname: String(r.nickname),
    teamCode: r.team_code === null || r.team_code === undefined ? null : String(r.team_code),
    wins: Number(r.wins),
    rating: Math.round(Number(r.rating) * 10) / 10,
    names: Array.isArray(r.names) ? r.names.map(String) : [],
    lineup: String(r.lineup),
    plays: Number(r.plays ?? 1),
    playedAt: new Date(r.played_at as string).toISOString(),
  }));
  return { week, from: from.toISOString(), to: to.toISOString(), rows: list, members: Number(rows[0]?.total ?? 0) };
}

// ── 업데이트 소식 삭제 (관리자) ──

/** 관리자가 지운 업데이트 글 번호 (공개) */
export async function hiddenUpdates(q: Query): Promise<string[]> {
  const rows = await q(`SELECT slug FROM hidden_updates ORDER BY slug`);
  return rows.map((r) => String(r.slug));
}

/** 글 지우기(hidden true)·되돌리기(false) — 글 번호 검사는 부르는 쪽 */
export async function setUpdateHidden(q: Query, slug: string, hidden: boolean): Promise<string[]> {
  if (hidden) await q(`INSERT INTO hidden_updates (slug) VALUES ($1) ON CONFLICT DO NOTHING`, [slug]);
  else await q(`DELETE FROM hidden_updates WHERE slug = $1`, [slug]);
  return hiddenUpdates(q);
}
