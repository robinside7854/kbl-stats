// 선수 페이지 (PLAN.md §2-2, §3 ③): 선수 색인(players-index.json)의 전원을 빌드 때 정적 생성한다.
// 구성(모바일 우선): 머리말(팀 색·사진·칭호 배지·프로필·나이·국가·출신교·통산 요약) → 탭 줄 → 탭 내용 (2026-11-08 사용자: 스크롤이 길면 이탈 → 탭).
//   시즌: 시즌 칩 · 플레이어 카드(순위 범위) · 하이라이트 3개 · 최근 경기
//   능력치: 세부 능력치 막대 · 경기별 기록 범위 · 비슷한 시즌(lib/similar)
//   슛: 슛 차트(하프코트 점 + 구역표 + 주 공격 유형) · 슛 습관의 변화
//   커리어: 수상 경력·다음 이정표·소속 팀 이력 · 시즌별 추이 · 시즌별 기록표(리그 1위 굵게) · 커리어 타임라인
//   명장면: 커리어 하이(통산 한 경기 최다 업적 카드) · 클러치(위닝샷·클러치 득점, 2006-07 이후)
// 탭 규칙 lib/player-tabs, 상태(주소 ?tab=) app/components/PlayerTabs. 내용이 없는 탭은 빠진다.
// 데이터는 lib/data.ts 가 빌드 시점에 읽어 필요한 필드만 클라이언트 컴포넌트로 넘긴다.
// 카드: 가장 최근 시즌·전체 범위는 여기서 계산해 정적 HTML에 넣고(lib/cardview), 다른 시즌·범위는 브라우저가 /cards/{코드}.json 으로.
import type { Metadata } from "next";
import { ogImagePath, shareMetadata } from "@/lib/share";
import { notFound } from "next/navigation";
import {
  listSeasonsWithPlayers,
  loadCareerHighAchievements,
  loadCareerHighTabs,
  loadPlayerBadges,
  loadPlayerCareer,
  loadPlayerShots,
  loadPlayersIndex,
  playerShotSeasons,
  loadSeasonCards,
  loadSeasonData,
  loadPrimeSeason,
  loadSimilarPlayers,
  loadMilestones,
  loadCareerTotals,
  loadPlayerGameRanges,
  loadPlayerRecentGames,
  loadPlayerClutch,
  loadAwardRace,
} from "@/lib/data";
import { raceTagsOf } from "@/lib/award-race";
import { activeSpanLabel, seasonShortLabel, seoulDateIso } from "@/lib/career";
import { teamShortLabel } from "@/lib/images";
import { buildSeasonCardView } from "@/lib/cardview";
import { POSITION_GROUP_LABELS } from "@/lib/roster";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import type { SimilarEntry } from "@/lib/similar";
import CareerHighs from "@/app/components/CareerHighs";
import CareerTable from "@/app/components/CareerTable";
import CareerTrend from "@/app/components/CareerTrend";
import PlayerHero, { PlayerCareerFacts } from "@/app/components/PlayerHero";
import RecentPlayerMark from "@/app/components/RecentPlayerMark";
import PlayerSectionNav from "@/app/components/PlayerSectionNav";
import PlayerSeasonCards from "@/app/components/PlayerSeasonCards";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";
import CareerTimeline from "@/app/components/CareerTimeline";
import ShotHabit from "@/app/components/ShotHabit";
import PlayerClutch from "@/app/components/PlayerClutch";
import { loadCareerTimeline, loadShotHabits } from "@/lib/data-career-extra";
import { PlayerTabBar, PlayerTabsProvider, TabPanel, PLAYER_TAB_PANELS_ID } from "@/app/components/PlayerTabs";
import { availablePlayerTabs } from "@/lib/player-tabs";

// 색인에 없는 선수 번호는 404
export const dynamicParams = false;

// 비슷한 시즌은 처음 보이는 카드 시즌 것만 페이지에 넣는다 — 나머지 시즌은 고를 때 /similar/{번호}.json (2026-10-14)
function pickSimilarSeason(all: Record<number, SimilarEntry[]>, seasonCode: number): Record<number, SimilarEntry[]> {
  return seasonCode in all ? { [seasonCode]: all[seasonCode] } : {};
}

export function generateStaticParams() {
  return loadPlayersIndex().map((e) => ({ playerNo: e.id }));
}

type Params = Promise<{ playerNo: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { playerNo } = await params;
  const career = loadPlayerCareer(playerNo);
  if (!career || career.seasons.length === 0) return { title: "KBL 선수 기록" };
  const { entry, seasons } = career;
  const latest = seasons[seasons.length - 1];
  const span = activeSpanLabel(seasons[0].seasonLabel, latest.seasonLabel, seasons.length);
  // 공유 카드 설명 첫 줄은 통산 한 줄 (카카오톡은 설명 앞부분만 보여 준다)
  const total = loadCareerTotals().find((t) => t.id === playerNo);
  const pg = (v: number) => (total && total.games > 0 ? (v / total.games).toFixed(1) : "–");
  const line = total ? `통산 ${total.games.toLocaleString("ko-KR")}경기 · 경기당 ${pg(total.points)}점 ${pg(total.reb)}리바 ${pg(total.ast)}어시` : "";
  return shareMetadata({
    title: `${entry.nameKo} · KBL 선수 기록`,
    description: `${latest.team?.shortName ?? latest.teamShort} · ${span}${line ? ` · ${line}` : ""}. 시즌별 플레이어 카드·기록표·슛 차트. 비영리 팬 프로젝트.`,
    path: `/player/${playerNo}`,
    image: ogImagePath.player(playerNo),
    imageAlt: `${entry.nameKo}(${entry.nameEn}) 통산 기록 카드`,
  });
}

