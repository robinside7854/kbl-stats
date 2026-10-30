"use client";
// 선수 탭 (/players): 큰 검색창 → 필터 버튼(등급·점수대·포지션·국적·팀·출신교·칭호, FilterSheet) → 그 시즌 선수 그리드(작은 카드, 20장씩 "더 보기").
// 시즌은 상단 SiteNav 시즌 선택만(본문 시즌 칩 없음), 상단 검색은 숨긴다 — 디자인 점검 A2~A5.
// - 정적 HTML은 최신 시즌으로 그린다(서버가 넣어 준 시즌 카드 파일 initialFile).
// - 다른 시즌을 고르면 우리 정적 파일 /cards/{코드}.json 을 받아 같은 계산으로 다시 그린다 (useSeasonCards —
//   KBL 서버가 아니라 우리 public/ 파일이므로 원칙 1 위반 아님).
// - 종합 등급·정렬·필터는 lib/cardview(buildGridEntries·sortGridEntries·filterGridEntries) — 여기서는 계산하지 않는다.
// - 상태는 주소 ?season=&pos=&origin=&team=&badge=&school=&grade=&score=&sort=&dir=asc 에 남긴다. 나열 순서 버튼을 한 번 더 누르면 반대 순서(2026-10-30). 등급·점수대 칩과 등급순/점수순/득점순(2026-10-21). 칭호(badge)는 통산 칭호로 거르기(2026-10-01). 시즌은 상단 SiteNav 의 시즌 선택이 onSeasonChange 로 바꾼다.
// - 카드에 칭호 배지 1개(통산 기준 우선순위 1번, 서버가 넘긴 topBadges — lib/badges).
// - 카드를 누르면 그 선수 상세의 그 시즌 카드로 (/player/번호?season=코드).
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SeasonCardsFile } from "@/lib/cards";
import type { CardTeam, SeasonOption } from "@/lib/types";
import {
  buildGridEntries,
  clearGridFilter,
  filterGridEntries,
  formatCardValue,
  GRID_PAGE_SIZE,
  gridFilterChips,
  GRID_GRADES,
  GRID_SORTS,
  parsePlayersQuery,
  playerHref,
  playersQueryString,
  SCORE_BANDS,
  scoreBandOf,
  sortGridBy,
  type GridEntry,
  type GridSort,
  type PlayersState,
} from "@/lib/cardview";
import { seasonShortLabel } from "@/lib/career";
import { qualifyLabel, type Grade } from "@/lib/metrics";
import { teamShortLabel } from "@/lib/images";
import { takeFirst } from "@/lib/leaders";
import {
  NATIONALITY_FILTERS,
  nationalityFilterLabel,
  nationalityOf,
  NATIONALITY_LABELS,
  POSITION_FILTERS,
  positionFilterLabel,
  positionLabel,
} from "@/lib/roster";
import { BADGE_CHIP, badgeStyle } from "./BadgeRow";
import { BADGE_DEFS } from "@/lib/badges";
import { SCHOOL_ABROAD } from "@/lib/roster";

const badgeDef = (key: string) => BADGE_DEFS.find((d) => d.key === key);
import ChipRow from "./ChipRow";
import MoreChipRow from "./MoreChipRow";
import FilterSheet, { FilterGroup } from "./FilterSheet";
import { IconChevronDown, IconChevronUp } from "./icons";
import InfoLink from "./InfoLink";
import PlayerAvatar from "./PlayerAvatar";
import PlayerSearch from "./PlayerSearch";
import Skeleton from "./Skeleton";
import Segmented from "./Segmented";
import SiteNav from "./SiteNav";
import TeamLogo from "./TeamLogo";
import { primeSeasonCards, useSeasonCards } from "./useSeasonCards";
import { useThemeColors, type ThemeColors } from "./useThemeColors";
import { FALLBACK_TEAM_COLOR, gradeTone } from "@/lib/teams";
import { trackFilters } from "./track";

