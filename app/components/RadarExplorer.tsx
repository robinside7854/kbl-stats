"use client";
// 시즌 페이지의 상호작용 부분: 시즌 선택, 표본 기준, 선수·비교 선수 선택 → 레이더 카드
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CardPlayer, SeasonOption } from "@/lib/types";
import {
  buildReference,
  DEFAULT_QUALIFY,
  isQualified,
  perGameStats,
  playerType,
  radarPercentiles,
  type QualifyRule,
} from "@/lib/metrics";
import PlayerPicker from "./PlayerPicker";
import RadarCard, { type CardEntry } from "./RadarCard";
import { useThemeColors } from "./useThemeColors";

// 백분위 비교 집단 기준 프리셋 (첫 번째가 기본값)
const QUALIFY_PRESETS: QualifyRule[] = [
  DEFAULT_QUALIFY,
  { minGames: 20, minMinutes: 300 },
  { minGames: 30, minMinutes: 500 },
  { minGames: 5, minMinutes: 50 },
];
const presetLabel = (r: QualifyRule) => `${r.minGames}경기·${r.minMinutes}분 이상`;
// 모바일 선택 상자용 짧은 표기
const presetShort = (r: QualifyRule) => `${r.minGames}경기·${r.minMinutes}분+`;

interface Props {
  seasons: SeasonOption[];
  seasonCode: number;
  seasonLabel: string;
  players: CardPlayer[];
}

export default function RadarExplorer({ seasons, seasonCode, seasonLabel, players }: Props) {
  const router = useRouter();
  const colors = useThemeColors();
  const [presetIdx, setPresetIdx] = useState(0);
  const rule = QUALIFY_PRESETS[presetIdx];

  const qualifiedFn = useCallback((p: CardPlayer) => isQualified(p, rule), [rule]);
  const reference = useMemo(() => buildReference(players, rule), [players, rule]);
  const qualifiedCount = reference.pie.length;

  // 기본 선수: 표본 충족 선수 중 PIE 1위
  const defaultId = useMemo(() => {
    const pool = players.filter((p) => isQualified(p, DEFAULT_QUALIFY));
    const list = pool.length ? pool : players;
    return list.reduce((best, p) => (p.pie > best.pie ? p : best), list[0]).id;
  }, [players]);

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
      const pct = radarPercentiles(p, reference);
      return { player: p, pct, type: playerType(pct), qualified: isQualified(p, rule), perGame: perGameStats(p) };
    },
    [players, reference, rule],
  );

  const a = toEntry(aId);
  const b = bId && bId !== aId ? toEntry(bId) : null;

  function changeSeason(code: string) {
    const qs = new URLSearchParams({ p: aId });
    if (bId) qs.set("vs", bId);
    router.push(`/season/${code}?${qs}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pt-5">
      <header className="mb-4">
        <p className="text-xs font-medium text-ink-3">KBL 정규시즌 · 비영리 팬 프로젝트</p>
        <h1 className="mt-0.5 text-xl font-bold tracking-tight">선수 유형 레이더 카드</h1>
        <p className="mt-1 text-sm text-ink-2">
          다섯 가지 2차 스탯이 같은 시즌 선수들 사이에서 어느 정도 위치인지(백분위) 한눈에 봅니다.
        </p>
      </header>

      {/* 필터는 차트 위 한 줄(모바일에서는 두 줄) */}
      <section aria-label="보기 설정" className="grid grid-cols-2 gap-2">
        <label className="flex flex-col text-xs font-medium text-ink-2">
          <span className="mb-1">시즌</span>
          <select
            className="h-11 rounded-lg border border-line bg-surface px-2 text-base text-ink"
            value={seasonCode}
            onChange={(e) => changeSeason(e.target.value)}
          >
            {seasons.map((s) => (
              <option key={s.seasonCode} value={s.seasonCode}>
                {s.seasonLabel}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs font-medium text-ink-2">
          <span className="mb-1">백분위 비교 기준</span>
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
          swatchColor={b ? colors.series1 : undefined}
        />
        <PlayerPicker
          label="비교 선수 (선택)"
          players={players.filter((p) => p.id !== aId)}
          value={bId}
          onChange={setBId}
          isQualified={qualifiedFn}
          clearable
          placeholder="겹쳐 볼 선수 검색"
          swatchColor={colors.series2}
        />
      </section>

      <p className="mt-2 text-xs text-ink-3">
        비교 집단: {presetLabel(rule)} 출전한 {qualifiedCount}명
      </p>

      {a && (
        <div className="mt-4">
          <RadarCard
            a={a}
            b={b}
            seasonLabel={seasonLabel}
            ruleLabel={presetLabel(rule)}
            qualifiedCount={qualifiedCount}
            colors={colors}
          />
        </div>
      )}
    </main>
  );
}
