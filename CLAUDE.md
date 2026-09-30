# KBL 스탯 대시보드 (가칭)

> 이 파일은 Claude Code가 이 프로젝트에서 작업할 때 매 세션 자동으로 읽는 "프로젝트 기억"이다.
> 세션 시작 시 이 파일과 `SCOPE.md`를 먼저 읽고, 세션 종료 시 하단 세션 로그에 한 줄 남긴다.

## 이 프로젝트는 무엇인가
- 핵심 문제: KBL 공식 홈페이지의 기록은 표+숫자뿐이라 재미없고 읽기 어렵다. 팬이 "즐기면서 보는" 시각화 대시보드가 없다.
- 사용자: 1차 — KBL 팬 (커뮤니티·팬사이트 이용자). 2차(나중) — 구단·연맹 관계자, 포트폴리오 열람자.
- 단계: ① 팬심 비영리 공개 프로젝트 → ② 포트폴리오 → ③ 사업화 검토 (③은 KBL 사전 서면 승낙 필요, 아래 "법적 제약" 참고)
- 예상 규모 (6개월): 동시 접속 수십~수백 명 수준의 팬사이트. 데이터는 시즌당 선수 ~200명 × 시즌 30개 + 라인업 수천 행. 대형 인프라 불필요.

## 데이터 소스 (2026-09-29 확인)
KBL 공홈은 화면을 그릴 때 아래 두 서버에서 JSON을 받아온다. 인증·API 키 없음. **공식 문서가 없는 비공식 API이므로 언제든 바뀔 수 있다.**

### 서버 A: `https://api-stats.kbl.or.kr` — 전체 선수 기록 (주 데이터원)
- `GET /api/records/player/general/traditional` — 1차 스탯, 시즌 전체 선수(약 190~200명)를 한 번에
- `GET /api/records/player/general/advanced` — 2차 스탯 (PER, OFF/DEF/NET RTG, eFG%, TS%, AST%, AST/TO, OREB/DREB/REB%, USG%, PACE, TOV%, PIE, POSS)
- 공통 파라미터: `seasonCode`, `gameCode`, `sortDataSc`(정렬 기준, 예: SCORE), `sortOrderSc`(asc/desc), `listCn`(페이지 크기, 200이면 전체), `pageNo`, `ruleCk=0&perCn=0&lastCn=0&partIfList=0&draftNo=0`
- 응답 형태: `{ resultCode, message, data: [ {row}, ... ] }` — `data`가 바로 배열
- traditional 주요 필드: `playerNo, kname, ename, teamCode, teamName1, teamName4, gameCount, win, lose, playSec, score, fg, fgA, fgRt, threep, threepA, threepRt, fdg, fdgA, fdgRt, ft, ftA, ftRt, dk, dkA, oR, dR, rb, aS, sT, gd, bS, tO, foulTot, dd2, td3, margin, sA, df, totalCn`
- ⚠️ 필드 뜻 주의: `fg/fgA/fgRt`는 **2점슛**, `fdg/fdgA/fdgRt`가 **전체 야투**(2점+3점). fdg = fg + threep, score = 2×fg + 3×threep + ft 로 확인(2026-09-30). process.ts가 fgm←fdg, twoPm←fg 로 변환
- advanced 주요 필드: `perRt, offrtg, defrtg, netrtg, efgRt, tsRt, astRt, astTo, astRatio, orebRt, drebRt, rebRt, usgRt, pace, tovRt, toRatio, pie, poss`
- 주의: `sortDataSc`에 존재하지 않는 열 이름을 넣으면 500 에러 (예: advanced에 `PER` 넣으면 실패). 정렬은 우리 쪽에서 하고 API 정렬은 기본값(SCORE)만 쓴다.
- 주의: `listCn`은 **255 이하**만 허용 (서버가 tinyint로 변환, 300이면 500 에러). 200으로 두고 `totalCn`으로 페이지를 넘긴다.
- GitHub Actions 러너에서 이 서버 접속 가능 확인 (2026-09-29, 첫 실행에서 도달 성공)
- `playSec`은 초 단위. 분으로 바꿔서 보여준다.

