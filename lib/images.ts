// 공식 이미지(선수 사진·팀 로고) 스위치와 대체 디자인용 글자 규칙.
// 이미지 주소 자체는 scripts/image-urls.ts 가 만들어 processed JSON에 넣는다 — 여기는 주소를 모른다 (원칙 1).

/**
 * 공식 사진·로고를 보여줄지 여부 (PLAN.md §5-2 ④ 끄기 스위치).
 * 환경변수 NEXT_PUBLIC_OFFICIAL_IMAGES 가 "off" 면 끈다. 기본값(미설정)은 켜짐.
 * NEXT_PUBLIC_ 값은 빌드 시점에 코드에 박히므로, 바꾼 뒤에는 재배포해야 반영된다.
 * ⚠️ Next.js가 치환할 수 있도록 process.env.NEXT_PUBLIC_OFFICIAL_IMAGES 를 그대로 적어야 한다(구조 분해 금지).
 */
export function officialImagesEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_OFFICIAL_IMAGES ?? "").trim().toLowerCase() !== "off";
}

/** 선수 대체 디자인 글자: 한글이면 첫 글자(성), 영문 등이면 첫 글자 대문자 */
export function nameInitial(nameKo: string): string {
  const s = nameKo.trim();
  if (!s) return "?";
  return [...s][0].toUpperCase();
}

/**
 * 팀 대체 디자인 글자(최대 3글자).
 * 약칭이 여러 단어의 영문(예: "HYUNDAI MOBIS", "JUNG KWAN JANG")이면 단어 머리글자, 아니면 앞 3글자.
 */
export function teamMark(shortName: string): string {
  const s = shortName.trim();
  if (!s) return "?";
  const words = s.split(/\s+/);
  if (words.length > 1) return words.map((w) => [...w][0]).join("").slice(0, 3).toUpperCase();
  return [...s].slice(0, 3).join("");
}

/**
 * 표·목록에 쓰는 팀 약칭. 옛 시즌 약칭은 영문 대문자라 길다(예: "DAEWOO SECURITIES").
 * maxLength(기본 9) 글자 이하면 그대로, 넘으면 teamMark 와 같은 규칙(여러 단어면 머리글자)으로 줄인다.
 * 예: "SK" → "SK", "TG SAMBO" → "TG SAMBO", "HYUNDAI MOBIS" → "HM", "DAEWOO SECURITIES" → "DS".
 */
export function teamShortLabel(shortName: string, maxLength = 9): string {
  const s = shortName.trim();
  if ([...s].length <= maxLength) return s;
  return teamMark(s);
}

/**
 * 두 hex 색을 섞는다 (sRGB 선형 보간, t=0 이면 a, t=1 이면 b). 3·6자리 hex 지원, 잘못된 값이면 a 그대로.
 * 플레이어 카드 상단 그라데이션(팀 primary → 어두운 색)에 쓴다. CSS color-mix 대신 hex 로 만들어
 * 이미지 저장(html-to-image) 결과가 브라우저마다 달라지지 않게 한다.
 */
export function mixHex(a: string, b: string, t: number): string {
  const parse = (h: string): number[] | null => {
    let s = h.trim().replace(/^#/, "");
    if (s.length === 3) s = [...s].map((c) => c + c).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
  };
  const ca = parse(a);
  const cb = parse(b);
  if (!ca || !cb) return a;
  const k = Math.min(1, Math.max(0, t));
  return "#" + ca.map((v, i) => Math.round(v + (cb[i] - v) * k).toString(16).padStart(2, "0")).join("");
}
