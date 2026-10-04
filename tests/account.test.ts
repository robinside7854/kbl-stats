// 회원 규칙(lib/account) + 회원 표 SQL(lib/server/members) — SQL 은 메모리 Postgres(PGlite)로 실제 실행해 본다
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import {
  MAX_FAVORITES, canUnlink, isAdminLogin, linkResultMessage, memberIdOf, mergeFavorites, normalizeTeamCode, parseAdminLoginIds, parseLoginProviders,
  providerOfMemberId, sameList, sanitizeFavorites, validateNickname,
} from "../lib/account";
import { decodeLinkIntent, encodeLinkIntent } from "../lib/link-token";
import {
  deleteMember, ensureSchema, getOrCreateMember, linkLogin, listMembers, loginIdsOfLogin, resolveMemberId, setFavorites, unlinkLogin, updateProfile,
  SCHEMA_SQL, type Query,
} from "../lib/server/members";

// ── 로그인 회사 목록 ──
assert.deepEqual(parseLoginProviders("google,naver"), ["google", "naver"]);
assert.deepEqual(parseLoginProviders(" naver , kakao,google,naver"), ["naver", "google"]);
assert.deepEqual(parseLoginProviders(""), []);
assert.deepEqual(parseLoginProviders(undefined), []);

// ── 회원 번호 ──
assert.equal(memberIdOf("google", "1234"), "google:1234");
assert.equal(memberIdOf("naver", " AbC "), "naver:AbC");
assert.equal(memberIdOf("kakao", "1"), null);
assert.equal(memberIdOf("google", ""), null);
assert.equal(providerOfMemberId("naver:x"), "naver");
assert.equal(providerOfMemberId("evil:x"), null);
console.log("account: 로그인 회사·회원 번호 통과");

// ── 닉네임 ──
assert.deepEqual(validateNickname("  허웅팬_7 "), { ok: true, value: "허웅팬_7" });
assert.equal(validateNickname("가").ok, false); // 짧음
assert.equal(validateNickname("가".repeat(13)).ok, false); // 김
assert.equal(validateNickname("허 웅").ok, false); // 가운데 공백
assert.equal(validateNickname("ㅋㅋㅋ").ok, false); // 자음만
assert.equal(validateNickname("<script>").ok, false);
assert.equal(validateNickname("KBL공식").ok, false); // 오해
assert.equal(validateNickname("Admin12").ok, false);
assert.equal(validateNickname(42).ok, false);
assert.equal(validateNickname("SKnights").ok, true);
console.log("account: 닉네임 통과");

// ── 응원팀 ──
assert.equal(normalizeTeamCode("55"), "55");
assert.equal(normalizeTeamCode(null), null);
assert.equal(normalizeTeamCode(""), null);
assert.equal(normalizeTeamCode("x1"), undefined);
assert.equal(normalizeTeamCode(55), undefined);

// ── 즐겨찾기 ──
assert.deepEqual(sanitizeFavorites(["1", "1", "x", 3, "22"]), ["1", "22"]);
assert.equal(sanitizeFavorites(Array.from({ length: 400 }, (_, i) => String(i + 1))).length, MAX_FAVORITES);
assert.deepEqual(sanitizeFavorites("1"), []);
assert.deepEqual(mergeFavorites(["3", "1"], ["1", "2"]), ["3", "1", "2"]); // 이 브라우저 순서 먼저
assert.ok(sameList(["1", "2"], ["1", "2"]));
assert.ok(!sameList(["1", "2"], ["2", "1"]));
console.log("account: 응원팀·즐겨찾기 규칙 통과");

// ── 회원 표 SQL (PGlite) ──
const db = new PGlite();
const q: Query = async (text, params) => (await db.query(text, params ?? [])).rows as Record<string, unknown>[];
await ensureSchema(q);
await ensureSchema(q); // 두 번 불러도 괜찮다

const a = "google:111";
const b = "naver:222";
assert.deepEqual(await getOrCreateMember(q, a), { provider: "google", nickname: null, teamCode: null, favorites: [], logins: ["google"] });
await getOrCreateMember(q, a); // 같은 회원 다시 — 중복 행 없음
assert.equal((await q("SELECT count(*)::int AS n FROM members")).at(0)?.n, 1);

