// KBL 공홈 이미지 주소 생성 (PLAN.md §5-1, 2026-09-30 Actions 러너에서 확인)
// ⚠️ KBL 이미지 주소는 scripts/ 안에만 존재해야 한다. 화면(app/)은 processed JSON에 적힌 주소만 쓴다 (원칙 1).
// 레포에 이미지를 복사하지 않고 핫링크한다 — 사진·로고는 저작물·상표라 복제하지 않는다 (PLAN.md §5-2).

const KBL_SITE = "https://kbl.or.kr";

/**
 * 선수 프로필 사진. 옛 선수도 상당수 있다.
 * 사진이 없는 번호도 HTTP 200에 HTML 본문을 돌려주므로, 화면의 <img onError>로 대체 디자인을 띄운다.
 */
export function playerPhotoUrl(playerNo: string): string {
  return `${KBL_SITE}/files/kbl/players-photo/${encodeURIComponent(playerNo)}.png`;
}

/**
 * 팀 로고 (raw teams.json 의 teamLogoName 기준).
 * - 빈 값 → null (로고 없음, 화면은 팀 색 + 약칭으로 대체)
 * - "jkj" → 정관장 전용 PNG (공홈 CSS 예외 규칙)
 * - 숫자가 들어간 이름(db1997, kt2001-1, zz2003, pega2021 …) → 옛 로고 old/{name}e.png
 * - 그 외(sk, db, hd, kcc, kt, lg, ss, sono, pega, kgc) → 현재 로고 ic-{name}.svg
 */
export function teamLogoUrl(logoName: string): string | null {
  const name = logoName.trim();
  if (!name) return null;
  if (name === "jkj") return `${KBL_SITE}/assets/img/logo/logo-jkj.png`;
  if (/\d/.test(name)) return `${KBL_SITE}/assets/img/ico/logo/old/${encodeURIComponent(name)}e.png`;
  return `${KBL_SITE}/assets/img/ico/logo/ic-${encodeURIComponent(name)}.svg`;
}
