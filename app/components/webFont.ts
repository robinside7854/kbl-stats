// 웹 글꼴 Pretendard Variable (디자인 점검 B1) — 주소는 여기 한 곳에만.
// - app/layout.tsx 가 이 CSS 를 <link> 로 불러온다. CSS 안에 font-display: swap 과 한글 음절별 동적 서브셋(unicode-range)이 들어 있어
//   화면에 나온 글자의 조각 파일만 받는다.
// - 카드 이미지 저장(html-to-image)은 SVG 안에 글꼴을 넣어야 저장 PNG 도 같은 글꼴이 된다(안 넣으면 시스템 글꼴로 바뀜).
//   전체 조각(92개)을 넣으면 느리므로, 저장할 카드에 실제로 나온 글자가 속한 조각만 골라 data: 주소로 넣는다 (pretendardEmbedCss).
// jsDelivr 는 CORS 를 허용한다(Access-Control-Allow-Origin: *). KBL 서버가 아니므로 원칙 1·3 과 무관.

export const PRETENDARD_CSS_URL =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";
export const FONT_CDN_ORIGIN = "https://cdn.jsdelivr.net";

interface FaceBlock {
  css: string;
  url: string;
  ranges: [number, number][];
}

/** "U+ac00-ac2f, U+ac31" → [[0xac00,0xac2f],[0xac31,0xac31]] */
function parseRanges(value: string): [number, number][] {
  return value
    .split(",")
    .map((part) => part.trim().replace(/^U\+/i, ""))
    .filter(Boolean)
    .map((part) => {
      const [a, b] = part.split("-");
      const lo = parseInt(a.replace(/\?/g, "0"), 16);
      const hi = b ? parseInt(b, 16) : parseInt(a.replace(/\?/g, "f"), 16);
      return [lo, hi] as [number, number];
    })
    .filter(([lo, hi]) => Number.isFinite(lo) && Number.isFinite(hi));
}

let facesPromise: Promise<FaceBlock[]> | null = null;
const dataUrlCache = new Map<string, Promise<string>>();

function loadFaces(): Promise<FaceBlock[]> {
  if (!facesPromise) {
    facesPromise = fetch(PRETENDARD_CSS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      })
      .then((text) =>
        [...text.matchAll(/@font-face\s*{[^}]*}/g)].flatMap((m): FaceBlock[] => {
          const css = m[0];
          const src = css.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
          const range = css.match(/unicode-range:\s*([^;}]+)/);
          if (!src) return [];
          const ranges: [number, number][] = range ? parseRanges(range[1]) : [[0, 0x10ffff]];
          return [{ css, url: new URL(src[1], PRETENDARD_CSS_URL).href, ranges }];
        }),
      )
      .catch((e) => {
        facesPromise = null; // 실패하면 다음 저장 때 다시 시도
        throw e;
      });
  }
  return facesPromise as Promise<FaceBlock[]>;
}

function toDataUrl(url: string): Promise<string> {
  let p = dataUrlCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          }),
      );
    p.catch(() => dataUrlCache.delete(url));
    dataUrlCache.set(url, p);
  }
  return p;
}

/**
 * text 에 나온 글자를 그리는 데 필요한 Pretendard 조각만 data: 주소로 넣은 @font-face CSS.
 * html-to-image 의 fontEmbedCSS 로 넘긴다. 실패하면 예외 — 부르는 쪽이 글꼴 없이 저장한다.
 */
export async function pretendardEmbedCss(text: string): Promise<string> {
  const faces = await loadFaces();
  const codes = new Set<number>();
  for (const ch of text) codes.add(ch.codePointAt(0)!);
  // 숫자·기호·라틴은 항상 (SVG 안 글자·자리 표시 문자 대비)
  for (let c = 0x20; c <= 0x7e; c++) codes.add(c);
  const needed = faces.filter((f) => f.ranges.some(([lo, hi]) => [...codes].some((c) => c >= lo && c <= hi)));
  const blocks = await Promise.all(
    needed.map(async (f) => f.css.replace(/url\(\s*['"]?[^'")]+['"]?\s*\)/, `url(${await toDataUrl(f.url)})`)),
  );
  return blocks.join("\n");
}
