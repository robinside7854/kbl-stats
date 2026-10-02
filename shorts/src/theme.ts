// 매거진 톤 — 종이 바탕 + 잉크 + 선. 액센트는 장면마다 그 선수의 팀 색 하나.
// 득점 출처 4색은 사이트 범주형 팔레트(--cat-1~4)와 같은 값 — dataviz 검증기(종이 바탕 #f4f1ea)에서
// 밝기·채도·색약 구분·일반 구분 통과, 대비 경고 → 색 옆에 글자 라벨을 항상 붙인다.

import type { SourceKey } from "./types";

export const FPS = 30;
export const W = 1080;
export const H = 1920;

export const C = {
  paper: "#F4F1EA",
  paper2: "#E9E4D8",
  ink: "#141414",
  ink2: "#4A4741",
  ink3: "#8C877D",
  rule: "#141414",
};

export const SOURCE_COLOR: Record<SourceKey, string> = {
  paint: "#2a78d6",
  mid: "#eb6834",
  three: "#1baf7a",
  ft: "#eda100",
};

export const FONT = "Pretendard Variable, Pretendard, sans-serif";

/** 유튜브 쇼츠 화면에서 가려지는 곳을 피한 본문 영역 (위 = 상단 여백, 아래 = 제목·채널명 자리) */
export const SAFE = { top: 120, bottom: 1440, left: 60, right: 1020 };
