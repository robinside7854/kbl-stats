"use client";
// 플레이어 카드 이미지 저장 (CardExplorer·선수 페이지 공용).
// KBL 사진·로고는 CORS 헤더가 없어 원래 주소 그대로 캔버스에 그리면 저장이 실패한다.
// → 저장할 때만 화면 밖에 사본(PlayerCard exportMode·official={false})을 ExportImages 로 감싸 그린다:
//   사진·로고는 우리 주소 중계(/img-proxy)로 받아 같이 저장된다(2026-10-28 — 전엔 사진 없이 저장됐다).
//   사진이 없거나 못 받으면 대체 디자인. 혹시 원래 주소 <img> 가 섞여도 filter(excludeOfficialImages)가 뺀다.
// 글꼴: 저장 PNG 도 화면과 같은 Pretendard 로 그리도록, 사본에 나온 글자의 글꼴 조각만 넣는다(webFont pretendardEmbedCss).
//   글꼴을 받지 못하면 글꼴 없이(시스템 글꼴로) 저장한다 — 저장 자체는 실패시키지 않는다.
import { trackEvent } from "./track";
import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { excludeOfficialImages } from "./useOfficialImage";
import { pretendardEmbedCss } from "./webFont";

/** 다음 그림 그리기까지 기다린다 (저장용 사본이 화면 밖에 그려진 뒤 캡처하기 위해) */
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** 사본 안 사진·로고가 다 받아질(또는 실패할) 때까지 기다린다 — 최대 6초, 넘으면 있는 대로 저장 */
async function imagesSettled(node: HTMLElement): Promise<void> {
  const pending = [...node.querySelectorAll("img")].filter((img) => !img.complete);
  if (pending.length === 0) return;
  const each = pending.map((img) => new Promise<void>((r) => {
    img.addEventListener("load", () => r(), { once: true });
    img.addEventListener("error", () => r(), { once: true });
  }));
  await Promise.race([Promise.all(each), new Promise<void>((r) => window.setTimeout(r, 6000))]);
}

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
      const node = exportRef.current;
      if (!node) throw new Error("저장용 사본이 없습니다");
      await imagesSettled(node);
      // 받은 사진은 대체 디자인을 걷고, 실패한 사진은 빠지도록 화면이 한 번 더 그려지길 기다린다
      await nextFrame();
      await nextFrame();
      // 사본 글자의 글꼴 조각이 다 받아질 때까지 기다린 뒤, 그 조각만 이미지 안에 넣는다
      await document.fonts?.ready;
      const fontEmbedCSS = await pretendardEmbedCss(node.textContent ?? "").catch(() => undefined);
      const options = {
        pixelRatio: 2,
        backgroundColor: background,
        // 그래도 못 받은 이미지는 빈칸으로
        imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
      };
      // 사진 하나라도 그리지 못하면 통째로 실패하므로, 그때는 사진·로고 없이(대체 디자인으로) 다시 저장한다
      const dataUrl = await toPng(node, { ...options, filter: excludeOfficialImages }).catch(() =>
        toPng(node, { ...options, filter: (n: Node) => !(n instanceof HTMLImageElement) }),
      );
      const link = document.createElement("a");
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
      trackEvent("image_save", { file_name: fileName });
    } catch {
      setSaveError("이미지 저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return { exportRef, saving, saveError, save };
}
