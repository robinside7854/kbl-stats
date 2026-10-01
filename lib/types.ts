// 우리 프로젝트의 데이터 타입.
// KBL 원본 필드명(kname, fgRt 등)은 scripts/process.ts에서 여기 이름으로 한 번만 변환한다.
// app/ 은 이 타입과 data/processed/*.json 만 안다.

import type { LeaderZoneCounts, ShotZoneSummary, ZoneCounts } from "./shots";
import type { OffenseTypeKey } from "./glossary";

// ─────────────────────────────────────────────
// 선수 프로필 — 서버 B 선수 마스터(data/raw/players/players.json)에서 playerNo 로 조인 (scripts/player-master.ts)
// 마스터 파일이 없거나 마스터에 없는 선수면 전부 null. 마스터는 "지금" 기준 한 장이라
// backNumber·heightCm 등은 시즌별 값이 아니라 현재(또는 마지막 등록) 값이다.
// ─────────────────────────────────────────────

/** 포지션: G 가드, F 포워드, C 센터, GF 가드-포워드, FC 포워드-센터 (KBL pos 코드 GD·FD·C·GF·FC) */
export type Position = "G" | "F" | "C" | "GF" | "FC";
/** 비교용 포지션 묶음 — GF→G, FC→F (첫 글자 기준, lib/roster.ts positionGroupOf) */
export type PositionGroup = "G" | "F" | "C";
/** 국적 구분: KBL playerFlagCode2 "0" 국내 · "1" 외국 · "2" 아시아쿼터 */
export type Nationality = "domestic" | "foreign" | "asia";

export interface DraftInfo {
  year: number;           // 드래프트 연도 (yearNo)
  round: number | null;   // 라운드 (roundNo)
  pick: number | null;    // 순위 (rankNo)
}

export interface PlayerProfile {
  position: Position | null;
  positionLabel: string | null;       // "가드" / "포워드" / "센터" / "가드-포워드" / "포워드-센터"
  positionGroup: PositionGroup | null;
  nationality: Nationality | null;
  heightCm: number | null;            // pHeight
  weightKg: number | null;            // pWeight
  backNumber: string | null;          // backNum (현재 등번호, "0"과 "00"을 구분하려고 문자열)
  draft: DraftInfo | null;            // 외국 선수 등 드래프트 기록이 없으면 null
}

// ─────────────────────────────────────────────
// 한 경기 최다(시즌 하이·커리어 하이) — 서버 B mostgame 응답(data/raw/highs/{시즌}/{선수}.json)에서
// scripts/highs.ts 가 우리 키로 바꾼다. raw 가 없으면 null (백필 전 옛 processed 파일에는 필드 자체가 없을 수 있음).
// ─────────────────────────────────────────────

/**
 * 한 경기 최다 부문 15개 (KBL recordTxt → 우리 키, scripts/highs.ts RECORD_TXT_TO_KEY).
 * 기록(RECORD) 11개: 득점·야투 성공·2점 성공·3점 성공·자유투 성공·공격/수비/전체 리바운드·어시스트·스틸·블록
 * 성공률(RATE) 4개: 야투·2점·3점·자유투 성공률 — 시도 수 조건이 없어 순위표에는 쓰지 않는다 (lib/highs.ts)
 */
export type HighKey =
  | "pts" | "fgm" | "fgPct" | "twoPm" | "twoPPct" | "tpm" | "tpPct" | "ftm" | "ftPct"
  | "oreb" | "dreb" | "reb" | "ast" | "stl" | "blk";

/** 순위표 "이 시즌 한 경기 최다"에 쓰는 기록(RECORD) 부문 11개 */
export type SeasonHighLeaderKey = Exclude<HighKey, "fgPct" | "twoPPct" | "tpPct" | "ftPct">;

export interface HighRecord {
  value: number;                   // 기록 (성공률은 0~100)
  date: string | null;             // 달성 날짜 "2023-10-21" (gameDate "20231021" → ISO)
  opponentTeamCode: string | null; // 상대 팀 코드 (awayTeam)
  times: number | null;            // 같은 최고 기록을 낸 횟수 (scoreRankCn)
  seasonCode: number | null;       // 달성 시즌 (통산 기록의 상대 팀 이름 조회용)
  /**
   * 슛 성공 부문(3점·자유투·야투 성공)만: 그 경기의 시도 수·성공률(0~100). mostgame 응답에는 성공 개수만 있어서
   * process.ts 가 같은 선수·시즌·날짜의 경기별 기록(data/raw/gamelogs)에서 찾아 붙인다 (scripts/gamelogs.ts).
   * 못 찾았거나 슛 부문이 아니면 null/없음 → 화면은 개수만.
   */
  attempts?: number | null;
  pct?: number | null;
}

