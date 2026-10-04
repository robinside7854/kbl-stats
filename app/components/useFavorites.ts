"use client";
// 즐겨찾기 목록 (이 브라우저의 localStorage). 같은 페이지의 여러 컴포넌트·다른 탭과 맞춘다(사용자 이벤트·storage 이벤트).
// 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 이번 방문 동안만 기억한다 — 화면은 그대로 동작.
// 로그인한 브라우저는 바꿀 때마다 계정에도 저장한다(account-client pushFavorites, 2026-10-04).
import { useCallback, useEffect, useState } from "react";
import { FAVORITES_KEY, parseFavorites, toggleFavorite } from "@/lib/favorites";
import { pushFavorites } from "./account-client";

const EVENT = "kbl-favorites-change";
let memory: string[] = [];

/** 이 브라우저 즐겨찾기 (계정 맞추기용) */
export function readFavorites(): string[] {
  return read();
}

/** 목록 통째로 바꾸기 — 계정 목록과 합칠 때 (계정으로 다시 보내지 않는다) */
export function replaceFavorites(list: string[]) {
  write(list);
}

function read(): string[] {
  try {
    return parseFavorites(window.localStorage.getItem(FAVORITES_KEY));
  } catch {
    return memory;
  }
}

function write(list: string[]) {
  memory = list;
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  } catch {
    // 저장 못 해도 이번 방문 동안은 memory 로
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** ready 가 false 인 동안(첫 그리기)은 빈 목록 — 정적 HTML 과 같게 */
export function useFavorites() {
  const [list, setList] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setList(read());
    sync();
    setReady(true);
    const onStorage = (e: StorageEvent) => e.key === FAVORITES_KEY && sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const toggle = useCallback((id: string) => {
    const next = toggleFavorite(read(), id);
    write(next);
    void pushFavorites(next);
  }, []);
  return { list, ready, toggle, has: (id: string) => list.includes(id) };
}