interface Props {
  /** 선수가 있는 시즌 (최신이 먼저) */
  seasons: SeasonOption[];
  latest: number;
  /** 최신 시즌 카드 파일 (public/cards 와 같은 내용) — 정적 HTML용 */
  initialFile: SeasonCardsFile;
  /** 선수 번호 → 우선순위 1번 칭호 배지 라벨 (배지 없는 선수는 없음). 통산 기준이라 어느 시즌 그리드든 같다 */
  topBadges: Record<string, string>;
  /** 선수 번호 → 칭호 배지 키 전부 ("칭호로 찾기" 필터, 2026-10-01 — 2KRatings 배지 필터 참고) */
  badgeKeys: Record<string, string[]>;
  /** 선수 번호 → 출신교 묶음 이름 ("출신교" 필터, 2026-10-02) */
  schools: Record<string, string>;
}

/**
 * 종합 등급 배지 — 플레이어 카드와 같은 색 규칙(lib/teams gradeTone: S 금색, A·B 팀 색, C 이하 무채색).
 * 2026-10-21 사용자: 크게 키웠더니 이름보다 커서 과함 → 이름(본문)보다 한 단계 큰 정도로 (등급 18px·점수 13px).
 */
function GradeBadge({ grade, score, team, colors }: { grade: Grade | "-"; score: number | null; team?: CardTeam; colors: ThemeColors }) {
  if (grade === "-") {
    return <span className="inline-flex h-7 items-center rounded-control bg-surface px-1.5 text-caption font-semibold leading-none text-ink-2">표본 미달</span>;
  }
  const tone = gradeTone(grade, team?.color ?? FALLBACK_TEAM_COLOR, colors);
  return (
    <span
      className="tabular inline-flex h-7 shrink-0 items-baseline gap-0.5 rounded-control border px-1.5 pt-[5px] font-black leading-none lg:h-8 lg:pt-1.5"
      style={{ background: tone.bg, color: tone.ink, borderColor: tone.border }}
      aria-label={`종합 등급 ${grade}${score !== null ? ` ${score}점` : ""}`}
    >
      {/* deslop-ignore-next-line 11 */}
      <span className="text-[18px] lg:text-[19px]">{grade}</span>
      {/* deslop-ignore-next-line 11 */}
      {score !== null && <span className="text-[13px] font-bold">{score}</span>}
    </span>
  );
}

/** 카드 아래 기록 한 칸 */
function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex min-w-0 flex-col items-center gap-0.5 py-1.5">
      <span className="text-caption leading-none text-ink-3">{label}</span>
      <span className="text-body font-bold leading-none tracking-tight text-ink">{formatCardValue(value, false)}</span>
    </span>
  );
}

/**
 * 선수 카드 (2026-10-21 디자인 개편): 위 = 팀 색 옅은 띠(왼쪽 팀 로고·등급·포지션(한글), 오른쪽 큰 세로 사진),
 * 아래 = 이름·팀·국적 → 칭호 → 경기당 득점·리바·어시 세 칸. 사진·로고·포지션·등급을 먼저 보이게, 빈 곳은 기록으로 채운다.
 */
