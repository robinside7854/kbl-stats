// 업데이트 소식 게시판 (/updates, 2026-10-05 사용자 요청): 글은 이 파일에 직접 적는다(DB 없음 — 정적 페이지).
// 규칙(CLAUDE.md "업데이트 소식 규칙"): 기능을 바꾸면 같은 커밋에 글 하나를 맨 위에 더한다. 맨 위 글이 헤더 아래 띠배너에 뜬다.
// 말투: 짧게, 해요체, 캐주얼. 설명 늘어놓지 말고 "뭐가 생겼는지·어디서 보는지"만. 긴 대시(—)·느낌표 남발 금지(tests/updates.test.ts).
// 본문은 글자 블록만(문단·소제목·목록·순서 목록) — 화면은 글자로만 그린다(HTML 넣지 않음).

export type UpdateKind = "update" | "guide";

/** 목록 한 줄: 글자만, 또는 사이트 안 주소로 가는 링크 */
export type UpdateItem = string | { text: string; href: string };

export type UpdateBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "list"; items: UpdateItem[] }
  | { kind: "steps"; items: UpdateItem[] };

export interface UpdatePost {
  /** 주소 /updates/{slug} — 영어 소문자·숫자·하이픈 */
  slug: string;
  /** 올린 날 YYYY-MM-DD (한국 날짜) */
  date: string;
  kind: UpdateKind;
  title: string;
  /** 목록·띠배너에 쓰는 한 줄 (20자 이하 — 폰 띠배너에 안 잘리게) */
  summary: string;
  blocks: UpdateBlock[];
}

export const UPDATE_KIND_LABELS: Record<UpdateKind, string> = { update: "업데이트", guide: "가이드" };

