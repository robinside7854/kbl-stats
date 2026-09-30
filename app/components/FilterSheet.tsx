"use client";
// 필터 버튼 + 적용 중 요약 칩 + 필터 패널 (디자인 점검 2026-09-30 A2).
// 화면마다 1차 컨트롤 하나만 늘 보이고(순위표 부문 칩, 선수 탭 검색, 팀 분포 지표·팀), 나머지 필터는 여기로 모은다.
// - 모바일·태블릿(<1024px): 아래에서 올라오는 시트. 포커스 가둠(Tab 순환), ESC·바깥 누르기로 닫힘, 뒤 페이지 스크롤 잠금,
//   닫으면 "필터" 버튼으로 포커스를 돌려준다.
// - PC(≥1024px): 버튼 아래 인라인 패널로 펼친다 (덮개 없음).
// 필터 값은 바꾸는 즉시 적용된다(각 화면이 주소 쿼리에 남김). 시트 아래 "n명 보기"는 결과를 확인하며 닫는 버튼.
// 요약 칩(chips)의 ✕ 는 그 항목만 기본값으로 — 칩 목록과 되돌리기는 lib/ 함수(leaderFilterChips 등)가 만든다.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconClose, IconFilter } from "./icons";
import { useMedia } from "./useMedia";

export interface ActiveFilterChip {
  key: string;
  label: string;
  onClear: () => void;
}

interface Props {
  chips: ActiveFilterChip[];
  /** 전부 기본값으로 (1차 컨트롤은 그대로) */
  onReset: () => void;
  /** 시트 아래 확인 버튼 글자, 예: "142명 보기" */
  resultText: string;
  children: ReactNode;
  /** 버튼 줄 오른쪽 끝에 붙일 것 (예: 선수 수) */
  trailing?: ReactNode;
}

/** 시트 안 한 묶음 (제목 + 컨트롤) */
export function FilterGroup({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-1.5 text-sub font-semibold text-ink-2">{label}</p>
      {children}
      {hint && <p className="mt-1.5 text-sub text-ink-3">{hint}</p>}
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function FilterSheet({ chips, onReset, resultText, children, trailing }: Props) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMedia("(min-width: 1024px)");
  const panelId = useId();
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheet = open && !isDesktop;

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  // 모바일 시트: 스크롤 잠금 · 첫 요소 포커스 · ESC · Tab 가두기
  useEffect(() => {
    if (!sheet) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = sheetRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  // PC 인라인 패널: ESC 로 접기
  useEffect(() => {
    if (!open || !isDesktop) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isDesktop]);

  const count = chips.length;

  const footer = (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onReset}
        disabled={count === 0}
        className="focus-ring h-11 cursor-pointer rounded-lg border border-line bg-surface px-4 text-body font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2 disabled:cursor-default disabled:opacity-50"
      >
        초기화
      </button>
      <button
        type="button"
        onClick={close}
        className="focus-ring h-11 flex-1 cursor-pointer rounded-lg bg-ink px-4 text-body font-semibold text-bg transition-opacity duration-200 hover:opacity-90"
      >
        {resultText}
      </button>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-haspopup={isDesktop ? undefined : "dialog"}
          onClick={() => (open ? close() : setOpen(true))}
          className={`focus-ring inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-body font-semibold transition-colors duration-200 ${
            open || count > 0 ? "border-ink text-ink" : "border-line text-ink-2 hover:text-ink"
          } bg-surface hover:bg-surface-2`}
        >
          <IconFilter size={16} />
          필터
          {count > 0 && (
            <span className="tabular inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-ink px-1 text-sub font-bold text-bg">
              {count}
              <span className="sr-only">개 적용 중</span>
            </span>
          )}
        </button>
        {chips.map((c) => (
          <span
            key={c.key}
            className="inline-flex h-10 items-center rounded-lg border border-line bg-surface-2 pl-3 text-body font-semibold text-ink"
          >
            {c.label}
            <button
              type="button"
              onClick={c.onClear}
              aria-label={`${c.label} 필터 해제`}
              className="focus-ring-inset flex h-10 w-9 cursor-pointer items-center justify-center rounded-lg text-ink-3 transition-colors duration-200 hover:text-ink"
            >
              <IconClose size={16} />
            </button>
          </span>
        ))}
        {trailing && <span className="ml-auto text-sub text-ink-3">{trailing}</span>}
      </div>

      {/* PC: 인라인 패널 */}
      {open && isDesktop && (
        <div id={panelId} role="region" aria-label="필터 설정" className="surface-card mt-3 rounded-2xl p-4">
          <div className="grid gap-4 lg:grid-cols-2">{children}</div>
          <div className="mt-4 max-w-sm">{footer}</div>
        </div>
      )}

      {/* 모바일: 바텀시트 */}
      {sheet && (
        <div className="fixed inset-0 z-50">
          <div aria-hidden className="absolute inset-0 bg-black/45" onClick={close} />
          <div
            ref={sheetRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-line bg-surface"
          >
            <div className="flex items-center justify-between px-4 pb-1 pt-3">
              <h2 id={titleId} className="text-h2 font-bold">
                필터
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="필터 닫기"
                className="focus-ring -mr-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-ink-2 transition-colors duration-200 hover:text-ink"
              >
                <IconClose size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
            <div className="border-t border-line px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>
          </div>
        </div>
      )}
    </div>
  );
}
