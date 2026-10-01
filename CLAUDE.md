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
- ⚠️ **`usgRt`(USG%)는 Basketball-Reference 표준식의 정확히 1/5** (2026-09-30 Actions 러너 확인: 2025-26 500분 이상 선수 전원 표준식/KBL 비율 4.95~5.06 — "팀 출전시간/5" 항이 빠진 것으로 추정). processed `usgPct`는 **×5(표준 척도)**로 저장하고 원값은 `usgPctRaw`에 보존(`lib/metrics.ts usgFromKbl`). TS%·eFG%·AST%·TOV%·AST/TO는 표준식과 일치(예: 워니 TS 49.8 = 1158/(2×(1091+0.44×161))). PER은 계산식 미공개라 검산 불가
- **PIE는 쓰지 않는다**(2026-09-30 결정: 팬이 읽기 어렵고 2025-26에만 있음). processed `pie`는 원본 보존 차원에서 남기지만 화면용 타입(CardPlayer 등)·레이더 축·`coverage.advanced` 판정(USG%·AST%·REB% 셋)에서는 뺐다
- 주의: `sortDataSc`에 존재하지 않는 열 이름을 넣으면 500 에러 (예: advanced에 `PER` 넣으면 실패). 정렬은 우리 쪽에서 하고 API 정렬은 기본값(SCORE)만 쓴다.
- 주의: `listCn`은 **255 이하**만 허용 (서버가 tinyint로 변환, 300이면 500 에러). 200으로 두고 `totalCn`으로 페이지를 넘긴다.
- GitHub Actions 러너에서 이 서버 접속 가능 확인 (2026-09-29, 첫 실행에서 도달 성공)
- `playSec`은 초 단위. 분으로 바꿔서 보여준다.

### 서버 B: `https://kbl-api.sports2i.com` — 시즌리더(부문별 상위 5명), 공통 코드
- `GET /api/v1/season-leaders/persons?seasonCode=&gameCode=` / `.../teams?...` — 상위 5명만 → 참고용, 주 데이터원 아님
- `GET /api/v1/Common/recent-seasons?seriesCd=1`, `/api/v1/Common/kbl-season-game/{seasonCode}`, `/api/v1/Common/team?seasonCodeList=&gameCodeList=` — 시즌·경기구분·팀 코드표. **코드표는 하드코딩하지 말고 여기서 받아 저장한다.**
- **선수 마스터** `GET /api/v1/players?regSc=N&pageNo={n}&listCn=200` → `{ totalCn: "2061", playerList: [ { playerNo, kname, ename, teamCode, backNum, pos, pWeight, pHeight, playerFlagCode2, yearNo, monthNo, roundNo, rankNo, rowNo } ] }` (2026-09-30 확인). 은퇴 선수 포함 2,061명(`regSc=Y`면 현역 186명만). `listCn` ≤ 255. `Referer/Origin: https://kbl.or.kr`, `Accept: application/json` 헤더가 없으면 빈 응답. 단건 상세 API 없음(401/빈 응답)
  - `pos`: GD 가드, FD 포워드, C 센터, GF 가드-포워드, FC 포워드-센터 → 우리 `position` G/F/C/GF/FC, 비교 묶음 `positionGroup`은 첫 글자(GF→G, FC→F)
  - `playerFlagCode2`: "0" 국내, "1" 외국, "2" 아시아쿼터 → `nationality` domestic/foreign/asia. **마스터가 있으면 `isForeign = nationality !== "domestic"`**, 없으면 이름 추정(라건아 등 귀화 선수 오분류)
  - `yearNo/roundNo/rankNo` 드래프트(외국 선수 null), `pHeight` cm, `pWeight` kg, `backNum` 현재 등번호 — 마스터는 "지금" 한 장이라 시즌별 값이 아님
  - `npm run fetch`가 시즌 수집 전에 전 페이지를 받아 `data/raw/players/players.json`(페이지 응답 배열 그대로)에 저장. 실패해도 시즌 수집은 계속. 가공은 `scripts/player-master.ts`
- **한 경기 최다(커리어 하이·시즌 하이)** `GET /api/v1/players/categories/mostgame/{seasonCode}/{playerNo}` (2026-09-30 확인) → `{ MostGameRegularSeasons: [...](요청 시즌의 시즌 하이), MostGameRegularAllTimes: [...](통산), 플레이오프·챔프전 배열(이름 미확인 — "MostGame{구분}{Seasons|AllTimes}" 꼴을 넓게 분류) }`. 항목 `{ seasonCode, recordSc: "RECORD"|"RATE", recordTxt: "득점"|"필드골 성공"|…|"블록"(15개), record: "46.000", awayTeam: "70"(상대 팀 코드), gameDate: "20231021", scoreRankCn(달성 횟수), orderNo }`. "필드골" = 야투 전체(2점슛이 따로 있음). 한 요청이 시즌 하이 + 통산을 같이 준다 → **선수-시즌 조합당 1회**. 매핑은 `scripts/highs.ts`
- **프로필** `GET /api/v1/players/profile/0/{playerNo}` → `{ playerInfo: [{ birthday: "19940131", country: "미국", countryEng, univSch, pHeight, pos, backNum, … }], playerScore: [...] }`. 생년월일·국가·출신교만 쓴다(`scripts/player-master.ts profileExtraFrom`)
- **경기별 기록** `GET /api/v1/players/categories/game/{seasonCode}/01/{playerNo}` → `{ RegularGameRecords: [{ gameNo, gameDate: "20260406", awayTeam, playSec, pts, fg, fgA, fgRt(2점), threep, threepA, threepRt, fdg, fdgA, fdgRt(전체 야투), ft, ftA, ftRt, oR, dR, rb, aS, sT, bS, tO, foulTot }] }` — **수집함**(2026-09-30). mostgame 에는 성공 개수만 있어서, 같은 선수·시즌·날짜 경기를 찾아 3점·자유투(·야투) 성공 하이에 `attempts`·`pct`를 붙인다(`scripts/gamelogs.ts`, 그 경기 성공 개수가 기록 값과 같을 때만, 못 찾으면 null → 화면은 개수만). fg=2점·fdg=전체 야투는 서버 A와 같다고 보고 매핑(실제 응답으로 확인 필요)
- **수집 규칙 (한 경기 최다·경기별 기록·프로필)**: raw 는 `data/raw/highs/{seasonCode}/{playerNo}.json`, `data/raw/gamelogs/{seasonCode}/{playerNo}.json`, `data/raw/profiles/{playerNo}.json`(응답 그대로, 한 줄 JSON — 파일 수천 개라 들여쓰기 없이). 형식이 다른 응답은 저장하지 않는다
  - 매일(`npm run fetch`): **현재 시즌 선수만**(raw traditional 기준 ~200명 × mostgame 1 + 경기별 기록 1 + profile 1, 1.5초 간격 ≈ 15분). 코드표 최신 시즌이 0명(개막 전)이면 직전 시즌이 "현재". 개막 후에는 최신 시즌 첫 수집일(`data/season-first-seen.json`)부터 **30일 동안만** 직전 시즌도 같이(`PREVIOUS_SEASON_GRACE_DAYS`), 그 뒤 자동 제외. 마감 시즌은 다시 받지 않는다. `fetch:all`·`--no-highs`는 건너뜀
  - 경기별 기록 과거분: `.github/workflows/backfill-gamelogs.yml` 한 번 — **정규시즌 커리어 하이의 득점·3점 성공·자유투 성공이 나온 (선수, 시즌)만**(`gamelogTargets`, 선수당 최대 3개, 2026-09-30 색인 기준 1,918회 ≈ 1시간). `# 실행 횟수: 0` → 1로 올려 푸시하면 실행, 이어받기·시즌 단위 커밋. 과거 시즌의 시즌 하이 시도 수는 범위 밖(현재 시즌만 매일)
  - 과거 전체: `.github/workflows/backfill-highs.yml` 한 번(선수-시즌 약 4,980회 + 프로필 약 1,330회 ≈ 3시간, 이어받기·시즌 단위 커밋). 파일의 `# 실행 횟수: N`을 1 올려 푸시하면 실행(0이면 아무것도 안 함)
  - 연속 10회 실패면 그 시즌 중단(`MAX_CONSECUTIVE_FAILURES`)
- 운영 주체가 KBL이 아닌 외부 기록업체(Sports2i)임.

### 이미지 (2026-09-30 Actions 러너에서 공홈 HTML·JS·CSS 확인 — 상세는 PLAN.md §5)
- 선수 사진: `https://kbl.or.kr/files/kbl/players-photo/{playerNo}.png` (옛 선수도 있음, 없으면 200이지만 HTML 반환)
- 현재 팀 로고: `https://kbl.or.kr/assets/img/ico/logo/ic-{teamLogoName}.svg` (정관장만 `/assets/img/logo/logo-jkj.png`), 옛 팀 로고: `.../ico/logo/old/{teamLogoName}e.png`
- **사진 숨김**: KBL 이 코치가 된 선수 사진을 코치 사진으로 바꿔 둔 경우 `data/codes/photo-overrides.json`의 `hide`에 선수 번호(문자열)를 적는다 → 다음 가공(`npm run process`, 매일 Actions) 때 그 선수 `photoUrl: null`(대체 디자인). 사용자가 번호를 알려 주면 여기에 추가만 하면 된다
- 규칙: 레포에 복사하지 않고 핫링크. 주소는 `scripts/process.ts`가 processed JSON에 써 넣고 화면은 그 값만 쓴다(원칙 1). 로드 실패 시 팀 색+이니셜 대체, 환경변수로 전체 끄기 가능해야 함. 하단 출처에 "사진·로고 © KBL 및 각 구단".

