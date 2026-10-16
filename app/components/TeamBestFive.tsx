"use client";
// 팀 페이지 "나만의 올타임 베스트 5" (2026-10-16 "우리만의 기능"): 이 팀을 거친 선수(30경기 이상)로 주전 다섯 명 짜기.
// 자리 규칙은 54-0 과 같음(lib/team-best — 가드 2·포워드 2·센터 1, 외국 선수 2명까지). 선수마다 이 팀 최고 시즌 하나로 보인다.
// 후보는 처음엔 받지 않고 "선수 고르기" 를 누르거나 공유 주소(?best=번호:시즌,…)로 열 때 /team-best/{팀코드}.json 을 한 번 받는다.
// 다섯 명이 차면 하프코트 결과(HalfCourt — 54-0 과 같은 그림) + 경기당 기록 표 + 이미지 저장(useCardSave, 공식 사진 없는 사본) + 링크 복사.
// GA4: lineup_start {team_code} · lineup_complete {team_code} · lineup_share_link {team_code} · image_save(useCardSave)
//      · filter_change screen=team_best filter=position value=all/G/F/C
import { useEffect, useRef, useState } from "react";
import {
  bestBlockReason, bestTotals, decodeBestParam, emptyBestLineup, encodeBestParam, filterBestByPos, isBestFull, placeBest,
  TEAM_BEST_MIN_GAMES, TEAM_BEST_VISIBLE, teamBestFileUrl, type BestCandidate, type BestLineup, type BestPosChip, type TeamBestFile,
} from "@/lib/team-best";
import { GAME_SLOTS, SLOT_LABELS } from "@/lib/game";
import { positionLabel } from "@/lib/roster";
import type { TeamBrand } from "@/lib/franchise";
import ChipRow from "./ChipRow";
import GradeChip from "./GameGradeChip";
import { COURT_SPOTS, CourtLines } from "./HalfCourt";
import { IconChevronDown } from "./icons";
import InfoLink from "./InfoLink";
import { PlayerLink } from "./EntityLinks";
import PlayerAvatar from "./PlayerAvatar";
import Skeleton from "./Skeleton";
import { trackEvent, trackFilters } from "./track";
import { useCardSave } from "./useCardSave";
import { useThemeColors, type ThemeColors } from "./useThemeColors";

const POS_CHIPS: { value: BestPosChip; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "G", label: "가드" },
  { value: "F", label: "포워드" },
  { value: "C", label: "센터" },
];

type Status = "idle" | "loading" | "ready" | "error";

