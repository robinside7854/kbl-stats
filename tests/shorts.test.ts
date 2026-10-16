// lib/shorts.ts 검증: 득점 출처 나누기(합 = 공식 득점)·특징 고르기·조사·자막 조각 (npm run test:shorts)
import assert from "node:assert/strict";
import { captionChunks, euroRo, iGa, pickCallouts, sampleShots, scoringBreakdown, toSpeech, type ScoringSource } from "../lib/shorts";

// 2025-26 서명진: 2점 134·3점 119·자유투 64, 구역 성공 골밑 38·페인트 46·미드 46 → 공식 득점 689 와 합이 같다
const seo = scoringBreakdown({ games: 54, points: 689, twoPm: 134, tpm: 119, ftm: 64, zoneMade: { rim: 38, paint: 46, mid: 46 } })!;
assert.equal(seo.reduce((a, s) => a + s.points, 0), 689);
assert.deepEqual(seo.map((s) => s.key), ["paint", "mid", "three", "ft"]);
assert.equal(seo.find((s) => s.key === "three")!.share, 51.8);
assert.equal(seo.find((s) => s.key === "paint")!.points, 173); // 268 × 84/130 = 173.2
assert.equal(scoringBreakdown({ games: 10, points: 0, twoPm: 0, tpm: 0, ftm: 0, zoneMade: null }), null); // 슛 차트 없는 시즌
assert.equal(scoringBreakdown({ games: 10, points: 5, twoPm: 0, tpm: 0, ftm: 5, zoneMade: { rim: 0, paint: 0, mid: 0 } }), null);
console.log("shorts: 득점 출처 통과");

// 2025-26 국내 득점 1~5위 비중 (이정현·허웅·안영준·허훈·서명진)
const mk = (paint: number, mid: number, three: number, ft: number, g: number, pts: number): ScoringSource[] =>
  ([["paint", paint], ["mid", mid], ["three", three], ["ft", ft]] as const).map(([key, share]) => ({
    key, label: { paint: "페인트", mid: "미드레인지", three: "3점", ft: "자유투" }[key], share,
    points: Math.round((pts * share) / 100), perGame: Math.round(((pts * share) / 100 / g) * 10) / 10,
  }));
const top5 = [mk(31.2, 5.5, 38.9, 24.3, 49, 909), mk(24.9, 7.6, 51.2, 16.4, 45, 739), mk(45.5, 5.1, 32.2, 17.3, 37, 550), mk(38.6, 8.0, 36.1, 17.2, 40, 523), mk(25.1, 13.8, 51.8, 9.3, 54, 689)];
const c = pickCallouts(top5);
assert.deepEqual(c.map((x) => `${x.kind}:${x.source}`), ["perGameTop:ft", "perGameTop:three", "shareTop:paint", "balanced:null", "shareTop:three"]);
assert.equal(c[0].headline, "자유투로만 4.5점");
assert.equal(c[1].headline, "3점으로만 8.4점");
assert.equal(c[3].headline, "페인트 38.6% · 3점 36.1%");
// 미드레인지 13.8% 1위는 특징으로 내세우지 않는다 (MIN_TRAIT_SHARE)
assert.notEqual(c[4].source, "mid");
console.log("shorts: 특징 고르기 통과");