### 코드 체계
- 시즌 코드: 1997=1, 1997-98=2, 1998-99=3 … 2007-08=12, 2008-09=13, 이후 홀수 증가 → 2024-25=45, 2025-26=47, 2026-27=49. (규칙이 중간에 바뀌므로 반드시 코드표에서 받는다)
- 경기 구분(gameCode): 정규시즌 `01`, 플레이오프 `03,04`, 챔피언결정전 `04`, 전체 `01,03,04`. 올스타·컵대회 등 별도 코드 존재
- 팀 코드 예: 55=서울 SK, 60=부산 KCC, 50=창원 LG, 16=원주 DB, 10=울산 현대모비스, 66=고양 소노 (전체 목록은 코드표 API에서)

### 시즌별 데이터 커버리지 (2026-09-30 processed 전수 확인 — 화면 설계의 기준)
- 1차 스탯, PER, TS%, eFG%, TOV%, AST ratio, AST/TO, ORtg: **30개 시즌 전부** 있음
- +/-: 1997-98부터. 굿디펜스(gd): 2000-01부터
- **USG%, PIE, AST%, REB%, OREB/DREB%, DEF/NET RTG, PACE, POSS: 2025-26(코드 47)만** (`coverage.advanced`는 USG%·AST%·REB%로 판정 — PIE 제외) 정상(선수 97%). 2023-24·2024-25는 24명 정도만, 그 이전은 전부 0 → 레이더 카드 4개 축이 옛 시즌에선 무의미. 시즌 파일에 `coverage` 플래그를 넣어 화면이 축·열을 켜고 끈다(PLAN.md ①)
- 스크린 어시스트·디플렉션: 2025-26만
- playerNo는 시즌이 바뀌어도 동일(803명이 2개 시즌 이상) → 선수 커리어 페이지 가능. 동명이인 32명 있으므로 이름이 아닌 playerNo로 식별
- teamCode는 팀명 변경에도 유지(안양 KT&G→KGC→정관장=70), 구단 매각 시엔 새 코드(안양 SBS=40 → KT&G=70)

### 서버 C: `https://api.kbl.or.kr` — 공홈 자체 API (경기 일정·경기 상세·슛 차트, 2026-09-30 Actions 러너 확인)
- 경기 목록 `GET /match/list?fromDate=YYYYMMDD&toDate=YYYYMMDD&tcodeList=all` → 배열 `{ gmkey: "S49G14N1"(시즌·경기구분·번호 키), seasonCode, gameCode("01" 정규, "14" OPEN MATCH DAY 등), gameNo, gameDate, tcodeH, tcodeA, scoreH, scoreA, isEnded, … }`. 연도 목록 `GET /match/year`
- 경기 상세 `GET /match/{gmkey}` → 심판·관중·쿼터 점수·detailUrl(`/game/record/{gmkey}`), 팀 합계 `GET /league/{gmkey}/vs/team-statsByGmKey?teamA=&teamB=`
- **슛 차트** `GET /match/{gmkey}/match-chart` → `{ shootLog: [ { pcode(선수번호), pname, tcode, logs: [ { q: "Q1"~"Q4", x, y, o: "O"(성공)|"X"(실패), d: "1"|"2" } ] } ] }` — x·y는 코트 그림 픽셀 좌표(관측 범위 x 0~700, y 0~400 근처), d는 공격 방향(코트 절반) 추정. **바스켓 위치·구역 경계는 실제 데이터로 검증 후 정한다**(3점 성공 좌표의 거리 분포로 역산). 경기당 1회 요청, 정규시즌 270경기/시즌
- **헤더 필수**: 공홈 스크립트가 붙이는 `channel: WEB`, `lang: ko`, `teamcode: XX`(+ `X-Requested-With: XMLHttpRequest`, Referer)가 없으면 400 "필수 헤더 정보가 누락되었습니다" (2026-09-30 Actions 브라우저 요청 캡처로 확인). `scripts/http.ts SITE_API_HEADERS` 가 서버 C 주소에만 붙인다
- **수집 규칙 (슛 차트, 2026-09-30 — 수집만, 가공·화면은 다음 단계)**: 주소는 `scripts/config.ts`(`SITE_API`·`matchListUrl`·`matchChartUrl`), 규칙은 `scripts/shots.ts`(순수), 루프는 `scripts/collect-shots.ts`
  - raw: 경기 목록 `data/raw/games/{seasonCode}/list.json`(월별 응답 배열을 이어 붙인 배열, 항목 원본 그대로), 슛 차트 `data/raw/shots/{seasonCode}/{gmkey}.json`(응답 그대로, 한 줄 JSON). 형식이 다른 응답(배열 아님·`shootLog` 없음·HTML)은 저장하지 않고 실패로 센다. 목록은 한 달이라도 실패하면 저장하지 않는다(전날 파일 유지)
  - 월 구간: 시즌 라벨(코드표 `seasonName1`, 없으면 백업 상수) "2025-2026" → 2025-09 ~ 2026-06 월별 10회, "1997" → 1~12월 12회
  - 대상: 목록에서 `seasonCode` 일치 + `gameCode === "01"` + gmkey 중복 제거 + 끝난 경기(`isEnded` 가 true·"Y"·"1", 필드가 없으면 경기 날짜 < 오늘) 중 raw 가 없는 gmkey
  - 매일(`npm run fetch`, `--no-shots`로 끔, `fetch:all`은 건너뜀): 한 경기 최다와 같은 대상 시즌(`highsTargetSeasons`). 목록은 오늘까지 달만 다시 받고(1~10회), 시즌 달 구간이 끝났고 목록이 전부 끝난 경기면 다시 받지 않는다. 슛 기록이 빈 차트는 저장하지 않는다(다음 날 다시 — 입력 지연 대비). 보통 하루 0~5회
  - 백필: `.github/workflows/backfill-shots.yml` — `# 실행 횟수: N`을 1 올려 푸시, `# 대상 시즌: 47 45`(비우면 선수 raw 가 있는 전체 시즌, 최신 먼저). 시즌당 목록 10회 + 정규시즌 약 270회, 1.5초 간격 ≈ 7분. 이어받기(raw 있는 경기 건너뜀, 전부 끝난 목록이 있으면 목록도 안 받음), 빈 차트도 저장(옛 시즌을 다시 두드리지 않게), 시즌 단위 커밋, 시간 예산 300분(제한 350분). `npm run backfill:shots -- --count`로 남은 요청 수
  - 연속 10회 실패면 그 시즌 중단(`MAX_CONSECUTIVE_FAILURES`). `npm run process`는 `data/raw/games`·`shots`를 시즌 폴더로 보지 않는다(숫자 폴더만 시즌) — 슛 차트는 시즌마다 따로 읽는다(아래)
- **좌표 체계 (2026-09-30, 2025-26 270경기 raw 로 검증)**: 코트 그림 700×400 픽셀 근사, **1m ≈ 24.9px**. `d="1"` = 공격 바스켓 오른쪽 (668, 205), `d="2"` = 왼쪽 (34, 205). 관측 x 38~692, y 26~385 (반대쪽 바스켓 쪽 점 약 0.4% — 먼 거리 슛). `q` 는 "Q1"~"Q4", 연장 "EQ1"·"EQ2". `pcode` = playerNo
  - 검증: 선수·경기별 점 개수 = 공식 야투 시도(fdgA) 98% 일치, `o=="O"` 개수 = 야투 성공 99.7% 일치. 시즌 합계 점 35,866 vs 공식 FGA 35,975(47), 36,790 vs 36,782(45)
  - 3점 판정(FIBA 규격을 픽셀로): dx=|x−bx|, dy=|y−by|, `dy ≥ 162`(코너 직선) 또는 `(dx/168)² + (dy/166)² ≥ 1`. 좌표로 센 3점 시도는 공식보다 약 1.7~2.4% 많다(라인 근처 2점을 3점으로) → 화면 도움말에 "공식 3점 기록과 조금 다를 수 있다"
  - **커버리지 (2026-09-30 전체 백필)**: 슛 차트는 **2006-07(코드 11)부터** 존재 — 11~47 시즌 전부 270경기(2019-20은 213, 코로나 조기 종료), 빈 차트 0~4경기/시즌, 좌표 체계 전 시즌 동일(x≈30~700, y≈25~385; (0,0) 오류 점 시즌당 0~2개). **2005-06 이전(코드 1~10)은 슛 차트 없음** — 목록에 정규시즌 경기·점수는 있지만 `isEnded` 가 전부 0 이라 처음엔 건너뛰었고, `isEndedGame` 이 점수+지난 날짜도 끝난 것으로 보게 고쳐 재시도(실행 횟수 4)한 결과 2,334경기 전부 `shootLog` 빈 배열(빈 파일로 저장돼 다시 두드리지 않음). 이 시즌들은 `coverage.shots false`·`shotZones null`·shots.json 없음. raw 전체 약 65MB
  - 가공(`npm run process`): 목록의 정규시즌 gmkey(`regularGamesOf`, 목록이 없으면 `S{시즌}G01N…` 모양) 차트만 → 선수별 `players[].shotZones`(구역 5개 a·m + `offenseType`), 시즌 `shotZoneLeague`(리그 합계)·`coverage.shots`(선수 50% 이상), 점 좌표 `data/processed/{시즌}/shots.json`(한 줄 = 선수, `[x, y, made]` 미터 소수 2자리, 시즌당 약 510KB, 커밋 대상). 규칙은 `lib/shots.ts`(정규화·구역·유형)

