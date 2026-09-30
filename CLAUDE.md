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
- advanced 주요 필드: `perRt, offrtg, defrtg, netrtg, efgRt, tsRt, astRt, astTo, astRatio, orebRt, drebRt, rebRt, usgRt, pace, tovRt, toRatio, pie, poss`
- 주의: `sortDataSc`에 존재하지 않는 열 이름을 넣으면 500 에러 (예: advanced에 `PER` 넣으면 실패). 정렬은 우리 쪽에서 하고 API 정렬은 기본값(SCORE)만 쓴다.
- 주의: `listCn`은 **255 이하**만 허용 (서버가 tinyint로 변환, 300이면 500 에러). 200으로 두고 `totalCn`으로 페이지를 넘긴다.
- GitHub Actions 러너에서 이 서버 접속 가능 확인 (2026-09-29, 첫 실행에서 도달 성공)
- `playSec`은 초 단위. 분으로 바꿔서 보여준다.

### 서버 B: `https://kbl-api.sports2i.com` — 시즌리더(부문별 상위 5명), 공통 코드
- `GET /api/v1/season-leaders/persons?seasonCode=&gameCode=` / `.../teams?...` — 상위 5명만 → 참고용, 주 데이터원 아님
- `GET /api/v1/Common/recent-seasons?seriesCd=1`, `/api/v1/Common/kbl-season-game/{seasonCode}`, `/api/v1/Common/team?seasonCodeList=&gameCodeList=` — 시즌·경기구분·팀 코드표. **코드표는 하드코딩하지 말고 여기서 받아 저장한다.**
- 운영 주체가 KBL이 아닌 외부 기록업체(Sports2i)임.

### 코드 체계
- 시즌 코드: 1997=1, 1997-98=2, 1998-99=3 … 2007-08=12, 2008-09=13, 이후 홀수 증가 → 2024-25=45, 2025-26=47, 2026-27=49. (규칙이 중간에 바뀌므로 반드시 코드표에서 받는다)
- 경기 구분(gameCode): 정규시즌 `01`, 플레이오프 `03,04`, 챔피언결정전 `04`, 전체 `01,03,04`. 올스타·컵대회 등 별도 코드 존재
- 팀 코드 예: 55=서울 SK, 60=부산 KCC, 50=창원 LG, 16=원주 DB, 10=울산 현대모비스, 66=고양 소노 (전체 목록은 코드표 API에서)

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
├── scripts/
│   ├── fetch.ts         ← KBL API 호출 + data/raw 저장 (API 주소는 여기와 config에만)
│   ├── process.ts       ← raw → processed 변환
│   └── config.ts        ← 엔드포인트, 시즌 목록, 요청 간격
├── data/
│   ├── codes/           ← 시즌·팀·경기구분 코드표 (API에서 받아 저장)
│   ├── raw/{seasonCode}/traditional.json, advanced.json, ...
│   └── processed/{seasonCode}/players.json
├── lib/
│   ├── metrics.ts       ← 파생 지표 계산 (순수 함수만)
│   └── types.ts         ← Player, Season 등 타입 정의
├── app/                 ← Next.js 화면
│   ├── page.tsx
│   └── components/
└── .github/workflows/fetch.yml  ← 매일 새벽 수집
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
- 2026-09-30: 전체 시즌 백필 완료 — 1997~2025-26 정규시즌 30개 시즌, 선수 102~202명/시즌, 실패 0, data/ 16MB. 1997 시즌부터 advanced(2차 스탯) 존재 확인. 2026-27은 개막 전이라 0명 → 화면에서는 선수 0명인 시즌을 숨겨야 함. backfill.yml 추가(버튼 또는 파일 수정 푸시로 전체 재수집). 크롬 미연결 상황 대응으로 push 트리거 채택.
- 2026-09-29 (2차): 수집 스크립트·워크플로 완성. Actions 실행 #2 성공 — 2025-26 정규시즌 193명 raw+processed 저장(676KB). 발견: listCn≤255, recent-seasons는 현재 시즌 1개만 반환(백업 상수와 병합), 출전 1~5경기 선수 5명은 advanced 없음(정상). 세션 환경(Claude 클라우드)은 KBL 서버 차단 → 수집 검증은 Actions 수동 실행으로.
- 2026-09-29: 프로젝트 정의. KBL 공홈 데이터 서버 2곳 확인(api-stats.kbl.or.kr / kbl-api.sports2i.com), 인증 없음·CORS 없음 확인. 이용약관 제23·28조 확인 → 비영리 단계 진행, 영리 전환 시 서면 승낙 필요. 스택 결정: TS + Next.js + Recharts + JSON 파일 + GitHub Actions + Vercel. 라인업·경기별 API는 미확인 상태로 보류.