### 서버 B: `https://kbl-api.sports2i.com` — 시즌리더(부문별 상위 5명), 공통 코드
- `GET /api/v1/season-leaders/persons?seasonCode=&gameCode=` / `.../teams?...` — 상위 5명만 → 참고용, 주 데이터원 아님
- `GET /api/v1/Common/recent-seasons?seriesCd=1`, `/api/v1/Common/kbl-season-game/{seasonCode}`, `/api/v1/Common/team?seasonCodeList=&gameCodeList=` — 시즌·경기구분·팀 코드표. **코드표는 하드코딩하지 말고 여기서 받아 저장한다.**
- 운영 주체가 KBL이 아닌 외부 기록업체(Sports2i)임.

### 이미지 (2026-09-30 Actions 러너에서 공홈 HTML·JS·CSS 확인 — 상세는 PLAN.md §5)
- 선수 사진: `https://kbl.or.kr/files/kbl/players-photo/{playerNo}.png` (옛 선수도 있음, 없으면 200이지만 HTML 반환)
- 현재 팀 로고: `https://kbl.or.kr/assets/img/ico/logo/ic-{teamLogoName}.svg` (정관장만 `/assets/img/logo/logo-jkj.png`), 옛 팀 로고: `.../ico/logo/old/{teamLogoName}e.png`
- 규칙: 레포에 복사하지 않고 핫링크. 주소는 `scripts/process.ts`가 processed JSON에 써 넣고 화면은 그 값만 쓴다(원칙 1). 로드 실패 시 팀 색+이니셜 대체, 환경변수로 전체 끄기 가능해야 함. 하단 출처에 "사진·로고 © KBL 및 각 구단".

### 코드 체계
- 시즌 코드: 1997=1, 1997-98=2, 1998-99=3 … 2007-08=12, 2008-09=13, 이후 홀수 증가 → 2024-25=45, 2025-26=47, 2026-27=49. (규칙이 중간에 바뀌므로 반드시 코드표에서 받는다)
- 경기 구분(gameCode): 정규시즌 `01`, 플레이오프 `03,04`, 챔피언결정전 `04`, 전체 `01,03,04`. 올스타·컵대회 등 별도 코드 존재
- 팀 코드 예: 55=서울 SK, 60=부산 KCC, 50=창원 LG, 16=원주 DB, 10=울산 현대모비스, 66=고양 소노 (전체 목록은 코드표 API에서)

### 시즌별 데이터 커버리지 (2026-09-30 processed 전수 확인 — 화면 설계의 기준)
- 1차 스탯, PER, TS%, eFG%, TOV%, AST ratio, AST/TO, ORtg: **30개 시즌 전부** 있음
- +/-: 1997-98부터. 굿디펜스(gd): 2000-01부터
- **USG%, PIE, AST%, REB%, OREB/DREB%, DEF/NET RTG, PACE, POSS: 2025-26(코드 47)만** 정상(선수 97%). 2023-24·2024-25는 24명 정도만, 그 이전은 전부 0 → 레이더 카드 4개 축이 옛 시즌에선 무의미. 시즌 파일에 `coverage` 플래그를 넣어 화면이 축·열을 켜고 끈다(PLAN.md ①)
- 스크린 어시스트·디플렉션: 2025-26만
- playerNo는 시즌이 바뀌어도 동일(803명이 2개 시즌 이상) → 선수 커리어 페이지 가능. 동명이인 32명 있으므로 이름이 아닌 playerNo로 식별
- teamCode는 팀명 변경에도 유지(안양 KT&G→KGC→정관장=70), 구단 매각 시엔 새 코드(안양 SBS=40 → KT&G=70)

### 아직 확인 안 된 것 (다음 세션에서 확인)
- 라인업기록(`/record/lineup`)의 API 주소·파라미터 — 화면상 5인 조합별 G, MIN, 득실, +/- 등 제공 확인됨(2025-26 정규시즌 357페이지). 주소는 미확인
- 경기별 박스스코어·일정 API — 미확인. `/game/schedule`은 404였음
- 팀 기록(`/record/team`) API — 미확인
- 서버 A의 요청 빈도 제한 여부 — 알 수 없음. 안전하게 요청 간 1초 이상 간격

