// 슛 차트 규칙 — 좌표 정규화 · 구역 5개 · 구역 집계 · 주 공격 유형. 순수 함수만 (계산은 여기 한 곳, 화면에서 계산하지 않는다).
// 입력은 KBL 공홈 경기 슛 차트 raw(data/raw/shots/{시즌}/{gmkey}.json)의 점 하나 { x, y, o, d } — scripts/process.ts 가 읽어 넘긴다.
// (수집 규칙은 scripts/shots.ts — 이름이 같지만 다른 파일이다.)
//
// 좌표 체계 (2026-09-30, 2025-26 정규시즌 270경기 raw 로 검증 — CLAUDE.md 서버 C):
//   - x·y 는 코트 그림(약 700×400 픽셀) 좌표. 관측 범위 x 38~692, y 26~385. 1m ≈ 24.9px.
//   - d = "1" 이면 공격 바스켓이 오른쪽(668, 205), d = "2" 면 왼쪽(34, 205).
//   - 3점 판정(FIBA 규격을 픽셀로 맞춘 값): dx = |x − bx|, dy = |y − by| 일 때
//     dy ≥ 162(코너 직선 구간, 약 6.5m) 이거나 (dx/168)² + (dy/166)² ≥ 1(약 6.75m 호) 이면 3점.
//   - 검증: 선수·경기별 점 개수 = 공식 야투 시도 98% 일치, 성공 점 개수 = 공식 야투 성공 99.7% 일치.
//     위 판정으로 센 3점 시도는 공식 3점 시도와 2.4% 차이(대부분 라인 근처 2점을 3점으로 셈) → 화면 도움말에 안내.
//
// 정규화 결과(하프코트 한 장, 미터):
//   x = 바스켓에서 미드코트 쪽 거리(0 = 바스켓 중심, 미드코트 쪽이 +, 바스켓 뒤는 − 그대로),
//   y = 좌우 거리(+ = 슈터가 바스켓을 볼 때 오른쪽). d = 1(오른쪽 바스켓)은 코트를 180° 돌린 것이라 x·y 부호를 둘 다 뒤집어 맞춘다.

import {
  OFFENSE_CORNER_MIN,
  OFFENSE_INSIDE_MIN,
  OFFENSE_INSIDE_OUT_MIN,
  OFFENSE_MID_MIN,
  OFFENSE_MIN_ATTEMPTS,
  OFFENSE_SHOOTER_MIN,
  type OffenseTypeKey,
} from "./glossary";

// ─────────────────────────────────────────────
// 코트 규격
// ─────────────────────────────────────────────

/** 코트 그림 1m 의 픽셀 수 (700px ≈ 28.1m — FIBA 코트 길이 28m 와 맞음) */
export const PX_PER_M = 24.9;
/** 공격 바스켓 중심 (픽셀): d = "1" 오른쪽, d = "2" 왼쪽 */
export const BASKET_PX = { "1": { x: 668, y: 205 }, "2": { x: 34, y: 205 } } as const;
/** 3점 코너 직선 구간: 바스켓에서 좌우 이 픽셀 이상이면 3점 (≈ 6.5m, FIBA 6.6m) */
export const THREE_CORNER_PX = 162;
/** 3점 호(타원): 바스켓 기준 앞뒤 반지름 168px(≈ 6.75m), 좌우 반지름 166px */
export const THREE_ARC_RX_PX = 168;
export const THREE_ARC_RY_PX = 166;

/** 미터 규격 (FIBA) — 구역 판정과 화면 코트 그림이 같이 쓴다 */
export const COURT = {
  /** 바스켓 중심 ~ 베이스라인 거리 (FIBA 1.575m) */
  basketToBaseline: 1.575,
  /** 하프코트 길이 (베이스라인 ~ 하프라인) */
  halfLength: 14,
  /** 코트 너비 */
  width: 15,
  /** 페인트(제한구역 사각형): 베이스라인에서 5.8m, 좌우 2.45m (폭 4.9m) */
  paintLength: 5.8,
  paintHalfWidth: 2.45,
  /** 자유투 원 반지름 */
  ftCircleRadius: 1.8,
  /** 노차지 반원 반지름 */
  restrictedRadius: 1.25,
  /** 림 반지름 (그림용) */
  rimRadius: 0.225,
  /** 백보드: 바스켓 중심 뒤 거리, 반폭 */
  backboardOffset: 0.375,
  backboardHalfWidth: 0.9,
  /** 3점 코너 직선 (y), 호 반지름 (앞뒤 rx, 좌우 ry) — 픽셀 판정값을 미터로 */
  threeCorner: THREE_CORNER_PX / PX_PER_M,
  threeArcRx: THREE_ARC_RX_PX / PX_PER_M,
  threeArcRy: THREE_ARC_RY_PX / PX_PER_M,
} as const;

