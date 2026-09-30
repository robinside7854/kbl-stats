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
  /** 플레이어 카드 등급 색 (globals.css --grade-*) */
  gradeS: string;
  gradeSInk: string;
  gradeC: string;
  gradeCInk: string;
  gradeD: string;
  gradeDInk: string;
  gradeF: string;
  gradeFInk: string;
  /** 범주형 8색 (globals.css --cat-1…8, 고정 순서) — 팀 분포 산점도의 회색 팀 대체 색 */
  categorical: string[];
}

const LIGHT_FALLBACK: ThemeColors = {
  surface: "#fcfcfb",
  ink: "#0b0b0b",
  ink2: "#52514e",
  ink3: "#64635f",
  grid: "#dcdbd6",
  series1: "#2a78d6",
  series2: "#eb6834",
  gradeS: "#e1b95a",
  gradeSInk: "#3a2900",
  gradeC: "#e4e2dc",
  gradeCInk: "#2f2e2b",
  gradeD: "#d2d1cb",
  gradeDInk: "#4a4946",
  gradeF: "#ecebe7",
  gradeFInk: "#6b6a66",
  categorical: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
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
    gradeS: v("--grade-s", LIGHT_FALLBACK.gradeS),
    gradeSInk: v("--grade-s-ink", LIGHT_FALLBACK.gradeSInk),
    gradeC: v("--grade-c", LIGHT_FALLBACK.gradeC),
    gradeCInk: v("--grade-c-ink", LIGHT_FALLBACK.gradeCInk),
    gradeD: v("--grade-d", LIGHT_FALLBACK.gradeD),
    gradeDInk: v("--grade-d-ink", LIGHT_FALLBACK.gradeDInk),
    gradeF: v("--grade-f", LIGHT_FALLBACK.gradeF),
    gradeFInk: v("--grade-f-ink", LIGHT_FALLBACK.gradeFInk),
    categorical: LIGHT_FALLBACK.categorical.map((fb, i) => v(`--cat-${i + 1}`, fb)),
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
