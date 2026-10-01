// 홈 "이번 시즌 한눈에" (PLAN.md §2-4, §3 ⑤, §5-4). 서버 컴포넌트 — 계산은 app/page.tsx 가 lib/ 함수로 끝내고 결과만 받는다.
// 구성(모바일 우선): 개막 전 안내 → 히어로(득점 1위 표지) → 부문별 1~3위 카드 줄 → 바로가기(큰 버튼 선수·순위표 + 링크 줄 팀 분포·비교·용어) → 시즌 목록.
import Link from "next/link";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import type { CardTeam, LeaderPlayer, SeasonOption, TeamColor } from "@/lib/types";
import { formatStat, LEADER_STATS, type LeaderEntry, type LeaderStatKey } from "@/lib/leaders";
import { HOME_UNITS } from "@/lib/home";
import { seasonShortLabel } from "@/lib/career";
import { mixHex, teamShortLabel } from "@/lib/images";
import { playerHref } from "@/lib/cardview";
import { nationalityOf, NATIONALITY_LABELS, positionLabel } from "@/lib/roster";
import { IconArrowRight, IconChevronDown, IconChevronRight } from "./icons";
import PlayerAvatar from "./PlayerAvatar";
import TeamLogo from "./TeamLogo";

const GRAY: TeamColor = FALLBACK_TEAM_COLOR;

export interface HomeCategory {
  key: LeaderStatKey;
  entries: LeaderEntry<LeaderPlayer>[];
}

interface Props {
  season: SeasonOption;
  fetchedLabel: string;
  /** 개막 전이면 그 시즌 (코드표 최신 시즌) */
  upcoming: SeasonOption | null;
  categories: HomeCategory[];
  teams: CardTeam[];
  qualifyText: string;
  recentSeasons: SeasonOption[];
  olderSeasons: SeasonOption[];
}

/** 순위표 부문 링크 (득점은 기본 부문이라 쿼리 없음 — lib/leaders DEFAULT_CATEGORY) */
const leadersHref = (code: number, key: LeaderStatKey) => `/season/${code}/leaders${key === "points" ? "" : `?cat=${key}`}`;

