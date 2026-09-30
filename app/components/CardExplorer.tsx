"use client";
// 시즌 페이지의 상호작용 부분: 표본 기준, 선수·비교 선수 선택 → 플레이어 카드(1~2장) + 이미지 저장
// (시즌 선택은 상단 SiteNav 가 맡는다 — 주소의 ?p=&vs= 는 SiteNav 가 시즌을 바꿀 때 그대로 넘긴다)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import type { CardPlayer, CardTeam, SeasonCoverage } from "@/lib/types";
import {
  axisSetFor,
  axisValue,
  buildCardStatPools,
  buildReference,
  cardStats,
  DEFAULT_QUALIFY,
  isQualified,
  playerType,
  QUALIFY_PRESETS,
  qualifyLabel as presetLabel,
  qualifyShort as presetShort,
  RADAR_IMPACT_AXIS,
  radarPercentiles,
} from "@/lib/metrics";
import PlayerPicker from "./PlayerPicker";
import PlayerCard, { type CardEntry } from "./PlayerCard";
import { excludeOfficialImages } from "./useOfficialImage";
import { useThemeColors } from "./useThemeColors";

interface Props {
  seasonLabel: string;
  players: CardPlayer[];
  teams: CardTeam[];
  coverage: SeasonCoverage;
}

