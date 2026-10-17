"use client";
// 관리자 화면 본문 (/admin, 2026-10-04): 요약(회원 수·닉네임·연결·로그인 수단) → 응원팀별 인원 → 회원 카드 여러 열(닉네임 찾기, 가입·최근 방문 정렬, 10명씩 쪽 나눔 — 2026-10-17)
// GA4 filter_change screen=admin filter=sort(joined/visited)·page.
// 관리자가 아니면 내 로그인 번호를 보여 준다 — Vercel 환경변수 ADMIN_LOGIN_IDS 에 넣으면 관리자가 된다.
// GA4: admin_view (매개변수 없음, 목록을 불러왔을 때)
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ADMIN_PAGE_SIZE, adminPageCount, PROVIDER_LABELS, sortAdminMembers, type AdminMemberRow, type AdminSort } from "@/lib/account";
import { IconChevronLeft, IconChevronRight } from "./icons";
import Segmented from "./Segmented";
import { fetchAdminMembers, type AdminResult } from "./account-client";
import type { AccountTeam } from "./AccountView";
import MemberBadge from "./MemberBadge";
import Skeleton from "./Skeleton";
import { trackEvent, trackFilters } from "./track";


function kstDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`surface-card rounded-container p-4 ${className}`}>{children}</section>;
}

export default function AdminView({ teams }: { teams: AccountTeam[] }) {
  const [result, setResult] = useState<AdminResult | null>(null);
  useEffect(() => {
    void fetchAdminMembers().then((r) => {
      setResult(r);
      if (r.status === "ok") trackEvent("admin_view");
    });
  }, []);

  if (!result) return <Skeleton className="h-64 w-full rounded-container" />;
  if (result.status === "signed_out") {
    return (
      <Card>
        <p className="text-body text-ink-2">관리자 계정으로 로그인해 주세요.</p>
        <Link href="/me" className="focus-ring mt-3 inline-flex h-11 items-center rounded-control bg-ink px-4 text-body font-bold text-bg">
          로그인하러 가기
        </Link>
      </Card>
    );
  }
  if (result.status === "forbidden") {
    return (
      <Card>
        <h2 className="text-h2 font-bold">관리자 권한이 없어요</h2>
        <p className="mt-2 text-body text-ink-2">
          관리자로 쓰려면 아래 로그인 번호를 Vercel 환경변수 <code className="font-semibold">ADMIN_LOGIN_IDS</code> 에 넣고 다시 배포해 주세요. 여러 개면 쉼표로 이어 적어요.
        </p>
        <ul className="mt-3 space-y-2">
          {result.myLoginIds.map((id) => (
            <li key={id} className="break-all rounded-card border border-line bg-surface-2 px-3 py-2 text-sub font-semibold text-ink tabular">
              {id}
            </li>
          ))}
        </ul>
      </Card>
    );
  }
  if (result.status === "error") {
    return (
      <Card>
        <p className="text-body text-ink-2">회원 목록을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</p>
      </Card>
    );
  }
  return <MemberList members={result.members} teams={teams} />;
}

