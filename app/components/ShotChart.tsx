"use client";
// 선수 상세 "슛 차트" 섹션 (PLAN.md §14): 하프코트 SVG 위 슛 점 + 구역표 5줄 + 주 공격 유형 칩.
// - 코트는 직접 그린 SVG(차트 라이브러리 아님). 선 위치·viewBox 는 lib/shots courtGeometry(구역 판정과 같은 상수), 점 거르기는 courtPoints.
// - 점: 성공 = 팀 색 채움(바탕 대비 3:1 보정), 실패 = ink-3 테두리만 — 색이 아니라 모양(채움/빈 원)으로도 구분된다.
// - 구역 색 / 슛 위치 전환 (2026-10-01, NBA.com 핫/콜드 참고): 구역 색 = 구역 성공률 − 리그 평균(%p)을 발산형 색(파랑 낮음·회색·빨강 높음,
//   ±10%p 에서 가장 진함, 시도 10개 미만은 빗금 — 회색은 "리그 평균과 비슷" 한 가지 뜻만). 구역 안 숫자는 성공률(ink 글자 + 표면색 테두리). 계산은 lib/shots zoneHeat·courtZoneShapes.
// - 구역표: 구역 · 시도 비중 막대(팀 색) · 시도 · 성공률 · 리그 평균 · 리그 대비 %p. 리그보다 높으면 굵게. 계산은 lib/shots zoneRows.
// - 시즌: 부모(PlayerSeasonCards)의 시즌 칩을 따른다. 첫 화면(최신 시즌)은 서버가 넣은 값(initial), 다른 시즌은
//   우리 정적 파일 /shots/{시즌}/{선수}.json 을 받는다(빌드 전 scripts/build-shots.ts — KBL 호출 아님). 슛 데이터 없는 시즌은 받지 않고 한 줄 안내.
// - PC(1024px 이상): 코트 왼쪽 · 구역표 오른쪽. 모바일: 코트(폭 가득) → 구역표.
import { useEffect, useId, useState } from "react";
import { offenseTypeDef, offenseTypeHelp } from "@/lib/glossary";
import {
  courtGeometry,
  courtPoints,
  courtZoneShapes,
  ZONE_HEAT_MIN_ATTEMPTS,
  zoneDiffText,
  zoneHeat,
  zoneRows,
  type PlayerShotsFile,
} from "@/lib/shots";
import { desaturate, divergingFill, ensureMarkContrast } from "@/lib/teams";
import Segmented from "./Segmented";
import HelpPopover from "./HelpPopover";
import { IconInfo } from "./icons";
import InfoLink from "./InfoLink";
import Skeleton from "./Skeleton";
import { useThemeColors } from "./useThemeColors";
import { useMounted } from "./useMedia";
import { trackFilters } from "./track";

// 선수·시즌 파일은 한 번만 받는다 (시즌 칩을 오가도 다시 받지 않음)
const cache = new Map<string, Promise<PlayerShotsFile>>();