function GridCard({ e, team, seasonCode, colors, badge, sort }: { e: GridEntry; team?: CardTeam; seasonCode: number; colors: ThemeColors; badge?: string; sort: GridSort }) {
  const p = e.player;
  const pos = positionLabel(p.position);
  const color = team?.color ?? FALLBACK_TEAM_COLOR;
  const nat = p.nationality && p.nationality !== "domestic" ? NATIONALITY_LABELS[nationalityOf(p)] : null;
  return (
    <Link
      href={playerHref(p.id, seasonCode)}
      className="focus-ring surface-card tabular flex h-full min-w-0 flex-col overflow-hidden rounded-container transition-colors duration-200 hover:bg-surface-2"
      aria-label={`${p.nameKo}, ${team?.shortName ?? p.teamShort}${pos ? `, ${pos}` : ""}${badge ? `, 칭호 ${badge}` : ""}, 종합 등급 ${e.overall === "-" ? "표본 미달" : `${e.overall} ${e.score ?? ""}점`}, 경기당 득점 ${formatCardValue(e.ppg, false)}`}
    >
      {/* 팀 색 띠: 바탕은 팀 색을 옅게 섞고 아래에 진한 팀 색 선 */}
      <span
        className="relative block h-[120px] shrink-0 border-b-[3px] lg:h-[132px]"
        style={{ background: `color-mix(in srgb, ${color.primary} 15%, var(--surface))`, borderColor: color.primary }}
      >
        <span className="absolute bottom-0 right-1 flex">
          {/* 사진이 없을 때 실루엣·이니셜은 회색으로 (옅은 팀 색 바탕 위) */}
          <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={{ ...color, text: "var(--ink-3)" }} variant="portrait" size={112} />
        </span>
        <span className="absolute left-2 top-2 flex flex-col items-start gap-1.5">
          <span className="inline-flex rounded-control bg-white p-1 shadow-card">
            <TeamLogo logoUrl={team?.logoUrl} shortName={team?.shortName ?? p.teamShort} color={team?.color} size={22} />
          </span>
          <GradeBadge grade={e.overall} score={e.score} team={team} colors={colors} />
          {pos && (
            // 포지션은 한글로 (2026-10-21 사용자: 영어 C·F 는 등급처럼 읽힌다) — 등급 배지와 다른 흰 바탕 테두리 칩
            <span className="inline-flex h-6 items-center whitespace-nowrap rounded-control border border-line bg-surface px-1.5 text-caption font-semibold leading-none text-ink">
              {pos}
            </span>
          )}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col px-3 pb-1 pt-2">
        <span className="truncate text-body font-bold leading-tight text-ink">{p.nameKo}</span>
        <span className="mt-0.5 truncate text-caption text-ink-2">
          {teamShortLabel(team?.shortName ?? p.teamShort)}
          {nat ? ` · ${nat}` : ""}
          {/* 키순·나이순이면 그 값 (2026-10-30) */}
          {sort === "height" && p.heightCm ? ` · ${p.heightCm}cm` : ""}
          {sort === "age" && p.birthday ? ` · ${p.birthday.slice(0, 4)}년생` : ""}
        </span>
        {badge && (
          <span className="mt-1.5 flex">
            <span className={`${BADGE_CHIP} h-6 max-w-full truncate px-1.5 text-caption`} style={badgeStyle(color.primary)}>
              {badge}
            </span>
          </span>
        )}
        <span className="mt-auto grid grid-cols-3 divide-x divide-line border-t border-line pt-0.5" aria-hidden>
          <MiniStat label="득점" value={e.ppg} />
          <MiniStat label="리바" value={e.rpg} />
          <MiniStat label="어시" value={e.apg} />
        </span>
      </span>
    </Link>
  );
}

