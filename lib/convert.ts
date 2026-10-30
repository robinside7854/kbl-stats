// 시즌 파일(SeasonData) → 화면용 최소 필드 변환 — 순수 함수만 (파일을 읽지 않는다).
// 빌드 시 서버(lib/data.ts)와 prebuild 스크립트(scripts/build-search-index.ts → public/cards)가 같은 변환을 쓴다.
// 사진 주소는 선수 색인(players-index.json)에 있으므로 호출하는 쪽이 photoOf 로 넘긴다.

import type { CardPlayer, CardTeam, LeaderPlayer, SeasonData } from "./types";

export type PhotoLookup = (playerNo: string) => string | null;

/** 팀 코드 → 한글 약칭 (Team.shortNameKo). 팀 목록에 없는 선수 팀은 선수 기록의 약칭 그대로 */
export function koShortOf(season: SeasonData): (p: { teamCode: string; teamShort: string }) => string {
  const byCode = new Map(season.teams.map((t) => [t.teamCode, t.shortNameKo || t.shortName]));
  return (p) => byCode.get(p.teamCode) ?? p.teamShort;
}

/**
 * 플레이어 카드용 최소 필드(메인 스탯 + 레이더 6축 구성 요소). PIE 는 넘기지 않는다.
 * 옛 processed 파일(프로필·파울 필드 없음)이어도 깨지지 않게 ?? 로 기본값을 둔다.
 */
/** birthdayOf: 선수 번호 → 생년월일 (선수 색인 — 시즌 파일엔 없다). 안 넘기면 null */
export function toCardPlayers(season: SeasonData, photoOf: PhotoLookup = () => null, birthdayOf: PhotoLookup = () => null): CardPlayer[] {
  const koShort = koShortOf(season);
  // 그 시즌 수상 (선수 번호 → 상 키) — 등급 가산점 재료 (lib/metrics AWARD_GRADE_BONUS)
  const awardsOf = new Map<string, string[]>();
  for (const a of season.seasonAwards?.awards ?? []) {
    for (const w of a.winners) if (w.playerNo) awardsOf.set(w.playerNo, [...(awardsOf.get(w.playerNo) ?? []), a.key]);
  }
  return season.players.map((p) => ({
    id: p.playerNo,
    nameKo: p.nameKo,
    nameEn: p.nameEn,
    teamName: p.teamName,
    teamShort: koShort(p),
    teamCode: p.teamCode,
    isForeign: p.isForeign,
    position: p.position ?? null,
    positionGroup: p.positionGroup ?? null,
    nationality: p.nationality ?? null,
    photoUrl: photoOf(p.playerNo),
    games: p.games,
    minutes: p.minutes,
    points: p.points,
    reb: p.reb,
    ast: p.ast,
    stl: p.stl,
    blk: p.blk,
    tov: p.tov,
    fouls: p.fouls ?? 0,
    fga: p.fga,
    tpa: p.tpa,
    fta: p.fta,
    fgPct: p.fgPct,
    tpPct: p.tpPct,
    ftPct: p.ftPct,
    fgm: p.fgm ?? 0,
    twoPa: p.twoPa ?? 0,
    twoPPct: p.twoPPct ?? 0,
    tpm: p.tpm ?? 0,
    oreb: p.oreb ?? 0,
    dreb: p.dreb ?? 0,
    goodDef: p.goodDef ?? 0,
    deflections: p.deflections ?? 0,
    screenAst: p.screenAst ?? 0,
    plusMinus: p.plusMinus ?? 0,
    // 미드레인지 시도·성공 (슛 차트 구역, 슈팅 축) — 슛 데이터 없는 시즌·선수는 0
    midA: p.shotZones?.zones.mid.a ?? 0,
    midM: p.shotZones?.zones.mid.m ?? 0,
    per: p.per,
    usgPct: p.usgPct,
    rebPct: p.rebPct ?? 0,
    astPct: p.astPct ?? 0,
    tsPct: p.tsPct,
    efgPct: p.efgPct ?? 0,
    tovPct: p.tovPct ?? 0,
    astTo: p.astTo ?? 0,
    // 주 공격 유형 (슛 구역 비중) — 카드 유형 라벨 옆 작은 칩. 슛 데이터 없는 시즌·선수는 null
    offenseType: p.shotZones?.offenseType ?? null,
    awards: [...new Set(awardsOf.get(p.playerNo) ?? [])].join(","),
    heightCm: p.heightCm ?? null,
    birthday: birthdayOf(p.playerNo),
  }));
}

/** 순위표·선수 페이지 기록표용 최소 필드 (Player 전체를 클라이언트로 보내지 않는다) */
export function toLeaderPlayers(season: SeasonData, photoOf: PhotoLookup = () => null): LeaderPlayer[] {
  const koShort = koShortOf(season);
  return season.players.map((p) => ({
    id: p.playerNo,
    nameKo: p.nameKo,
    nameEn: p.nameEn,
    teamCode: p.teamCode,
    teamShort: koShort(p),
    isForeign: p.isForeign,
    position: p.position ?? null,
    positionGroup: p.positionGroup ?? null,
    nationality: p.nationality ?? null,
    photoUrl: photoOf(p.playerNo),
    games: p.games,
    wins: p.wins ?? 0,
    losses: p.losses ?? 0,
    minutes: p.minutes,
    points: p.points,
    reb: p.reb,
    ast: p.ast,
    stl: p.stl,
    blk: p.blk,
    tov: p.tov,
    fouls: p.fouls ?? 0,
    fgm: p.fgm,
    fga: p.fga,
    tpm: p.tpm,
    tpa: p.tpa,
    ftm: p.ftm,
    fta: p.fta,
    fgPct: p.fgPct,
    tpPct: p.tpPct,
    ftPct: p.ftPct,
    tsPct: p.tsPct,
    // USG% 는 coverage.advanced 시즌만 (2026-10-01 부터 KBL 값이 없는 시즌도 process 가 표준식으로 채워 전 시즌 true)
    usgPct: season.coverage?.advanced ? p.usgPct : null,
    per: p.per,
    // 허슬은 coverage.hustle 시즌만 (그 밖은 0 이 "기록 없음"이라 null)
    deflections: season.coverage?.hustle ? (p.deflections ?? 0) : null,
    screenAst: season.coverage?.hustle ? (p.screenAst ?? 0) : null,
    // 5구역 + 코너 좌우(있을 때만) — 리더보드 슛 구역 부문
    zones: p.shotZones
      ? {
          ...p.shotZones.zones,
          ...(p.shotZones.corners ? { corner3L: p.shotZones.corners.left, corner3R: p.shotZones.corners.right } : {}),
        }
      : null,
  }));
}

/** 화면에 넘길 팀 정보 (한글 약칭·로고·색만). 옛 processed 파일(shortNameKo 없음)이면 영문 약칭으로 */
export function toCardTeams(season: SeasonData): CardTeam[] {
  return season.teams.map((t) => ({
    teamCode: t.teamCode,
    shortName: t.shortNameKo || t.shortName,
    logoUrl: t.logoUrl ?? null,
    color: t.color,
  }));
}
