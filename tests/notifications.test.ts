// 알림 규칙 (lib/notifications.ts) — npm run test:notifications
import assert from "node:assert/strict";
import { buildNotifItems, initialSeen, mergeSeen, myNotifs, SEEN_MAX, unreadCount, windowGames, type NotifContext } from "../lib/notifications";
import type { GameBoxRow, SeasonGame } from "../lib/types";

const row = (id: string, nameKo: string, o: Partial<GameBoxRow> = {}): GameBoxRow => ({
  id, nameKo, sec: 1800, pts: 10, oreb: 0, dreb: 2, reb: 2, ast: 1, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 4, fga: 9, tpm: 0, tpa: 0, ftm: 2, fta: 2, ...o,
});
const game = (n: number, date: string, hs: number, as: number, home: GameBoxRow[], away: GameBoxRow[], highlight?: string): SeasonGame => ({
  gmkey: `S49G01N${n}`, date, start: "19:00", stadium: "잠실", ended: true,
  home: { teamCode: "55", name: "서울 SK", score: hs },
  away: { teamCode: "60", name: "부산 KCC", score: as },
  box: { home, away },
  ...(highlight ? { highlight } : {}),
});

// A: 득점 20·20·20·25(시즌 최다) — 통산 이정표 1,000득점을 4번째 경기에서 넘김
const games = [
  game(1, "2026-10-01", 80, 70, [row("A", "가선수", { pts: 20 })], [row("B", "나선수")]),
  game(2, "2026-10-03", 80, 70, [row("A", "가선수", { pts: 20 })], [row("B", "나선수")]),
  game(3, "2026-10-05", 80, 70, [row("A", "가선수", { pts: 20 })], [row("B", "나선수")]),
  game(4, "2026-10-09", 70, 90, [row("A", "가선수", { pts: 25 }), row("Z", "벤치", { sec: 0, pts: 0 })], [row("B", "나선수", { reb: 12 })], "vid1"),
];
const ctx: NotifContext = {
  seasonCode: 49,
  teamShort: { "55": "SK", "60": "KCC" },
  // B: 이번 시즌·이 경기 날짜 리바운드 12 = 커리어 하이 (통산 30경기라 베테랑)
  careerHighs: { B: { reb: { value: 12, date: "2026-10-09", seasonCode: 49 } } },
  careerSums: {
    A: { points: 1010, reb: 8, ast: 4, stl: 0, blk: 0, tpm: 0, games: 4, wins: 3 },
    B: { points: 300, reb: 100, ast: 50, stl: 0, blk: 0, tpm: 0, games: 30, wins: 15 },
  },
};

// 7일 창: 마지막 경기일 10-09 → 10-03 부터 (10-01 경기는 빠짐)
assert.deepEqual(windowGames(games).map((g) => g.date), ["2026-10-03", "2026-10-05", "2026-10-09"]);

const items = buildNotifItems(games, ctx);
const ids = items.map((i) => i.id);
assert.ok(!ids.some((id) => id.includes("N1")), "창 밖 경기는 알림 없음");
// 날짜 최신 먼저, 같은 날은 대기록 먼저
assert.equal(items[0].date, "2026-10-09");
assert.ok(["high", "milestone"].includes(items[0].kind));
// 시즌 최다 (앞서 3경기, 25 > 20)
const high = items.find((i) => i.id === "h:S49G01N4:A:pts");
assert.ok(high && high.title.includes("이번 시즌 최다 25득점"), high?.title);
// 커리어 하이 (B 리바운드 12)
assert.ok(items.find((i) => i.id === "h:S49G01N4:B:reb")?.title.includes("커리어 하이 12리바운드"));
// 이정표: A 통산 1,010 = 4번째 경기 뒤, 직전 985 → 1,000득점 돌파
const ms = items.find((i) => i.id === "m:S49G01N4:A:points");
assert.ok(ms && ms.title.includes("1,000득점"), ms?.title);
assert.ok(!items.some((i) => i.id === "m:S49G01N3:A:points"), "3번째 경기 뒤 985 — 이정표 아님");
// 경기 결과 두 팀 + 하이라이트 두 팀
assert.ok(items.find((i) => i.id === "r:S49G01N4:55")?.title.includes("SK 70 : 90 KCC 패배"));
assert.ok(items.find((i) => i.id === "r:S49G01N4:60")?.title.includes("KCC 90 : 70 SK 승리"));
assert.equal(items.filter((i) => i.kind === "highlight").length, 2);
// 안 뛴 선수는 기록 알림 없음
assert.ok(!ids.includes("p:S49G01N4:Z"));
// 시즌 첫 경기들은 시즌 최다 아님 (앞선 경기 3개 미만)
assert.ok(!ids.includes("h:S49G01N3:A:pts"));

// 내 것만: 즐겨찾기 A + 응원팀 없음 → A 관련만
const mine = myNotifs(items, ["A"], []);
assert.ok(mine.length > 0 && mine.every((i) => i.player === "A"));
const mineTeam = myNotifs(items, [], ["60"]);
assert.ok(mineTeam.every((i) => i.teams?.includes("60")) && mineTeam.some((i) => i.kind === "highlight"));

// 읽음: 처음엔 최근 경기일만 새 소식
const seen = new Set(initialSeen(mine));
assert.ok(mine.filter((i) => i.date === "2026-10-09").every((i) => !seen.has(i.id)));
assert.equal(unreadCount(mine, seen), mine.filter((i) => i.date === "2026-10-09").length);
// 상한
const big = mergeSeen(Array.from({ length: SEEN_MAX }, (_, i) => `x${i}`), ["new"]);
assert.equal(big.length, SEEN_MAX);
assert.equal(big[big.length - 1], "new");
assert.deepEqual(mergeSeen(["a"], ["a", "b"]), ["a", "b"]);

