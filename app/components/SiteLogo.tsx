"use client";
// 상단 사이트 이름 왼쪽 KBL 리그 로고 (2026-10-01 사용자 요청). 주소는 data/codes/site.json 에만(원칙 1 — 화면 코드에 KBL 주소 없음).
// 공식 이미지 스위치·로드 실패는 TeamLogo 와 같은 useOfficialImage → 실패하면 "KBL" 글자 대체.
import type { CSSProperties } from "react";
import site from "@/data/codes/site.json";
import { useOfficialImage } from "./useOfficialImage";

export const SITE_NAME: string = site.name;
/** 상단 로고 옆 글자: 로고가 이미 "KBL" 이라 영문 KBL 을 뺀 이름 */
export const SITE_HEADER_NAME: string = site.headerName;

/** heightLg: PC(1024px 이상) 높이 — 2026-10-06 사용자: PC 는 로고도 크게 */
export default function SiteLogo({ height = 22, heightLg, className = "" }: { height?: number; heightLg?: number; className?: string }) {
  const { src, loaded, imgProps } = useOfficialImage(site.leagueLogoUrl);
  const vars = { "--logo-h": `${height}px`, "--logo-h-lg": `${heightLg ?? height}px` } as CSSProperties;
  return (
    <span className={`relative inline-flex h-(--logo-h) shrink-0 items-center lg:h-(--logo-h-lg) ${className}`} style={vars} aria-hidden="true">
      {!loaded && (
        <span
          className="inline-flex h-full items-center rounded-md bg-ink px-1.5 text-[calc(var(--logo-h)*0.55)] font-black leading-none tracking-tight text-surface lg:text-[calc(var(--logo-h-lg)*0.55)]"
        >
          KBL
        </span>
      )}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          {...imgProps}
          src={src}
          alt=""
          decoding="async"
          referrerPolicy="no-referrer"
          height={height}
          className={loaded ? "block h-full w-auto" : "absolute h-0 w-0 opacity-0"}
        />
      )}
    </span>
  );
}
