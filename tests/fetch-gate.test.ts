// scripts/fetch-gate.ts 검증: 그날 경기가 끝난 뒤에 하루 한 번 수집 (npm run test:gate)
import assert from "node:assert/strict";
import { decideFetch, hhmmToMinutes, serviceClock } from "../scripts/fetch-gate";

// KST 시각 → Date
const at = (ymd: string, hhmm: string) => new Date(`${ymd}T${hhmm}:00+09:00`);
const game = (date: string, end: string | null, ended: number) => ({ gameDate: date, gameEnd: end, isEnded: ended, gameCode: "01" });

// 날짜·분: 새벽 4시 전은 전날로
assert.deepEqual(serviceClock(at("2026-10-03", "18:40")), { date: "2026-10-03", minutes: 18 * 60 + 40 });
assert.deepEqual(serviceClock(at("2026-10-04", "00:30")), { date: "2026-10-03", minutes: 24 * 60 + 30 });
assert.deepEqual(serviceClock(at("2026-10-04", "04:00")).date, "2026-10-04");
assert.equal(hhmmToMinutes("1556"), 956);
assert.equal(hhmmToMinutes(null), null);
assert.equal(hhmmToMinutes("15:5"), null);

// 주말 낮 경기(14시·16시): 마지막 경기 18:02 종료 → 18:40 은 이르고 20:40 에 수집
const weekend = [game("20261003", "1556", 1), game("20261003", "1802", 1), game("20261004", null, 0)];
assert.equal(decideFetch({ now: at("2026-10-03", "18:40"), games: weekend, lastDate: null }).run, false);
assert.equal(decideFetch({ now: at("2026-10-03", "20:40"), games: weekend, lastDate: null }).run, true);
// 낮 경기만이면 18:40 에 바로
assert.equal(decideFetch({ now: at("2026-10-03", "18:40"), games: [game("20261003", "1556", 1)], lastDate: null }).run, true);
// 이미 수집한 날은 다시 안 함
assert.equal(decideFetch({ now: at("2026-10-03", "23:40"), games: weekend, lastDate: "2026-10-03" }).run, false);

// 평일 저녁 경기(19시): 20:40 진행 중 → 22:10 수집
const weekday = [game("20261006", null, 0)];
assert.equal(decideFetch({ now: at("2026-10-06", "20:40"), games: weekday, lastDate: "2026-10-05" }).run, false);
assert.equal(decideFetch({ now: at("2026-10-06", "22:10"), games: [game("20261006", "2058", 1)], lastDate: "2026-10-05" }).run, true);
// 끝났는데 종료 시각이 없으면 끝난 것만으로
assert.equal(decideFetch({ now: at("2026-10-06", "20:40"), games: [game("20261006", null, 1)], lastDate: null }).run, true);

// 경기 없는 날·연장·조회 실패: 23시 이후(자정 넘긴 늦은 실행 포함) 한 번
assert.equal(decideFetch({ now: at("2026-10-07", "22:10"), games: [], lastDate: null }).run, false);
assert.equal(decideFetch({ now: at("2026-10-07", "23:40"), games: [], lastDate: null }).run, true);
assert.equal(decideFetch({ now: at("2026-10-08", "00:20"), games: weekday, lastDate: null }).run, true);
assert.equal(decideFetch({ now: at("2026-10-06", "22:10"), games: null, lastDate: null }).run, false);
assert.equal(decideFetch({ now: at("2026-10-06", "23:40"), games: null, lastDate: null }).run, true);
// 수동 실행은 항상
assert.equal(decideFetch({ now: at("2026-10-03", "10:00"), games: null, lastDate: "2026-10-03", force: true }).run, true);
console.log("fetch-gate: 수집 시각 판정 통과");