assert.equal(euroRo("자유투"), "자유투로");
assert.equal(euroRo("3점"), "3점으로");
assert.equal(euroRo("미드레인지"), "미드레인지로");
assert.equal(euroRo("페인트"), "페인트로");
assert.equal(iGa("허웅"), "허웅이");
assert.equal(iGa("허훈"), "허훈이");
assert.equal(iGa("이정현"), "이정현이");
assert.equal(toSpeech("25-26 국내 득점 TOP 5."), "지난 시즌 국내 득점 탑 파이브.");
assert.equal(toSpeech("경기당 4.5점이에요. 성공률도 40%를 넘기고요. 5위는 서명진."), "경기당 사쩜오점이에요. 성공률도 사십 퍼센트를 넘기고요. 오위는 서명진.");
assert.equal(toSpeech("3점으로 8점 넘게, 3분의 1이 넘어요. 158, 10, 87.4%"), "삼점으로 팔점 넘게, 삼분의 일이 넘어요. 백오십팔, 십, 팔십칠쩜사 퍼센트");
assert.ok(captionChunks("25-26 국내 득점 TOP 5. 점수").some((c) => c.includes("TOP\u00a05")));
for (const ch of captionChunks("대망의 1위 이정현, 18.6점. 비밀은 자유투. 자유투로만 경기당 4.5점이에요.")) {
  assert.ok(ch.length <= 16, ch);
}
assert.equal(sampleShots([[1, 1, 1], [2, 2, 0], [3, 3, 1], [4, 4, 0]], 2).length, 2);
console.log("shorts: 조사·자막·점 솎기 통과");

// 한 번에 읽힌 내레이션 → 장면 길이·자막 시각 (글자당 0.1초로 만든 가짜 alignment)
import { SCENE_JOINER, SCENE_LEAD, END_TAIL, sceneTimingsFromAlignment, sharePredicate, pointsWords, pctFloorWords, topScorerLine, compareLine } from "../lib/shorts";
{
  const texts = ["가나다, 라마.", "바사아."];
  const full = texts.join(SCENE_JOINER);
  const chars = [...full];
  const a = { characters: chars, character_start_times_seconds: chars.map((_, i) => i * 0.1), character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.1) };
  const t = sceneTimingsFromAlignment(texts, [["가나다,", "라마."], ["바사아."]], a, 1.5);
  // 둘째 장면 첫 글자 "바" = 위치 10 → 1.0초, 화면은 SCENE_LEAD 먼저
  assert.equal(t[0].seconds, Math.round((1.0 - SCENE_LEAD) * 100) / 100);
  assert.deepEqual(t[0].chunkStarts, [0, 0.5]); // "라" = 위치 5
  assert.equal(t[1].seconds, Math.round((1.5 + END_TAIL - (1.0 - SCENE_LEAD)) * 100) / 100);
}
assert.equal(sharePredicate(51.8), "전체 득점의 절반이 넘어요");
assert.equal(sharePredicate(45.5), "전체의 거의 절반이에요");
assert.equal(sharePredicate(24.3), "24%예요");
assert.equal(pointsWords(8.4), "8점 넘게");
assert.equal(pointsWords(4.5), "4.5점");
assert.equal(pctFloorWords(40.6), "40%");
assert.equal(pctFloorWords(31.1), null);
assert.equal(compareLine({ threeShare: "서명진", threePerGame: "허웅", paint: "안영준", ft: "이정현" }), "정리하면 3점은 서명진이랑 허웅, 안쪽은 안영준, 자유투는 이정현이에요.");
// AI 티 나는 말버릇이 대사에 없어야 한다
const banned = /대망의|비밀은|균형형이에요|최다\.|—/;
for (const [i, sources] of top5.entries()) {
  const l = topScorerLine({ rank: i + 1, name: ["이정현", "허웅", "안영준", "허훈", "서명진"][i], ppg: 15, sources, callout: c[i], tpPct: 40.6, ftPct: 87 });
  assert.ok(!banned.test(l.speech), l.speech);
}
console.log("shorts: 내레이션 시각·말 숫자·말버릇 통과");

