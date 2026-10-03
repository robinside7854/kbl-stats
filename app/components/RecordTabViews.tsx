"use client";
// 역대 기록 하위 탭 세 개의 설정 (부문·목록 키·안내 문구) — 화면 틀은 RecordBoardView. 서버 페이지는 데이터만 넘긴다.
import { highDef, SEASON_HIGH_LEADER_KEYS } from "@/lib/highs";
import { POSTSEASON_MIN_GAMES, REGULAR_MIN_GAMES_SHARE, SEASON_BEST_STATS, type RecordListsData } from "@/lib/records";
import RecordBoardView from "./RecordBoardView";

/** 한 경기 최다 부문 이름 (lib/highs 이름에서 "슛" 을 빼 칩을 짧게) */
const GAME_CATEGORIES = SEASON_HIGH_LEADER_KEYS.map((k) => ({ value: k, label: highDef(k).label.replace("슛 ", " ") }));

export function GameHighsView({ data }: { data: RecordListsData }) {
  return (
    <RecordBoardView
      screen="records_game"
      data={data}
      categories={GAME_CATEGORIES}
      kinds
      listKey={(kind, cat) => `${kind}:${cat}`}
      note={() =>
        "선수마다 가장 좋은 기록 하나만 셉니다(같은 선수의 두 번째 기록은 순위에 없음). 같은 기록을 여러 번 냈으면 횟수를 함께, 날짜는 KBL 이 알려 준 그 기록의 경기. 정규시즌은 달력 버튼으로 그날 경기로 갑니다."
      }
    />
  );
}

export function SeasonBestsView({ data, hasPostseason }: { data: RecordListsData; hasPostseason: boolean }) {
  return (
    <RecordBoardView
      screen="records_season"
      data={data}
      categories={SEASON_BEST_STATS.map((d) => ({ value: d.key, label: d.label, perGame: d.perGame }))}
      kinds
      modes
      listKey={(kind, cat, mode) => `${kind}:${cat}:${mode}`}
      emptyText={(kind) =>
        kind !== "regular" && !hasPostseason ? "플레이오프·챔프전 시즌 기록은 오늘 밤 수집부터 채워집니다." : "기록이 없습니다."
      }
      note={(kind, mode) =>
        mode === "perGame"
          ? kind === "regular"
            ? `경기당은 그 시즌 최다 출전 경기의 ${Math.round(REGULAR_MIN_GAMES_SHARE * 100)}% 이상 뛴 선수만, 진행 중 시즌은 빼고 셉니다.`
            : `경기당은 ${POSTSEASON_MIN_GAMES[kind]}경기 이상 뛴 선수만 셉니다.`
          : kind === "playoff"
            ? "플레이오프는 6강부터 챔프전까지 합친 기록입니다."
            : "한 선수가 여러 시즌으로 여러 번 나올 수 있습니다."
      }
    />
  );
}

export function AwardRecordsView({ data, categories }: { data: RecordListsData; categories: { value: string; label: string }[] }) {
  return (
    <RecordBoardView
      screen="records_awards"
      data={data}
      categories={categories}
      listKey={(_k, cat) => cat}
      note={() => "KBL 역대수상현황 기준. 우승은 그 시즌 정규리그 소속 팀이 챔프전에서 이긴 시즌입니다(시즌 중 이적·출전 여부는 보지 않음)."}
    />
  );
}
