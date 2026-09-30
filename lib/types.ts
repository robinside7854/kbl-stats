// 우리 프로젝트의 데이터 타입.
// KBL 원본 필드명(kname, fgRt 등)은 scripts/process.ts에서 여기 이름으로 한 번만 변환한다.
// app/ 은 이 타입과 data/processed/*.json 만 안다.

export interface Player {
  playerNo: string;
  nameKo: string;
  nameEn: string;
  teamCode: string;
  teamName: string;       // 예: "서울 SK"
  teamShort: string;      // 예: "SK"
  isForeign: boolean;     // 외국인 선수 여부 (이름 패턴 기반 추정 — process.ts 주석 참고)

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
  usgPct: number;
  pace: number;
  tovPct: number; toRatio: number;
  pie: number;
  poss: number;
}

/**
 * 시즌별 항목 커버리지 — "선수 50% 이상이 0이 아닌 값"이면 true (lib/metrics.ts seasonCoverage).
 * 화면은 시즌 코드가 아니라 이 플래그를 보고 열·축을 켜고 끈다.
 */
export interface SeasonCoverage {
  /** USG%·PIE·AST%·REB% (그리고 같이 생긴 OREB/DREB%·DEF/NET RTG·PACE·POSS) — 넷 모두 통과해야 true */
  advanced: boolean;
  /** +/- (margin) */
  plusMinus: boolean;
  /** 굿디펜스 (gd) */
  goodDef: boolean;
  /** 스크린 어시스트·디플렉션 — 둘 모두 통과해야 true */
  hustle: boolean;
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
  teams: Team[];
  players: Player[];
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

export interface PlayerIndexEntry {
  id: string;             // playerNo (시즌이 바뀌어도 같다. 동명이인이 있으므로 이름 대신 이것으로 식별)
  nameKo: string;         // 가장 최근 시즌 표기
  nameEn: string;         // 가장 최근 시즌 표기
  isForeign: boolean;     // 가장 최근 시즌 값
  photoUrl: string;       // 공식 프로필 사진 주소 (process.ts가 생성). 사진이 없을 수 있으므로 화면은 실패 시 대체 디자인
  seasons: PlayerIndexSeason[]; // seasonCode 오름차순
}

// ─────────────────────────────────────────────
// 화면(클라이언트)으로 넘기는 최소 필드 — 페이로드를 작게 유지하기 위해
// Player 전체가 아니라 플레이어 카드(메인 스탯 9개 + 레이더)에 필요한 값만 담는다. (lib/data.ts 에서 변환)
// ─────────────────────────────────────────────

export interface CardPlayer {
  id: string;             // playerNo
  nameKo: string;
  nameEn: string;
  teamName: string;
  teamShort: string;      // 팀 한글 약칭 (Team.shortNameKo)
  teamCode: string;
  isForeign: boolean;
  photoUrl: string | null; // 선수 색인에서 조회 (lib/data.ts). 저장 카드 영역에는 쓰지 않는다(CORS)
  games: number;
  minutes: number;        // 시즌 누적 (분)
  points: number;         // 시즌 누적
  reb: number;
  ast: number;
  stl: number;            // 이하 3개 시즌 누적 (플레이어 카드 메인 스탯)
  blk: number;
  tov: number;
  fga: number;            // 시즌 누적 시도 — 성공률 순위의 시도 기준용 (lib/metrics.ts attemptThresholds)
  tpa: number;
  fta: number;
  fgPct: number;          // 이하 KBL 계산 성공률 그대로 (0~100)
  tpPct: number;
  ftPct: number;
  per: number;
  usgPct: number;
  tsPct: number;
  astPct: number;
  rebPct: number;
  pie: number;
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
  photoUrl: string | null;
  games: number;
  minutes: number;        // 시즌 누적 (분)
  points: number;         // 이하 시즌 누적
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number; fga: number; // 이하 성공/시도 시즌 누적 — 성공률 셀 아래 "성공/시도" 표기와 시도 기준용
  tpm: number; tpa: number;
  ftm: number; fta: number;
  fgPct: number;          // 이하 KBL 계산값 그대로 (0~100)
  tpPct: number;
  ftPct: number;
  tsPct: number;
  per: number;
}
