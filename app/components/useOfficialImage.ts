"use client";
// 공식 이미지(핫링크) 로드 상태 — PlayerAvatar·TeamLogo 공용.
// 대체 디자인이 기본이고, 이미지는 스위치가 켜져 있고 로드에 성공했을 때만 위에 얹는다.
import { createContext, createElement, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { officialImagesEnabled, proxiedImageUrl } from "@/lib/images";

/** 이미지 저장(html-to-image)이 공식 이미지를 걸러낼 때 쓰는 표시 속성 — <img data-official-image> */
export const OFFICIAL_IMAGE_ATTR = "data-official-image";

/** html-to-image filter: 공식 이미지 <img> 는 빼고 나머지만 그린다 (KBL 서버에 CORS 헤더가 없어 캔버스가 실패) */
export function excludeOfficialImages(node: Node): boolean {
  return !(node instanceof HTMLElement && node.hasAttribute(OFFICIAL_IMAGE_ATTR));
}

/**
 * 이미지 저장용 사본 안 (2026-10-28): 공식 이미지를 빼지 않고 우리 주소 중계(/img-proxy, lib/images proxiedImageUrl)로 받아 그린다.
 * 같은 사이트 주소라 저장 이미지(캔버스)에 그릴 수 있다. 사본(official={false})을 이걸로 감싼다.
 */
const ExportImagesContext = createContext(false);
export function ExportImages({ children }: { children: ReactNode }) {
  return createElement(ExportImagesContext.Provider, { value: true }, children);
}

/**
 * @param url 공식 이미지 주소 (processed JSON 값)
 * @param enabled false 면 화면용 핫링크를 쓰지 않는다 — 저장 사본(ExportImages 안)이면 중계 주소로, 아니면 대체 디자인만
 */
export function useOfficialImage(url: string | null | undefined, enabled = true) {
  const exporting = useContext(ExportImagesContext);
  const proxied = !enabled && exporting;
  const src = !url || !officialImagesEnabled() ? null : enabled ? url : proxied ? proxiedImageUrl(url) : null;
  const imgRef = useRef<HTMLImageElement>(null);
  // 주소별로 상태를 기억 → 선수가 바뀌면 자동으로 초기화된다
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  // 정적 HTML의 <img>가 하이드레이션 전에 이미 실패·성공한 경우 onError/onLoad를 놓칠 수 있어 한 번 확인한다
  useEffect(() => {
    const img = imgRef.current;
    if (!src || !img || !img.complete) return;
    if (img.naturalWidth === 0) setFailedSrc(src);
    else setLoadedSrc(src);
  }, [src]);

  const show = !!src && failedSrc !== src;
  return {
    src: show ? src : null,
    loaded: show && loadedSrc === src,
    imgProps: {
      ref: imgRef,
      onError: () => setFailedSrc(src),
      onLoad: () => setLoadedSrc(src),
      // 중계 주소는 저장 이미지에 그릴 수 있으므로 거르지 않는다
      // 저장 사본은 화면 밖이라 "보일 때 받기"(lazy)면 영영 안 받는다 → 바로 받기
      ...(proxied ? { loading: "eager" as const } : { [OFFICIAL_IMAGE_ATTR]: "" }),
    },
  };
}
