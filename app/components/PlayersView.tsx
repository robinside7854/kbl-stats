"use client";
// 선수 탭 (/players): 큰 검색창 → 필터 칩(시즌·포지션·국적·팀) → 그 시즌 선수 그리드(작은 카드).
// - 정적 HTML은 최신 시즌으로 그린다(서버가 넣어 준 시즌 카드 파일 initialFile).
// - 다른 시즌을 고르면 우리 정적 파일 /cards/{코드}.json 을 받아 같은 계산으로 다시 그린다 (useSeasonCards —
//   KBL 서버가 아니라 우리 public/ 파일이므로 원칙 1 위반 아님).
// - 종합 등급·정렬·필터는 lib/cardview(buildGridEntries·sortGridEntries·filterGridEntries) — 여기서는 계산하지 않는다.
// - 상태는 주소 ?season=&pos=&origin=&team= 에 남긴다. 상단 SiteNav 의 시즌 선택과 시즌 칩이 같은 상태를 쓴다.
// - 카드를 누르면 그 선수 상세의 그 시즌 카드로 (/player/번호?season=코드).
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SeasonCardsFile } from "@/lib/cards";
import type { CardTeam, SeasonOption } from "@/lib/types";
import {
  buildGridEntries,
  filterGridEntries,
  formatCardValue,
  parsePlayersQuery,
  playerHref,
  playersQueryString,
  sortGridEntries,
  type GridEntry,
  type PlayersState,
} from "@/lib/cardview";
import { seasonShortLabel } from "@/lib/career";
import { qualifyLabel, type Grade } from "@/lib/metrics";
import { teamShortLabel } from "@/lib/images";
import {
  NATIONALITY_FILTERS,
  nationalityFilterLabel,
  nationalityOf,
  NATIONALITY_LABELS,
  POSITION_FILTERS,
  positionFilterLabel,
  positionLabel,
} from "@/lib/roster";
import ChipRow from "./ChipRow";
import InfoLink from "./InfoLink";
import PlayerAvatar from "./PlayerAvatar";
import PlayerSearch from "./PlayerSearch";
import SiteNav from "./SiteNav";
import TeamLogo from "./TeamLogo";
import { primeSeasonCards, useSeasonCards } from "./useSeasonCards";

interface Props {
  /** 선수가 있는 시즌 (최신이 먼저) */
  seasons: SeasonOption[];
  latest: number;
  /** 최신 시즌 카드 파일 (public/cards 와 같은 내용) — 정적 HTML용 */
  initialFile: SeasonCardsFile;
}

/** 종합 등급 배지 색: S 금색, A 진한 잉크, 나머지 옅은 면 (색만으로 구분하지 않고 글자가 등급) */
function GradeBadge({ grade }: { grade: Grade | "-" }) {
  if (grade === "-") {
    return <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-3">표본 미달</span>;
  }
  const style: React.CSSProperties =
    grade === "S"
      ? { background: "var(--grade-s)", color: "var(--grade-s-ink)" }
      : grade === "A"
        ? { background: "var(--ink)", color: "var(--bg)" }
        : grade === "B" || grade === "C"
          ? { background: "var(--grade-c)", color: "var(--grade-c-ink)" }
          : { background: "var(--grade-f)", color: "var(--grade-f-ink)" };
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-base font-black" style={style} aria-label={`종합 등급 ${grade}`}>
      {grade}
    </span>
  );
}

function GridCard({ e, team, seasonCode }: { e: GridEntry; team?: CardTeam; seasonCode: number }) {
  const p = e.player;
  const pos = positionLabel(p.position);
  return (
    <Link
      href={playerHref(p.id, seasonCode)}
      className="flex h-full min-w-0 flex-col rounded-2xl border border-line bg-surface p-3 hover:bg-surface-2"
      aria-label={`${p.nameKo}, ${team?.shortName ?? p.teamShort}${pos ? `, ${pos}` : ""}, 종합 등급 ${e.overall === "-" ? "표본 미달" : e.overall}, 경기당 ${formatCardValue(e.ppg, false)}점`}
    >
      <span className="flex items-start justify-between gap-2">
        <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={team?.color} size={52} />
        <GradeBadge grade={e.overall} />
      </span>
      <span className="mt-2 line-clamp-2 text-sm font-bold leading-tight text-ink break-keep">{p.nameKo}</span>
      <span className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-ink-2">
        <TeamLogo logoUrl={team?.logoUrl} shortName={team?.shortName ?? p.teamShort} color={team?.color} size={16} />
        <span className="truncate">
          {teamShortLabel(team?.shortName ?? p.teamShort)}
          {pos ? ` · ${pos}` : ""}
        </span>
      </span>
      <span className="mt-auto pt-2 text-[11px] text-ink-3">
        경기당 <b className="text-base font-bold tracking-tight text-ink">{formatCardValue(e.ppg, false)}</b>점
        {p.nationality && p.nationality !== "domestic" && <span className="ml-1">· {NATIONALITY_LABELS[nationalityOf(p)]}</span>}
      </span>
    </Link>
  );
}

