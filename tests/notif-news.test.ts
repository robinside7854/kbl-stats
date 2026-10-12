// 좋은 소식 알림 더 (lib/notif-news.ts, 2026-10-12) — npm run test:notifications
import assert from "node:assert/strict";
import {
  alltimeRankItems,
  awardItems,
  birthdayItems,
  clinchedSpot,
  leaderRankItems,
  medianOf,
  mergeLeagueRecords,
  teamPreviewItems,
  teamRankItems,
  teamStreakItems,
} from "../lib/notif-news";
import { buildNotifItems, doubleOf, kstDate, visibleNotifs, type NotifContext } from "../lib/notifications";
import { pickPushItems } from "../lib/push";
import { awardSeenKey, updateAwardSeen } from "../scripts/award-seen";
import type { GameBoxRow, SeasonGame } from "../lib/types";

const row = (id: string, nameKo: string, o: Partial<GameBoxRow> = {}): GameBoxRow => ({
  id, nameKo, sec: 1800, pts: 10, oreb: 0, dreb: 2, reb: 2, ast: 1, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 4, fga: 9, tpm: 0, tpa: 0, ftm: 2, fta: 2, ...o,
});
const day = (n: number) => `2026-10-${String(n).padStart(2, "0")}`;
// SK(55, 선수 P) vs KCC(60, 선수 Q) 10경기, 하루에 한 경기. KCC 가 1~4경기, SK 가 5~10경기 승리
// P 득점: 1~6경기 5점, 7~10경기 30점 (Q 는 늘 10점)
const games: SeasonGame[] = Array.from({ length: 10 }, (_, i) => {
  const n = i + 1;
  const skWin = n >= 5;
  return {
    gmkey: `S49G01N${n}`, date: day(n), start: "19:00", stadium: "잠실", ended: true,
    home: { teamCode: "55", name: "서울 SK", score: skWin ? 80 : 70 },
    away: { teamCode: "60", name: "부산 KCC", score: skWin ? 70 : 80 },
    box: { home: [row("P", "피선수", { pts: n >= 7 ? 30 : 5 })], away: [row("Q", "큐선수")] },
  };
});
const ctx = { seasonCode: 49, teamShort: { "55": "SK", "60": "KCC" } };

// ① 연승·연패 탈출 — 창은 10-04 부터: KCC 4연승(10-04), SK 4연패 탈출(10-05), 3연승(10-07)~6연승(10-10). KCC 연패는 소식 아님
const streak = teamStreakItems(games, ctx);
assert.deepEqual(streak.map((i) => i.title), ["KCC 4연승", "SK 4연패 탈출", "SK 3연승", "SK 4연승", "SK 5연승", "SK 6연승"]);
assert.ok(streak.every((i) => i.kind === "team_streak"));

// ② 순위: SK 가 8번째 경기(4승 4패)에서 공동 1위, 9번째 경기에서 단독 1위 / ③ 10번째 경기로 정규리그 1위 확정
assert.equal(medianOf([3, 9, 5]), 5);
const rank = teamRankItems(games, ctx);
assert.deepEqual(rank.filter((i) => i.kind === "team_rank").map((i) => [i.date, i.title]), [[day(8), "SK 공동 1위"], [day(9), "SK 단독 1위"]]);
const clinch = rank.filter((i) => i.kind === "team_clinch");
assert.deepEqual(clinch.map((i) => [i.date, i.title]), [[day(10), "SK 정규리그 1위 확정"]]);
// 확정 계산: 남은 경기를 다 져도 안전한가 (동률은 진다고 본다)
assert.equal(clinchedSpot("55", new Map([["55", 6], ["60", 4]]), new Map([["55", 0], ["60", 2]]), 1), false);
assert.equal(clinchedSpot("55", new Map([["55", 6], ["60", 4]]), new Map([["55", 0], ["60", 1]]), 1), true);

// ⑨ 부문 순위: P 가 8번째 경기에서 경기당 득점 1위 ((30+30+... )/8 = 11.3 > Q 10)
const leaders = leaderRankItems(games, ctx);
const lead = leaders.find((i) => i.player === "P");
assert.equal(lead?.date, day(8));
assert.ok(lead?.title.startsWith("피선수 경기당 득점 1위"), lead?.title);
assert.ok(!leaders.some((i) => i.title.includes("스틸")), "0.0개 부문은 소식 아님");

// ⑩ 역대 순위: 은퇴 선수 R(502점)을 P 가 10-05 에 넘음 (통산 630 = 시즌 전 480 + 이번 시즌 150)
const alltime = alltimeRankItems(games, {
  careerSums: {
    P: { points: 630, reb: 20, ast: 10, stl: 0, blk: 0, tpm: 0, games: 10, wins: 6 },
    Q: { points: 100, reb: 20, ast: 10, stl: 0, blk: 0, tpm: 0, games: 10, wins: 4 },
    R: { points: 502, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0, games: 50, wins: 20 },
  },
  names: { P: "피선수", Q: "큐선수", R: "알선수" },
});
const passR = alltime.find((i) => i.id === `at:${day(5)}:P:points`);
assert.equal(passR?.title, "피선수 통산 득점 역대 1위");
assert.ok(passR?.body.startsWith("알선수(502점) 넘었어요"), passR?.body);
assert.ok(!alltime.some((i) => i.id === `at:${day(4)}:P:points`), "순위가 그대로면 소식 아님");

