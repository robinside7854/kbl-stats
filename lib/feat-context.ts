// 기록 맥락 꼬리표 (2026-10-16 사용자 "공홈에 없는 우리만의 기능" 2번): 대기록 한 줄에 "그래서 얼마나 대단한데?"를 붙인다.
// 홈 "새로 나온 기록"·알림함이 쓴다. 순수 함수만 — 재료는 빌드 때 lib/data loadRecentFeats·scripts/notif-feed 가 모아 넘긴다.
//
// 한 경기 기록(커리어 하이·시즌 최다)
//   ① 올 시즌 리그: 이번 시즌 그 기록 이상이 나온 경기 중 몇 번째인가 — 날짜 순, 같은 날은 같은 순번. FEAT_SEASON_MAX 번째까지만.
//   ② 역대: 같은 선수 묶음(국내 선수면 국내, 외국·아시아쿼터면 전체)의 정규시즌 커리어 하이 중 이 값보다 높은 선수 수.
//      0명이면 "역대 한 경기 최고(타이)", FEAT_ALLTIME_MAX 명까지는 "이보다 많이 한 선수 N명뿐", 그보다 많으면
//      "상위 N%만 해 본 기록"(이 값 이상을 해 본 선수 비율, FEAT_TOP_SHARE 이하만).
//      커리어 하이 = 선수마다 가장 높은 한 경기라, "역대 몇 번째 경기"가 아니라 "이보다 높이 올라가 본 선수 몇 명"이다.
// 통산 이정표: 그 목표를 넘은 선수가 역대 몇 명째인가(같은 묶음도). FEAT_MILESTONE_MAX 명째까지만.
import type { NotifItem } from "./notifications";

/** 올 시즌 순번은 이 번째까지만 보여 준다 (그보다 흔하면 꼬리표가 의미 없음) */
export const FEAT_SEASON_MAX = 5;
/** 역대 "이보다 높았던 선수 N명"은 이 명까지, 넘으면 상위 % */
export const FEAT_ALLTIME_MAX = 30;
/** 상위 % 는 이 비율 이하만 (그보다 흔하면 안 보여 줌) */
export const FEAT_TOP_SHARE = 0.2;
/** 통산 이정표 "역대 N번째"는 이 명째까지 */
export const FEAT_MILESTONE_MAX = 100;

/** 한 경기 기록 부문 → 꼬리표 단위 ("40득점 이상") */
const HIGH_UNIT: Record<string, (v: number) => string> = {
  pts: (v) => `${v}득점`,
  reb: (v) => `${v}리바운드`,
  ast: (v) => `${v}어시스트`,
  tpm: (v) => `3점슛 ${v}개`,
  stl: (v) => `${v}스틸`,
  blk: (v) => `${v}블록`,
};

export interface FeatContextEnv {
  /** 이번 시즌 선수-경기 기록 (박스스코어, 출전한 것만) */
  performances: readonly { date: string; player: string; stats: Readonly<Record<string, number>> }[];
  /** 선수 번호 → 정규시즌 커리어 하이 (부문 → 값) */
  careerHighs: Readonly<Record<string, Readonly<Partial<Record<string, { value: number }>>>>>;
  /** 선수 번호 → 통산 합계 (이번 시즌 포함) */
  careerSums: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** 선수 번호 → 국내 선수인가 (모르면 없음 → 전체 묶음) */
  domestic: Readonly<Record<string, boolean>>;
}

/** 올 시즌 리그에서 이 값 이상이 나온 몇 번째 날의 기록인가 (같은 날은 같은 순번) */
export function seasonOrdinal(env: FeatContextEnv, key: string, value: number, date: string): number {
  let before = 0;
  for (const p of env.performances) if (p.date < date && (p.stats[key] ?? 0) >= value) before++;
  return before + 1;
}

/** 같은 묶음 선수 중 커리어 하이가 이 값보다 높은 선수 수·같은 선수 수·묶음 크기 (자기 자신 뺌) */
export function allTimeStanding(env: FeatContextEnv, key: string, value: number, player: string): { above: number; tied: number; pool: number; domestic: boolean } {
  const domestic = env.domestic[player] === true;
  let above = 0;
  let tied = 0;
  let pool = 0;
  for (const [id, highs] of Object.entries(env.careerHighs)) {
    if (id === player) continue;
    if (domestic && env.domestic[id] !== true) continue;
    const v = highs[key]?.value ?? 0;
    if (v <= 0) continue;
    pool++;
    if (v > value) above++;
    else if (v === value) tied++;
  }
  return { above, tied, pool, domestic };
}

