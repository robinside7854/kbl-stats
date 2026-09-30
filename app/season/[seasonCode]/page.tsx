import type { Metadata } from "next";
import { listSeasonsWithPlayers, loadSeasonData } from "@/lib/data";
import SeasonView from "@/app/components/SeasonView";

// 빌드 때 만든 시즌 외에는 404 (선수 0명 시즌 포함)
export const dynamicParams = false;

export function generateStaticParams() {
  return listSeasonsWithPlayers().map((s) => ({ seasonCode: String(s.seasonCode) }));
}

type Params = Promise<{ seasonCode: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { seasonCode } = await params;
  const season = loadSeasonData(Number(seasonCode));
  return { title: season ? `${season.seasonLabel} 플레이어 카드 · KBL` : "KBL 플레이어 카드" };
}

export default async function SeasonPage({ params }: { params: Params }) {
  const { seasonCode } = await params;
  return <SeasonView seasonCode={Number(seasonCode)} />;
}
