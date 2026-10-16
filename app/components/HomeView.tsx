// 홈 "KBL 2026-2027 시즌" (옛 제목 "이번 시즌 한눈에") (PLAN.md §2-4, §3 ⑤, §5-4). 서버 컴포넌트 — 계산은 app/page.tsx 가 lib/ 함수로 끝내고 결과만 받는다.
// 구성(모바일 우선): 개막 전 안내 → 오늘의 경기(GameDayBoard, 2026-10-03 — 응원팀 경기 먼저, 다음 경기 팀 연승·연패) → 새로 나온 기록(RecentFeats, 2026-10-11) → 즐겨찾기(있을 때만) → 히어로(부문 1위 표지, 새로고침마다 부문이 바뀜 — HomeHero) → 오늘 생일 → 부문별 1~3위 카드 줄.
// 바로가기·시즌별 목록은 2026-10-01 사용자 요청으로 뺐다(상단 메뉴·시즌 선택과 겹침).
import Link from "next/link";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import type { CardTeam, LeaderPlayer, SeasonOption, TeamColor } from "@/lib/types";
import { formatStat, LEADER_STATS, type LeaderEntry, type LeaderStatKey } from "@/lib/leaders";
import { HOME_UNITS } from "@/lib/home";
import { seasonShortLabel } from "@/lib/career";
import { mixHex, teamShortLabel } from "@/lib/images";
import { playerHref } from "@/lib/cardview";
import { nationalityOf, NATIONALITY_LABELS, positionLabel } from "@/lib/roster";
import { IconArrowRight, IconChevronRight } from "./icons";
import PlayerAvatar from "./PlayerAvatar";
import TeamLogo from "./TeamLogo";
import BirthdayStrip, { type BirthdayPlayer } from "./BirthdayStrip";
import FavoritesStrip from "./FavoritesStrip";
import HomeHero, { type HeroItem } from "./HomeHero";
import GameDayBoard, { type GameTeamInfo } from "./GameDayBoard";
import { seasonTitle, type GameDay, type SeasonProgress } from "@/lib/games";
import SeasonProgressBar from "./SeasonProgressBar";
import RecentFeats from "./RecentFeats";
import type { RecentFeat } from "@/lib/notifications";

const GRAY: TeamColor = FALLBACK_TEAM_COLOR;

export interface HomeCategory {
  key: LeaderStatKey;
  entries: LeaderEntry<LeaderPlayer>[];
}

interface Props {
  season: SeasonOption;
  fetchedLabel: string;
  /** "10월 7일 경기까지 반영" (최근 경기일, lib/games asOfLabel) — 있으면 갱신 시각 대신 이 줄 */
  asOf?: string | null;
  /** 개막 전이면 그 시즌 (코드표 최신 시즌) */
  upcoming: SeasonOption | null;
  categories: HomeCategory[];
  teams: CardTeam[];
  qualifyText: string;
  /** 오늘 생일 후보 (현역 = 이 시즌 명단, 생년월일 있는 선수) */
  birthdays: BirthdayPlayer[];
  /** 끝난 경기가 있는 가장 최근 날짜 (없으면 null — 개막 전·경기 목록 없음) */
  gameDay?: GameDay | null;
  nextGameDay?: GameDay | null;
  gameTeams?: Record<string, GameTeamInfo>;
  /** 정규시즌 진행률 (진행 중 시즌만, 아니면 null) */
  progress?: SeasonProgress | null;
  /** 최근 7일 대기록 (lib/data loadRecentFeats) */
  feats?: RecentFeat[];
  /** 팀 코드 → 2경기 이상 연승·연패 (다음 경기 줄에 표시) */
  streaks?: Record<string, { label: string; kind: "W" | "L" }>;
  /** 아직 안 한 경기 홈 승리 확률 (lib/predict) */
  winProbs?: Record<string, number>;
}

/** 순위표 부문 링크 (득점은 기본 부문이라 쿼리 없음 — lib/leaders DEFAULT_CATEGORY) */
const leadersHref = (code: number, key: LeaderStatKey) => `/season/${code}/leaders${key === "points" ? "" : `?cat=${key}`}`;

export default function HomeView({ season, fetchedLabel, asOf = null, upcoming, categories, teams, qualifyText, birthdays, gameDay = null, nextGameDay = null, gameTeams = {}, progress = null, feats = [], streaks = {}, winProbs = {} }: Props) {
  const teamByCode = new Map(teams.map((t) => [t.teamCode, t]));
  const code = season.seasonCode;
  const short = seasonShortLabel(season.seasonLabel);
  const heroItems: HeroItem[] = categories.flatMap((c) =>
    c.entries[0] ? [{ key: c.key, entry: c.entries[0], team: teamByCode.get(c.entries[0].player.teamCode) }] : [],
  );

  return (
    <main className="pb-2">
      {upcoming && (
        <p className="border-b border-line bg-surface-2 px-4 py-2 text-center text-sub font-semibold text-ink-2">
          {seasonShortLabel(upcoming.seasonLabel)} 개막 전 · 직전 시즌({short}) 기록을 보여 줍니다
        </p>
      )}

      <div className="mx-auto max-w-page px-4 pt-5">
        <p className="text-sub font-medium text-ink-3">
          {asOf ?? `기록 갱신 ${fetchedLabel}`}
        </p>
        <h1 className="mt-0.5 text-h1 font-black">{seasonTitle(season.seasonLabel)}</h1>
        {progress && <SeasonProgressBar progress={progress} className="mt-3 max-w-md" />}
      </div>

      {gameDay && <GameDayBoard day={gameDay} next={nextGameDay} seasonCode={code} teams={gameTeams} streaks={streaks} winProbs={winProbs} />}

      {gameDay && <RecentFeats feats={feats} latestDate={gameDay.date} />}

      {/* 즐겨찾기가 있으면 표지 위에 (2026-10-08 홈 자동 맞춤 — 없으면 아무것도 안 그려서 기본 순서 그대로) */}
      <FavoritesStrip />

      {heroItems.length > 0 && <HomeHero items={heroItems} seasonCode={code} />}

      <BirthdayStrip players={birthdays} seasonCode={code} />

      {/* 부문별 1~3위 */}
      <section aria-labelledby="leaders-title" className="mx-auto mt-8 max-w-page px-4">
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

    </main>
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