export default function TeamBestFive({ brand }: { brand: TeamBrand }) {
  const colors = useThemeColors();
  const [status, setStatus] = useState<Status>("idle");
  const [cands, setCands] = useState<BestCandidate[]>([]);
  const [lineup, setLineup] = useState<BestLineup>(emptyBestLineup);
  const [chip, setChip] = useState<BestPosChip>("all");
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const loading = useRef<Promise<BestCandidate[] | null> | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const code = brand.teamCode;

  function load(): Promise<BestCandidate[] | null> {
    if (!loading.current) {
      setStatus("loading");
      loading.current = fetch(teamBestFileUrl(code))
        .then((r) => (r.ok ? (r.json() as Promise<TeamBestFile>) : Promise.reject(new Error(String(r.status)))))
        .then((f) => {
          setCands(f.candidates);
          setStatus("ready");
          return f.candidates;
        })
        .catch(() => {
          loading.current = null;
          setStatus("error");
          return null;
        });
    }
    return loading.current;
  }

  // 공유 주소로 열면 후보를 받아 그 라인업을 바로 보여 준다
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("best");
    if (!v) return;
    load().then((cs) => {
      const l = cs ? decodeBestParam(cs, v) : null;
      if (!l) return;
      setLineup(l);
      requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ block: "start" }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setUrl(next: BestLineup) {
    const url = new URL(window.location.href);
    const v = encodeBestParam(next);
    if (v) url.searchParams.set("best", v);
    else url.searchParams.delete("best");
    window.history.replaceState(null, "", url);
  }

  function start() {
    trackEvent("lineup_start", { team_code: code });
    void load();
  }

  function pick(c: BestCandidate) {
    const next = placeBest(lineup, c);
    if (next === lineup) return;
    setLineup(next);
    setCopied(false);
    if (isBestFull(next)) {
      setUrl(next);
      trackEvent("lineup_complete", { team_code: code });
      requestAnimationFrame(() => document.getElementById("best-five-result")?.scrollIntoView({ block: "start", behavior: "smooth" }));
    }
  }

  function remove(i: number) {
    const next = lineup.slice();
    next[i] = null;
    setLineup(next);
    setUrl(next);
    setCopied(false);
  }

  function reset() {
    const next = emptyBestLineup();
    setLineup(next);
    setUrl(next);
    setCopied(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      trackEvent("lineup_share_link", { team_code: code });
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const full = isBestFull(lineup);
  const list = filterBestByPos(cands, chip);
  const visible = showAll ? list : list.slice(0, TEAM_BEST_VISIBLE);

  return (
    <section ref={sectionRef} id="best-five" aria-labelledby="best-five-title" className="surface-card scroll-mt-20 rounded-container p-4">
      <h2 id="best-five-title" className="flex items-center gap-1 text-h2 font-bold">
        나만의 올타임 베스트 5 <InfoLink term="teamBest5" className="ml-1" />
      </h2>
      <p className="mt-1 text-sub text-ink-3">
        {brand.shortName}에서 {TEAM_BEST_MIN_GAMES}경기 이상 뛴 선수로 주전 다섯 명. 선수마다 이 팀 최고 시즌으로 보여 줘요.
      </p>

      {status === "idle" ? (
        <button
          type="button"
          onClick={start}
          className="focus-ring mt-3 h-11 w-full cursor-pointer rounded-control bg-ink px-4 text-body font-bold text-surface transition-colors duration-200 hover:bg-ink-2 sm:w-auto"
        >
          선수 고르기
        </button>
      ) : (
        <>
          <SlotBoard lineup={lineup} brand={brand} onRemove={remove} />
          {status === "loading" && <Skeleton className="mt-3 h-64 w-full rounded-card" />}
          {status === "error" && (
            <p className="mt-3 text-sub text-ink-2">
              후보를 불러오지 못했어요.{" "}
              <button type="button" onClick={() => void load()} className="link-shortcut cursor-pointer">
                다시 불러오기
              </button>
            </p>
          )}
          {status === "ready" && full && (
            <ResultBlock players={lineup as BestCandidate[]} brand={brand} colors={colors} copied={copied} onCopy={copyLink} onReset={reset} />
          )}
          {status === "ready" && !full && (
            <div className="mt-4">
              <ChipRow
                label="포지션"
                chips={POS_CHIPS.map((c) => ({ value: c.value, label: `${c.label} ${filterBestByPos(cands, c.value).length}` }))}
                value={chip}
                onChange={(v) => {
                  setChip(v);
                  setShowAll(false);
                  trackFilters("team_best", { position: v });
                }}
                scroll
              />
              {/* PC 는 두 줄로 (한 줄이 너무 길어진다) */}
              <ul className="mt-2 grid gap-x-6 lg:grid-cols-2">
                {visible.map((c) => (
                  <CandidateRow key={c.id} c={c} brand={brand} colors={colors} reason={bestBlockReason(lineup, c)} onPick={() => pick(c)} />
                ))}
              </ul>
              {list.length === 0 && <p className="py-4 text-sub text-ink-3">이 포지션 후보가 없어요.</p>}
              {!showAll && list.length > visible.length && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="focus-ring mt-2 flex h-11 w-full cursor-pointer items-center justify-center gap-1 rounded-control border border-line text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
                >
                  {list.length - visible.length}명 더 보기 <IconChevronDown size={16} />
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** 다섯 칸 — 찬 칸을 누르면 뺀다 */
function SlotBoard({ lineup, brand, onRemove }: { lineup: BestLineup; brand: TeamBrand; onRemove: (i: number) => void }) {
  return (
    <ol className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-2" aria-label="주전 다섯 칸">
      {GAME_SLOTS.map((g, i) => {
        const p = lineup[i];
        return (
          <li key={i} className="min-w-0">
            {p ? (
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`${SLOT_LABELS[g]} ${p.name} 빼기`}
                className="focus-ring flex min-h-24 w-full cursor-pointer flex-col items-center justify-start gap-1 rounded-card border border-line px-1 py-2 transition-colors duration-200 hover:bg-surface-2"
              >
                <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.name} color={brand.color} size={40} />
                <span className="w-full truncate text-center text-caption font-bold text-ink">{p.name}</span>
                <span className="tabular text-caption text-ink-3">{p.season}</span>
              </button>
            ) : (
              <div className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-card border border-dashed border-line px-1 py-2">
                {/* 빈 사진 자리 (아바타 모양) */}
                {/* deslop-ignore-next-line 19 */}
                <span aria-hidden className="block h-10 w-10 rounded-full border border-dashed border-line" />
                <span className="text-caption font-semibold text-ink-3">{SLOT_LABELS[g]}</span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function CandidateRow({
  c, brand, colors, reason, onPick,
}: { c: BestCandidate; brand: TeamBrand; colors: ThemeColors; reason: string | null; onPick: () => void }) {
  return (
    <li className="border-b border-line">
      <button
        type="button"
        onClick={onPick}
        disabled={reason !== null}
        className="focus-ring-inset flex min-h-14 w-full cursor-pointer items-center gap-3 py-2 text-left transition-colors duration-200 enabled:hover:bg-surface-2 disabled:cursor-not-allowed"
      >
        <PlayerAvatar photoUrl={c.photoUrl} nameKo={c.name} color={brand.color} size={40} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={`truncate text-body font-bold ${reason ? "text-ink-3" : "text-ink"}`}>{c.name}</span>
            <GradeChip score={c.score} color={brand.color} colors={colors} />
            <span className="shrink-0 text-caption text-ink-3">{positionLabel(c.position)}{c.foreign ? " · 외국" : ""}</span>
          </span>
          <span className="tabular block text-caption text-ink-2">
            {c.season} 시즌 {c.ppg.toFixed(1)}점 {c.rpg.toFixed(1)}리바 {c.apg.toFixed(1)}어시 <span className="whitespace-nowrap text-ink-3">· 이 팀 {c.games}경기</span>
          </span>
        </span>
        {reason && <span className="shrink-0 text-caption text-ink-3">{reason}</span>}
      </button>
    </li>
  );
}

function ResultBlock({
  players, brand, colors, copied, onCopy, onReset,
}: { players: BestCandidate[]; brand: TeamBrand; colors: ThemeColors; copied: boolean; onCopy: () => void; onReset: () => void }) {
  const { exportRef, saving, saveError, save } = useCardSave(colors.surface);
  return (
    <div id="best-five-result" className="mt-4 scroll-mt-20">
      <ResultCard players={players} brand={brand} colors={colors} official />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={onReset}
          className="focus-ring col-span-2 h-11 cursor-pointer rounded-control bg-ink text-body font-bold text-surface transition-colors duration-200 hover:bg-ink-2 sm:col-span-1"
        >
          다시 고르기
        </button>
        <button
          type="button"
          onClick={() => save(`best5-${brand.teamCode}.png`)}
          disabled={saving}
          className="focus-ring h-11 cursor-pointer rounded-control border border-line bg-surface text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
        >
          {saving ? "저장 중…" : "이미지 저장"}
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="focus-ring h-11 cursor-pointer rounded-control border border-line bg-surface text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
        >
          {copied ? "복사됨" : "링크 복사"}
        </button>
      </div>
      {saveError && <p className="mt-2 text-sub text-ink-2">{saveError}</p>}
      {saving && (
        <div aria-hidden className="pointer-events-none fixed top-0" style={{ left: -10000 }}>
          <div ref={exportRef} className="w-[440px] bg-surface p-3">
            <ResultCard players={players} brand={brand} colors={colors} official={false} />
          </div>
        </div>
      )}
    </div>
  );
}

/** 결과 카드 (화면·저장 이미지 공용). official=false 면 공식 사진 없이, 링크 없이 */
function ResultCard({ players, brand, colors, official }: { players: BestCandidate[]; brand: TeamBrand; colors: ThemeColors; official: boolean }) {
  const totals = bestTotals(players);
  return (
    <div className="@container rounded-card border border-line bg-surface p-4">
      <p className="text-body font-bold text-ink">{brand.name} 올타임 베스트 5</p>
      {/* 넓은 상자(48rem 이상)는 코트 왼쪽 · 기록 표 오른쪽 (화면 폭이 아니라 상자 폭 기준).
          저장 사본은 감싸는 상자 없이(contents) 위아래로 — html-to-image 가 상자 높이를 고정으로 옮겨 글꼴이 바뀌면 글자가 겹친다 */}
      <div className={official ? "@3xl:grid @3xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] @3xl:items-start @3xl:gap-8" : "contents"}>
        <div className="relative mx-auto mt-3 aspect-[15/16] w-full max-w-md overflow-hidden rounded-card bg-surface-2 max-[359px]:aspect-[15/19] sm:aspect-[15/14]">
          <CourtLines />
          {players.map((p, i) => {
            const spot = COURT_SPOTS[i];
            return (
              <div
                key={p.id}
                className="absolute flex w-32 -translate-x-1/2 -translate-y-6 flex-col items-center text-center sm:-translate-y-8"
                style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
              >
                {/* deslop-ignore-next-line 19 */}
                <PlayerLink id={official ? p.id : null} season={p.seasonCode} tabIndex={-1} aria-label={`${p.name} 선수 페이지`} className="flex rounded-full">
                  <span className="flex sm:hidden">
                    <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.name} color={brand.color} size={48} official={official} />
                  </span>
                  <span className="hidden sm:flex">
                    <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.name} color={brand.color} size={64} official={official} />
                  </span>
                </PlayerLink>
                <span className="surface-card mt-1 flex max-w-full flex-col rounded-control px-1.5 py-0.5 sm:px-2 sm:py-1">
                  <span className="flex min-w-0 items-center justify-center gap-1">
                    <PlayerLink id={official ? p.id : null} season={p.seasonCode} className="truncate text-sub font-bold text-ink hover:underline">
                      {p.name}
                    </PlayerLink>
                    <GradeChip score={p.score} color={brand.color} colors={colors} />
                  </span>
                  <span className="tabular truncate text-caption text-ink-2">
                    {SLOT_LABELS[GAME_SLOTS[i]]} · {p.season}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <div className={official ? "mt-4 @3xl:mt-3" : "contents"}>
          <table className={`tabular w-full table-fixed text-caption ${official ? "" : "mt-4"}`}>
            <caption className="mb-1 text-left text-sub font-bold text-ink">그 시즌 경기당 기록</caption>
            <thead>
              <tr className="text-ink-3">
                <th scope="col" className="w-[40%] py-1 text-left font-medium">선수</th>
                <th scope="col" className="py-1 text-right font-medium">시즌</th>
                <th scope="col" className="py-1 text-right font-medium">득점</th>
                <th scope="col" className="py-1 text-right font-medium">리바</th>
                <th scope="col" className="py-1 text-right font-medium">어시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-y border-line">
              {players.map((p, i) => (
                <tr key={p.id}>
                  <th scope="row" className="truncate py-1.5 text-left font-semibold text-ink">
                    <span className="mr-1.5 font-medium text-ink-3" aria-label={SLOT_LABELS[GAME_SLOTS[i]]}>{GAME_SLOTS[i]}</span>
                    {p.name}
                  </th>
                  <td className="py-1.5 text-right text-ink-2">{p.season}</td>
                  <td className="py-1.5 text-right text-ink">{p.ppg.toFixed(1)}</td>
                  <td className="py-1.5 text-right text-ink">{p.rpg.toFixed(1)}</td>
                  <td className="py-1.5 text-right text-ink">{p.apg.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold text-ink">
                <th scope="row" className="py-1.5 text-left">합계</th>
                <td />
                <td className="py-1.5 text-right">{totals.ppg.toFixed(1)}</td>
                <td className="py-1.5 text-right">{totals.rpg.toFixed(1)}</td>
                <td className="py-1.5 text-right">{totals.apg.toFixed(1)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="tabular mt-2 text-caption text-ink-2">다섯 명 평균 종합 점수 {totals.avgScore}점</p>
        </div>
      </div>
      {!official && (
        <p className="mt-3 text-caption text-ink-3">
          KBL - Stats Reference · 비영리 팬 프로젝트
        </p>
      )}
    </div>
  );
}
