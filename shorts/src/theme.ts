// 스포츠 톤 (2026-10-02 사용자: "보고서 같다, 배경이 너무 베이지") — 어두운 바탕 + 흰 글자 + 팀 색 빛.
// 이름은 예전 그대로(paper = 바탕, ink = 글자)라 장면 코드는 손대지 않아도 된다. 액센트 = 농구공 주황 + 장면마다 그 선수의 팀 색.
// 득점 출처 4색은 사이트 범주형 팔레트(--cat-1~4)와 같은 값 — dataviz 검증기(종이 바탕 #f4f1ea)에서
// 밝기·채도·색약 구분·일반 구분 통과, 대비 경고 → 색 옆에 글자 라벨을 항상 붙인다.

import type { SourceKey } from "./types";

export const FPS = 30;
export const W = 1080;
export const H = 1920;

export const C = {
  paper: "#0E1014",
  paper2: "#1B1F27",
  ink: "#F5F5F2",
  ink2: "#B4B8C0",
  ink3: "#737985",
  rule: "#F5F5F2",
  accent: "#FF5A1F",
};

/** 장면 뒤 팀 색 빛 (오른쪽 위에서 퍼짐) */
export const glow = (color: string, x = 85, y = 12) =>
  `radial-gradient(circle at ${x}% ${y}%, ${color}66 0%, ${color}22 35%, transparent 65%)`;

export const SOURCE_COLOR: Record<SourceKey, string> = {
  paint: "#2a78d6",
  mid: "#eb6834",
  three: "#1baf7a",
  ft: "#eda100",
};

export const FONT = "Pretendard Variable, Pretendard, sans-serif";

/** 유튜브 쇼츠 화면에서 가려지는 곳을 피한 본문 영역 (위 = 상단 여백, 아래 = 제목·채널명 자리) */
export const SAFE = { top: 120, bottom: 1440, left: 60, right: 1020 };

/** 어두운 바탕에서 글자로 쓸 팀 색 — 어두운 색(남색·검정)은 흰색을 섞어 밝힌다 */
export function onDark(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lin = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  if (lum >= 0.12) return hex;
  const mix = lum < 0.04 ? 0.55 : 0.4;
  const out = rgb.map((v) => Math.round(v + (255 - v) * mix));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