/** 골밑: 바스켓 중심에서 이 거리(m) 안 */
export const RIM_RADIUS_M = 1.5;
/** 코너 3점: 베이스라인에서 이 거리(m) 안의 3점 */
export const CORNER_DEPTH_M = 3.0;

// ─────────────────────────────────────────────
// 정규화
// ─────────────────────────────────────────────

/** raw 점 하나 (필요한 필드만) */
export interface RawShotLog {
  x: number | string;
  y: number | string;
  o: string;
  d: string;
}

export interface NormalizedShot {
  /** 바스켓에서 미드코트 쪽 거리 (m, 바스켓 뒤는 −) */
  x: number;
  /** 좌우 거리 (m, + = 슈터 기준 오른쪽) */
  y: number;
  made: boolean;
  three: boolean;
}

/** 3점 판정 (픽셀 거리). dx·dy 는 바스켓 중심에서의 절댓값 */
export function isThreePx(dx: number, dy: number): boolean {
  return dy >= THREE_CORNER_PX || (dx / THREE_ARC_RX_PX) ** 2 + (dy / THREE_ARC_RY_PX) ** 2 >= 1;
}

/** raw 점 → 하프코트 미터 좌표. 좌표가 숫자가 아니거나 d 가 1·2 가 아니면 null */
export function normalizeShot(log: RawShotLog): NormalizedShot | null {
  const px = Number(log.x);
  const py = Number(log.y);
  const d = String(log.d);
  if (!Number.isFinite(px) || !Number.isFinite(py) || (d !== "1" && d !== "2")) return null;
  const b = BASKET_PX[d];
  // d = 2(왼쪽 바스켓): 미드코트 쪽 = +x 픽셀, 슈터(왼쪽을 봄)의 오른쪽 = 화면 위쪽(−y 픽셀)
  // d = 1(오른쪽 바스켓): 180° 돌린 것 → 둘 다 부호 반대
  const sign = d === "2" ? 1 : -1;
  const x = (sign * (px - b.x)) / PX_PER_M;
  const y = (sign * (b.y - py)) / PX_PER_M;
  return { x, y, made: String(log.o).toUpperCase() === "O", three: isThreePx(Math.abs(px - b.x), Math.abs(py - b.y)) };
}

// ─────────────────────────────────────────────
// 구역 5개
// ─────────────────────────────────────────────

export const SHOT_ZONE_KEYS = ["rim", "paint", "mid", "corner3", "arc3"] as const;
export type ShotZoneKey = (typeof SHOT_ZONE_KEYS)[number];

export interface ShotZoneDef {
  key: ShotZoneKey;
  label: string;
  /** 짧은 정의 (표·도움말) */
  desc: string;
  /** 정확한 판정 조건 (용어 탭 표) */
  condition: string;
  three: boolean;
}

/** 배열 순서 = 표 순서 (안쪽 → 바깥) */
export const SHOT_ZONES: readonly ShotZoneDef[] = [
  { key: "rim", label: "골밑", desc: "림 바로 아래 — 레이업·덩크·풋백", condition: `2점이고 바스켓 중심에서 ${RIM_RADIUS_M}m 안`, three: false },
  {
    key: "paint",
    label: "페인트",
    desc: "골밑을 뺀 페인트 안 — 포스트업·플로터",
    condition: `2점이고 페인트(베이스라인에서 ${COURT.paintLength}m, 좌우 ${COURT.paintHalfWidth}m) 안, 골밑 제외`,
    three: false,
  },
  { key: "mid", label: "미드레인지", desc: "페인트 밖·3점 라인 안의 중거리", condition: "골밑·페인트가 아닌 2점", three: false },
  {
    key: "corner3",
    label: "코너 3점",
    desc: "3점 라인이 가장 가까운 양쪽 코너",
    condition: `3점이고 베이스라인에서 ${CORNER_DEPTH_M}m 안`,
    three: true,
  },
  { key: "arc3", label: "아크 3점", desc: "코너를 뺀 나머지 3점(45도·정면)", condition: "코너 3점이 아닌 3점", three: true },
];