// ⑧ 리그 최고: P 30득점(10-07)은 이번 시즌 리그 최고 → 개인 시즌 최다 줄을 바꾼다
const nctx: NotifContext = { ...ctx, careerHighs: {}, careerSums: {} };
const merged = mergeLeagueRecords(buildNotifItems(games, nctx), games, ctx);
assert.ok(!merged.some((i) => i.id === "h:S49G01N7:P:pts"));
assert.equal(merged.find((i) => i.id === "l:S49G01N7:P:pts")?.title, "피선수 이번 시즌 리그 최고 30득점");

// ⑦ 더블더블·트리플더블
assert.equal(doubleOf({ pts: 12, reb: 10, ast: 3, stl: 0, blk: 0 }), "더블더블");
assert.equal(doubleOf({ pts: 12, reb: 10, ast: 11, stl: 0, blk: 0 }), "트리플더블");
assert.equal(doubleOf({ pts: 30, reb: 9, ast: 9, stl: 0, blk: 0 }), null);

// ④ 경기 날 안내 + 보이는 날·폰 알림 시각
const future: SeasonGame = { ...games[0], gmkey: "S49G01N11", date: "2026-10-12", start: "14:00", ended: false, home: { ...games[0].home, score: null }, away: { ...games[0].away, score: null }, box: null };
const preview = teamPreviewItems([...games, future], ctx, "2026-10-12");
assert.equal(preview.length, 1);
assert.equal(preview[0].title, "오늘 14:00 SK vs KCC");
assert.ok(preview[0].body.includes("SK 1위(6연승 중)"), preview[0].body);
assert.equal(preview[0].startsAt, "2026-10-12T14:00:00+09:00");
assert.equal(kstDate(new Date("2026-10-11T16:00:00Z")), "2026-10-12");
// 하루 전에는 안 보이고, 그날 보인다
assert.equal(visibleNotifs(preview, new Date("2026-10-11T03:00:00Z")).length, 0);
assert.equal(visibleNotifs(preview, new Date("2026-10-12T00:00:00Z")).length, 1);
// 폰 알림: 아침 8시엔 보내고, 경기가 시작한 뒤(오후 3시)엔 안 보낸다
const target = { favorites: [], teams: ["60"], sent: new Set<string>() };
assert.equal(pickPushItems(preview, target, new Date("2026-10-11T23:10:00Z")).length, 1);
assert.equal(pickPushItems(preview, target, new Date("2026-10-12T06:00:00Z")).length, 0);

// ⑬ 생일: 오늘 앞뒤로 미리 넣고, 화면은 오늘까지만
const bd = birthdayItems([{ id: "P", nameKo: "피선수", birthday: "1995-10-14", teamShort: "SK" }], "2026-10-12", 49);
assert.deepEqual(bd.map((i) => [i.date, i.title]), [["2026-10-14", "피선수 생일 (만 31세)"]]);
assert.equal(visibleNotifs(bd, new Date("2026-10-12T03:00:00Z")).length, 0);
assert.equal(visibleNotifs(bd, new Date("2026-10-14T03:00:00Z")).length, 1);

// ⑭ 수상: 처음 본 날 기록 — 파일이 없을 때 있던 칸은 null(알리지 않음), 그 뒤 새 칸은 오늘
const k1 = awardSeenKey(49, "roundMvp", "P", "1라운드");
const k2 = awardSeenKey(49, "roundMvp", "Q", "2라운드");
const seed = updateAwardSeen(null, [k1], "2026-11-01");
assert.equal(seed[k1], null);
const next = updateAwardSeen(seed, [k1, k2], "2026-11-20");
assert.equal(next[k1], null);
assert.equal(next[k2], "2026-11-20");
assert.ok(k1 in updateAwardSeen(next, [k2], "2026-11-21"), "안 보인 칸도 지우지 않음");
const aw = awardItems([{ seasonCode: 49, seasonLabel: "26-27", awardLabel: "2라운드 MVP", playerNo: "Q", name: "큐선수", team: "KCC", date: "2026-11-20" }], "2026-11-22");
assert.equal(aw[0]?.title, "큐선수 2라운드 MVP 수상");
assert.equal(awardItems(aw.length ? [{ seasonCode: 49, seasonLabel: "26-27", awardLabel: "2라운드 MVP", playerNo: "Q", name: "큐선수", team: "KCC", date: "2026-11-01" }] : [], "2026-11-22").length, 0, "7일 지난 수상은 빼기");

console.log("notif-news: 통과");