/** 이 목표를 넘은 선수가 역대 몇 명인가 (이 선수 포함) — 전체·같은 묶음 */
export function milestoneOrdinal(env: FeatContextEnv, key: string, target: number, player: string): { all: number; group: number; domestic: boolean } {
  const domestic = env.domestic[player] === true;
  let all = 0;
  let group = 0;
  for (const [id, sums] of Object.entries(env.careerSums)) {
    if ((sums[key] ?? 0) < target) continue;
    all++;
    if ((env.domestic[id] === true) === domestic) group++;
  }
  return { all, group, domestic };
}

/** 대기록 한 개 → 꼬리표 (0~2줄) */
export function featContext(env: FeatContextEnv, it: Pick<NotifItem, "date" | "player" | "feat">): string[] {
  const f = it.feat;
  if (!f || !it.player) return [];
  const out: string[] = [];
  if (f.level === "milestone") {
    const m = milestoneOrdinal(env, f.key, f.value, it.player);
    if (m.all <= FEAT_MILESTONE_MAX) {
      const group = m.domestic ? "국내 선수" : "외국 선수";
      out.push(m.group !== m.all ? `역대 ${m.all}번째 · ${group} ${m.group}번째` : `역대 ${m.all}번째`);
    }
    return out;
  }
  const unit = HIGH_UNIT[f.key];
  if (!unit) return out;
  const n = seasonOrdinal(env, f.key, f.value, it.date);
  // 시즌 최다 갱신(level league)은 "올 시즌 처음"이 이미 제목이라 순번은 2번째부터만
  if (n <= FEAT_SEASON_MAX && !(f.level === "league" && n === 1)) {
    out.push(n === 1 ? `올 시즌 리그 첫 ${unit(f.value)} 이상` : `올 시즌 ${unit(f.value)} 이상은 리그 ${n}번째`);
  }
  const a = allTimeStanding(env, f.key, f.value, it.player);
  const who = a.domestic ? "국내 선수" : "선수";
  if (a.pool > 0) {
    if (a.above === 0) out.push(a.tied === 0 ? `역대 ${who} 한 경기 최고 기록` : `역대 ${who} 한 경기 최고 타이`);
    else if (a.above <= FEAT_ALLTIME_MAX) out.push(`이보다 많이 한 ${who}는 역대 ${a.above}명뿐`);
    else {
      // 이 값 이상을 해 본 선수 비율 (이 선수 포함)
      const share = (a.above + a.tied + 1) / (a.pool + 1);
      if (share <= FEAT_TOP_SHARE) out.push(`역대 ${who} 상위 ${Math.max(1, Math.ceil(share * 100))}%만 해 본 기록`);
    }
  }
  return out;
}

/** 목록의 대기록마다 context 를 채운 새 목록 (원본은 그대로) */
export function attachFeatContexts(items: readonly NotifItem[], env: FeatContextEnv): NotifItem[] {
  return items.map((it) => {
    if (!it.feat) return it;
    const context = featContext(env, it);
    return context.length ? { ...it, feat: { ...it.feat, context } } : it;
  });
}

/** 박스스코어 있는 경기 → 선수-경기 기록 (env.performances) */
export function performancesFromGames(
  games: readonly { date: string; ended: boolean; box: { home: readonly { id: string; sec: number }[]; away: readonly { id: string; sec: number }[] } | null }[],
): FeatContextEnv["performances"] {
  const out: { date: string; player: string; stats: Record<string, number> }[] = [];
  for (const g of games) {
    if (!g.ended || !g.box) continue;
    for (const r of [...g.box.home, ...g.box.away]) {
      if (r.sec <= 0) continue;
      out.push({ date: g.date, player: r.id, stats: r as unknown as Record<string, number> });
    }
  }
  return out;
}

/** 선수 색인 → 국내 선수 여부 (국적을 모르면 isForeign 반대) */
export function domesticFromIndex(index: readonly { id: string; nationality?: string | null; isForeign?: boolean }[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const p of index) out[p.id] = p.nationality ? p.nationality === "domestic" : !p.isForeign;
  return out;
}
