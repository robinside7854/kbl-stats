"use client";
// 시즌 페이지의 상호작용 부분: 표본 기준, 팀 필터, 선수·비교 선수 선택 → 플레이어 카드(1~2장) + 이미지 저장
// (시즌 선택은 상단 SiteNav 가 맡는다 — 주소의 ?p=&vs=&team= 은 SiteNav 가 시즌을 바꿀 때 그대로 넘긴다)
// 카드 크기: 화면 폭 ≥ 768px 이면 lg(약 500px), 비교 두 장은 ≥ 1024px 에서만 lg(나란히 놓을 자리가 있을 때).
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CardPlayer, CardTeam, SeasonCoverage } from "@/lib/types";
import {
  attemptsNote,
  axisSetFor,
  buildCardContext,
  buildCardEntry,
  isQualified,
  pickDefaultPlayer,
  QUALIFY_PRESETS,
  qualifyLabel as presetLabel,
  qualifyShort as presetShort,
} from "@/lib/metrics";
import PlayerPicker from "./PlayerPicker";
import PlayerCard, { type CardEntry, type CardSize } from "./PlayerCard";
import TeamLogo from "./TeamLogo";
import { useCardSave } from "./useCardSave";
import { useMedia } from "./useMedia";
import { useThemeColors } from "./useThemeColors";

interface Props {
  seasonLabel: string;
  players: CardPlayer[];
  teams: CardTeam[];
  coverage: SeasonCoverage;
}

