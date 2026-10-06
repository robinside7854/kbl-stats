"use client";
// "기록" 메뉴 수상 탭 위쪽: 시즌을 골라 그 시즌 어워즈 보기 (2026-10-06 사용자 결정 — 리더보드 맨 위에 있던 시즌 어워즈를 여기로).
// 데이터는 서버가 수상 기록이 있는 시즌마다 미리 만든 묶음(lib/awards buildSeasonAwardsView). 고른 시즌은 주소 ?season= 에 남긴다.
// GA4: filter_change screen=records_awards filter=season value=시즌 코드
import { useEffect, useState } from "react";
import type { SeasonAwardsView } from "@/lib/awards";
import SeasonAwardsBoard from "./SeasonAwardsBoard";
import { trackFilters } from "./track";

export interface SeasonAwardsOption {
  seasonCode: number;
  seasonShort: string;
  view: SeasonAwardsView;
}

export default function SeasonAwardsPicker({ seasons }: { seasons: SeasonAwardsOption[] }) {
  const [code, setCode] = useState(seasons[0]?.seasonCode ?? 0);
  useEffect(() => {
    const q = Number(new URLSearchParams(window.location.search).get("season"));
    if (seasons.some((s) => s.seasonCode === q)) setCode(q);
  }, [seasons]);
  if (seasons.length === 0) return null;
  const cur = seasons.find((s) => s.seasonCode === code) ?? seasons[0];

  function pick(v: number) {
    trackFilters("records_awards", { season: v });
    setCode(v);
    const qs = new URLSearchParams(window.location.search);
    if (v === seasons[0].seasonCode) qs.delete("season");
    else qs.set("season", String(v));
    const q = qs.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
  }

  return (
    <div>
      <label className="mb-3 flex items-center gap-2 text-sub font-medium text-ink-2">
        <span className="shrink-0">시즌</span>
        <select
          aria-label="어워즈 시즌 선택"
          className="focus-ring h-10 min-w-0 cursor-pointer rounded-control border border-line bg-surface px-2 text-base text-ink"
          value={cur.seasonCode}
          onChange={(e) => pick(Number(e.target.value))}
        >
          {seasons.map((s) => (
            <option key={s.seasonCode} value={s.seasonCode}>
              {s.seasonShort}
            </option>
          ))}
        </select>
      </label>
      <SeasonAwardsBoard view={cur.view} seasonShort={cur.seasonShort} />
    </div>
  );
}