export default function PlayersView({ seasons, latest, initialFile }: Props) {
  const initialCards = useMemo(() => primeSeasonCards(initialFile), [initialFile]);
  const [state, setState] = useState<PlayersState>({ season: latest, position: "all", origin: "all", teamCode: null });
  const seasonCodes = useMemo(() => seasons.map((s) => s.seasonCode), [seasons]);

  useEffect(() => {
    setState(parsePlayersQuery(window.location.search, { seasons: seasonCodes, latest }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${playersQueryString(state, latest)}`);
  }, [state, latest]);

  const { cards, status } = useSeasonCards(state.season, initialCards);
  const shownSeason = cards?.seasonCode ?? state.season;
  const teams = cards?.teams ?? [];
  const teamByCode = useMemo(() => new Map(teams.map((t) => [t.teamCode, t])), [teams]);
  // 이 시즌에 없는 팀이면 전체로 본다 (시즌을 바꿨을 때)
  const teamCode = state.teamCode && teamByCode.has(state.teamCode) ? state.teamCode : null;

  const all = useMemo(() => (cards ? sortGridEntries(buildGridEntries(cards)) : []), [cards]);
  const shown = useMemo(
    () => filterGridEntries(all, { position: state.position, origin: state.origin, teamCode }),
    [all, state.position, state.origin, teamCode],
  );
  const update = (patch: Partial<PlayersState>) => setState((s) => ({ ...s, ...patch }));
  const seasonLabel = seasons.find((s) => s.seasonCode === shownSeason)?.seasonLabel ?? String(shownSeason);

  return (
    <>
      <SiteNav seasons={seasons} seasonCode={state.season} view="players" onSeasonChange={(c) => update({ season: c })} wide />
      <main className="mx-auto max-w-5xl px-4 pt-5">
        <header className="mb-3">
          <h1 className="text-xl font-bold tracking-tight">선수</h1>
          <p className="mt-1 text-sm text-ink-2">1997년부터 모든 KBL 선수를 이름으로 찾거나, 시즌별로 둘러보세요.</p>
        </header>

        <PlayerSearch size="lg" autoFocusDesktop label="선수 이름으로 찾기" placeholder="선수 이름 (한글·영문, 예: 워니)" className="w-full" />

        <section aria-label="선수 필터" className="mt-5 space-y-2.5">
          <div>
            <h2 className="mb-1.5 text-xs font-semibold text-ink-2">시즌</h2>
            <ChipRow
              label="시즌"
              scroll
              chips={seasons.map((s) => ({ value: s.seasonCode, label: seasonShortLabel(s.seasonLabel) }))}
              value={state.season}
              onChange={(v) => update({ season: v })}
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2.5">
            <div>
              <h2 className="mb-1.5 text-xs font-semibold text-ink-2">포지션</h2>
              <ChipRow
                label="포지션"
                chips={POSITION_FILTERS.map((f) => ({ value: f, label: positionFilterLabel(f) }))}
                value={state.position}
                onChange={(v) => update({ position: v })}
              />
            </div>
            <div>
              <h2 className="mb-1.5 text-xs font-semibold text-ink-2">국적</h2>
              <ChipRow
                label="국적"
                chips={NATIONALITY_FILTERS.map((f) => ({ value: f, label: nationalityFilterLabel(f) }))}
                value={state.origin}
                onChange={(v) => update({ origin: v })}
              />
            </div>
          </div>
          <div>
            <h2 className="mb-1.5 text-xs font-semibold text-ink-2">팀</h2>
            <ChipRow
              label="팀"
              scroll
              chips={[
                { value: "", label: "전체" },
                ...teams.map((t) => ({
                  value: t.teamCode,
                  label: (
                    <>
                      <TeamLogo logoUrl={t.logoUrl} shortName={t.shortName} color={t.color} size={20} />
                      {teamShortLabel(t.shortName)}
                    </>
                  ),
                  aria: t.shortName,
                })),
              ]}
              value={teamCode ?? ""}
              onChange={(v) => update({ teamCode: v || null })}
            />
          </div>
        </section>

        <section aria-labelledby="grid-title" className="mt-5" aria-busy={status === "loading" || undefined}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="grid-title" className="text-base font-bold">
              {seasonShortLabel(seasonLabel)} 시즌 선수 <span className="font-normal text-ink-3">{shown.length}명</span>
            </h2>
            <p className="text-xs text-ink-3">
              종합 등급 높은 순 → 같은 등급은 PER 순 <InfoLink term="percentileGrade" />
            </p>
          </div>
          {status === "loading" && (
            <p role="status" className="mb-2 text-sm font-semibold text-ink-2">
              시즌 기록 불러오는 중…
            </p>
          )}
          {status === "error" && (
            <p role="alert" className="mb-2 text-sm text-ink-2">
              시즌 기록을 불러오지 못했습니다. 시즌을 다시 눌러 주세요.
            </p>
          )}
          {shown.length > 0 ? (
            <ul className={`grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 ${status === "loading" ? "opacity-50" : ""}`}>
              {shown.map((e) => (
                <li key={e.player.id} className="min-w-0">
                  <GridCard e={e} team={teamByCode.get(e.player.teamCode)} seasonCode={shownSeason} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-line bg-surface px-4 py-8 text-center text-sm text-ink-2">
              조건에 맞는 선수가 없습니다. 포지션·국적·팀 선택을 바꿔 보세요.
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-ink-3">
            종합 등급은 그 시즌 리그 전체({cards ? qualifyLabel(cards.defaults.rule) : "표본 기준"} 출전 선수) 안에서 레이더 5개 축 백분위
            평균을 S~F로 바꾼 값입니다. 기준에 못 미친 선수는 “표본 미달”로 맨 뒤에 둡니다. 포지션·국적은 KBL 선수 등록 정보 기준입니다.
          </p>
        </section>
      </main>
    </>
  );
}
