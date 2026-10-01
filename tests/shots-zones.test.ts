// lib/shots.ts 검증: 좌표 정규화(양쪽 공격 방향 대칭) · 3점 판정 · 구역 경계 · 집계 · 주 공격 유형 (npm run test:shotzones)
// (tests/shots.test.ts 는 수집 규칙 scripts/shots.ts 용 — 이 파일은 구역 분석 규칙)
import assert from "node:assert/strict";
import {
  BASKET_PX, COURT, cornerShareOfThrees, courtGeometry, courtPoints, isThreePx, leagueZoneAverages, normalizeShot, offenseType, PX_PER_M, shareOf, shotZone,
  toShotPoint, zonePct, zoneRows, zoneSummary, type NormalizedShot, type ShotZoneKey,
} from "../lib/shots";

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

// ── 정규화 ──
// 바스켓 위치 자체는 (0, 0)
for (const d of ["1", "2"] as const) {
  const b = BASKET_PX[d];
  const s = normalizeShot({ x: b.x, y: b.y, o: "O", d })!;
  near(s.x, 0);
  near(s.y, 0);
  assert.equal(s.made, true);
  assert.equal(s.three, false);
}
// d=2(왼쪽 바스켓): 오른쪽(+x 픽셀)으로 갈수록 미드코트 쪽 +
const left = normalizeShot({ x: 34 + 100, y: 205 - 50, o: "X", d: "2" })!;
near(left.x, 100 / PX_PER_M);
near(left.y, 50 / PX_PER_M);             // 화면 위쪽 = 슈터(왼쪽을 봄)의 오른쪽
assert.equal(left.made, false);
// d=1 은 180° 돌린 점과 같은 좌표 (대칭)
const right = normalizeShot({ x: 668 - 100, y: 205 + 50, o: "X", d: "1" })!;
near(right.x, left.x);
near(right.y, left.y);
// 바스켓 뒤는 음수 그대로
assert.ok(normalizeShot({ x: 20, y: 205, o: "O", d: "2" })!.x < 0);
// 문자열 좌표도 받고, 이상한 값은 null
assert.equal(normalizeShot({ x: "134", y: "155", o: "O", d: "2" })!.made, true);
assert.equal(normalizeShot({ x: "abc", y: 1, o: "O", d: "2" }), null);
assert.equal(normalizeShot({ x: 1, y: 1, o: "O", d: "3" }), null);
console.log("shots-zones: 정규화 통과");

// ── 3점 판정 ──
assert.equal(isThreePx(0, 162), true);    // 코너 직선 구간 경계
assert.equal(isThreePx(0, 161), false);
assert.equal(isThreePx(168, 0), true);    // 호 정면 경계
assert.equal(isThreePx(167, 0), false);
assert.equal(isThreePx(120, 120), true);  // (120/168)² + (120/166)² = 1.03
assert.equal(isThreePx(110, 110), false); // 0.87
// 정규화 결과에도 같은 판정
assert.equal(normalizeShot({ x: 34 + 10, y: 205 + 163, o: "O", d: "2" })!.three, true);
assert.equal(normalizeShot({ x: 668 - 170, y: 205, o: "O", d: "1" })!.three, true);
console.log("shots-zones: 3점 판정 통과");