/** 글 목록 — **새 글은 맨 위에** 더한다(같은 날짜면 위가 더 새 글) */
export const UPDATE_POSTS: UpdatePost[] = [
  {
    slug: "2026-10-08-notifications",
    date: "2026-10-08",
    kind: "update",
    title: "알림함이 생겼어요",
    summary: "즐겨찾기 선수 알림함",
    blocks: [
      { kind: "p", text: "화면 위 종을 누르면 즐겨찾기한 선수와 응원팀 소식이 모여 있어요. 새 소식이 있으면 종에 숫자가 떠요." },
      {
        kind: "list",
        items: [
          "응원팀 경기 결과랑 하이라이트 영상",
          "즐겨찾기한 선수의 그날 기록",
          "커리어 하이, 이번 시즌 최다, 통산 이정표 달성",
          { text: "알림함 보기", href: "/notifications" },
          { text: "선수 즐겨찾기하러 가기", href: "/players" },
        ],
      },
      { kind: "p", text: "기록은 경기 끝나고 한두 시간 뒤에 들어와요. 응원팀 소식은 로그인하고 응원팀을 골라야 와요. 폰 알림은 다음에 붙일게요." },
    ],
  },
  {
    slug: "2026-10-07-spacing",
    date: "2026-10-07",
    kind: "update",
    title: "글자 간격이랑 줄바꿈을 다듬었어요",
    summary: "글자 간격 다듬기",
    blocks: [
      { kind: "p", text: "숫자가 옆 칸이랑 붙어 보이거나 이름이 어색하게 꺾이던 곳을 고쳤어요." },
      {
        kind: "list",
        items: [
          "박스스코어 턴오버·자유투% 칸을 넓혀서 옆 숫자랑 안 붙어요",
          "리더보드 2·3위 이름이 폰에서 두 줄로 꺾이지 않게 사진 아래로 옮겼어요",
          "선수 하이라이트 칸의 \"경기당\"은 숫자 아래 줄로 내렸어요",
          "수상 카드는 이름 아래에 팀을 따로 적어요",
          { text: "팀 순위 표 승-패랑 승률 사이도 띄웠어요", href: "/teams" },
        ],
      },
    ],
  },
  {
    slug: "2026-10-06-menu-tidy",
    date: "2026-10-06",
    kind: "update",
    title: "메뉴랑 필터를 정리했어요",
    summary: "메뉴·필터 정리",
    blocks: [
      { kind: "p", text: "고르는 단계가 너무 많아서 한 번 정리했어요. 원하는 걸 두 번 안에 찾을 수 있어요." },
      {
        kind: "list",
        items: [
          "리더보드랑 역대 기록은 \"기록\" 메뉴 하나로 합쳤어요. 위 탭에서 시즌별·통산·한 경기 최다·한 시즌 최다·수상을 골라요",
          "시즌 어워즈는 기록 메뉴의 수상 탭에서 시즌을 골라 봐요",
          { text: "팀 순위는 팀 화면에서 \"표\"를 누르면 나와요", href: "/teams" },
          "리더보드 부문은 칩 한 줄로, 나머지는 \"다른 부문\"에 있어요. 표 머리글을 눌러도 1~3위가 바뀌어요",
          "국적·현역만 같은 조건은 \"필터\" 버튼 안으로 넣었어요",
        ],
      },
    ],
  },
  {
    slug: "2026-10-06-pc-bigger",
    date: "2026-10-06",
    kind: "update",
    title: "PC에서 글자랑 사진을 키웠어요",
    summary: "PC 글자·사진 크게",
    blocks: [
      { kind: "p", text: "넓어진 PC 화면에 빈칸이 많아서 글자, 메뉴, 로고를 한 단계 키웠어요. 빈자리에는 볼거리를 채웠어요." },
      {
        kind: "list",
        items: [
          "리더보드 1~3위 카드에 큰 선수 사진",
          { text: "홈 표지 가운데에 그 선수 경기당 기록 6칸", href: "/" },
          { text: "역대 기록은 1위와 비교하는 막대", href: "/records" },
          "팀 순위는 승률 막대, 일정은 경기 적은 날끼리 한 줄에",
        ],
      },
      { kind: "p", text: "폰 화면은 그대로예요." },
    ],
  },
  {
    slug: "2026-10-06-wide-pc",
    date: "2026-10-06",
    kind: "update",
    title: "PC에서 화면을 더 넓게 써요",
    summary: "PC 화면 더 넓게",
    blocks: [
      { kind: "p", text: "PC로 보면 양옆 빈자리가 많았는데, 이제 화면을 더 넓게 써요. 일정은 한 줄에 경기 카드가 세 개씩 나와요." },
      { kind: "list", items: [{ text: "홈에서 보기", href: "/" }] },
    ],
  },
  {
    slug: "2026-10-06-teams-tab",
    date: "2026-10-06",
    kind: "update",
    title: "팀 화면을 순위 카드로 바꿨어요",
    summary: "팀 화면, 순위 카드로",
    blocks: [
      { kind: "p", text: "팀 화면이 이번 시즌 순위대로 두 줄 카드로 나와요. 카드마다 순위, 승패, 우승 횟수, 팬 수가 보여요." },
      { kind: "p", text: "지금 팀이랑 추억의 팀은 위 버튼으로 바꿔 봐요. 팀 좋아요는 팬 수랑 겹쳐서 뺐어요." },
      { kind: "p", text: "설치한 앱을 켤 때 나오는 시작 화면도 리그 남색으로 바꿨어요." },
      { kind: "list", items: [{ text: "팀 화면 보기", href: "/teams" }] },
    ],
  },
  {
    slug: "2026-10-06-schedule-my-team",
    date: "2026-10-06",
    kind: "update",
    title: "일정에서 내 응원팀 경기만 볼 수 있어요",
    summary: "일정, 내 응원팀만 보기",
    blocks: [
      { kind: "p", text: "로그인하고 응원팀을 골라 두면 일정 화면이 우리 팀 경기만 보여 줘요. 응원팀이 여러 팀이면 다 같이 나와요." },
      { kind: "p", text: "다른 경기도 보고 싶으면 위에서 '전체 일정'을 누르면 돼요. 고른 건 다음에 와도 그대로예요." },
      { kind: "list", items: [{ text: "로그인하고 응원팀 고르기", href: "/me" }, { text: "팀 둘러보기", href: "/teams" }] },
    ],
  },
  {
    slug: "2026-10-06-roster-status",
    date: "2026-10-06",
    kind: "update",
    title: "선수 페이지에 현역·은퇴 표시가 붙어요",
    summary: "현역·은퇴 표시 생겼어요",
    blocks: [
      { kind: "p", text: "선수 이름 아래에 현역, 미등록, 은퇴 중 하나가 붙어요. KBL 선수 등록 명단을 일주일에 한 번 확인해서 정해요." },
      { kind: "p", text: "명단에 없다고 바로 은퇴는 아니에요. 군 복무나 FA일 수 있어서, 최근 3시즌 동안 기록이 없을 때만 은퇴로 봐요. 표시를 누르면 기준이 나와요." },
      { kind: "p", text: "역대 기록의 '현역만'도 같은 명단으로 바뀌었어요." },
      { kind: "list", items: [{ text: "역대 기록 보기", href: "/records" }, { text: "판정 기준 보기", href: "/glossary#roster-status" }] },
    ],
  },
  {
    slug: "2026-10-06-career-table",
    date: "2026-10-06",
    kind: "update",
    title: "선수 기록표에 통산이랑 플레이오프 생겼어요",
    summary: "기록표에 통산·플레이오프 추가",
    blocks: [
      { kind: "p", text: "선수 페이지 시즌별 기록 맨 아래에 통산 줄이 붙어요. 경기당, 30분당, 합계 다 돼요." },
      { kind: "p", text: "플레이오프에 나간 적 있는 선수는 위에 정규시즌·플레이오프 버튼이 생겨요. 플레이오프는 6강부터 챔프전까지 합친 기록이에요." },
      { kind: "list", items: [{ text: "선수 찾아보기", href: "/players" }] },
    ],
  },
  {
    slug: "2026-10-05-fans-weekly-ranking",
    date: "2026-10-05",
    kind: "update",
    title: "팀 응원하기랑 54-0 주간 순위 생겼어요",
    summary: "54-0 주간 순위 생겼어요",
    blocks: [
      { kind: "p", text: "팀 페이지에 '응원하기' 버튼이 생겼어요. 누르면 바로 내 응원팀이 되고, 그 팀 팬이 몇 명인지도 같이 보여요." },
      { kind: "p", text: "54-0은 이제 주마다 순위를 매겨요. 월요일 0시에 새로 시작하고, 회원마다 그 주 가장 좋은 판 하나만 올라가요. 로그인하고 닉네임을 정해 두면 자동으로 들어가요." },
      {
        kind: "list",
        items: [
          { text: "54-0 주간 순위 보기", href: "/game/ranking" },
          { text: "팀 팬 수 순위 보기", href: "/likes" },
          { text: "내 응원팀 고르러 가기", href: "/teams" },
        ],
      },
    ],
  },
  {
    slug: "2026-10-05-scoreboard",
    date: "2026-10-05",
    kind: "update",
    title: "경기 카드 점수판 바꿨어요",
    summary: "경기 점수판이 좌우로 바뀌었어요",
    blocks: [
      { kind: "p", text: "경기 카드를 홈 팀 왼쪽, 원정 팀 오른쪽으로 놓고 가운데 점수를 크게 넣었어요. 이긴 팀은 이름 아래 '승'이 붙어요." },
      { kind: "list", items: [{ text: "홈에서 오늘의 경기 보기", href: "/" }] },
    ],
  },
  {
    slug: "2026-10-05-asia-quota",
    date: "2026-10-05",
    kind: "update",
    title: "아시아쿼터는 이제 국내 선수랑 비교해요",
    summary: "아시아쿼터 등급 기준이 바뀌었어요",
    blocks: [
      { kind: "p", text: "등급이랑 비슷한 시즌을 매길 때 아시아쿼터 선수를 외국 선수 말고 국내 선수랑 같이 봐요. 역할이나 기록이 국내 선수 쪽에 더 가까워서요." },
      { kind: "p", text: "그래서 아시아쿼터 선수, 그리고 국내 선수 몇몇은 등급이 조금 달라졌을 수 있어요. 카드에는 '국내 선수(아시아쿼터 포함)'라고 나와요." },
      { kind: "p", text: "그리고 '프라임 시즌 보기' 같은 바로 가기 글자를 파란색으로 바꿨어요. 누르는 곳인지 바로 보이게요." },
    ],
  },
  {
    slug: "2026-10-05-app-icon",
    date: "2026-10-05",
    kind: "update",
    title: "앱 아이콘 바꿨어요",
    summary: "앱 아이콘이 바뀌었어요",
    blocks: [
      { kind: "p", text: "KBL 글자, 농구공, 기록 막대를 한 아이콘에 넣었어요. 색은 리그 남색이랑 주황." },
      {
        kind: "p",
        text: "이미 설치했다면 폰에 따라 바로 안 바뀔 수 있어요. 그럴 땐 홈 화면 아이콘 지우고 브라우저 메뉴에서 '앱 설치'나 '홈 화면에 추가'를 한 번 더 해 주세요.",
      },
    ],
  },
  {
    slug: "2026-10-05-so-far",
    date: "2026-10-05",
    kind: "update",
    title: "지금까지 만든 것들 한 번에 정리",
    summary: "지금까지 만든 기능 총정리",
    blocks: [
      { kind: "p", text: "KBL 기록을 표 말고 좀 재밌게 보고 싶어서 시작했어요. 지금까지 들어간 것들 쭉 적어 볼게요." },
      { kind: "h", text: "선수" },
      {
        kind: "list",
        items: [
          { text: "게임 카드처럼 생긴 플레이어 카드. 등급(S~F)이랑 6각 레이더", href: "/players" },
          "시즌별 기록, 추이 그래프, 커리어 하이, 수상 경력",
          "슛 차트: 어디서 많이 쏘고 어디서 잘 넣는지 (06-07 시즌부터)",
          "비슷한 시즌을 보낸 선수, 프라임 시즌",
          "선수 페이지 '비교' 버튼으로 두 명 나란히",
        ],
      },
      { kind: "h", text: "시즌" },
      {
        kind: "list",
        items: [
          { text: "일정이랑 박스스코어, 경기 하이라이트 영상", href: "/" },
          "리더보드: 부문별 1~3위, 전체 순위, CSV 받기",
          "팀 순위, 시즌이 얼마나 지났는지 진행률",
          "끝난 시즌은 MVP·베스트5 같은 어워즈까지",
        ],
      },
      { kind: "h", text: "팀" },
      {
        kind: "list",
        items: [
          { text: "팀 페이지: 통산 성적, 시즌별 로스터, 레전드, 구단 계보", href: "/teams" },
          "기아·나래·동양처럼 지금은 없는 팀도 '추억의 팀'으로",
        ],
      },
      { kind: "h", text: "역대 기록" },
      { kind: "list", items: [{ text: "누적, 한 경기 최다, 한 시즌 최다, 수상·우승 횟수", href: "/records" }] },
      { kind: "h", text: "놀거리" },
      {
        kind: "list",
        items: [
          { text: "54-0: 슬롯 돌려서 다섯 명 뽑고 54전 전승 도전", href: "/game" },
          "위쪽 주사위 버튼은 랜덤 카드, 홈에는 오늘 생일인 선수",
        ],
      },
      { kind: "h", text: "계정" },
      {
        kind: "list",
        items: [
          "구글·네이버 로그인하면 닉네임, 응원팀, 즐겨찾기, 좋아요, 54-0 기록이 저장돼요",
          { text: "자세한 건 로그인 가이드에서", href: "/updates/2026-10-05-login-guide" },
        ],
      },
      { kind: "h", text: "그 밖에" },
      {
        kind: "list",
        items: [
          "폰에 앱처럼 설치돼요. 브라우저 메뉴에서 '앱 설치'나 '홈 화면에 추가'",
          "기록은 매일 저녁, 그날 경기 끝나고 한 시간쯤 뒤에 바뀌어요",
        ],
      },
      { kind: "p", text: "앞으로 뭐 바뀌면 여기 계속 올릴게요." },
    ],
  },
  {
    slug: "2026-10-05-login-guide",
    date: "2026-10-05",
    kind: "guide",
    title: "구글·네이버 로그인 가이드",
    summary: "구글·네이버 로그인 이렇게 해요",
    blocks: [
      { kind: "p", text: "로그인 안 해도 다 볼 수 있어요. 로그인하면 이런 게 계정에 남아요." },
      {
        kind: "list",
        items: [
          "닉네임이랑 응원팀 배지",
          "즐겨찾기한 선수 (폰이든 PC든 같이 보여요)",
          "선수·팀 좋아요",
          "54-0 결과 기록",
        ],
      },
      { kind: "h", text: "로그인하는 법" },
      {
        kind: "steps",
        items: [
          "오른쪽 위 '로그인' 누르기",
          "구글이나 네이버 고르기",
          "동의하고 돌아오면 끝. 처음 한 번은 닉네임이랑 응원팀 정하기",
        ],
      },
      { kind: "h", text: "구글, 네이버 둘 다 쓰고 싶으면" },
      {
        kind: "p",
        text: "내 계정 화면의 '로그인 연결'에서 다른 쪽도 붙여 두세요. 어느 쪽으로 들어와도 같은 계정이에요. 따로 만든 계정이 있었으면 하나로 합쳐져요.",
      },
      { kind: "h", text: "받는 정보" },
      {
        kind: "p",
        text: "로그인 회사가 주는 고유 번호만 받아요. 이메일, 이름, 사진은 안 받아요. 네이버 별명은 처음 닉네임 칸을 채우는 데만 쓰고 따로 저장하지 않아요.",
      },
      { kind: "list", items: [{ text: "개인정보 처리 안내", href: "/privacy" }] },
      { kind: "h", text: "그만 쓰고 싶으면" },
      { kind: "p", text: "내 계정 화면 맨 아래 '탈퇴하기'. 계정 정보는 바로 지워지고 되돌릴 수 없어요." },
      { kind: "list", items: [{ text: "내 계정", href: "/me" }] },
    ],
  },
];

