// 회원 규칙(lib/account) + 회원 표 SQL(lib/server/members) — SQL 은 메모리 Postgres(PGlite)로 실제 실행해 본다
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import {
  MAX_FAVORITES, memberIdOf, mergeFavorites, normalizeTeamCode, parseLoginProviders, providerOfMemberId, sameList, sanitizeFavorites, validateNickname,
} from "../lib/account";
import { deleteMember, ensureSchema, getOrCreateMember, setFavorites, updateProfile, type Query } from "../lib/server/members";

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
assert.deepEqual(await getOrCreateMember(q, a), { provider: "google", nickname: null, teamCode: null, favorites: [] });
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
