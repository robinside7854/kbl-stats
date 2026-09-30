// 선수 페이지 (PLAN.md §2-2, §3 ③): 선수 색인(players-index.json)의 전원을 빌드 때 정적 생성한다.
// 구성(모바일 우선): 머리말(팀 색·사진·칭호 배지·프로필·나이·국가·출신교·통산 요약 8칸) → 시즌 칩 + 플레이어 카드(순위 범위, PC 는 가로 카드) → 시즌별 추이 + 하이라이트 3개(PC 는 추이 오른쪽 열)
// → 슛 차트(하프코트 점 + 구역표 + 주 공격 유형, 시즌 칩을 따름 — 최신 시즌은 정적 HTML, 다른 시즌은 /shots/{시즌}/{번호}.json)
// → 시즌별 기록표 → 커리어 하이(통산 한 경기 최다 업적 카드 7개, 데이터 없으면 숨김).
// 데이터는 lib/data.ts 가 빌드 시점에 읽어 필요한 필드만 클라이언트 컴포넌트로 넘긴다.
// 카드: 가장 최근 시즌·전체 범위는 여기서 계산해 정적 HTML에 넣고(lib/cardview), 다른 시즌·범위는 브라우저가 /cards/{코드}.json 으로.
import type { Metadata } from "next";
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
} from "@/lib/data";
import { activeSpanLabel, seoulDateIso } from "@/lib/career";
import { buildSeasonCardView } from "@/lib/cardview";
import { POSITION_GROUP_LABELS } from "@/lib/roster";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import CareerHighs from "@/app/components/CareerHighs";
import CareerTable from "@/app/components/CareerTable";
import CareerTrend from "@/app/components/CareerTrend";
import PlayerHero from "@/app/components/PlayerHero";
import PlayerSeasonCards from "@/app/components/PlayerSeasonCards";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

// 색인에 없는 선수 번호는 404
export const dynamicParams = false;

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
  return {
    title: `${entry.nameKo} · KBL 선수 기록`,
    description: `${entry.nameKo}(${entry.nameEn}) KBL 정규시즌 기록, ${span}, 최근 소속 ${latest.team?.shortName ?? latest.teamShort}. 시즌별 플레이어 카드·시즌 비교, 기록표와 추이 그래프. 비영리 팬 프로젝트.`,
  };
}

export default async function PlayerPage({ params }: { params: Params }) {
  const { playerNo } = await params;
  const career = loadPlayerCareer(playerNo);
  if (!career || career.seasons.length === 0) notFound();
  const { entry, seasons } = career;
  const latest = seasons[seasons.length - 1];
  const latestCards = loadSeasonCards(latest.seasonCode);
  const card = latestCards ? buildSeasonCardView(latestCards, playerNo, "all") : null;
  const allSeasons = listSeasonsWithPlayers();
  const highTabs = loadCareerHighTabs(entry);
  const achievements = loadCareerHighAchievements(entry);
  const trend = <CareerTrend seasons={seasons} allSeasons={allSeasons} />;
  // 칭호 배지: 빌드 시점에 계산해 라벨만 넘긴다 (lib/badges via lib/data)
  const badges = loadPlayerBadges(playerNo).map((b) => ({ key: b.key, label: b.label }));
  // 만 나이의 "오늘" = 빌드 시각(한국 시간). 정적 페이지라 매일 데이터 커밋 → 재배포 때 갱신된다
  const today = seoulDateIso(new Date());

  return (
    <>
      <SiteNav seasons={allSeasons} seasonCode={allSeasons[0]?.seasonCode ?? latest.seasonCode} view="player" wide />
      <main className="pb-2">
        <PlayerHero entry={entry} seasons={seasons} today={today} badges={badges} />
        <div className="mx-auto mt-6 max-w-5xl px-4">
          {card ? (
            <PlayerSeasonCards
              playerId={playerNo}
              nameKo={entry.nameKo}
              seasons={seasons.map((s) => ({ seasonCode: s.seasonCode, seasonLabel: s.seasonLabel }))}
              initial={card}
              groupLabel={entry.positionGroup ? POSITION_GROUP_LABELS[entry.positionGroup] : null}
              aside={trend}
              careerHighRows={highTabs.find((t) => t.key === "regular")?.rows ?? []}
              shotSeasons={playerShotSeasons(playerNo, seasons.map((s) => s.seasonCode))}
              initialShots={loadPlayerShots(latest.seasonCode, playerNo)}
            />
          ) : (
            trend
          )}
        </div>
        <div className="mx-auto mt-8 max-w-5xl px-4">
          <CareerTable seasons={seasons} />
        </div>
        {achievements.length > 0 && (
          <div className="mx-auto mt-8 max-w-5xl px-4">
            <CareerHighs items={achievements} teamPrimary={latest.team?.color.primary ?? FALLBACK_TEAM_COLOR.primary} />
          </div>
        )}
      </main>
      {/* 수집일은 이 선수의 가장 최근 시즌 파일 기준 */}
      <SourceFooter fetchedAt={loadSeasonData(latest.seasonCode)?.fetchedAt} wide />
    </>
  );
}
