"use client";
import { useEffect, useState } from "react";

/** 미디어 쿼리 일치 여부 (정적 HTML·첫 렌더는 false → 모바일 크기) */
export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

/**
 * 브라우저에서 처음 그린 뒤 true (정적 HTML·첫 렌더는 false).
 * 화면 아래쪽 큰 그림(슛 차트·세부 능력치)을 정적 HTML 에서 빼서 선수 페이지 결과물을 줄일 때 쓴다 (2026-10-14).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
