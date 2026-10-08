// 회원 규칙(lib/account) + 회원 표 SQL(lib/server/members) — SQL 은 메모리 Postgres(PGlite)로 실제 실행해 본다
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import {
  MAX_FAVORITES, MAX_TEAMS, adjustedCount, canUnlink, normalizeTeamCodes, validLikeTarget, isAdminLogin, linkResultMessage, memberIdOf, mergeFavorites, normalizeTeamCode, parseAdminLoginIds, parseLoginProviders,
  providerOfMemberId, sameList, sanitizeFavorites, validateNickname,
} from "../lib/account";
import { decodeLinkIntent, encodeLinkIntent } from "../lib/link-token";
import {
  deleteMember, ensureSchema, getOrCreateMember, hiddenUpdates, likeCounts, setUpdateHidden, linkLogin, setLike, listMembers, loginIdsOfLogin, resolveMemberId, setFavorites, unlinkLogin, updateProfile,
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

assert.deepEqual(normalizeTeamCodes(["55", "60", "55"]), ["55", "60"]);
assert.deepEqual(normalizeTeamCodes([]), []);
assert.equal(normalizeTeamCodes(["55", "x"]), undefined);
assert.equal(normalizeTeamCodes("55"), undefined);
assert.equal(normalizeTeamCodes(Array.from({ length: 20 }, (_, i) => String(i)))!.length, MAX_TEAMS);
// 좋아요 대상·수
assert.ok(validLikeTarget("player", "291248"));
assert.ok(validLikeTarget("team", "55"));
assert.ok(!validLikeTarget("team", "5555"));
assert.ok(!validLikeTarget("coach", "1"));
assert.ok(!validLikeTarget("player", 1));
assert.equal(adjustedCount(10, false, true), 11);
assert.equal(adjustedCount(10, true, false), 9);
assert.equal(adjustedCount(0, true, false), 0);
assert.equal(adjustedCount(4, true, true), 4);

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
assert.deepEqual(await getOrCreateMember(q, a), {
  provider: "google", nickname: null, teamCode: null, teamCodes: [], favorites: [], likes: { players: [], teams: [] }, logins: ["google"],
});
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
assert.ok(r.ok && r.member.teamCode === null && r.member.nickname === "SKfan" && r.member.teamCodes.length === 0);
// 여러 팀: 고른 순서, 대표 = 첫 팀
r = await updateProfile(q, a, { teamCodes: ["60", "55"] });
assert.ok(r.ok && r.member.teamCode === "60" && sameList(r.member.teamCodes, ["60", "55"]));
r = await updateProfile(q, a, { teamCodes: [] });
assert.ok(r.ok && r.member.teamCode === null);

// 좋아요: 켜기·끄기·수 모으기
assert.ok((await setLike(q, a, "player", "291248", true)).ok);
assert.ok((await setLike(q, a, "player", "291248", true)).ok); // 두 번 눌러도 한 번
assert.ok((await setLike(q, a, "team", "55", true)).ok);
const lb = await setLike(q, b, "player", "291248", true);
assert.ok(lb.ok && sameList(lb.likes.players, ["291248"]));
assert.deepEqual(await likeCounts(q), { players: { "291248": 2 }, teams: { "55": 1 }, fans: {} });
// 팀 팬 수: 응원팀으로 고른 회원 (여러 팀이면 팀마다)
await updateProfile(q, a, { teamCodes: ["55", "60"] });
await updateProfile(q, b, { teamCodes: ["55"] });
assert.deepEqual((await likeCounts(q)).fans, { "55": 2, "60": 1 });
await updateProfile(q, b, { teamCodes: [] });
await updateProfile(q, a, { teamCodes: [] });
await setLike(q, b, "player", "291248", false);
assert.deepEqual((await likeCounts(q)).players, { "291248": 1 });
assert.deepEqual((await getOrCreateMember(q, a)).likes, { players: ["291248"], teams: ["55"] });

assert.deepEqual(await setFavorites(q, b, ["5", "5", "abc", "7"]), ["5", "7"]);
assert.deepEqual((await getOrCreateMember(q, b)).favorites, ["5", "7"]);
await setFavorites(q, b, []);
assert.deepEqual((await getOrCreateMember(q, b)).favorites, []);

// 탈퇴: 행이 사라지고, 같은 닉네임을 다른 사람이 쓸 수 있다
await deleteMember(q, a);
assert.equal((await q("SELECT count(*)::int AS n FROM members WHERE id = $1", [a])).at(0)?.n, 0);
assert.ok((await updateProfile(q, b, { nickname: "SKfan" })).ok);
await assert.rejects(getOrCreateMember(q, "evil:1"));
// 업데이트 글 삭제·되돌리기 (같은 글 두 번 지워도 한 줄)
assert.deepEqual(await hiddenUpdates(q), []);
await setUpdateHidden(q, "2026-10-05-b", true);
assert.deepEqual(await setUpdateHidden(q, "2026-10-05-a", true), ["2026-10-05-a", "2026-10-05-b"]);
assert.deepEqual(await setUpdateHidden(q, "2026-10-05-a", true), ["2026-10-05-a", "2026-10-05-b"]);
assert.deepEqual(await setUpdateHidden(q, "2026-10-05-b", false), ["2026-10-05-a"]);
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
  await q2(`INSERT INTO members (id, provider, nickname, team_code, favorites) VALUES ('naver:old', 'naver', '옛회원', '35', '{"1","2"}')`);
  await ensureSchema(q2);
  await ensureSchema(q2);
  assert.equal(await resolveMemberId(q2, "naver:old"), "naver:old");
  assert.deepEqual((await getOrCreateMember(q2, "naver:old")).logins, ["naver"]);
  assert.deepEqual((await getOrCreateMember(q2, "naver:old")).teamCodes, ["35"]); // 옛 대표 팀 옮겨 적음

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
  await setLike(q2, "naver:n2", "team", "55", true);
  await updateProfile(q2, "google:g2", { nickname: "구글쪽" });
  await setFavorites(q2, "google:g2", ["1", "7"]);
  await setLike(q2, "google:g2", "team", "55", true);
  await setLike(q2, "google:g2", "player", "7", true);
  const n2member = await resolveMemberId(q2, "naver:n2");
  assert.deepEqual(await linkLogin(q2, "naver:n2", "google:g2"), { ok: true, merged: true });
  const merged = await getOrCreateMember(q2, "google:g2");
  assert.equal(await resolveMemberId(q2, "google:g2"), n2member);
  assert.deepEqual(merged.favorites, ["9", "1", "7"]);
  assert.equal(merged.nickname, "구글쪽");
  assert.equal(merged.teamCode, "55");
  assert.deepEqual(merged.logins, ["google", "naver"]);
  assert.deepEqual(merged.likes, { players: ["7"], teams: ["55"] }); // 좋아요도 합침(같은 팀은 한 번)
  assert.deepEqual((await likeCounts(q2)).teams, { "55": 1 });
  assert.deepEqual((await likeCounts(q2)).players, { "7": 1 });
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
  assert.ok(row && row.likeCount === 2 && row.favoriteCount === 3 && sameList(row.logins, ["google"]) && row.shortId.length === 6);
  assert.ok(list.every((m, i) => i === 0 || list[i - 1].createdAt >= m.createdAt));
  await db2.close();
  console.log("account: 계정 연결 SQL(옛 회원 옮기기·붙이기·합치기·겹침·해제·탈퇴·관리자 목록) 통과");
}