// ── 구역 ──
const z = (x: number, y: number, three = false): ShotZoneKey => shotZone({ x, y, three });
assert.equal(z(0, 0), "rim");
assert.equal(z(1.5, 0), "rim");            // 골밑 경계 1.5m 포함
assert.equal(z(1.06, 1.06), "rim");        // 대각 1.4999m
assert.equal(z(1.51, 0), "paint");
assert.equal(z(3, 2.45), "paint");         // 페인트 좌우 경계 포함
assert.equal(z(3, 2.46), "mid");
assert.equal(z(5.8 - COURT.basketToBaseline, 0), "paint");       // 자유투 라인(베이스라인에서 5.8m) 포함
assert.equal(z(5.8 - COURT.basketToBaseline + 0.01, 0), "mid");
assert.equal(z(-1.6, 0), "mid");           // 베이스라인 밖 2점
assert.equal(z(-1, 1.6), "paint");         // 바스켓 뒤지만 베이스라인 안
assert.equal(z(5, 4), "mid");
assert.equal(z(0, 6.6, true), "corner3");
assert.equal(z(3.0 - COURT.basketToBaseline, 6.6, true), "corner3"); // 베이스라인에서 3.0m 포함
assert.equal(z(3.0 - COURT.basketToBaseline + 0.01, 6.6, true), "arc3");
assert.equal(z(6.8, 0, true), "arc3");
console.log("shots-zones: 구역 경계 통과");

// ── 집계 · 유형 ──
const shot = (zone: ShotZoneKey, made: boolean): NormalizedShot => {
  const at: Record<ShotZoneKey, [number, number, boolean]> = {
    rim: [0.5, 0, false], paint: [3, 1, false], mid: [5, 4, false], corner3: [0, 6.6, true], arc3: [6.9, 0, true],
  };
  const [x, y, three] = at[zone];
  return { x, y, three, made };
};
const many = (spec: Partial<Record<ShotZoneKey, [number, number]>>): NormalizedShot[] =>
  Object.entries(spec).flatMap(([k, [a, m]]) => Array.from({ length: a }, (_, i) => shot(k as ShotZoneKey, i < m)));

const s1 = zoneSummary(many({ rim: [30, 20], paint: [10, 4], mid: [5, 2], corner3: [3, 1], arc3: [12, 4] }));
assert.deepEqual(s1.total, { attempts: 60, made: 31 });
assert.deepEqual(s1.zones.rim, { a: 30, m: 20 });
near(shareOf(s1, "rim"), 0.5);
near(zonePct(s1.zones.paint)!, 40);
assert.equal(zonePct({ a: 0, m: 0 }), null);
assert.equal(s1.offenseType, "inside");    // 골밑+페인트 40/60 = 67%

assert.equal(zoneSummary(many({ rim: [10, 5], arc3: [30, 10], corner3: [10, 4] })).offenseType, "shooter");   // 3점 80%, 코너 10/40 = 25%
// 코너 슈터형(2026-10-01): 3점 ≥ 50% 이고 3점 시도 중 코너 ≥ 30%. 경계 30% 는 포함, 3점 비중이 모자라면 코너가 많아도 아님
assert.equal(zoneSummary(many({ rim: [10, 5], arc3: [28, 10], corner3: [12, 4] })).offenseType, "cornerShooter"); // 코너 12/40 = 30%
assert.equal(zoneSummary(many({ rim: [10, 5], arc3: [20, 8], corner3: [30, 12] })).offenseType, "cornerShooter"); // 코너 60%
assert.equal(zoneSummary(many({ rim: [30, 10], mid: [20, 5], corner3: [20, 8] })).offenseType, "balanced");       // 3점 29%, 코너 100% — 슈터 아님(안 43·미드 29)
assert.equal(cornerShareOfThrees(zoneSummary(many({ rim: [10, 5], arc3: [28, 10], corner3: [12, 4] }))), 0.3);
assert.equal(cornerShareOfThrees(zoneSummary(many({ rim: [10, 5] }))), 0);
assert.equal(zoneSummary(many({ rim: [15, 5], mid: [20, 8], arc3: [15, 5] })).offenseType, "midrange");       // 미드 40%
assert.equal(zoneSummary(many({ rim: [12, 5], paint: [8, 3], mid: [8, 3], arc3: [22, 8] })).offenseType, "insideOut"); // 3점 44%·안 40%
assert.equal(zoneSummary(many({ rim: [15, 5], paint: [10, 3], mid: [12, 3], arc3: [13, 8] })).offenseType, "balanced"); // 안 50·3점 26·미드 24
// 경계: 골밑+페인트 정확히 55% → 골밑형, 3점 정확히 50% → 슈터형
assert.equal(zoneSummary(many({ rim: [55, 1], mid: [45, 1] })).offenseType, "inside");
assert.equal(zoneSummary(many({ rim: [30, 1], mid: [20, 1], arc3: [50, 1] })).offenseType, "shooter");
// 표본 미달(50개 미만) → null, 50개면 판정
assert.equal(zoneSummary(many({ rim: [49, 20] })).offenseType, null);
assert.equal(zoneSummary(many({ rim: [50, 20] })).offenseType, "inside");
assert.equal(offenseType({ total: { attempts: 0, made: 0 }, zones: zoneSummary([]).zones }), null);
console.log("shots-zones: 집계·유형 통과");

