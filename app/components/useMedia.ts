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