// ── 54-0 내 기록 (규칙 + SQL) ──
{
  const { validGameRecord, validLineupParam, MAX_GAME_RECORDS } = await import("../lib/account");
  const { saveGameRecord, gameHistory, deleteGameRecord } = await import("../lib/server/members");
  const names = ["이상민 97-98", "김태술 07-08", "최준용 21-22", "안영준 24-25", "서장훈 99-00"];
  const base = { lineup: "245026:2,290108:12,290993:39,291084:45,255032:4", wins: 52, rating: 98.73, bonuses: ["prime", "school", "x"], names };
  assert.deepEqual(validGameRecord(base), { ...base, rating: 98.7, bonuses: ["school", "prime"] });
  assert.equal(validGameRecord({ ...base, lineup: "1:2,3:4" }), null); // 다섯 명 아님
  assert.equal(validGameRecord({ ...base, lineup: "1:2,3:4,5:6,7:8,9:x" }), null);
  assert.equal(validGameRecord({ ...base, wins: 55 }), null);
  assert.equal(validGameRecord({ ...base, wins: 3.5 }), null);
  assert.equal(validGameRecord({ ...base, rating: 120 }), null);
  assert.equal(validGameRecord({ ...base, names: names.slice(0, 4) }), null);
  assert.equal(validGameRecord({ ...base, names: [...names.slice(0, 4), "  "] }), null);
  assert.equal(validGameRecord({ ...base, names: [...names.slice(0, 4), "<b>x</b>"] })?.names[4], "bx/b");
  assert.equal(validLineupParam("1:2,3:4,5:6,7:8,9:10"), true);
  assert.equal(validLineupParam("1:2,3:4,5:6,7:8,9:10;drop"), false);

  const db3 = new PGlite();
  const q3: Query = async (text, params) => (await db3.query(text, params ?? [])).rows as Record<string, unknown>[];
  await ensureSchema(q3);
  const rec = validGameRecord(base)!;
  await saveGameRecord(q3, "google:a", rec);
  await saveGameRecord(q3, "google:a", { ...rec, wins: 50 }); // 같은 라인업 → 한 줄
  await saveGameRecord(q3, "google:a", { ...rec, lineup: "1:2,3:4,5:6,7:8,9:10", wins: 54 });
  let h = await gameHistory(q3, "google:a");
  assert.equal(h.plays, 2);
  assert.equal(h.best, 54);
  assert.equal(h.perfect, 1);
  assert.equal(h.records[0].lineup, "1:2,3:4,5:6,7:8,9:10"); // 새것 먼저
  assert.equal(h.records[1].wins, 50);
  assert.deepEqual(h.records[1].bonuses, ["school", "prime"]);
  assert.deepEqual(h.records[1].names, names);
  // 빈 기록
  assert.deepEqual(await gameHistory(q3, "naver:empty"), { records: [], plays: 0, best: null, perfect: 0 });
  // 지우기
  await deleteGameRecord(q3, "google:a", "1:2,3:4,5:6,7:8,9:10");
  h = await gameHistory(q3, "google:a");
  assert.equal(h.plays, 1);
  assert.equal(h.perfect, 0);
  // 상한: 오래된 것부터 지운다
  for (let i = 0; i < MAX_GAME_RECORDS + 3; i++) await saveGameRecord(q3, "naver:many", { ...rec, lineup: `1:2,3:4,5:6,7:8,${i}:10` });
  assert.equal((await gameHistory(q3, "naver:many")).plays, MAX_GAME_RECORDS);
  assert.equal((await q3("SELECT count(*)::int AS n FROM member_games WHERE lineup = '1:2,3:4,5:6,7:8,0:10'")).at(0)?.n, 0);
  // 계정을 합치면 기록도 합친다 (같은 라인업은 지금 회원 것)
  await saveGameRecord(q3, "naver:b", { ...rec, wins: 30 });
  await saveGameRecord(q3, "naver:b", { ...rec, lineup: "11:2,3:4,5:6,7:8,9:10", wins: 40 });
  assert.deepEqual(await linkLogin(q3, "google:a", "naver:b"), { ok: true, merged: true });
  h = await gameHistory(q3, "google:a");
  assert.equal(h.plays, 2);
  assert.equal(h.records.find((r) => r.lineup === base.lineup)?.wins, 50);
  // 탈퇴하면 기록도 지운다
  await deleteMember(q3, "google:a");
  assert.equal((await q3("SELECT count(*)::int AS n FROM member_games WHERE lineup = $1", ["11:2,3:4,5:6,7:8,9:10"])).at(0)?.n, 0);
  // ── 54-0 주간 순위 (한국 시간 월~일, 닉네임 회원·서버가 맞춘 기록만, 회원마다 가장 좋은 판) ──
  const { kstWeekStart, weekRangeLabel, parseRankingWeek } = await import("../lib/account");
  const { weeklyGameRanking } = await import("../lib/server/members");
  // 2026-10-05(월) 08:59 KST = 10-04 23:59 UTC → 이번 주 시작은 10-05 00:00 KST = 10-04 15:00 UTC
  assert.equal(kstWeekStart(new Date("2026-10-04T23:59:00Z")).toISOString(), "2026-10-04T15:00:00.000Z");
  // 일요일 밤 23:59 KST 는 아직 지난주
  assert.equal(kstWeekStart(new Date("2026-10-04T14:59:00Z")).toISOString(), "2026-09-27T15:00:00.000Z");
  assert.equal(kstWeekStart(new Date("2026-10-07T03:00:00Z"), -1).toISOString(), "2026-09-27T15:00:00.000Z");
  assert.equal(weekRangeLabel(new Date("2026-10-04T15:00:00Z")), "10.5(월) ~ 10.11(일)");
  assert.equal(parseRankingWeek("last"), "last");
  assert.equal(parseRankingWeek("x"), "this");

  await updateProfile(q3, "google:r1", { nickname: "일번", teamCodes: ["55"] });
  await updateProfile(q3, "google:r2", { nickname: "이번" });
  await saveGameRecord(q3, "google:r1", { ...rec, lineup: "1:1,2:2,3:3,4:4,5:5", wins: 40, rating: 90, verified: true });
  await saveGameRecord(q3, "google:r1", { ...rec, lineup: "1:1,2:2,3:3,4:4,6:6", wins: 45, rating: 91, verified: true });
  await saveGameRecord(q3, "google:r1", { ...rec, lineup: "1:1,2:2,3:3,4:4,7:7", wins: 54, rating: 99, verified: false }); // 맞추지 못한 기록은 순위 밖
  await saveGameRecord(q3, "google:r2", { ...rec, lineup: "1:1,2:2,3:3,4:4,8:8", wins: 45, rating: 95, verified: true });
  await saveGameRecord(q3, "google:nonick", { ...rec, lineup: "1:1,2:2,3:3,4:4,9:9", wins: 54, rating: 99, verified: true }); // 닉네임 없음
  let rk = await weeklyGameRanking(q3, "this");
  assert.deepEqual(rk.rows.map((r) => [r.rank, r.nickname, r.wins, r.plays]), [[1, "이번", 45, 1], [2, "일번", 45, 2]]); // 같은 45승이면 전력 높은 쪽, 판 수도 맞춘 기록만
  assert.equal(rk.rows[1].teamCode, "55");
  assert.equal(rk.members, 2);
  assert.equal((await weeklyGameRanking(q3, "last")).rows.length, 0);
  // 지난주 기록은 지난주 순위로
  await q3("UPDATE member_games SET played_at = played_at - interval '7 days' WHERE lineup = '1:1,2:2,3:3,4:4,8:8'");
  rk = await weeklyGameRanking(q3, "this");
  assert.deepEqual(rk.rows.map((r) => r.nickname), ["일번"]);
  assert.deepEqual((await weeklyGameRanking(q3, "last")).rows.map((r) => r.nickname), ["이번"]);
  await db3.close();
  console.log("account: 54-0 내 기록(검사·저장·같은 라인업 한 줄·요약·지우기·상한·합치기·탈퇴)·주간 순위 통과");
}

