// 용어 설명 데이터 — 화면의 "이 지표가 뭐예요?" 풀이가 읽는다. 계산은 하지 않는다(계산은 lib/metrics.ts).
// 공식은 Basketball-Reference 용어집 표기를 따르고, KBL 값과 우리 데이터로 맞춰 본 결과를 note 에 적는다.
// (검산: 2026-09-30, 2025-26 정규시즌 processed 데이터. 예: 워니 TS 49.8 = 1158 / (2 × (1091 + 0.44 × 161)))

const BREF_GLOSSARY = "https://www.basketball-reference.com/about/glossary.html";
const BREF_PER = "https://www.basketball-reference.com/about/per.html";
const BREF_RATINGS = "https://www.basketball-reference.com/about/ratings.html";
const BREF_PER36 = "https://www.basketball-reference.com/about/glossary.html#per_minute";
const WIKI_PERCENTILE_RANK = "https://en.wikipedia.org/wiki/Percentile_rank";

export type GlossaryKey =
  | "per"
  | "tsPct"
  | "efgPct"
  | "usgPct"
  | "astPct"
  | "rebPct"
  | "tovPct"
  | "astTo"
  | "ratings"
  | "pace"
  | "per40"
  | "percentileGrade"
  | "radarAxes"
  | "qualify"
  | "attempts";

export interface GlossaryEntry {
  key: GlossaryKey;
  /** 지표 이름 (화면 표기) */
  name: string;
  /** 팬 눈높이 한 줄 설명 */
  short: string;
  /** 계산식 (사람이 읽는 문자열) */
  formula: string;
  /** 출처 URL. 우리 사이트 규칙이라 외부 출처가 없으면 null */
  source: string | null;
  /** KBL 값과의 관계·검산 결과·주의 사항 */
  note: string;
}