### 서버 A 추가 확인 (2026-09-30)
- 팀 기록 `GET /api/records/team/general/traditional?seasonCode=&gameCode=01&sortDataSc=WIN_A&sortOrderSc=desc&perCn=0&lastCn=0&partIfList=0&draftNo=0` (화면 열: G W L MIN 승률 PTS 2PM… +/- SAST DFL DD2 TD3). advanced 등 다른 탭 주소는 같은 패턴 추정
- 라인업 기록 `GET /api/records/lineup/traditional?seasonCode=&gameCode=01&sortDataSc=PLAY_SEC&sortOrderSc=desc&listCn=10&pageNo=1&perCn=0&lastCn=0&partIfList=0&draftNo=0` (5인 조합별 G MIN PTS … +/-). listCn ≤ 255 규칙 동일 추정
- 아직 수집하지 않음 — SCOPE.md OUT(라인업·팀 기록)이 바뀌면 원칙 2에 따라 raw부터

### 아직 확인 안 된 것 (다음 세션에서 확인)
- 경기별 박스스코어(팀·선수 전체) — 서버 C `/match/{gmkey}` 하위에 있을 것으로 추정, 미확인. 선수별 경기 기록은 서버 B players/categories/game 으로 대체
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
- 한 경기 최다 raw 는 파일 약 4,980개(+ 프로필 약 1,330개). 한 파일 크기는 응답을 받아 봐야 알지만 5~15KB로 보면 25~75MB — 백필 뒤 `du -sh data/raw/highs`로 재평가
- JSON 파일 저장 → 시즌 30개 × 여러 엔드포인트가 쌓이면 레포가 커진다. 수십 MB 수준까지는 문제없음. 100MB 넘어가거나 검색·필터가 느려지면 DB로 이전 (갚을 시점: 라인업 데이터 전 시즌 수집 시 재평가)
- 정규시즌만 우선 → 플레이오프·컵대회는 gameCode만 바꾸면 되지만 화면 설계가 복잡해지므로 1차 범위에서 제외
- 라인업·경기별 데이터는 API 주소 확인 전까지 보류 → 확인되면 원칙 2에 따라 raw부터 저장
- 2차 스탯은 KBL이 계산한 값을 그대로 씀 (직접 재계산하지 않음) → 계산식이 NBA 표준과 다를 수 있으나 "공식 수치"라는 신뢰가 더 중요. WS·BPM 등 KBL이 안 주는 지표를 직접 만들 때만 `lib/metrics.ts`에 계산식과 출처를 주석으로 남긴다

