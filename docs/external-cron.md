# 바깥 알람으로 매일 수집 깨우기 (2026-10-05)

GitHub 예약 실행이 자주 빠져서(10-04 12번 중 1번, 10-05 0번) 바깥 무료 알람 서비스 cron-job.org 가
GitHub 에 "수집 워크플로를 실행해"라고 요청한다. 요청은 `mode=auto` 라서 문지기(scripts/fetch-gate.ts)를 거친다:
오늘 경기가 다 끝나고 1시간 지났고, 오늘 아직 안 받았을 때만 수집한다. 그 밖에는 경기 목록만 한 번 보고 끝난다.

- 요청: `POST https://api.github.com/repos/robinside7854/kbl-stats/actions/workflows/fetch.yml/dispatches`
- 헤더: `Authorization: Bearer <토큰>`, `Accept: application/vnd.github+json`, `Content-Type: application/json`
- 본문: `{"ref":"main","inputs":{"mode":"auto"}}`
- 성공 응답: 204 (본문 없음)
- 시각: 매일 18:10 ~ 다음 날 02:40 KST, 30분마다 (GitHub 예약과 같은 시각, 예약은 예비로 남김). 2026-10-06 하이라이트를 이어서 잡으려고 자정 뒤 0·1·2시를 더했다 — 그날 수집이 끝난 뒤의 알람은 하이라이트만 확인한다(scripts/highlight-watch.ts)
- 토큰: GitHub 세분화 토큰(fine-grained), 저장소 kbl-stats 하나, 권한 Actions 읽기·쓰기만. 만료되면 새로 만들어 cron-job.org 에 바꿔 넣는다