// ── 폰 푸시 알림 구독 (2026-10-08) ──
{
  const { savePushSubscription, deletePushSubscription, hasPushSubscription, pushTargets, markPushSent, prunePushSent, removePushEndpoint } = await import("../lib/server/members");
  const db4 = new PGlite();
  const q4: Query = async (text, params) => (await db4.query(text, params ?? [])).rows as Record<string, unknown>[];
  await ensureSchema(q4);
  const sub = (n: number) => ({ endpoint: `https://push.example/${n}`, p256dh: "k".repeat(60), auth: "a".repeat(16) });
  await setFavorites(q4, "google:p", ["111", "222"]);
  await updateProfile(q4, "google:p", { teamCodes: ["55"] });
  await savePushSubscription(q4, "google:p", sub(1));
  await savePushSubscription(q4, "google:p", sub(2));
  await savePushSubscription(q4, "google:p", sub(1)); // 같은 기기 다시 → 한 줄
  assert.equal(await hasPushSubscription(q4, "google:p", sub(1).endpoint), true);
  let ts = await pushTargets(q4);
  assert.equal(ts.length, 1);
  assert.deepEqual(ts[0].favorites, ["111", "222"]);
  assert.deepEqual(ts[0].teams, ["55"]);
  assert.equal(ts[0].subscriptions.length, 2);
  // 보낸 알림 적기 → 다음에 읽힘
  await markPushSent(q4, ts[0].memberId, ["r:1:55", "p:1:111"]);
  ts = await pushTargets(q4);
  assert.ok(ts[0].sent.has("r:1:55") && ts[0].sent.has("p:1:111"));
  await prunePushSent(q4, 0); // 0일 → 지금보다 오래된 것 없음… 기록은 now() 라 남는다
  // 같은 기기를 다른 계정이 켜면 그 계정으로 옮김
  await savePushSubscription(q4, "naver:q", sub(2));
  assert.equal(await hasPushSubscription(q4, "google:p", sub(2).endpoint), false);
  assert.equal(await hasPushSubscription(q4, "naver:q", sub(2).endpoint), true);
  // 남의 기기는 못 끈다, 내 기기는 끈다
  await deletePushSubscription(q4, "naver:q", sub(1).endpoint);
  assert.equal(await hasPushSubscription(q4, "google:p", sub(1).endpoint), true);
  await deletePushSubscription(q4, "google:p", sub(1).endpoint);
  assert.equal(await hasPushSubscription(q4, "google:p", sub(1).endpoint), false);
  // 없어진 기기 지우기
  await removePushEndpoint(q4, sub(2).endpoint);
  assert.equal((await pushTargets(q4)).length, 0);
  // 계정 합치기: 기기와 보낸 기록이 옮겨진다
  await savePushSubscription(q4, "naver:q", sub(3));
  await markPushSent(q4, await resolveMemberId(q4, "naver:q"), ["x"]);
  assert.deepEqual(await linkLogin(q4, "google:p", "naver:q"), { ok: true, merged: true });
  ts = await pushTargets(q4);
  assert.equal(ts.length, 1);
  assert.equal(ts[0].memberId, await resolveMemberId(q4, "google:p"));
  assert.ok(ts[0].sent.has("x"));
  // 탈퇴하면 기기도 지워진다
  await deleteMember(q4, "google:p");
  assert.equal((await pushTargets(q4)).length, 0);
  await db4.close();
  console.log("account: 폰 알림 구독(저장·옮김·끄기·보낸 기록·합치기·탈퇴) 통과");
}
