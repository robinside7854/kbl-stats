"use client";
// 홈 "이번 주 팬 MVP" 작은 카드 (2026-10-16): 이번 주 후보(팀마다 한 명) 중 눈에 띈 기록 1~3위 사진 + "투표하러 가기" → /vote.
// 표 수는 부르지 않는다(홈 요청 아끼기 — 결과는 /vote 에서). 이번 주는 브라우저의 한국 시간으로 고르고,
// 아직 후보가 없으면(월요일 첫 경기 전) 안내 한 줄 + 지난주 결과 링크. 로그인이 꺼진 빌드면 안 그린다.
// GA4: vote_open {place: home}.
import Link from "next/link";
import { useEffect, useState } from "react";
import { findVoteWeek, highlightText, voteWeekKey, type VoteWeek } from "@/lib/votes";
import type { TeamColor } from "@/lib/types";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import PlayerAvatar from "./PlayerAvatar";
import { IconChevronRight } from "./icons";
import { trackEvent } from "./track";
import { participationOn } from "./vote-client";

export default function FanMvpCard({ weeks, teams }: { weeks: VoteWeek[]; teams: Record<string, { color: TeamColor }> }) {
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => setKey(voteWeekKey(new Date())), []);
  if (!participationOn() || weeks.length === 0) return null;
  const week = findVoteWeek(weeks, key ?? weeks[0].week);
  const top = week?.players.slice(0, 3) ?? [];

  return (
    <section aria-labelledby="fan-mvp-title" className="mx-auto mt-6 max-w-page px-4">
      <div className="surface-card rounded-container p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="fan-mvp-title" className="text-body font-bold">
            이번 주 팬 MVP
          </h2>
          <Link href="/vote" className="focus-ring link-shortcut shrink-0 text-sub" onClick={() => trackEvent("vote_open", { place: "home" })}>
            {week ? "투표하러 가기" : "지난주 결과 보기"}
            <IconChevronRight size={16} />
          </Link>
        </div>
        {week ? (
          <ul className="mt-1 grid gap-2 sm:grid-cols-3">
            {top.map((c) => (
              <li key={c.id} className="flex min-w-0 items-center gap-2">
                <PlayerAvatar photoUrl={c.photoUrl} nameKo={c.nameKo} color={teams[c.teamCode]?.color ?? FALLBACK_TEAM_COLOR} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-sub font-semibold text-ink">{c.nameKo}</span>
                  <span className="block truncate text-caption text-ink-3 tabular">경기당 {highlightText(c)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sub text-ink-2">이번 주 첫 경기가 끝나면 후보가 나와요.</p>
        )}
      </div>
    </section>
  );
}
