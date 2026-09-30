"use client";
// 검색 색인 받기 — 우리 사이트의 정적 파일 /search-index.json (빌드 전 scripts/build-search-index.ts 가 생성).
// 처음 필요할 때 한 번만 받아 모듈 변수에 둔다 — KBL 서버 호출이 아니므로 원칙 1·3 위반 아님.
// 상단 검색창(PlayerSearch)과 비교 탭(선수 → 뛴 시즌 칩)이 같이 쓴다.
import type { SearchEntry } from "@/lib/types";

let indexPromise: Promise<SearchEntry[]> | null = null;

export function loadSearchIndex(): Promise<SearchEntry[]> {
  if (!indexPromise) {
    indexPromise = fetch("/search-index.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<SearchEntry[]>;
      })
      .catch((e) => {
        indexPromise = null; // 실패하면 다음에 다시 시도
        throw e;
      });
  }
  return indexPromise;
}