## 기술 스택 / 제약
- 언어: **TypeScript (Node.js)** — 수집 스크립트와 화면을 한 언어로. 비개발자가 Claude Code와 함께 유지하기에 파일 수가 적고 읽기 쉬움
- 화면: **Next.js (App Router) + Tailwind CSS**, 배포는 **Vercel** — 이전 대시보드(basketball-stats-dashboard.vercel.app)와 같은 환경이라 익숙함
- 차트: **Recharts** 하나만. 레이더·바·라인·산점도 전부 커버. 차트 라이브러리 두 개 이상 섞지 않는다
- 데이터 저장: **레포 안의 JSON 파일** (`data/raw/`, `data/processed/`). DB 없음
- 수집 실행: **GitHub Actions 스케줄** (매일 새벽 1회) → 수집 스크립트 실행 → 변경분 커밋 → Vercel 자동 재배포
- 절대 피함: DB(Supabase 등), 로그인/회원, 실시간 갱신, 서버 상태 유지가 필요한 구조, 브라우저에서 KBL API 직접 호출(CORS 차단됨, 아래 참고)
- 이유: 규모가 작고 데이터가 하루 한 번만 바뀐다. 파일+정적 사이트가 가장 싸고(무료) 가장 덜 고장난다. 나중에 사업화하면 그때 DB로 옮긴다

## 아키텍처 원칙
1. **수집(ETL)과 화면(Web)은 완전히 분리** — `scripts/`는 KBL API를 알고, `app/`은 `data/processed/*.json`만 안다. 화면 코드에 KBL 주소가 등장하면 안 된다. 왜: API가 바뀌어도 화면은 안 건드린다.
2. **원본은 절대 가공하지 않고 그대로 저장** — `data/raw/{season}/{endpoint}.json`에 응답을 받은 그대로 저장. 가공은 `data/processed/`에 별도 생성. 왜: 비공식 API가 사라져도 쌓아둔 원본은 남는다. 가공 로직에 버그가 있어도 원본에서 다시 만들 수 있다.
3. **KBL API 호출은 서버 쪽(스크립트/Actions)에서만** — 브라우저에서 직접 부르면 CORS 헤더가 없어 차단된다. 왜: 확인된 기술 제약.
4. **매일 1회, 시즌 단위로 전체 덮어쓰기** — 증분 갱신 로직 없음. 왜: 데이터가 작아 전체 재수집이 더 단순하고 버그가 적다.
5. **지표 계산은 한 곳에서** — 파생 지표(예: 분당 득점, 40분 환산)는 `lib/metrics.ts` 한 파일에 순수 함수로. 화면 컴포넌트 안에서 계산하지 않는다. 왜: 같은 지표가 화면마다 다르게 계산되는 사고 방지.
6. **출처 표기 필수** — 모든 화면 하단에 "기록 출처: KBL 공식 홈페이지 · 비영리 팬 프로젝트" 고정 표시. 왜: 법적 제약 참고.

## 법적 제약 (2026-09-29 약관 확인)
- KBL 이용약관 제23조: 홈페이지에서 얻은 정보를 KBL 사전 승낙 없이 **영리목적**으로 복제·배포 금지. 제28조: 사전 서면 승인 없는 영업활동 금지.
- → 비영리 팬 프로젝트 단계는 약관 문면상 저촉 없음. **광고·유료화·납품 등 영리 전환 전에 반드시 KBL 서면 승낙**. Sports2i(서버 B 운영사)와의 관계도 그때 확인.
- 크롤링 금지 조항은 없으나 서버 부하는 별개 문제 → 하루 1회, 요청 간격 1초 이상.
- 경기 기록 숫자 자체의 저작권 여부·DB제작자 권리는 확실하지 않음 → 사업화 시 변호사 검토 항목.