// v3 말투 태그·숫자 읽기로 글자 수가 달라져도 장면 시각을 글자 찾기로 맞춘다 + 빠르기(tempo)만큼 시각이 줄어든다
import { shareNoun, stripVoiceTags } from "../lib/shorts";
{
  const texts = ["가나다, 라마.", "바사아."];
  const full = "[excited] " + texts.join(SCENE_JOINER);
  const chars = [...full];
  const a = { characters: chars, character_start_times_seconds: chars.map((_, i) => i * 0.1), character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.1) };
  const t = sceneTimingsFromAlignment(texts, [["가나다,", "라마."], ["바사아."]], a, 2, 2);
  // "바" = 위치 20 → 2.0초 ÷ 2(빠르기) = 1.0초, 화면은 SCENE_LEAD 먼저
  assert.equal(t[0].seconds, Math.round((1.0 - SCENE_LEAD) * 100) / 100);
  assert.deepEqual(t[0].chunkStarts, [0, 0.75]); // "라" = 위치 15 → 0.75초
  // 글자 시각이 없으면 글자 수 비율로 (장면 합 = 소리 길이 + 꼬리)
  const e = sceneTimingsFromAlignment(texts, [["가나다,"], ["바사아."]], { characters: [], character_start_times_seconds: [], character_end_times_seconds: [] }, 10);
  assert.ok(Math.abs(e.reduce((s, x) => s + x.seconds, 0) - (10 + END_TAIL)) < 0.05);
}
assert.equal(stripVoiceTags("[excited] 안녕 [laughs] 하세요"), "안녕 하세요");
assert.equal(shareNoun(51.8), "절반 이상");
assert.equal(shareNoun(45.5), "거의 절반");
// 쇼츠 30~40초: 선수 한 줄은 45자 이하
for (const [i, sources] of top5.entries()) {
  const l = topScorerLine({ rank: i + 1, name: ["이정현", "허웅", "안영준", "허훈", "서명진"][i], ppg: 15, sources, callout: c[i], tpPct: 40.6, ftPct: 87, onlyPosition: i === 2 ? "포워드" : null });
  assert.ok(l.caption.length <= 45, `${l.caption.length}자: ${l.caption}`);
  // 뉴스·기사체 금지 (사용자: "너무 뉴스 같음")
  assert.ok(!/의외로|기록했|나타났|차지했|대망의|비밀은/.test(l.caption), l.caption);
  if (i === 0) assert.match(l.caption, /자유투를 진짜 잘 뜯어내요/);
  if (i === 2) assert.match(l.caption, /유일한 포워드예요.*페인트/);
}
// 유일한 포지션이 가드면(가드는 페인트 이유가 안 됨) 포지션 문구를 붙이지 않는다
assert.doesNotMatch(topScorerLine({ rank: 3, name: "안영준", ppg: 15, sources: top5[2], callout: c[2], tpPct: 30, ftPct: 80, onlyPosition: "가드" }).caption, /유일한/);
console.log("shorts: v3 태그·빠르기 시각·짧은 대사 통과");