console.log("notifications: 통과");

// ── 폰 푸시 (lib/push) ──
{
  const { composePush, isQuietHour, parsePushSubscription, pickPushItems, PUSH_OPEN_URL } = await import("../lib/push");
  // 조용한 시간 = 한국 자정~아침 8시 (UTC 15시~23시)
  assert.equal(isQuietHour(new Date("2026-10-08T14:50:00Z")), false); // 23:50 KST — 늦은 수집은 보냄
  assert.equal(isQuietHour(new Date("2026-10-08T15:00:00Z")), true); // 00:00
  assert.equal(isQuietHour(new Date("2026-10-08T17:45:00Z")), true); // 02:45 하이라이트 알람
  assert.equal(isQuietHour(new Date("2026-10-08T22:59:00Z")), true); // 07:59
  assert.equal(isQuietHour(new Date("2026-10-08T23:10:00Z")), false); // 08:10 아침 보내기
  // 마지막 경기일(10-09)과 전날만, 안 보낸 것만
  const picked = pickPushItems(items, { favorites: ["A"], teams: ["55"], sent: new Set() });
  assert.ok(picked.length > 0 && picked.every((i) => i.date >= "2026-10-08"));
  const sentAll = new Set(picked.map((i) => i.id));
  assert.equal(pickPushItems(items, { favorites: ["A"], teams: ["55"], sent: sentAll }).length, 0);
  assert.equal(pickPushItems(items, { favorites: [], teams: [], sent: new Set() }).length, 0);
  // 끈 종류는 빼고 (2026-10-08 B-7)
  const { notifGroupOf, parseNotifOff, withoutOffGroups } = await import("../lib/notifications");
  assert.deepEqual(parseNotifOff(["record", "x", "team", "team"]), ["team", "record"]);
  assert.deepEqual(parseNotifOff("team"), []);
  assert.equal(notifGroupOf("milestone"), "record");
  assert.equal(notifGroupOf("team_result"), "team");
  const noTeam = pickPushItems(items, { favorites: ["A"], teams: ["55"], sent: new Set(), off: ["team"] });
  assert.ok(noTeam.every((i) => i.kind !== "team_result"));
  assert.equal(withoutOffGroups(items, ["team", "player", "highlight", "record"]).length, 0);
  // 하나로 묶기
  const one = composePush(picked.slice(0, 1))!;
  assert.equal(one.title, picked[0].title);
  assert.equal(one.url, PUSH_OPEN_URL);
  const many = composePush(picked)!;
  assert.equal(many.title, picked[0].title);
  if (picked.length > 2) assert.ok(many.body.includes(`외 ${picked.length - 2}개`));
  assert.equal(composePush([]), null);
  // 구독 검사
  const ok = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "B".repeat(87), auth: "x".repeat(22) } };
  assert.ok(parsePushSubscription(ok));
  assert.equal(parsePushSubscription({ ...ok, endpoint: "http://insecure" }), null);
  assert.equal(parsePushSubscription({ ...ok, keys: { p256dh: "short", auth: "x".repeat(22) } }), null);
  assert.equal(parsePushSubscription(null), null);
  console.log("notifications: 폰 푸시 고르기·묶기·구독 검사 통과");
}

// 홈 "새로 나온 기록" (2026-10-11): 대기록만, 선수-경기로 묶기, 단계 높은 것 먼저
{
  const { featGroups, careerSumsFromSeasons, careerHighsFromIndex } = await import("../lib/notifications");
  const groups = featGroups(items);
  assert.ok(groups.length > 0);
  assert.ok(groups.every((g) => g.date === "2026-10-09"));
  const a = groups.find((g) => g.player === "A")!;
  // A: 시즌 최다 25득점 + 통산 1,000득점 → 한 칸, 이정표가 시즌 최다보다 먼저
  assert.deepEqual(a.lines.map((l) => l.level), ["milestone", "season"]);
  assert.equal(a.lines[0].text, "통산 1,000득점");
  assert.equal(a.lines[1].text, "25득점");
  assert.equal(a.name, "가선수");
  assert.equal(a.game, "SK 70 : 90 KCC");
  assert.equal(a.won, false);
  // 커리어 하이(B)가 맨 앞
  assert.equal(groups[0].player, "B");
  assert.equal(groups[0].lines[0].level, "career");
  // 경기 기록·결과 알림은 들어가지 않음
  assert.equal(featGroups(items.filter((i) => i.kind === "player_game" || i.kind === "team_result")).length, 0);
  // 재료 함수
  const sums = careerSumsFromSeasons([
    { players: [{ playerNo: "A", points: 10, reb: 1, ast: 2, stl: 0, blk: 0, tpm: 1, games: 2, wins: 1 }] },
    { players: [{ playerNo: "A", points: 5, reb: 1, ast: 0, stl: 1, blk: 0, tpm: 0, games: 1, wins: 0 }] },
  ]);
  assert.deepEqual(sums.A, { points: 15, reb: 2, ast: 2, stl: 1, blk: 0, tpm: 1, games: 3, wins: 1 });
  assert.deepEqual(careerHighsFromIndex([{ id: "B", careerHighs: { regular: { pts: { value: 30, date: "2026-10-01", seasonCode: 49 } } } }, { id: "C", careerHighs: null }]), {
    B: { pts: { value: 30, date: "2026-10-01", seasonCode: 49 } },
  });
  console.log("notifications: 새로 나온 기록 묶기 통과");
}
