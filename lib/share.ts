// 공유 미리보기 (2026-10-04 사용자 요청: 카카오톡·외부 공유) — 순수 함수만.
// 카카오톡·페이스북·X 는 페이지의 Open Graph 메타(og:title·og:description·og:image)를 읽어 링크 카드를 그린다.
// 이미지는 빌드 전에 scripts/build-og.tsx 가 public/og/ 에 PNG 로 만든다(정적 파일 — 서버 없이 그대로 배포).
// 주소의 기준(도메인)은 data/codes/site.json siteUrl 한 곳.
import type { Metadata } from "next";
import site from "../data/codes/site.json";

export const SITE_URL: string = site.siteUrl;
export const SITE_NAME: string = site.name;

/** 공유 이미지 크기 — 카카오톡·페이스북 권장 1.91:1 */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** 공유 이미지 경로 (public/og 아래, scripts/build-og.tsx 와 같은 규칙) */
export const ogImagePath = {
  default: () => "/og/default.png",
  records: () => "/og/records.png",
  game: () => "/og/game.png",
  player: (playerNo: string) => `/og/player/${encodeURIComponent(playerNo)}.png`,
  leaders: (seasonCode: number) => `/og/leaders/${seasonCode}.png`,
};

export interface ShareInput {
  /** 브라우저 탭·공유 카드 제목 */
  title: string;
  description: string;
  /** 이 페이지 경로, 예: "/player/290381" (공유 주소 og:url) */
  path: string;
  /** 공유 이미지 경로 (없으면 기본 이미지) */
  image?: string;
  /** 이미지 대체 글 */
  imageAlt?: string;
}

/**
 * 페이지 metadata 한 벌: 제목·설명 + Open Graph(카카오톡·페이스북) + X 카드.
 * Next 는 자식 페이지가 openGraph 를 쓰면 부모 것을 통째로 바꾸므로 페이지마다 이 함수로 전부 채운다.
 */
export function shareMetadata({ title, description, path, image, imageAlt }: ShareInput): Metadata {
  const img = { url: image ?? ogImagePath.default(), width: OG_WIDTH, height: OG_HEIGHT, alt: imageAlt ?? title };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "ko_KR", url: path, title, description, images: [img] },
    twitter: { card: "summary_large_image", title, description, images: [img.url] },
  };
}

/** 공유 버튼이 GA 에 보내는 화면 이름: 주소 첫 마디 ("/player/1" → "player", "/" → "home") */
export function sharePageOf(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean);
  if (seg.length === 0) return "home";
  if (seg[0] === "season" && seg[2]) return seg[2];
  return seg[0];
}