export default function CardExplorer({ seasonLabel, players, teams, coverage }: Props) {
  const colors = useThemeColors();
  const [presetIdx, setPresetIdx] = useState(0);
  const rule = QUALIFY_PRESETS[presetIdx];
  const teamByCode = useMemo(() => new Map(teams.map((t) => [t.teamCode, t])), [teams]);
  const teamOf = useCallback((p: CardPlayer) => teamByCode.get(p.teamCode), [teamByCode]);

  // 축 세트는 시즌 코드가 아니라 커버리지 플래그로 고른다 (2차 스탯 없는 시즌 → 고전 축)
  const axisSet = axisSetFor(coverage);
  const qualifiedFn = useCallback((p: CardPlayer) => isQualified(p, rule), [rule]);
  // 백분위 집단·성공률 시도 기준(표본 충족 선수의 경기당 시도 리그 평균, 순위표와 같은 함수)·순위 집단 — 선수 페이지와 같은 함수
  const ctx = useMemo(() => buildCardContext(players, rule, axisSet), [players, rule, axisSet]);
  const { thresholds, qualifiedCount } = ctx;

  // 팀 필터 (null = 전체). 선수 선택 목록을 그 팀으로 좁힌다
  const [teamCode, setTeamCode] = useState<string | null>(null);
  const teamPlayers = useMemo(
    () => (teamCode ? players.filter((p) => p.teamCode === teamCode) : players),
    [players, teamCode],
  );

  // 기본 선수: 표본 충족 선수 중 종합 기여도 축(PER) 1위
  const defaultId = useMemo(() => pickDefaultPlayer(players, axisSet) ?? players[0]?.id ?? "", [players, axisSet]);

  const exists = (id: string | null) => !!id && players.some((p) => p.id === id);
  const [aId, setAId] = useState<string>(defaultId);
  const [bId, setBId] = useState<string | null>(null);

  // 공유 링크(?p=선수&vs=비교선수&team=팀)로 들어온 경우 반영.
  // useSearchParams 대신 window.location을 읽는다 → 정적 HTML에 카드가 그대로 렌더링됨 (클라이언트 전용 렌더링 회피)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const p = searchParams.get("p");
    const vs = searchParams.get("vs");
    const team = searchParams.get("team");
    const validTeam = team && teams.some((t) => t.teamCode === team) ? team : null;
    if (validTeam) setTeamCode(validTeam);
    if (exists(p)) setAId(p!);
    else if (validTeam) setAId(pickDefaultPlayer(players.filter((x) => x.teamCode === validTeam), axisSet) ?? defaultId);
    if (exists(vs) && vs !== p) setBId(vs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 선택 상태를 주소에 남겨 공유·새로고침 시 유지 (재렌더링 없이)
  useEffect(() => {
    const qs = new URLSearchParams({ p: aId });
    if (bId) qs.set("vs", bId);
    if (teamCode) qs.set("team", teamCode);
    window.history.replaceState(null, "", `${window.location.pathname}?${qs}`);
  }, [aId, bId, teamCode]);

  // 팀을 고르면: 지금 선수가 그 팀이 아니면 그 팀의 기본 선수(종합 기여도 1위)로 바꾼다
  function chooseTeam(code: string | null) {
    setTeamCode(code);
    if (!code) return;
    const cur = players.find((p) => p.id === aId);
    if (cur?.teamCode !== code) {
      const next = pickDefaultPlayer(players.filter((p) => p.teamCode === code), axisSet);
      if (next) setAId(next);
    }
  }
  const selectedTeam = teamCode ? teamByCode.get(teamCode) : undefined;

  const toEntry = useCallback(
    (id: string | null): CardEntry | null => {
      const p = players.find((x) => x.id === id);
      return p ? buildCardEntry(p, ctx) : null;
    },
    [players, ctx],
  );

  const a = toEntry(aId);
  const b = bId && bId !== aId ? toEntry(bId) : null;
  const cards = [a && { entry: a, series: colors.series1 }, b && { entry: b, series: colors.series2 }].filter(
    (x): x is { entry: CardEntry; series: string } => !!x,
  );

  // ── 이미지 저장 (화면 밖 공식 이미지 없는 사본 → PNG, useCardSave) ──
  const { exportRef, saving, saveError, save: saveCard } = useCardSave(colors.surface);
  const save = () =>
    saveCard(`${a!.player.nameKo}${b ? `_vs_${b.player.nameKo}` : ""}_${seasonLabel}_플레이어카드.png`);

  const isMd = useMedia("(min-width: 768px)");
  const isLg = useMedia("(min-width: 1024px)");
  const size: CardSize = isMd && (!b || isLg) ? "lg" : "sm";
  const attemptsLabel = attemptsNote(thresholds);
  const cardProps = { seasonLabel, axisSet, ruleLabel: presetLabel(rule), qualifiedCount, colors, attemptsLabel };
  // 카드 한 장일 때 가운데 폭 (sm 420px, lg 500px)
  const single = size === "lg" ? "mx-auto max-w-[500px]" : "mx-auto max-w-[420px]";

  return (
    <main className="mx-auto max-w-5xl px-4 pt-5">
      <header className="mb-4">
        <p className="text-xs font-medium text-ink-3">{seasonLabel} KBL 정규시즌</p>
        <h1 className="mt-0.5 text-xl font-bold tracking-tight">플레이어 카드</h1>
        <p className="mt-1 text-sm text-ink-2">
          경기당 기록 9개와 시즌 순위를 한 장에. 1~3위는 메달, 4~10위는 팀 색으로 표시합니다.
        </p>
      </header>

      <section aria-label="보기 설정" className="grid grid-cols-2 gap-2 sm:max-w-md">
        <label className="flex min-w-0 flex-col text-xs font-medium text-ink-2">
          <span className="mb-1">팀</span>
          <span className="relative flex items-center">
            {selectedTeam && (
              <span className="pointer-events-none absolute left-2">
                <TeamLogo logoUrl={selectedTeam.logoUrl} shortName={selectedTeam.shortName} color={selectedTeam.color} size={22} />
              </span>
            )}
            <select
              className={`h-11 w-full min-w-0 rounded-lg border border-line bg-surface pr-2 text-base text-ink ${
                selectedTeam ? "pl-9" : "pl-2"
              }`}
              value={teamCode ?? ""}
              onChange={(e) => chooseTeam(e.target.value || null)}
            >
              <option value="">전체 팀</option>
              {teams.map((t) => (
                <option key={t.teamCode} value={t.teamCode}>
                  {t.shortName}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="flex min-w-0 flex-col text-xs font-medium text-ink-2">
          <span className="mb-1">순위·등급 비교 기준</span>
          <select
            className="h-11 w-full min-w-0 rounded-lg border border-line bg-surface px-2 text-base text-ink"
            value={presetIdx}
            onChange={(e) => setPresetIdx(Number(e.target.value))}
          >
            {QUALIFY_PRESETS.map((r, i) => (
              <option key={i} value={i}>
                {presetShort(r)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section aria-label="선수 선택" className="mt-3 grid gap-3 sm:grid-cols-2">
        <PlayerPicker
          label={selectedTeam ? `선수 (${selectedTeam.shortName})` : "선수"}
          players={teamPlayers}
          value={aId}
          onChange={(id) => id && setAId(id)}
          isQualified={qualifiedFn}
          teamOf={teamOf}
          swatchColor={b ? colors.series1 : undefined}
        />
        <PlayerPicker
          label="비교 선수 (선택)"
          players={teamPlayers.filter((p) => p.id !== aId)}
          value={bId}
          onChange={setBId}
          isQualified={qualifiedFn}
          teamOf={teamOf}
          clearable
          placeholder="나란히 볼 선수 검색"
          swatchColor={colors.series2}
        />
      </section>

      <p className="mt-2 text-xs text-ink-3">
        비교 집단: {presetLabel(rule)} 출전한 {qualifiedCount}명 (팀을 골라도 순위·등급은 리그 전체 기준)
      </p>

      {a && (
        <>
          {/* 비교 선수가 있으면 카드 두 장을 나란히(모바일은 위아래로) */}
          <div className={`mt-4 grid gap-4 ${b ? "md:grid-cols-2" : single}`}>
            {cards.map((c) => (
              <PlayerCard
                key={c.entry.player.id}
                entry={c.entry}
                team={teamOf(c.entry.player)}
                seriesColor={c.series}
                size={size}
                {...cardProps}
              />
            ))}
          </div>

          <div className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 ${b ? "" : single}`}>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "저장 중…" : "이미지 저장"}
            </button>
            <p className="text-xs text-ink-3">저장 이미지에는 사진·로고가 들어가지 않습니다 (팀 색·이니셜로 대신 그림)</p>
            {saveError && (
              <p role="alert" className="w-full text-sm text-ink-2">
                {saveError}
              </p>
            )}
          </div>

          <p className={`mt-4 text-xs leading-relaxed text-ink-3 ${b ? "" : single}`}>
            카드 아래 레이더는 원래 값이 아니라 시즌 내 백분위(0~100)이고, 꼭짓점 글자는 그 백분위의 등급입니다 — S 상위
            10%, A 상위 25%, B 상위 45%, C 상위 65%, D 상위 85%, F 그 아래. 종합 등급은 5개 축 백분위 평균의 등급입니다.
            성공률 순위는 경기당 시도가 리그 평균({attemptsLabel}) 이상인 선수만 매깁니다.{" "}
            {axisSet === "classic"
              ? "이 시즌은 KBL이 USG%·AST%·REB%를 제공하지 않아 40분당 환산(누적 ÷ 출전시간 × 40)과 TS%·PER로 그렸습니다(고전 축). 2차 스탯이 있는 시즌의 카드와는 축이 달라 직접 비교할 수 없습니다."
              : "2차 스탯은 KBL 계산값 그대로입니다(USG%만 표준 척도로 ×5 — KBL 원값이 표준식의 1/5로 확인됨)."}
          </p>

          {/* 저장할 때만 화면 밖에 그리는 사본 (공식 이미지 없음) */}
          {saving && (
            <div aria-hidden className="pointer-events-none fixed top-0" style={{ left: -10000 }}>
              <div ref={exportRef} className="flex items-start gap-3 bg-surface p-3">
                {cards.map((c) => (
                  <PlayerCard
                    key={c.entry.player.id}
                    entry={c.entry}
                    team={teamOf(c.entry.player)}
                    seriesColor={c.series}
                    exportMode
                    size="lg"
                    {...cardProps}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