export default function PlayersView({ seasons, latest, initialFile, topBadges, badgeKeys, schools }: Props) {
  const colors = useThemeColors();
  const initialCards = useMemo(() => primeSeasonCards(initialFile), [initialFile]);
  const [state, setState] = useState<PlayersState>({ season: latest, position: "all", origin: "all", teamCode: null, badge: null, school: null, grade: null, scoreBand: null, sort: "grade", asc: false });
  const [limit, setLimit] = useState(GRID_PAGE_SIZE);
  const seasonCodes = useMemo(() => seasons.map((s) => s.seasonCode), [seasons]);

  useEffect(() => {
    setState(parsePlayersQuery(window.location.search, { seasons: seasonCodes, latest }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${playersQueryString(state, latest)}`);
    // 시즌·필터가 바뀌면 처음 20장으로
    setLimit(GRID_PAGE_SIZE);
  }, [state, latest]);

  const { cards, status } = useSeasonCards(state.season, initialCards);
  const shownSeason = cards?.seasonCode ?? state.season;
  const teams = cards?.teams ?? [];
  const teamByCode = useMemo(() => new Map(teams.map((t) => [t.teamCode, t])), [teams]);
  // 이 시즌에 없는 팀이면 전체로 본다 (시즌을 바꿨을 때)
  const teamCode = state.teamCode && teamByCode.has(state.teamCode) ? state.teamCode : null;

  const all = useMemo(() => (cards ? buildGridEntries(cards) : []), [cards]);
  // 등급·점수대 칩 인원 (이 시즌 전원 기준 — 칭호·출신교 칩과 같다)
  const gradeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of all) if (e.overall !== "-") m.set(e.overall, (m.get(e.overall) ?? 0) + 1);
    return m;
  }, [all]);
  const bandCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of all) {
      const b = scoreBandOf(e.score);
      if (b) m.set(b, (m.get(b) ?? 0) + 1);
    }
    return m;
  }, [all]);
  // 칭호 칩: 이 시즌 선수(표본 미달 포함) 가운데 그 칭호를 가진 선수가 있는 것만, BADGE_DEFS 순서. 고른 칭호가 없으면 전체로 본다
  const badgeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of all) for (const k of badgeKeys[e.player.id] ?? []) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  }, [all, badgeKeys]);
  const badgeOptions = BADGE_DEFS.filter((d) => badgeCounts.has(d.key));
  const badge = state.badge && badgeCounts.has(state.badge) ? state.badge : null;
  // 출신교 칩: 이 시즌 선수의 출신교 묶음, 인원 많은 순 (국내 학교 먼저, "해외"는 맨 뒤). 고른 학교가 없으면 전체
  const schoolCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of all) {
      const g = schools[e.player.id];
      if (g) m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  }, [all, schools]);
  const schoolOptions = [...schoolCounts.entries()]
    .sort((a, b) => Number(a[0] === SCHOOL_ABROAD) - Number(b[0] === SCHOOL_ABROAD) || b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .map(([name, n]) => ({ name, n }));
  const school = state.school && schoolCounts.has(state.school) ? state.school : null;
  const filtered = useMemo(
    () =>
      filterGridEntries(
        sortGridBy(all, state.sort, state.asc),
        { position: state.position, origin: state.origin, teamCode, badge, school, grade: state.grade, scoreBand: state.scoreBand },
        (id) => badgeKeys[id] ?? [],
        (id) => schools[id] ?? null,
      ),
    [all, state.sort, state.asc, state.position, state.origin, teamCode, badge, badgeKeys, school, schools, state.grade, state.scoreBand],
  );
  const { shown, remaining } = takeFirst(filtered, limit);
  const update = (patch: Partial<PlayersState>) => {
    trackFilters("players", patch);
    setState((s) => ({ ...s, ...patch }));
  };
  // 나열 순서: 다른 버튼 = 그 순서(기본 방향), 지금 버튼을 한 번 더 = 반대 방향 (2026-10-30). GA4 sort 값은 반대면 "_asc" (54-0 표 정렬과 같은 꼴)
  const pickSort = (v: GridSort) => {
    const asc = v === state.sort ? !state.asc : false;
    trackFilters("players", { sort: asc ? `${v}_asc` : v });
    setState((s) => ({ ...s, sort: v, asc }));
  };
  const sortOptions = GRID_SORTS.map((o) =>
    o.value === state.sort
      ? {
          value: o.value,
          label: (
            <span className="inline-flex items-center gap-0.5">
              {o.label}
              {state.asc ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
              <span className="sr-only">{state.asc ? " (반대 순서, 다시 누르면 기본 순서)" : " (다시 누르면 반대 순서)"}</span>
            </span>
          ),
        }
      : o,
  );
  // 불러오는 동안 제목은 고른 시즌으로 (그리드는 스켈레톤)
  const headSeason = status === "loading" ? state.season : shownSeason;
  const seasonLabel = seasons.find((s) => s.seasonCode === headSeason)?.seasonLabel ?? String(headSeason);
  const chips = gridFilterChips(
    { position: state.position, origin: state.origin, teamCode, badge, school, grade: state.grade, scoreBand: state.scoreBand },
    (c) => teamShortLabel(teamByCode.get(c)?.shortName ?? c),
    (k) => badgeDef(k)?.label ?? k,
  ).map((c) => ({ key: c.field, label: c.label, onClear: () => setState((s) => clearGridFilter(s, c.field)) }));

  return (
    <>
      {/* 시즌은 상단 시즌 선택이 맡는다(본문 시즌 칩 없음), 검색은 본문 큰 검색창 하나 (디자인 점검 A4·A5) */}
      <SiteNav seasons={seasons} seasonCode={state.season} view="players" onSeasonChange={(c) => update({ season: c })} wide hideSearch />
      <main className="mx-auto max-w-page px-4 pt-5">
        <h1 className="mb-3 text-h1 font-bold">선수</h1>

        <PlayerSearch size="lg" label="선수 이름으로 찾기" placeholder="선수 이름 (한글·영문, 예: 워니)" className="w-full" />

        <section aria-label="필터" className="mt-4">
          <FilterSheet
            chips={chips}
            onReset={() => update({ position: "all", origin: "all", teamCode: null, badge: null, school: null, grade: null, scoreBand: null })}
            resultText={`${filtered.length}명 보기`}
            trailing={`${filtered.length}명`}
          >
            <FilterGroup label="종합 등급" hint="표본 기준에 못 미친 선수는 등급이 없어 빠집니다">
              <ChipRow
                label="종합 등급"
                chips={[
                  { value: "", label: "전체" },
                  ...GRID_GRADES.filter((g) => gradeCounts.has(g)).map((g) => ({ value: g, label: `${g} ${gradeCounts.get(g)}`, aria: `${g}등급 ${gradeCounts.get(g)}명` })),
                ]}
                value={state.grade ?? ""}
                onChange={(v) => update({ grade: (v || null) as PlayersState["grade"] })}
              />
            </FilterGroup>
            <FilterGroup label="종합 점수">
              <ChipRow
                label="종합 점수"
                chips={[
                  { value: "", label: "전체" },
                  ...SCORE_BANDS.filter((b) => bandCounts.has(b.value)).map((b) => ({ value: b.value, label: `${b.label} ${bandCounts.get(b.value)}`, aria: `${b.label} ${bandCounts.get(b.value)}명` })),
                ]}
                value={state.scoreBand ?? ""}
                onChange={(v) => update({ scoreBand: (v || null) as PlayersState["scoreBand"] })}
              />
            </FilterGroup>
            <FilterGroup label="포지션" hint="GF는 가드, FC는 포워드로 묶습니다">
              <Segmented
                label="포지션"
                options={POSITION_FILTERS.map((f) => ({ value: f, label: positionFilterLabel(f) }))}
                value={state.position}
                onChange={(v) => update({ position: v })}
              />
            </FilterGroup>
            <FilterGroup label="국적">
              <Segmented
                label="국적"
                options={NATIONALITY_FILTERS.map((f) => ({ value: f, label: nationalityFilterLabel(f) }))}
                value={state.origin}
                onChange={(v) => update({ origin: v })}
              />
            </FilterGroup>
            <FilterGroup label="팀">
              <ChipRow
                label="팀"
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
            </FilterGroup>
            {schoolOptions.length > 0 && (
              <FilterGroup label="출신교" hint="외국·아시아쿼터 선수와 해외 학교는 '해외'로 묶습니다">
                <MoreChipRow
                  label="출신교"
                  chips={[
                    { value: "", label: "전체" },
                    ...schoolOptions.map((o) => ({ value: o.name, label: `${o.name} ${o.n}`, aria: `${o.name} ${o.n}명` })),
                  ]}
                  value={school ?? ""}
                  onChange={(v) => update({ school: v || null })}
                />
              </FilterGroup>
            )}
            {badgeOptions.length > 0 && (
              <FilterGroup label="칭호" hint="통산 기준 칭호 (예: 득점왕은 한 번이라도 경기당 득점 1위)">
                <MoreChipRow
                  label="칭호"
                  chips={[
                    { value: "", label: "전체" },
                    ...badgeOptions.map((d) => ({ value: d.key, label: `${d.label} ${badgeCounts.get(d.key)}`, aria: `${d.label} ${badgeCounts.get(d.key)}명` })),
                  ]}
                  value={badge ?? ""}
                  onChange={(v) => update({ badge: v || null })}
                />
              </FilterGroup>
            )}
          </FilterSheet>
        </section>

        <section aria-labelledby="grid-title" className="mt-5" aria-busy={status === "loading" || undefined}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="grid-title" className="text-h2 font-bold">
              {seasonShortLabel(seasonLabel)} 시즌 선수 {status !== "loading" && <span className="font-normal text-ink-3">{filtered.length}명</span>}
            </h2>
            {/* 나열 순서가 다섯 개라(2026-10-30 키순·나이순) 폰에서는 제목 아래 한 줄 — 넘치면 이 줄만 옆으로 민다 */}
            <div className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:px-0 [&_button]:shrink-0 [&_button]:whitespace-nowrap">
              <Segmented label="나열 순서" options={sortOptions} value={state.sort} onChange={pickSort} />
              <InfoLink term="percentileGrade" />
            </div>
          </div>
          {status === "loading" && (
            <p role="status" className="sr-only">
              시즌 기록 불러오는 중
            </p>
          )}
          {status === "error" && (
            <p role="alert" className="mb-2 text-body text-ink-2">
              시즌 기록을 불러오지 못했습니다. 시즌을 다시 골라 주세요.
            </p>
          )}
          {status === "loading" ? (
            // 다른 시즌을 받는 동안: 그리드 모양 그대로 스켈레톤 (디자인 점검 C3)
            <ul aria-hidden className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: Math.min(GRID_PAGE_SIZE, Math.max(shown.length, 10)) }, (_, i) => (
                <li key={i} className="surface-card flex h-[232px] flex-col overflow-hidden rounded-container lg:h-[244px]">
                  <Skeleton className="h-[120px] w-full rounded-none lg:h-[132px]" />
                  <Skeleton className="mx-3 mt-3 h-4 w-20" />
                  <Skeleton className="mx-3 mt-1.5 h-3.5 w-24" />
                  <Skeleton className="mx-3 mb-3 mt-auto h-8" />
                </li>
              ))}
            </ul>
          ) : shown.length > 0 ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {shown.map((e) => (
                <li key={e.player.id} className="min-w-0">
                  <GridCard e={e} team={teamByCode.get(e.player.teamCode)} seasonCode={shownSeason} colors={colors} badge={badge ? badgeDef(badge)?.label : topBadges[e.player.id]} sort={state.sort} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="surface-card rounded-container px-4 py-8 text-center">
              <p className="text-body font-semibold text-ink">조건에 맞는 선수가 없습니다</p>
              <p className="mt-1 text-sub text-ink-2">등급·점수·포지션·국적·팀 같은 조건을 하나 풀어 보세요.</p>
              <button
                type="button"
                onClick={() => update({ position: "all", origin: "all", teamCode: null, badge: null, school: null, grade: null, scoreBand: null })}
                className="focus-ring mt-4 h-11 rounded-control border border-line bg-surface px-4 text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
              >
                필터 초기화
              </button>
            </div>
          )}
          {remaining > 0 && status !== "loading" && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + GRID_PAGE_SIZE)}
              className="focus-ring mt-3 flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-control border border-line bg-surface text-body font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
            >
              더 보기 <span className="font-normal text-ink-3">(남은 {remaining}명)</span>
              <IconChevronDown size={16} />
            </button>
          )}
          <p className="mt-3 text-sub leading-relaxed text-ink-3">
            종합 등급은 그 시즌 {cards ? qualifyLabel(cards.defaults.rule) : "표본 기준"} 선수 중 같은 국적 집단(국내·아시아쿼터 / 외국) 안에서
            레이더 6축(공격·수비·리바운드·슈팅·리딩·효율)을 포지션별 가중치로 종합한 위치입니다 <InfoLink term="radarAxes" />. 기준에 못 미친 선수는 맨 뒤에 둡니다.
          </p>
        </section>
      </main>
    </>
  );
}
