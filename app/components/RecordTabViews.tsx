"use client";
// 역대 기록 하위 탭 세 개의 설정 (부문·목록 키·안내 문구) — 화면 틀은 RecordBoardView. 서버 페이지는 데이터만 넘긴다.
import { highDef, SEASON_HIGH_LEADER_KEYS } from "@/lib/highs";
import { gameHighListKey, POSTSEASON_MIN_GAMES, REGULAR_MIN_GAMES_SHARE, SEASON_BEST_STATS, seasonBestListKey, type RecordListsData } from "@/lib/records";
import { useCallback, useMemo, useState } from "react";
import { CLUTCH_RECORD_DEFS, clutchFgMinAttempts } from "@/lib/clutch";
import { clutchListKey, type GameKind } from "@/lib/records";
import RecentWinningShots, { type WinningShotRow } from "./RecentWinningShots";
import RecordBoardView from "./RecordBoardView";
import { PROFILE_RANK_DEFS, profileListKey, profileRankNote, type ProfileRankKey } from "@/lib/profile-ranks";

/** 한 경기 최다 부문 이름 (lib/highs 이름에서 "슛" 을 빼 칩을 짧게) */
const GAME_CATEGORIES = SEASON_HIGH_LEADER_KEYS.map((k) => ({ value: k, label: highDef(k).label.replace("슛 ", " ") }));

export function GameHighsView({ data }: { data: RecordListsData }) {
  return (
    <RecordBoardView
      screen="records_game"
      data={data}
      categories={GAME_CATEGORIES}
      kinds
      remote="game"
      listKey={(kind, cat) => gameHighListKey(kind, cat)}
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
      remote="season"
      listKey={(kind, cat, mode) => seasonBestListKey(kind, cat, mode)}
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

/** 클러치 탭 (2026-10-28): 구분(정규·플옵·챔프전) × 기간(통산·시즌) — 위닝샷·버저비터·클러치 득점(득점순·야투율순) 순위 + 아래 위닝샷 목록 */
export function ClutchRecordsView({
  data,
  seasons,
  shots,
}: {
  data: RecordListsData;
  seasons: { seasonCode: number; seasonShort: string }[];
  /** 처음 보이는 위닝샷 목록 (정규시즌 통산) — 다른 구분·기간은 RecentWinningShots 가 받아 온다 */
  shots: WinningShotRow[];
}) {
  const [sel, setSel] = useState<{ kind: GameKind; scope: string }>({ kind: "regular", scope: "all" });
  const scopes = useMemo(() => [{ value: "all", label: "통산" }, ...seasons.map((s) => ({ value: String(s.seasonCode), label: `${s.seasonShort} 시즌` }))], [seasons]);
  const onSelect = useCallback((kind: GameKind, scope: string) => setSel({ kind, scope }), []);
  return (
    <>
      <RecordBoardView
        screen="records_clutch"
        data={data}
        categories={CLUTCH_RECORD_DEFS.map((d) => ({ value: d.key, label: d.label, sorts: d.sorts?.map((x) => ({ value: x.key, label: x.label })) }))}
        kinds
        scopes={scopes}
        remote="clutch"
        onSelect={onSelect}
        listKey={(kind, cat, _mode, scope) => clutchListKey(kind, scope === "all" ? "all" : Number(scope), cat)}
        note={(kind, _mode, scope, cat) =>
          `${kind === "regular" ? "정규시즌" : kind === "playoff" ? "플레이오프(6강~챔프전)" : "챔프전"} 4쿼터·연장 남은 2분 미만, 6점 차 이내 기록입니다. 공홈 문자중계가 있는 2006-07 시즌부터 셉니다.${
            cat === "fgPct" ? ` 야투율순은 클러치 야투를 ${clutchFgMinAttempts(kind, scope === "all" ? "career" : "season")}개 이상 던진 선수만.` : ""
          }`
        }
        emptyText={() => "이 기간에는 기록이 없어요."}
      />
      <RecentWinningShots
        key={`${sel.kind}:${sel.scope}`}
        listKey={clutchListKey(sel.kind, sel.scope === "all" ? "all" : Number(sel.scope), "shots")}
        initial={sel.kind === "regular" && sel.scope === "all" ? shots : null}
        title={sel.scope === "all" ? "최근 위닝샷" : `${scopes.find((s) => s.value === sel.scope)?.label ?? ""} 위닝샷`}
      />
    </>
  );
}

/** 프로필 탭 (2026-10-30): 기간(시즌·역대 전체) × 부문(키·몸무게·체격·나이·뛴 시즌·거친 구단 + 키 대비 기록). 처음 기간 = 최신 시즌 */
export function ProfileRecordsView({ data, seasons }: { data: RecordListsData; seasons: { seasonCode: number; seasonShort: string }[] }) {
  const scopes = useMemo(() => [{ value: "all", label: "역대 전체" }, ...seasons.map((s) => ({ value: String(s.seasonCode), label: `${s.seasonShort} 시즌` }))], [seasons]);
  return (
    <RecordBoardView
      screen="records_profile"
      data={data}
      categories={PROFILE_RANK_DEFS.map((d) => ({ value: d.key, label: d.label }))}
      scopes={scopes}
      defaultScope={seasons[0] ? String(seasons[0].seasonCode) : "all"}
      remote="profile"
      listKey={(_kind, cat, _mode, scope) => profileListKey(scope === "all" ? "all" : Number(scope), cat)}
      note={(_kind, _mode, scope, cat) => profileRankNote(cat as ProfileRankKey, scope === "all" ? "all" : "season")}
      emptyText={() => "이 기간에는 해당하는 선수가 없어요."}
    />
  );
}
