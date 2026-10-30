# WKBL 대시보드 시작 안내 (새 세션용) — 2026-10-30

새 세션에서 이 파일을 먼저 읽고 시작한다. 사용자 결정: **먼저 만들어 보고, WKBL 승인은 그 뒤에 받는다.** 디자인·방향은 KBL 사이트(robinside7854/kbl-stats)와 같게.

## 저장소
- 작업 저장소: 사용자가 새로 만든 WKBL 저장소(예: `robinside7854/wkbl-stats`)
- 참고 저장소: `robinside7854/kbl-stats` — 화면·계산·수집 틀을 여기서 가져온다. 세션에 없으면 추가해서 읽는다
- 데이터 조사 결과: kbl-stats 의 `docs/wkbl-feasibility-2026-10-30.md`(주소·형식·걸리는 것), 응답 표본은 kbl-stats 의 `claude/probe-wkbl` 브랜치 `probe/wkbl/r2·r3·r4`
- 작업 환경(클라우드)은 wkbl.or.kr 이 막혀 있다 → 실제 응답 확인·수집은 GitHub Actions 에서(kbl-stats 의 조사 워크플로 `probe-wkbl.yml` 틀)

## 첫 할 일 (순서)
1. 새 저장소에 kbl-stats 틀을 옮긴다: Next.js·Tailwind·Recharts 설정, `app/globals.css` 디자인 토큰, 공통 컴포넌트(SiteNav·RowList·FilterSheet·HelpPopover·PlayerAvatar·TeamLogo 대체 디자인·Skeleton 등), `lib/metrics`·`lib/leaders`·`lib/career` 같은 계산 규칙. KBL 전용(서버 A/B/C 수집, 54-0, 숏폼, 로그인·알림·푸시, 하이라이트)은 처음엔 가져오지 않는다
2. 새 저장소용 `CLAUDE.md`·`SCOPE.md` 를 먼저 쓴다(kbl-stats 것을 줄여서: WKBL 데이터 소스·법적 제약·배포 규칙·업데이트 소식·GA4 규칙)
3. 수집(`scripts/`): 코드표·일정 → **경기별 박스스코어**(`POST /game/ajax/ajax_game_result_2.asp`, 2003 여름 시즌 013부터) 원본 HTML 그대로 저장 → 가공에서 표를 읽어 선수·시즌 합계를 만든다. 요청 간격 1.5초 이상, 하루 1회, 백필은 한 번
4. 화면 1차: 홈·선수(선수 페이지 포함)·기록(시즌별 리더보드·통산)·팀 순위·일정
5. 2차: 문자중계(`/live11/path_live_sms.asp?…&quarter_gu0=Q4`) 옛 시즌 범위 확인 → 클러치·위닝샷(kbl-stats `lib/clutch` 규칙 그대로) / 슛 좌표(`/player/ajax/ajax_shooting.asp`) 지난 시즌 확인 → 슛 차트

## 꼭 지킬 것
- **공식 사진·팀 로고 쓰지 않는다**(WKBL 화면 하단에 무단 사용 금지 명시) — 팀 색 + 이니셜 대체 디자인만
- 하단 출처: "기록 출처: WKBL 공식 홈페이지 · 비영리 팬 프로젝트"
- WKBL robots.txt 는 모든 자동 수집을 거부한다 → 요청 수를 최소로, 승인 전에는 검색 노출 막기(noindex)·외부 홍보 하지 않기를 권장(사용자 확인)
- 원본은 그대로 저장하고 가공은 따로(kbl-stats 원칙 1~6 그대로)

## 사용자가 할 일
- GitHub 에서 새 저장소 만들기(비공개, README 하나만 있어도 됨)
- 화면이 나오면 Vercel 에 새 프로젝트로 연결(새 주소), GA4 는 새 측정 ID(원하면)
- WKBL 문의(홈페이지 CONTACT US)로 비영리 사용 승인 요청
