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
  | "per30"
  | "percentileGrade"
  | "radarAxes"
  | "qualify"
  | "attempts"
  | "gameHigh"
  | "playerTypes"
  | "badges"
  | "shotZones"
  | "offenseTypes"
  | "similar"
  | "hustle"
  | "records";

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
  /** 도움말 팝오버용 계산식 한 줄 (formula 가 길 때만). 없으면 formula 를 그대로 쓴다 */
  brief?: string;
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
    brief: "(야투 시도 + 0.44 × 자유투 시도 + 턴오버) ÷ 코트에 있는 동안 팀 공격 수 × 100",
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
    brief: "잡은 리바운드 ÷ 코트에 있는 동안 나온 전체 리바운드 × 100",
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
    key: "per30",
    name: "30분당 환산",
    short: "30분(3쿼터)을 뛰었다면 몇 개였을지. 출전 시간이 다른 선수끼리 비교할 때 쓴다",
    formula: "30분당 값 = 시즌 누적 ÷ 누적 출전시간(분) × 30",
    source: BREF_PER36,
    note: "우리 계산입니다(lib/metrics.ts per30). NBA 의 36분당은 12분 쿼터 3개를 뛴 주전을 가정한 값이라, KBL 의 10분 쿼터에 맞춰 3쿼터 = 30분으로 환산합니다. 레이더 등급에는 쓰지 않고 경기당 기록을 씁니다. 출전이 아주 적으면 값이 튀어 표본 기준으로 거릅니다.",
  },
  {
    key: "percentileGrade",
    name: "백분위 · S~F 등급",
    short: "같은 시즌 선수 중 위치를 0~100으로 나타낸 값과 그 등급 글자(S~F). 종합은 6축 가중 평균의 같은 풀 안 순위",
    formula:
      "백분위 = (나보다 낮은 선수 수 + 0.5 × 같은 값 선수 수) ÷ 비교 집단 수 × 100 · 등급 S ≥ 90, A ≥ 75, B ≥ 55, C ≥ 35, D ≥ 15, F < 15 · 종합 등급 = 레이더 6축 백분위의 포지션별 가중 평균(가드: 리딩 ×1.5·리바운드 ×0.5 / 포워드: 전부 1 / 빅맨: 리바운드 ×1.5·슈팅 ×0.5·리딩 ×0.5)을 같은 풀 안에서 다시 백분위로 바꾼 등급 — S 상위 5%, A 상위 20%, B 상위 45%, C 상위 70%, D 상위 90%, F 하위 10%",
    source: WIKI_PERCENTILE_RANK,
    brief: "백분위 = 나보다 낮은 선수 비율 · 축 S ≥ 90 · A ≥ 75 · B ≥ 55 · C ≥ 35 · D ≥ 15 · 종합 = 6축 가중 평균의 풀 안 순위, S 상위 5%",
    note:
      "우리 사이트 규칙입니다(lib/metrics.ts percentileRank, GRADE_CUTS, OVERALL_GRADE_CUTS, axisWeights). 종합 등급을 낼 때는 포지션(선수 마스터 코드)에 따라 축 비중을 바꿉니다 — 가드(가드·가드-포워드)는 리딩 1.5배·리바운드 0.5배, 빅맨(센터·포워드-센터)은 리바운드 1.5배·슈팅과 리딩 0.5배, 포워드는 그대로. 역할상 낮기 쉬운 축(빅맨의 3점, 가드의 리바운드)이 종합 등급을 깎지 않게 하려는 것입니다. 레이더의 축 값과 축 등급은 가중치 없이 그대로 보입니다. 등급의 비교 집단은 같은 시즌·표본 기준을 넘긴 같은 풀의 선수 — 국내 선수 / 외국인 선수(외국 + 아시아쿼터) 두 풀입니다. 외국 선수가 공격 기록을 독점해 리그 전체로 매기면 국내 선수는 잘해야 A~B였기 때문이고, 아시아쿼터는 인원이 적어 외국인 풀에 넣습니다. 순위(n위)는 따로 리그 전체(또는 같은 포지션) 기준입니다.",
  },
  {
    key: "radarAxes",
    name: "레이더 6축 (공격·수비·리바운드·슈팅·리딩·효율)",
    short: "축마다 관련 기록 여러 개의 백분위를 평균해, 선수가 어느 쪽에 강한지 한눈에 보여 준다",
    formula:
      "공격 = 경기당 득점·야투 성공·야투 시도·자유투 시도·USG% · 수비 = 경기당 스틸·블록·굿디펜스·디플렉션 · 리바운드 = 경기당 공격 리바운드·수비 리바운드·REB% · 슈팅 = 경기당 3점 성공·3점 시도·3점 성공률·경기당 미드레인지 시도·미드레인지 성공률·자유투 성공률 · 리딩 = 경기당 어시스트·AST/TO·TOV%(적을수록 좋음)·AST% · 효율 = PER·TS%·eFG% · 축 점수 = 구성 요소 백분위의 단순 평균(가중치 모두 같음)을 같은 국적 집단 안에서 다시 백분위로 · 축 등급 컷 S ≥ 90, A ≥ 75, B ≥ 55, C ≥ 35, D ≥ 15 · 종합 점수 = 6축 백분위의 포지션별 가중 평균(가드: 리딩 ×1.5·리바운드 ×0.5, 포워드: 전부 1, 빅맨(센터·포워드-센터): 리바운드 ×1.5·슈팅 ×0.5·리딩 ×0.5) → 같은 국적 풀 안에서 다시 백분위 → 종합 등급 S 상위 5%, A 20%, B 45%, C 70%, D 90%",
    source: null,
    brief: "축 = 관련 경기당 기록·비율 백분위 평균 → 같은 국적 집단 안에서 다시 백분위 · 종합 = 6축 가중 평균의 풀 안 순위 (S 상위 5%, 가드는 리딩 ×1.5·리바운드 ×0.5, 빅맨은 리바운드 ×1.5·슈팅·리딩 ×0.5)",
    note:
      "우리 사이트 규칙입니다(lib/metrics.ts RADAR_AXIS_COMPONENTS). 득점·리바운드 같은 누적 기록은 40분 환산이 아니라 경기당 실제 기록으로 비교합니다. 40분 환산은 적게 뛴 선수의 값을 부풀려, 벤치 선수가 주전보다 높은 등급을 받는 일이 생겼기 때문입니다. 그 시즌에 기록이 없는 항목(예: 2024-25 이전의 USG%·REB%·AST%·디플렉션, 2000-01 이전의 굿디펜스, 2005-06 이전의 미드레인지)은 빼고 남은 항목으로 평균합니다. 3점·미드레인지·자유투 성공률은 경기당 시도가 리그 평균 이상인 선수만 넣습니다. 미드레인지는 KBL 공홈 슛 차트 좌표로 우리가 나눈 구역(페인트 밖·3점 라인 안)이라 공식 기록이 아닙니다. 박스아웃은 KBL 이 기록하지 않아 리바운드 축에 넣지 못했습니다. 축 점수를 다시 백분위로 바꾸는 이유는, 백분위 여러 개를 평균하면 값이 50 근처로 모여 S(상위 10%) 같은 등급이 제 뜻을 잃기 때문입니다. 종합 등급도 같은 방식으로 다시 백분위로 바꿉니다: 6축 가중 평균을 같은 풀 선수들의 가중 평균과 비교해 순위를 매기고, 상위 5%만 S 를 줍니다(축 등급 S 는 상위 10%). 그래서 매 시즌 종합 S 는 국내 5~6명, 외국인 1~2명 정도입니다. 평균 자체가 여러 축이 함께 높아야 올라가므로 S 는 한 축만 뛰어난 선수보다 고르게 잘하는 선수에게 갑니다. 포지션 가중치는 역할상 낮기 쉬운 축(빅맨의 슈팅·리딩, 가드의 리바운드)이 종합을 끌어내리지 않게 하되 0으로 빼지는 않습니다 — 그 축이 뛰어나면 여전히 보탬이 되고, 그런 선수에게는 '플레이메이킹 빅맨' 같은 세분 유형 라벨이 붙습니다.",
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
    short: "플레이어 카드 위쪽의 한 줄 라벨. 레이더 6축 중 어느 쪽이 가장 강한지와 포지션으로 붙인다",
    formula: "위에서부터 먼저 맞는 규칙: 6축 모두 60 이상 → 올라운더 · 가장 높은 축이 40 미만 → 궂은일 담당 롤 플레이어 · 가장 높은 축이 포지션상 낮기 쉬운 축이면 세분 유형: 빅맨의 리딩 ≥ 70 → 플레이메이킹 빅맨 · 빅맨의 슈팅 ≥ 70 → 스트레치 빅맨 · 가드·포워드의 수비 ≥ 80 (슈팅 < 55, 공격 < 70) → 락다운 디펜더 · 가드의 리바운드 ≥ 70 → 리바운딩 가드 · 그 외 → 가장 높은 축의 유형 (동점이면 공격 → 수비 → 리바운드 → 슈팅 → 리딩 → 효율 순)",
    source: null,
    brief: "6축 모두 60 이상이면 올라운더 · 포지션상 낮기 쉬운 축이 높으면 세분 유형(플레이메이킹 빅맨 등) · 그 외는 가장 높은 축의 유형",
    note: "우리 사이트 규칙입니다(lib/metrics.ts playerType, 라벨 목록은 lib/glossary.ts PLAYER_TYPES). 축 값은 같은 풀(국내 / 외국인) 안 백분위라, 같은 선수라도 풀이 바뀌면 라벨이 바뀔 수 있습니다. 포지션 세분 유형은 선수 마스터의 포지션 코드가 있을 때만 붙습니다. 아래 '선수 유형 라벨' 표에 전체 목록이 있습니다.",
  },
  {
    key: "badges",
    name: "칭호 배지",
    short: "선수 페이지 이름 아래 붙는 칭호. 기록에서 바로 셀 수 있는 것만 쓴다",
    formula: "뛴 시즌 수·소속 팀 코드 수·시즌 부문 1위 횟수·전 경기 출전 시즌 수·커리어 하이 득점·트리플더블·시즌 더블더블로 계산 (조건은 아래 '칭호 배지' 표)",
    source: null,
    brief: "시즌 수·팀 수·부문 1위·커리어 하이·트리플더블 등 기록에서 센다",
    note: "우리 사이트 규칙입니다(lib/badges.ts playerBadges). 추정·주관 판단은 넣지 않습니다. 정규시즌 기록만 셉니다. 팀은 팀 코드 기준이라 이름만 바뀐 구단(KT&G → 정관장)은 같은 팀입니다. 이름 아래에는 우선순위 순서로 5개까지 보이고 나머지는 +n 으로 접습니다.",
  },
  {
    key: "shotZones",
    name: "슛 구역",
    short: "슛 차트 점을 5구역으로 나눠 센다. 좌표로 계산한 값이라 공식 3점 기록과 조금 다를 수 있고, 성공률이 리그 평균보다 높으면 굵게 표시한다",
    formula:
      "골밑 = 바스켓 중심 1.5m 안 · 페인트 = 베이스라인에서 5.8m, 좌우 2.45m 안(골밑 제외) · 미드레인지 = 나머지 2점 · 코너 3점 = 3점이고 베이스라인에서 3.0m 안 · 아크 3점 = 나머지 3점 · 3점 판정 = 바스켓에서 좌우 6.5m 이상(코너 직선) 또는 약 6.75m 호 바깥",
    source: null,
    brief: "골밑 1.5m · 페인트(5.8 × 4.9m) · 미드레인지 · 코너 3점(베이스라인 3m 안) · 아크 3점",
    note:
      "우리 계산입니다(lib/shots.ts). KBL 공식 홈페이지 경기 슛 차트의 점 좌표(코트 그림 픽셀, 약 24.9px = 1m)를 FIBA 코트 규격에 맞춰 미터로 바꿔 나눕니다. 2025-26 시즌으로 맞춰 보니 점 개수는 공식 야투 시도와 98%, 성공 점은 공식 야투 성공과 99.7% 일치했지만, 3점 라인 근처 슛은 좌표로 가른 3점 시도가 공식 3점 시도보다 약 2.4% 많았습니다(라인 위 2점을 3점으로 세는 쪽). 그래서 구역별 숫자는 공식 3점 기록과 조금 다를 수 있습니다. 리그 평균은 그 시즌 전 선수 슛을 합쳐 낸 성공률입니다. 정규시즌 경기만 셉니다.",
  },
  {
    key: "offenseTypes",
    name: "주 공격 유형",
    short: "슛을 어느 구역에서 많이 던졌는지로 붙이는 라벨 (골밑 공격형·3점 슈터형·코너 슈터형 등)",
    formula: "시즌 슛 50개 이상일 때, 위에서부터 먼저 맞는 규칙: 골밑+페인트 비중 ≥ 55% → 골밑 공격형 · 3점 비중 ≥ 50% 이고 3점 시도 중 코너 비중 ≥ 30% → 코너 슈터형 · 3점 비중 ≥ 50% → 3점 슈터형 · 미드레인지 ≥ 30% → 미드레인지형 · 3점 ≥ 35% 이고 골밑+페인트 ≥ 35% → 인사이드-아웃형 · 그 외 → 균형형",
    source: null,
    brief: "슛 50개 이상 · 골밑+페인트 ≥ 55% 골밑형 · 3점 ≥ 50% 슈터형(3점 중 코너 ≥ 30% 면 코너 슈터형) · 미드 ≥ 30% 미드레인지형",
    note: "우리 사이트 규칙입니다(lib/shots.ts offenseType, 문턱은 lib/glossary.ts OFFENSE_TYPES). 성공률이 아니라 시도 비중만 봅니다 — 잘 넣는지는 구역표의 성공률·리그 평균으로 봅니다. 슛이 50개 미만이면 붙이지 않습니다. 아래 '주 공격 유형' 표에 전체 목록이 있습니다.",
  },
  {
    key: "similar",
    name: "비슷한 시즌",
    short: "레이더 6축 모양이 가장 가까운 다른 선수의 시즌. 시대가 달라도 그 시즌에서 맡은 역할이 비슷한 선수가 나온다",
    formula: "유사도 = 100 × (1 − 6축 백분위 거리 ÷ (100 × √6)) · 같은 국적 풀(국내 / 외국인)·같은 포지션 묶음(가드·포워드·센터)끼리만 · 한 선수는 가장 비슷한 시즌 하나만",
    source: "https://www.basketball-reference.com/about/similar.html",
    brief: "6축 백분위 거리로 계산 · 같은 국적 풀·같은 포지션끼리 · 100 에 가까울수록 비슷",
    note: "우리 사이트 규칙입니다(lib/similar.ts). Basketball-Reference 의 Similarity Scores 개념을 따왔지만 계산식은 다릅니다. 축 값이 각 시즌 안 백분위라, 실제 기록 크기가 아니라 '그 시즌 리그에서의 위치'가 비슷한 선수를 찾습니다. 표본 기준(10경기·100분)을 넘긴 시즌만 비교합니다.",
  },
  {
    key: "hustle",
    name: "디플렉션 · 스크린 어시스트",
    short: "디플렉션은 상대 패스·드리블을 손으로 쳐 낸 횟수, 스크린 어시스트는 내 스크린 직후 동료가 득점한 횟수",
    formula: "KBL 기록값 그대로 (경기당 = 시즌 합계 ÷ 경기 수)",
    source: null,
    note: "KBL 이 2025-26 시즌부터 기록합니다. 그 이전 시즌 순위표에는 이 부문이 나오지 않습니다.",
  },
  {
    key: "records",
    name: "역대 통산 순위",
    short: "1997 시즌부터 지금까지 정규시즌 기록을 선수별로 모두 더한 순위",
    formula: "통산 합계 = 시즌 합계의 합 · 통산 경기당 = 통산 합계 ÷ 통산 경기 (경기당 순위는 통산 200경기 이상만)",
    source: null,
    note: "우리 계산입니다(lib/records.ts). KBL 공식 홈페이지 시즌 기록을 더한 값이라 KBL 이 발표하는 통산 기록과 다를 수 있습니다(예: 기록 정정). 정규시즌만 셉니다.",
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
  per30: "per30",
  percentileGrade: "grade",
  radarAxes: "radar",
  qualify: "qualify",
  attempts: "attempts",
  gameHigh: "game-high",
  playerTypes: "types",
  badges: "badges",
  shotZones: "shot-zones",
  offenseTypes: "offense-types",
  similar: "similar",
  hustle: "hustle",
  records: "records",
};

