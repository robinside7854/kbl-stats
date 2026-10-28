// 54-0 결과 공유 (2026-10-27 GA4 검토: 완주 1,951판 중 공유 0.5%) — 순수 함수만.
// 결과마다 자기 주소 /game/r/{라인업} 을 갖는다. 카카오톡·X 는 그 페이지의 미리보기 그림(/game/og/{라인업})으로
// "48승 6패 + 다섯 명" 카드를 그린다. 라인업은 ?l= 값(번호:시즌,…)을 주소 한 칸에 넣기 좋게 바꾼 것(번호-시즌_…).
import { GAME_SEASON_GAMES, resultVerdict } from "./game";

/** ?l= 값 "291085:47,290776:45,…" → 주소 칸 "291085-47_290776-45_…" (형식이 다르면 null) */
export function lineupToSlug(lineupParam: string): string | null {
  const parts = lineupParam.split(",");
  if (parts.length === 0 || !parts.every((p) => /^\d+:\d+$/.test(p))) return null;
  return parts.map((p) => p.replace(":", "-")).join("_");
}

/** 주소 칸 → ?l= 값 (형식이 다르면 null) */
export function slugToLineup(slug: string): string | null {
  const parts = slug.split("_");
  if (parts.length === 0 || !parts.every((p) => /^\d+-\d+$/.test(p))) return null;
  return parts.map((p) => p.replace("-", ":")).join(",");
}

/** 결과 페이지 주소 (사이트 안 경로) */
export const gameResultPath = (slug: string) => `/game/r/${slug}`;
/** 결과 미리보기 그림 주소 */
export const gameResultImagePath = (slug: string) => `/game/og/${slug}`;

/** 성적 한 줄 "48승 6패" */
export const recordLabel = (wins: number) => `${wins}승 ${GAME_SEASON_GAMES - wins}패`;

/** 공유할 때 같이 보내는 글 (카톡 말풍선에 그대로 들어간다) */
export function shareText(wins: number, shared = false): string {
  if (shared) return `이 54-0 라인업은 ${recordLabel(wins)}래요. 넘을 수 있어요?`;
  if (wins === GAME_SEASON_GAMES) return `54-0 전승 찍었어요. KBL 역대 라인업으로 해 보세요`;
  return `제 54-0 라인업은 ${recordLabel(wins)}예요. 이 기록 넘을 수 있어요?`;
}

/** 결과 화면 공유 권유 글 — 직접 한 판(mine)과 친구가 보낸 결과(shared)가 다르다 */
export function shareCta(wins: number, shared: boolean): { title: string; body: string } {
  if (shared) {
    return {
      title: `친구 라인업은 ${recordLabel(wins)}`,
      body: "슬롯 다섯 번이면 끝나요. 이 기록 넘어 볼래요?",
    };
  }
  if (wins === GAME_SEASON_GAMES) return { title: "전승이에요. 지금이 자랑할 때", body: "54전 전승은 정말 드물어요. 친구들한테 보여 주세요." };
  if (wins >= 48) return { title: "전승까지 거의 다 왔어요", body: "친구는 이 기록 넘을 수 있을까요? 결과를 보내 보세요." };
  if (wins >= 40) return { title: "1위 후보 라인업이에요", body: "친구한테 도전장 보내 볼까요?" };
  return { title: resultVerdict(wins), body: "친구 라인업이랑 비교해 보면 재밌어요. 결과를 보내 보세요." };
}
