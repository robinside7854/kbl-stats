// KBL 데이터 수집 설정
// ⚠️ KBL API 주소는 이 파일과 fetch.ts에만 존재해야 한다. app/ 쪽에서는 절대 참조하지 않는다.

/** 서버 A: 전체 선수 기록 (주 데이터원) */
export const STATS_API = "https://api-stats.kbl.or.kr";

/** 서버 B: 시즌리더·공통 코드표 (Sports2i 운영) */
export const CODES_API = "https://kbl-api.sports2i.com";

/**
 * 선수 마스터 (서버 B, 2026-09-30 Actions 러너에서 확인): 은퇴 선수 포함 전체 선수 명단 + 포지션·국적·신장·드래프트.
 * GET /api/v1/players?regSc=N&pageNo={n}&listCn={≤255} → { totalCn: "2061", playerList: [...] }
 * regSc=Y 면 현역 등록 선수만(186명) — 우리는 옛 시즌 선수도 조인해야 해서 N(전체).
 * Referer·Origin·Accept 헤더가 없으면 빈 응답 (fetch.ts getJson 헤더 그대로 쓰면 됨). 단건 상세 API 는 없음.
 */
export const PLAYER_MASTER_PATH = "/api/v1/players";
export const PLAYER_MASTER_REG_SC = "N";
/** 선수 마스터 페이지 수 상한 (200명 × 50쪽 = 10,000명) — 응답 이상으로 끝없이 넘기는 일 방지 */
export const PLAYER_MASTER_MAX_PAGES = 50;

/**
 * 한 경기 최다(커리어 하이·시즌 하이) (서버 B, 2026-09-30 Actions 러너에서 확인)
 * GET /api/v1/players/categories/mostgame/{seasonCode}/{playerNo}
 *   → { MostGameRegularSeasons: [...](요청 시즌의 시즌 하이), MostGameRegularAllTimes: [...](통산), 플레이오프·챔프전 배열 }
 * 한 요청이 "그 시즌 하이 + 통산"을 같이 주므로 선수-시즌 조합당 1회. 형식·매핑은 scripts/highs.ts.
 */
export const PLAYER_HIGHS_PATH = "/api/v1/players/categories/mostgame";
/**
 * 선수 프로필 (서버 B): GET /api/v1/players/profile/0/{playerNo}
 *   → { playerInfo: [{ birthday: "19940131", country: "미국", countryEng, univSch, pHeight, pos, backNum, … }], playerScore: [...] }
 * 생년월일·국가·출신교만 쓴다 (scripts/player-master.ts profileExtraFrom).
 */
export const PLAYER_PROFILE_PATH = "/api/v1/players/profile/0";
/**
 * 경기별 기록 (서버 B): GET /api/v1/players/categories/game/{seasonCode}/{gameCode}/{playerNo}
 *   → { RegularGameRecords: [{ gameNo, gameDate, awayTeam, playSec, pts, fg, fgA, threep, threepA, fdg, fdgA, ft, ftA, …, rb, aS, sT, bS, tO, foulTot }] }
 * 한 경기 최다(3점·자유투 성공)에 그 경기 시도 수를 붙이려고 받는다 (scripts/gamelogs.ts).
 * 매일: 현재 시즌 선수 전원(한 경기 최다와 같은 대상 시즌). 과거: 커리어 하이가 나온 (선수, 시즌)만 backfill-gamelogs.yml 이 한 번.
 */
export const PLAYER_GAMES_PATH = "/api/v1/players/categories/game";

/**
 * 서버 C: 공홈 자체 API (경기 목록·슛 차트, 2026-09-30 Actions 러너에서 확인). 헤더는 http.ts 공용.
 * 경기 목록 GET /match/list?fromDate=YYYYMMDD&toDate=YYYYMMDD&tcodeList=all → 배열 (월 단위로 잘라 받는다)
 * 슛 차트  GET /match/{gmkey}/match-chart → { shootLog: [...] } — 경기당 1회. 형식·대상 선정은 scripts/shots.ts.
 */
export const SITE_API = "https://api.kbl.or.kr";
/** 공홈 역대수상현황 화면 (수상 표가 화면 JS 번들 안에 있다 — scripts/awards.ts) */
export const SITE_ORIGIN = "https://kbl.or.kr";
export const AWARDS_PAGE_URL = `${SITE_ORIGIN}/record/award`;
export const matchListUrl = (fromDate: string, toDate: string) =>
  `${SITE_API}/match/list?${new URLSearchParams({ fromDate, toDate, tcodeList: "all" })}`;
