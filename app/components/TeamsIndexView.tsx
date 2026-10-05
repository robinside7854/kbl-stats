"use client";
// 모든 팀 화면 (/teams, 2026-10-04 · 2026-10-06 개편): 하위 탭 "지금 팀"(이번 시즌 순위 순) / "추억의 팀"(매각·해체로 코드가 끝난 팀).
// 2026-10-06 사용자: 폰에서도 2열 카드, 우승은 트로피 + 숫자만, 팀 좋아요는 없애고 팬 수만(응원팀으로 고른 회원 수, /api/likes 1분 캐시),
//   지금 팀은 시즌 순위를 카드에 바로(1위부터), 좋아요 순위(선수)는 머리말 링크. 탭은 주소 ?tab=past 로 기억.
// GA4: 카드 누르기 team_select {team_code, place:"teams"}, 탭 filter_change screen=teams filter=tab value=now|past
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { TeamIndexEntry } from "@/lib/franchise";
import ChipRow from "./ChipRow";
import TeamLogo from "./TeamLogo";
import { IconChevronRight, IconHeart, IconMegaphone, IconTrophy } from "./icons";
import { trackEvent, trackFilters } from "./track";
import { useLikeCounts } from "./useLikes";

type Tab = "now" | "past";

export default function TeamsIndexView({ teams, seasonCode, seasonShort, records }: {
  teams: TeamIndexEntry[];
  seasonCode: number;
  seasonShort: string;
  records: Record<string, { wins: number; losses: number; rank: number }>;
}) {
  const counts = useLikeCounts();
  const [tab, setTab] = useState<Tab>("now");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "past") setTab("past");
  }, []);

  // 지금 팀: 이번 시즌 순위 순(같은 순위는 원래 순서), 아직 경기 없는 팀은 뒤
  const active = useMemo(
    () =>
      teams
        .filter((t) => t.active)
        .sort((a, b) => (records[a.brand.teamCode]?.rank ?? 99) - (records[b.brand.teamCode]?.rank ?? 99) || a.order - b.order),
    [teams, records],
  );
  const memories = useMemo(() => teams.filter((t) => !t.active), [teams]);

  function changeTab(v: Tab) {
    setTab(v);
    trackFilters("teams", { tab: v });
    window.history.replaceState(null, "", v === "past" ? `${window.location.pathname}?tab=past` : window.location.pathname);
  }

  const card = (t: TeamIndexEntry) => {
    const rec = t.active ? records[t.brand.teamCode] : undefined;
    const fans = t.active && counts ? (counts.fans?.[t.brand.teamCode] ?? 0) : undefined;
    return (
      <li key={t.brand.teamCode} className="min-w-0">
        <Link
          href={`/team/${t.brand.teamCode}`}
          onClick={() => trackEvent("team_select", { team_code: t.brand.teamCode, place: "teams" })}
          className="focus-ring surface-card relative flex h-full flex-col items-center rounded-container px-2 pb-3 pt-4 text-center transition-colors duration-200 hover:bg-surface-2"
        >
          {rec && (
            <span className="absolute left-2 top-2 rounded-control bg-ink px-1.5 py-0.5 text-caption font-bold leading-none text-bg tabular">
              {rec.rank}위
            </span>
          )}
          <span className="flex h-14 w-14 items-center justify-center rounded-card bg-white p-1 ring-1 ring-inset ring-line">
            <TeamLogo logoUrl={t.brand.logoUrl} shortName={t.brand.shortName} color={t.brand.color} size={44} />
          </span>
          <span className="mt-2 w-full text-body font-bold leading-tight text-ink [overflow-wrap:anywhere] [text-wrap:balance]">{t.brand.name}</span>
          <span className="mt-1 w-full text-caption text-ink-3 tabular">
            {t.active
              ? rec
                ? `${rec.wins}승 ${rec.losses}패`
                : "아직 경기 없음"
              : `${t.spanLabel} · ${t.seasons}시즌`}
          </span>
          {!t.active && t.successorName && <span className="w-full truncate text-caption text-ink-3">→ {t.successorName}</span>}
          <span className="mt-auto flex items-center justify-center gap-3 pt-2 text-sub font-semibold text-ink tabular">
            <span className={`inline-flex items-center gap-1 ${t.championships > 0 ? "" : "text-ink-3"}`} aria-label={`우승 ${t.championships}회`}>
              <IconTrophy size={16} aria-hidden />
              {t.championships}
            </span>
            {fans !== undefined && (
              <span className={`inline-flex items-center gap-1 ${fans > 0 ? "" : "text-ink-3"}`} aria-label={`팬 ${fans}명`}>
                <IconMegaphone size={16} filled={fans > 0} aria-hidden />
                {fans}
              </span>
            )}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <main className="mx-auto max-w-5xl px-4 pb-6 pt-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-h1 font-black">팀</h1>
          <p className="mt-0.5 text-sub text-ink-3">팀을 누르면 역대 성적·로스터·레전드가 나와요.</p>
        </div>
        <Link
          href="/likes"
          className="focus-ring inline-flex h-10 shrink-0 items-center gap-1.5 rounded-control border border-line bg-surface px-3 text-sub font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
        >
          <IconHeart size={16} />
          좋아요 순위
        </Link>
      </div>

      <ChipRow
        label="팀 보기"
        className="mt-4"
        chips={[
          { value: "now", label: `지금 팀 ${active.length}` },
          { value: "past", label: `추억의 팀 ${memories.length}` },
        ]}
        value={tab}
        onChange={changeTab}
      />

      {tab === "now" ? (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3">
            <p className="text-sub text-ink-2">{seasonShort} 시즌 순위 · 승률 순</p>
            <Link href={`/season/${seasonCode}/teams`} className="focus-ring link-shortcut text-sub">
              자세한 순위표
              <IconChevronRight size={16} aria-hidden />
            </Link>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">{active.map(card)}</ul>
        </>
      ) : (
        <>
          <p className="mt-3 text-sub text-ink-2">구단이 팔리거나 사라져 지금은 없는 팀이에요. 기록은 그 시절 이름 그대로 남아 있어요.</p>
          <ul className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">{memories.map(card)}</ul>
        </>
      )}
    </main>
  );
}
