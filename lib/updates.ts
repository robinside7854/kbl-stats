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
    slug: "2026-10-30-profile-ranks",
    date: "2026-10-30",
    kind: "update",
    title: "키·나이로 줄 세우는 프로필 순위",
    summary: "키·나이 순위 생김",
    blocks: [
      { kind: "p", text: "기록 메뉴에 프로필 탭이 생겼어요. 키, 몸무게, 체격, 나이, 뛴 시즌, 거친 구단으로 선수를 줄 세워 봐요. 시즌마다 볼 수도 있고 역대 전체로 볼 수도 있어요." },
      { kind: "p", text: "키에 비해 남다른 기록도 모았어요. 185cm 이하 선수의 리바운드랑 블록, 200cm 이상 선수의 3점 성공률, 같은 키 평균보다 리바운드를 몇 개 더 잡는지까지요." },
      { kind: "p", text: "선수 탭 나열 순서에도 키순, 나이순을 더했어요. 고른 순서 버튼을 한 번 더 누르면 거꾸로 바뀌어요. 키 작은 순, 어린 순, 득점 적은 순처럼요." },
      { kind: "list", items: [{ text: "프로필 순위 보기", href: "/records/profile" }, { text: "선수 키순으로 보기", href: "/players?sort=height" }] },
    ],
  },
  {
    slug: "2026-10-30-winning-shot-rule",
    date: "2026-10-30",
    kind: "update",
    title: "위닝샷 기준을 더 엄격하게 바꿨어요",
    summary: "위닝샷 기준 바뀜",
    blocks: [
      { kind: "p", text: "이제 그 득점을 끝으로 경기가 끝나야 위닝샷이에요. 앞서 나간 뒤에 어느 팀이든 점수가 또 나면 위닝샷으로 치지 않아요. 같은 선수가 바로 이어 넣은 앤드원이나 두 번째 자유투만 괜찮아요." },
      { kind: "p", text: "그래서 역대 위닝샷이 정규시즌 897개에서 404개로, 플레이오프 55개에서 26개로 줄었어요. 버저비터는 그대로예요. 클러치 득점은 바뀌지 않았어요." },
      { kind: "list", items: [{ text: "역대 위닝샷 순위 보기", href: "/records/clutch" }] },
    ],
  },
  {
    slug: "2026-10-28-share-copy-photo",
    date: "2026-10-28",
    kind: "update",
    title: "링크 복사 버튼, 사진 들어간 이미지 저장",
    summary: "링크 복사·사진 저장",
    blocks: [
      { kind: "p", text: "54-0 결과 화면에 링크 복사 버튼을 공유 버튼 옆에 따로 뒀어요. 누르면 글이랑 결과 링크가 같이 복사돼요." },
      { kind: "p", text: "이미지 저장을 누르면 이제 선수 사진이랑 팀 로고까지 같이 저장돼요. 선수 카드 저장, 팀 베스트 5 저장도 똑같아요." },
      { kind: "list", items: [{ text: "54-0 하러 가기", href: "/game" }] },
    ],
  },
  {
    slug: "2026-10-28-clutch-playoff",
    date: "2026-10-28",
    kind: "update",
    title: "플레이오프 위닝샷, 시즌별 클러치 순위",
    summary: "플레이오프·시즌별 클러치",
    blocks: [
      { kind: "p", text: "기록 탭 클러치에서 정규시즌·플레이오프·챔프전을 고를 수 있어요. 기간도 통산 말고 시즌 하나씩 골라 볼 수 있어요." },
      { kind: "p", text: "선수 페이지 클러치 칸에도 정규시즌·플레이오프 전환이 생겼어요. 플레이오프 기록은 오늘 안에 채워져요." },
      { kind: "list", items: [{ text: "클러치 순위 보기", href: "/records/clutch" }] },
    ],
  },
  {
    slug: "2026-10-28-clutch",
    date: "2026-10-28",
    kind: "update",
    title: "위닝샷·버저비터·클러치 기록 생겼어요",
    summary: "위닝샷·클러치 기록",
    blocks: [
      { kind: "p", text: "4쿼터나 연장 남은 2분 안에 동점이나 역전 득점을 넣고, 그 득점을 끝으로 경기가 끝나면 위닝샷이에요. 0초에 넣고 상대가 아무것도 못 하고 끝나면 버저비터로 따로 적어요." },
      { kind: "p", text: "남은 2분 안, 6점 차 이내에서 넣은 점수는 클러치 기록으로 모았어요. 경기 카드랑 박스스코어엔 위닝샷 넣은 선수 이름 옆에 표시가 붙고, 선수 페이지엔 클러치 칸이 생겼어요." },
      { kind: "p", text: "공홈 문자중계로 세서 2006-07 시즌부터 있어요. 지난 시즌들 기록은 차례로 채우는 중이에요." },
      { kind: "list", items: [{ text: "역대 위닝샷 순위 보기", href: "/records/clutch" }, { text: "오늘 경기 보러 가기", href: "/" }] },
    ],
  },
  {
    slug: "2026-10-27-next-game-alert",
    date: "2026-10-27",
    kind: "update",
    title: "다음 경기 결과, 폰으로 받아 보세요",
    summary: "경기 결과 폰 알림 안내",
    blocks: [
      { kind: "p", text: "박스스코어를 다 보고 닫으면 아래에 작은 안내가 한 번 떠요. 폰 알림 켜기나 앱 설치 중 지금 할 수 있는 것 하나만 보여 줘요." },
      { kind: "p", text: "기록은 경기 끝나고 1시간쯤 뒤에 올라와요. 알림을 켜 두면 응원팀이랑 즐겨찾기 선수 소식이 그때 폰으로 와요." },
      { kind: "list", items: [{ text: "알림함에서 켜기", href: "/notifications" }, { text: "오늘 경기 보러 가기", href: "/" }] },
    ],
  },
  {
    slug: "2026-10-27-game-share",
    date: "2026-10-27",
    kind: "update",
    title: "54-0 결과, 이제 카드로 보내져요",
    summary: "54-0 결과 공유 카드",
    blocks: [
      { kind: "p", text: "54-0 결과 화면 맨 위에 공유 버튼이 생겼어요. 폰에서 누르면 카카오톡 같은 앱으로 바로 보낼 수 있어요." },
      { kind: "p", text: "보낸 링크엔 내 성적과 다섯 명이 담긴 카드가 같이 떠요. 받은 친구는 같은 결과를 보고 바로 도전할 수 있어요." },
      { kind: "list", items: [{ text: "54-0 하러 가기", href: "/game" }] },
    ],
  },
  {
    slug: "2026-10-21-card-redesign",
    date: "2026-10-21",
    kind: "update",
    title: "선수·팀 카드 새 모습",
    summary: "선수·팀 카드 새 모습",
    blocks: [
      { kind: "p", text: "선수 탭 카드에 큰 사진이 들어가고, 팀 로고·등급·포지션(가드·포워드·센터)을 위쪽 팀 색 띠에 모았어요. 아래엔 경기당 득점·리바·어시가 바로 보여요." },
      { kind: "p", text: "팀 카드엔 순위를 크게, 득실차와 플레이오프 확률 막대, 팀 득점 1위 선수를 넣었어요." },
      { kind: "list", items: [{ text: "선수 탭 가기", href: "/players" }, { text: "팀 화면 가기", href: "/teams" }] },
    ],
  },
  {
    slug: "2026-10-21-players-grade-filter",
    date: "2026-10-21",
    kind: "update",
    title: "선수 탭에서 등급·점수로 골라 봐요",
    summary: "등급·점수로 선수 고르기",
    blocks: [
      { kind: "p", text: "선수 탭 필터에 종합 등급(S~F)과 점수대(90점 이상, 80점대…) 칩이 생겼어요. A급만, 80점대만 골라 볼 수 있어요." },
      { kind: "p", text: "목록 위에서 등급순, 점수순, 득점순으로 순서도 바꿀 수 있어요." },
      { kind: "list", items: [{ text: "선수 탭 가기", href: "/players" }] },
    ],
  },
  {
    slug: "2026-10-19-card-boxes-back",
    date: "2026-10-19",
    kind: "update",
    title: "선수 카드 예전 모습으로",
    summary: "선수 카드 예전 모습으로",
    blocks: [
      { kind: "p", text: "선수 카드를 기록마다 칸이 나뉘어 있던 예전 모습으로 되돌렸어요. 1~10위 칸은 팀 색으로 옅게 칠해지고, 순위 기준은 카드 아래에 다시 적혀요." },
      { kind: "list", items: [{ text: "선수 보러 가기", href: "/players" }] },
    ],
  },
  {
    slug: "2026-10-17-kbl-official-link",
    date: "2026-10-17",
    kind: "update",
    title: "KBL 공홈으로 바로 갈 수 있어요",
    summary: "공홈 경기 기록 바로 가기",
    blocks: [
      { kind: "p", text: "박스스코어 창 아래 \"KBL 공홈 경기 기록\"을 누르면 공식 홈페이지의 그 경기 기록이 열려요." },
      { kind: "p", text: "화면 맨 아래에도 KBL 공식 홈페이지 버튼을 달았어요." },
      { kind: "list", items: [{ text: "경기 일정에서 박스스코어 열기", href: "/season/49/schedule" }] },
    ],
  },
  {
    slug: "2026-10-17-home-tidy",
    date: "2026-10-17",
    kind: "update",
    title: "홈 정리하고 즐겨찾기 버튼 만들었어요",
    summary: "즐겨찾기는 위쪽 별 버튼",
    blocks: [
      { kind: "p", text: "즐겨찾기한 선수는 이제 홈 가운데가 아니라 화면 위쪽 별 버튼을 누르면 모아 볼 수 있어요." },
      {
        kind: "list",
        items: [
          "홈 부문 1위 표지를 다시 크게",
          "새로 나온 기록은 칸마다 두 줄로 짧게",
          "경기 승리 확률과 예측 적중률은 뺐어요. 팀 화면 플레이오프 확률은 그대로예요",
          "팬 MVP 투표는 닫았어요",
          "선수 프로필의 드래프트 순위가 두 줄로 꺾이던 것도 고쳤어요",
        ],
      },
      { kind: "list", items: [{ text: "즐겨찾기 보기", href: "/favorites" }] },
    ],
  },
  {
    slug: "2026-10-16-cleaner-look",
    date: "2026-10-16",
    kind: "update",
    title: "화면을 조금 덜어냈어요",
    summary: "화면 장식을 덜어냈어요",
    blocks: [
      { kind: "p", text: "기록 1~3위는 큰 색 상자 대신 목록 하나로 보여요. 배경에 깔리던 큰 숫자와 팀 이름도 뺐어요." },
      { kind: "p", text: "홈 새로 나온 기록은 한 상자 안에 줄로, 선수 카드 기록 칸은 숫자만 크게 바꿨어요. 1~3위 메달은 그대로예요." },
      { kind: "p", text: "선수 화면 위쪽 꼬리표는 3개까지만 두고 칭호는 한 줄로 접었어요. 계산 기준 같은 설명은 ⓘ를 누르면 보여요." },
      { kind: "list", items: [{ text: "기록 화면에서 보기", href: "/season/49/leaders" }, { text: "홈에서 보기", href: "/" }] },
    ],
  },
  {
    slug: "2026-10-16-home-top5",
    date: "2026-10-16",
    kind: "update",
    title: "홈 순위 5위까지, 다음 경기 정리",
    summary: "홈 순위 5위까지 보여요",
    blocks: [
      { kind: "p", text: "홈 부문별 순위를 1~3위에서 1~5위로 늘렸어요. 경기당 기록 아래에 몇 경기 뛰었는지도 같이 보여요." },
      { kind: "p", text: "다음 경기 줄도 정리했어요. 연승·연패는 팀 이름 옆 꼬리표로, 내 응원팀 경기는 줄 위쪽에 표시돼요." },
      { kind: "list", items: [{ text: "홈에서 보기", href: "/" }] },
    ],
  },
  {
    slug: "2026-10-16-race-era-predict",
    date: "2026-10-16",
    kind: "update",
    title: "득점왕 레이스랑 리그 평균 대비",
    summary: "득점왕 레이스 생겼어요",
    blocks: [
      { kind: "p", text: "기록 시즌별 화면에 득점왕 레이스가 생겼어요. 상위 5명 경기당 평균이 날짜마다 어떻게 움직였는지 선으로 봐요. 리바·어시·스틸·블록·3점도 돼요." },
      { kind: "p", text: "비교 화면에서 리그 평균 대비를 누르면 시대 차이를 빼고 볼 수 있어요. 97-98 문경은 25.0점은 그 시즌 평균의 245%, 25-26 이정현 18.6점은 251%예요." },
      { kind: "p", text: "아직 안 한 경기 카드엔 관전 포인트가 한 줄 붙어요." },
      { kind: "list", items: [{ text: "득점왕 레이스 보기", href: "/season/49/leaders" }] },
    ],
  },
  {
    slug: "2026-10-16-records-draft-foreign-trends",
    date: "2026-10-16",
    kind: "update",
    title: "드래프트·외국 선수 전당·리그 변화",
    summary: "드래프트·리그 변화 탭",
    blocks: [
      { kind: "p", text: "기록 메뉴에 탭이 세 개 늘었어요." },
      {
        kind: "list",
        items: [
          { text: "드래프트: 해마다 뽑힌 선수와 그 해 선수들이 받은 우승·상을 모아 봐요. 양동근이 뽑힌 2004년은 우승 12번, 정규리그 MVP 4번이에요", href: "/records/draft" },
          { text: "외국 선수 전당: MVP·베스트5·오래 뛴 외국 선수 30명, 맨 위는 통산 12,243점 라건아. 거쳐 간 팀은 로고로 보여 줘요", href: "/records/foreign" },
          { text: "리그 변화: 30년 동안 경기당 팀 득점은 95.5점에서 78.1점으로, 3점 시도 비중은 29.5%에서 40.3%로", href: "/records/trends" },
        ],
      },
      { kind: "p", text: "선수 페이지의 드래프트 글자를 누르면 그해 드래프트로 가요." },
    ],
  },
  {
    slug: "2026-10-16-career-timeline",
    date: "2026-10-16",
    kind: "update",
    title: "선수 타임라인이랑 우리 팀 베스트 5",
    summary: "커리어 타임라인 생겼어요",
    blocks: [
      { kind: "p", text: "선수 페이지에 커리어 타임라인이 생겼어요. 데뷔·이적·우승·수상·커리어 하이·통산 이정표를 시즌별로 한 줄씩 봐요." },
      { kind: "p", text: "슛 습관이 어떻게 바뀌었는지도 나와요. 워니는 골밑·페인트 비중이 86%에서 52%로 줄었고, 이정현은 3점 비중이 40%에서 67%로 늘었어요." },
      { kind: "p", text: "팀 페이지에서는 그 팀 올타임 베스트 5를 직접 짤 수 있어요. 고르면 코트 그림으로 보여 주고 이미지 저장이랑 링크 공유도 돼요." },
      { kind: "list", items: [{ text: "양동근 타임라인 보기", href: "/player/210074" }, { text: "DB 베스트 5 짜기", href: "/team/16" }] },
    ],
  },
  {
    slug: "2026-10-16-record-context",
    date: "2026-10-16",
    kind: "update",
    title: "기록에 얼마나 대단한지 한 줄씩",
    summary: "기록에 맥락 한 줄",
    blocks: [
      { kind: "p", text: "커리어 하이나 통산 기록이 나오면 그게 얼마나 드문 건지 한 줄씩 붙였어요." },
      {
        kind: "list",
        items: [
          "케렘 칸터 42득점: 올 시즌 리그 첫 42득점 이상, 역대 선수 상위 7%만 해 본 기록",
          "변준형 11어시스트: 올 시즌 11어시스트 이상은 리그 3번째",
          "이정현 통산 3점슛 500개: 역대 57번째",
        ],
      },
      { kind: "p", text: "홈 새로 나온 기록이랑 알림함에서 볼 수 있어요. 역대 비교는 국내 선수는 국내 선수끼리 해요." },
      { kind: "list", items: [{ text: "홈에서 보기", href: "/" }] },
    ],
  },
  {
    slug: "2026-10-16-playoff-odds",
    date: "2026-10-16",
    kind: "update",
    title: "플레이오프 확률이 생겼어요",
    summary: "플레이오프 확률 생겼어요",
    blocks: [
      { kind: "p", text: "남은 경기를 1만 번 돌려 보고 팀마다 플레이오프에 갈 확률을 계산했어요. 매일 경기가 끝나면 다시 계산해요." },
      {
        kind: "list",
        items: [
          "팀 화면 아래에 팀별 플레이오프·4강 직행·1위 확률",
          "팀 페이지 이번 시즌 칸에 우리 팀 확률",
        ],
      },
      { kind: "p", text: "KBL 공식 숫자가 아니라 우리가 계산한 추정이에요. 시즌 초엔 지난 시즌 성적도 조금 섞여요." },
      { kind: "list", items: [{ text: "팀 화면 보기", href: "/teams" }, { text: "계산 방법", href: "/glossary#playoff-odds" }] },
    ],
  },
  {
    slug: "2026-10-14-calendar-links",
    date: "2026-10-14",
    kind: "update",
    title: "일정 달력이랑 선수·팀 바로 가기",
    summary: "일정 달력·선수 팀 링크",
    blocks: [
      { kind: "h", text: "일정" },
      { kind: "p", text: "달 칩 아래에 날짜 칸이 생겼어요. 경기 있는 날을 누르면 그날로 바로 내려가요. 내 응원팀 보기에선 칸에 상대 팀 로고랑 승패가 보여요." },
      { kind: "h", text: "어디서든 누르면 이동" },
      {
        kind: "list",
        items: [
          "경기 카드, 리더보드, 홈 표지, 어워즈, 54-0 결과에서 선수 사진·이름을 누르면 선수 페이지로 가요",
          "팀 로고·이름을 누르면 그 시즌 팀 페이지로 가요",
          "팀 페이지는 맨 위에서 시즌을 바꿀 수 있어요",
        ],
      },
      { kind: "list", items: [{ text: "팀 보기", href: "/teams" }] },
    ],
  },
  {
    slug: "2026-10-14-head-to-head-recent-games",
    date: "2026-10-14",
    kind: "update",
    title: "상대 전적이랑 최근 경기 생겼어요",
    summary: "상대 전적·최근 경기 추가",
    blocks: [
      { kind: "h", text: "팀" },
      {
        kind: "list",
        items: [
          "팀 화면 표로 보기 아래에 팀 간 상대 전적 표",
          "팀 페이지 맨 위에 지난 3경기 결과랑 다음 2경기",
          "팀 페이지 로스터 아래에 상대 팀별 전적",
          "팀 페이지는 이번 시즌 로스터가 먼저 나와요. 지난 시즌은 역대 실적 칸으로 한눈에 보고, 칸을 누르면 그 시즌 로스터가 떠요",
        ],
      },
      { kind: "h", text: "선수" },
      { kind: "p", text: "선수 페이지에 최근 5경기 기록이 나와요. 누르면 그날 경기로 가요. 박스스코어가 있는 25-26 시즌부터만 보여요." },
      { kind: "list", items: [{ text: "팀 화면 보기", href: "/teams" }] },
    ],
  },
  {
    slug: "2026-10-14-ongoing-qualify",
    date: "2026-10-14",
    kind: "update",
    title: "이번 시즌 순위는 경기 절반 이상 뛴 선수만",
    summary: "이번 시즌 순위 기준 바뀜",
    blocks: [
      { kind: "p", text: "시즌 초반엔 한 경기만 뛴 선수가 경기당 순위 맨 위에 오르곤 했어요." },
      { kind: "p", text: "이제 이번 시즌 순위와 카드 등급은 팀이 치른 경기의 절반 이상 뛴 선수만 들어가요. 경기가 쌓이면 기준도 같이 올라가요." },
      { kind: "p", text: "모두 보고 싶으면 필터에서 표본 기준을 출전 선수 전원으로 바꾸면 돼요." },
      { kind: "list", items: [{ text: "표본 기준 풀이 보기", href: "/glossary#qualify" }] },
    ],
  },
  {
    slug: "2026-10-12-good-news-alerts",
    date: "2026-10-12",
    kind: "update",
    title: "알림에 좋은 소식이 더 와요",
    summary: "알림 종류가 늘었어요",
    blocks: [
      { kind: "p", text: "응원팀이랑 즐겨찾기 선수 소식을 더 챙겨 드려요." },
      { kind: "h", text: "응원팀" },
      {
        kind: "list",
        items: [
          "경기 있는 날 아침에 시작 시각",
          "3연승부터, 3연패 이상 끊었을 때",
          "1위에 오르거나 6위 안으로 들어왔을 때",
          "플레이오프 진출, 4강 직행, 정규리그 1위가 확정됐을 때",
        ],
      },
      { kind: "h", text: "즐겨찾기 선수" },
      {
        kind: "list",
        items: [
          "더블더블, 트리플더블",
          "이번 시즌 리그 최고 기록",
          "경기당 부문 5위 안이나 1위에 올랐을 때",
          "통산 기록 역대 30위 안에서 순위가 올랐을 때",
          "생일, MVP 같은 수상",
        ],
      },
      { kind: "p", text: "받기 싫은 종류는 알림함 위 받을 소식에서 끌 수 있어요." },
      { kind: "list", items: [{ text: "알림함 열기", href: "/notifications" }] },
    ],
  },
  {
    slug: "2026-10-11-recent-feats",
    date: "2026-10-11",
    kind: "update",
    title: "홈에서 새로 나온 기록, 팀 연승을 봐요",
    summary: "새로 나온 기록·연승",
    blocks: [
      { kind: "p", text: "홈 경기 카드 아래에 최근 7일 경기에서 나온 커리어 하이, 이번 시즌 리그 최다 기록, 통산 득점·출전 이정표를 모았어요. 즐겨찾기 안 한 선수 소식도 다 보여요." },
      { kind: "p", text: "팀이 2연승이나 2연패 이상이면 홈 다음 경기, 팀 화면 카드, 순위 표에 같이 표시돼요." },
      { kind: "p", text: "선수 페이지의 순위 기준(전체, 같은 포지션) 버튼은 카드 바로 위로 올렸어요." },
      { kind: "list", items: [{ text: "홈에서 보기", href: "/" }, { text: "팀 화면에서 보기", href: "/teams" }] },
    ],
  },
  {
    slug: "2026-10-11-bottom-menu",
    date: "2026-10-11",
    kind: "update",
    title: "폰 아래 메뉴를 가지런히 정리했어요",
    summary: "폰 아래 메뉴 정리",
    blocks: [{ kind: "p", text: "폰 화면 아래 메뉴에서 홈을 맨 왼쪽으로 옮기고 여섯 칸을 같은 모양으로 맞췄어요. 지금 보고 있는 화면은 파랗게 표시돼요." }],
  },
  {
    slug: "2026-10-09-schedule-fold",
    date: "2026-10-09",
    kind: "update",
    title: "일정에서 지난 경기는 접어 뒀어요",
    summary: "일정 지난 경기 접기",
    blocks: [
      { kind: "p", text: "일정 화면에서 지난 경기는 최근 이틀 치만 보이고, 그 전 경기는 맨 위 \"지난 경기 더 보기\"를 누르면 나와요. 폰에서 한참 내리지 않아도 돼요." },
    ],
  },
  {
    slug: "2026-10-08-home-my-team",
    date: "2026-10-08",
    kind: "update",
    title: "홈에서 우리 팀 경기가 먼저 나와요",
    summary: "홈에 응원팀 경기 먼저",
    blocks: [
      { kind: "p", text: "로그인하고 응원팀을 골라 두면 홈 최근 경기와 다음 경기에서 우리 팀 경기가 맨 앞에 와요. \"내 응원팀\" 표시도 붙어요." },
      {
        kind: "list",
        items: [
          "즐겨찾기한 선수가 있으면 홈에서 큰 표지 카드보다 위에 보여요",
          { text: "응원팀 고르러 가기", href: "/me" },
        ],
      },
    ],
  },
  {
    slug: "2026-10-08-rank-change",
    date: "2026-10-08",
    kind: "update",
    title: "순위가 오르내린 게 보여요",
    summary: "리더보드 순위 변동",
    blocks: [
      { kind: "p", text: "시즌 중 리더보드 순위 옆에 지난 경기일보다 몇 계단 오르고 내렸는지 화살표가 붙어요. 처음 10위 안에 든 선수는 \"새로\"라고 떠요." },
      {
        kind: "list",
        items: [
          "선수 페이지를 내리면 맨 위에 이름이 작게 붙고, 카드·추이·슛 차트·기록·커리어 하이로 바로 가는 탭이 생겨요",
          "선수 페이지에 이번 시즌 경기별 득점·리바·어시 최저~최고 막대가 생겼어요. 파란 점이 평균, 빈 동그라미가 최근 경기예요",
          "박스스코어를 열면 맨 위에 이 경기 포인트가 두세 줄 나와요",
          "알림함에서 받을 소식을 종류별로 끄고 켤 수 있어요. 폰 알림에도 똑같이 적용돼요",
          "선수 페이지 맨 위가 PC 에서 덜 비어 보이게 통산 기록을 옆에 붙였어요",
          { text: "기록 보러 가기", href: "/records" },
          { text: "알림함 가기", href: "/notifications" },
        ],
      },
    ],
  },
  {
    slug: "2026-10-08-search-asof",
    date: "2026-10-08",
    kind: "update",
    title: "검색창이 조금 똑똑해졌어요",
    summary: "검색창 최근 본 선수",
    blocks: [
      { kind: "p", text: "검색창을 누르기만 해도 최근 본 선수랑 지난 경기 활약 선수 3명이 바로 떠요." },
      {
        kind: "list",
        items: [
          "홈·기록·팀 화면 위에 \"10월 7일 경기까지 반영\"처럼 언제 기록인지 적어 뒀어요",
          "폰 알림은 밤 12시부터 아침 8시까지 쉬고, 그 사이 소식은 아침에 모아서 보내요",
          "기록 화면에서 필터 때문에 아무도 안 나오면 \"필터 초기화\" 버튼이 나와요",
          { text: "기록 보러 가기", href: "/records" },
        ],
      },
    ],
  },
  {
    slug: "2026-10-08-push",
    date: "2026-10-08",
    kind: "update",
    title: "폰으로 알림을 받을 수 있어요",
    summary: "폰 알림 켜기",
    blocks: [
      { kind: "p", text: "알림함 맨 위 \"켜기\"를 누르면 즐겨찾기 선수랑 응원팀 소식이 폰으로 와요. 사이트를 안 열어도 돼요." },
      {
        kind: "list",
        items: [
          "로그인한 상태에서 켤 수 있어요",
          "아이폰은 사파리 공유 버튼에서 \"홈 화면에 추가\"로 설치한 앱에서 켜요",
          "기록이 들어오고 몇 분 뒤 하루 한 번, 소식을 하나로 묶어서 보내요",
          { text: "알림 켜러 가기", href: "/notifications" },
        ],
      },
      { kind: "p", text: "업데이트 소식도 10개씩 쪽으로 나눴어요." },
    ],
  },
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
    slug: "2026-10-07-ranking-cards",
    date: "2026-10-07",
    kind: "update",
    title: "주간 순위에 선수 카드가 붙었어요",
    summary: "주간 순위에 선수 카드 추가",
    blocks: [
      { kind: "p", text: "54-0 주간 순위에서 이름만 나오던 다섯 명이 사진, 종합 등급, 시즌이 담긴 작은 카드로 바뀌었어요. 카드를 누르면 그 선수 그 시즌 페이지로 가요." },
      { kind: "list", items: [{ text: "주간 순위 보기", href: "/game/ranking" }] },
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

/** 글쓴이 — 업데이트 소식은 운영자만 쓴다 (2026-10-08 사용자: 운영자가 올린 글인 걸 알게) */
export const UPDATE_AUTHOR = "로방";

/** 목록 한 쪽에 보이는 글 수 (2026-10-08 사용자: 10개씩) */
export const UPDATES_PER_PAGE = 10;

/** "?page=" 값 → 1 이상 정수 (이상한 값은 1) */
export function parsePageParam(raw: string | null | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** 목록 나누기: 쪽 번호가 넘치면 마지막 쪽 */
export function paginate<T>(items: readonly T[], page: number, perPage = UPDATES_PER_PAGE): { items: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const p = Math.min(Math.max(1, page), totalPages);
  return { items: items.slice((p - 1) * perPage, p * perPage), page: p, totalPages };
}