/**
 * 정규화한 점 → 구역.
 * - 3점: 베이스라인(바스켓 1.575m 뒤)에서 3.0m 안이면 코너, 아니면 아크.
 * - 2점: 바스켓 중심 1.5m 안 = 골밑 → 페인트 사각형(베이스라인 ~ 5.8m, 좌우 2.45m) 안 = 페인트 → 나머지 = 미드레인지.
 *   (베이스라인 밖 점은 페인트가 아니다 — 미드레인지)
 */
export function shotZone(s: Pick<NormalizedShot, "x" | "y" | "three">): ShotZoneKey {
  const fromBaseline = s.x + COURT.basketToBaseline;
  if (s.three) return fromBaseline <= CORNER_DEPTH_M ? "corner3" : "arc3";
  if (Math.hypot(s.x, s.y) <= RIM_RADIUS_M) return "rim";
  if (fromBaseline >= 0 && fromBaseline <= COURT.paintLength && Math.abs(s.y) <= COURT.paintHalfWidth) return "paint";
  return "mid";
}

// ─────────────────────────────────────────────
// 집계
// ─────────────────────────────────────────────

/** 시도 a · 성공 m (processed 에 저장하는 짧은 형태) */
export interface ZoneCount {
  a: number;
  m: number;
}
export type ZoneCounts = Record<ShotZoneKey, ZoneCount>;

/** 선수 한 명·한 시즌의 구역 집계 (processed players[].shotZones) */
export interface ShotZoneSummary {
  total: { attempts: number; made: number };
  zones: ZoneCounts;
  /** 주 공격 유형 — 슛 50개 미만이면 null */
  offenseType: OffenseTypeKey | null;
}

export function emptyZoneCounts(): ZoneCounts {
  return { rim: { a: 0, m: 0 }, paint: { a: 0, m: 0 }, mid: { a: 0, m: 0 }, corner3: { a: 0, m: 0 }, arc3: { a: 0, m: 0 } };
}

/** 점 목록 → 구역별 시도·성공 + 전체 + 공격 유형 */
export function zoneSummary(shots: readonly NormalizedShot[]): ShotZoneSummary {
  const zones = emptyZoneCounts();
  let made = 0;
  for (const s of shots) {
    const z = zones[shotZone(s)];
    z.a++;
    if (s.made) {
      z.m++;
      made++;
    }
  }
  const total = { attempts: shots.length, made };
  return { total, zones, offenseType: offenseType({ total, zones }) };
}

/** 성공률(0~100). 시도 0 이면 null */
export function zonePct(z: ZoneCount): number | null {
  return z.a > 0 ? (z.m / z.a) * 100 : null;
}

/** 그 구역 시도 비중(0~1). 전체 시도 0 이면 0 */
export function shareOf(s: Pick<ShotZoneSummary, "total" | "zones">, zone: ShotZoneKey): number {
  return s.total.attempts > 0 ? s.zones[zone].a / s.total.attempts : 0;
}

/** 여러 선수의 구역 집계 합 = 리그 합계 (시즌 파일 shotZoneLeague). 성공률은 zonePct 로 — 선수 평균이 아니라 전체 슛 합계 기준 */
export function leagueZoneAverages(list: readonly (Pick<ShotZoneSummary, "zones"> | null | undefined)[]): ZoneCounts {
  const out = emptyZoneCounts();
  for (const s of list) {
    if (!s) continue;
    for (const k of SHOT_ZONE_KEYS) {
      out[k].a += s.zones[k].a;
      out[k].m += s.zones[k].m;
    }
  }
  return out;
}

// ─────────────────────────────────────────────
// 주 공격 유형 (라벨·문턱은 lib/glossary OFFENSE_TYPES)
// ─────────────────────────────────────────────

/** 3점 시도 중 코너 3점 비중(0~1). 3점 시도 0 이면 0 */
export function cornerShareOfThrees(s: Pick<ShotZoneSummary, "zones">): number {
  const threes = s.zones.corner3.a + s.zones.arc3.a;
  return threes > 0 ? s.zones.corner3.a / threes : 0;
}

/**
 * 구역 시도 비중으로 주 공격 유형. 위에서부터 먼저 맞는 규칙(성공률은 보지 않는다):
 *   슛 50개 미만 → null (표본 부족)
 *   골밑+페인트 ≥ 55% → inside · 3점(코너+아크) ≥ 50% → 3점 시도 중 코너 ≥ 30% 면 cornerShooter, 아니면 shooter · 미드레인지 ≥ 30% → midrange
 *   3점 ≥ 35% 그리고 골밑+페인트 ≥ 35% → insideOut · 그 외 → balanced
 * 출처: 우리 사이트 규칙 (문턱 근거는 lib/glossary.ts OFFENSE_TYPES 주석).
 */
