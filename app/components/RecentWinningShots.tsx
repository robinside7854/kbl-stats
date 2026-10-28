"use client";
// 기록 탭 "클러치" 아래 위닝샷 목록 (2026-10-28): 사진·이름·위닝샷/버저비터·구분(플레이오프·챔프전)·상대·상황.
// 위 순위의 구분·기간을 따라간다 — 처음 목록(정규시즌 통산)만 페이지에 들어 있고, 다른 목록은 /records/data/winning/{키}.json(빌드 때 정적 파일).
// 정규시즌은 누르면 그날 경기 일정, 플레이오프는 일정 화면이 없어 KBL 공홈 경기 기록으로.
// GA4: game_link_click {game_key, place:"records_clutch"} · official_link_click {place:"records_clutch", game_key}
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ClutchShotRow } from "@/lib/data";
import { scheduleDayHref } from "@/lib/games";
import { officialGameUrl } from "@/lib/official";
import { recordListSlug } from "@/lib/records";
import { IconExternal } from "./icons";
import PlayerAvatar from "./PlayerAvatar";
import Skeleton from "./Skeleton";
import TeamLogo from "./TeamLogo";
import { trackEvent } from "./track";

export type WinningShotRow = ClutchShotRow & { id: string; nameKo: string; photoUrl: string | null; color: string };

export const winningShotsUrl = (listKey: string) => `/records/data/winning/${recordListSlug(listKey)}.json`;
export const STAGE_LABEL: Record<ClutchShotRow["stage"], string> = { regular: "정규시즌", playoff: "플레이오프", finals: "챔프전" };

const dotDate = (d: string) => `${d.slice(2, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`;

export default function RecentWinningShots({ listKey, initial, title }: { listKey: string; initial: WinningShotRow[] | null; title: string }) {
  const [rows, setRows] = useState<WinningShotRow[] | null | "failed">(initial);
  useEffect(() => {
    if (initial) return;
    let alive = true;
    fetch(winningShotsUrl(listKey))
      .then((r) => (r.ok ? (r.json() as Promise<WinningShotRow[]>) : null))
      .catch(() => null)
      .then((got) => alive && setRows(got ?? "failed"));
    return () => {
      alive = false;
    };
  }, [listKey, initial]);

  return (
    <section aria-labelledby="recent-winning-title" className="mt-8">
      <h2 id="recent-winning-title" className="text-h2 font-bold">
        {title}
      </h2>
      {rows === null ? (
        <div className="surface-card mt-3 rounded-container p-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="my-2 h-12 w-full" />
          ))}
        </div>
      ) : rows === "failed" || rows.length === 0 ? (
        <p className="surface-card mt-3 rounded-container px-4 py-8 text-center text-body text-ink-2">
          {rows === "failed" ? "목록을 불러오지 못했어요." : "이 기간에는 위닝샷이 없어요."}
        </p>
      ) : (
        <ul className="surface-card tabular mt-3 divide-y divide-line rounded-container">
          {rows.map((r) => {
            const body = (
              <>
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
                    {r.stage !== "regular" && <span className="shrink-0 text-caption font-semibold text-ink-2">{STAGE_LABEL[r.stage]}</span>}
                    <span className="ml-auto shrink-0 pl-1 text-caption text-ink-3">{dotDate(r.date)}</span>
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-ink-2">
                    <span className="shrink-0 text-ink-3">{r.home ? "vs" : "@"}</span>
                    <TeamLogo logoUrl={r.opp.logoUrl} shortName={r.opp.shortName} color={r.opp.color} size={16} />
                    <span className="shrink-0">{r.opp.shortName}</span>
                    <span className="min-w-0 truncate">· {r.line}</span>
                  </span>
                </span>
              </>
            );
            const cls = "focus-ring-inset flex min-h-14 items-center gap-3 px-3 py-2 transition-colors duration-200 hover:bg-surface-2";
            return (
              <li key={r.gmkey}>
                {r.stage === "regular" ? (
                  <Link href={scheduleDayHref(r.seasonCode, r.date)} onClick={() => trackEvent("game_link_click", { game_key: r.gmkey, place: "records_clutch" })} className={cls}>
                    {body}
                  </Link>
                ) : (
                  <a
                    href={officialGameUrl(r.gmkey)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent("official_link_click", { place: "records_clutch", game_key: r.gmkey })}
                    className={cls}
                  >
                    {body}
                    <IconExternal size={16} className="shrink-0 text-ink-3" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
