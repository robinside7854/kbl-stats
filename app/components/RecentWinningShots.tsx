"use client";
// 기록 탭 "클러치" 아래 최근 위닝샷 목록 (2026-10-28): 사진·이름·위닝샷/버저비터·상대·상황 → 누르면 그날 경기 일정.
// GA4: game_link_click {game_key, place:"records_clutch"}
import Link from "next/link";
import type { ClutchShotRow } from "@/lib/data";
import { scheduleDayHref } from "@/lib/games";
import PlayerAvatar from "./PlayerAvatar";
import TeamLogo from "./TeamLogo";
import { trackEvent } from "./track";

type Row = ClutchShotRow & { id: string; nameKo: string; photoUrl: string | null; color: string };

const dotDate = (d: string) => `${d.slice(2, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`;

export default function RecentWinningShots({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="recent-winning-title" className="mt-8">
      <h2 id="recent-winning-title" className="text-h2 font-bold">
        최근 위닝샷
      </h2>
      <ul className="surface-card tabular mt-3 divide-y divide-line rounded-container">
        {rows.map((r) => (
          <li key={r.gmkey}>
            <Link
              href={scheduleDayHref(r.seasonCode, r.date)}
              onClick={() => trackEvent("game_link_click", { game_key: r.gmkey, place: "records_clutch" })}
              className="focus-ring-inset flex min-h-14 items-center gap-3 px-3 py-2 transition-colors duration-200 hover:bg-surface-2"
            >
              <PlayerAvatar photoUrl={r.photoUrl} nameKo={r.nameKo} color={{ primary: r.color, secondary: r.color, text: "#ffffff" }} size={36} />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5 text-sub">
                  <span className="shrink-0 font-semibold text-ink">{r.nameKo}</span>
                  <span
                    className={`shrink-0 rounded-sm border px-1 text-caption font-bold leading-[1.15rem] ${
                      r.buzzer ? "border-[var(--gold-ink)] text-[var(--gold-ink)]" : "border-line text-ink-2"
                    }`}
                  >
                    {r.label}
                  </span>
                  <span className="ml-auto shrink-0 pl-1 text-caption text-ink-3">{dotDate(r.date)}</span>
                </span>
                <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-ink-2">
                  <span className="shrink-0 text-ink-3">{r.home ? "vs" : "@"}</span>
                  <TeamLogo logoUrl={r.opp.logoUrl} shortName={r.opp.shortName} color={r.opp.color} size={16} />
                  <span className="shrink-0">{r.opp.shortName}</span>
                  <span className="min-w-0 truncate">· {r.line}</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