/** 부문별 한 경기 최다. 그 부문 기록이 응답에 없으면 null */
export type HighsSet = Record<HighKey, HighRecord | null>;

/** 통산 한 경기 최다 — 정규시즌 / 플레이오프 / 챔피언결정전. 응답에 그 배열이 없거나 비어 있으면 null */
export interface CareerHighs {
  regular: HighsSet | null;
  playoff: HighsSet | null;
  finals: HighsSet | null;
}

export interface SeasonHighLeader extends HighRecord {
  playerNo: string;
}

/** 시즌 파일의 부문별 시즌 하이 1위 (lib/highs.ts computeSeasonHighLeaders — 동률이면 먼저 달성한 선수) */
export type SeasonHighLeaders = Record<SeasonHighLeaderKey, SeasonHighLeader | null>;

export interface Player extends PlayerProfile {
  playerNo: string;
  nameKo: string;
  nameEn: string;
  teamCode: string;
  teamName: string;       // 예: "서울 SK"
  teamShort: string;      // 예: "SK"
  isForeign: boolean;     // 외국 선수 여부: 마스터가 있으면 nationality !== "domestic"(아시아쿼터 포함), 없으면 이름 추정 (process.ts)

  // 출전
  games: number;
  wins: number;
  losses: number;
  minutes: number;        // playSec / 60

  // 1차 스탯 (시즌 누적)
  points: number;
  fgm: number; fga: number; fgPct: number;
  tpm: number; tpa: number; tpPct: number;
  twoPm: number; twoPa: number; twoPPct: number;
  ftm: number; fta: number; ftPct: number;
  dunks: number;
  oreb: number; dreb: number; reb: number;
  ast: number; stl: number; blk: number; tov: number;
  goodDef: number;        // gd: KBL 고유 지표 "굿디펜스"
  fouls: number;
  doubleDoubles: number;
  tripleDoubles: number;
  plusMinus: number;      // margin
  screenAst: number;      // sA
  deflections: number;    // df

  // 2차 스탯 (KBL 계산값 그대로)
  per: number;
  offRtg: number; defRtg: number; netRtg: number;
  efgPct: number; tsPct: number;
  astPct: number; astTo: number; astRatio: number;
  orebPct: number; drebPct: number; rebPct: number;
  /**
   * USG% — **표준 척도(KBL 원값 × 5)**. KBL 값은 Basketball-Reference 표준식의 정확히 1/5 로 확인됨
   * (2025-26 500분 이상 전원 표준식/KBL 비율 4.95~5.06, 팀 출전시간/5 항이 빠진 것으로 추정). CLAUDE.md 참고.
   */
  usgPct: number;
  /** KBL 원값 그대로 (usgPct / 5) — 원본 보존용 */
  usgPctRaw: number;
  pace: number;
  tovPct: number; toRatio: number;
  /** KBL 원값 그대로 보존만 한다. 화면용 타입·레이더·커버리지 판정에서는 쓰지 않는다(2026-09-30 결정) */
  pie: number;
  poss: number;

  /** 이 시즌 한 경기 최다 (정규시즌). 그 시즌 raw(data/raw/highs)가 없으면 null — 옛 processed 파일엔 필드가 없다 */
  seasonHighs?: HighsSet | null;

  /**
   * 슛 구역 집계 (정규시즌 슛 차트 좌표로 계산, lib/shots.ts zoneSummary). 그 시즌 슛 차트 raw 가 없거나 이 선수 슛이 0개면 null.
   * 점 좌표는 data/processed/{시즌}/shots.json 에 따로 있다.
   */
  shotZones?: ShotZoneSummary | null;
}

/**
 * 시즌별 항목 커버리지 — "선수 50% 이상이 0이 아닌 값"이면 true (lib/metrics.ts seasonCoverage).
 * 화면은 시즌 코드가 아니라 이 플래그를 보고 열·축을 켜고 끈다.
 */
