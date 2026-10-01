// 선수 즐겨찾기 (2026-10-01 사용자 결정 "A": 로그인 없이 이 브라우저에만 저장) — 순수 함수만. 저장·불러오기는 app/components/useFavorites.
// 목록 = 선수 번호 배열, 최근에 추가한 선수가 앞. 인원 제한 없음, 홈에는 FAVORITES_VISIBLE 명만 보이고 나머지는 "더 보기".
// 나중에 구글 로그인을 붙이면 이 목록을 계정으로 옮긴다 (CLAUDE.md "후속 예정").

export const FAVORITES_KEY = "kbl-stats:favorites:v1";
export const FAVORITES_VISIBLE = 5;

/** 저장된 문자열 → 선수 번호 목록 (깨졌으면 빈 목록, 숫자 번호만, 중복 제거) */
export function parseFavorites(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    for (const x of v) if (typeof x === "string" && /^\d+$/.test(x) && !out.includes(x)) out.push(x);
    return out;
  } catch {
    return [];
  }
}

/** 있으면 빼고, 없으면 맨 앞에 넣는다 */
export function toggleFavorite(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [id, ...list];
}
