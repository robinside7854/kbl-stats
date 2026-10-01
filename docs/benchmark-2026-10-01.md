# 벤치마크 조사: 국내외 농구 기록·커뮤니티 사이트 (2026-10-01)

> 목적: 앞으로 이 사이트(KBL - Stats Reference)의 디자인·기능을 정할 때 참고할 사이트를 한곳에 모은다.
> 조사 방법: 웹 검색 결과와 각 사이트 소개 글로 정리했다. 이 작업 환경은 일부 사이트(매니아, Basketball-Reference, NBA.com 등)에 직접 접속이 막혀 있어 화면을 눈으로 확인하지 못한 곳이 있다. 그런 곳은 "직접 확인 못 함"으로 적었다.
> 판단 기준: ① 팬이 "즐기면서 보는" 데 도움이 되는가 ② 지금 우리가 가진 KBL 데이터로 만들 수 있는가 ③ SCOPE.md 범위 안인가

---

## 1. 한눈에 보기: 꼭 참고할 사이트 7곳

| 순위 | 사이트 | 무엇을 배울까 | 우리 데이터로 가능? |
|---|---|---|---|
| 1 | **Baseball Savant** (MLB, 야구) | 선수 페이지 맨 위 "백분위 막대" — 능력치를 빨강(상위)~파랑(하위) 막대로 한눈에 | 가능 (레이더 6축·세부 항목 백분위가 이미 있음) |
| 2 | **Basketball-Reference** | 시즌별 기록표·리그 1위 굵게·비슷한 선수·역대 기록 — "기록 사전"의 표준 | 대부분 이미 반영함 |
| 3 | **Cleaning the Glass** | 모든 숫자 옆에 백분위, 가비지 타임 제외, 포지션별 비교 | 백분위 표시는 가능, 가비지 타임 제외는 경기 기록(play-by-play)이 없어 불가 |
| 4 | **databallr** | "공유하고 싶게" 만든 선수 카드·티어 리스트 게임·드래프트 게임 | 카드 공유·티어 리스트는 가능 |
| 5 | **NBA.com Stats** | 공식 슛 차트·구역별 성공률·클러치 기록 | 슛 차트는 이미 있음, 클러치는 경기 기록이 없어 불가 |
| 6 | **2KRatings** (NBA 2K 게임 능력치) | 게임처럼 능력치 숫자·배지·필터 | 이미 등급 점수·칭호 배지로 반영, "배지로 선수 찾기" 필터는 가능 |
| 7 | **스탯티즈 (STATIZ, 야구)** | 국내 팬이 익숙한 "한국형 기록 사이트" 화면 구성·용어 | 참고용 (화면 배치·한국어 표현) |

---

## 2. 국내

### 2-1. 공식·포털