## 의식적으로 감수하는 트레이드오프
- JSON 파일 저장 → 시즌 30개 × 여러 엔드포인트가 쌓이면 레포가 커진다. 수십 MB 수준까지는 문제없음. 100MB 넘어가거나 검색·필터가 느려지면 DB로 이전 (갚을 시점: 라인업 데이터 전 시즌 수집 시 재평가)
- 정규시즌만 우선 → 플레이오프·컵대회는 gameCode만 바꾸면 되지만 화면 설계가 복잡해지므로 1차 범위에서 제외
- 라인업·경기별 데이터는 API 주소 확인 전까지 보류 → 확인되면 원칙 2에 따라 raw부터 저장
- 2차 스탯은 KBL이 계산한 값을 그대로 씀 (직접 재계산하지 않음) → 계산식이 NBA 표준과 다를 수 있으나 "공식 수치"라는 신뢰가 더 중요. WS·BPM 등 KBL이 안 주는 지표를 직접 만들 때만 `lib/metrics.ts`에 계산식과 출처를 주석으로 남긴다

## 폴더 구조
```
kbl-stats/
├── CLAUDE.md            ← 이 파일
├── SCOPE.md             ← 범위 정의 (IN / OUT / 추가 기준)
├── PLAN.md              ← 화면 구성 설계와 작업 순서 (①데이터 정비 → ②순위표 → ③선수 페이지 → ④팀 분포 → ⑤홈)
├── tsconfig.json        ← 화면(app + lib) 타입 설정 — next build가 사용
├── tsconfig.scripts.json← 수집 스크립트·테스트 타입 설정 (tsx 실행분)
├── next.config.mjs, postcss.config.mjs  ← Next.js / Tailwind v4 설정
├── .env.example         ← NEXT_PUBLIC_OFFICIAL_IMAGES (공식 사진·로고 끄기 스위치) 설명
├── scripts/
│   ├── fetch.ts         ← KBL API 호출 + data/raw 저장 (API 주소는 여기와 config에만)
│   ├── process.ts       ← raw → processed 변환 (photoUrl·logoUrl·팀 color 추가)
│   ├── image-urls.ts    ← KBL 사진·로고 주소 생성 (playerPhotoUrl, teamLogoUrl) — KBL 이미지 주소는 여기에만
│   ├── config.ts        ← 엔드포인트, 시즌 목록, 요청 간격
│   └── build-search-index.ts ← 검색용 경량 색인 public/search-index.json 생성 (npm prebuild·predev 로 자동 실행, 생성물은 .gitignore)
├── tests/
│   ├── metrics.test.ts  ← lib/metrics.ts 검증 (npm run test:metrics)
│   ├── leaders.test.ts  ← lib/leaders.ts 검증 (npm run test:leaders)
│   ├── card.test.ts     ← 플레이어 카드 스탯·순위 검증 (npm run test:card)
│   └── player.test.ts   ← 통산 계산·추이·카드 계산·검색 매칭 검증 (npm run test:player, 넷 다: npm test)
├── public/search-index.json ← 빌드 전 생성되는 검색 색인 (id·이름·최근 팀·첫/마지막 시즌·photoUrl·팀 색, 약 290KB / gzip 약 41KB). git 제외
├── data/
│   ├── codes/           ← 시즌·팀·경기구분 코드표 (API에서 받아 저장) + team-colors.json(팀 색, 손으로 관리하는 유일한 예외)
│   ├── raw/{seasonCode}/traditional.json, advanced.json, ...
│   └── processed/seasons.json, players-index.json(전 시즌 선수 색인: 번호·이름·photoUrl·시즌별 팀·경기), {seasonCode}/players.json(coverage·teams(logoUrl·color)·players)
├── lib/
│   ├── metrics.ts       ← 파생 지표 계산 (순수 함수만: 백분위, 경기당·40분당 환산, 커버리지 판정, 레이더 축 세트 modern/classic, 유형 라벨, 표본 프리셋 QUALIFY_PRESETS — 카드·순위표 공용, 플레이어 카드 스탯 9개 CARD_STATS·시즌 순위 cardStats(동점 1,2,2,4 / 턴오버 오름차순 / 성공률 시도 기준 attemptThresholds = 경기당 시도 리그 평균, 순위표 공용)·메달 단계 rankTier, 등급 percentileGrade(S~F)·종합 overallPercentile·기본 선수 pickDefaultPlayer, 카드 한 장 계산 buildCardContext·buildCardEntry(카드 화면·선수 페이지 공용), 통산 careerSummary(합계 ÷ 합계 경기))
│   ├── career.ts        ← 선수 페이지 규칙 (순수 함수: 시즌 짧은 표기 seasonShortLabel, 활동 기간, 소속 팀 구간 teamStints, 추이 지표 TREND_METRICS·trendRows(빈 시즌 null))
│   ├── search.ts        ← 선수 검색 (순수 함수: normalizeName(공백 무시)·matchScore·searchPlayers(최대 10명, 최근 선수 먼저)·buildSearchIndex)
│   ├── leaders.ts       ← 순위표 규칙 (순수 함수: 부문 정의(better high/low), 필터·정렬·순위(성공률 시도 기준), 열 순서, 성공/시도·숫자 표기, 주소 쿼리)
│   ├── teams.ts         ← 팀 한글 약칭 teamShortNameKo (연고지 지명 목록 HOME_CITIES — 하드코딩 예외, 이유 주석)
│   ├── data.ts          ← 빌드 시점에 data/processed 읽기 (서버 전용, loadPlayersIndex·toCardPlayers·toCardTeams·toLeaderPlayers·loadPlayerCareer(선수 전 시즌 행)·loadPlayerCard(최근 시즌 카드를 서버에서 계산))
│   ├── images.ts        ← 공식 이미지 스위치 officialImagesEnabled() (NEXT_PUBLIC_OFFICIAL_IMAGES=off 면 끔) + 대체 디자인 글자 규칙(teamMark) + 표용 팀 약칭(teamShortLabel: 9글자 넘으면 머리글자) + 색 섞기 mixHex(카드 그라데이션)
│   └── types.ts         ← Player, SeasonData(coverage·teams), Team(shortNameKo·logoUrl·color), TeamColor, PlayerIndexEntry(photoUrl), CardPlayer, CardTeam, LeaderPlayer(순위표용 최소 필드), CareerSeason·PlayerCareer(선수 페이지), SearchEntry(검색 색인) 등 타입 정의
├── app/                 ← Next.js 화면 (App Router)
│   ├── layout.tsx, globals.css (색 토큰: 라이트/다크)
│   ├── page.tsx         ← 최신 시즌 플레이어 카드 (정적)
│   ├── season/[seasonCode]/page.tsx  ← 시즌별 플레이어 카드 정적 페이지
│   ├── season/[seasonCode]/leaders/page.tsx  ← 시즌 순위표 정적 페이지 (1~3위 표지 카드 + 정렬 표)
│   ├── player/[playerNo]/page.tsx  ← 선수 페이지 정적 1,329개 (히어로·최근 시즌 카드·추이 그래프·시즌별 기록표)
│   ├── not-found.tsx
│   └── components/      ← SiteNav(상단: 사이트 이름·검색창·시즌 선택·화면 메뉴, 모든 화면 공통), PlayerSearch(첫 포커스 때 /search-index.json 한 번 fetch — 우리 정적 파일),
│                           PlayerHero·PlayerCardPanel·CareerTrend(Recharts LineChart)·CareerTable(선수 페이지), Segmented, useCardSave(카드 PNG 저장), useMedia, SeasonView, CardExplorer(선수 선택·비교·이미지 저장),
│                           PlayerCard(게임식 플레이어 카드: 팀 색 상단+큰 사진 / 스탯 9개+시즌 순위 / 작은 레이더),
│                           LeadersView(순위표), PlayerPicker, SourceFooter, useThemeColors,
│                           PlayerAvatar(circle·portrait)·TeamLogo(공식 이미지+대체 디자인, official={false}면 대체만), useOfficialImage(저장 filter excludeOfficialImages)
└── .github/workflows/fetch.yml, backfill.yml  ← 매일 새벽 수집 / 전체 재수집
```

