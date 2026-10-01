// 용어 설명 데이터 — 화면의 "이 지표가 뭐예요?" 풀이가 읽는다. 계산은 하지 않는다(계산은 lib/metrics.ts).
// 공식은 Basketball-Reference 용어집 표기를 따르고, KBL 값과 우리 데이터로 맞춰 본 결과를 note 에 적는다.
// (검산: 2026-09-30, 2025-26 정규시즌 processed 데이터. 예: 워니 TS 49.8 = 1158 / (2 × (1091 + 0.44 × 161)))

const BREF_GLOSSARY = "https://www.basketball-reference.com/about/glossary.html";
const BREF_PER = "https://www.basketball-reference.com/about/per.html";
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
  | "records"
  | "winPct"
  | "prime";

/** 용어 화면의 묶음 (순서 = 화면 순서) */
export type GlossaryGroup = "stats" | "grades" | "shots" | "etc";

export const GLOSSARY_GROUPS: readonly { key: GlossaryGroup; title: string }[] = [
  { key: "stats", title: "기록 지표" },
  { key: "grades", title: "등급과 라벨" },
  { key: "shots", title: "슛 차트" },
  { key: "etc", title: "그 밖에" },
];

// 글쓰기 규칙 (2026-10-01 사용자 피드백 "길고 지루하다"): short 는 한 문장, note 는 두 문장까지, 코드 파일 이름은 쓰지 않는다.
// 계산식(formula)은 화면에 작게만 보인다. 자세한 근거·검산 숫자는 lib/metrics.ts 주석에 둔다.
export interface GlossaryEntry {
  key: GlossaryKey;
  group: GlossaryGroup;
  /** 지표 이름 (화면 표기) */
  name: string;
  /** 누구나 알아듣는 한 문장 */
  short: string;
  /** 알아 두면 좋은 점 (두 문장까지). 없으면 생략 */
  note?: string;
  /** 계산식 한 줄 — 작게 표시. 없으면 생략 */
  formula?: string;
  /** 도움말 팝오버용 더 짧은 계산식 (formula 가 길 때만) */
  brief?: string;
  /** 출처 URL. 이 사이트 규칙이면 null */
  source: string | null;
}

/** 2025-26 은 KBL 값, 그 전 시즌은 같은 표준식으로 우리가 계산 (lib/metrics computeTeamShareStats) */
const SHARE_NOTE = "2025-26은 KBL 값이고, 그 전 시즌은 같은 공식으로 이 사이트가 계산했습니다.";

