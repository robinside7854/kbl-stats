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
  | "attempts"
  | "gameHigh"
  | "playerTypes"
  | "badges";

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
    note: "우리 계산입니다(lib/metrics.ts per40). 레이더 등급에는 쓰지 않고 경기당 기록을 씁니다. NBA 의 36분당 환산을 KBL 경기 시간(40분)에 맞췄습니다. 출전이 아주 적으면 값이 튀어 표본 기준으로 거릅니다.",
  },
  {
    key: "percentileGrade",
    name: "백분위 · S~F 등급",
    short: "같은 시즌 선수 중 위치를 0~100으로 나타낸 값과 그 등급 글자(S~F)",
    formula:
      "백분위 = (나보다 낮은 선수 수 + 0.5 × 같은 값 선수 수) ÷ 비교 집단 수 × 100 · 등급 S ≥ 90, A ≥ 75, B ≥ 55, C ≥ 35, D ≥ 15, F < 15 · 종합 등급 = 레이더 5축 백분위의 단순 평균에 종합 전용 컷(S ≥ 85, A ≥ 70, B ≥ 55, C ≥ 40, D ≥ 25)을 그대로 댄 등급",
    source: WIKI_PERCENTILE_RANK,
    note:
      "우리 사이트 규칙입니다(lib/metrics.ts percentileRank·GRADE_CUTS·OVERALL_GRADE_CUTS). 등급의 비교 집단은 같은 시즌·표본 기준을 넘긴 같은 국적 집단(국내 / 외국 / 아시아쿼터) 선수입니다. 외국 선수가 공격 기록을 독점해 리그 전체로 매기면 국내 선수는 잘해야 A~B였기 때문입니다. 아시아쿼터가 8명 미만인 시즌은 외국 선수와 합쳐 계산합니다(아시아쿼터·외국 합산). 순위(n위)는 따로 리그 전체(또는 같은 포지션) 기준입니다.",
  },
  {
    key: "radarAxes",
    name: "레이더 5축 (공격·수비·3점·허슬·효율)",
    short: "축마다 관련 기록 여러 개의 백분위를 평균해, 선수가 어느 쪽에 강한지 한눈에 보여 준다",
    formula:
      "공격 = 경기당 득점·경기당 어시스트·USG%·2점 성공률 · 수비 = 경기당 스틸·블록·수비 리바운드·굿디펜스·파울(적을수록 좋음) · 3점 = 경기당 3점 성공·3점 성공률·경기당 3점 시도 · 허슬 = 경기당 공격 리바운드·스틸·디플렉션·스크린 어시스트·경기당 +/- · 효율 = TS%·eFG%·TOV%(적을수록 좋음)·AST/TO·PER · 축 점수 = 구성 요소 백분위의 단순 평균(가중치 모두 같음)을 같은 국적 집단 안에서 다시 백분위로 · 축 등급 컷 S ≥ 90, A ≥ 75, B ≥ 55, C ≥ 35, D ≥ 15 · 종합 점수 = 5축 백분위의 단순 평균(다시 순위 매기지 않음) → 종합 등급 컷 S ≥ 85, A ≥ 70, B ≥ 55, C ≥ 40, D ≥ 25",
    source: null,
    note:
      "우리 사이트 규칙입니다(lib/metrics.ts RADAR_AXIS_COMPONENTS). 득점·리바운드 같은 누적 기록은 40분 환산이 아니라 경기당 실제 기록으로 비교합니다. 40분 환산은 적게 뛴 선수의 값을 부풀려, 벤치 선수가 주전보다 높은 등급을 받는 일이 생겼기 때문입니다. 그 시즌에 기록이 없는 항목(예: 2024-25 이전의 USG%·디플렉션·스크린 어시스트, 2000-01 이전의 굿디펜스)은 빼고 남은 항목으로 평균합니다. 2점·3점 성공률은 경기당 시도가 리그 평균 이상인 선수만 넣습니다. 축 점수를 다시 백분위로 바꾸는 이유는, 백분위 여러 개를 평균하면 값이 50 근처로 모여 S(상위 10%) 같은 등급이 제 뜻을 잃기 때문입니다. 종합 등급은 반대로 다시 매기지 않습니다: 5축 평균에 종합 전용 컷을 그대로 대므로 종합 S는 다섯 축 평균이 85 이상, 즉 여러 축이 동시에 높은 선수만 받습니다. 종합 컷이 축 컷(90/75/55/35/15)보다 낮은 이유는, 다섯 축이 모두 높기는 어려워 평균이 축 점수보다 가운데로 모이기 때문입니다(축 컷 그대로면 2025-26 종합 S가 0명). 한 축만 뛰어난 선수는 그 축이 S여도 종합은 A~B에 머뭅니다.",
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
  {
    key: "gameHigh",
    name: "한 경기 최다",
    short: "한 경기에서 낸 가장 높은 기록. 시즌 하이는 그 시즌, 커리어 하이는 통산",
    formula: "부문별 한 경기 기록의 최댓값. 횟수 = 그 최고 기록을 낸 경기 수 (예: 40득점 2회 = 40점 경기가 두 번)",
    source: null,
    note:
      "KBL 공식 홈페이지 선수 상세의 '한경기최다' 기록을 그대로 씁니다(기록업체 Sports2i 제공). 화면에는 득점·리바운드·어시스트·스틸·블록·3점슛 성공·자유투 성공 7개만 보여 줍니다. 성공률 부문은 시도 수 조건이 없어 1개 던져 1개 넣은 경기도 100%가 되므로 싣지 않고, 대신 3점슛·자유투 성공 옆에 그 경기의 성공/시도와 성공률을 작게 붙입니다(예: 8/12 · 66.7% — 같은 날 경기별 기록에서 찾은 값, 못 찾으면 개수만). 순위표에서 같은 기록이면 먼저 낸 선수를 보여 줍니다.",
  },
  {
    key: "playerTypes",
    name: "선수 유형 라벨",
    short: "플레이어 카드 위쪽의 한 줄 라벨. 레이더 5축 중 어느 쪽이 가장 강한지로 붙인다",
    formula: "위에서부터 먼저 맞는 규칙: 5축 모두 60 이상 → 올라운더 · 가장 높은 축이 40 미만 → 궂은일 담당 롤 플레이어 · 그 외 → 가장 높은 축의 유형 (동점이면 공격 → 수비 → 3점 → 허슬 → 효율 순)",
    source: null,
    note: "우리 사이트 규칙입니다(lib/metrics.ts playerType, 라벨 목록은 lib/glossary.ts PLAYER_TYPES). 축 값은 같은 국적 집단 안 백분위라, 같은 선수라도 국적 집단이 바뀌면 라벨이 바뀔 수 있습니다. 아래 '선수 유형 라벨' 표에 전체 목록이 있습니다.",
  },
  {
    key: "badges",
    name: "칭호 배지",
    short: "선수 페이지 이름 아래 붙는 칭호. 기록에서 바로 셀 수 있는 것만 쓴다",
    formula: "뛴 시즌 수·소속 팀 코드 수·시즌 부문 1위 횟수·전 경기 출전 시즌 수·커리어 하이 득점·트리플더블·시즌 더블더블로 계산 (조건은 아래 '칭호 배지' 표)",
    source: null,
    note: "우리 사이트 규칙입니다(lib/badges.ts playerBadges). 추정·주관 판단은 넣지 않습니다. 정규시즌 기록만 셉니다. 팀은 팀 코드 기준이라 이름만 바뀐 구단(KT&G → 정관장)은 같은 팀입니다. 이름 아래에는 우선순위 순서로 5개까지 보이고 나머지는 +n 으로 접습니다.",
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
  gameHigh: "game-high",
  playerTypes: "types",
  badges: "badges",
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

// ─────────────────────────────────────────────
// 선수 유형 라벨 — 라벨 문자열은 여기 한 곳에만 둔다. lib/metrics playerType 이 이 표에서 라벨을 읽는다.
// 규칙(문턱값)도 여기 상수로 두어 용어 탭 설명과 계산이 어긋나지 않게 한다.
// ─────────────────────────────────────────────

/** 올라운더 문턱: 5축 백분위가 모두 이 값 이상 */
export const TYPE_ALLROUNDER_MIN = 60;
/** 롤 플레이어 문턱: 가장 높은 축 백분위가 이 값 미만 */
export const TYPE_ROLE_MAX = 40;

export type PlayerTypeKey = "allRounder" | "role" | "scorer" | "defender" | "shooter" | "hustler" | "efficient" | "unknown";

export interface PlayerTypeDef {
  key: PlayerTypeKey;
  /** 카드에 쓰는 라벨 */
  label: string;
  /** 붙는 조건 (사람이 읽는 문장) */
  condition: string;
  /** 팬 눈높이 한 줄 설명 */
  short: string;
  /** 근거 축 (lib/metrics RadarAxis 문자열). 올라운더·롤 플레이어·분석 불가는 null */
  axis: "offense" | "defense" | "three" | "hustle" | "efficiency" | null;
}

/** 배열 순서 = 판정 순서이자 용어 탭 표 순서 */
export const PLAYER_TYPES: readonly PlayerTypeDef[] = [
  {
    key: "allRounder",
    label: "올라운더",
    condition: `5축(공격·수비·3점·허슬·효율)이 모두 ${TYPE_ALLROUNDER_MIN} 이상`,
    short: "약점 없이 고르게 상위권",
    axis: null,
  },
  {
    key: "role",
    label: "궂은일 담당 롤 플레이어",
    condition: `가장 높은 축이 ${TYPE_ROLE_MAX} 미만`,
    short: "눈에 띄는 축은 없지만 코트에서 제 몫을 하는 선수",
    axis: null,
  },
  { key: "scorer", label: "득점원", condition: "가장 높은 축이 공격", short: "득점·어시스트·공격 점유율로 공격을 이끈다", axis: "offense" },
  { key: "defender", label: "수비수", condition: "가장 높은 축이 수비", short: "스틸·블록·수비 리바운드·굿디펜스가 강점", axis: "defense" },
  { key: "shooter", label: "슈터", condition: "가장 높은 축이 3점", short: "3점을 많이, 잘 넣는다", axis: "three" },
  { key: "hustler", label: "허슬 플레이어", condition: "가장 높은 축이 허슬", short: "공격 리바운드·스틸·+/- 같은 궂은 기록이 강점", axis: "hustle" },
  { key: "efficient", label: "효율형", condition: "가장 높은 축이 효율", short: "적게 던져도 잘 넣고 공을 잃지 않는다", axis: "efficiency" },
  {
    key: "unknown",
    label: "분석 불가",
    condition: "5축 값이 모두 없음",
    short: "그 시즌 비교할 기록이 없다",
    axis: null,
  },
];

const TYPE_BY_KEY = new Map(PLAYER_TYPES.map((t) => [t.key, t]));

/** 유형 키 → 정의 */
export function playerTypeDef(key: PlayerTypeKey): PlayerTypeDef {
  return TYPE_BY_KEY.get(key)!;
}

/** 유형 라벨 한 줄의 용어 탭 앵커, 예: /glossary#type-scorer */
export function playerTypeHref(key: PlayerTypeKey): string {
  return `/glossary#type-${key}`;
}

/** 칭호 배지 한 줄의 용어 탭 앵커, 예: /glossary#badge-oneClub */
export function badgeHref(key: string): string {
  return `/glossary#badge-${key}`;
}