// ── 리그 합계 · 구역표 ──
const s2 = zoneSummary(many({ rim: [10, 8], arc3: [10, 2] }));
const league = leagueZoneAverages([s1, s2, null, undefined]);
assert.deepEqual(league.rim, { a: 40, m: 28 });
assert.deepEqual(league.arc3, { a: 22, m: 6 });
const rows = zoneRows(s2, league);
assert.deepEqual(rows.map((r) => r.key), ["rim", "paint", "mid", "corner3", "arc3"]);
near(rows[0].pct!, 80);
near(rows[0].leaguePct!, 70);
assert.equal(rows[0].aboveLeague, true);
assert.equal(rows[1].pct, null);            // 시도 0
assert.equal(rows[1].aboveLeague, false);
near(rows[0].share, 0.5);
assert.equal(zoneRows(s2, null)[0].leaguePct, null);

// ── 저장 형식 ──
assert.deepEqual(toShotPoint({ x: 1.23456, y: -0.006, made: true, three: false }), [1.23, -0.01, 1]);
assert.ok(Object.is(toShotPoint({ x: -0.004, y: 0, made: false, three: false })[0], 0)); // -0 없음
console.log("shots-zones: 리그 합계·구역표·저장 형식 통과");

// ── 코트 그림 ──
const g = courtGeometry();
assert.equal(g.lines.length, 7);
assert.equal(g.viewBox, "-7.6 -1.675 15.2 14.2");
// 3점 호: 바스켓(원점) 중심 타원, 끝점은 코너 직선 위, large-arc·sweep 모두 0 (2026-10-01 — 1 이면 호 중심이 앞으로 밀려 9.8m 까지 그려졌다)
{
  const three = g.lines[5];
  const m = /A([\d.]+) ([\d.]+) 0 (\d) (\d) (-?[\d.]+) (-?[\d.]+)V/.exec(three)!;
  assert.ok(m, three);
  const [rx, ry, large, sweep, ex, ey] = [Number(m[1]), Number(m[2]), m[3], m[4], Number(m[5]), Number(m[6])];
  assert.equal(large, "0");
  assert.equal(sweep, "0");
  assert.ok(Math.abs(rx - COURT.threeArcRy) < 0.01 && Math.abs(ry - COURT.threeArcRx) < 0.01);
  assert.ok(Math.abs((ex / rx) ** 2 + (ey / ry) ** 2 - 1) < 0.01, "끝점이 원점 중심 타원 위"); // 끝점 (c, yi) 가 원점 중심 타원 위
  assert.ok(Math.abs(ex - COURT.threeCorner) < 0.01);
}
// 반대쪽 코트(하프라인 넘어)·바스켓 뒤 베이스라인 밖 점은 그림 밖
const cp = courtPoints([[1, 0, 1], [2, 1, 0], [20, 0, 0], [-2, 0, 1], [3, -7.4, 1]]);
assert.equal(cp.made.length, 2);
assert.equal(cp.missed.length, 1);
assert.equal(cp.outside, 2);
console.log("shots-zones: 코트 그림 통과");