export default async function PlayerPage({ params }: { params: Params }) {
  const { playerNo } = await params;
  const career = loadPlayerCareer(playerNo);
  if (!career || career.seasons.length === 0) notFound();
  const { entry, seasons } = career;
  const latest = seasons[seasons.length - 1];
  const latestCards = loadSeasonCards(latest.seasonCode);
  const card = latestCards ? buildSeasonCardView(latestCards, playerNo, "all") : null;
  const similarAll = loadSimilarPlayers(playerNo);
  const allSeasons = listSeasonsWithPlayers();
  const highTabs = loadCareerHighTabs(entry);
  const achievements = loadCareerHighAchievements(entry);
  // 칭호 배지: 빌드 시점에 계산해 라벨만 넘긴다 (lib/badges via lib/data)
  const badges = loadPlayerBadges(playerNo).map((b) => ({ key: b.key, label: b.label }));
  // 만 나이의 "오늘" = 빌드 시각(한국 시간). 정적 페이지라 매일 데이터 커밋 → 재배포 때 갱신된다
  const today = seoulDateIso(new Date());
  // 2026-10-16 "우리만의 기능": 슛 습관의 변화(슛 50개+ 시즌이 2개 이상일 때만 보임) · 커리어 타임라인
  const shotHabits = loadShotHabits(career);
  const timeline = loadCareerTimeline(career);
  const clutch = loadPlayerClutch(playerNo);

  const shotSeasons = playerShotSeasons(playerNo, seasons.map((s) => s.seasonCode));
  const habit = shotHabits.length >= 2 ? <ShotHabit rows={shotHabits} /> : null;
  const tabs = availablePlayerTabs({ card: !!card, shots: shotSeasons.length > 0 || !!habit, moments: achievements.length > 0 || !!clutch });

  return (
    <>
      <SiteNav seasons={allSeasons} seasonCode={allSeasons[0]?.seasonCode ?? latest.seasonCode} view="player" wide />
      <main className="pb-2">
        <RecentPlayerMark playerId={entry.id} />
        <PlayerTabsProvider available={tabs}>
          <PlayerSectionNav
            playerId={entry.id}
            nameKo={entry.nameKo}
            photoUrl={entry.photoUrl}
            teamLabel={`${seasonShortLabel(latest.seasonLabel)} ${teamShortLabel(latest.team?.shortName ?? latest.teamShort)}`}
            color={latest.team?.color ?? FALLBACK_TEAM_COLOR}
          />
          <PlayerHero entry={entry} seasons={seasons} today={today} badges={badges} raceTags={raceTagsOf(loadAwardRace(), playerNo)} />
          <PlayerTabBar />
          <div id={PLAYER_TAB_PANELS_ID} className="mx-auto mt-5 max-w-page px-4">
            {card && (
              <PlayerSeasonCards
                playerId={playerNo}
                nameKo={entry.nameKo}
                seasons={seasons.map((s) => ({ seasonCode: s.seasonCode, seasonLabel: s.seasonLabel }))}
                initial={card}
                groupLabel={entry.positionGroup ? POSITION_GROUP_LABELS[entry.positionGroup] : null}
                shotsExtra={habit}
                careerHighRows={highTabs.find((t) => t.key === "regular")?.rows ?? []}
                shotSeasons={shotSeasons}
                initialShots={loadPlayerShots(latest.seasonCode, playerNo)}
                similar={pickSimilarSeason(similarAll, card.seasonCode)}
                similarSeasons={Object.keys(similarAll).map(Number)}
                primeSeason={loadPrimeSeason(playerNo)}
                gameRanges={loadPlayerGameRanges(playerNo, seasons.map((s) => s.seasonCode))}
                recentGames={loadPlayerRecentGames(playerNo, seasons.map((s) => s.seasonCode))}
              />
            )}
            <TabPanel tab="career" className="space-y-8">
              <PlayerCareerFacts entry={entry} seasons={seasons} milestones={loadMilestones(playerNo)} />
              <CareerTrend seasons={seasons} allSeasons={allSeasons} />
              <CareerTable seasons={seasons} playoffSeasons={career.playoffSeasons} />
              {timeline.length > 0 && <CareerTimeline rows={timeline} />}
            </TabPanel>
            <TabPanel tab="moments" className="space-y-8">
              {achievements.length > 0 && <CareerHighs items={achievements} teamPrimary={latest.team?.color.primary ?? FALLBACK_TEAM_COLOR.primary} />}
              {clutch && <PlayerClutch data={clutch} />}
            </TabPanel>
          </div>
        </PlayerTabsProvider>
      </main>
      {/* 수집일은 이 선수의 가장 최근 시즌 파일 기준 */}
      <SourceFooter fetchedAt={loadSeasonData(latest.seasonCode)?.fetchedAt} wide />
    </>
  );
}
