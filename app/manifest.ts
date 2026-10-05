// 앱 설치 설정 (2026-10-05 사용자: 앱처럼 설치) — Next 가 /manifest.webmanifest 로 내보내고 모든 화면 <head> 에 연결한다.
// 설치하면 홈 화면 아이콘으로 주소창 없이 전체 화면(standalone)으로 열린다 — 삼성 인터넷 "위로 가기" 버튼 같은 브라우저 버튼도 없다.
// 아이콘은 public/icons (scripts/build-app-icons.ts 로 만든 PNG, 그림 = app/icon.svg). 오프라인 저장(서비스 워커)은 하지 않는다.
import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/share";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "KBL 스탯",
    description: "KBL 선수 기록·경기 일정·리더보드를 보는 비영리 팬 프로젝트",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ko",
    // 안드로이드 시작 화면 배경 = 리그 남색 (2026-10-06 사용자: 시안 A — 아이콘 바탕과 같아 그림만 떠 보이게, 다크 모드에서도 눈부시지 않게)
    background_color: "#011B6A",
    theme_color: "#f4f4f1",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
