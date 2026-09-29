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

export interface SeasonData {
  seasonCode: number;
  seasonLabel: string;    // 예: "2025-2026"
  gameType: "regular";
  fetchedAt: string;      // ISO
  players: Player[];
}