export function offenseType(s: Pick<ShotZoneSummary, "total" | "zones">): OffenseTypeKey | null {
  if (s.total.attempts < OFFENSE_MIN_ATTEMPTS) return null;
  const inside = shareOf(s, "rim") + shareOf(s, "paint");
  const three = shareOf(s, "corner3") + shareOf(s, "arc3");
  const mid = shareOf(s, "mid");
  if (inside >= OFFENSE_INSIDE_MIN) return "inside";
  if (three >= OFFENSE_SHOOTER_MIN) return cornerShareOfThrees(s) >= OFFENSE_CORNER_MIN ? "cornerShooter" : "shooter";
  if (mid >= OFFENSE_MID_MIN) return "midrange";
  if (three >= OFFENSE_INSIDE_OUT_MIN && inside >= OFFENSE_INSIDE_OUT_MIN) return "insideOut";
  return "balanced";
}

// ─────────────────────────────────────────────
// 화면용: 구역표 한 줄 · 점 저장 형식
// ─────────────────────────────────────────────

export interface ZoneRow {
  key: ShotZoneKey;
  label: string;
  desc: string;
  attempts: number;
  made: number;
  /** 성공률 (시도 0 이면 null) */
  pct: number | null;
  /** 시도 비중 0~1 */
  share: number;
  /** 리그 평균 성공률 (리그 기록이 없으면 null) */
  leaguePct: number | null;
  /** 성공률이 리그 평균보다 높음 (둘 중 하나라도 없으면 false) */
  aboveLeague: boolean;
}

/** 구역표 행 5개 (SHOT_ZONES 순서) */
export function zoneRows(s: Pick<ShotZoneSummary, "total" | "zones">, league: ZoneCounts | null): ZoneRow[] {
  return SHOT_ZONES.map((def) => {
    const z = s.zones[def.key];
    const pct = zonePct(z);
    const leaguePct = league ? zonePct(league[def.key]) : null;
    return {
      key: def.key,
      label: def.label,
      desc: def.desc,
      attempts: z.a,
      made: z.m,
      pct,
      share: shareOf(s, def.key),
      leaguePct,
      aboveLeague: pct !== null && leaguePct !== null && pct > leaguePct,
    };
  });
}

/** 저장·전송용 점 하나: [x(m, 소수 2자리), y(m, 소수 2자리), 성공 1 | 실패 0] */
export type ShotPoint = [number, number, 0 | 1];

// -0 은 0 으로 (JSON 에는 "0" 으로 나가지만 비교·테스트가 헷갈리지 않게)
const round2 = (v: number) => Math.round(v * 100) / 100 || 0;

export function toShotPoint(s: NormalizedShot): ShotPoint {
  return [round2(s.x), round2(s.y), s.made ? 1 : 0];
}

/** 선수·시즌 슛 파일 (public/shots/{시즌}/{선수}.json, 선수 상세 첫 화면은 서버가 같은 값을 넣는다) */
export interface PlayerShotsFile {
  seasonCode: number;
  points: ShotPoint[];
  zones: ShotZoneSummary;
  /** 그 시즌 리그 구역 합계 (리그 평균 성공률) */
  league: ZoneCounts | null;
}

/**
 * 시즌 파일 + 그 선수 점 목록 → 선수·시즌 슛 파일. 구역 집계(shotZones)나 점이 없으면 null.
 * 빌드 전 스크립트(scripts/build-shots.ts)와 서버(lib/data loadPlayerShots)가 같이 써서 첫 화면과 브라우저 결과가 같다.
 */
export function buildPlayerShotsFile(
  season: { seasonCode: number; players: readonly { playerNo: string; shotZones?: ShotZoneSummary | null }[]; shotZoneLeague?: ZoneCounts | null },
  playerNo: string,
  points: readonly ShotPoint[] | undefined,
): PlayerShotsFile | null {
  const zones = season.players.find((p) => p.playerNo === playerNo)?.shotZones;
  if (!zones || !points || points.length === 0) return null;
  return { seasonCode: season.seasonCode, points: [...points], zones, league: season.shotZoneLeague ?? null };
}

// ─────────────────────────────────────────────
// 화면 코트 그림 (하프코트, 미터 좌표 그대로 viewBox) — 선 위치를 구역 판정과 같은 상수로 그린다
// 그림 좌표: 가로 = 정규화 y(좌우), 세로 = 정규화 x(바스켓 0, 아래로 갈수록 미드코트). 베이스라인이 위.
// ─────────────────────────────────────────────