// 선수별 인사이트 — 다섯 명이 서로 다른 화면 + 비교가 들어간 대사 (2026-10-02)
import { buildInsight, insightLine, timesWords } from "../lib/shorts";
{
  const groups = ["G", "G", "F", "G", "G"];
  const ctx = {
    five: top5.map((sources, i) => ({ sources, callout: c[i], positionGroup: groups[i] })),
    leaguePpg: [18.6, 16.4, 14.9, 13.1, 12.8, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    leagueFta: [
      { id: "a", name: "이정현", value: 5.16 },
      { id: "c", name: "안영준", value: 3.32 },
      { id: "b", name: "허웅", value: 3.09 },
    ],
  };
  const ids = ["a", "b", "c", "d", "e"];
  const names = ["이정현", "허웅", "안영준", "허훈", "서명진"];
  const ins = top5.map((_, i) => buildInsight(i, ctx, { id: ids[i], ftm: 221, games: 49 }));
  assert.deepEqual(ins.map((x) => x.layout), ["counter", "ladder", "lineup", "split", "shotmap"]);
  assert.equal(new Set(ins.map((x) => x.layout)).size, 5, "다섯 명이 다른 화면");
  const ladder = ins[1] as Extract<(typeof ins)[number], { layout: "ladder" }>;
  assert.equal(ladder.beaten, 8); // 8.4 미만 경기당 득점
  assert.equal(timesWords(5.16 / 3.32), "1.5배");
  const teams = ["소노", "KCC", "SK", "KCC", "현대모비스"];
  const lines = ins.map((x, i) => insightLine({ rank: i + 1, name: names[i], ppg: 15, sources: top5[i], callout: c[i], tpPct: 40.6, ftPct: 87, team: teams[i], prevTeam: teams[i + 1] ?? null }, x).caption);
  assert.equal(lines[0], "그리고 1위, 소노의 이정현! 파울을 진짜 잘 뜯어내서 자유투 시도가 국내 1위, 2위보다 1.5배나 많아.");
  assert.equal(lines[2], "3위 SK의 안영준은 유일하게 포워드인데, 아무래도 다른 선수들보다 인사이드 득점이 눈에 띄지. 득점 거의 절반이 페인트야.");
  assert.equal(lines[3], "4위는 KCC의 허훈인데, 안에서 39%, 밖에서 36%로 거의 반반이라 수비 입장에선 어딜 막아도 지옥의 이지선다야.");
  assert.match(lines[4], /^5위 현대모비스의 서명진은 득점 절반 이상이 3점이라 자유투가 다섯 명 중 제일 적어/);
  // 같은 3점형이 둘이면 허웅 쪽은 "양으로 승부"
  assert.match(lines[1], /양으로 승부하는 슈터/);
  // 서명진: 3점 성공률·미드레인지 비중이 다섯 명 중 1위면 "점퍼 장인"
  {
    const five2 = ctx.five.map((x, j) => ({ ...x, tpPct: [31, 36, 35, 34, 40.6][j], mid: { share: [10, 15, 10, 15, 20.7][j], pct: 38 } }));
    const ins5 = buildInsight(4, { ...ctx, five: five2 }, { id: "e", ftm: 64, games: 54 });
    assert.equal(insightLine({ rank: 5, name: "서명진", ppg: 12.8, sources: top5[4], callout: c[4], tpPct: 40.6, ftPct: 80, team: "현대모비스" }, ins5).caption, "5위 현대모비스의 서명진은 3점 성공률 40%로 다섯 명 중 최고고, 미드레인지도 제일 많이 던지는 점퍼 장인이야.");
  }
  // 앞 선수와 같은 팀이면 "같은 KCC의"
  assert.match(insightLine({ rank: 2, name: "허웅", ppg: 15, sources: top5[1], callout: c[1], tpPct: 40, ftPct: 80, team: "KCC", prevTeam: "KCC" }, ins[1]).caption, /^2위는 같은 KCC의 허웅\./);
  assert.match(lines[1], /열에 다섯은/); // 14명 중 8명 → 고유어로 읽게
  for (const l of lines) {
    assert.ok(l.length <= 75, `${l.length}자: ${l}`);
    assert.ok(!/의외로|기록했|나타났|대망의|비밀은|—/.test(l), l);
  }
  // 가드가 유일한 포지션이면 lineup 이 아니다
  const g = buildInsight(2, { ...ctx, five: ctx.five.map((x, i) => ({ ...x, positionGroup: i === 2 ? "G" : "F" })) }, { id: "c", ftm: 95, games: 37 });
  assert.notEqual(g.layout, "lineup");
}
console.log("shorts: 선수별 인사이트 통과");

// 캐주얼 설명란 한 줄 (2026-10-02)
import { insightCasual, outOfTen } from "../lib/shorts";
{
  assert.equal(outOfTen(88, 109), 8);
  const ctx = {
    five: top5.map((sources, i) => ({ sources, callout: c[i], positionGroup: ["G", "G", "F", "G", "G"][i] })),
    leaguePpg: [18.6, 16.4, 9, 8, 7, 6, 5, 4, 3, 2],
    leagueFta: [{ id: "a", name: "이정현", value: 5.16 }, { id: "c", name: "안영준", value: 3.32 }],
  };
  const lines = top5.map((_, i) => insightCasual(buildInsight(i, ctx, { id: ["a", "b", "c", "d", "e"][i], ftm: 221, games: 49 }), c[i]));
  assert.match(lines[0], /파울 뜯어내기 장인.*국내 1위, 2위보다 1\.5배/);
  assert.match(lines[1], /10명 중 7명/); // 10명 중 8.4 미만 7명
  assert.equal(lines[2], "5명 중 유일한 포워드, 인사이드 득점이 확 눈에 띔. 득점 거의 절반이 페인트");
  assert.equal(lines[3], "안 39% 밖 36%, 수비 입장에선 지옥의 이지선다");
  assert.match(lines[4], /^득점 절반 이상이 3점\. 자유투는 5명 중 제일 적음/);
}
console.log("shorts: 캐주얼 설명 통과");

// 새 포맷: 개막전 대기록·슛 차트 퀴즈 (2026-10-02)
import { countWords, ordinalWords, pickMilestones, milestoneLine, pickQuiz, quizQuestionLine, quizAnswerLine } from "../lib/shorts-formats";
{
  assert.equal(countWords(2, "개"), "두 개");
  assert.equal(countWords(3, "경기"), "세 경기");
  assert.equal(countWords(15, "점"), "15점");
  assert.equal(ordinalWords(2), "두 번째");
  assert.equal(ordinalWords(1), "첫 번째");
  const base = { games: 100, points: 0, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0, wins: 0 };
  const all = [
    { ...base, playerNo: "a", name: "가", tpm: 1198, games: 700 }, // 3점 1200까지 2개
    { ...base, playerNo: "b", name: "나", tpm: 1669, games: 600 }, // 이미 넘은 선수 (역대 1명)
    { ...base, playerNo: "c", name: "다", points: 1985, games: 100 }, // 득점 2000까지 15점
    { ...base, playerNo: "d", name: "라", tpm: 98, games: 50 }, // 첫 단계(100개)는 빼야 함
    ...[1, 2, 3].map((k) => ({ ...base, playerNo: `x${k}`, name: `은퇴${k}`, points: 5000 + k })), // 득점 2000 넘은 은퇴 선수 셋 → "다"는 역대 4번째
  ];
  const picks = pickMilestones(all, new Set(["a", "c", "d"]));
  assert.deepEqual(picks.map((p) => p.playerNo), ["c", "a"]); // 희귀한(역대 2번째) 기록이 마지막
  assert.equal(picks[1].nth, 2);
  assert.equal(milestoneLine({ pick: picks[1], team: "DB", movedFrom: null, index: 1, last: true }), "그리고 마지막, DB의 가! 3점 1200개까지 딱 두 개 남았는데, 달성하면 KBL 역대 두 번째야.");
  assert.match(milestoneLine({ pick: picks[0], team: "DB", movedFrom: "현대모비스", index: 0, last: false }), /^먼저 이번에 DB로 옮긴 다는 득점 2000점까지 15점 남았어/);
  const q = pickQuiz([
    { playerNo: "1", name: "센터", team: "LG", position: "센터", ppg: 16, inside: 88, mid: 10, three: 2, shots: 500 },
    { playerNo: "2", name: "슈터", team: "KCC", position: "가드", ppg: 16.4, inside: 26, mid: 16, three: 58, shots: 500 },
    { playerNo: "3", name: "에이스", team: "SK", position: "센터", ppg: 23.2, inside: 52, mid: 20, three: 28, shots: 900 },
  ]);
  assert.deepEqual(q.map((x) => x.kind), ["inside", "three", "leader"]);
  assert.match(quizQuestionLine(q[0], 0), /^첫 번째 문제\. 3점은 거의 안 던지고, 슛 88%가 페인트 안이야\. 누굴까\? 셋, 둘, 하나!$/);
  assert.equal(quizAnswerLine(q[2]), "정답은 SK의 에이스! 경기당 23.2점이었어.");
}
console.log("shorts: 개막전 대기록·퀴즈 통과");

// D. 순위 뒤집기 대사 (2026-10-16 삼성 + LG)
{
  const { flipLines } = await import("../lib/shorts-formats");
  const t = { prevRank: 10, prevW: 16, prevL: 38, nowRank: 1, nowTied: false, nowW: 4, nowL: 0, firstMargin: 5 };
  const pl = { prevMpg: 23.5, nowMpg: 37.2, prevTs: 60, nowTs: 60, riseRank: 3 };
  const l = flipLines({
    teamCount: 10,
    up: { name: "삼성", ...t },
    down: { name: "LG", prevRank: 1, prevW: 36, prevL: 18, nowRank: 5, nowTied: true, nowW: 2, nowL: 3, firstMargin: 35 },
    game: { meeting: 1, upScore: 93, downScore: 86, star: { name: "칸터", pts: 42, up: true } },
    upStar: { name: "칸터", prevPpg: 17.3, nowPpg: 25.5, ...pl },
    downSlump: { name: "마레이", prevPpg: 16.4, nowPpg: 10.5, prevMpg: 29, nowMpg: 30, prevTs: 54.3, nowTs: 41.5, riseRank: 90 },
    downBright: { name: "양홍석", prevPpg: 7.8, nowPpg: 17, prevMpg: 21, nowMpg: 33, prevTs: 44, nowTs: 60, riseRank: 1 },
  });
  assert.equal(l.cover, "작년 꼴찌 삼성이랑 작년 1위 LG, 순위표가 완전히 뒤집혔어.");
  assert.equal(l.upTeam, "삼성은 작년에 16승 38패였는데, 올해는 4전 전승으로 1위야.");
  assert.equal(l.upStar, "그 중심엔 삼성의 칸터. 출전이 24분에서 37분으로 늘면서 득점도 17점대에서 25점대로 뛰었어.");
  assert.equal(l.clash, "그리고 올 시즌 첫 맞대결에서도 삼성이 웃었어. 93대 86, 칸터 혼자 42점!");
  assert.equal(l.downTeam, "반대로 LG는 개막전 35점 차 대승 뒤로 네 경기 1승 3패, 지금 공동 5위야.");
  assert.equal(l.downSlump, "특히 LG의 마레이, 득점이 16점대에서 10점대로, 슛 효율도 54%에서 42%로 뚝.");
  assert.match(l.downBright!, /^그래도 같은 LG의 양홍석은 7점대에서 17점대로, 리그에서/);
  // 진 팀이 이긴 경우·전승 아님
  const l2 = flipLines({
    teamCount: 10,
    up: { name: "삼성", ...t, nowW: 3, nowL: 1 },
    down: { name: "LG", prevRank: 1, prevW: 36, prevL: 18, nowRank: 5, nowTied: false, nowW: 2, nowL: 3, firstMargin: 2 },
    game: { meeting: 2, upScore: 80, downScore: 90, star: { name: "굿윈", pts: 34, up: false } },
    upStar: { name: "칸터", prevPpg: 17.3, nowPpg: 25.5, ...pl, nowMpg: 25 },
    downSlump: { name: "마레이", prevPpg: 16.4, nowPpg: 15.5, prevMpg: 29, nowMpg: 30, prevTs: 54, nowTs: 52, riseRank: 90 },
    downBright: null,
  });
  assert.equal(l2.upTeam, "삼성은 작년에 16승 38패였는데, 올해는 3승 1패로 1위야.");
  assert.equal(l2.upStar, "그 중심엔 삼성의 칸터. 득점도 17점대에서 25점대로 뛰었어.");
  assert.equal(l2.clash, "그리고 올 시즌 두 번째 맞대결에서도 LG가 웃었어. 90대 80, LG의 굿윈 혼자 34점!");
  assert.equal(l2.downTeam, "반대로 LG는 지금 2승 3패로 5위야.");
  assert.equal(l2.downSlump, "특히 LG의 마레이, 득점이 16점대에서 15점대로 떨어졌어.");
}
console.log("shorts: 순위 뒤집기 통과");