/** 도움말 팝오버 한 개의 내용 (app/components/HelpPopover — 그 자리에서 뜨는 ⓘ 설명) */
export interface HelpContent {
  /** 제목 (지표 이름) */
  title: string;
  /** 한 줄 설명 */
  short: string;
  /** 계산식 한 줄 (없으면 null) */
  formula: string | null;
  /** "자세히" 링크 (용어 페이지 앵커) */
  href: string;
}

/** 용어 → 팝오버 내용. 계산식은 brief(짧은 한 줄)가 있으면 그것, 없으면 formula */
export function helpContent(key: GlossaryKey): HelpContent {
  const e = BY_KEY.get(key);
  if (!e) return { title: "용어", short: "", formula: null, href: glossaryHref(key) };
  return { title: e.name, short: e.short, formula: e.brief ?? e.formula, href: glossaryHref(key) };
}

/** 선수 유형 라벨 → 팝오버 내용 (조건 한 줄 + 용어 페이지 유형 표) */
export function playerTypeHelp(key: PlayerTypeKey): HelpContent {
  const d = playerTypeDef(key);
  return { title: `선수 유형: ${d.label}`, short: d.short, formula: d.condition, href: playerTypeHref(key) };
}

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
  defl: "hustle",
  screen: "hustle",
  rimPct: "shotZones",
  midPct: "shotZones",
  corner3Pct: "shotZones",
  arc3Pct: "shotZones",
};

