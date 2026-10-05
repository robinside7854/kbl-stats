"use client";
// 좋아요 순위 화면 (/likes, 2026-10-04): 선수 / 팀 팬 수(2026-10-05) 보기. 팀 좋아요는 2026-10-06 사용자 결정으로 없앰(팬 수와 겹침). 수 = 좋아요를 누른 회원 수·응원팀으로 고른 회원 수(/api/likes, 1분 캐시).
// 선수 이름·사진은 검색 색인(/search-index.json). GA4: filter_change screen=likes filter=tab
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { enabledLoginProviders } from "@/lib/account";
import type { TeamBrand } from "@/lib/franchise";
import type { SearchEntry } from "@/lib/types";
import ChipRow from "./ChipRow";
import PlayerAvatar from "./PlayerAvatar";
import Skeleton from "./Skeleton";
import TeamLogo from "./TeamLogo";
import { IconHeart, IconMegaphone } from "./icons";
import { trackFilters } from "./track";
import { useLikeCounts } from "./useLikes";
import { loadSearchIndex } from "./useSearchIndex";

const TOP = 50;

export default function LikesView({ teams }: { teams: (TeamBrand & { active: boolean })[] }) {
  const counts = useLikeCounts();
  const [tab, setTab] = useState<"player" | "fans">("player");
  const [index, setIndex] = useState<Map<string, SearchEntry> | null>(null);
  useEffect(() => {
    void loadSearchIndex()
      .then((list) => setIndex(new Map(list.map((e) => [e.id, e]))))
      .catch(() => setIndex(new Map()));
  }, []);

  const players = useMemo(
    () =>
      Object.entries(counts?.players ?? {})
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, TOP),
    [counts],
  );
  const teamRows = useMemo(
    () =>
      teams
        .map((t) => ({ t, n: counts?.fans?.[t.teamCode] ?? 0 }))
        .filter((r) => r.t.active || r.n > 0)
        .sort((a, b) => b.n - a.n || Number(b.t.active) - Number(a.t.active)),
    [teams, counts, tab],
  );

  if (enabledLoginProviders().length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-6 pt-5">
        <h1 className="text-h1 font-black">좋아요 순위</h1>
        <p className="surface-card mt-4 rounded-container p-4 text-body text-ink-2">로그인 기능을 준비 중이라 좋아요를 아직 모으지 않아요.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-6 pt-5">
      <h1 className="text-h1 font-black">좋아요 순위</h1>
      <p className="mt-0.5 text-sub text-ink-3">
        {tab === "fans" ? "팀 팬 수는 그 팀을 응원팀으로 고른 회원 수예요." : "로그인한 팬이 선수 페이지에서 누른 좋아요 수예요."} 1분마다 새로 세요.
      </p>
      <ChipRow
        label="보기"
        chips={[
          { value: "player", label: "선수" },
          { value: "fans", label: "팀 팬 수" },
        ]}
        value={tab}
        onChange={(v) => {
          setTab(v);
          trackFilters("likes", { tab: v });
        }}
        className="mt-3"
      />
      <section className="surface-card mt-3 rounded-container p-2">
        {!counts || (tab === "player" && !index) ? (
          <Skeleton className="h-64 w-full rounded-card" />
        ) : tab === "player" ? (
          players.length === 0 ? (
            <p className="p-3 text-body text-ink-2">아직 좋아요를 받은 선수가 없어요. 선수 페이지에서 첫 좋아요를 눌러 보세요.</p>
          ) : (
            <ol className="divide-y divide-line">
              {players.map(([id, n], i) => {
                const e = index?.get(id);
                return (
                  <li key={id}>
                    <Link href={`/player/${id}`} className="focus-ring-inset flex min-h-14 items-center gap-3 px-2 py-1.5 transition-colors duration-200 hover:bg-surface-2">
                      <span className="w-6 text-right text-sub font-bold tabular text-ink-3">{i + 1}</span>
                      <PlayerAvatar photoUrl={e?.photoUrl ?? null} nameKo={e?.nameKo ?? id} color={e ? { primary: e.color.primary, secondary: e.color.primary, text: e.color.text } : undefined} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-semibold text-ink">{e?.nameKo ?? `선수 ${id}`}</span>
                        {e && <span className="block truncate text-caption text-ink-3">{e.team} · {e.from === e.to ? e.from : `${e.from} ~ ${e.to}`}</span>}
                      </span>
                      <span className="inline-flex items-center gap-1 text-body font-bold tabular text-ink">
                        <IconHeart size={16} filled />
                        {n}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )
        ) : (
          <ol className="divide-y divide-line">
            {teamRows.map(({ t, n }, i) => (
              <li key={t.teamCode}>
                <Link href={`/team/${t.teamCode}`} className="focus-ring-inset flex min-h-14 items-center gap-3 px-2 py-1.5 transition-colors duration-200 hover:bg-surface-2">
                  <span className="w-6 text-right text-sub font-bold tabular text-ink-3">{i + 1}</span>
                  <TeamLogo logoUrl={t.logoUrl} shortName={t.shortName} color={t.color} size={32} />
                  <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">
                    {t.name}
                    {!t.active && <span className="ml-1.5 text-caption font-normal text-ink-3">추억의 팀</span>}
                  </span>
                  <span className="inline-flex items-center gap-1 text-body font-bold tabular text-ink">
                    <IconMegaphone size={16} filled={n > 0} />
                    {n}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
