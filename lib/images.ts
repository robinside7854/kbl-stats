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