export interface CourtGeometry {
  /** SVG viewBox (선이 잘리지 않게 사방 0.1m 여유) */
  viewBox: string;
  /** 가로·세로 비율 (폭 ÷ 높이) — 자리 예약용 */
  aspect: number;
  /** 선 path 목록 (바깥선·페인트·자유투 원·노차지 반원·백보드·3점 라인·하프라인·센터 서클) */
  lines: string[];
  /** 림 원 */
  rim: { cx: number; cy: number; r: number };
  /** 그림 안에 들어오는 점만 (바깥 점 — 반대쪽 코트에서 던진 버저비터 등 — 은 잘린다) */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

const f2 = (v: number) => (Math.round(v * 1000) / 1000).toString();

export function courtGeometry(): CourtGeometry {
  const C = COURT;
  const base = -C.basketToBaseline;
  const half = base + C.halfLength;
  const w = C.width / 2;
  const pad = 0.1;
  const ftLine = base + C.paintLength;
  // 3점: 코너 직선(가로 ±threeCorner) → 타원 호(가로 반지름 threeArcRy, 세로 반지름 threeArcRx)와 만나는 세로 위치
  const c = C.threeCorner;
  const yi = C.threeArcRx * Math.sqrt(Math.max(0, 1 - (c / C.threeArcRy) ** 2));
  const r = C.restrictedRadius;
  const bb = -C.backboardOffset;
  const lines = [
    `M${f2(-w)} ${f2(base)}H${f2(w)}V${f2(half)}H${f2(-w)}Z`,
    `M${f2(-C.paintHalfWidth)} ${f2(base)}V${f2(ftLine)}H${f2(C.paintHalfWidth)}V${f2(base)}`,
    `M${f2(-C.ftCircleRadius)} ${f2(ftLine)}A${f2(C.ftCircleRadius)} ${f2(C.ftCircleRadius)} 0 1 0 ${f2(C.ftCircleRadius)} ${f2(ftLine)}A${f2(C.ftCircleRadius)} ${f2(C.ftCircleRadius)} 0 1 0 ${f2(-C.ftCircleRadius)} ${f2(ftLine)}`,
    `M${f2(-r)} ${f2(bb)}V0A${f2(r)} ${f2(r)} 0 0 0 ${f2(r)} 0V${f2(bb)}`,
    `M${f2(-C.backboardHalfWidth)} ${f2(bb)}H${f2(C.backboardHalfWidth)}`,
    // 호: 양 끝점이 바스켓(원점) 중심 타원 위에 있고 가운데(0, rx)를 지나는 쪽은 180° 미만이라 large-arc 는 0.
    // (2026-10-01 수정: 1 로 두면 SVG 가 다른 쪽 중심(0, 2·yi)을 골라 호가 약 9.8m 까지 그려져 3점 점이 호 안쪽에 보였다)
    // 화면 위에서 왼쪽 끝 → 오른쪽 끝을 아래(y 증가)로 도는 방향 = 반시계 → sweep 0.
    `M${f2(-c)} ${f2(base)}V${f2(yi)}A${f2(C.threeArcRy)} ${f2(C.threeArcRx)} 0 0 0 ${f2(c)} ${f2(yi)}V${f2(base)}`,
    `M${f2(-C.ftCircleRadius)} ${f2(half)}A${f2(C.ftCircleRadius)} ${f2(C.ftCircleRadius)} 0 0 1 ${f2(C.ftCircleRadius)} ${f2(half)}`,
  ];
  return {
    viewBox: `${f2(-w - pad)} ${f2(base - pad)} ${f2(C.width + 2 * pad)} ${f2(C.halfLength + 2 * pad)}`,
    aspect: (C.width + 2 * pad) / (C.halfLength + 2 * pad),
    lines,
    rim: { cx: 0, cy: 0, r: C.rimRadius },
    bounds: { minX: base, maxX: half, minY: -w, maxY: w },
  };
}

/** 그림 안(하프코트)에 들어오는 점만 — 순서는 실패 먼저, 성공 나중(성공 점이 위에 그려지게) */
export function courtPoints(points: readonly ShotPoint[]): { missed: ShotPoint[]; made: ShotPoint[]; outside: number } {
  const b = courtGeometry().bounds;
  const missed: ShotPoint[] = [];
  const made: ShotPoint[] = [];
  let outside = 0;
  for (const p of points) {
    if (p[0] < b.minX || p[0] > b.maxX || p[1] < b.minY || p[1] > b.maxY) {
      outside++;
      continue;
    }
    (p[2] === 1 ? made : missed).push(p);
  }
  return { missed, made, outside };
}
