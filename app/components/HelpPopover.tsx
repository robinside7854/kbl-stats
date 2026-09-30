"use client";
// 그 자리에서 뜨는 도움말 (ⓘ) — 용어 탭을 메뉴에서 뺀 대신 (2026-09-30 피드백 5차 #5, PLAN.md §13).
// - 누르면(클릭·탭·Enter) 열리고, 바깥을 누르거나 ESC·닫기 버튼으로 닫힌다. 한 번에 하나만 열린다(다른 ⓘ 를 열면 앞의 것이 닫힌다).
// - 내용은 lib/glossary helpContent / playerTypeHelp: 제목 · 한 줄 설명 · 계산식 한 줄 · "자세히"(용어 페이지 앵커 — 누를 때만 이동).
// - PC(640px 이상): 버튼 아래(모자라면 위)에 붙는 작은 상자. 모바일: 화면 아래에 붙는 시트(좌우 16px 여백).
// - 카드(overflow-hidden)·표 머리글·필터 시트 안에서도 잘리지 않게 body 로 포털한다. 열리면 상자로 초점을 옮기고,
//   닫으면 버튼으로 돌려준다. 상자 안에서 Tab 이 끝에 닿으면 닫고 버튼으로 돌아온다(포털이라 문서 끝으로 튀지 않게).
// - 접근성: 버튼 aria-expanded·aria-controls, 열린 동안 aria-describedby = 설명 문단. 상자는 비모달 role="dialog".
// - 화면에 늘 보이는 설명 글은 늘리지 않는다 — 설명은 이 상자 안에만.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { helpContent, type GlossaryKey, type HelpContent } from "@/lib/glossary";
import { IconClose, IconInfo } from "./icons";
import { useMedia } from "./useMedia";

/** 다른 팝오버가 열릴 때 보내는 이벤트 (한 번에 하나만) */
const OPEN_EVENT = "help-popover-open";

interface Props {
  /** 용어 키 (lib/glossary) — content 가 없으면 이것으로 내용을 만든다 */
  term?: GlossaryKey;
  /** 직접 준 내용 (선수 유형 라벨 등) */
  content?: HelpContent;
  /** 버튼 모양: icon = ⓘ 40×40(음수 여백으로 글줄 높이 유지) / compact = 표 머리글용 40×20 / 글자 버튼이면 children */
  compact?: boolean;
  className?: string;
  /** 글자 버튼(예: 카드의 유형 라벨). 주면 ⓘ 대신 이것을 누른다 */
  children?: React.ReactNode;
  /** 글자 버튼의 style (팀 색 글자 등) */
  style?: React.CSSProperties;
  /** 버튼 aria-label (없으면 "{제목} 설명") */
  ariaLabel?: string;
}

const PANEL_W = 320;
const GAP = 6;
const EDGE = 16;

export default function HelpPopover({ term, content, compact = false, className = "", children, style, ariaLabel }: Props) {
  const c = content ?? helpContent(term ?? "radarAxes");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const panelId = `help-${uid}`;
  const descId = `${panelId}-desc`;
  const wide = useMedia("(min-width: 640px)");

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  }, []);

  // PC 위치: 버튼 아래 왼쪽 맞춤, 화면 밖이면 안쪽으로 밀고, 아래 공간이 모자라면 위로
  const place = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const h = panelRef.current?.offsetHeight ?? 160;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(EDGE, b.left + b.width / 2 - 28), vw - EDGE - Math.min(PANEL_W, vw - 2 * EDGE));
    const below = b.bottom + GAP;
    const top = below + h > vh - EDGE && b.top - GAP - h > EDGE ? b.top - GAP - h : below;
    setPos({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (open && wide) place();
  }, [open, wide, place]);

  useEffect(() => {
    if (!open) return;
    // 한 번에 하나: 내가 열렸음을 알리고, 남이 열리면 닫는다
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: panelId }));
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== panelId) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(true);
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onMove = () => wide && place();
    window.addEventListener(OPEN_EVENT, onOther);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    // 열리면 상자로 초점 (스크린리더가 내용을 바로 읽는다)
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener(OPEN_EVENT, onOther);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, wide, place, close, panelId]);

  // 상자 안 Tab 순환 대신: 끝에서 Tab / 처음에서 Shift+Tab 이면 닫고 버튼으로
  function onPanelKey(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;
    const items = panelRef.current?.querySelectorAll<HTMLElement>("a,button");
    if (!items || items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const atEnd = !e.shiftKey && document.activeElement === last;
    const atStart = e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current);
    if (atEnd || atStart) {
      e.preventDefault();
      close(true);
    }
  }

  const label = ariaLabel ?? `${c.title} 설명`;
  const trigger = children ? (
    <button
      ref={btnRef}
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      aria-describedby={open ? descId : undefined}
      aria-label={ariaLabel}
      className={`focus-ring cursor-pointer ${className}`}
      style={style}
    >
      {children}
    </button>
  ) : (
    <button
      ref={btnRef}
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      aria-describedby={open ? descId : undefined}
      aria-label={label}
      className={`focus-ring inline-flex shrink-0 cursor-pointer items-center justify-center rounded-control align-middle transition-colors duration-200 hover:text-ink ${
        open ? "text-ink" : "text-ink-3"
      } ${compact ? "h-10 w-5" : "-mx-3 -my-3 h-10 w-10"} ${className}`}
      style={style}
    >
      <IconInfo size={16} />
    </button>
  );

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={c.title}
            aria-describedby={descId}
            tabIndex={-1}
            onKeyDown={onPanelKey}
            className={`surface-card fixed z-[60] rounded-card p-4 text-left font-normal normal-case tracking-normal text-ink outline-none ${
              wide ? "" : "inset-x-4 bottom-4"
            }`}
            style={wide ? { left: pos?.left ?? -9999, top: pos?.top ?? 0, width: PANEL_W, maxWidth: `calc(100vw - ${2 * EDGE}px)` } : undefined}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="pt-1 text-body font-bold leading-snug">{c.title}</p>
              <button
                type="button"
                onClick={() => close(true)}
                aria-label="설명 닫기"
                className="focus-ring -mr-2 -mt-2 inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-3 transition-colors duration-200 hover:text-ink"
              >
                <IconClose size={16} />
              </button>
            </div>
            <div id={descId}>
              <p className="mt-1 text-sub leading-relaxed text-ink-2">{c.short}</p>
              {c.formula && <p className="mt-2 rounded-control bg-surface-2 px-2.5 py-2 text-sub leading-relaxed text-ink">{c.formula}</p>}
            </div>
            <Link
              href={c.href}
              className="focus-ring mt-2 inline-flex h-10 items-center rounded-control text-sub font-semibold text-ink-2 underline underline-offset-4 transition-colors duration-200 hover:text-ink"
            >
              자세히
            </Link>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {trigger}
      {panel}
    </>
  );
}
