// 팀 이름 규칙 — 순수 함수만 둔다. scripts/process.ts 가 시즌 파일을 만들 때 쓰고, 테스트(tests/leaders.test.ts)가 검증한다.

/**
 * KBL 역대 연고지 지명 (1997~ 정규시즌 teamName1 에 나온 것 + 앞으로 쓰일 법한 광역시·도).
 * 팀 코드·시즌 코드가 아니라 "지명"이라 하드코딩 금지 규칙의 예외로 둔다 —
 * 코드표 API 에는 연고지만 따로 담은 필드가 없어서, 붙어 쓴 이름(예: "부산기아")에서 지명을 떼려면 목록이 필요하다.
 * 새 연고지가 생기면 여기에 추가한다 (추가하지 않아도 공백이 있는 이름 "화성 OO"은 공백 규칙으로 처리된다).
 */
export const HOME_CITIES: readonly string[] = [
  "서울", "부산", "인천", "대구", "대전", "광주", "울산", "수원", "창원", "원주",
  "안양", "고양", "전주", "청주", "여수", "경남", "경기", "성남", "화성", "제주",
];

/**
 * 팀 한글 약칭: teamName1(예: "울산 현대모비스", "부산기아")에서 연고지 지명을 떼어낸 나머지.
 *  1) 공백이 있으면 첫 공백 뒤 전부 ("울산 현대모비스" → "현대모비스", "여수 코리아텐더" → "코리아텐더")
 *  2) 공백이 없으면 HOME_CITIES 중 가장 긴 접두어를 뗀다 ("부산기아" → "기아", "원주TG삼보" → "TG삼보")
 *  3) 결과가 비면(지명만 있는 이름 등) teamName1 전체
 * 영문 대문자 약칭(teamName4, 예: "HYUNDAI MOBIS")은 팬이 읽기 어려워 화면에서는 이 값을 쓴다.
 */
export function teamShortNameKo(teamName1: string): string {
  const name = teamName1.trim();
  if (!name) return "";
  let rest: string;
  const sp = name.search(/\s/);
  if (sp >= 0) {
    rest = name.slice(sp).trim();
  } else {
    const city = [...HOME_CITIES].sort((a, b) => b.length - a.length).find((c) => name.startsWith(c));
    rest = city ? name.slice(city.length).trim() : name;
  }
  return rest || name;
}