export default function HomeView({ season, fetchedLabel, upcoming, categories, teams, qualifyText, recentSeasons, olderSeasons }: Props) {
  const teamByCode = new Map(teams.map((t) => [t.teamCode, t]));
  const code = season.seasonCode;
  const short = seasonShortLabel(season.seasonLabel);
  const scoring = categories.find((c) => c.key === "points")?.entries[0] ?? null;

  // 큰 버튼 2개(자주 가는 화면) + 작은 링크 줄 — 같은 카드 6칸 반복을 없앤다 (디자인 점검 A7)
  const primary = [
    { href: "/players", title: "선수", desc: "이름 검색, 포지션·팀별 선수 카드" },
    { href: `/season/${code}/leaders`, title: "순위표", desc: `${short} 부문별 전체 순위` },
  ];
  const secondary = [
    { href: `/season/${code}/teams`, title: "팀 분포" },
    { href: "/compare", title: "비교" },
    { href: "/records", title: "역대 기록" },
    { href: "/glossary", title: "용어" },
  ];

  return (
    <main className="pb-2">
      {upcoming && (
        <p className="border-b border-line bg-surface-2 px-4 py-2 text-center text-sub font-semibold text-ink-2">
          {seasonShortLabel(upcoming.seasonLabel)} 개막 전 · 직전 시즌({short}) 기록을 보여 줍니다
        </p>
      )}

      <div className="mx-auto max-w-5xl px-4 pt-5">
        <p className="text-sub font-medium text-ink-3">
          KBL 정규시즌 · 기록 갱신 {fetchedLabel}
        </p>
        <h1 className="mt-0.5 text-h1 font-black">{short} 시즌 한눈에</h1>
      </div>

      {scoring && <Hero entry={scoring} team={teamByCode.get(scoring.player.teamCode)} seasonCode={code} />}

      {/* 부문별 1~3위 */}
      <section aria-labelledby="leaders-title" className="mx-auto mt-8 max-w-5xl px-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="leaders-title" className="text-h2 font-bold">
            부문별 1~3위
          </h2>
          <p className="text-sub text-ink-3">경기당 · {qualifyText}</p>
        </div>
        <ul className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
          {categories.map((c) => (
            <li key={c.key} className="w-[15.5rem] shrink-0 snap-start md:w-auto">
              <LeaderCard category={c} seasonCode={code} teamByCode={teamByCode} />
            </li>
          ))}
        </ul>
        <p className="mt-1 flex items-center gap-1 text-sub text-ink-3 md:hidden">
          옆으로 밀어 {categories.length}개 부문 보기 <IconArrowRight size={16} />
        </p>
      </section>

      {/* 화면 바로가기: 큰 버튼 2개 + 작은 링크 줄 */}
      <section aria-labelledby="screens-title" className="mx-auto mt-8 max-w-5xl px-4">
        <h2 id="screens-title" className="text-h2 font-bold">
          바로가기
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {primary.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className={BIG_BUTTON}>
                <span className="flex items-center gap-1 text-lg font-bold text-ink">
                  {s.title} <IconChevronRight size={20} />
                </span>
                <span className="mt-1 text-sub text-ink-2">{s.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
        <ul className="mt-2 flex flex-wrap items-center gap-x-1 text-body">
          {secondary.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="focus-ring inline-flex h-11 items-center gap-0.5 rounded-control px-2 font-semibold text-ink-2 underline-offset-4 transition-colors duration-200 hover:text-ink hover:underline"
              >
                {s.title}
                <IconChevronRight size={16} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 시즌 목록 → 순위표 */}
      <section aria-labelledby="seasons-title" className="mx-auto mt-8 max-w-5xl px-4">
        <h2 id="seasons-title" className="text-h2 font-bold">
          시즌별 순위표
        </h2>
        <SeasonChips seasons={recentSeasons} className="mt-3" />
        {olderSeasons.length > 0 && (
          <details className="group mt-2">
            <summary className="focus-ring inline-flex h-10 cursor-pointer list-none items-center gap-1 rounded-control text-body font-semibold text-ink-2 transition-colors duration-200 hover:text-ink [&::-webkit-details-marker]:hidden">
              전체 보기 ({olderSeasons.length}개 시즌 더)
              <IconChevronDown size={16} className="transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <SeasonChips seasons={olderSeasons} className="mt-2" />
          </details>
        )}
      </section>
    </main>
  );
}

const BIG_BUTTON =
  "focus-ring flex h-full min-h-24 w-full flex-col justify-between surface-card rounded-container p-4 text-left transition-colors duration-200 hover:bg-surface-2";

function SeasonChips({ seasons, className = "" }: { seasons: SeasonOption[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`}>
      {seasons.map((s) => (
        <li key={s.seasonCode}>
          <Link
            href={`/season/${s.seasonCode}/leaders`}
            className="focus-ring inline-flex h-10 items-center rounded-control border border-line bg-surface px-3 text-body font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
          >
            {seasonShortLabel(s.seasonLabel)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** 표지: 득점 1위 — 팀 색 배경 + 큰 세로 사진 */
function Hero({ entry, team, seasonCode }: { entry: LeaderEntry<LeaderPlayer>; team?: CardTeam; seasonCode: number }) {
  const p = entry.player;
  const color = team?.color ?? GRAY;
  const teamName = team?.shortName ?? p.teamShort;
  const mid = mixHex(color.primary, "#000000", 0.3);
  const dark = mixHex(color.primary, "#000000", 0.62);
  const value = formatStat(entry.value, "points", "perGame");
  return (
    <section aria-label={`득점 1위 ${p.nameKo}`} className="mx-auto mt-3 max-w-5xl sm:px-4">
      <div
        className="relative overflow-hidden sm:rounded-container"
        style={{ background: `linear-gradient(155deg, ${color.primary} 0%, ${mid} 55%, ${dark} 100%)`, color: color.text }}
      >
        {/* 장식: 팀 약칭 큰 글씨 (선수 페이지 머리말과 같은 방식) */}
        <span
          aria-hidden
          // deslop-ignore-next-line 11
          className="pointer-events-none absolute -right-3 top-2 select-none whitespace-nowrap text-[7.5rem] font-black leading-none tracking-tighter opacity-10 sm:text-[11rem]"
        >
          {teamShortLabel(teamName, 5)}
        </span>
        <div className="relative flex min-h-[260px] items-end px-4 sm:min-h-[320px] sm:px-8">
          <div className="relative z-10 min-w-0 flex-1 pb-5 pt-5">
            <p className="inline-flex rounded-control px-2.5 py-1 text-sub font-bold" style={{ background: "rgba(0,0,0,0.25)" }}>
              득점 1위
            </p>
            {/* deslop-ignore-next-line 11 */}
            <h2 className="mt-3 text-[2.1rem] font-black leading-[1.05] tracking-tight [overflow-wrap:anywhere] sm:text-6xl">
              <Link href={`/player/${p.id}`} className="focus-ring rounded-control underline-offset-4 hover:underline">
                {p.nameKo}
              </Link>
            </h2>
            <p className="mt-2 flex items-center gap-1.5 text-body font-semibold opacity-90">
              <span className="inline-flex rounded-control bg-white p-0.5">
                <TeamLogo logoUrl={team?.logoUrl} shortName={teamName} color={color} size={20} />
              </span>
              {teamShortLabel(teamName)}
              {positionLabel(p.position) ? ` · ${positionLabel(p.position)}` : ""} · {NATIONALITY_LABELS[nationalityOf(p)]}
            </p>
            <p className="tabular mt-4 leading-none">
              {/* deslop-ignore-next-line 11 */}
              <span className="text-5xl font-black tracking-tight sm:text-6xl">{value}</span>
              <span className="ml-1 text-lg font-bold">점</span>
            </p>
            <p className="mt-1.5 text-body font-semibold opacity-90">경기당 {value}점 · 득점 1위</p>
            <Link
              href={playerHref(p.id, seasonCode)}
              className="focus-ring mt-4 inline-flex h-11 items-center gap-1 rounded-control bg-white px-4 text-body font-bold text-[#0b0b0b] transition-colors duration-200 hover:bg-white/85"
            >
              선수 카드 보기 <IconChevronRight size={16} />
            </Link>
          </div>
          <div className="relative -mr-3 shrink-0 self-end sm:mr-0">
            <span className="sm:hidden">
              <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={color} variant="portrait" size={220} />
            </span>
            <span className="hidden sm:inline">
              <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={color} variant="portrait" size={310} />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function LeaderCard({
  category,
  seasonCode,
  teamByCode,
}: {
  category: HomeCategory;
  seasonCode: number;
  teamByCode: Map<string, CardTeam>;
}) {
  const def = LEADER_STATS[category.key];
  const unit = HOME_UNITS[category.key] ?? "";
  return (
    <article className="surface-card tabular h-full rounded-container p-3">
      <h3 className="flex items-center justify-between">
        <Link
          href={leadersHref(seasonCode, category.key)}
          className="focus-ring -ml-1 inline-flex h-10 items-center gap-0.5 rounded-control px-1 text-body font-bold text-ink underline-offset-4 transition-colors duration-200 hover:underline"
        >
          {def.label}
          <IconChevronRight size={16} />
        </Link>
        <span className="text-caption text-ink-3">경기당</span>
      </h3>
      {category.entries.length === 0 ? (
        <p className="mt-3 text-sub text-ink-3">기준을 채운 선수가 없습니다</p>
      ) : (
        <ol className="mt-1">
          {category.entries.map((e) => {
            const t = teamByCode.get(e.player.teamCode);
            return (
              <li key={e.player.id}>
                {/* 한 줄 전체가 선수 페이지 링크 (누르는 영역 48px 이상, 디자인 점검 C1) */}
                <Link
                  href={`/player/${e.player.id}`}
                  className="focus-ring -mx-1 flex min-h-12 min-w-0 items-center gap-2 rounded-control px-1 transition-colors duration-200 hover:bg-surface-2"
                >
                  <span className={`w-4 shrink-0 text-center text-sub ${e.rank === 1 ? "font-black text-ink" : "font-semibold text-ink-3"}`}>
                    {e.rank}
                  </span>
                  <PlayerAvatar photoUrl={e.player.photoUrl} nameKo={e.player.nameKo} color={t?.color} size={e.rank === 1 ? 40 : 32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold leading-tight text-ink">{e.player.nameKo}</span>
                    <span className="block truncate text-caption text-ink-3">
                      {teamShortLabel(t?.shortName ?? e.player.teamShort)}
                      {e.player.position ? ` · ${positionLabel(e.player.position)}` : ""}
                    </span>
                  </span>
                  <span className={`shrink-0 font-bold tracking-tight text-ink ${e.rank === 1 ? "text-lg" : "text-body"}`}>
                    {formatStat(e.value, category.key, "perGame")}
                    <span className="ml-0.5 text-caption font-medium text-ink-3">{unit}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}
