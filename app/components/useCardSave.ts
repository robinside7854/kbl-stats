"use client";
// 플레이어 카드 이미지 저장 (CardExplorer·선수 페이지 공용).
// KBL 사진·로고는 CORS 헤더가 없어 캔버스에 그리면 저장이 실패한다.
// → 저장할 때만 화면 밖에 "공식 이미지 없는 사본"(PlayerCard exportMode)을 그려 그것을 PNG로 만든다.
//   혹시 공식 <img> 가 섞여도 filter(excludeOfficialImages)가 뺀다.
import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { excludeOfficialImages } from "./useOfficialImage";

/** 다음 그림 그리기까지 기다린다 (저장용 사본이 화면 밖에 그려진 뒤 캡처하기 위해) */
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * saving 이 true 인 동안 화면 밖에 사본을 그리고 exportRef 를 붙인다. save(파일 이름)이 PNG를 내려받게 한다.
 * @param background 저장 이미지 바탕색 (테마 표면 색)
 */
export function useCardSave(background: string) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save(fileName: string) {
    setSaving(true);
    setSaveError(null);
    try {
      await nextFrame();
      await nextFrame();
      if (!exportRef.current) throw new Error("저장용 사본이 없습니다");
      const dataUrl = await toPng(exportRef.current, {
        pixelRatio: 2,
        backgroundColor: background,
        skipFonts: true,
        filter: excludeOfficialImages,
      });
      const link = document.createElement("a");
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setSaveError("이미지 저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return { exportRef, saving, saveError, save };
}