## 코딩 규칙
- 파일·변수 이름은 영어, 주석과 커밋 메시지는 한국어
- KBL API 필드명(`kname`, `fgRt` 등)은 `lib/types.ts`에서 우리 이름(`nameKo`, `fgPct`)으로 한 번만 변환. 화면에는 KBL 원본 필드명이 나오지 않게
- 수집 스크립트는 실패 시 해당 시즌만 건너뛰고 나머지는 계속. 마지막에 실패 목록을 출력
- 화면은 모바일 우선 (팬은 대부분 폰으로 본다)
- 새 화면·차트를 만들기 전에 `SCOPE.md`의 IN 목록에 있는지 확인. 없으면 만들지 말고 사용자에게 묻는다
- 새 지표를 추가할 때 계산식·출처 주석 필수

## 하지 말 것 (안티패턴)
- 화면 컴포넌트에서 fetch로 KBL 서버 호출 (CORS로 실패하고, 원칙 1 위반)
- raw 파일을 직접 수정하거나 가공 결과로 덮어쓰기
- 시즌 코드·팀 코드를 코드에 하드코딩 (코드표 파일에서 읽는다)
- "이왕 만드는 김에" 회원가입·댓글·실시간 기능 추가 (SCOPE.md OUT 항목)
- 차트 라이브러리 추가 설치
- 요청 간격 없이 반복 호출

