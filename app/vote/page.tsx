// 팬 참여 (/vote, 2026-10-16 로드맵 1단계): 이번 주 팬 MVP 투표 + 시즌 승부 예측 순위. 메뉴는 없고 홈 카드·54-0 주간 순위에서 들어온다.
// 후보는 빌드 때 경기가 있는 가장 최근 시즌 박스스코어로(lib/votes buildVoteData — 서버 검사용 public/vote/data.json 과 같은 함수).
// 표 수·순위·내 표는 브라우저가 /api/vote·/api/picks/ranking·/api/me/vote 에서 받는다. 주소 ?tab=predict.
import type { Metadata } from "next";
import { shareMetadata } from "@/lib/share";
import { findPlayerIndexEntry, gameTeamInfos, listAllSeasons, listSeasonsWithPlayers, loadSeasonData, loadSeasonGames } from "@/lib/data";
import { buildVoteData } from "@/lib/votes";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";
import VoteView from "@/app/components/VoteView";

export const metadata: Metadata = shareMetadata({
  title: "이번 주 팬 MVP · KBL - Stats Reference",
  description: "이번 주 가장 잘한 선수를 팬이 직접 뽑아요. 경기 승부 예측 순위도 함께.",
  path: "/vote",
});

export default function VotePage() {
  const seasons = listSeasonsWithPlayers();
  const code = listAllSeasons().find((s) => loadSeasonGames(s.seasonCode).length > 0)?.seasonCode ?? seasons[0]?.seasonCode ?? 0;
  const data = buildVoteData(code, loadSeasonGames(code), (id) => findPlayerIndexEntry(id)?.photoUrl ?? null);
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={seasons[0]?.seasonCode ?? code} view="vote" />
      <VoteView weeks={data.weeks.slice(0, 3)} teams={gameTeamInfos(code)} seasonCode={code} />
      <SourceFooter fetchedAt={seasons[0] ? loadSeasonData(seasons[0].seasonCode)?.fetchedAt : undefined} />
    </>
  );
}