## 폴더 구조
```
kbl-stats/
├── CLAUDE.md            ← 이 파일
├── SCOPE.md             ← 범위 정의 (IN / OUT / 추가 기준)
├── PLAN.md              ← 화면 구성 설계와 작업 순서 (①데이터 정비 → ②순위표 → ③선수 페이지 → ④팀 분포 → ⑤홈 → §6 2차 개편: 탭 재구성·선수 탭·비교·용어)
├── tsconfig.json        ← 화면(app + lib) 타입 설정 — next build가 사용
├── tsconfig.scripts.json← 수집 스크립트·테스트 타입 설정 (tsx 실행분)
├── next.config.mjs, postcss.config.mjs  ← Next.js / Tailwind v4 설정
├── .env.example         ← NEXT_PUBLIC_OFFICIAL_IMAGES (공식 사진·로고 끄기 스위치) 설명
├── scripts/
│   ├── fetch.ts         ← KBL API 호출 + data/raw 저장 (API 주소는 여기와 config에만) + 현재 시즌 선수 한 경기 최다·경기별 기록·프로필
│   ├── http.ts          ← getJson(공홈 헤더)·sleep·saveRaw 공용 (fetch·backfill-highs)
│   ├── gamelogs.ts      ← 경기별 기록 raw → 슛 시도 수(parseGameLog·shotAttemptsFor 같은 날짜+성공 개수 일치·attachShotAttempts) + 백필 대상 gamelogTargets(커리어 하이 득점·3점·자유투 시즌) — 순수 함수
│   ├── shots.ts         ← 슛 차트(서버 C) 규칙 — 시즌 라벨 → 월 구간 seasonMonthRanges, 경기 목록 → 끝난 정규시즌 gmkey(endedRegularGmkeys·isListFinal), 슛 차트 형식 isShotChartResponse·shotChartHasLogs, 이어받기 pendingGames — 순수 함수
│   ├── collect-shots.ts ← 시즌 하나의 경기 목록(월별) + 슛 차트 수집 루프 (daily/backfill 모드, 연속 실패 중단)
│   ├── backfill-shots.ts ← 슛 차트 백필 (--count / --list-seasons / --season N) — backfill-shots.yml 이 부름
│   ├── backfill-gamelogs.ts ← 경기별 기록 백필 (--count / --list-seasons / --season N, 이어받기) — backfill-gamelogs.yml 이 부름
│   ├── highs.ts         ← 한 경기 최다 raw → 우리 키(parseMostGame, recordTxt 15개 매핑) + 매일 수집 대상 시즌 highsTargetSeasons(직전 시즌 30일)·첫 수집일·백필 이어받기 pendingPlayers — 순수 함수
│   ├── collect-extras.ts ← 선수별 mostgame·경기별 기록·profile 수집 루프 (저장 전 형식 검사, 연속 실패 중단)
│   ├── backfill-highs.ts ← 과거 전체 백필 (--list-seasons / --season N, 이미 raw 있는 조합 건너뜀) — backfill-highs.yml 이 시즌마다 부름
│   ├── process.ts       ← raw → processed 변환 (photoUrl·logoUrl·팀 color 추가, 한 경기 최다 seasonHighs·seasonHighLeaders·careerHighs, 프로필 birthday·country·school)
│   ├── image-urls.ts    ← KBL 사진·로고 주소 생성 (playerPhotoUrl, teamLogoUrl) — KBL 이미지 주소는 여기에만
│   ├── config.ts        ← 엔드포인트(선수 마스터 PLAYER_MASTER_PATH 포함), 시즌 목록, 요청 간격
│   ├── player-master.ts ← 선수 마스터 raw → 프로필(position·positionGroup·nationality·heightCm·weightKg·backNumber·draft) 순수 함수, isForeignPlayer, 프로필 API raw → birthday·country·school(profileExtraFrom)
│   ├── build-shots.ts   ← 선수별 슛 차트 파일 public/shots/{seasonCode}/{playerNo}.json 생성 (prebuild·predev, lib/shots PlayerShotsFile: 점·구역·리그 합계, git 제외)
│   ├── build-search-index.ts ← 검색용 경량 색인 public/search-index.json 생성 (npm prebuild·predev 로 자동 실행, 생성물은 .gitignore)
│   └── build-cards.ts   ← 비교 탭용 시즌별 카드 데이터 public/cards/{seasonCode}.json 생성 (prebuild·predev, 형식은 lib/cards.ts v2 — 레이더 구성 요소 열 포함, 시즌당 약 28~55KB, git 제외)
├── tests/
│   ├── metrics.test.ts  ← lib/metrics.ts 검증 (npm run test:metrics)
│   ├── leaders.test.ts  ← lib/leaders.ts 검증 (npm run test:leaders)
│   ├── card.test.ts     ← 플레이어 카드 스탯·순위 검증 (npm run test:card)
│   ├── player.test.ts   ← 통산 계산·추이·카드 계산·검색 매칭 검증 (npm run test:player)
│   ├── teams.test.ts    ← 팀 색 배정·핵심 의존도·산점도 쿼리·홈 시즌 고르기 검증 (npm run test:teams)
│   ├── roster.test.ts   ← 선수 마스터 매핑·포지션/국적 필터·용어집·카드 파일 인코딩 검증 (npm run test:roster)
│   ├── cardview.test.ts ← 카드 순위 범위(전체/같은 포지션)·선수 그리드 정렬/필터·비교표·선수/선수 탭/비교 탭 주소·용어 앵커 검증 (npm run test:cardview)
│   ├── badges.test.ts   ← 칭호 배지 조건·우선순위 (npm run test:badges)
│   ├── shots-zones.test.ts ← lib/shots 정규화(양쪽 d 대칭)·3점 판정·구역 경계·집계·공격 유형·표본 미달·코트 그림 (npm run test:shotzones)
│   ├── shots.test.ts    ← 슛 차트 월 구간·경기 목록 거르기·끝남 판정·형식 검사·이어받기 (npm run test:shots)
│   ├── gamelogs.test.ts ← 경기별 기록 파싱·날짜 매칭·시도 수 붙이기·백필 대상 선정 (npm run test:gamelogs)
│   └── highs.test.ts    ← 한 경기 최다 응답 파싱·프로필·매일 수집 대상 시즌(30일 경계)·백필 이어받기·시즌 하이 1위(동률·RATE 제외)·만 나이·커리어 하이 행 (npm run test:highs, 전부: npm test)
├── public/search-index.json ← 빌드 전 생성되는 검색 색인 (id·이름·최근 팀·첫/마지막 시즌·뛴 시즌 코드 seasons·photoUrl·팀 색·positionGroup·positionLabel, 약 370KB). git 제외
├── public/shots/{seasonCode}/{playerNo}.json ← 빌드 전 생성되는 선수·시즌 슛 파일 (선수 상세 시즌 전환 때 받음, 최대 약 16KB). git 제외
├── public/cards/{seasonCode}.json ← 빌드 전 생성되는 시즌 카드 데이터 (선수 탭·선수 상세 시즌 전환·비교 탭이 브라우저에서 받음, lib/cards.ts SeasonCardsFile). git 제외
├── data/
│   ├── codes/           ← 시즌·팀·경기구분 코드표 (API에서 받아 저장) + 손으로 관리하는 예외 둘: team-colors.json(팀 색), photo-overrides.json(사진 숨길 선수 번호 hide)
│   ├── raw/{seasonCode}/traditional.json, advanced.json, ... + raw/players/players.json(선수 마스터, 페이지 응답 배열)
│   │    + raw/highs/{seasonCode}/{playerNo}.json(한 경기 최다) + raw/gamelogs/{seasonCode}/{playerNo}.json(경기별 기록) + raw/profiles/{playerNo}.json(프로필)
│   │    + raw/games/{seasonCode}/list.json(서버 C 경기 목록) + raw/shots/{seasonCode}/{gmkey}.json(슛 차트)
│   ├── season-first-seen.json ← 시즌별 선수가 처음 수집된 날 (fetch.ts 가 기록, 직전 시즌 30일 판정용 상태 파일)
│   └── processed/{seasonCode}/shots.json(선수별 슛 좌표, 슛 차트 raw 가 있는 시즌만) + seasons.json, players-index.json(전 시즌 선수 색인: 번호·이름·photoUrl·프로필·birthday·country·school·careerHighs·시즌별 팀·경기), {seasonCode}/players.json(coverage·teams(logoUrl·color)·players(seasonHighs)·seasonHighLeaders)
├── lib/
│   ├── metrics.ts       ← 파생 지표 계산 (순수 함수만: 백분위(반전 percentileRankLow 포함), 경기당·40분당 환산, 커버리지 판정, **레이더 6축 공격·수비·리바운드·슈팅·리딩·효율**(RADAR_AXIS_COMPONENTS — 누적 기록은 경기당, 구성 요소 백분위 평균 → 집단 안 다시 백분위, 구성 요소 단위 커버리지(USG/REB/AST% advanced·굿디펜스·디플렉션·미드레인지 shots)·성공률 시도 기준 3점·미드레인지), **등급은 국적 집단(국내/외국/아시아쿼터, 아시아쿼터 8명 미만이면 외국과 합산) 안** buildGradingContext·radarScore, USG% ×5 usgFromKbl, 유형 라벨 playerType(가장 높은 축 + 포지션 세분: 플레이메이킹 빅맨·스트레치 빅맨·락다운 디펜더·리바운딩 가드), 표본 프리셋 QUALIFY_PRESETS — 카드·순위표 공용, 플레이어 카드 스탯 10개 CARD_STATS(파울은 ranked:false)·시즌 순위 cardStats(동점 1,2,2,4 / 턴오버 오름차순 / 성공률 시도 기준 attemptThresholds = 경기당 시도 리그 평균, 순위표 공용)·메달 단계 rankTier, 등급 percentileGrade(S~F, 축 컷 90/75/55/35/15)·종합 등급 overallGrade(OVERALL_GRADE_CUTS 85/70/55/40/25, **포지션별 축 가중치 axisWeights·ROLE_AXIS_WEIGHTS(roleGroupOf: 가드 G·GF 리딩 ×1.5·리바운드 ×0.5 / 포워드 F 전부 1 / 빅맨 FC·C 리바운드 ×1.5·슈팅·리딩 ×0.5) — 종합·유형 라벨에만, 레이더 축 값은 그대로**, 안내 overallWeightNote)·기본 선수 pickDefaultPlayer(PER), 카드 한 장 계산 buildCardContext(순위 집단 + 등급 재료)·buildCardEntry, 통산 careerSummary(합계 ÷ 합계 경기))
│   ├── career.ts        ← 선수 페이지 규칙 (순수 함수: 시즌 짧은 표기 seasonShortLabel, 활동 기간, 소속 팀 구간 teamStints, 추이 지표 TREND_METRICS·trendRows(빈 시즌 null), 프로필 한 줄 profileFacts, 만 나이 ageOn·personalFacts(나이·국적·출신교), 커리어 하이 표 careerHighRows·careerHighTabs, 업적 카드 careerHighAchievements·isSeasonBest)
│   ├── shots.ts         ← 슛 차트 규칙 (순수: 픽셀→미터 normalizeShot(d=1 은 180° 돌림), 3점 판정 isThreePx, 구역 5개 SHOT_ZONES·shotZone(골밑 1.5m·페인트 5.8×4.9m·미드·코너 3점 베이스라인 3m·아크 3점), zoneSummary·zonePct·shareOf·cornerShareOfThrees·leagueZoneAverages·zoneRows, 주 공격 유형 offenseType(문턱은 glossary OFFENSE_TYPES, 50개 미만 null, 3점 슈터 중 코너 ≥ 30% 는 cornerShooter), 저장 형식 ShotPoint·PlayerShotsFile·buildPlayerShotsFile, 코트 그림 courtGeometry·courtPoints) — scripts/shots.ts(수집)와 다른 파일
│   ├── highs.ts         ← 한 경기 최다 규칙 (부문 15개 HIGH_DEFS(record/rate), 1위 계산 부문 11개 SEASON_HIGH_LEADER_KEYS(성공률 제외), **화면 부문 7개 HERO_HIGH_KEYS**(득점·리바·어시·스틸·블록·3점·자유투 성공), 슛 부문 SHOT_HIGH_KEYS·성공/시도 표기 formatHighShot("5/8 · 62.5%"), 시즌 하이 1위 computeSeasonHighLeaders(동률 → 먼저 달성), 표기, 순위표 카드 buildSeasonHighCards, 부문 대응 LEADER_CATEGORY_HIGH)
│   ├── cardview.ts      ← 시즌 카드 데이터 → 화면 (순수 함수: 레이더 배치 radarGeometry(n각형 일반식, 라벨 상자가 차트 안), 모바일 비교 막대 compareBarShares, 카드 한 장 buildSeasonCardView(시즌·순위 범위 전체/같은 포지션, 시도 기준은 항상 리그 값), 파울·출전 줄 cardFootStats, 선수 그리드 buildGridEntries·sortGridEntries(등급→PER)·filterGridEntries, 비교표 compareCardEntries(턴오버·파울은 낮은 쪽), 주소 쿼리: 선수 상세 ?season=&scope=pos(시즌 비교 ?vs= 는 없앰) · 선수 탭 ?season=&pos=&origin=&team= · 비교 탭 ?a=번호:코드&b=번호:코드)
│   ├── search.ts        ← 선수 검색 (순수 함수: normalizeName(공백 무시)·matchScore·searchPlayers(최대 10명, 최근 선수 먼저)·buildSearchIndex)
│   ├── leaders.ts       ← 순위표 규칙 (순수 함수: 부문 정의(better high/low), 필터·정렬·순위(성공률 시도 기준), 열 순서, 성공/시도·숫자 표기, 주소 쿼리)
│   ├── teams.ts         ← 팀 한글 약칭 teamShortNameKo (연고지 지명 목록 HOME_CITIES — 하드코딩 예외, 이유 주석), 팀 색 배정 assignTeamColors(회색 기본값 팀 → 범주형 팔레트, 팀 순서, 순환 금지)·ensureMarkContrast·comparePairColors(OKLab 거리 < 15면 팔레트 1·2번), 핵심 의존도 teamDependency(상위 3명 득점 비중·표본 충족 수)
│   ├── distribution.ts  ← 팀 분포 산점도 규칙 (지표 SCATTER_METRICS PER·TS%·경기당 득점, scatterPoints(표본 충족만), toggleTeam(최대 2팀), 주소 쿼리 ?teams=&y=&q=&pos=&p=)
│   ├── home.ts          ← 홈 규칙 (HOME_CATEGORIES, pickHomeSeason(코드표 최신 시즌이 0명이면 직전 시즌 + 개막 전 안내), splitRecentSeasons)
│   ├── roster.ts        ← 포지션·국적 규칙 (POSITION_LABELS, positionGroupOf(첫 글자), nationalityOf(마스터 없으면 isForeign)) + 비교 집단 필터 filterByPosition·filterByNationality + 쿼리 값 positionParam/FromParam·nationalityParam/FromParam (순위표·선수 탭·팀 분포 공용)
│   ├── badges.ts        ← 칭호 배지 (순수: BADGE_DEFS 조건·우선순위, buildBadgeIndex(시즌별 최다 경기·경기당 1위), playerBadges, splitBadges(히어로 5개 + "+n")) — lib/data 가 빌드 시점에 계산
│   ├── glossary.ts      ← 주 공격 유형 OFFENSE_TYPES(라벨·조건·문턱 OFFENSE_*)·offenseTypeHelp + 유형 라벨 PLAYER_TYPES(라벨·조건·설명, 문턱 TYPE_ALLROUNDER_MIN·TYPE_ROLE_MAX — playerType 이 읽음) + 용어 설명 데이터 GLOSSARY (지표별 한 줄 설명·공식·출처 URL·검산 메모) + 용어 탭 앵커 GLOSSARY_ANCHORS·glossaryHref(/glossary#ts)·순위표 열/레이더 축 → 용어 매핑. 계산 없음
│   ├── convert.ts       ← 시즌 파일 → 화면용 최소 필드 변환 toCardPlayers·toLeaderPlayers·toCardTeams (순수 — data.ts 와 prebuild 스크립트 공용)
│   ├── cards.ts         ← public/cards 파일 형식 v3 (열 형식 CARD_FIELDS — 6축 재료 fgm·midA·midM·rebPct·astPct 포함, encodeSeasonCards·decodeSeasonCards, 기본 표본 기준 참고값 defaults)
│   ├── data.ts          ← 빌드 시점에 data/processed 읽기 (서버 전용, loadSeasonHighCards·loadCareerHighTabs·teamNameInSeason(한 경기 최다, 필드 없으면 빈 배열), listAllSeasons(코드표 전체)·loadPlayersIndex·toCardPlayers·toCardTeams·toLeaderPlayers·loadPlayerCareer(선수 전 시즌 행)·loadSeasonCardsFile/loadSeasonCards(public/cards 와 같은 encode→decode — 정적 HTML 첫 카드용))
│   ├── images.ts        ← 공식 이미지 스위치 officialImagesEnabled() (NEXT_PUBLIC_OFFICIAL_IMAGES=off 면 끔) + 대체 디자인 글자 규칙(teamMark) + 표용 팀 약칭(teamShortLabel: 9글자 넘으면 머리글자) + 색 섞기 mixHex(카드 그라데이션)
│   └── types.ts         ← Player, SeasonData(coverage·teams), Team(shortNameKo·logoUrl·color), TeamColor, PlayerIndexEntry(photoUrl), CardPlayer, CardTeam, LeaderPlayer(순위표용 최소 필드), CareerSeason·PlayerCareer(선수 페이지), SearchEntry(검색 색인) 등 타입 정의
├── app/                 ← Next.js 화면 (App Router)
│   ├── layout.tsx, globals.css (색 토큰: 라이트/다크, 범주형 --cat-1…8, 포커스 링 유틸 focus-ring·focus-ring-inset)
│   ├── page.tsx         ← 홈 "이번 시즌 한눈에" (개막 전 안내·득점 1위 표지·부문별 1~3위·화면 버튼(선수·순위표·팀 분포·비교·용어·검색)·시즌 목록, 정적)
│   ├── players/page.tsx ← 선수 탭 (큰 검색창 + 시즌·포지션·국적·팀 칩 + 선수 그리드, 최신 시즌 정적 HTML, 다른 시즌은 /cards)
│   ├── player/[playerNo]/page.tsx  ← 선수 상세 정적 1,329개 (히어로(프로필·국적·나이·국가·출신교) → 시즌 칩·순위 범위·시즌 비교 카드 → 추이 그래프 → 시즌별 기록표 → 커리어 하이)
│   ├── compare/page.tsx ← 비교 탭 정적 1쪽 (?a=번호:코드&b=번호:코드, 기본은 최신·직전 시즌 PER 1위)
│   ├── glossary/page.tsx ← 용어 탭 (lib/glossary 표, 앵커 /glossary#ts)
│   ├── season/[seasonCode]/leaders/page.tsx  ← 시즌 순위표 정적 페이지 (1~3위 표지 카드 + 이 시즌 한 경기 최다 카드 줄 + 정렬 표, 포지션·국적 칩, 파울 열)
│   ├── season/[seasonCode]/teams/page.tsx  ← 팀별 선수 분포 정적 페이지 (산점도(포지션 칩) + 팀별 핵심 의존도)
│   ├── (옛 /season/[코드] 플레이어 카드 탭은 없앰 → next.config.mjs redirects: ?p= 있으면 /player/번호?season=코드, 없으면 순위표)
│   ├── not-found.tsx
│   └── components/      ← SiteNav(상단: 사이트 이름·검색창(선수 탭은 hideSearch)·시즌 선택(순위표·팀 분포·선수 탭만)·메뉴 홈/선수/순위표/팀 분포/비교 — 용어는 메뉴에서 뺌), PlayerSearch(상단·큰 검색창·onSelect 선택 모드), useSearchIndex(/search-index.json 한 번 fetch — 우리 정적 파일),
│                           RowList(표 대신: 모바일 행 카드 펼침 / PC 전체 표, 가로 스크롤 없음, pageSize "더 보기" — 순위표·기록표·팀 분포 표), FilterSheet(필터 버튼+요약 칩 → 모바일 바텀시트 / PC 인라인 패널, FilterGroup), icons(인라인 SVG 모음 16/20/24: 검색·닫기·꺾쇠·필터·정보·화살표·바깥 링크), Skeleton(불러오는 중 자리, PlayerCardSkeleton 은 PlayerCard.tsx), webFont(Pretendard CSS 주소 한 곳 + 카드 저장용 글꼴 조각 넣기),
│                           useSeasonCards(/cards/{코드}.json fetch·캐시, useCardView), PlayersView(선수 탭), PlayerSeasonCards(선수 상세 카드 영역), CompareView(비교 탭), CardDeck(카드 1~2장 + PNG 저장), CompareTable(비교표·증감), ChipRow, InfoLink(ⓘ → HelpPopover), HelpPopover(그 자리 도움말 팝오버: PC 옆 상자·모바일 하단 시트, 한 번에 하나), CompareHeadToHead(비교 탭 모바일 좌우 비교),
│                           PlayerHero·CareerTrend(Recharts LineChart)·CareerTable·CareerHighs·ShotChart(직접 그린 하프코트 SVG + 구역표 + 공격 유형 칩, /shots fetch)(선수 페이지), SeasonHighStrip(순위표 한 경기 최다 줄), Segmented, useCardSave(카드 PNG 저장), useMedia,
│                           PlayerCard(게임식 플레이어 카드: 팀 색 상단+큰 사진 / 스탯 9개+순위(전체 또는 "가드 중") / 파울·출전 줄 / 레이더+등급, 입력은 SeasonCardView 하나),
│                           LeadersView(순위표), TeamsView(팀 분포 산점도·팀 요약), HomeView(홈), SourceFooter, useThemeColors,
│                           PlayerAvatar(circle·portrait)·TeamLogo(공식 이미지+대체 디자인, official={false}면 대체만), useOfficialImage(저장 filter excludeOfficialImages)
└── .github/workflows/fetch.yml, backfill.yml, backfill-highs.yml, backfill-gamelogs.yml, backfill-shots.yml  ← 매일 새벽 수집 / 전체 재수집 / 한 경기 최다·프로필 과거 전체 백필 / 커리어 하이 경기별 기록 백필 / 슛 차트 백필(셋 다 실행 횟수 숫자 올려 푸시)
```

