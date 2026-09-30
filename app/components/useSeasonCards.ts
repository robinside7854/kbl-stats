"use client";
// 시즌 카드 데이터 받기 + 카드 한 장 계산 (선수 탭·선수 상세·비교 탭 공용).
// 받는 곳은 우리 사이트의 정적 파일 /cards/{시즌코드}.json (빌드 전 scripts/build-cards.ts 가 생성) —
// KBL 서버 호출이 아니므로 원칙 1·3 위반 아님. 형식 풀기는 lib/cards decodeSeasonCards, 계산은 lib/cardview.
// 첫 화면(정적 HTML)은 서버가 계산한 값(initial)으로 그리고, 시즌·범위를 바꾼 뒤에만 여기서 받아 온다.
import { useEffect, useState } from "react";
import { decodeSeasonCards, type SeasonCards, type SeasonCardsFile } from "@/lib/cards";
import { buildSeasonCardView, type CardScope, type SeasonCardView } from "@/lib/cardview";

// 시즌당 한 번만 받는다 (페이지 안에서 시즌을 오가도 다시 받지 않음)
const cache = new Map<number, Promise<SeasonCards>>();

/** 서버가 정적 HTML에 넣어 준 시즌 파일을 캐시에 미리 넣는다 (같은 시즌을 다시 받지 않게) */
export function primeSeasonCards(file: SeasonCardsFile): SeasonCards {
  const cards = decodeSeasonCards(file);
  if (!cache.has(file.seasonCode)) cache.set(file.seasonCode, Promise.resolve(cards));
  return cards;
}

export function loadSeasonCards(seasonCode: number): Promise<SeasonCards> {
  let p = cache.get(seasonCode);
  if (!p) {
    p = fetch(`/cards/${seasonCode}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<SeasonCardsFile>;
      })
      .then(decodeSeasonCards)
      .catch((e) => {
        cache.delete(seasonCode); // 실패하면 다음에 다시 시도
        throw e;
      });
    cache.set(seasonCode, p);
  }
  return p;
}

export type LoadStatus = "ready" | "loading" | "error" | "missing";

/**
 * 시즌 카드 데이터 받기. code 가 null 이면 아무것도 하지 않는다.
 * 받는 동안 이전 시즌 데이터를 그대로 돌려준다(화면이 비지 않게) — status 로 "불러오는 중"을 표시한다.
 */
export function useSeasonCards(code: number | null, initial?: SeasonCards | null) {
  const [state, setState] = useState<{ code: number | null; cards: SeasonCards | null; status: LoadStatus }>(() => ({
    code: initial ? initial.seasonCode : null,
    cards: initial ?? null,
    status: initial ? "ready" : "loading",
  }));
  useEffect(() => {
    if (code === null) return;
    if (state.code === code && state.status === "ready") return;
    let alive = true;
    setState((s) => ({ ...s, status: "loading" }));
    loadSeasonCards(code)
      .then((cards) => alive && setState({ code, cards, status: "ready" }))
      .catch(() => alive && setState((s) => ({ ...s, status: "error" })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);
  return state;
}

/**
 * 한 선수·한 시즌·한 범위의 카드. initial(서버 계산값)과 같은 조건이면 받지 않고 그대로 쓴다.
 * 받는 동안에는 이전 카드를 돌려주고 status = "loading". 그 시즌에 없는 선수면 view = null, status = "missing".
 */
export function useCardView(
  playerId: string | null,
  seasonCode: number | null,
  scope: CardScope,
  initial?: SeasonCardView | null,
): { view: SeasonCardView | null; status: LoadStatus } {
  const isInitial = (id: string | null, code: number | null, sc: CardScope) =>
    !!initial && initial.entry.player.id === id && initial.seasonCode === code && initial.scope === sc;
  const [state, setState] = useState<{ key: string; view: SeasonCardView | null; status: LoadStatus }>(() => ({
    key: `${playerId}:${seasonCode}:${scope}`,
    view: isInitial(playerId, seasonCode, scope) ? initial! : null,
    status: isInitial(playerId, seasonCode, scope) ? "ready" : playerId && seasonCode !== null ? "loading" : "missing",
  }));
  useEffect(() => {
    const key = `${playerId}:${seasonCode}:${scope}`;
    if (!playerId || seasonCode === null) {
      setState({ key, view: null, status: "missing" });
      return;
    }
    if (isInitial(playerId, seasonCode, scope)) {
      setState({ key, view: initial!, status: "ready" });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, key, status: "loading" }));
    loadSeasonCards(seasonCode)
      .then((cards) => {
        if (!alive) return;
        const view = buildSeasonCardView(cards, playerId, scope);
        setState({ key, view, status: view ? "ready" : "missing" });
      })
      .catch(() => alive && setState((s) => ({ ...s, key, status: "error" })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, seasonCode, scope]);
  return { view: state.view, status: state.status };
}
