// 비교 탭용 시즌별 카드 데이터 파일(public/cards/{seasonCode}.json)의 형식 — 순수 함수만.
// 만들기(encodeSeasonCards)는 prebuild 스크립트(scripts/build-search-index.ts)가, 풀기(decodeSeasonCards)는 화면이 쓴다.
// 크기를 줄이려고 선수 목록을 "열 이름 한 줄 + 선수별 값 배열"(열 형식)로 저장한다 — 키 이름이 선수마다 반복되지 않는다.
// 비교 재료(국적 집단 백분위·순위 집단)는 파일에 넣지 않는다: 화면이 lib/cardview seasonContext
// (→ lib/metrics buildGradingContext·buildCardContext)로 다시 만든다(선수 200명 규모라 즉시 계산).
// 파일의 defaults 는 기본 표본 기준으로 미리 계산한 참고값이다.

import {
  attemptThresholds,
  DEFAULT_QUALIFY,
  isQualified,
  pickDefaultPlayer,
  type AttemptThresholds,
  type QualifyRule,
} from "./metrics";
import type { CardPlayer, CardTeam, SeasonCoverage } from "./types";

/** 파일 형식 버전 — 필드 구성이 호환되지 않게 바뀌면 올린다 (2: 레이더 5축 구성 요소 열 추가·axisSet 삭제) */
export const CARDS_FILE_VERSION = 2;

/** 열 순서 (CardPlayer 의 모든 필드). 파일에도 fields 로 같이 저장하므로 순서가 바뀌어도 옛 파일을 읽을 수 있다 */
export const CARD_FIELDS = [
  "id", "nameKo", "nameEn", "teamName", "teamShort", "teamCode", "isForeign",
  "position", "positionGroup", "nationality", "photoUrl",
  "games", "minutes", "points", "reb", "ast", "stl", "blk", "tov", "fouls",
  "fga", "tpa", "fta", "fgPct", "tpPct", "ftPct",
  "twoPa", "twoPPct", "tpm", "oreb", "dreb", "goodDef", "deflections", "screenAst", "plusMinus",
  "per", "usgPct", "tsPct", "efgPct", "tovPct", "astTo",
] as const satisfies readonly (keyof CardPlayer)[];

type CardCell = string | number | boolean | null;

export interface SeasonCardsDefaults {
  /** 기본 표본 기준 (DEFAULT_QUALIFY) */
  rule: QualifyRule;
  /** 그 기준의 성공률 시도 기준 (attemptThresholds) — 포지션·국적으로 집단을 좁혀도 이 값을 쓰면 리그 기준 유지 */
  thresholds: AttemptThresholds;
  /** 기준 충족 선수 수 */
  qualifiedCount: number;
  /** 첫 화면 기본 선수 (pickDefaultPlayer: 기준 충족 선수 중 PER 1위). 선수 0명이면 null */
  defaultPlayerId: string | null;
}

/** public/cards/{seasonCode}.json 내용 */
export interface SeasonCardsFile {
  v: typeof CARDS_FILE_VERSION;
  seasonCode: number;
  seasonLabel: string;
  /** 항목별 커버리지 — 레이더 구성 요소(USG%·굿디펜스·허슬·+/-)와 USG% 열을 켜고 끈다 */
  coverage: SeasonCoverage;
  /** 팀 로고·색·한글 약칭 */
  teams: CardTeam[];
  defaults: SeasonCardsDefaults;
  /** rows 의 열 이름 (CARD_FIELDS) */
  fields: string[];
  /** 선수별 값 배열 (fields 순서) */
  rows: CardCell[][];
}

/** 풀어낸 시즌 카드 데이터 */
export interface SeasonCards extends Omit<SeasonCardsFile, "fields" | "rows"> {
  players: CardPlayer[];
}

/**
 * 비율·지수(소수) 값은 소수 넷째 자리까지만 저장한다 — 크기 절약. 순위·백분위는 같은 값끼리 비교하므로
 * 서로 다른 선수가 반올림으로 같아질 가능성은 매우 작다(서버 쪽 카드 계산은 원래 정밀도).
 */
const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

export function encodeSeasonCards(
  meta: { seasonCode: number; seasonLabel: string; coverage: SeasonCoverage; teams: CardTeam[] },
  players: readonly CardPlayer[],
): SeasonCardsFile {
  const rule = DEFAULT_QUALIFY;
  return {
    v: CARDS_FILE_VERSION,
    seasonCode: meta.seasonCode,
    seasonLabel: meta.seasonLabel,
    coverage: meta.coverage,
    teams: meta.teams,
    defaults: {
      rule,
      thresholds: attemptThresholds(players, rule),
      qualifiedCount: players.filter((p) => isQualified(p, rule)).length,
      defaultPlayerId: pickDefaultPlayer(players),
    },
    fields: [...CARD_FIELDS],
    rows: players.map((p) =>
      CARD_FIELDS.map((f) => {
        const v = p[f] as CardCell;
        return typeof v === "number" && !Number.isInteger(v) ? round4(v) : v;
      }),
    ),
  };
}

/** 파일 → 선수 객체 목록. 파일에 없는 열은 null(문자열·숫자 열이면 ""·0)로 채운다. 버전이 다르면 에러 */
export function decodeSeasonCards(file: SeasonCardsFile): SeasonCards {
  if (file.v !== CARDS_FILE_VERSION) throw new Error(`카드 파일 버전 ${file.v} ≠ ${CARDS_FILE_VERSION}`);
  const idx = new Map(file.fields.map((f, i) => [f, i]));
  const NULLABLE = new Set<string>(["position", "positionGroup", "nationality", "photoUrl"]);
  const STRING = new Set<string>(["id", "nameKo", "nameEn", "teamName", "teamShort", "teamCode"]);
  const players = file.rows.map((row) => {
    const o: Record<string, CardCell> = {};
    for (const f of CARD_FIELDS) {
      const i = idx.get(f);
      const v = i === undefined ? undefined : row[i];
      if (v !== undefined) o[f] = v;
      else o[f] = NULLABLE.has(f) ? null : STRING.has(f) ? "" : f === "isForeign" ? false : 0;
    }
    return o as unknown as CardPlayer;
  });
  const { fields: _f, rows: _r, ...meta } = file;
  return { ...meta, players };
}