| 사이트 | 특징 | 배울 점 / 아쉬운 점 |
|---|---|---|
| [KBL 공식 홈페이지](https://www.kbl.or.kr/) | 일정·순위·선수·팀 기록, 시즌 리더. 2025-26부터 스크린 어시스트·디플렉션 등 새 지표 추가([쿠키뉴스](https://www.kukinews.com/article/view/kuk202510020102)) | 기록은 가장 정확하지만 표 위주라 읽기 어렵다 — 이 사이트를 만든 이유 그대로 |
| [WKBL 공식](https://www.wkbl.or.kr/game/player_record.asp) | 여자농구 선수·팀 기록, 부문별 순위 | 구조는 KBL 과 비슷. 나중에 WKBL 로 넓힐 때 참고 (지금은 범위 밖) |
| [다음 스포츠 KBL 기록](https://sports.daum.net/record/kbl) | 순위·선수 기록을 포털에서 바로 | 모바일에서 빠르고 단순한 표. "빨리 찾기"의 기준선 |
| 네이버 스포츠 농구 | 일정·문자 중계·기록·영상 하이라이트 | 영상과 기록을 한 화면에 묶는 방식 (영상은 우리 범위 밖) |

### 2-2. 매체 (기록 기사)

| 사이트 | 특징 | 배울 점 |
|---|---|---|
| [점프볼](https://jumpball.co.kr/) | 국내 농구 전문 매체. 예: "당분간 나오기 힘든 KBL 20가지 기록"([기사](https://jumpball.co.kr/news/newsview.php?ncode=179530859844954&dt=m)) | 기록을 "이야기"로 묶는 방식 — 홈 화면의 "오늘의 기록" 같은 코너 아이디어 |
| [루키 (ROOKIE)](https://www.rookie.co.kr/) | 기록 기사 코너가 따로 있음 (예: 한 경기 최다 3점 시도) | 한 경기 최다·역대 기록을 기사 소재로 쓰는 시선 |
| 바스켓코리아 | 국내외 농구 소식 | 참고 정도 |

### 2-3. 커뮤니티

| 커뮤니티 | 특징 | 배울 점 |
|---|---|---|
| [매니아 (mania.kr)](https://namu.wiki/w/%EB%A7%A4%EB%8B%88%EC%95%84(%EC%BB%A4%EB%AE%A4%EB%8B%88%ED%8B%B0)) | NBA 중심, KBL 게시판(kbltalk) 활발 | **경쟁·참고 대상 발견**: 이 게시판에 개인이 만든 "KBL 게임 기록 Look up 사이트" 소개 글이 있다([글](https://mania.kr/g2/bbs/board.php?bo_table=kbltalk&wr_id=758243)). 1997년부터 선수별 경기 기록, R Shiny 기반이라 PC 친화적. 직접 확인 못 함 — 사용자가 한번 열어 보면 좋다 |
| 디시인사이드 남자농구 마이너 갤러리, 에펨코리아 농구 게시판 | 팬 반응이 가장 빠른 곳 | 우리 카드 PNG·비교 화면이 퍼질 수 있는 곳. 공유했을 때 보기 좋은 이미지 크기·문구가 중요 |

### 2-4. 다른 종목 국내 사이트

| 사이트 | 배울 점 |
|---|---|
| [스탯티즈](https://www.statiz.co.kr/) (KBO) | 국내 팬에게 가장 익숙한 기록 사이트. WAR 같은 고급 지표를 한국어로 풀어 쓰는 방식, 선수 페이지 정보 밀도. 우리 "용어 풀이"와 선수 상세의 한국어 표현 기준으로 삼기 좋다 |

---

## 3. 해외: NBA 기록·분석 사이트

| 사이트 | 특징 | 우리에게 가져올 것 | 우리 데이터로 가능? |
|---|---|---|---|
| [Basketball-Reference](https://www.basketball-reference.com/) | 모든 리그·시대 기록, PER·Win Shares·BPM, 비슷한 선수, 역대 기록. 직접 확인 못 함 | 시즌 기록표, 리그 1위 굵게, 비슷한 시즌, 역대 기록 → **이미 반영**. 남은 것: "그 시즌 수상·올스타" 표시, 커리어 마일스톤(예: 통산 5,000점까지 몇 점) | 마일스톤은 가능, 수상 기록은 수집 안 함 |
| [NBA.com Stats](https://pr.nba.com/nba-stats-sap/) | 공식 기록, 시각적 슛 차트, 포제션당·클러치 기록 | 구역별 핫/콜드 슛 차트(리그 평균보다 높으면 빨강) | 가능 — 구역별 성공률·리그 평균이 이미 있음 |
| [Cleaning the Glass](https://cleaningtheglass.com/stats/) | 가비지 타임·버저비터 제외, 모든 지표 옆 백분위, 포지션 추정. 월 5달러 | 숫자마다 작은 백분위 표시 | 백분위 표시는 가능. 가비지 타임 제외는 불가(경기 진행 기록 없음) |
| [Dunks & Threes](https://dunksandthrees.com/) | EPM(추정 득실 마진) 순위, 선수 비교 화면 | 선수 비교 화면의 막대 배치 | 비교 화면 디자인 참고만 (EPM 계산은 경기 기록 필요) |
| [Crafted NBA](https://craftednba.com/) | 여러 고급 지표를 한 대시보드에, 역할(role) 분류 | 역할 유형 분류 방식 → 우리 "플레이스타일" 개선 참고 | 가능 |
| [BBall Index](https://www.bball-index.com/) | LEBRON 지표, 선수 능력(스킬) 등급 | 능력 등급을 "A+, B-" 처럼 보여 주는 방식 | 이미 S~F 등급으로 반영 |
| [databallr](https://databallr.com/) | 선수 대시보드, 1:1 비교, 티어 리스트(끌어다 놓기), 라인업 드래프트 게임. 만든 사람이 "트위터에서 퍼지게" 공유 이미지를 설계([인터뷰](https://thednvr.com/nuggets/nba-analytics-databallr-qa-interview-conversation/)) | **티어 리스트 만들기**(선수를 S~F 칸에 끌어다 놓고 이미지로 저장), 공유 이미지 안에 핵심 숫자 넣기 | 가능 (브라우저에서만, 저장은 이미지로) |
| [StatMuse](https://en.wikipedia.org/wiki/StatMuse) | "커리 3점 몇 개?"처럼 말로 묻는 검색 | 검색창에 자주 묻는 질문 바로가기 | 말 검색은 AI 비용·서버가 필요해 지금 원칙(정적 사이트)과 안 맞음. "자주 묻는 기록" 바로가기 정도만 가능 |
| [Viziball](https://viziball.app/nba/en) · [3StepsBasket](https://3stepsbasket.com/nba/charts/) | 그래프 중심 기록 사이트 (산점도·막대 차트를 고르는 방식) | 두 지표를 골라 산점도로 보는 화면 | 가능 (예전 팀 분포 산점도를 일반화) |
| [NBAstuffer](https://www.nbastuffer.com/) | 지표 설명 글이 친절함 | 용어 풀이 문장 참고 | 참고용 |
| [2KRatings](https://www.2kratings.com/) | NBA 2K 게임 능력치·배지, 배지로 선수 찾기([배지 필터](https://www.2kratings.com/badges-filter)) | "칭호 배지로 선수 찾기" | 가능 (칭호 배지가 이미 있음) |

---

## 4. 해외: 다른 리그 공식·통합 사이트

| 사이트 | 특징 | 배울 점 |
|---|---|---|
| [EuroLeague 공식 기록](https://www.euroleaguebasketball.net/en/euroleague/stats/) | 선수·팀 기록, 부문별 순위 | 유럽 리그 공식 사이트의 깔끔한 순위 카드 |
| [Hackastat](https://hackastat.eu/en/players-stats/) | 유럽 리그 고급 기록, 선수 비교, 슛 지도 | 비 NBA 리그에서도 이 정도 분석 사이트가 된다는 사례 — 우리와 가장 처지가 비슷 |
| [B.LEAGUE 공식](https://www.bleague.jp/en/) (일본) | 기록 상세, 커리어 하이, **피지컬 테스트**(선수 체력 측정) 공개 | 아시아 리그 공식 사이트 중 팬 콘텐츠가 가장 풍부. 커리어 하이는 이미 반영 |
| [RealGM](https://basketball.realgm.com/international/league/105/Japanese-BLeague) | 전 세계 리그 기록·이적·포럼 | 외국인 선수의 다른 리그 경력 확인용 (우리 데이터에는 없음) |
| [Flashscore](https://www.flashscore.co.kr/basketball/south-korea/kbl/) · [Sofascore](https://www.sofascore.com/basketball/tournament/japan/bleague/1502) · [Livesport](https://www.livesport.com/kr/basketball/south-korea/kbl/) | 실시간 점수·경기 기록, KBL 포함 | 실시간은 우리 원칙(하루 1회)과 반대라 참고만. 경기 결과 카드 디자인은 참고 가능 |

---

## 5. 다른 종목에서 가져올 디자인

| 사이트 | 배울 점 | 우리 적용 아이디어 |
|---|---|---|
| [Baseball Savant](https://www.mlb.com/news/baseball-savant-statcast-player-pages-new-look) | 선수 페이지 맨 위 "백분위 순위" 막대. 하위 = 파랑, 상위 = 빨강 그라데이션 동그라미. 한눈에 "어떤 선수인지" 보인다. 최근 선수 비교 도구 추가([변경 기록](https://baseballsavant.mlb.com/changelog/2026-07-20-player-comparison-tool)) | 선수 상세 카드 아래에 레이더 세부 항목(득점·야투·자유투 시도·스틸·블록 등) 백분위 막대 목록. 레이더 그림보다 숫자를 읽기 쉽다 |
| FotMob·Sofascore (축구) | 경기마다 선수 평점, 시즌 평균 평점 색 배지 | 종합 점수(1~99) 배지를 경기 단위로는 못 하지만, 시즌 카드에 이미 비슷하게 있음 |
| 스탯티즈 (야구) | 한국어 고급 지표 설명 | 용어 풀이 문장 |

---

## 6. 우리 사이트에 넣을 후보 (우선순위 제안)

SCOPE.md 의 IN 목록에 없는 새 화면은 만들기 전에 사용자 확인이 필요하다(코딩 규칙). 아래는 제안일 뿐 아직 만들지 않았다.

| 우선 | 아이디어 | 참고 | 필요한 데이터 | 난이도 |
|---|---|---|---|---|
| 높음 | **백분위 막대 목록** (선수 상세 카드 아래, 세부 항목별 빨강~파랑 막대) | Baseball Savant, Cleaning the Glass | 있음 (레이더 구성 요소 백분위) | 낮음 |
| 높음 | **슛 차트 핫/콜드 구역** (구역 색 = 리그 평균 대비) | NBA.com | 있음 (구역 성공률·리그 평균) | 낮음 |
| 높음 | **티어 리스트 만들기** (선수를 S~F 줄에 끌어다 놓고 이미지 저장) | databallr | 있음 (검색 색인·카드 이미지 저장 기능) | 중간 |
| 중간 | **칭호 배지로 선수 찾기** | 2KRatings | 있음 | 낮음 |
| 중간 | **커리어 마일스톤** ("통산 5,000점까지 123점") | Basketball-Reference | 있음 (통산 합계) | 낮음 |
| 중간 | **두 지표 산점도** (가로·세로 지표를 골라 시즌 선수 분포) | Viziball, 3StepsBasket | 있음 | 중간 |
| 중간 | **홈 "오늘의 기록" 한 줄** (역대 기록·생일·마일스톤을 기사처럼) | 점프볼·루키 기록 기사 | 있음 | 낮음 |
| 낮음 | 클러치·가비지 타임 제외·온/오프 기록 | NBA.com, Cleaning the Glass | **없음** (경기 진행 기록 필요 — 서버 C 미확인) | 높음 |
| 낮음 | 말로 묻는 검색 | StatMuse | AI 서버 필요 — 지금 원칙(DB·서버 없음)과 충돌 | 높음 |
| 범위 밖 | 실시간 점수, 영상 하이라이트, 댓글 | Flashscore, 네이버 | SCOPE OUT | - |

---

## 7. 조사의 한계

- 이 작업 환경에서 매니아(mania.kr)·Basketball-Reference·NBA.com 은 접속이 막혀 화면을 직접 보지 못했다. 소개 글·검색 결과로 정리했다.
- 매니아에 소개된 개인 제작 "KBL 게임 기록 Look up 사이트"는 우리와 가장 가까운 사례라 사용자가 직접 열어 보고 기능을 비교해 보길 권한다.
- 유료 사이트(Cleaning the Glass, BBall Index 일부)는 공개된 소개 내용 기준이다.