## 배포 규칙 (2026-10-01 사용자 지시 — 세션이 바뀌어도 지킨다)
- **작업이 끝나면 항상 main 브랜치에 배포한다.** Vercel 은 main 만 배포하므로 작업 브랜치에 푸시만 하고 끝내면 사용자는 옛 화면을 본다.
- 순서: 작업 브랜치 커밋·푸시 → 검증(typecheck·test·build) 통과 → `git fetch origin main && git checkout main && git merge --ff-only <작업 브랜치>` (ff 가 안 되면 main 을 작업 브랜치에 먼저 merge 해 해결) → `git push origin main` → 작업 브랜치로 돌아온다. PR 승인을 기다리지 않는다.
- 데이터 커밋(Actions)이 main 에 먼저 들어와 있을 수 있으니 merge 전에 반드시 fetch 한다.

## 코딩 규칙
- 파일·변수 이름은 영어, 주석과 커밋 메시지는 한국어
- KBL API 필드명(`kname`, `fgRt` 등)은 `lib/types.ts`에서 우리 이름(`nameKo`, `fgPct`)으로 한 번만 변환. 화면에는 KBL 원본 필드명이 나오지 않게
- 수집 스크립트는 실패 시 해당 시즌만 건너뛰고 나머지는 계속. 마지막에 실패 목록을 출력
- 화면은 모바일 우선 (팬은 대부분 폰으로 본다)
- 새 화면·차트를 만들기 전에 `SCOPE.md`의 IN 목록에 있는지 확인. 없으면 만들지 말고 사용자에게 묻는다
- 새 지표를 추가할 때 계산식·출처 주석 필수

