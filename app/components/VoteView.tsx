"use client";
// 팬 참여 화면 (/vote, 2026-10-16): 이번 주 팬 MVP 투표 (승부 예측 탭은 같은 날 폐지).
// 팬 MVP: 이번 주(한국 시간 월~일) 후보 = 그 주 뛴 팀마다 한 명, 가장 눈에 띈 기록(득점·리바·어시·3점·스틸+블록 ÷ 문턱) 순(lib/votes, 5~10명).
//   줄마다 사진·이름·팀·눈에 띈 기록 칩·주간 기록 한 줄·표 막대, 로그인 회원은 "투표"(한 주 한 표, 주 안에서 바꿀 수 있음). 위에 팬 투표 1위 vs 우리 기록 1위, 아래 지난주 팬 MVP.
// 요청: 표 수 /api/vote(공개 1분 캐시), 내 표는 로그인한 적 있는 브라우저만.
// GA4: vote_cast {player_no}, login_prompt_click {place: vote}.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { candidateLine, fanMvp, findVoteWeek, highlightText, voteResults, voteWeekKey, voteWeekLabel, type VoteCandidate, type VoteTally, type VoteWeek } from "@/lib/votes";
import type { TeamColor } from "@/lib/types";
import { teamShortLabel } from "@/lib/images";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import PlayerAvatar from "./PlayerAvatar";
import Skeleton from "./Skeleton";
import TeamLogo from "./TeamLogo";
import { IconChevronRight } from "./icons";
import { trackEvent } from "./track";
import { useMember } from "./useLikes";
import { castVote, fetchMyVotes, fetchVoteTallies, participationOn, type VoteTallies } from "./vote-client";
import { hasSignedInHint } from "./account-client";

interface TeamInfo {
  shortName: string;
  logoUrl: string | null;
  color: TeamColor;
}

interface Props {
  weeks: VoteWeek[];
  teams: Record<string, TeamInfo>;
}

export default function VoteView({ weeks, teams }: Props) {
  // 정적 HTML 은 빌드 때 가장 최근 주를 "이번 주"로, 브라우저가 지금 시각으로 다시 고른다
  const [keys, setKeys] = useState<{ cur: string; last: string } | null>(null);
  useEffect(() => {
    const now = new Date();
    setKeys({ cur: voteWeekKey(now), last: voteWeekKey(now, -1) });
  }, []);
  const on = participationOn();

  return (
    <main className="mx-auto max-w-5xl px-4 pb-6 pt-5">
      <h1 className="text-h1 font-black">팬 투표</h1>
      <p className="mt-0.5 text-sub text-ink-3">이번 주 가장 눈에 띈 선수를 뽑아 보세요.</p>
      {!keys ? (
        <Skeleton className="mt-4 h-96 w-full rounded-container" />
      ) : !on ? (
        <p className="surface-card mt-3 rounded-container p-4 text-body text-ink-2">로그인 기능을 준비 중이라 투표를 아직 받지 않아요.</p>
      ) : (
        <MvpSection weeks={weeks} teams={teams} keys={keys} />
      )}
    </main>
  );
}

const teamOf = (teams: Record<string, TeamInfo>, code: string): TeamInfo => teams[code] ?? { shortName: code, logoUrl: null, color: FALLBACK_TEAM_COLOR };

function LoginPrompt({ place, children }: { place: "vote"; children: React.ReactNode }) {
  return (
    <Link href="/me" className="focus-ring link-shortcut" onClick={() => trackEvent("login_prompt_click", { place })}>
      {children}
      <IconChevronRight size={16} />
    </Link>
  );
}

