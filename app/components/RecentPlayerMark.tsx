"use client";
// 선수 상세를 열면 "최근 본 선수"에 넣는다 (화면에는 아무것도 그리지 않음). 저장은 recent-players.ts
import { useEffect } from "react";
import { addRecentPlayer } from "./recent-players";

export default function RecentPlayerMark({ playerId }: { playerId: string }) {
  useEffect(() => addRecentPlayer(playerId), [playerId]);
  return null;
}