export const matchChartUrl = (gmkey: string) => `${SITE_API}/match/${encodeURIComponent(gmkey)}/match-chart`;

export const playerHighsUrl = (seasonCode: number | string, playerNo: string) =>
  `${CODES_API}${PLAYER_HIGHS_PATH}/${seasonCode}/${encodeURIComponent(playerNo)}`;
export const playerGamesUrl = (seasonCode: number | string, playerNo: string) =>
  `${CODES_API}${PLAYER_GAMES_PATH}/${seasonCode}/${GAME_CODE.regular}/${encodeURIComponent(playerNo)}`;
export const playerProfileUrl = (playerNo: string) => `${CODES_API}${PLAYER_PROFILE_PATH}/${encodeURIComponent(playerNo)}`;

/**
 * 선수별 요청(한 경기 최다·프로필)이 연속으로 이만큼 실패하면 그 시즌은 멈춘다
 * — 서버가 막혔거나 응답 형식이 바뀐 것이라 계속 두드리지 않는다.
 */
// 경기 하이라이트 (2026-10-04): TVING SPORTS 유튜브 채널(KBL 중계사) RSS — 키 없음, 최근 영상 15개. 규칙은 scripts/highlights.ts
export const HIGHLIGHT_CHANNEL_ID = "UC8JtQf77wqhVpOQ8Cze8JjA";
export const HIGHLIGHT_FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${HIGHLIGHT_CHANNEL_ID}`;
/**
 * 유튜브 RSS 는 가끔 404 를 준다(2026-10-06 Actions 러너에서 확인 — 전날은 됐음). 채널 주소 → 같은 채널 "업로드" 재생목록 주소(UC → UU)
 * 순서로 번갈아 몇 번 다시 시도한다(scripts/highlights.ts fetchHighlightFeed). 같은 Atom 형식
 */
export const HIGHLIGHT_FEED_URLS = [
  HIGHLIGHT_FEED_URL,
  `https://www.youtube.com/feeds/videos.xml?playlist_id=UU${HIGHLIGHT_CHANNEL_ID.slice(2)}`,
];
/** raw 폴더 data/raw/highlights/{이름}/ */
export const HIGHLIGHT_SOURCE = "tving";

export const MAX_CONSECUTIVE_FAILURES = 10;

/** 경기 구분 코드 — 1차 범위는 정규시즌만 */
export const GAME_CODE = {
  regular: "01",
  playoff: "03,04",
  finals: "04",
  all: "01,03,04",
} as const;

/**
 * 시즌 코드표 (2026-09-29 KBL 공홈 드롭다운에서 확인).
 * 최신 목록은 fetch.ts가 서버 B의 recent-seasons API로 받아 data/codes/seasons.json에 저장한다.
 * 이 상수는 API가 죽었을 때의 비상용 백업이며, 우선순위는 항상 data/codes/seasons.json.
 */
export const SEASON_CODES_FALLBACK: Record<number, string> = {
  1: "1997", 2: "1997-1998", 3: "1998-1999", 4: "1999-2000", 5: "2000-2001",
  6: "2001-2002", 7: "2002-2003", 8: "2003-2004", 9: "2004-2005", 10: "2005-2006",
  11: "2006-2007", 12: "2007-2008", 13: "2008-2009", 15: "2009-2010", 17: "2010-2011",
  19: "2011-2012", 21: "2012-2013", 23: "2013-2014", 25: "2014-2015", 27: "2015-2016",
  29: "2016-2017", 31: "2017-2018", 33: "2018-2019", 35: "2019-2020", 37: "2020-2021",
  39: "2021-2022", 41: "2022-2023", 43: "2023-2024", 45: "2024-2025", 47: "2025-2026",
  49: "2026-2027",
};

/** 기본 수집 대상: 직전 완료 시즌 + 현재 시즌 (매일 갱신) */
export const DEFAULT_SEASONS = [47, 49];

/** 요청 사이 대기 시간(ms). 서버 부하 예방 — CLAUDE.md 법적 제약 참고 */
export const REQUEST_INTERVAL_MS = 1500;

/**
 * 한 번에 받을 최대 행 수.
 * ⚠️ 서버가 이 값을 tinyint(최대 255)로 저장해서 256 이상이면 HTTP 500 (2026-09-29 확인).
 * 시즌당 선수는 ~200명이라 보통 한 페이지에 다 들어오고, 넘치면 fetch.ts가 totalCn 기준으로 다음 페이지를 받는다.
 */
export const PAGE_SIZE = 200;

export const DATA_DIR = "data";