/** 레이더 축(lib/metrics RadarAxis) → 용어. 6축 모두 "레이더 6축" 한 항목에서 구성 요소를 풀이한다 */
export const RADAR_AXIS_GLOSSARY: Readonly<Record<string, GlossaryKey>> = {
  offense: "radarAxes",
  defense: "radarAxes",
  rebound: "radarAxes",
  shooting: "radarAxes",
  playmaking: "radarAxes",
  efficiency: "radarAxes",
};

// ─────────────────────────────────────────────
// 선수 유형 라벨 — 라벨 문자열은 여기 한 곳에만 둔다. lib/metrics playerType 이 이 표에서 라벨을 읽는다.
// 규칙(문턱값)도 여기 상수로 두어 용어 탭 설명과 계산이 어긋나지 않게 한다.
// ─────────────────────────────────────────────

/** 올라운더 문턱: 6축(가중치 0 인 축 제외) 백분위가 모두 이 값 이상 */
export const TYPE_ALLROUNDER_MIN = 60;
/** 롤 플레이어 문턱: 가장 높은 축 백분위가 이 값 미만 */
export const TYPE_ROLE_MAX = 40;
/** 포지션 세분 유형 문턱: 빅맨의 리딩·슈팅, 가드의 리바운드가 가장 높은 축이고 백분위가 이 값 이상 (역할상 낮기 쉬운 축에서 상위 30%) */
export const TYPE_SPECIAL_MIN = 70;
/** 락다운 디펜더: 수비가 가장 높은 축이고 이 값 이상 … */
export const TYPE_LOCKDOWN_DEF_MIN = 80;
/** … 이고 슈팅 축 이 값 미만, 공격 축 아래 값 미만 (슛·득점은 평범하거나 약한데 수비로 가치를 내는 외곽 선수) */
export const TYPE_LOCKDOWN_SHOT_MAX = 55;
export const TYPE_LOCKDOWN_OFF_MAX = 70;