### 디자인 토큰 (2026-09-30 디자인 점검 B·C, 토큰은 `app/globals.css`)
- 글꼴은 **Pretendard Variable 하나**(`app/components/webFont.ts` 주소, layout 에서 로드). 다른 글꼴·font-mono 를 추가하지 않는다. 데이터 숫자(스탯 타일·표·행 카드·카드 격자·순위)에는 `tabular`, 차트는 `.recharts-wrapper` 에 이미 걸려 있다. 문장 속 숫자는 비례폭
- 글자 크기는 단계 유틸리티만: `text-h1`(28/32) · `text-h2`(20/22) · `text-body`(15/16) · `text-sub`(13) · `text-caption`(12). PC = 1024px 이상. 입력창·select 는 iOS 확대 방지로 `text-base`(16). 카드(PlayerCard)·큰 숫자·표지 이름은 예외(자체 비례 치수, deslop-ignore 11)
- 반경 3단계: `rounded-container`(16, 페이지 위 카드·목록 상자) · `rounded-card`(12, 안에 든 카드) · `rounded-control`(8, 칩·배지·버튼·입력). 바깥 모서리에 붙는 안쪽 요소는 바깥 − 패딩(예: 8 − 2 → rounded-md). `rounded-full` 은 아바타·색 점만, `rounded-2xl/xl/lg/3xl` 직접 쓰지 않는다
- 표면: 흰 면 카드는 `surface-card`(표면 + hairline + `shadow-card` 0 1px 2px). 그림자는 이것 하나. 반투명·블러 표면 금지
- 색: 회색은 토큰(`ink/ink-2/ink-3/line/surface-2`)만, 액센트는 팀 색 외 `--series-1`(파랑) 하나. 등급·메달 색은 `lib/teams gradeTone`(S 금색·A/B 팀 색·C 이하 무채색, 채도 20%↓, 글자 4.5:1 — tests/teams.test.ts 가 확인)
- 인터랙션: 누르는 것은 높이 40px 이상(칩 h-10, 주요 버튼 h-11, 표 행 48px), 포커스는 `--focus` 링 하나(전역 기본값 + `focus-ring`/`focus-ring-inset`), 호버는 `transition-colors duration-200` 만(`transition-all`·투명도 호버 금지). 글리프(› ▲ ⓘ ↗)는 쓰지 않고 `icons.tsx`
- 도움말: 설명은 ⓘ 팝오버(`HelpPopover`, 내용 `lib/glossary helpContent`)에만 — 화면에 상시 설명 문구를 늘리지 않는다. 클릭/탭으로 열고 바깥·ESC·닫기로 닫힘, 한 번에 하나, `aria-expanded`·`aria-describedby`, body 포털(z-[60]), "자세히"만 /glossary 로 이동. 메뉴에 용어 탭 없음
- 불러오는 중은 같은 모양의 `Skeleton`, 결과 0명은 문구 + "필터 초기화". `prefers-reduced-motion` 이면 전환·펄스를 끈다(globals.css)
- 점검: `node .claude/skills/kill-ai-slop/scripts/scan.mjs app --skip=15,16,28,30,34` 가 0건이어야 한다. 일부러 남기는 것은 `deslop-ignore-next-line NN`

## 하지 말 것 (안티패턴)
- 화면 컴포넌트에서 fetch로 KBL 서버 호출 (CORS로 실패하고, 원칙 1 위반)
- raw 파일을 직접 수정하거나 가공 결과로 덮어쓰기
- 시즌 코드·팀 코드를 코드에 하드코딩 (코드표 파일에서 읽는다)
- "이왕 만드는 김에" 회원가입·댓글·실시간 기능 추가 (SCOPE.md OUT 항목)
- 차트 라이브러리 추가 설치
- 요청 간격 없이 반복 호출

