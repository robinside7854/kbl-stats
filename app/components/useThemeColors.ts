"use client";
// CSS 변수(globals.css)의 실제 색을 읽어 차트(SVG)에 넘긴다.
// SVG 속성에 var()를 직접 쓰면 이미지 저장 시 색이 빠질 수 있어서, 계산된 hex를 쓴다.
import { useEffect, useState } from "react";

export interface ThemeColors {
  surface: string;
  ink: string;
  ink2: string;
  ink3: string;
  grid: string;
  series1: string;
  series2: string;
}

const LIGHT_FALLBACK: ThemeColors = {
  surface: "#fcfcfb",
  ink: "#0b0b0b",
  ink2: "#52514e",
  ink3: "#6b6a66",
  grid: "#dcdbd6",
  series1: "#2a78d6",
  series2: "#eb6834",
};

function read(): ThemeColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  return {
    surface: v("--surface", LIGHT_FALLBACK.surface),
    ink: v("--ink", LIGHT_FALLBACK.ink),
    ink2: v("--ink-2", LIGHT_FALLBACK.ink2),
    ink3: v("--ink-3", LIGHT_FALLBACK.ink3),
    grid: v("--grid", LIGHT_FALLBACK.grid),
    series1: v("--series-1", LIGHT_FALLBACK.series1),
    series2: v("--series-2", LIGHT_FALLBACK.series2),
  };
}

export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(LIGHT_FALLBACK);
  useEffect(() => {
    setColors(read());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setColors(read());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return colors;
}