/** 배열 순서 = 묶음 안 표시 순서 */
export const GLOSSARY: readonly GlossaryEntry[] = [
  {
    key: "per",
    group: "stats",
    name: "PER",
    short: "코트에서 얼마나 쓸모 있었는지를 숫자 하나로 나타낸 값입니다. 리그 평균이 15쯤입니다.",
    note: "KBL이 계산한 값을 그대로 씁니다. 계산식은 공개되어 있지 않습니다.",
    formula: "좋은 기록에서 놓친 슛·턴오버·파울을 빼고, 출전 시간과 리그 평균으로 맞춘 값",
    source: BREF_PER,
  },
  {
    key: "tsPct",
    group: "stats",
    name: "TS%",
    short: "2점·3점·자유투를 모두 넣어서 본 슛 성공률입니다.",
    note: "야투율보다 공정합니다. 3점과 자유투를 잘 넣는 선수가 제대로 평가받습니다.",
    formula: "득점 ÷ (2 × (야투 시도 + 0.44 × 자유투 시도))",
    source: BREF_GLOSSARY,
  },
  {
    key: "efgPct",
    group: "stats",
    name: "eFG%",
    short: "3점슛 하나를 2점슛 1.5개로 쳐 준 야투율입니다.",
    formula: "(야투 성공 + 0.5 × 3점 성공) ÷ 야투 시도",
    source: BREF_GLOSSARY,
  },
  {
    key: "usgPct",
    group: "stats",
    name: "USG%",
    short: "코트에 있을 때 팀 공격의 몇 %를 직접 끝냈는지 보여 줍니다.",
    note: `높다고 잘한다는 뜻은 아니고, 공을 많이 맡았다는 뜻입니다. ${SHARE_NOTE}`,
    formula: "(야투 시도 + 0.44 × 자유투 시도 + 턴오버) ÷ 내가 뛴 동안 팀 공격 수",
    source: BREF_GLOSSARY,
  },
  {
    key: "astPct",
    group: "stats",
    name: "AST%",
    short: "코트에 있을 때 동료가 넣은 슛 중 몇 %를 어시스트했는지 보여 줍니다.",
    note: SHARE_NOTE,
    formula: "어시스트 ÷ 내가 뛴 동안 동료의 야투 성공",
    source: BREF_GLOSSARY,
  },
  {
    key: "rebPct",
    group: "stats",
    name: "REB%",
    short: "코트에 있을 때 나온 리바운드 중 몇 %를 잡았는지 보여 줍니다.",
    note: `${SHARE_NOTE} 옛 시즌은 상대 리바운드를 리그 평균으로 어림해서 실제와 조금 다를 수 있습니다.`,
    formula: "잡은 리바운드 ÷ 내가 뛴 동안 나온 리바운드",
    source: BREF_GLOSSARY,
  },
  {
    key: "tovPct",
    group: "stats",
    name: "TOV%",
    short: "공격 100번 중 턴오버로 끝난 횟수입니다. 낮을수록 좋습니다.",
    formula: "턴오버 ÷ (야투 시도 + 0.44 × 자유투 시도 + 턴오버)",
    source: BREF_GLOSSARY,
  },
  {
    key: "astTo",
    group: "stats",
    name: "AST/TO",
    short: "턴오버 1개당 어시스트 수입니다. 높을수록 공을 안정적으로 다룹니다.",
    formula: "어시스트 ÷ 턴오버",
    source: BREF_GLOSSARY,
  },
  {
    key: "per30",
    group: "stats",
    name: "30분당",
    short: "30분을 뛰었다면 몇 개였을지 계산한 값입니다. 출전 시간이 다른 선수를 비교할 때 씁니다.",
    note: "NBA는 12분짜리 쿼터 3개를 기준으로 36분당을 씁니다. KBL은 쿼터가 10분이라 30분으로 맞췄습니다.",
    formula: "시즌 합계 ÷ 출전 시간(분) × 30",
    source: BREF_PER36,
  },
  {
    key: "percentileGrade",
    group: "grades",
    name: "백분위와 등급",
    short: "같은 시즌 선수 중 나보다 아래에 있는 선수의 비율입니다. 90이면 상위 10%입니다.",
    note: "등급 옆 숫자는 백분위를 1~99점으로 나타낸 점수입니다. 국내·외국인 선수를 따로 비교하고, 종합 S는 상위 5%만 받습니다.",
    formula: "레이더 축: S 90 이상 · A 75 · B 55 · C 35 · D 15 / 종합: S 상위 5% · A 20% · B 45% · C 70% · D 90%",
    source: WIKI_PERCENTILE_RANK,
  },
  {
    key: "prime",
    group: "grades",
    name: "프라임 시즌",
    short: "그 선수가 가장 잘했던 시즌입니다. 시즌 칩에 금색으로 표시합니다.",
    note: "종합 점수가 가장 높았던 시즌을 고릅니다. 같은 시즌 선수와 비교한 값이라 시대가 달라도 견줄 수 있습니다.",
    formula: "10경기·100분 이상 뛴 시즌이 2개 이상인 선수만",
    source: null,
  },
  {
    key: "radarAxes",
    group: "grades",
    name: "레이더 6축",
    short: "공격·수비·리바운드·슈팅·리딩·효율을 각각 같은 시즌 선수와 비교한 점수입니다.",
    note: "종합 등급은 포지션에 맞춰 축의 비중을 바꿉니다. 가드는 리딩을, 빅맨은 리바운드를 더 크게 봅니다.",
    formula:
      "공격: 득점·야투·자유투 시도·USG% / 수비: 스틸·블록·굿디펜스·디플렉션 / 리바운드: 공격·수비 리바운드·REB% / 슈팅: 3점·미드레인지·자유투 / 리딩: 어시스트·AST/TO·TOV%·AST% / 효율: PER·TS%·eFG%",
    brief: "축마다 관련 기록 몇 개를 같은 시즌 선수와 비교해 평균 낸 점수",
    source: null,
  },
  {
    key: "playerTypes",
    group: "grades",
    name: "선수 유형 라벨",
    short: "카드 위쪽에 붙는 한 줄 라벨입니다. 레이더에서 가장 강한 축과 포지션으로 정합니다.",
    note: "전체 목록은 아래 표에 있습니다.",
    formula: "6축이 모두 60 이상이면 올라운더, 아니면 가장 높은 축의 유형",
    source: null,
  },
  {
    key: "badges",
    group: "grades",
    name: "칭호 배지",
    short: "선수 이름 아래 붙는 칭호입니다. 기록으로 셀 수 있는 것만 붙입니다.",
    note: "조건은 아래 표에 있습니다.",
    source: null,
  },
  {
    key: "similar",
    group: "grades",
    name: "비슷한 시즌",
    short: "레이더 모양이 가장 닮은 다른 선수의 시즌입니다.",
    note: "기록 크기가 아니라 그 시즌 리그 안에서의 위치를 비교해서, 시대가 달라도 역할이 비슷한 선수가 나옵니다.",
    formula: "6축 점수가 가까울수록 100에 가까움 · 같은 국적, 같은 포지션끼리만",
    source: "https://www.basketball-reference.com/about/similar.html",
  },
  {
    key: "qualify",
    group: "grades",
    name: "표본 기준",
    short: "너무 적게 뛴 선수가 순위를 흐리지 않게, 일정 이상 뛴 선수만 순위와 등급에 넣습니다.",
    note: "기준에 못 미친 선수도 기록은 보이고, 순위 자리에 '표본 미달'이 뜹니다.",
    formula: "기본 10경기, 100분 이상",
    source: null,
  },
  {
    key: "attempts",
    group: "grades",
    name: "성공률 시도 기준",
    short: "1개 던져 1개 넣은 100%가 1위가 되지 않도록, 충분히 던진 선수만 성공률 순위에 넣습니다.",
    note: "KBL 공식 규정이 아니라 이 사이트 기준입니다.",
    formula: "경기당 시도가 그 시즌 리그 평균 이상",
    source: null,
  },
  {
    key: "shotZones",
    group: "shots",
    name: "슛 구역",
    short: "슛 차트의 점을 골밑·페인트·미드레인지·코너 3점·아크 3점으로 나눈 것입니다.",
    note: "공홈 슛 차트 좌표로 직접 나눠서 공식 3점 기록과 2% 정도 다를 수 있습니다. 2006-07 시즌부터 있습니다.",
    formula: "골밑: 바스켓 1.5m 안 · 페인트: 5.8 × 4.9m 안 · 코너 3점: 베이스라인에서 3m 안",
    source: null,
  },
  {
    key: "offenseTypes",
    group: "shots",
    name: "주 공격 유형",
    short: "어느 구역에서 슛을 많이 던졌는지로 붙이는 라벨입니다.",
    note: "잘 넣었는지가 아니라 어디서 던졌는지만 봅니다. 슛이 50개보다 적으면 붙이지 않습니다.",
    formula: "골밑+페인트 55% 이상이면 골밑 공격형 · 3점 50% 이상이면 3점 슈터형 (그중 코너가 30% 이상이면 코너 슈터형)",
    source: null,
  },
  {
    key: "gameHigh",
    group: "etc",
    name: "한 경기 최다",
    short: "한 경기에서 낸 가장 높은 기록입니다. 시즌 하이는 그 시즌, 커리어 하이는 통산입니다.",
    note: "KBL 공식 기록입니다. 성공률은 1개만 던져도 100%가 되어서 빼고, 3점·자유투 성공 옆에 그 경기 성공/시도를 작게 붙입니다.",
    source: null,
  },
  {
    key: "hustle",
    group: "etc",
    name: "디플렉션 · 스크린 어시스트",
    short: "디플렉션은 상대 패스나 드리블을 손으로 쳐 낸 횟수, 스크린 어시스트는 내 스크린 덕에 동료가 넣은 횟수입니다.",
    note: "KBL이 2025-26 시즌부터 기록해서 그 전 시즌에는 없습니다.",
    source: null,
  },
  {
    key: "winPct",
    group: "etc",
    name: "승률",
    short: "그 선수가 뛴 경기에서 팀이 이긴 비율입니다. 결장한 경기는 빼고 셉니다.",
    note: "팀 성적이 섞인 기록이라 개인 실력만 보여 주지는 않습니다.",
    formula: "승 ÷ (승 + 패)",
    source: null,
  },
  {
    key: "records",
    group: "etc",
    name: "역대 통산 순위",
    short: "1997 시즌부터 정규시즌 기록을 선수별로 모두 더한 순위입니다. 비교 탭의 '통산' 칩도 같은 합계입니다.",
    note: "시즌 기록을 더한 값이라 KBL 공식 통산 기록과 조금 다를 수 있습니다. 경기당 순위는 200경기 이상 뛴 선수만 넣습니다.",
    source: null,
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
  winPct: "win-pct",
  prime: "prime",
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
  return { title: e.name, short: e.short, formula: e.brief ?? e.formula ?? null, href: glossaryHref(key) };
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
  winPct: "winPct",
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
    short: "패스로 동료를 살리는 빅맨, 하이포스트에서 공을 뿌린다",
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
  { key: "efficient", label: "효율형", condition: "가장 높은 축이 효율", short: "적게 던져도 잘 넣는다 (PER·TS%·eFG%)", axis: "efficiency" },
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
    short: "슛 대부분을 페인트 안에서 던진다 (포스트업·돌파·풋백)",
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
