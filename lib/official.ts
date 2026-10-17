// KBL 공홈으로 가는 링크 (2026-10-17 사용자 요청) — 주소는 data/codes/site.json officialSite 한 곳(원칙 1: 화면에 KBL 주소를 직접 쓰지 않는다)
import site from "@/data/codes/site.json";

export function officialHomeUrl(): string {
  return site.officialSite.home;
}

/** 공홈 경기 기록 화면 (gmkey 예: S49G01N1) */
export function officialGameUrl(gmkey: string): string {
  return site.officialSite.gameRecord.replace("{gmkey}", encodeURIComponent(gmkey));
}