export type PlayerTypeKey =
  | "allRounder"
  | "playmakingBig"
  | "stretchBig"
  | "lockdown"
  | "reboundingGuard"
  | "role"
  | "scorer"
  | "defender"
  | "rebounder"
  | "shooter"
  | "playmaker"
  | "efficient"
  | "unknown";

export interface PlayerTypeDef {
  key: PlayerTypeKey;
  /** 카드에 쓰는 라벨 */
  label: string;
  /** 붙는 조건 (사람이 읽는 문장) */
  condition: string;
  /** 팬 눈높이 한 줄 설명 */
  short: string;
  /** 근거 축 (lib/metrics RadarAxis 문자열). "가장 높은 축" 유형만 값이 있고, 올라운더·포지션 세분 유형·롤 플레이어·분석 불가는 null */
  axis: "offense" | "defense" | "rebound" | "shooting" | "playmaking" | "efficiency" | null;
}

/** 배열 순서 = 판정 순서이자 용어 탭 표 순서 */
export const PLAYER_TYPES: readonly PlayerTypeDef[] = [
  {
    key: "allRounder",
    label: "올라운더",
    condition: `6축(공격·수비·리바운드·슈팅·리딩·효율)이 모두 ${TYPE_ALLROUNDER_MIN} 이상`,
    short: "약점 없이 고르게 상위권",
    axis: null,
  },
  {
    key: "playmakingBig",
    label: "플레이메이킹 빅맨",
    condition: `빅맨(센터·포워드-센터)이고 가장 높은 축이 리딩, ${TYPE_SPECIAL_MIN} 이상`,
    short: "패스로 동료를 살리는 빅맨 — 하이포스트 피딩",
    axis: null,
  },
  {
    key: "stretchBig",
    label: "스트레치 빅맨",
    condition: `빅맨(센터·포워드-센터)이고 가장 높은 축이 슈팅, ${TYPE_SPECIAL_MIN} 이상`,
    short: "외곽슛으로 수비를 바깥까지 끌어내는 빅맨",
    axis: null,
  },
  {
    key: "lockdown",
    label: "락다운 디펜더",
    condition: `가드·포워드이고 가장 높은 축이 수비, ${TYPE_LOCKDOWN_DEF_MIN} 이상이면서 슈팅 ${TYPE_LOCKDOWN_SHOT_MAX} 미만·공격 ${TYPE_LOCKDOWN_OFF_MAX} 미만`,
    short: "슛은 평범해도 수비로 제 몫을 하는 외곽 수비수",
    axis: null,
  },
  {
    key: "reboundingGuard",
    label: "리바운딩 가드",
    condition: `가드(가드·가드-포워드)이고 가장 높은 축이 리바운드, ${TYPE_SPECIAL_MIN} 이상`,
    short: "가드인데 리바운드에 적극 가담한다",
    axis: null,
  },
  {
    key: "role",
    label: "궂은일 담당 롤 플레이어",
    condition: `가장 높은 축이 ${TYPE_ROLE_MAX} 미만`,
    short: "눈에 띄는 축은 없지만 코트에서 제 몫을 하는 선수",
    axis: null,
  },
  { key: "scorer", label: "득점원", condition: "가장 높은 축이 공격", short: "득점 볼륨으로 공격을 이끈다", axis: "offense" },
  { key: "defender", label: "수비수", condition: "가장 높은 축이 수비", short: "스틸·블록·굿디펜스·디플렉션이 강점", axis: "defense" },
  { key: "rebounder", label: "리바운더", condition: "가장 높은 축이 리바운드", short: "공격·수비 리바운드로 공을 지킨다", axis: "rebound" },
  { key: "shooter", label: "슈터", condition: "가장 높은 축이 슈팅", short: "3점·미드레인지를 많이, 잘 넣는다", axis: "shooting" },
  { key: "playmaker", label: "플레이메이커", condition: "가장 높은 축이 리딩", short: "어시스트로 동료를 살리고 공을 잃지 않는다", axis: "playmaking" },
  { key: "efficient", label: "효율형", condition: "가장 높은 축이 효율", short: "PER·TS%·eFG% — 적게 던져도 잘 넣는다", axis: "efficiency" },
  {
    key: "unknown",
    label: "분석 불가",
    condition: "6축 값이 모두 없음",
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

// ─────────────────────────────────────────────
// 주 공격 유형 (슛 구역 시도 비중) — 라벨·조건·문턱은 여기 한 곳. lib/shots.ts offenseType 이 이 표와 상수를 읽는다.
// 근거: 구역 시도 비중만 쓰는 단순 규칙(우리 사이트 규칙, 문턱은 2026-09-30 사용자 결정). 리그 비중(2025-26 전 선수 슛 합계)은
// 골밑 16.6% · 페인트 26.7% · 미드레인지 15.6% · 코너 3점 5.8% · 아크 3점 35.3% 라서
//   - 골밑+페인트 ≥ 55%: 리그(43%)보다 확실히 안쪽 — 빅맨·돌파형
//   - 3점 ≥ 50%: 슛 절반 이상이 3점(리그 41%) — 슈터
//   - 그 슈터 중 3점 시도의 코너 비중 ≥ 30% (리그는 3점 시도 중 코너가 약 14%, 그 두 배): 코너에서 기다렸다 쏘는 슈터 — 코너 슈터형
//     (2026-10-01 사용자 요청. 2025-26 슈터 56명 중 9명, 2024-25 58명 중 12명, 2017-18 38명 중 2명 — 옛 시즌엔 코너 3점이 드물다)
//   - 미드레인지 ≥ 30%: 리그(16%)의 두 배 가까이
//   - 3점 ≥ 35% 이고 골밑+페인트 ≥ 35%: 안팎을 다 쓰고 미드는 적은 선수
// 결과(2025-26, 슛 50개 이상 125명): 3점 슈터형 56 · 골밑 공격형 23 · 인사이드-아웃형 22 · 균형형 19 · 미드레인지형 5.
// ─────────────────────────────────────────────

/** 유형을 붙이는 최소 슛 시도 수 (그 시즌 정규시즌) */
export const OFFENSE_MIN_ATTEMPTS = 50;
/** 골밑 공격형: 골밑+페인트 시도 비중 문턱 */
export const OFFENSE_INSIDE_MIN = 0.55;
/** 3점 슈터형: 3점(코너+아크) 시도 비중 문턱 */
export const OFFENSE_SHOOTER_MIN = 0.5;
/** 코너 슈터형: 3점 슈터형 조건에 더해, 3점 시도 중 코너 3점 비중 문턱 */
export const OFFENSE_CORNER_MIN = 0.3;
/** 미드레인지형: 미드레인지 시도 비중 문턱 */
export const OFFENSE_MID_MIN = 0.3;
/** 인사이드-아웃형: 3점 비중과 골밑+페인트 비중이 둘 다 이 값 이상 */
export const OFFENSE_INSIDE_OUT_MIN = 0.35;

export type OffenseTypeKey = "inside" | "cornerShooter" | "shooter" | "midrange" | "insideOut" | "balanced";

export interface OffenseTypeDef {
  key: OffenseTypeKey;
  label: string;
  condition: string;
  short: string;
}

const pctText = (v: number) => `${Math.round(v * 100)}%`;

/** 배열 순서 = 판정 순서이자 용어 탭 표 순서 */
export const OFFENSE_TYPES: readonly OffenseTypeDef[] = [
  {
    key: "inside",
    label: "골밑 공격형",
    condition: `골밑+페인트 시도 비중 ${pctText(OFFENSE_INSIDE_MIN)} 이상`,
    short: "슛 대부분을 페인트 안에서 — 포스트업·돌파·풋백",
  },
  {
    key: "cornerShooter",
    label: "코너 슈터형",
    condition: `3점(코너+아크) 시도 비중 ${pctText(OFFENSE_SHOOTER_MIN)} 이상 그리고 3점 시도 중 코너 3점 비중 ${pctText(OFFENSE_CORNER_MIN)} 이상`,
    short: "슛 절반 이상이 3점이고, 그중 상당수를 코너에서 기다렸다 쏜다",
  },
  {
    key: "shooter",
    label: "3점 슈터형",
    condition: `3점(코너+아크) 시도 비중 ${pctText(OFFENSE_SHOOTER_MIN)} 이상 (코너 비중은 ${pctText(OFFENSE_CORNER_MIN)} 미만)`,
    short: "던지는 슛의 절반 이상이 3점, 주로 아크(정면·45도)에서",
  },
  {
    key: "midrange",
    label: "미드레인지형",
    condition: `미드레인지 시도 비중 ${pctText(OFFENSE_MID_MIN)} 이상`,
    short: "페인트 밖·3점 라인 안의 중거리 슛을 즐겨 쏜다",
  },
  {
    key: "insideOut",
    label: "인사이드-아웃형",
    condition: `3점 ${pctText(OFFENSE_INSIDE_OUT_MIN)} 이상 그리고 골밑+페인트 ${pctText(OFFENSE_INSIDE_OUT_MIN)} 이상`,
    short: "안쪽과 3점을 모두 쓰고 중거리는 적다",
  },
  {
    key: "balanced",
    label: "균형형",
    condition: "위 조건에 해당하지 않음",
    short: "구역별 시도가 고르게 퍼져 있다",
  },
];

const OFFENSE_BY_KEY = new Map(OFFENSE_TYPES.map((t) => [t.key, t]));

/** 공격 유형 키 → 정의 */
export function offenseTypeDef(key: OffenseTypeKey): OffenseTypeDef {
  return OFFENSE_BY_KEY.get(key)!;
}

/** 공격 유형 한 줄의 용어 탭 앵커, 예: /glossary#offense-inside */
export function offenseTypeHref(key: OffenseTypeKey): string {
  return `/glossary#offense-${key}`;
}

/** 공격 유형 칩 → 팝오버 내용 (조건 한 줄 + 용어 페이지 표) */
export function offenseTypeHelp(key: OffenseTypeKey): HelpContent {
  const d = offenseTypeDef(key);
  return { title: `주 공격 유형: ${d.label}`, short: d.short, formula: `${d.condition} (슛 ${OFFENSE_MIN_ATTEMPTS}개 이상)`, href: offenseTypeHref(key) };
}