## 세션 로그
- 2026-09-30 (③ 선수 페이지·검색): `/player/[선수번호]` 1,329개 정적 생성 + SiteNav 검색창. 구성: 팀 색 히어로(사진·로고·국내/외국인·활동 기간·통산 경기/경기당 득점·리바·어시 = 합계 ÷ 합계 경기·소속 이력) → 최근 시즌 플레이어 카드(서버에서 buildCardEntry 로 계산해 결과만 전달, 기본 표본 기준이라 /season 카드와 같은 순위·등급, 저장 동작) → 추이 선 그래프(득점·리바·어시·야투%·TS%·PER, 점 색 = 그 시즌 팀, 이적 시즌은 큰 점, 뛰지 않은 시즌은 선이 끊김, 1시즌이면 안내문) → 시즌별 기록표(경기당/합계, 시즌 → `/season/코드?p=`). 검색 색인은 prebuild 에서 `public/search-index.json` 생성(git 제외). 순위표·카드 이름·PlayerPicker "기록 ›"에 선수 페이지 링크. 빌드 약 33초(정적 1,393쪽), 선수 페이지 HTML 50~115KB(gzip 약 14KB). 검증: typecheck·test·build, Playwright 390/1280 가로 스크롤 0, 검색→이동, 카드 PNG 저장.
- 2026-09-30 (피드백 반영): ① 순위표 — 출전시간을 경기 오른쪽으로, 3점 성공·USG%·PIE 삭제, 턴오버·3점%·자유투% 추가, 성공률 칸 아래 시즌 합계 성공/시도. 턴오버 부문은 적은 순(카드·순위·기본 정렬). ② 성공률 시도 기준을 "표본 충족 선수의 경기당 시도 리그 평균 이상"으로(`lib/metrics.ts attemptThresholds`, 카드·순위표 공용, 2025-26: 야투 5.8·3점 2.4·자유투 1.3). ③ 팀 한글 약칭 `teams[].shortNameKo`(`lib/teams.ts`, 연고지 지명 제거) → 화면 전부 한글. ④ 플레이어 카드: PC(≥768px) 500px 확대, 팀 필터(`?team=`), 레이더 크게 + 꼭짓점 등급 S~F(`percentileGrade`: 90/75/55/35/15), 헤더 종합 등급(5축 평균). **발견·수정: KBL `fg/fgA/fgRt`는 2점슛, `fdg/fdgA/fdgRt`가 전체 야투였다**(fdg = fg + threep, 득점 = 2·fg + 3·3점 + 자유투, 3개 시즌 전원 일치) → process.ts 매핑을 바로잡아 야투율이 전 시즌 바뀜(예: 워니 49.9 → 44.2%).
- 2026-09-30 (플레이어 카드): 사용자 피드백("사진·로고가 너무 작다, 게임 카드처럼")으로 레이더 카드를 플레이어 카드로 개편. 상단 팀 색 그라데이션+큰 세로 사진(208px)+로고 칩, 중단 경기당 스탯 9개(득점·리바·어시·스틸·블록·턴오버·야투·3점·자유투) 3×3 + 시즌 순위(1~3위 SVG 메달, 4~10위 팀 색 강조), 하단 작은 백분위 레이더+표. 순위 규칙은 lib/metrics.ts(동점 같은 순위, 턴오버 오름차순, 표본 미달 → "표본 미달"). 결정: 성공률은 표본 기준만으로는 1/1=100%가 1위가 되어 **경기당 시도 기준(야투 4·3점 1.5·자유투 1회)** 추가 → 미달은 "시도 부족"(KBL 공식 규정 아님, 우리 규칙). 이미지 저장은 화면 밖에 공식 이미지 없는 사본(exportMode)을 그려 PNG로 + filter 로 `<img data-official-image>` 제외 — Playwright로 PNG 생성 확인(한 장 808×1524, 비교 두 장 1592×1524 @2x). 카드 비율은 레이더를 남기느라 약 1:2(358×752)로 목표(2:3)보다 길다. 비교는 카드 두 장 나란히(겹친 레이더 제거). 메뉴 이름 "플레이어 카드".
- 2026-09-30 (순위표): PLAN.md ② 완료. `/season/[코드]/leaders` 30개 시즌 정적 생성 — 부문 칩 → 1~3위 팀 색 표지 카드(1위 크게) → 정렬 표(순위·선수 열 고정, 표만 가로 스크롤, 390px에서 페이지 가로 스크롤 없음 확인). 경기당/합계·전체/국내/외국인·팀·표본 기준, 상태는 주소 쿼리. 상단 `SiteNav`로 시즌 선택을 옮겨 레이더·순위표·홈 공통. USG%·PIE는 coverage.advanced 시즌만. 표본 프리셋을 metrics.ts로 옮겨 두 화면 공유. 기본 부문 경기당 득점. 발견: 현 시즌 약칭도 "HYUNDAI MOBIS"·"JUNG KWAN JANG"이라 표에선 HM·JKJ로 보임 → 한글 약칭이 필요하면 process.ts에서 teamName1 기반 약칭을 따로 만들지 검토.
- 2026-09-30 (①-b 이미지): PLAN.md §5-5 완료. `scripts/image-urls.ts`가 사진·로고 주소 생성 → 시즌 파일 `teams[]`에 `logoUrl`·`color`, `players-index.json`에 `photoUrl`(색인 약 536KB). 팀 색은 `data/codes/team-colors.json`(현재 10개 구단 근사값, 보조색 포함 사용자 확인 필요, 나머지 회색). 공통 컴포넌트 PlayerAvatar·TeamLogo(대체 디자인 기본, onError·하이드레이션 전 실패도 대체), 스위치 `NEXT_PUBLIC_OFFICIAL_IMAGES=off`(빌드 시 반영, off 빌드에서 <img>·사진 출처 줄 0개 확인). PlayerPicker 목록과 카드 위 선수 줄에만 적용 — 저장 카드(html-to-image) 안에는 CORS 때문에 넣지 않음. 발견: 정관장(70)의 현재 logoName은 `kgc`(ic-kgc.svg)라 jkj 예외는 현재 데이터에 안 쓰임. teamCode 10은 1997 부산 기아도 같은 코드라 현대모비스 색이 옛 시즌에도 칠해짐.
- 2026-09-30 (이미지 조사): 세션 환경은 kbl.or.kr 차단이라 조사용 워크플로(`claude/probe-images` 브랜치, 푸시로 실행)를 만들어 Actions 러너에서 확인. 선수 사진·현재/옛 팀 로고 주소 형식 확정, raw teams.json 의 teamLogoName 47개가 공홈 CSS 규칙과 전부 일치. 방향: 매거진형 팬페이지, 핫링크+대체 디자인+끄기 스위치. PLAN.md §5 추가. GitHub 앱 권한상 workflow_dispatch 는 403 → 푸시 트리거만 가능.
- 2026-09-30 (3차): PLAN.md ① 데이터 기반 정비 완료. 시즌 파일에 `coverage`(advanced·plusMinus·goodDef·hustle, 선수 50% 이상 0 아님 기준)·`teams` 추가, `players-index.json`(1,329명, 약 440KB) 생성. 레이더 축 세트 2벌 — coverage.advanced면 modern(USG%·TS%·AST%·REB%·PIE), 아니면 classic(40분당 득점·TS%·40분당 AST·40분당 REB·PER) + "고전 축" 배지. 결과: advanced는 2025-26만 true(2023-24·2024-25는 11%라 false), +/-는 1997-98부터, 굿디펜스는 2000-01부터, hustle은 2025-26만. 발견: raw teams.json은 JSON 문자열이 한 번 더 감싸져 저장됨(process.ts에서 두 번 파싱), teamName4(약칭)는 옛 시즌·일부 팀이 영문 대문자(예: "DAEWOO SECURITIES", "HYUNDAI MOBIS").
- 2026-09-30 (설계): 대시보드 화면 구성 확정 → PLAN.md 작성. 화면 5개(레이더·순위표·선수 페이지+검색·팀 분포·홈), 작업 순서 ①~⑤. 발견: 2차 스탯(USG%·PIE·AST%·REB% 등)은 2025-26만 존재, 이전 29개 시즌은 0 → 옛 시즌 레이더가 잘못된 그림(전원 50점). ①에서 커버리지 플래그 + 전 시즌 공통 축(40분당 환산)으로 고치기로. SCOPE.md 보류 목록 4건 추가.
- 2026-09-30 (배포): Vercel 프로젝트 kbl-stats 생성·배포 완료. 공개 주소 **https://kbl-stats-mu.vercel.app** (kbl-stats.vercel.app은 타인 소유). main 푸시 시 자동 재배포 → 매일 새벽 데이터 커밋도 자동 반영. 개발 작업은 Opus 5.5 에이전트에 위임하는 방식으로 진행(사용자 요청).
- 2026-09-30 (2차): 첫 화면 "선수 유형 레이더 카드" 구현 — Next.js 15 + Tailwind v4 + Recharts 3, 30개 시즌 정적 생성(선수 0명 시즌 제외), next build 성공. 결정: 백분위는 mid-rank, 비교 집단 기본 10경기·100분 이상(프리셋 4개), 유형 라벨은 최고 백분위 축 기준 단순 규칙(전 축 60↑ 올라운더, 최고 40↓ 롤 플레이어), 이미지 저장은 html-to-image. tsconfig를 화면용/스크립트용으로 분리. 발견: KBL USG%·PIE 값 척도가 NBA와 다름(USG 중앙값 ~3.5) → 원값 그대로 표기하고 주석 안내. 출전 적은 선수는 advanced가 0으로 들어와 백분위 0으로 보임(표본 부족 배지로 구분).
- 2026-09-30: 전체 시즌 백필 완료 — 1997~2025-26 정규시즌 30개 시즌, 선수 102~202명/시즌, 실패 0, data/ 16MB. 1997 시즌부터 advanced(2차 스탯) 존재 확인. 2026-27은 개막 전이라 0명 → 화면에서는 선수 0명인 시즌을 숨겨야 함. backfill.yml 추가(버튼 또는 파일 수정 푸시로 전체 재수집). 크롬 미연결 상황 대응으로 push 트리거 채택.
- 2026-09-29 (2차): 수집 스크립트·워크플로 완성. Actions 실행 #2 성공 — 2025-26 정규시즌 193명 raw+processed 저장(676KB). 발견: listCn≤255, recent-seasons는 현재 시즌 1개만 반환(백업 상수와 병합), 출전 1~5경기 선수 5명은 advanced 없음(정상). 세션 환경(Claude 클라우드)은 KBL 서버 차단 → 수집 검증은 Actions 수동 실행으로.
- 2026-09-29: 프로젝트 정의. KBL 공홈 데이터 서버 2곳 확인(api-stats.kbl.or.kr / kbl-api.sports2i.com), 인증 없음·CORS 없음 확인. 이용약관 제23·28조 확인 → 비영리 단계 진행, 영리 전환 시 서면 승낙 필요. 스택 결정: TS + Next.js + Recharts + JSON 파일 + GitHub Actions + Vercel. 라인업·경기별 API는 미확인 상태로 보류.