function MvpSection({ weeks, teams, keys }: { weeks: VoteWeek[]; teams: Record<string, TeamInfo>; keys: { cur: string; last: string } | null }) {
  const curKey = keys?.cur ?? weeks[0]?.week ?? "";
  const lastKey = keys?.last ?? weeks[1]?.week ?? "";
  const week = findVoteWeek(weeks, curKey);
  const lastWeek = findVoteWeek(weeks, lastKey);
  const [tallies, setTallies] = useState<VoteTallies | "error" | null>(null);
  const [mine, setMine] = useState<Record<string, string> | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchVoteTallies().then((t) => alive && setTallies(t ?? "error"));
    if (hasSignedInHint()) {
      setSignedIn(true);
      void fetchMyVotes().then((v) => {
        if (!alive) return;
        if (v === null && !hasSignedInHint()) setSignedIn(false);
        setMine(v ?? {});
      });
    }
    return () => {
      alive = false;
    };
  }, []);

  const tallyOf = (key: string): VoteTally | null => {
    if (!tallies || tallies === "error") return null;
    return tallies.this.week === key ? tallies.this : tallies.last.week === key ? tallies.last : null;
  };
  const curTally = tallyOf(curKey);
  const results = useMemo(() => (week ? voteResults(week, curTally) : []), [week, curTally]);
  const votesOf = new Map(results.map((r) => [r.candidate.id, r]));
  const myPick = mine?.[curKey] ?? null;
  const shown = week?.players ?? [];
  const fan = week ? fanMvp(week, curTally) : null;
  const statTop = week?.players[0] ?? null;

  async function vote(c: VoteCandidate) {
    if (busy || c.id === myPick) return;
    setBusy(c.id);
    setMsg(null);
    const before = tallies;
    // 바로 화면에 반영 (실패하면 되돌림)
    if (tallies && tallies !== "error" && tallies.this.week === curKey) {
      const counts = { ...tallies.this.counts };
      if (myPick) counts[myPick] = Math.max(0, (counts[myPick] ?? 0) - 1);
      counts[c.id] = (counts[c.id] ?? 0) + 1;
      setTallies({ ...tallies, this: { ...tallies.this, counts, total: tallies.this.total + (myPick ? 0 : 1) } });
    }
    const r = await castVote(c.id);
    setBusy(null);
    if (r.ok) {
      setMine((m) => ({ ...(m ?? {}), [curKey]: c.id }));
      trackEvent("vote_cast", { player_no: c.id });
    } else {
      setTallies(before);
      setMsg(r.message);
      if (r.signedOut) setSignedIn(false);
    }
  }

  return (
    <>
      <section aria-labelledby="mvp-title" className="mt-4">
        <h2 id="mvp-title" className="text-h2 font-bold">
          이번 주 팬 MVP
          {curKey && <span className="ml-2 text-sub font-medium text-ink-3 tabular">{voteWeekLabel(curKey)}</span>}
        </h2>
        {!week ? (
          <div className="surface-card mt-3 rounded-container p-4">
            <p className="text-body text-ink-2">이번 주 첫 경기가 끝나면 후보가 나와요.</p>
          </div>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <SummaryTile label="팬 투표 1위" teams={teams} c={fan?.candidate ?? null} sub={fan ? `${fan.votes.toLocaleString("ko-KR")}표 · ${fan.pct}%` : "아직 표가 없어요"} />
              <SummaryTile label="우리 기록 1위" teams={teams} c={statTop} sub={statTop ? highlightText(statTop) : ""} />
            </div>
            <div className="mt-3 flex min-h-10 flex-wrap items-center justify-between gap-x-3 text-sub text-ink-2">
              {signedIn ? (
                <span>{myPick ? "내 표는 일요일 밤까지 바꿀 수 있어요." : "한 명을 골라 투표해 주세요. 한 주에 한 표예요."}</span>
              ) : (
                <LoginPrompt place="vote">로그인하면 투표할 수 있어요</LoginPrompt>
              )}
              {curTally && <span className="text-ink-3 tabular">{curTally.total.toLocaleString("ko-KR")}표</span>}
            </div>
            {msg && (
              <p role="alert" className="mt-1 text-sub text-ink-2">
                {msg}
              </p>
            )}
            <ol className="surface-card mt-2 divide-y divide-line rounded-container">
              {shown.map((c, i) => {
                const t = teamOf(teams, c.teamCode);
                const r = votesOf.get(c.id);
                const mineHere = myPick === c.id;
                return (
                  <li key={c.id} className="flex items-center gap-2 px-2 py-2.5 sm:gap-3 sm:px-3">
                    <span className="w-5 shrink-0 text-right text-sub font-bold text-ink-3 tabular">{i + 1}</span>
                    <PlayerAvatar photoUrl={c.photoUrl} nameKo={c.nameKo} color={t.color} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-1.5">
                        <Link href={`/player/${c.id}`} className="focus-ring min-w-0 truncate rounded-md text-body font-bold text-ink underline-offset-2 hover:underline">
                          {c.nameKo}
                        </Link>
                        <span className="flex shrink-0 items-center gap-1 text-caption text-ink-3">
                          <TeamLogo logoUrl={t.logoUrl} shortName={t.shortName} color={t.color} size={16} />
                          <span className="hidden sm:inline">{teamShortLabel(t.shortName)}</span>
                        </span>
                      </p>
                      <p className="flex min-w-0 items-center gap-1.5 text-caption tabular">
                        <span className="shrink-0 rounded-sm bg-surface-2 px-1.5 py-0.5 font-semibold text-ink">{highlightText(c)}</span>
                        <span className="truncate text-ink-2">{candidateLine(c)}</span>
                      </p>
                      {tallies && tallies !== "error" && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-sm bg-surface-2">
                            <span className="block h-full bg-series-1" style={{ width: `${r?.pct ?? 0}%` }} />
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-right text-caption text-ink-3 tabular">
                            {(r?.votes ?? 0).toLocaleString("ko-KR")}표 · {r?.pct ?? 0}%
                          </span>
                        </div>
                      )}
                    </div>
                    {signedIn && (
                      <button
                        type="button"
                        aria-pressed={mineHere}
                        aria-label={mineHere ? `${c.nameKo} 선수에게 투표함` : `${c.nameKo} 선수에게 투표`}
                        disabled={!!busy}
                        onClick={() => void vote(c)}
                        className={`focus-ring-inset h-10 w-14 shrink-0 rounded-control border text-sub font-semibold transition-colors duration-200 disabled:cursor-wait ${
                          mineHere ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2"
                        }`}
                      >
                        {mineHere ? "내 표" : "투표"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>

      {lastWeek && (
        <section aria-labelledby="last-title" className="mt-6">
          <h2 id="last-title" className="text-body font-bold">
            지난주 팬 MVP
            <span className="ml-2 text-sub font-medium text-ink-3 tabular">{voteWeekLabel(lastKey)}</span>
          </h2>
          <LastWeek week={lastWeek} tally={tallyOf(lastKey)} loading={!tallies} teams={teams} />
        </section>
      )}

      <ul className="mt-4 space-y-1 text-caption text-ink-3">
        <li>후보는 이번 주 뛴 팀마다 한 명, 그 주 가장 눈에 띈 기록을 낸 선수예요(경기당 득점 20·리바운드 10·어시스트 7·3점슛 3·스틸+블록 3 대비, 우리 규칙). 이번 주 {week?.minGames ?? 1}경기 이상 뛴 선수 중에서 골라요.</li>
        <li>로그인한 회원만 한 주에 한 표, 일요일 밤까지 바꿀 수 있어요. 표 수는 1분마다 새로 세요.</li>
      </ul>
    </>
  );
}

function SummaryTile({ label, c, sub, teams }: { label: string; c: VoteCandidate | null; sub: string; teams: Record<string, TeamInfo> }) {
  const t = c ? teamOf(teams, c.teamCode) : null;
  return (
    <div className="surface-card flex min-w-0 items-center gap-2 rounded-container p-3">
      {c && t && <PlayerAvatar photoUrl={c.photoUrl} nameKo={c.nameKo} color={t.color} size={40} />}
      <div className="min-w-0">
        <p className="text-caption text-ink-3">{label}</p>
        <p className="truncate text-body font-bold text-ink">{c?.nameKo ?? "–"}</p>
        <p className="truncate text-caption text-ink-2 tabular">{sub}</p>
      </div>
    </div>
  );
}

function LastWeek({ week, tally, loading, teams }: { week: VoteWeek; tally: VoteTally | null; loading: boolean; teams: Record<string, TeamInfo> }) {
  if (loading) return <Skeleton className="mt-2 h-20 w-full rounded-container" />;
  const fan = fanMvp(week, tally);
  const statTop = week.players[0] ?? null;
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <SummaryTile label="팬 투표 1위" teams={teams} c={fan?.candidate ?? null} sub={fan ? `${fan.votes.toLocaleString("ko-KR")}표 · ${fan.pct}%` : "표가 없었어요"} />
      <SummaryTile label="우리 기록 1위" teams={teams} c={statTop} sub={statTop ? highlightText(statTop) : ""} />
    </div>
  );
}