export interface SeasonCoverage {
  /** USG%·AST%·REB% — 셋 모두 통과해야 true (PIE 는 판정에서 뺌). KBL 값이 없는 시즌은 process 가 표준식으로 채우므로 전 시즌 true (advancedSource 참고) */
  advanced: boolean;
  /** +/- (margin) */
  plusMinus: boolean;
  /** 굿디펜스 (gd) */
  goodDef: boolean;
  /** 스크린 어시스트·디플렉션 — 둘 모두 통과해야 true */
  hustle: boolean;
  /** 슛 차트 — 선수 50% 이상에 슛 좌표가 있으면 true (process.ts, lib/metrics seasonCoverage 가 아니라 슛 raw 로 판정). 옛 파일엔 없음 */
  shots?: boolean;
}

/**
 * 팀 색 (data/codes/team-colors.json → process.ts가 teams[].color 에 넣음).
 * 손으로 관리하는 근사값이며, 코드표에 없는 팀은 회색 기본값.
 */
export interface TeamColor {
  primary: string;        // 배경 등 주 색, 예: "#E4002B"
  secondary: string;      // 보조 색
  text: string;           // primary 위에 올릴 글자 색
}

/** 시즌 참가 팀 (raw teams.json → process.ts에서 변환) */
export interface Team {
  teamCode: string;       // 예: "55" (팀명이 바뀌어도 유지, 구단 매각 시 새 코드)
  name: string;           // teamName1, 예: "서울 SK"
  shortName: string;      // teamName4, 예: "SK" (옛 시즌은 영문 대문자, 예: "DAEWOO SECURITIES")
  shortNameKo: string;    // 한글 약칭 (lib/teams.ts teamShortNameKo), 예: "현대모비스". 화면은 이 값을 쓴다
  fullName: string;       // teamName2, 예: "서울 SK 나이츠"
  nameEn: string;         // teamName3, 예: "SEOUL SK KNIGHTS"
  logoName: string;       // teamLogoName, 예: "sk" (teams.json이 없어 선수 데이터로 대체한 경우 "")
  order: number;          // orderNo (KBL 공홈 표시 순서)
  logoUrl: string | null; // 공식 로고 주소 (process.ts가 logoName으로 생성, 없으면 null). 화면은 이 값만 쓴다
  color: TeamColor;
}

export interface SeasonData {
  seasonCode: number;
  seasonLabel: string;    // 예: "2025-2026"
  gameType: "regular";
  fetchedAt: string;      // ISO
  coverage: SeasonCoverage;
  /** USG%·AST%·REB%·OREB%·DREB% 출처: "kbl" = KBL 계산값(2025-26), "computed" = 표준식으로 우리가 계산(lib/metrics computeTeamShareStats). 옛 파일엔 없음 */
  advancedSource?: "kbl" | "computed";
  teams: Team[];
  players: Player[];
  /** 부문별 시즌 하이 1위 (기록 부문 11개). 그 시즌 한 경기 최다 raw 가 없으면 null — 옛 processed 파일엔 필드가 없다 */
  seasonHighLeaders?: SeasonHighLeaders | null;
  /** 슛 구역 리그 합계 (그 시즌 전 선수 합, lib/shots leagueZoneAverages). 슛 차트 raw 가 없으면 null */
  shotZoneLeague?: ZoneCounts | null;
}

// ─────────────────────────────────────────────
// 선수 색인 — data/processed/players-index.json (검색·선수 페이지의 뼈대)
// ─────────────────────────────────────────────

export interface PlayerIndexSeason {
  seasonCode: number;
  teamCode: string;
  teamShort: string;      // 그 시즌 팀 한글 약칭 (Team.shortNameKo)
  games: number;
}

export interface PlayerIndexEntry extends PlayerProfile {
  id: string;             // playerNo (시즌이 바뀌어도 같다. 동명이인이 있으므로 이름 대신 이것으로 식별)
  nameKo: string;         // 가장 최근 시즌 표기
  nameEn: string;         // 가장 최근 시즌 표기
  isForeign: boolean;     // 가장 최근 시즌 값 (마스터가 있으면 nationality 기준)
  /** 공식 프로필 사진 주소 (process.ts가 생성). 사진이 없을 수 있으므로 화면은 실패 시 대체 디자인.
   *  data/codes/photo-overrides.json hide 에 적힌 선수(코치 사진으로 바뀐 경우 등)는 null → 대체 디자인 */
  photoUrl: string | null;
  seasons: PlayerIndexSeason[]; // seasonCode 오름차순
  /** 통산 한 경기 최다 (가장 최근 시즌 raw 의 AllTimes). raw 가 없으면 null — 옛 색인엔 필드가 없다 */
  careerHighs?: CareerHighs | null;
  /** 이하 3개: 서버 B 프로필(data/raw/profiles/{선수}.json). 없으면 null */
  birthday?: string | null;   // "1994-01-31"
  country?: string | null;    // 국가명, 예: "미국"
  school?: string | null;     // 출신 학교(univSch), 예: "Stony brook"
}

