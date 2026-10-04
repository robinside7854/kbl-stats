"use client";
// 모든 팀 화면 (/teams, 2026-10-04): 지금 팀 카드(이번 시즌 승패·순위·우승 횟수·좋아요 수) + 추억의 팀 카드(활동 기간·이어진 팀).
// 좋아요 수는 /api/likes (로그인이 켜진 빌드만). GA4: 카드 누르기 team_select {team_code, place:"teams"}
import Link from "next/link";
import type { TeamIndexEntry } from "@/lib/franchise";
import TeamLogo from "./TeamLogo";
import { IconHeart, IconTrophy } from "./icons";
import { trackEvent } from "./track";
import { useLikeCounts } from "./useLikes";

export default function TeamsIndexView({ teams, seasonCode, seasonShort, records }: {
  teams: TeamIndexEntry[];
  seasonCode: number;
  seasonShort: string;
  records: Record<string, { wins: number; losses: number; rank: number }>;
}) {
  const counts = useLikeCounts();
  const active = teams.filter((t) => t.active);
  const memories = teams.filter((t) => !t.active);

  const card = (t: TeamIndexEntry) => {
    const rec = records[t.brand.teamCode];
    const likes = counts?.teams[t.brand.teamCode];
    return (
      <li key={t.brand.teamCode}>
        <Link
          href={`/team/${t.brand.teamCode}`}
          onClick={() => trackEvent("team_select", { team_code: t.brand.teamCode, place: "teams" })}
          className="focus-ring surface-card flex min-h-20 items-center gap-3 rounded-container p-3 transition-colors duration-200 hover:bg-surface-2"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-white p-1 ring-1 ring-inset ring-line">
            <TeamLogo logoUrl={t.brand.logoUrl} shortName={t.brand.shortName} color={t.brand.color} size={40} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-bold text-ink">{t.brand.name}</span>
            <span className="block text-caption text-ink-3 tabular">
              {t.active
                ? rec
                  ? `${seasonShort} ${rec.wins}승 ${rec.losses}패 · ${rec.rank}위`
                  : `${seasonShort} 아직 경기 없음`
                : `${t.spanLabel} · ${t.seasons}시즌${t.successorName ? ` → ${t.successorName}` : ""}`}
            </span>
            <span className="mt-0.5 flex flex-wrap gap-x-3 text-caption text-ink-2">
              {t.championships > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-ink">
                  <IconTrophy size={16} />
                  우승 {t.championships}
                </span>
              )}
              {t.regularFirsts > 0 && <span>정규 1위 {t.regularFirsts}</span>}
              {likes !== undefined && likes > 0 && (
                <span className="inline-flex items-center gap-1">
                  <IconHeart size={16} filled />
                  {likes}
                </span>
              )}
            </span>
          </span>
        </Link>
      </li>
    );
  };

  return (
    <main className="mx-auto max-w-5xl px-4 pb-6 pt-5">
      <h1 className="text-h1 font-black">팀</h1>
      <p className="mt-0.5 text-sub text-ink-3">팀을 누르면 역대 시즌 성적·로스터·레전드를 볼 수 있어요.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/season/${seasonCode}/teams`}
          className="focus-ring inline-flex h-10 items-center rounded-control border border-line bg-surface px-3 text-sub font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
        >
          {seasonShort} 팀 순위
        </Link>
        <Link
          href="/likes"
          className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-control border border-line bg-surface px-3 text-sub font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
        >
          <IconHeart size={16} />
          좋아요 순위
        </Link>
      </div>

      <h2 className="mt-6 text-h2 font-bold">지금 팀 {active.length}</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{active.map(card)}</ul>

      <h2 className="mt-8 text-h2 font-bold">추억의 팀 {memories.length}</h2>
      <p className="mt-0.5 text-sub text-ink-3">구단이 팔리거나 사라져 지금은 없는 팀이에요. 기록은 그 시절 이름 그대로 남아 있어요.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{memories.map(card)}</ul>
    </main>
  );
}
