// 선수 페이지 (PLAN.md §2-2, §3 ③): 선수 색인(players-index.json)의 전원을 빌드 때 정적 생성한다.
// 구성(모바일 우선): 머리말(팀 색·사진·통산 요약) → 최근 시즌 플레이어 카드 + 시즌별 추이 → 시즌별 기록표.
// 데이터는 lib/data.ts 가 빌드 시점에 읽어 필요한 필드만 클라이언트 컴포넌트로 넘긴다.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listSeasonsWithPlayers, loadPlayerCard, loadPlayerCareer, loadPlayersIndex, loadSeasonData } from "@/lib/data";
import { activeSpanLabel } from "@/lib/career";
import CareerTable from "@/app/components/CareerTable";
import CareerTrend from "@/app/components/CareerTrend";
import PlayerCardPanel from "@/app/components/PlayerCardPanel";
import PlayerHero from "@/app/components/PlayerHero";
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
    description: `${entry.nameKo}(${entry.nameEn}) KBL 정규시즌 기록 — ${span}, 최근 소속 ${latest.team?.shortName ?? latest.teamShort}. 시즌별 기록표와 추이 그래프, 플레이어 카드. 비영리 팬 프로젝트.`,
  };
}

export default async function PlayerPage({ params }: { params: Params }) {
  const { playerNo } = await params;
  const career = loadPlayerCareer(playerNo);
  if (!career || career.seasons.length === 0) notFound();
  const { entry, seasons } = career;
  const latest = seasons[seasons.length - 1];
  const card = loadPlayerCard(playerNo, latest.seasonCode);
  const allSeasons = listSeasonsWithPlayers();

  return (
    <>
      <SiteNav seasons={allSeasons} seasonCode={allSeasons[0]?.seasonCode ?? latest.seasonCode} view="player" wide />
      <main className="pb-2">
        <PlayerHero entry={entry} seasons={seasons} />
        <div className="mx-auto mt-6 grid max-w-5xl gap-6 px-4 lg:grid-cols-[500px_minmax(0,1fr)] lg:items-start">
          {card && <PlayerCardPanel data={card} />}
          <div className={card ? "min-w-0" : "min-w-0 lg:col-span-2"}>
            <CareerTrend seasons={seasons} allSeasons={allSeasons} />
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-5xl px-4">
          <CareerTable seasons={seasons} />
        </div>
      </main>
      {/* 수집일은 이 선수의 가장 최근 시즌 파일 기준 */}
      <SourceFooter fetchedAt={loadSeasonData(latest.seasonCode)?.fetchedAt} wide />
    </>
  );
}