// ─────────────────────────────────────────────
// 화면(클라이언트)으로 넘기는 최소 필드 — 페이로드를 작게 유지하기 위해
// Player 전체가 아니라 플레이어 카드(메인 스탯 10개 + 레이더 6축 구성 요소)에 필요한 값만 담는다. (lib/data.ts 에서 변환)
// ─────────────────────────────────────────────

export interface CardPlayer {
  id: string;             // playerNo
  nameKo: string;
  nameEn: string;
  teamName: string;
  teamShort: string;      // 팀 한글 약칭 (Team.shortNameKo)
  teamCode: string;
  isForeign: boolean;
  position: Position | null;          // 이하 3개: 선수 마스터 (없으면 null). 포지션 표기는 lib/roster.ts positionLabel
  positionGroup: PositionGroup | null;
  nationality: Nationality | null;
  photoUrl: string | null; // 선수 색인에서 조회 (lib/data.ts). 저장 카드 영역에는 쓰지 않는다(CORS)
  games: number;
  minutes: number;        // 시즌 누적 (분)
  points: number;         // 시즌 누적
  reb: number;
  ast: number;
  stl: number;            // 이하 3개 시즌 누적 (플레이어 카드 메인 스탯)
  blk: number;
  tov: number;
  fouls: number;          // 시즌 누적 파울 (카드에는 경기당, 순위 없음)
  fga: number;            // 시즌 누적 시도 — 성공률 순위의 시도 기준용 (lib/metrics.ts attemptThresholds)
  tpa: number;
  fta: number;
  fgPct: number;          // 이하 KBL 계산 성공률 그대로 (0~100)
  tpPct: number;
  ftPct: number;
  // 이하 레이더 6축 구성 요소 (lib/metrics RADAR_COMPONENTS) — 누적은 시즌 합계, 비율·지수는 KBL 계산값
  fgm: number;            // 야투 성공 (공격 축)
  twoPa: number;          // 2점 시도 (옛 레이더 축 재료 — 지금은 레이더에 안 쓰지만 카드 파일 호환으로 남김)
  twoPPct: number;        // 2점 성공률 (같음)
  tpm: number;            // 3점 성공
  oreb: number;
  dreb: number;
  goodDef: number;        // 굿디펜스 (coverage.goodDef 시즌만 의미 있음)
  deflections: number;    // 디플렉션 (coverage.hustle)
  screenAst: number;      // 스크린 어시스트 (coverage.hustle — 레이더엔 안 씀)
  plusMinus: number;      // +/- 시즌 합계 (coverage.plusMinus — 레이더엔 안 씀)
  midA: number;           // 미드레인지 슛 시도 (슛 차트 구역 lib/shots, coverage.shots 시즌만. 없으면 0)
  midM: number;           // 미드레인지 슛 성공
  per: number;
  usgPct: number;         // 표준 척도(×5). coverage.advanced 가 아니면 0 이거나 일부만 있다
  rebPct: number;         // REB% (coverage.advanced)
  astPct: number;         // AST% (coverage.advanced)
  tsPct: number;
  efgPct: number;
  tovPct: number;
  astTo: number;
  /** 주 공격 유형 (슛 구역 비중, lib/shots offenseType). 슛 데이터가 없거나 50개 미만이면 null. 옛 카드 파일엔 없음 */
  offenseType?: OffenseTypeKey | null;
}

/** 화면으로 넘기는 팀 정보 (로고·색만) */
export interface CardTeam {
  teamCode: string;
  shortName: string;      // 한글 약칭 (Team.shortNameKo, 예: "현대모비스") — 화면 표기·로고 대체 글자에 쓴다
  logoUrl: string | null;
  color: TeamColor;
}

export interface SeasonOption {
  seasonCode: number;
  seasonLabel: string;
}

/**
 * 시즌 순위표(/season/[코드]/leaders)로 넘기는 최소 필드 (lib/data.ts toLeaderPlayers 에서 변환).
 * 누적값은 시즌 합계 그대로 넘기고, 경기당 환산은 화면이 lib/leaders.ts(→ metrics.perGame)로 한다.
 */
