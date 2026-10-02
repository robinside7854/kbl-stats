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

// ── 역대 수상 (scripts/awards.ts) ──
import { awardRows, awardSeasonLabel, bundleScriptSrc, editDistance, extractAwardsData, matchAwardPlayer, parseJsLiteral, parseNameTeamCell } from "../scripts/awards";

assert.deepEqual(parseJsLiteral('[{a:"x",b:[1,!0],"c d":`줄1\n줄2`,e:\'q\\\'s\'}]'), [{ a: "x", b: [1, true], "c d": "줄1\n줄2", e: "q's" }]);
assert.throws(() => parseJsLiteral("[{a:`${evil()}`}]"));                // 템플릿 식은 읽지 않는다
assert.throws(() => parseJsLiteral("[{a:foo()}]"));                       // 리터럴 밖 문법은 실패
const bundle = 'var x=1;const data$9=[{name:"정규시즌 비계량 부문 수상자",values:[{header:"2020-2024",colName:["부문","2023~2024","2022~2023"],data:[' +
  '{item:"MVP",value:["이선 알바노(DB)","김선형(SK)"]},{item:"베스트5",value:[[`이정현(소노)\n강상재(DB)`],[`-\n-`]]},{item:"감독상",value:["김주성(DB)","김상식(KGC)"]}]}]},' +
  '{name:"플레이오프 우승팀 및 MVP",values:[{colName:["시즌별","우승","준우승","MVP","비고"],data:[{item:"*2019~2020",value:["*코로나19","","",""]},{item:"97~98",value:["현대(4승 3패)","기아","허재(기아)",""]}]}]},' +
  '{name:"올스타전 MVP 및 수상자",values:[{colName:["시즌별","MVP"],data:[{item:"2025~2026",value:["나이트(소노)"]}]}]}];function f(){}';
const data = extractAwardsData(bundle);
assert.ok(data);
assert.equal(extractAwardsData("no anchor"), null);
assert.equal(extractAwardsData('[{name:"정규시즌 비계량 부문 수상자",values:5}]'), null);  // 형식이 다르면 null
const rows = awardRows(data);
assert.deepEqual(rows.map((r) => `${r.seasonLabel}|${r.key}|${r.name}|${r.team}`), [
  "2023-2024|mvp|이선 알바노|DB", "2022-2023|mvp|김선형|SK",
  "2023-2024|best5|이정현|소노", "2023-2024|best5|강상재|DB",
  "1997-1998|finalsMvp|허재|기아",
  "2025-2026|allStarMvp|나이트|소노",
]);                                                                       // 감독상·"-"·코로나 칸은 뺀다
assert.equal(awardSeasonLabel("97"), "1997");
assert.equal(awardSeasonLabel("99~2000"), "1999-2000");
assert.equal(awardSeasonLabel("*2019~2020"), "2019-2020");
assert.equal(awardSeasonLabel("시즌별"), null);
assert.deepEqual(parseNameTeamCell("크리스 윌리엄스\n(모비스)\n48표(총 78표)"), [{ name: "크리스 윌리엄스", team: "모비스", note: null }]);
assert.deepEqual(parseNameTeamCell("※대상자 없음"), []);
assert.deepEqual(parseNameTeamCell("양동근(모비스)/박상오(SK)\n21표(97표)").map((p) => p.name), ["양동근", "박상오"]);   // 한 줄에 둘
assert.deepEqual(parseNameTeamCell("국내 : 이승준(삼성), 김경언(SK)\n국외 : 조셉 테일러(KT&G)").map((p) => `${p.note}:${p.name}`), ["국내:이승준", "국내:김경언", "국외:조셉 테일러"]);
assert.deepEqual(parseNameTeamCell("*코로나19로 인한 2020-2021시즌 올스타전 미개최"), []);
assert.equal(bundleScriptSrc('<script type="module" src="/assets/index-B80iNXgn.js"></script>'), "/assets/index-B80iNXgn.js");
assert.equal(bundleScriptSrc("<html></html>"), null);
console.log("awards: 번들 읽기·수상 행 통과");

