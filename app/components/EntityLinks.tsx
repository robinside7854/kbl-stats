"use client";
// 선수·팀 이름/사진을 그 페이지로 잇는 링크 (2026-10-14 사용자: 서비스 어디서든 선수·팀을 누르면 그 페이지로).
// 팀 링크는 GA4 team_select {team_code, place} 를 남긴다(선수 링크는 page_view 로 충분). 코드가 비면 링크 없이 그대로 그린다.
import Link from "next/link";
import { trackEvent } from "./track";

export function teamPageHref(code: string, season?: number | null): string {
  return season ? `/team/${code}?season=${season}` : `/team/${code}`;
}

export function playerPageHref(id: string, season?: number | null): string {
  return season ? `/player/${id}?season=${season}` : `/player/${id}`;
}

interface TeamLinkProps {
  code: string | null | undefined;
  season?: number | null;
  /** GA4 team_select place */
  place: string;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}

export function TeamLink({ code, season, place, className = "", children, ...rest }: TeamLinkProps) {
  if (!code) return <span className={className}>{children}</span>;
  return (
    <Link
      href={teamPageHref(code, season)}
      onClick={() => trackEvent("team_select", { team_code: code, place })}
      className={`focus-ring rounded-md transition-colors duration-200 hover:underline underline-offset-2 ${className}`}
      aria-label={rest["aria-label"]}
    >
      {children}
    </Link>
  );
}

interface PlayerLinkProps {
  id: string | null | undefined;
  season?: number | null;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
  tabIndex?: number;
}

export function PlayerLink({ id, season, className = "", children, ...rest }: PlayerLinkProps) {
  if (!id) return <span className={className}>{children}</span>;
  return (
    <Link href={playerPageHref(id, season)} className={`focus-ring rounded-md ${className}`} aria-label={rest["aria-label"]} tabIndex={rest.tabIndex}>
      {children}
    </Link>
  );
}
