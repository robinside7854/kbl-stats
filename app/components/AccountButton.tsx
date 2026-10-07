"use client";
// 헤더 계정 버튼 (2026-10-04): 로그인 전 "로그인", 로그인 뒤 응원팀 색 점 + 닉네임 → /me.
// 로그인 기능이 꺼져 있으면(설정 전·미리보기 배포) 아무것도 그리지 않는다.
// 로그인한 적 있는 브라우저에서만 /api/me 를 부르고(account-client), 이번 방문에 한 번 즐겨찾기를 계정과 맞춘다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { enabledLoginProviders, type MemberView } from "@/lib/account";
import type { TeamColor } from "@/lib/types";
import teamColors from "@/data/codes/team-colors.json";
import { ACCOUNT_EVENT, cachedMember, fetchMe, hasSignedInHint, lastKnownMember, syncFavorites } from "./account-client";
import { IconPlayer } from "./icons";
import MemberBadge from "./MemberBadge";
import { setUserProperties, trackEvent } from "./track";

const COLORS = (teamColors as unknown as { byTeamCode: Record<string, TeamColor | undefined> }).byTeamCode;

/** active: 지금 /me·/admin 화면 — 하단 탭처럼 파란색으로 표시 (2026-10-05 사용자) */
export default function AccountButton({ active = false }: { active?: boolean }) {
  const enabled = enabledLoginProviders().length > 0;
  const [member, setMember] = useState<MemberView | null>(null);

  useEffect(() => {
    if (!enabled) return;
    // 로그인한 적 있는 브라우저는 서버 확인 전에도 마지막으로 본 내 정보를 바로 보여 준다
    const refresh = () => setMember(hasSignedInHint() ? cachedMember() ?? lastKnownMember() : null);
    refresh();
    if (hasSignedInHint()) {
      void fetchMe().then((r) => {
        // 진짜 로그아웃(401)일 때만 "로그인"으로. 서버 오류는 마지막 정보를 그대로 둔다
        if (r.status === "signed_out") return setMember(null);
        if (r.status !== "signed_in") return;
        setMember(r.member);
        void syncFavorites(r.member);
      });
    }
    window.addEventListener(ACCOUNT_EVENT, refresh);
    return () => window.removeEventListener(ACCOUNT_EVENT, refresh);
  }, [enabled]);

  // GA4 사용자 속성: 로그인 여부·대표 응원팀 (화면마다 헤더가 있어 여기서 한 번)
  useEffect(() => {
    if (!enabled) return;
    setUserProperties({ signed_in: member ? "yes" : "no", support_team: member?.teamCode ?? "none" });
  }, [enabled, member]);

  if (!enabled) return null;
  const color = member?.teamCode ? COLORS[member.teamCode] ?? null : null;
  const label = member ? member.nickname ?? "내 계정" : "로그인";
  return (
    <Link
      href="/me"
      onClick={() => trackEvent("nav_click", { menu: member ? "내 계정" : "로그인", place: "top" })}
      aria-label={member ? `내 계정: ${label}` : "로그인"}
      aria-current={active ? "page" : undefined}
      className={`focus-ring inline-flex h-10 min-w-10 max-w-[10rem] shrink-0 items-center justify-center gap-1.5 rounded-control border px-2.5 text-sub font-semibold transition-colors duration-200 ${
        active
          ? "border-series-1 bg-series-1/15 text-series-1"
          : "border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {member ? (
        <>
          <span className="relative sm:hidden">
            <IconPlayer size={20} />
            {/* deslop-ignore-next-line 19 */}
            {color && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface" style={{ backgroundColor: color.primary }} />}
          </span>
          <span className="hidden min-w-0 sm:inline-flex">
            <MemberBadge nickname={label} teamColor={color} />
          </span>
        </>
      ) : (
        <>
          <IconPlayer size={20} />
          <span className="hidden sm:inline">로그인</span>
        </>
      )}
    </Link>
  );
}