const roster = [
  { playerNo: "1", nameKo: "애런 헤인즈", teamShort: "SK", teamName: "서울 SK" },
  { playerNo: "2", nameKo: "네이던 나이트", teamShort: "소노", teamName: "고양 소노" },
  { playerNo: "3", nameKo: "정병국", teamShort: "전자랜드", teamName: "인천 전자랜드" },
  { playerNo: "4", nameKo: "김민수", teamShort: "SK", teamName: "서울 SK" },
  { playerNo: "5", nameKo: "김민수", teamShort: "KT", teamName: "수원 KT" },
];
const none = new Map<string, string[]>();
const r = (name: string, team: string) => ({ key: "best5" as const, seasonLabel: "2017-2018", name, team, note: null });
assert.equal(matchAwardPlayer(r("애런헤인즈", "sk"), roster, none), "1");          // 공백 무시
assert.equal(matchAwardPlayer(r("김민수", "KT"), roster, none), "5");              // 동명이인 → 팀
assert.equal(matchAwardPlayer(r("나이트", "소노"), roster, none), "2");            // 성만
assert.equal(matchAwardPlayer(r("장병국", "전자랜드"), roster, none), "3");        // 한 글자 차이 + 같은 팀
assert.equal(matchAwardPlayer(r("장병국", "SK"), roster, none), null);             // 팀이 다르면 안 붙인다
assert.equal(matchAwardPlayer(r("라건아", "현대모비스"), [], new Map([["라건아", ["9"]]])), "9");  // 그 시즌 명단에 없으면 전체에서 하나뿐인 이름
assert.equal(editDistance("카룰랑안", "카굴랑안"), 1);
console.log("awards: 선수 연결 통과");

// ── 시즌 어워즈 화면 (lib/awards buildSeasonAwardsView) ──
import { buildSeasonAwardsView } from "../lib/awards";
{
  const teams = [{ teamCode: "60", shortName: "KCC", logoUrl: null, color: { primary: "#000", secondary: "#fff", text: "#fff" } }];
  const v = buildSeasonAwardsView(
    {
      awards: [
        { key: "allStarMvp", winners: [{ playerNo: "3", name: "빠짐", team: "SK", teamCode: null, note: null }] },
        { key: "sixthMan", winners: [{ playerNo: "2", name: "나이트", team: "소노", teamCode: null, note: null }] },
        { key: "mvp", winners: [{ playerNo: "1", name: "허훈", team: "KCC", teamCode: "60", note: null }] },
        { key: "roundMvp", winners: [{ playerNo: null, name: "모름", team: "SK", teamCode: null, note: "1라운드" }] },
        { key: "best5", winners: [] },
      ],
      regular: null,
      finals: { champion: "KCC", championRecord: "4승 1패", runnerUp: "소노", runnerUpRecord: "1승 4패" },
    },
    47,
    teams as never,
    (id) => (id === "2" ? { nameKo: "네이던 나이트", photoUrl: "p.png" } : null),
  )!;
  assert.deepEqual(v.groups.map((g) => g.group), ["major", "regular", "period"]);          // 화면 순서, 빈 부문·올스타는 뺀다
  assert.equal(v.groups[0].items[0].winners[0].teamLabel, "KCC");
  assert.equal(v.groups[0].items[0].winners[0].href, "/player/1?season=47");
  assert.equal(v.groups[1].items[0].winners[0].name, "네이던 나이트");                      // 색인 공식 이름
  assert.equal(v.groups[2].items[0].winners[0].href, null);                                  // 선수를 모르면 링크 없음
  assert.equal(v.finals?.champion, "KCC");
  assert.equal(buildSeasonAwardsView(null, 47, [], () => null), null);
  assert.equal(buildSeasonAwardsView({ awards: [], regular: null, finals: null }, 47, [], () => null), null);
  console.log("awards: 시즌 어워즈 화면 통과");
}