/** 배열 순서 = 용어 풀이 화면 표시 순서 */
export const GLOSSARY: readonly GlossaryEntry[] = [
  {
    key: "per",
    name: "PER",
    short: "출전 시간 대비 기여를 한 숫자로 나타낸 값. 리그 평균은 약 15",
    formula: "득점·리바운드·어시스트·스틸·블록 등 좋은 기록에서 놓친 슛·턴오버·파울을 빼고 분당·리그 평균으로 맞춘 값 (Hollinger)",
    source: BREF_PER,
    note: "KBL 계산값 그대로 씁니다. KBL이 계산식을 공개하지 않아 우리 데이터로 검산할 수 없습니다.",
  },
  {
    key: "tsPct",
    name: "TS%",
    short: "2점·3점·자유투를 모두 반영한 슈팅 효율",
    formula: "TS% = 득점 ÷ (2 × (야투 시도 + 0.44 × 자유투 시도)) × 100",
    source: BREF_GLOSSARY,
    note: "KBL 계산값 그대로이며, 우리 데이터로 검산해 일치합니다.",
  },
  {
    key: "efgPct",
    name: "eFG%",
    short: "3점슛을 1.5개로 쳐 준 야투 성공률",
    formula: "eFG% = (야투 성공 + 0.5 × 3점 성공) ÷ 야투 시도 × 100",
    source: BREF_GLOSSARY,
    note: "KBL 계산값 그대로이며, 우리 데이터로 검산해 일치합니다.",
  },
  {
    key: "usgPct",
    name: "USG%",
    short: "코트에 있을 때 팀 공격을 몇 %나 자기 손으로 끝냈나",
    formula:
      "USG% = 100 × ((야투 시도 + 0.44 × 자유투 시도 + 턴오버) × (팀 출전시간 ÷ 5)) ÷ (출전시간 × (팀 야투 시도 + 0.44 × 팀 자유투 시도 + 팀 턴오버))",
    source: BREF_GLOSSARY,
    note: "KBL 원값은 표준식의 1/5로 확인되어(2025-26 500분 이상 선수 전원 비율 4.95~5.06) ×5로 표시합니다. 원값은 usgPctRaw 로 보존합니다.",
  },
  {
    key: "astPct",
    name: "AST%",
    short: "코트에 있을 때 동료 야투 성공 중 몇 %를 어시스트했나",
    formula: "AST% = 100 × 어시스트 ÷ (((출전시간 ÷ (팀 출전시간 ÷ 5)) × 팀 야투 성공) − 야투 성공)",
    source: BREF_GLOSSARY,
    note: "KBL 계산값 그대로이며, 우리 데이터로 검산해 일치합니다. 2025-26 시즌에만 제공됩니다.",
  },
  {
    key: "rebPct",
    name: "REB% (OREB% / DREB%)",
    short: "코트에 있을 때 잡을 수 있던 리바운드 중 몇 %를 잡았나 (공격·수비 따로도)",
    formula:
      "REB% = 100 × (리바운드 × (팀 출전시간 ÷ 5)) ÷ (출전시간 × (팀 리바운드 + 상대 리바운드)) · OREB%·DREB% 는 공격(팀 공격 + 상대 수비)·수비(팀 수비 + 상대 공격) 리바운드로 같은 식",
    source: BREF_GLOSSARY,
    note: "KBL 계산값 그대로 씁니다(팀·상대 리바운드가 없어 우리 쪽 검산은 못 함). 2025-26 시즌에만 제공됩니다.",
  },
  {
    key: "tovPct",
    name: "TOV%",
    short: "공격 100번 중 몇 번을 턴오버로 날렸나",
    formula: "TOV% = 100 × 턴오버 ÷ (야투 시도 + 0.44 × 자유투 시도 + 턴오버)",
    source: BREF_GLOSSARY,
    note: "KBL 계산값 그대로이며, 우리 데이터로 검산해 일치합니다.",
  },
  {
    key: "astTo",
    name: "AST/TO",
    short: "턴오버 1개당 어시스트 수. 높으면 공을 안정적으로 다룬다는 뜻",
    formula: "AST/TO = 어시스트 ÷ 턴오버",
    source: BREF_GLOSSARY,
    note: "KBL 계산값 그대로이며, 우리 데이터로 검산해 일치합니다.",
  },
  {
    key: "ratings",
    name: "ORtg / DRtg / NetRtg",
    short: "100번 공격(수비)당 만든(내준) 득점, 그리고 그 차이",
    formula: "ORtg = 100 공격 기회당 득점 생산, DRtg = 100 수비 기회당 실점, NetRtg = ORtg − DRtg (Dean Oliver)",
    source: BREF_RATINGS,
    note: "KBL 계산값 그대로 씁니다. ORtg 는 전 시즌, DRtg·NetRtg 는 2025-26 시즌에만 제공됩니다.",
  },
  {
    key: "pace",
    name: "PACE",
    short: "경기당 공격 횟수. 높을수록 빠르게 공격하는 팀",
    formula: "PACE = 공격 횟수를 한 경기(KBL 40분) 기준으로 환산한 값",
    source: BREF_GLOSSARY,
    note: "KBL 계산값 그대로 씁니다(NBA 는 48분 기준). 2025-26 시즌에만 제공됩니다.",
  },
  {
    key: "per40",
    name: "40분당 환산",
    short: "40분을 다 뛰었다면 몇 개였을지. 출전 시간이 다른 선수끼리 비교할 때 쓴다",
    formula: "40분당 값 = 시즌 누적 ÷ 누적 출전시간(분) × 40",
    source: BREF_PER36,
    note: "우리 계산입니다(lib/metrics.ts per40). NBA 의 36분당 환산을 KBL 경기 시간(40분)에 맞췄습니다. 출전이 아주 적으면 값이 튀어 표본 기준으로 거릅니다.",
  },
  {
    key: "percentileGrade",
    name: "백분위 · S~F 등급",
    short: "같은 시즌 선수 중 위치를 0~100으로 나타낸 값과 그 등급 글자(S~F)",
    formula:
      "백분위 = (나보다 낮은 선수 수 + 0.5 × 같은 값 선수 수) ÷ 비교 집단 수 × 100 · 등급 S ≥ 90, A ≥ 75, B ≥ 55, C ≥ 35, D ≥ 15, F < 15 · 종합 등급 = 레이더 5축 백분위 평균을 같은 집단 안에서 다시 매긴 백분위의 등급",
    source: WIKI_PERCENTILE_RANK,
    note:
      "우리 사이트 규칙입니다(lib/metrics.ts percentileRank·GRADE_CUTS). 등급의 비교 집단은 같은 시즌·표본 기준을 넘긴 같은 국적 집단(국내 / 외국 / 아시아쿼터) 선수입니다. 외국 선수가 공격 기록을 독점해 리그 전체로 매기면 국내 선수는 잘해야 A~B였기 때문입니다. 아시아쿼터가 8명 미만인 시즌은 외국 선수와 합쳐 계산합니다(아시아쿼터·외국 합산). 순위(n위)는 따로 리그 전체(또는 같은 포지션) 기준입니다.",
  },
  {
    key: "radarAxes",
    name: "레이더 5축 (공격·수비·3점·허슬·효율)",
    short: "축마다 관련 기록 여러 개의 백분위를 평균해, 선수가 어느 쪽에 강한지 한눈에 보여 준다",
    formula:
      "공격 = 40분당 득점·40분당 어시스트·USG%·2점 성공률 · 수비 = 40분당 스틸·블록·수비 리바운드·굿디펜스·파울(적을수록 좋음) · 3점 = 40분당 3점 성공·3점 성공률·40분당 3점 시도 · 허슬 = 40분당 공격 리바운드·스틸·디플렉션·스크린 어시스트·경기당 +/- · 효율 = TS%·eFG%·TOV%(적을수록 좋음)·AST/TO·PER · 축 점수 = 구성 요소 백분위의 단순 평균(가중치 모두 같음)을 같은 국적 집단 안에서 다시 백분위로",
    source: null,
    note:
      "우리 사이트 규칙입니다(lib/metrics.ts RADAR_AXIS_COMPONENTS). 그 시즌에 기록이 없는 항목(예: 2024-25 이전의 USG%·디플렉션·스크린 어시스트, 2000-01 이전의 굿디펜스)은 빼고 남은 항목으로 평균합니다. 2점·3점 성공률은 경기당 시도가 리그 평균 이상인 선수만 넣습니다. 평균한 값을 다시 백분위로 바꾸는 이유는, 백분위 여러 개를 평균하면 값이 50 근처로 모여 S(상위 10%) 같은 등급이 제 뜻을 잃기 때문입니다.",
  },
  {
    key: "qualify",
    name: "표본 기준",
    short: "몇 경기·몇 분 이상 뛴 선수만 순위·등급에 넣는가",
    formula: "기본 10경기 이상 AND 누적 100분 이상 (선택: 20경기·300분, 30경기·500분, 5경기·50분)",
    source: null,
    note: "우리 사이트 규칙입니다(lib/metrics.ts QUALIFY_PRESETS). 기준 미달 선수도 값은 보여 주지만 순위는 '표본 미달'로 표시합니다.",
  },
  {
    key: "attempts",
    name: "성공률 시도 기준",
    short: "1개 던져 1개 넣은 100%가 1위가 되지 않게, 충분히 던진 선수만 성공률 순위에 넣는다",
    formula: "기준 = 그 시즌 표본 기준 충족 선수의 경기당 시도 수 평균 (야투·3점·자유투 각각) · 경기당 시도 ≥ 기준이면 순위 대상",
    source: null,
    note: "우리 사이트 규칙이며 KBL 공식 규정이 아닙니다(lib/metrics.ts attemptThresholds). 참고로 NBA 는 시즌 성공 수(야투 300·3점 82·자유투 125개)로 자격을 정합니다.",
  },
];

