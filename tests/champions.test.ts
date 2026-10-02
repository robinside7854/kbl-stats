// scripts/champions.ts 검증: 챔프전 4선승 판정·중복·미완료 경기·선수 우승 시즌 (npm run test:champions)
import assert from "node:assert/strict";
import { championSeasonsOf, finalsChampion } from "../scripts/champions";

const g = (n: number, h: string, a: string, sh: number | null, sa: number | null, extra: Record<string, unknown> = {}) => ({
  gmkey: `S47G04N${n}`, seasonCode: 47, gameCode: "04", tcodeH: h, tcodeA: a, tnameH: `팀${h}`, tnameA: `팀${a}`, scoreH: sh, scoreA: sa, ...extra,
});
const series = [
  g(1, "60", "66", 80, 70), g(2, "60", "66", 70, 75), g(3, "66", "60", 60, 70), g(4, "66", "60", 65, 72), g(5, "60", "66", 90, 80),
  g(5, "60", "66", 90, 80),                                              // gmkey 중복은 한 번
  { ...g(9, "66", "60", 99, 0), gameCode: "01" },                       // 정규시즌은 안 셈
  { ...g(8, "66", "60", 99, 0), seasonCode: 48 },                       // 다른 시즌은 안 셈
];
assert.deepEqual(finalsChampion(series, 47), { teamCode: "60", teamName: "팀60", wins: 4, losses: 1 });
assert.deepEqual(finalsChampion(JSON.stringify(series), 47)?.teamCode, "60"); // 문자열로 한 번 감싼 raw
// 진행 중(3승)·안 한 경기(점수 없음·0:0) → 없음
assert.equal(finalsChampion([g(1, "60", "66", 80, 70), g(2, "60", "66", 80, 70), g(3, "60", "66", 80, 70), g(4, "60", "66", 0, 0), g(5, "60", "66", null, null)], 47), null);
assert.equal(finalsChampion([], 47), null);
assert.equal(finalsChampion(null, 47), null);
assert.equal(finalsChampion("깨진", 47), null);
console.log("champions: 챔프전 판정 통과");

const champs = new Map([[45, "50"], [47, "60"], [43, "60"]]);
assert.deepEqual(championSeasonsOf([{ seasonCode: 47, teamCode: "60" }, { seasonCode: 43, teamCode: "60" }, { seasonCode: 45, teamCode: "60" }], champs), [43, 47]);
assert.deepEqual(championSeasonsOf([{ seasonCode: 35, teamCode: "60" }], champs), []);  // 우승팀 없는 시즌
console.log("champions: 선수 우승 시즌 통과");
