"use client";
// 선수 상세의 떠 있는 시즌 바 (2026-10-01 사용자 요청: 시즌을 바꾸려고 맨 위로 올라가지 않게).
// 위쪽 시즌 칩 줄(anchor)이 화면 밖으로 나가면 나타난다. 모바일은 하단 탭 바 바로 위 가운데, PC 는 오른쪽 아래.
// ‹ 이전 시즌 · 시즌 고르기 · 다음 시즌 › — 고르면 카드·추이 강조·슛 차트·비슷한 시즌이 함께 바뀐다(부모 상태).
import { useEffect, useState } from "react";
import { IconChevronRight } from "./icons";

interface Props {
  /** 시즌 코드 (오름차순) */
  codes: number[];
  season: number;
  labelOf: (code: number) => string;
  primeSeason?: number | null;
  onChange: (code: number) => void;
  /** 이 요소가 화면에 보이는 동안에는 숨는다 (위쪽 시즌 칩 줄). 요소가 바뀌면 다시 관찰한다 */
  anchor: HTMLElement | null;
}

export default function FloatingSeasonBar({ codes, season, labelOf, primeSeason, onChange, anchor }: Props) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = anchor;
    if (!el) return;
    // 칩 줄의 아래쪽이 화면 위로 지나갔으면 보인다. 스크롤마다 위치로 판단한다 —
    // IntersectionObserver 는 칩 줄이 화면 아래에서 위로 한 번에 건너뛰면(빠른 스크롤·앵커 이동) 알림이 오지 않아 쓰지 않는다
    let raf = 0;
    const check = () => {
      raf = 0;
      setShow(el.getBoundingClientRect().bottom < 0);
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [anchor]);

  if (codes.length < 2) return null;
  const i = codes.indexOf(season);
  const prev = i > 0 ? codes[i - 1] : null;
  const next = i >= 0 && i < codes.length - 1 ? codes[i + 1] : null;
  const btn =
    "focus-ring flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink disabled:cursor-default disabled:opacity-40";

  return (
    <div
      role="region"
      aria-label="시즌 바꾸기"
      aria-hidden={!show}
      className={`surface-card fixed bottom-[calc(var(--bottom-nav-h)+0.75rem)] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-container p-1 transition-[opacity,transform] duration-200 md:bottom-6 md:left-auto md:right-6 md:translate-x-0 ${
        show ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <button type="button" className={btn} disabled={prev === null} tabIndex={show ? 0 : -1} onClick={() => prev !== null && onChange(prev)} aria-label="이전 시즌">
        <IconChevronRight size={20} className="rotate-180" />
      </button>
      <select
        aria-label="카드 시즌"
        tabIndex={show ? 0 : -1}
        className="focus-ring h-10 cursor-pointer rounded-control border border-line bg-surface px-2 text-base font-semibold text-ink tabular"
        value={season}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {[...codes].reverse().map((c) => (
          <option key={c} value={c}>
            {labelOf(c)}
            {c === primeSeason ? " · 프라임" : ""}
          </option>
        ))}
      </select>
      <button type="button" className={btn} disabled={next === null} tabIndex={show ? 0 : -1} onClick={() => next !== null && onChange(next)} aria-label="다음 시즌">
        <IconChevronRight size={20} />
      </button>
    </div>
  );
}
