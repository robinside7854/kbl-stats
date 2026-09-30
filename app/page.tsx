// 첫 화면: 선수가 있는 가장 최신 시즌을 그대로 보여준다 (리다이렉트 대신 정적 렌더링)
import { listSeasonsWithPlayers } from "@/lib/data";
import SeasonView from "./components/SeasonView";

export default function HomePage() {
  const latest = listSeasonsWithPlayers()[0];
  return <SeasonView seasonCode={latest.seasonCode} />;
}