const BY_KEY = new Map(GLOSSARY.map((e) => [e.key, e]));

/** 키로 용어 한 개 찾기 (없으면 undefined) */
export function glossaryEntry(key: GlossaryKey): GlossaryEntry | undefined {
  return BY_KEY.get(key);
}

// ─────────────────────────────────────────────
// 용어 탭(/glossary) 앵커 — 카드 등급 영역·순위표 열 머리글의 ⓘ 아이콘이 여기로 연결한다
// ─────────────────────────────────────────────

/** 용어 → 주소 앵커 (짧은 영문, 예: /glossary#ts). 한 번 공유된 주소가 깨지지 않게 바꾸지 않는다 */
export const GLOSSARY_ANCHORS: Record<GlossaryKey, string> = {
  per: "per",
  tsPct: "ts",
  efgPct: "efg",
  usgPct: "usg",
  astPct: "ast",
  rebPct: "reb",
  tovPct: "tov",
  astTo: "ast-to",
  ratings: "rtg",
  pace: "pace",
  per40: "per40",
  percentileGrade: "grade",
  radarAxes: "radar",
  qualify: "qualify",
  attempts: "attempts",
};

/** 용어 탭 링크, 예: glossaryHref("tsPct") → "/glossary#ts" */
export function glossaryHref(key: GlossaryKey): string {
  return `/glossary#${GLOSSARY_ANCHORS[key]}`;
}

/**
 * 순위표 열(lib/leaders LeaderStatKey) → 풀이할 용어. 없는 열(득점 등 누구나 아는 기록)은 ⓘ 를 달지 않는다.
 * 성공률 열은 "시도 기준"(1개 던져 100% 가 1위가 되지 않게 하는 규칙)을 풀이한다.
 * 키를 문자열로 받는 이유: leaders.ts ↔ glossary.ts 순환 import 를 피하려고.
 */
export const LEADER_COLUMN_GLOSSARY: Readonly<Record<string, GlossaryKey>> = {
  tsPct: "tsPct",
  usgPct: "usgPct",
  per: "per",
  fgPct: "attempts",
  tpPct: "attempts",
  ftPct: "attempts",
};

/** 레이더 축(lib/metrics RadarAxis) → 용어. 5축 모두 "레이더 5축" 한 항목에서 구성 요소를 풀이한다 */
export const RADAR_AXIS_GLOSSARY: Readonly<Record<string, GlossaryKey>> = {
  offense: "radarAxes",
  defense: "radarAxes",
  three: "radarAxes",
  hustle: "radarAxes",
  efficiency: "radarAxes",
};
