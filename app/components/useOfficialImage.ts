"use client";
// 공식 이미지(핫링크) 로드 상태 — PlayerAvatar·TeamLogo 공용.
// 대체 디자인이 기본이고, 이미지는 스위치가 켜져 있고 로드에 성공했을 때만 위에 얹는다.
import { useEffect, useRef, useState } from "react";
import { officialImagesEnabled } from "@/lib/images";

export function useOfficialImage(url: string | null | undefined) {
  const src = url && officialImagesEnabled() ? url : null;
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
    },
  };
}