## 세션 로그
- 2026-10-01 (피드백 7차 — 레이더 6축·포지션 종합): ① 칭호 "15시즌 클럽" → **"롱런"**. ② 레이더를 **6축 공격·수비·리바운드·슈팅·리딩·효율**로 개편(`lib/metrics RADAR_AXIS_COMPONENTS`, 사용자 정의): 공격 = 경기당 득점·야투 성공·야투 시도·자유투 시도·USG% / 수비 = 스틸·블록·굿디펜스·디플렉션(파울 뺌) / 리바운드 = 공격·수비 리바운드·REB%(박스아웃은 KBL 미기록) / 슈팅 = 3점 성공·시도·성공률 + **미드레인지 시도·성공률(슛 차트 구역, coverage.shots 2006-07~)** / 리딩 = 어시스트·AST/TO·TOV%·AST%(경기당 턴오버는 벤치 편향이라 뺌) / 효율 = PER·TS%·eFG%. +/-·스크린 어시스트·2점%·허슬 축 폐지. CardPlayer·카드 파일 v3 에 fgm·midA·midM·rebPct·astPct 추가, `radarGeometry` 를 n각형 일반식으로. ③ **종합 등급 포지션 가중치**(`axisWeights·ROLE_AXIS_WEIGHTS`): 가드(G·GF) 리딩 ×1.5·리바운드 ×0.5, 포워드 전부 1, 빅맨(FC·C) 리바운드 ×1.5·슈팅·리딩 ×0.5 — 레이더 축은 그대로, 종합·유형 라벨만. 실측(2025-26 국내): 리바운드 가드 37·빅맨 83, 슈팅 55·37, 리딩 64·35. ④ 유형 라벨 세분(`playerType`, 가장 높은 축이 포지션상 낮기 쉬운 축일 때만): 플레이메이킹 빅맨·스트레치 빅맨·락다운 디펜더(수비 ≥80, 슈팅 <55, 공격 <70)·리바운딩 가드 + 일반 득점원·수비수·리바운더·슈터·플레이메이커·효율형. 처음 "그 축 ≥70 이면" 규칙은 이정현(S·S·리바 81)을 리바운딩 가드로 만들어 폐기. 결과(2025-26): 이정현·허훈 A→S, 하윤기 A, 워니 득점원, 유형 분포 리바운더 29·플레이메이커 20·슈터 20·수비수 19·효율형 19·롤 14·득점원 8·올라운더 8·세분 5. 검증: typecheck·test 12벌·build·slop 0, Playwright 390/1280.
- 2026-10-01 (피드백 6차): ① 홈 부문별 1~3위에 **3점 성공(경기당)** 추가 — `lib/leaders` 부문 키 `tpm` 복귀(순위표 부문 칩·표 열(3점% 바로 앞)·`?cat=tpm`, 한 경기 최다 카드 대응 `LEADER_CATEGORY_HIGH`). ② 주 공격 유형에 **코너 슈터형**(`cornerShooter`): 3점 ≥ 50% 이고 3점 시도 중 코너 ≥ 30%(리그 약 14%의 두 배, `OFFENSE_CORNER_MIN`) → 2025-26 슈터 56명 중 9명(박인웅·최현민 등), 옛 시즌엔 0~2명. processed 19개 시즌 `offenseType` 재생성(다른 필드 diff 0). ③ 칭호 "레전드" → **"15시즌 클럽"**(키 `legend`·앵커 유지 — 레전드는 실력까지 뜻하는 말이라). ④ **종합 등급 포지션 가중치** `lib/metrics axisWeights·POSITION_THREE_WEIGHT`: 3점 축 비중 센터 0·포워드(FC 포함) 0.5·가드 1 — 종합 점수·유형 라벨(올라운더 판정)에만, 레이더 축 값·등급은 그대로. 카드에 "종합 등급: 센터라 3점 축은 종합에 넣지 않음" 한 줄. 결과(2025-26 표본 충족 142명): S 9→9, 바뀐 선수 18(하윤기·마레이·칸터 B→A, 함지훈 B→A, 김종규 D→C / 포워드 슈터는 반대로 데릭 윌리엄스·정인덕 A→B). 포워드 0.5 는 KBL 포워드 코드에 빅맨(김주성·이승현)과 슈터(전성현)가 섞여 있어서 고른 절충값 — 사용자 확인 필요. ⑤ 커리어 하이 → 경기 박스스코어 팝업은 **SCOPE OUT(경기별 박스스코어)**·API 미확인이라 만들지 않고 평가만: 커리어 하이 날짜+상대 팀으로 `data/raw/games` 목록에서 gmkey 를 1,329/1,329건 찾을 수 있음(날짜 형식만 "2008-11-01" ↔ "20081101"). 남은 것은 서버 C 박스스코어 주소 확인(Actions 프로브)과 수집 범위 결정.
- 2026-09-30 (슛 차트 백필 완료): 서버 C 필수 헤더(`channel/lang/teamcode`, 브라우저 요청 캡처로 확인) 추가 → 백필 4회 실행(워크플로 설명 주석이 `# 대상 시즌:` 줄로 잡히던 버그 수정, 옛 시즌 `isEnded 0` 판정 수정). 결과: **슛 차트는 2006-07(코드 11)부터** 19개 시즌 전부 270경기(2019-20은 213), 좌표 체계 동일, 1997~2005-06은 전부 빈 차트. 좌표 검증(47): 점 개수 = 공식 FGA 98%, 성공 99.7%, 3점 판정 오차 2.4%. 19개 시즌 processed 재생성·커밋. 유형 분포 변화: 골밑 공격형 37(2006-07)→23(2025-26), 3점 슈터형 29→56, 미드레인지형 최대 22(2012-13)→5.
- 2026-09-30 (슛 차트·공격 유형, PLAN.md §14): `lib/shots.ts`(좌표 정규화·3점 판정·구역 5개·집계·주 공격 유형·코트 그림) + `OFFENSE_TYPES`(glossary). process 가 시즌 47·45 슛 raw → `shotZones`·`shotZoneLeague`·`coverage.shots`·`processed/{시즌}/shots.json`(나머지 시즌 null·false, 다른 필드 diff 0). `build-shots.ts` → `public/shots`(383개). 선수 상세 추이 아래 "슛 차트"(하프코트 SVG 점 + 구역표 + 유형 칩 ⓘ, 시즌 칩 연동·없는 시즌 한 줄), 플레이어 카드 유형 라벨 옆 공격 유형 칩(PNG 포함), 용어 탭 "슛 구역"·"주 공격 유형". 결과: 워니 2025-26 슛 1,091(공식 FGA 와 같음) 골밑 132·75.0%/페인트 434·51.2%/미드 214·31.3%/코너 1·0%/아크 310·30.3% → 균형형(안 51.9%), 2024-25 골밑 공격형. 2025-26 유형: 3점 슈터형 56·골밑 23·인사이드-아웃 22·균형 19·미드레인지 5·유형 없음 68(슛 50개 미만 60·슛 없음 8). 검증: typecheck·test(shotzones 추가)·build·slop 0, Playwright 3명 × 390/1024/1280 × 라이트/다크.
- 2026-09-30 (피드백 5차, PLAN.md §13): ① PC(1024↑) 선수 상세 가로 플레이어 카드(`PlayerCard layout="horizontal"`, 높이 458~493px) + 추이 아래·하이라이트 오른쪽 열 ② 레이더 구성 요소 40분당 → 경기당(`*PerGame`, 2025-26 국내 종합 S 1→8명, 벤치 롤 플레이어 하락 — 함지훈 A→B) ③ 커리어 하이 업적 카드 7장(`careerHighAchievements`: 시즌 최다·40/50득점 칩, PO·챔프전 보조 줄) ④ 메뉴 "용어" 제거 → ⓘ 그 자리 팝오버 `HelpPopover`(InfoLink·칭호 배지·카드 유형 라벨) ⑤ 레이더 위 등급 칩 잘림 원인 = Recharts 라벨 8px 바깥 → `radarGeometry` ⑥ 비교 탭 모바일 좌우 비교 `CompareHeadToHead` + "카드 보기" 토글. 검증: typecheck·test·build·slop 0, Playwright 4화면 × 390/1024/1280/1440 × 라이트/다크 32회 가로 스크롤 0·콘솔 에러 0·레이더 라벨 5개 전부 차트·뷰포트 안, 팝오버 열기/ESC/바깥/하나만/aria-describedby, 카드 PNG 저장.
- 2026-09-30 (슛 차트 수집): 서버 C 경기 목록(`/match/list`, 월 단위)·슛 차트(`/match/{gmkey}/match-chart`) raw 수집기. 매일은 한 경기 최다와 같은 대상 시즌의 목록을 오늘까지 달만 다시 받고 새로 끝난 정규시즌 경기만(보통 0~5회, 빈 차트는 저장 안 함), 과거는 `backfill-shots.yml`(`# 대상 시즌` 줄로 시즌 지정 — 처음은 47, 시즌당 약 280회 ≈ 7분, 전체 30개 시즌 약 8,400회 ≈ 3.8시간 추정). 가공·화면은 없음(좌표 형식을 실제 raw 로 확인한 뒤). 세션 환경은 KBL 차단(api.kbl.or.kr 403) → 가짜 fetch 로 daily/backfill 흐름·이어받기만 확인. 검증: typecheck·test(shots 추가)·build, raw/games·shots 가 있어도 process 정상. 미확인: `isEnded` 실제 값 형태, 옛 시즌(1997~)이 서버 C 목록·차트에 있는지, 경기당 raw 크기.
- 2026-09-30 (한 경기 최다 7개·슛 시도 수·종합 컷): PLAN.md §11. ① 커리어 하이 표·순위표 "이 시즌 한 경기 최다"·하이라이트 대체 카드를 7개(`lib/highs HERO_HIGH_KEYS` 득점·리바·어시·스틸·블록·3점·자유투 성공)로 — 나머지 부문은 processed 에 그대로. ② 서버 B 경기별 기록 수집 시작: 매일 현재 시즌 선수 전원(한 경기 최다와 같은 대상 시즌), 과거는 `backfill-gamelogs.yml`(커리어 하이 득점·3점·자유투 시즌만, 1,918회, `# 실행 횟수: 0`). process 가 3점·자유투·야투 성공 하이에 같은 날짜 경기의 `attempts`·`pct`(성공 개수 일치할 때만), 화면은 값 옆 "8/12 · 66.7%". ③ 종합 등급 전용 컷 `OVERALL_GRADE_CUTS` 85/70/55/40/25(축 컷 90/75/55/35/15 그대로) → 2025-26 국내 S 1(이정현)·A 13, 외국 S 0·A 0·B 11, 강성욱 A·워니 B. 검증: typecheck·test(10개)·build, 가짜 경기별 raw 2명(워니·허웅)으로 /player/291248·/season/47/leaders 390/1280 가로 넘침 0·콘솔 에러 0(외부 이미지·CDN 차단 제외) 확인 후 삭제, slop 0. 세션 환경은 KBL 차단 → 경기별 기록 응답의 fg/fdg 뜻은 첫 Actions 실행에서 확인할 것.
- 2026-09-30 (피드백 3차, PLAN.md §10): ① 종합 등급 = 5축 백분위 평균에 컷 직접 적용(재순위 없음) → 강성욱 S→B, 2025-26 종합 S 0명(국내 최고 이정현 86.7 A). ② 유형 라벨을 `lib/glossary PLAYER_TYPES`로 모으고 카드 라벨 → 용어 탭 표, 종합 옆 ⓘ. ③ 히어로 통산 8칸(스틸·블록·통산 야투%·3점%). ④ PC 카드 옆 열 = 추이(카드 높이 채움) + 하이라이트 3개(시즌 1~10위 부문, 없으면 커리어 하이) — 1024/1280/1440 두 열 높이 차 0. ⑤ 칭호 배지 `lib/badges.ts`(히어로 5개+“+n”, 그리드 1개, 용어 표). ⑥ `data/codes/photo-overrides.json`. 덤: `scripts/highs.ts` "PO…" 키 분류 버그(기존 highs 테스트 실패) 수정. 검증: typecheck·test 9개·build, Playwright 390/1024/1280/1440 × 4화면 가로 넘침 0·콘솔 에러 0, slop 0. 남은 것: CareerTable 시즌 링크(PC 표 안 글자 링크) 높이 15px — 이전부터.
- 2026-09-30 (배포 차단 수정): Vercel Hobby 플랜은 비공개 레포에서 프로젝트 소유자가 아닌 작성자의 커밋을 배포하지 않는다("commit author did not have contributing access"). Actions 가 만든 데이터 커밋(작성자 kbl-stats-bot)이 전부 Blocked → 세 워크플로의 git 작성자를 소유자 GitHub 계정(`robinside7854 <252681033+robinside7854@users.noreply.github.com>`)으로 바꿈. 소유자 계정이 바뀌면 이 값도 바꿔야 한다. 대안: 레포를 공개로 전환하거나 Vercel Pro.
- 2026-09-30 (커리어 하이·시즌 하이): 서버 B mostgame·profile API 수집·가공·화면. 매일 수집은 현재 시즌 선수만(개막 후 30일은 직전 시즌도, `scripts/highs.ts highsTargetSeasons`), 과거 전체는 `backfill-highs.yml`(선수-시즌 약 4,980회 + 프로필 약 1,330회 ≈ 3시간, 이어받기·시즌 단위 커밋, `# 실행 횟수` 0 → 1로 올려 푸시하면 실행). process 가 선수 `seasonHighs`(15개 부문)·시즌 `seasonHighLeaders`(기록 11개, 동률은 먼저 달성, 성공률 제외)·색인 `careerHighs`(정규/PO/챔프전, 최신 시즌 raw 우선)·`birthday/country/school`. 화면: 선수 상세 히어로 나이(빌드 시각 기준)·국적·출신교, 기록표 아래 "커리어 하이" 탭 표, 순위표 1~3위 아래 "이 시즌 한 경기 최다" 가로 카드 줄(고른 부문 강조), 용어 "한 경기 최다". 세션 환경은 KBL 차단 → raw 없음이라 지금은 전부 null(섹션 숨김), 가짜 raw 3명으로 화면 확인 후 삭제. 검증: typecheck·test 8개·build, Playwright 390/1280 가로 스크롤 0·콘솔 에러 0. data/processed 변경분은 커밋 안 함(백필 후 Actions 가 생성). 미확인: 플레이오프·챔프전 배열 이름, 옛 시즌(1997~)에 mostgame 기록이 있는지, raw 파일 크기.
- 2026-09-30 (등급 체계 2차, PLAN.md §8): 등급(백분위·S~F·종합)을 같은 국적 집단(국내/외국/아시아쿼터, 아시아쿼터 표본 충족 8명 미만이면 외국과 합산) 안에서 매김 — 순위는 리그 전체 그대로. 레이더를 공격·수비·3점·허슬·효율 5축(구성 요소 백분위 평균 → 집단 안 다시 백분위, 기록 없는 요소는 빼고, 파울·TOV% 반전)으로 바꾸고 modern/classic 축 세트 제거. 카드에 "등급 기준: 국내 선수 109명 중"·뺀 항목 안내. USG% 열(순위표·기록표·비교표·팀 분포 표, 없는 시즌 –), 순위표 PC 17열을 992px 안에(dense). 선수 상세 시즌 비교 토글·?vs= 제거. 추이 점 = 팀 로고, 지표 스틸·블록·3점% 추가(TS% 뺌). 결과: 2025-26 국내 S 0→11명(이정현·안영준·허훈·박지훈 B→S, 허웅 B→A). 검증: typecheck·test·build, Playwright 390/1280 6화면 가로 스크롤 0·콘솔 에러 0·카드 PNG 저장, slop 스캔 0.
- 2026-09-30 (디자인 반영 3~5단계): `docs/design-review-2026-09-30.md` B1~B5·C1~C5·D. Pretendard(jsDelivr, 카드 PNG 에도 글꼴 조각을 넣음)·글자 단계 유틸리티·반경 이름 토큰 3단계·`surface-card`/`shadow-card`·등급/메달 채도 20%↓(`lib/teams gradeTone·desaturate·readableInk`), 터치 타겟 40px+·전역 포커스 링·스켈레톤·빈 상태·reduced-motion·글리프 → 아이콘, 다크 모드 대비(ink-3, 검정 팀 색 경계). 스캔 93 → 0(유지 항목은 deslop-ignore). 검증: typecheck·test·build, 8화면×390/1280×라이트/다크 32장 가로 넘침 문서 0·콘솔 에러 0·높이 40 미만 클릭 요소 0·Pretendard 로드 확인, 카드 PNG 저장(글꼴 포함). 세션 환경은 jsDelivr 도 차단이라 검증 때 npm pretendard@1.3.9 파일로 CDN 요청을 대신 응답했다.
- 2026-09-30 (디자인 반영 1·2단계): docs/design-review-2026-09-30.md A1~A7. 표 가로 스크롤 제거 — 공통 `RowList`(모바일 행 카드 펼침 / PC 전체 표 992px 안), 순위표 25행·선수 그리드 20장 "더 보기", `FilterSheet`(모바일 바텀시트·PC 인라인 패널·요약 칩, 1차 컨트롤만 노출), 선수 탭 상단 검색·본문 시즌 칩 제거, 설명 문구 축약, 홈 바로가기 큰 버튼 2개 + 링크 줄. lib 추가: takeFirst·rowSummaryKeys·formatSummaryStat·leaderFilterChips(leaders), GRID_PAGE_SIZE·gridFilterChips(cardview), distributionFilterChips(distribution) + 테스트. 측정: 390px 순위표 8,314→2,472px, 선수 탭 16,903→2,256px, 표·카드 가로 넘침 0(남은 건 의도한 칩 줄·Recharts 내부 래퍼), 콘솔 에러 0. 다음: 3단계(폰트·위계·반경·그림자·등급 색).
- 2026-09-30 (2차 개편 화면층): 사용자 피드백 9건 반영 — 메뉴 홈/선수/순위표/팀 분포/비교/용어, "플레이어 카드" 탭 폐지(선수 상세로 통합, `/season/[코드]`는 next.config redirects로 순위표 또는 `?p=`면 `/player/번호?season=코드`). 선수 탭 `/players`(큰 검색창·시즌/포지션/국적/팀 칩·등급→PER 그리드, 다른 시즌은 public/cards fetch), 선수 상세에 시즌 칩·순위 범위(전체/같은 포지션 "가드 중 3위")·시즌 비교(카드 2장+증감 표)·프로필(포지션·키·몸무게·등번호·드래프트·국적 배지), 비교 탭 `/compare?a=번호:코드&b=번호:코드`(검색 → 뛴 시즌 칩, 다른 시즌·같은 선수 가능, 각자 시즌 안 순위 안내), 용어 탭 `/glossary`(앵커, 카드 등급·순위표 열 ⓘ에서 연결). 순위표 포지션·국적 4단 칩·포지션 배지, 팀 분포 포지션 칩, 카드 파울·출전 줄. 계산은 새 `lib/cardview.ts`(서버도 public/cards와 같은 encode→decode로 계산해 첫 HTML과 브라우저 결과가 같다). 검색 색인에 뛴 시즌 코드 추가(370KB). 검증: typecheck·test(7개)·build 36.8초(정적 1,396쪽), Playwright 390/1280 8개 화면 가로 스크롤 0·콘솔 에러 0, 카드 PNG 저장 확인. `grep kbl.or.kr app lib` 0, `grep PIE app` 0.
- 2026-09-30 (2차 개편 데이터층): 선수 마스터 API(서버 B /api/v1/players) 수집·조인 추가 — `data/raw/players/players.json` → 선수 색인·시즌 players[]에 position·positionGroup·nationality·heightCm·weightKg·backNumber·draft (마스터 없으면 null + 경고 한 줄, isForeign은 이름 추정 유지). USG% ×5(표준 척도, 원값 usgPctRaw), PIE 미사용(레이더 modern 축 PIE→PER, coverage.advanced는 USG·AST·REB 판정 — 결과 동일), 카드 스탯에 파울(경기당·순위 없음), 순위표 열에 파울, 포지션·국적 필터(lib/roster.ts), 용어집(lib/glossary.ts), 비교 탭용 public/cards/{시즌}.json(열 형식, 최대 44KB). 세션 환경은 KBL 차단이라 마스터 수집은 미검증 — 다음 Actions 실행에서 확인. TOV%·AST/TO 도 우리 데이터로 검산 일치 확인.
- 2026-09-30 (팀 분포·홈): PLAN.md ④⑤ 완료. `/season/[코드]/teams` 30개 시즌 — 산점도(가로 경기당 출전, 세로 PER/TS%/경기당 득점, 표본 충족만), 팀 칩이 범례·필터 겸용(전체/한 팀 강조/두 팀 비교), 점 누르면 하단 선수 카드(PC는 툴팁도), 표로 보기, 팀별 핵심 의존도 카드(상위 3명 득점 비중·표본 충족 수, 선수 기록 합산이라 공식 팀 기록 아님 안내). 홈은 "이번 시즌 한눈에"로 교체(득점 1위 표지·부문별 1~3위·네 화면 버튼·시즌 목록), 지금은 2026-27이 0명이라 "개막 전 · 직전 시즌" 안내가 뜬다. 발견: 팀 색 10개는 산점도 전체 보기에서 서로 구분되지 않는다(dataviz 검증기: 산점도는 3색까지만 통과, SK·정관장 빨강 ΔE<15, 현대모비스·KCC·가스공사 남색) → 강조/비교가 기본 읽는 방법, 비교 두 팀 색이 비슷하면 파랑·주황으로 바꾸고 두 번째 팀은 네모 점. KT 검정은 다크 바탕에서 밝게 보정. 검증: Playwright 390·1280px 가로 스크롤 0, 팀 선택·지표 전환·점 클릭·쿼리 유지 확인.
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

## 디자인 작업

디자인·UI 요청은 코드에 손대기 전에 [.claude/design-rules.md](.claude/design-rules.md) 를 먼저 읽는다. 디자인 스킬은 `.claude/skills/` 에 있다.
