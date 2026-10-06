"use client";
// 54-0 주간 순위 화면 (/game/ranking, 2026-10-05): 이번 주 / 지난주 칩 → 순위 줄(순위·닉네임 배지·승패·다섯 명·라인업 보기).
// 순위 = 회원마다 그 주 가장 좋은 판 하나, 닉네임을 정한 회원만, 서버가 다시 계산해 맞춘 기록만 (lib/server/members weeklyGameRanking).
// 주소 ?week=last. GA4: filter_change screen=game_ranking filter=week
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { enabledLoginProviders, weekRangeLabel, type GameRanking, type RankingWeek } from "@/lib/account";
import { GAME_SEASON_GAMES } from "@/lib/game";
import type { AccountTeam } from "./AccountView";
import { fetchGameRanking } from "./account-client";
import ChipRow from "./ChipRow";
import MemberBadge from "./MemberBadge";
import Skeleton from "./Skeleton";
import { IconChevronRight } from "./icons";
import { trackFilters } from "./track";

export default function GameRankingView({ teams }: { teams: AccountTeam[] }) {
  const [week, setWeek] = useState<RankingWeek>("this");
  const [data, setData] = useState<Partial<Record<RankingWeek, GameRanking | "error">>>({});
  const teamOf = useMemo(() => new Map(teams.map((t) => [t.teamCode, t])), [teams]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("week") === "last") setWeek("last");
  }, []);

  useEffect(() => {
    if (data[week]) return;
    let alive = true;
    void fetchGameRanking(week).then((r) => alive && setData((d) => ({ ...d, [week]: r ?? "error" })));
    return () => {
      alive = false;
    };
  }, [week, data]);

  function choose(next: RankingWeek) {
    setWeek(next);
    trackFilters("game_ranking", { week: next });
    const url = new URL(window.location.href);
    if (next === "last") url.searchParams.set("week", "last");
    else url.searchParams.delete("week");
    window.history.replaceState(null, "", url);
  }

  const cur = data[week];
  const loginOn = enabledLoginProviders().length > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-6 pt-5">
      <h1 className="text-h1 font-black">54-0 주간 순위</h1>
      <p className="mt-0.5 text-sub text-ink-3">
        한 주는 월요일 0시부터 일요일 밤까지예요{cur && cur !== "error" ? ` (${weekRangeLabel(new Date(cur.from))})` : ""}.
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <ChipRow
          label="주"
          chips={[
            { value: "this", label: "이번 주" },
            { value: "last", label: "지난주" },
          ]}
          value={week}
          onChange={choose}
        />
        <Link href="/game" className="focus-ring link-shortcut">
          54-0 하러 가기
          <IconChevronRight size={16} />
        </Link>
      </div>

      <section aria-label="순위" className="surface-card mt-3 rounded-container p-2">
        {!loginOn ? (
          <p className="p-3 text-body text-ink-2">로그인 기능을 준비 중이라 순위를 아직 모으지 않아요.</p>
        ) : !cur ? (
          <Skeleton className="h-64 w-full rounded-card" />
        ) : cur === "error" ? (
          <p className="p-3 text-body text-ink-2">순위를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</p>
        ) : cur.rows.length === 0 ? (
          <p className="p-3 text-body text-ink-2">
            {week === "this" ? "이번 주 기록이 아직 없어요. 첫 1위에 도전해 보세요." : "지난주에는 순위에 오른 기록이 없어요."}
          </p>
        ) : (
          <ol className="divide-y divide-line">
            {cur.rows.map((r) => {
              const t = r.teamCode ? teamOf.get(r.teamCode) : undefined;
              const perfect = r.wins === GAME_SEASON_GAMES;
              return (
                <li key={r.rank} className="flex items-start gap-3 px-2 py-3">
                  <span className={`w-7 shrink-0 pt-0.5 text-right tabular ${r.rank <= 3 ? "text-body font-black text-ink" : "text-sub font-bold text-ink-3"}`}>{r.rank}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 text-body">
                        <MemberBadge nickname={r.nickname} teamColor={t?.color} teamName={t?.name} />
                      </span>
                      <span className="shrink-0 text-body font-black tabular text-ink">
                        {perfect ? (
                          <span className="rounded-control px-1.5 py-0.5" style={{ background: "var(--grade-s)", color: "var(--grade-s-ink)" }}>
                            54-0
                          </span>
                        ) : (
                          `${r.wins}승 ${GAME_SEASON_GAMES - r.wins}패`
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-caption text-ink-2">{r.names.join(" · ")}</p>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-caption text-ink-3">
                      <span className="tabular">
                        전력 {r.rating} · 라인업 {r.plays}개
                      </span>
                      <Link href={`/game?l=${encodeURIComponent(r.lineup)}`} className="focus-ring link-shortcut">
                        라인업 보기
                        <IconChevronRight size={16} />
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      {loginOn && cur && cur !== "error" && cur.members > cur.rows.length && (
        <p className="mt-2 text-sub text-ink-3 tabular">참여 {cur.members.toLocaleString("ko-KR")}명 중 상위 {cur.rows.length}명</p>
      )}
      <ul className="mt-3 space-y-1 text-caption text-ink-3">
        <li>로그인하고 닉네임을 정한 회원만 순위에 올라요. 회원마다 그 주 가장 좋은 판 하나만 세요.</li>
        <li>승수가 같으면 팀 전력이 높은 쪽, 그것도 같으면 먼저 달성한 쪽이 위예요. 순위는 1분마다 새로 세요.</li>
      </ul>
    </main>
  );
}
