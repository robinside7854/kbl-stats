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
 * 플레이어 카드용 최소 필드(메인 스탯 + 레이더 5축 구성 요소). PIE·AST%·REB% 는 넘기지 않는다(레이더에서 뺌).
 * 옛 processed 파일(프로필·파울 필드 없음)이어도 깨지지 않게 ?? 로 기본값을 둔다.
 */
export function toCardPlayers(season: SeasonData, photoOf: PhotoLookup = () => null): CardPlayer[] {
  const koShort = koShortOf(season);
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
    twoPa: p.twoPa ?? 0,
    twoPPct: p.twoPPct ?? 0,
    tpm: p.tpm ?? 0,
    oreb: p.oreb ?? 0,
    dreb: p.dreb ?? 0,
    goodDef: p.goodDef ?? 0,
    deflections: p.deflections ?? 0,
    screenAst: p.screenAst ?? 0,
    plusMinus: p.plusMinus ?? 0,
    per: p.per,
    usgPct: p.usgPct,
    tsPct: p.tsPct,
    efgPct: p.efgPct ?? 0,
    tovPct: p.tovPct ?? 0,
    astTo: p.astTo ?? 0,
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
    // USG% 는 2차 스탯이 있는 시즌(coverage.advanced)만. 그 밖의 시즌은 일부 선수만 값이 있어 비교가 안 되므로 null
    usgPct: season.coverage?.advanced ? p.usgPct : null,
    per: p.per,
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