function loadShots(seasonCode: number, playerId: string): Promise<PlayerShotsFile> {
  const key = `${seasonCode}/${playerId}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/shots/${key}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<PlayerShotsFile>;
      })
      .catch((e) => {
        cache.delete(key); // 실패하면 다음에 다시 시도
        throw e;
      });
    cache.set(key, p);
  }
  return p;
}

type Status = "ready" | "loading" | "error" | "none";

function useShots(playerId: string, seasonCode: number, available: readonly number[], initial: PlayerShotsFile | null) {
  const pick = (code: number): { code: number; file: PlayerShotsFile | null; status: Status } =>
    !available.includes(code)
      ? { code, file: null, status: "none" }
      : initial && initial.seasonCode === code
        ? { code, file: initial, status: "ready" }
        : { code, file: null, status: "loading" };
  const [state, setState] = useState(() => pick(seasonCode));
  useEffect(() => {
    const next = pick(seasonCode);
    if (next.status !== "loading") {
      setState(next);
      return;
    }
    let alive = true;
    setState(next);
    loadShots(seasonCode, playerId)
      .then((file) => alive && setState({ code: seasonCode, file, status: "ready" }))
      .catch(() => alive && setState({ code: seasonCode, file: null, status: "error" }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, seasonCode]);
  return state;
}

const NF = new Intl.NumberFormat("ko-KR");
const pctText = (v: number | null) => (v === null ? "–" : `${v.toFixed(1)}%`);
const COURT = courtGeometry();
const ZONE_SHAPES = courtZoneShapes();
/** 구역 숫자 글자 크기 (m) */
const ZONE_FONT = 0.62;

/** 표본 적음(시도 10개 미만) 표시: 회색 칠 대신 빗금 — 가운데 회색("리그 평균과 비슷")과 헷갈리지 않게 (2026-10-01 사용자 지적) */
// deslop-ignore-next-line 06
const HATCH_CSS = "repeating-linear-gradient(45deg, var(--ink-3) 0 1px, var(--surface) 1px 4px)";

type ChartMode = "zones" | "dots";
const MODE_OPTIONS: { value: ChartMode; label: string }[] = [
  { value: "zones", label: "구역 색" },
  { value: "dots", label: "슛 위치" },
];
/** 점 반지름 (m) — 모바일 폭(약 360px)에서 약 3.3px, PC(460px)에서 약 4.2px */
const DOT_R = 0.14;

interface Props {
  playerId: string;
  seasonCode: number;
  /** 칩·안내에 쓰는 짧은 시즌 표기, 예: "25-26" */
  seasonShort: string;
  /** 그 선수 슛 차트가 있는 시즌 코드 */
  available: number[];
  /** 서버가 넣은 최신 시즌 파일 (없으면 null) */
  initial: PlayerShotsFile | null;
  /** 그 시즌 팀 주 색 */
  teamPrimary: string;
}

export default function ShotChart({ playerId, seasonCode, seasonShort, available, initial, teamPrimary }: Props) {
  const { file, status } = useShots(playerId, seasonCode, available, initial);
  const colors = useThemeColors();
  const madeColor = ensureMarkContrast(teamPrimary, colors.surface, 3);
  const barColor = desaturate(madeColor, 0.2);
  const type = file?.zones.offenseType ?? null;
  // 코트 그림·구역표는 브라우저에서만 그린다 — 정적 HTML 에서 빼서 선수 페이지 결과물을 줄인다 (2026-10-14)
  const mounted = useMounted();

  return (
    <section aria-labelledby="shot-chart-title" className="scroll-mt-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 id="shot-chart-title" className="flex items-center gap-1 text-h2 font-bold">
          슛 차트 <InfoLink term="shotZones" className="ml-1" />
        </h2>
        {status === "ready" && type && (
          <HelpPopover
            content={offenseTypeHelp(type)}
            ariaLabel={`주 공격 유형 ${offenseTypeDef(type).label} — 기준 보기`}
            className="inline-flex h-10 items-center gap-1 rounded-control border border-line bg-surface px-3 text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
          >
            {offenseTypeDef(type).label}
            <IconInfo size={16} className="text-ink-3" />
          </HelpPopover>
        )}
      </div>

      {status === "none" ? (
        <p className="surface-card rounded-container px-4 py-6 text-center text-body text-ink-2">이 시즌은 슛 차트 기록이 없습니다.</p>
      ) : status === "error" ? (
        <p role="alert" className="surface-card rounded-container px-4 py-6 text-center text-body text-ink-2">
          슛 차트를 불러오지 못했습니다. 시즌을 다시 눌러 주세요.
        </p>
      ) : status === "loading" || !file || !mounted ? (
        <>
          <p role="status" className="sr-only">
            슛 차트 불러오는 중
          </p>
          <ShotChartSkeleton />
        </>
      ) : (
        <ShotChartBody file={file} seasonShort={seasonShort} madeColor={madeColor} missColor={colors.ink3} lineColor={colors.grid} barColor={barColor} />
      )}
    </section>
  );
}

function ShotChartSkeleton() {
  return (
    <div aria-hidden className="grid gap-4 lg:grid-cols-[460px_minmax(0,1fr)] lg:items-start">
      <Skeleton className="w-full rounded-container" style={{ aspectRatio: String(COURT.aspect) }} />
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

interface BodyProps {
  file: PlayerShotsFile;
  seasonShort: string;
  madeColor: string;
  missColor: string;
  lineColor: string;
  barColor: string;
}

function ShotChartBody({ file, seasonShort, madeColor, missColor, lineColor, barColor }: BodyProps) {
  const { zones, league } = file;
  const rows = zoneRows(zones, league);
  const hasLeagueRows = league !== null;
  const [mode, setMode] = useState<ChartMode>(hasLeagueRows ? "zones" : "dots");
  const clipId = useId().replace(/:/g, "");
  const rowByKey = new Map(rows.map((r) => [r.key, r]));
  const { made, missed } = courtPoints(file.points);
  const total = zones.total;
  const totalPct = total.attempts > 0 ? (total.made / total.attempts) * 100 : null;
  const hasLeague = league !== null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[460px_minmax(0,1fr)] lg:items-start">
      <figure className="surface-card rounded-container p-2">
        {hasLeagueRows && (
          <div className="mb-1.5 flex justify-end">
            <Segmented label="슛 차트 보기" options={MODE_OPTIONS} value={mode} onChange={(v) => { trackFilters("shot_chart", { view: v }); setMode(v); }} />
          </div>
        )}
        <svg
          viewBox={COURT.viewBox}
          className="block h-auto w-full"
          role="img"
          aria-label={
            mode === "zones"
              ? `${seasonShort} 정규시즌 구역별 성공률을 리그 평균과 비교한 색. 구역별 숫자는 옆 표에 있습니다.`
              : `${seasonShort} 정규시즌 슛 ${NF.format(total.attempts)}개 위치, 성공 ${NF.format(total.made)}개. 구역별 숫자는 옆 표에 있습니다.`
          }
        >
          {mode === "zones" && (
            <defs>
              <pattern id={`${clipId}-hatch`} width={0.45} height={0.45} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width={0.45} height={0.45} fill="var(--surface)" />
                <line x1={0} y1={0} x2={0} y2={0.45} stroke="var(--ink-3)" strokeWidth={0.07} />
              </pattern>
            </defs>
          )}
          {mode === "zones" && (
            <g>
              {ZONE_SHAPES.map((z) => {
                const heat = zoneHeat(rowByKey.get(z.key)!);
                const fill = heat === null ? `url(#${clipId}-hatch)` : divergingFill(heat);
                return (
                  <g key={z.key} clipPath={z.clip ? `url(#${clipId}-${z.key})` : undefined}>
                    {z.clip && (
                      <clipPath id={`${clipId}-${z.key}`}>
                        <path d={z.clip} />
                      </clipPath>
                    )}
                    {z.paths.map((d, i) => (
                      <path key={i} d={d} fill={fill} fillRule={z.evenOdd ? "evenodd" : "nonzero"} />
                    ))}
                  </g>
                );
              })}
            </g>
          )}
          <g fill="none" stroke={lineColor} strokeWidth={1} vectorEffect="non-scaling-stroke">
            {COURT.lines.map((d, i) => (
              <path key={i} d={d} vectorEffect="non-scaling-stroke" />
            ))}
            <circle cx={COURT.rim.cx} cy={COURT.rim.cy} r={COURT.rim.r} vectorEffect="non-scaling-stroke" />
          </g>
          {mode === "zones" ? (
            <g
              fontSize={ZONE_FONT}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--ink)"
              stroke="var(--surface)"
              strokeWidth={0.14}
              paintOrder="stroke"
              className="tabular"
            >
              {ZONE_SHAPES.flatMap((z) =>
                z.labels.map((l, i) => {
                  const r = rowByKey.get(z.key)!;
                  return (
                    <text
                      key={`${z.key}-${i}`}
                      x={l.x}
                      y={l.y}
                      transform={l.vertical ? `rotate(-90 ${l.x} ${l.y})` : undefined}
                      fontSize={l.vertical ? ZONE_FONT * 0.8 : ZONE_FONT}
                    >
                      {r.attempts === 0 ? "–" : pctText(r.pct)}
                    </text>
                  );
                }),
              )}
            </g>
          ) : (
            <>
          <g fill="none" stroke={missColor} strokeWidth={1.25}>
                {missed.map((p, i) => (
                  <circle key={i} cx={p[1]} cy={p[0]} r={DOT_R} vectorEffect="non-scaling-stroke" />
                ))}
              </g>
              <g fill={madeColor} fillOpacity={0.88}>
                {made.map((p, i) => (
                  <circle key={i} cx={p[1]} cy={p[0]} r={DOT_R} />
                ))}
              </g>
            </>
          )}
        </svg>
        <figcaption className="tabular flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pt-2 text-sub text-ink-2">
          <span className="font-semibold text-ink">
            {seasonShort} · 슛 {NF.format(total.attempts)}개 · {pctText(totalPct)}
          </span>
          {mode === "zones" ? (
            <>
              <span className="inline-flex items-center gap-1">
                <span aria-hidden className="block h-2.5 w-5 rounded-md" style={{ background: divergingFill(-1) }} />
                리그보다 낮음
              </span>
              <span className="inline-flex items-center gap-1">
                <span aria-hidden className="block h-2.5 w-5 rounded-md" style={{ background: divergingFill(0) }} />
                비슷
              </span>
              <span className="inline-flex items-center gap-1">
                <span aria-hidden className="block h-2.5 w-5 rounded-md" style={{ background: divergingFill(1) }} />
                높음
              </span>
              <span className="inline-flex items-center gap-1">
                <span aria-hidden className="block h-2.5 w-5 rounded-md border border-line" style={{ background: HATCH_CSS }} />
                시도 {ZONE_HEAT_MIN_ATTEMPTS}개 미만
              </span>
            </>
          ) : (
            <>
          <span className="inline-flex items-center gap-1">
                {/* deslop-ignore-next-line 19 */}
                <span aria-hidden className="block h-2.5 w-2.5 rounded-full" style={{ background: madeColor }} />
                성공
              </span>
              <span className="inline-flex items-center gap-1">
                {/* deslop-ignore-next-line 19 */}
                <span aria-hidden className="block h-2.5 w-2.5 rounded-full border-[1.5px]" style={{ borderColor: missColor }} />
                실패
              </span>
            </>
          )}
        </figcaption>
      </figure>

      <div className="surface-card rounded-container px-3 py-2">
        <table className="tabular w-full border-separate border-spacing-0 text-sub">
          <caption className="sr-only">
            {seasonShort} 구역별 슛: 시도 비중, 시도, 성공률{hasLeague ? ", 리그 평균 성공률" : ""}
          </caption>
          <thead>
            <tr className="text-left text-caption text-ink-3">
              <th scope="col" className="py-2 pr-1 sm:pr-2 font-medium">구역</th>
              <th scope="col" className="w-full py-2 pr-1 sm:pr-2 font-medium">시도 비중</th>
              <th scope="col" className="py-2 pr-1 sm:pr-2 text-right font-medium">시도</th>
              <th scope="col" className="py-2 pr-1 sm:pr-2 text-right font-medium">성공률</th>
              {hasLeague && (
                <th scope="col" className="py-2 pr-1 sm:pr-2 text-right font-medium">리그</th>
              )}
              {hasLeague && (
                <th scope="col" className="py-2 text-right font-medium">
                  <span aria-hidden>±</span>
                  <span className="sr-only">리그 대비 %p</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="h-12">
                <th scope="row" className="whitespace-nowrap border-t border-line pr-1 sm:pr-2 text-left font-semibold text-ink">
                  {r.label}
                </th>
                <td className="border-t border-line pr-1 sm:pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="relative block h-2 min-w-6 flex-1 overflow-hidden rounded-md bg-surface-2" aria-hidden>
                      <span className="absolute inset-y-0 left-0 block rounded-md" style={{ width: `${r.share * 100}%`, background: barColor }} />
                    </span>
                    <span className="w-9 shrink-0 text-right text-ink-2">{Math.round(r.share * 100)}%</span>
                  </div>
                </td>
                <td className="border-t border-line pr-1 sm:pr-2 text-right text-ink-2">{NF.format(r.attempts)}</td>
                <td className={`border-t border-line pr-1 sm:pr-2 text-right ${r.aboveLeague ? "font-bold text-ink" : "text-ink-2"}`}>
                  {pctText(r.pct)}
                  {r.aboveLeague && <span className="sr-only"> (리그 평균보다 높음)</span>}
                </td>
                {hasLeague && <td className="border-t border-line pr-1 sm:pr-2 text-right text-ink-3">{pctText(r.leaguePct)}</td>}
                {hasLeague && (
                  <td className="border-t border-line text-right">
                    <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap text-ink-2">
                      <span
                        aria-hidden
                        className="block h-2.5 w-2.5 rounded-sm"
                        style={{ background: zoneHeat(r) === null ? HATCH_CSS : divergingFill(zoneHeat(r)!) }}
                      />
                      {zoneDiffText(r) ?? "–"}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
