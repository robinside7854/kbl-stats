"use client";
// 상단 사이트 이름 왼쪽 KBL 리그 로고 (2026-10-01 사용자 요청). 주소는 data/codes/site.json 에만(원칙 1 — 화면 코드에 KBL 주소 없음).
// 공식 이미지 스위치·로드 실패는 TeamLogo 와 같은 useOfficialImage → 실패하면 "KBL" 글자 대체.
import site from "@/data/codes/site.json";
import { useOfficialImage } from "./useOfficialImage";

export const SITE_NAME: string = site.name;

export default function SiteLogo({ height = 22, className = "" }: { height?: number; className?: string }) {
  const { src, loaded, imgProps } = useOfficialImage(site.leagueLogoUrl);
  return (
    <span className={`relative inline-flex shrink-0 items-center ${className}`} style={{ height }} aria-hidden="true">
      {!loaded && (
        <span
          className="inline-flex items-center rounded-md bg-ink px-1.5 font-black leading-none tracking-tight text-surface"
          style={{ height, fontSize: Math.round(height * 0.55) }}
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
          className={loaded ? "block w-auto" : "absolute h-0 w-0 opacity-0"}
          style={{ height }}
        />
      )}
    </span>
  );
}