function MemberList({ members, teams }: { members: AdminMemberRow[]; teams: AccountTeam[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<AdminSort>("joined");
  const [page, setPage] = useState(1);
  const teamOf = useMemo(() => new Map(teams.map((t) => [t.teamCode, t])), [teams]);

  const stats = useMemo(() => {
    const byTeam = new Map<string, number>();
    for (const m of members) for (const c of m.teamCodes) byTeam.set(c, (byTeam.get(c) ?? 0) + 1);
    return {
      total: members.length,
      named: members.filter((m) => m.nickname).length,
      linked: members.filter((m) => m.logins.length > 1).length,
      naver: members.filter((m) => m.logins.includes("naver")).length,
      google: members.filter((m) => m.logins.includes("google")).length,
      byTeam: [...byTeam.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? members.filter((m) => (m.nickname ?? "").toLowerCase().includes(q) || m.shortId.toLowerCase().includes(q)) : members;
    return sortAdminMembers(list, sort);
  }, [members, query, sort]);
  const pages = adminPageCount(filtered.length);
  const current = Math.min(page, pages);
  const pageRows = filtered.slice((current - 1) * ADMIN_PAGE_SIZE, current * ADMIN_PAGE_SIZE);
  const goPage = (n: number) => {
    setPage(Math.max(1, Math.min(pages, n)));
    trackFilters("admin", { page: String(n) });
  };

  const tiles: [string, number][] = [
    ["전체 회원", stats.total],
    ["닉네임 정함", stats.named],
    ["계정 연결", stats.linked],
    ["네이버 로그인", stats.naver],
    ["구글 로그인", stats.google],
  ];

  return (
    <div className="space-y-4">
      <Card>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {tiles.map(([label, n]) => (
            <div key={label}>
              <dt className="text-sub text-ink-3">{label}</dt>
              <dd className="text-h2 font-black tabular">{n.toLocaleString("ko-KR")}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {stats.byTeam.length > 0 && (
        <Card>
          <h2 className="text-body font-bold">응원팀 (여러 팀 응원은 팀마다 셈)</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {stats.byTeam.map(([code, n]) => {
              const t = teamOf.get(code);
              return (
                <li key={code} className="inline-flex h-10 items-center gap-2 rounded-control border border-line px-3 text-sub">
                  <MemberBadge nickname={t?.name ?? `팀 ${code}`} teamColor={t?.color} />
                  <span className="tabular text-ink-2">{n}명</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <section className="surface-card rounded-container">
        <div className="flex flex-wrap items-end gap-3 p-4 pb-3">
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="admin-search" className="text-sub font-semibold text-ink-2">
              닉네임·번호로 찾기
            </label>
            <input
              id="admin-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              autoComplete="off"
              className="focus-ring mt-1 h-11 w-full rounded-control border border-line bg-surface px-3 text-base text-ink"
            />
          </div>
          <Segmented<AdminSort>
            label="정렬"
            options={[
              { value: "joined", label: "가입 순" },
              { value: "visited", label: "최근 방문 순" },
            ]}
            value={sort}
            onChange={(v) => {
              setSort(v);
              setPage(1);
              trackFilters("admin", { sort: v });
            }}
          />
        </div>
        <p className="px-4 pb-3 text-sub text-ink-3">
          {filtered.length.toLocaleString("ko-KR")}명 · {sort === "joined" ? "새로 가입한 순" : "최근 방문한 순"}
        </p>
        {filtered.length === 0 ? (
          <p className="px-4 pb-4 text-body text-ink-2">맞는 회원이 없어요.</p>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              {pageRows.map((m) => {
                const t = m.teamCodes[0] ? teamOf.get(m.teamCodes[0]) : undefined;
                const firstTeam = m.teamCodes[0] ? (teamOf.get(m.teamCodes[0])?.name ?? `팀 ${m.teamCodes[0]}`) : null;
                const teamText = firstTeam ? (m.teamCodes.length > 1 ? `${firstTeam} 외 ${m.teamCodes.length - 1}` : firstTeam) : "없음";
                const rows: [string, string][] = [
                  ["응원팀", teamText],
                  ["로그인", m.logins.map((p) => PROVIDER_LABELS[p]).join(" · ") || "없음"],
                  ["즐겨찾기·좋아요", `${m.favoriteCount} · ${m.likeCount}`],
                  ["가입", kstDate(m.createdAt)],
                  ["최근 방문", m.lastSeenAt ? kstDate(m.lastSeenAt) : "기록 없음"],
                ];
                return (
                  <li key={m.shortId + m.createdAt} className="rounded-card border border-line p-3">
                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                      {m.nickname ? <MemberBadge nickname={m.nickname} teamColor={t?.color} /> : <span className="text-body text-ink-3">닉네임 없음</span>}
                      <span className="shrink-0 text-caption text-ink-3 tabular">#{m.shortId}</span>
                    </div>
                    <dl className="mt-2 space-y-1 text-sub">
                      {rows.map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between gap-3 whitespace-nowrap">
                          <dt className="shrink-0 text-ink-3">{k}</dt>
                          <dd className="tabular text-ink-2" title={k === "응원팀" ? m.teamCodes.map((c) => teamOf.get(c)?.name ?? c).join(" · ") : undefined}>
                            {v}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                );
              })}
            </ul>
            {pages > 1 && (
              <nav aria-label="쪽" className="flex flex-wrap items-center justify-center gap-1 border-t border-line p-3">
                <PageButton label="이전 쪽" disabled={current <= 1} onClick={() => goPage(current - 1)}>
                  <IconChevronLeft size={16} />
                </PageButton>
                {Array.from({ length: pages }, (_, k) => k + 1).map((n) => (
                  <PageButton key={n} label={`${n}쪽`} current={n === current} onClick={() => goPage(n)}>
                    {n}
                  </PageButton>
                ))}
                <PageButton label="다음 쪽" disabled={current >= pages} onClick={() => goPage(current + 1)}>
                  <IconChevronRight size={16} />
                </PageButton>
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function PageButton({ children, label, current, disabled, onClick }: { children: React.ReactNode; label: string; current?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`focus-ring flex h-10 min-w-10 cursor-pointer items-center justify-center rounded-control px-2 text-body font-semibold tabular transition-colors duration-200 disabled:cursor-default disabled:text-ink-3 ${
        current ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}