/** 새 글 먼저 (날짜 내림차순, 같은 날짜는 파일 순서 그대로) */
export function sortedPosts(posts: UpdatePost[] = UPDATE_POSTS): UpdatePost[] {
  return posts
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.date === b.p.date ? a.i - b.i : a.p.date < b.p.date ? 1 : -1))
    .map((x) => x.p);
}

export function latestPost(posts: UpdatePost[] = UPDATE_POSTS): UpdatePost | null {
  return sortedPosts(posts)[0] ?? null;
}

export function postBySlug(slug: string, posts: UpdatePost[] = UPDATE_POSTS): UpdatePost | null {
  return posts.find((p) => p.slug === slug) ?? null;
}

/** 띠배너를 보일지: 맨 위 글이 있고, 이 브라우저가 그 글을 닫지 않았으면 (더 새 글이 올라오면 다시 보인다) */
export function shouldShowBanner(latestSlug: string | null, dismissedSlug: string | null): boolean {
  return !!latestSlug && latestSlug !== dismissedSlug;
}

/** 띠배너에 띄울 글: 관리자가 지운 글을 빼고 맨 위 글, 이 브라우저가 그 글을 닫았으면 null */
export function bannerPost(hidden: readonly string[], dismissedSlug: string | null, posts: UpdatePost[] = UPDATE_POSTS): UpdatePost | null {
  const top = sortedPosts(posts).find((p) => !hidden.includes(p.slug)) ?? null;
  return top && shouldShowBanner(top.slug, dismissedSlug) ? top : null;
}

/** "2026-10-05" → "2026.10.05" */
export function formatPostDate(date: string): string {
  return date.replaceAll("-", ".");
}

/** 목록 한 줄의 글자·링크 */
export function itemText(item: UpdateItem): string {
  return typeof item === "string" ? item : item.text;
}
export function itemHref(item: UpdateItem): string | null {
  return typeof item === "string" ? null : item.href;
}