let r = await updateProfile(q, a, { nickname: "허웅팬", teamCode: "60" });
assert.ok(r.ok);
assert.equal(r.ok && r.member.nickname, "허웅팬");
assert.equal(r.ok && r.member.teamCode, "60");

// 다른 회원이 같은 닉네임(대소문자만 다름) → 거절
await updateProfile(q, a, { nickname: "SKfan" });
r = await updateProfile(q, b, { nickname: "skFAN" });
assert.deepEqual(r, { ok: false, error: "nickname_taken" });
// 본인은 같은 닉네임으로 다시 저장 가능
assert.ok((await updateProfile(q, a, { nickname: "SKfan" })).ok);
// 응원팀만 해제 (닉네임 그대로)
r = await updateProfile(q, a, { teamCode: null });
assert.ok(r.ok && r.member.teamCode === null && r.member.nickname === "SKfan");

assert.deepEqual(await setFavorites(q, b, ["5", "5", "abc", "7"]), ["5", "7"]);
assert.deepEqual((await getOrCreateMember(q, b)).favorites, ["5", "7"]);
await setFavorites(q, b, []);
assert.deepEqual((await getOrCreateMember(q, b)).favorites, []);

// 탈퇴: 행이 사라지고, 같은 닉네임을 다른 사람이 쓸 수 있다
await deleteMember(q, a);
assert.equal((await q("SELECT count(*)::int AS n FROM members WHERE id = $1", [a])).at(0)?.n, 0);
assert.ok((await updateProfile(q, b, { nickname: "SKfan" })).ok);
await assert.rejects(getOrCreateMember(q, "evil:1"));
await db.close();
console.log("account: 회원 표(만들기·닉네임 중복·응원팀·즐겨찾기·탈퇴) 통과");

// ── 계정 연결 규칙 ──
assert.ok(canUnlink(["google", "naver"], "naver", "google"));
assert.ok(!canUnlink(["google", "naver"], "google", "google")); // 지금 로그인한 수단
assert.ok(!canUnlink(["naver"], "google", "naver")); // 마지막 하나
assert.ok(!canUnlink(["naver"], "naver", "google")); // 없는 수단
assert.match(linkResultMessage("linked", "google"), /구글 계정을 연결/);
assert.match(linkResultMessage("merged", "naver"), /합쳤어요/);
const admins = parseAdminLoginIds(" google:1, naver:abc ,evil:1,google:, ");
assert.deepEqual([...admins], ["google:1", "naver:abc"]);
assert.ok(isAdminLogin(["naver:zz", "google:1"], admins));
assert.ok(!isAdminLogin(["google:2"], admins));
assert.equal(parseAdminLoginIds(undefined).size, 0);

// 표시 쿠키: 서명·회사·만료
process.env.NEXTAUTH_SECRET = "test-secret";
const tok = encodeLinkIntent("naver:A", "google", 1_000);
assert.equal(decodeLinkIntent(tok, "google", 2_000), "naver:A");
assert.equal(decodeLinkIntent(tok, "naver", 2_000), null); // 다른 회사로 로그인
assert.equal(decodeLinkIntent(tok, "google", 1_000 + 6 * 60_000), null); // 만료
assert.equal(decodeLinkIntent(tok.replace(/.$/, (c) => (c === "A" ? "B" : "A")), "google", 2_000), null); // 위조
assert.equal(decodeLinkIntent(undefined, "google"), null);
console.log("account: 계정 연결·관리자 규칙 통과");

