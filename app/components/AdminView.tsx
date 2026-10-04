"use client";
// 관리자 화면 본문 (/admin, 2026-10-04): 요약(회원 수·닉네임·연결·로그인 수단) → 응원팀별 인원 → 회원 목록(닉네임 찾기, 50명씩).
// 관리자가 아니면 내 로그인 번호를 보여 준다 — Vercel 환경변수 ADMIN_LOGIN_IDS 에 넣으면 관리자가 된다.
// GA4: admin_view (매개변수 없음, 목록을 불러왔을 때)
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PROVIDER_LABELS, type AdminMemberRow } from "@/lib/account";
import { fetchAdminMembers, type AdminResult } from "./account-client";
import type { AccountTeam } from "./AccountView";
import MemberBadge from "./MemberBadge";
import Skeleton from "./Skeleton";
import { trackEvent } from "./track";

const PAGE = 50;

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
  const [shown, setShown] = useState(PAGE);
  const teamOf = useMemo(() => new Map(teams.map((t) => [t.teamCode, t])), [teams]);

  const stats = useMemo(() => {
    const byTeam = new Map<string, number>();
    for (const m of members) if (m.teamCode) byTeam.set(m.teamCode, (byTeam.get(m.teamCode) ?? 0) + 1);
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
    return q ? members.filter((m) => (m.nickname ?? "").toLowerCase().includes(q) || m.shortId.toLowerCase().includes(q)) : members;
  }, [members, query]);

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
          <h2 className="text-body font-bold">응원팀</h2>
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
        <div className="p-4 pb-2">
          <label htmlFor="admin-search" className="text-sub font-semibold text-ink-2">
            닉네임·번호로 찾기
          </label>
          <input
            id="admin-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
            autoComplete="off"
            className="focus-ring mt-1 h-11 w-full rounded-control border border-line bg-surface px-3 text-base text-ink"
          />
          <p className="mt-1 text-sub text-ink-3">{filtered.length.toLocaleString("ko-KR")}명 · 새로 가입한 순</p>
        </div>
        {filtered.length === 0 ? (
          <p className="px-4 pb-4 text-body text-ink-2">맞는 회원이 없어요.</p>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_4rem_6rem_6rem] gap-3 border-b border-line px-4 py-2 text-caption font-semibold text-ink-3 md:grid">
              <span>닉네임</span>
              <span>응원팀</span>
              <span>로그인</span>
              <span className="text-right">즐겨찾기</span>
              <span className="text-right">가입</span>
              <span className="text-right">최근 수정</span>
            </div>
            <ul className="divide-y divide-line">
              {filtered.slice(0, shown).map((m) => {
                const t = m.teamCode ? teamOf.get(m.teamCode) : undefined;
                return (
                  <li
                    key={m.shortId + m.createdAt}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3 text-sub md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_4rem_6rem_6rem] md:items-center"
                  >
                    <div className="min-w-0 text-body md:order-1">
                      {m.nickname ? <MemberBadge nickname={m.nickname} teamColor={t?.color} /> : <span className="text-ink-3">닉네임 없음</span>}
                      <span className="ml-2 text-caption text-ink-3 tabular">#{m.shortId}</span>
                    </div>
                    <span className="text-right text-ink-3 tabular md:order-5">
                      <span className="md:hidden">가입 </span>
                      {kstDate(m.createdAt)}
                    </span>
                    <span className="truncate text-ink-2 md:order-2">{t ? t.name : m.teamCode ? `팀 ${m.teamCode}` : "응원팀 없음"}</span>
                    <span className="text-right text-ink-2 md:order-3 md:text-left">{m.logins.map((p) => PROVIDER_LABELS[p]).join(" · ") || "없음"}</span>
                    <span className="text-ink-2 tabular md:order-4 md:text-right">
                      <span className="md:hidden">즐겨찾기 </span>
                      {m.favoriteCount}
                    </span>
                    <span className="text-right text-ink-3 tabular md:order-6">
                      <span className="md:hidden">수정 </span>
                      {kstDate(m.updatedAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {filtered.length > shown && (
              <div className="p-4">
                <button
                  type="button"
                  onClick={() => setShown((n) => n + PAGE)}
                  className="focus-ring h-11 w-full cursor-pointer rounded-control border border-line bg-surface text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
                >
                  더 보기 ({(filtered.length - shown).toLocaleString("ko-KR")}명 남음)
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