export interface LeaderPlayer {
  id: string;             // playerNo (동명이인 → key 는 항상 이것)
  nameKo: string;
  nameEn: string;
  teamCode: string;
  teamShort: string;      // 팀 한글 약칭 (Team.shortNameKo) — 팀 목록에 없는 경우의 대체 표기용
  isForeign: boolean;
  position: Position | null;          // 이하 3개: 선수 마스터 (없으면 null)
  positionGroup: PositionGroup | null;
  nationality: Nationality | null;
  photoUrl: string | null;
  games: number;
  /** 뛴 경기의 팀 승·패 (결장 경기 제외 — KBL 선수 기록 그대로) */
  wins: number;
  losses: number;
  minutes: number;        // 시즌 누적 (분)
  points: number;         // 이하 시즌 누적
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fouls: number;
  fgm: number; fga: number; // 이하 성공/시도 시즌 누적 — 성공률 셀 아래 "성공/시도" 표기와 시도 기준용
  tpm: number; tpa: number;
  ftm: number; fta: number;
  fgPct: number;          // 이하 KBL 계산값 그대로 (0~100)
  tpPct: number;
  ftPct: number;
  tsPct: number;
  /** USG% (표준 척도 ×5). 그 시즌에 USG% 가 없으면(coverage.advanced 아님) null → 화면 "–" */
  usgPct: number | null;
  per: number;
  /** 디플렉션·스크린 어시스트 시즌 합계 (coverage.hustle 시즌만, 아니면 null) */
  deflections?: number | null;
  screenAst?: number | null;
  /** 슛 구역별 시도·성공 (슛 차트 있는 시즌·선수만, 아니면 null) — 순위표 구역 성공률 부문 */
  zones?: LeaderZoneCounts | null;
}

// ─────────────────────────────────────────────
// 선수 페이지(/player/[선수번호]) — 한 선수의 전 시즌 기록 (lib/data.ts loadPlayerCareer)
// ─────────────────────────────────────────────

/**
 * 선수 페이지 시즌별 한 줄. 순위표 행(LeaderPlayer)과 같은 필드 + 시즌·그 시즌 팀 정보.
 * 같은 모양이라 표기·경기당 환산은 lib/leaders.ts(statValue·formatStat)를 그대로 쓴다.
 */
export interface CareerSeason extends LeaderPlayer {
  seasonCode: number;
  seasonLabel: string;    // 예: "2025-2026" (짧은 표기는 lib/career.ts seasonShortLabel)
  team: CardTeam | null;  // 그 시즌 팀 (로고·색·한글 약칭). 시즌 팀 목록에 없으면 null
  /** 그 시즌 리그 1위 부문 (단위별 — lib/leaders seasonLeaderMarks). 기록표에서 굵게 */
  leaderMarks?: Partial<Record<"perGame" | "total" | "per30", string[]>>;
}

export interface PlayerCareer {
  entry: PlayerIndexEntry;
  /** 시즌 오름차순 (오래된 시즌이 먼저) */
  seasons: CareerSeason[];
}

// ─────────────────────────────────────────────
// 검색용 경량 색인 — public/search-index.json (scripts/build-search-index.ts 가 빌드 전에 생성)
// ─────────────────────────────────────────────

export interface SearchEntry {
  id: string;             // playerNo
  nameKo: string;
  nameEn: string;
  team: string;           // 가장 최근 시즌 팀 한글 약칭
  from: string;           // 첫 시즌 짧은 표기, 예: "2019-20"
  to: string;             // 마지막 시즌 짧은 표기
  last: number;           // 마지막 시즌 코드 (검색 결과 정렬: 최근 선수 먼저)
  seasons: number[];      // 뛴 시즌 코드 전부 (오름차순) — 비교 탭 시즌 칩
  photoUrl: string | null; // process.ts 가 만든 주소 그대로 (화면은 KBL 주소를 모른다). 사진 숨김 선수는 null
  positionGroup: PositionGroup | null; // 선수 마스터 (없으면 null)
  positionLabel: string | null;        // 예: "가드-포워드"
  color: { primary: string; text: string }; // 최근 팀 색 (아바타 대체 디자인)
  /** 프라임 시즌 코드 (lib/prime — 표본 충족 시즌 2개 이상인 선수만) */
  prime?: number;
}