// ── 계정 연결 SQL ──
{
  const db2 = new PGlite();
  const q2: Query = async (text, params) => (await db2.query(text, params ?? [])).rows as Record<string, unknown>[];
  // 연결 기능 이전 회원 (회원 번호 = 로그인 번호, member_logins 없음) → 표 준비 때 옮겨 적는다
  await q2(SCHEMA_SQL[0]);
  await q2(`INSERT INTO members (id, provider, nickname, favorites) VALUES ('naver:old', 'naver', '옛회원', '{"1","2"}')`);
  await ensureSchema(q2);
  await ensureSchema(q2);
  assert.equal(await resolveMemberId(q2, "naver:old"), "naver:old");
  assert.deepEqual((await getOrCreateMember(q2, "naver:old")).logins, ["naver"]);

  // 처음 보는 구글 로그인을 붙이기
  assert.deepEqual(await linkLogin(q2, "naver:old", "google:g1"), { ok: true, merged: false });
  const viaGoogle = await getOrCreateMember(q2, "google:g1");
  assert.equal(viaGoogle.nickname, "옛회원");
  assert.equal(viaGoogle.provider, "google");
  assert.deepEqual(viaGoogle.logins, ["google", "naver"]);
  assert.deepEqual(await linkLogin(q2, "google:g1", "naver:old"), { ok: true, merged: false }); // 이미 같은 회원
  assert.deepEqual((await loginIdsOfLogin(q2, "google:g1")).sort(), ["google:g1", "naver:old"]);

  // 이미 따로 가입한 두 계정 합치기: 즐겨찾기 합침, 닉네임은 지금 회원 것(없으면 그쪽), 응원팀도 비면 그쪽
  await updateProfile(q2, "naver:n2", { teamCode: "55" });
  await setFavorites(q2, "naver:n2", ["9", "1"]);
  await updateProfile(q2, "google:g2", { nickname: "구글쪽" });
  await setFavorites(q2, "google:g2", ["1", "7"]);
  const n2member = await resolveMemberId(q2, "naver:n2");
  assert.deepEqual(await linkLogin(q2, "naver:n2", "google:g2"), { ok: true, merged: true });
  const merged = await getOrCreateMember(q2, "google:g2");
  assert.equal(await resolveMemberId(q2, "google:g2"), n2member);
  assert.deepEqual(merged.favorites, ["9", "1", "7"]);
  assert.equal(merged.nickname, "구글쪽");
  assert.equal(merged.teamCode, "55");
  assert.deepEqual(merged.logins, ["google", "naver"]);
  assert.equal((await q2("SELECT count(*)::int AS n FROM members")).at(0)?.n, 2);

  // 같은 회사가 겹치면 합치지 않는다 (구글이 이미 붙은 회원에 다른 구글)
  assert.deepEqual(await linkLogin(q2, "naver:n2", "google:g3"), { ok: false, error: "conflict" });
  // 그쪽에도 네이버가 붙어 있으면 conflict
  await linkLogin(q2, "google:g4", "naver:n4");
  await getOrCreateMember(q2, "naver:n5");
  assert.deepEqual(await linkLogin(q2, "naver:n5", "google:g4"), { ok: false, error: "conflict" });

  // 해제: 지금 로그인한 수단·마지막 하나는 안 됨
  assert.deepEqual(await unlinkLogin(q2, "google:g2", "google"), { ok: false, error: "current" });
  const un = await unlinkLogin(q2, "google:g2", "naver");
  assert.ok(un.ok && sameList(un.member.logins, ["google"]));
  assert.deepEqual(await unlinkLogin(q2, "google:g2", "naver"), { ok: false, error: "missing" });
  // 풀린 네이버로 다시 들어오면 새 회원 (회원 번호는 m:…)
  const fresh = await resolveMemberId(q2, "naver:n2");
  assert.ok(fresh.startsWith("m:") && fresh !== n2member);
  // 처음 회원 번호였던 로그인을 풀어도 새로 들어올 수 있다
  assert.ok((await unlinkLogin(q2, "google:g1", "naver")).ok);
  assert.notEqual(await resolveMemberId(q2, "naver:old"), "naver:old");

  // 탈퇴는 연결된 로그인 수단까지 지운다
  await deleteMember(q2, "google:g4");
  assert.equal((await q2("SELECT count(*)::int AS n FROM member_logins WHERE login_id IN ('google:g4','naver:n4')")).at(0)?.n, 0);

  // 관리자 목록
  const list = await listMembers(q2);
  assert.equal(list.length, (await q2("SELECT count(*)::int AS n FROM members")).at(0)?.n);
  const row = list.find((m) => m.nickname === "구글쪽");
  assert.ok(row && row.favoriteCount === 3 && sameList(row.logins, ["google"]) && row.shortId.length === 6);
  assert.ok(list.every((m, i) => i === 0 || list[i - 1].createdAt >= m.createdAt));
  await db2.close();
  console.log("account: 계정 연결 SQL(옛 회원 옮기기·붙이기·합치기·겹침·해제·탈퇴·관리자 목록) 통과");
}