/** 다음 그림 그리기까지 기다린다 (저장용 사본이 화면 밖에 그려진 뒤 캡처하기 위해) */
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export default function CardExplorer({ seasonLabel, players, teams, coverage }: Props) {
  const colors = useThemeColors();
  const [presetIdx, setPresetIdx] = useState(0);
  const rule = QUALIFY_PRESETS[presetIdx];
  const teamByCode = useMemo(() => new Map(teams.map((t) => [t.teamCode, t])), [teams]);
  const teamOf = useCallback((p: CardPlayer) => teamByCode.get(p.teamCode), [teamByCode]);

  // 축 세트는 시즌 코드가 아니라 커버리지 플래그로 고른다 (2차 스탯 없는 시즌 → 고전 축)
  const axisSet = axisSetFor(coverage);
  const qualifiedFn = useCallback((p: CardPlayer) => isQualified(p, rule), [rule]);
  const reference = useMemo(() => buildReference(players, rule, axisSet), [players, rule, axisSet]);
  const pools = useMemo(() => buildCardStatPools(players, rule), [players, rule]);
  const qualifiedCount = useMemo(() => players.filter(qualifiedFn).length, [players, qualifiedFn]);

  // 기본 선수: 표본 충족 선수 중 종합 기여도 축(modern: PIE, classic: PER) 1위
  const defaultId = useMemo(() => {
    const impact = RADAR_IMPACT_AXIS[axisSet];
    const pool = players.filter((p) => isQualified(p, DEFAULT_QUALIFY));
    const list = pool.length ? pool : players;
    return list.reduce((best, p) => (axisValue(p, impact) > axisValue(best, impact) ? p : best), list[0]).id;
  }, [players, axisSet]);

  const exists = (id: string | null) => !!id && players.some((p) => p.id === id);
  const [aId, setAId] = useState<string>(defaultId);
  const [bId, setBId] = useState<string | null>(null);

  // 공유 링크(?p=선수&vs=비교선수)로 들어온 경우 반영.
  // useSearchParams 대신 window.location을 읽는다 → 정적 HTML에 카드가 그대로 렌더링됨 (클라이언트 전용 렌더링 회피)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const p = searchParams.get("p");
    const vs = searchParams.get("vs");
    if (exists(p)) setAId(p!);
    if (exists(vs) && vs !== p) setBId(vs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 선택 상태를 주소에 남겨 공유·새로고침 시 유지 (재렌더링 없이)
  useEffect(() => {
    const qs = new URLSearchParams({ p: aId });
    if (bId) qs.set("vs", bId);
    window.history.replaceState(null, "", `${window.location.pathname}?${qs}`);
  }, [aId, bId]);

  const toEntry = useCallback(
    (id: string | null): CardEntry | null => {
      const p = players.find((x) => x.id === id);
      if (!p) return null;
      const pct = radarPercentiles(p, reference, axisSet);
      return {
        player: p,
        pct,
        type: playerType(pct, axisSet),
        qualified: isQualified(p, rule),
        stats: cardStats(p, pools, rule),
      };
    },
    [players, reference, pools, rule, axisSet],
  );

  const a = toEntry(aId);
  const b = bId && bId !== aId ? toEntry(bId) : null;
  const cards = [a && { entry: a, series: colors.series1 }, b && { entry: b, series: colors.series2 }].filter(
    (x): x is { entry: CardEntry; series: string } => !!x,
  );

  // ── 이미지 저장 ──
  // KBL 사진·로고는 CORS 헤더가 없어 캔버스에 그리면 저장이 실패한다.
  // → 저장할 때만 화면 밖에 "공식 이미지 없는 사본"(exportMode)을 그려 그것을 PNG로 만든다. 보이는 카드는 그대로.
  //   혹시 공식 <img> 가 섞여도 filter(excludeOfficialImages)가 뺀다.
  const exportRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      await nextFrame();
      await nextFrame();
      if (!exportRef.current) throw new Error("저장용 사본이 없습니다");
      const dataUrl = await toPng(exportRef.current, {
        pixelRatio: 2,
        backgroundColor: colors.surface,
        skipFonts: true,
        filter: excludeOfficialImages,
      });
      const link = document.createElement("a");
      link.download = `${a!.player.nameKo}${b ? `_vs_${b.player.nameKo}` : ""}_${seasonLabel}_플레이어카드.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setSaveError("이미지 저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  const cardProps = { seasonLabel, axisSet, ruleLabel: presetLabel(rule), qualifiedCount, colors };

  return (
    <main className="mx-auto max-w-3xl px-4 pt-5">
      <header className="mb-4">
        <p className="text-xs font-medium text-ink-3">{seasonLabel} KBL 정규시즌</p>
        <h1 className="mt-0.5 text-xl font-bold tracking-tight">플레이어 카드</h1>
        <p className="mt-1 text-sm text-ink-2">
          경기당 기록 9개와 시즌 순위를 한 장에. 1~3위는 메달, 4~10위는 팀 색으로 표시합니다.
        </p>
      </header>

      <section aria-label="보기 설정" className="grid grid-cols-2 gap-2">
        <label className="flex flex-col text-xs font-medium text-ink-2">
          <span className="mb-1">순위·백분위 비교 기준</span>
          <select
            className="h-11 rounded-lg border border-line bg-surface px-2 text-base text-ink"
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
          label="선수"
          players={players}
          value={aId}
          onChange={(id) => id && setAId(id)}
          isQualified={qualifiedFn}
          teamOf={teamOf}
          swatchColor={b ? colors.series1 : undefined}
        />
        <PlayerPicker
          label="비교 선수 (선택)"
          players={players.filter((p) => p.id !== aId)}
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
        비교 집단: {presetLabel(rule)} 출전한 {qualifiedCount}명
      </p>

      {a && (
        <>
          {/* 비교 선수가 있으면 카드 두 장을 나란히(모바일은 위아래로) */}
          <div
            className={`mt-4 grid gap-4 ${b ? "sm:grid-cols-2" : "mx-auto max-w-[420px]"}`}
          >
            {cards.map((c) => (
              <PlayerCard
                key={c.entry.player.id}
                entry={c.entry}
                team={teamOf(c.entry.player)}
                seriesColor={c.series}
                {...cardProps}
              />
            ))}
          </div>

          <div className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 ${b ? "" : "mx-auto max-w-[420px]"}`}>
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

          <p className={`mt-4 text-xs leading-relaxed text-ink-3 ${b ? "" : "mx-auto max-w-[420px]"}`}>
            카드 아래 레이더는 원래 값이 아니라 시즌 내 백분위(0~100)입니다.{" "}
            {axisSet === "classic"
              ? "이 시즌은 KBL이 USG%·AST%·REB%·PIE를 제공하지 않아 40분당 환산(누적 ÷ 출전시간 × 40)과 TS%·PER로 그렸습니다(고전 축). 2차 스탯이 있는 시즌의 카드와는 축이 달라 직접 비교할 수 없습니다."
              : "2차 스탯은 KBL 계산값 그대로입니다(NBA 공식과 척도가 다를 수 있음)."}
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
