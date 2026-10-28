"use client";
// 선수 상세 "클러치" (2026-10-28 사용자 기준 — lib/clutch): 통산 위닝샷·버저비터·클러치 득점·클러치 야투 4칸
// → 위닝샷 목록(날짜·상대·상황, 누르면 그날 일정) → 시즌별 클러치 기록(처음 5시즌 + 더 보기).
// 2026-10-28: 정규시즌 / 플레이오프(6강~챔프전) 전환 — 둘 다 있을 때만 보인다. 플레이오프 위닝샷은 일정 화면이 없어 KBL 공홈 경기 기록으로.
// 재료는 문자중계(2006-07 이후)라 그 전 시즌만 뛴 선수는 이 섹션이 없다. 계산은 빌드 때 lib/data loadPlayerClutch.
// GA4: game_link_click {game_key, place:"player_winning"} · official_link_click {place:"player_winning", game_key} · filter_change screen=player filter=clutch value=more·regular·playoff · ⓘ help_open topic=clutch·winningShot
import Link from "next/link";
import { useState } from "react";
import { clutchFgPct } from "@/lib/clutch";
import type { ClutchShotRow, PlayerClutchView } from "@/lib/data";
import { scheduleDayHref } from "@/lib/games";
import { officialGameUrl } from "@/lib/official";
import { IconChevronDown, IconExternal } from "./icons";
import { STAGE_LABEL } from "./RecentWinningShots";
import Segmented from "./Segmented";
import InfoLink from "./InfoLink";
import { ResultTag } from "./StreakText";
import TeamLogo from "./TeamLogo";
import { trackEvent, trackFilters } from "./track";

const SEASONS_VISIBLE = 5;

const pct = (v: number | null) => (v === null ? "–" : `${v.toFixed(1)}%`);
const dotDate = (d: string) => `${d.slice(2, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`;

export default function PlayerClutch({ data: view }: { data: PlayerClutchView }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"regular" | "playoff">(view.regular ? "regular" : "playoff");
  const data = view[stage] ?? view.regular ?? view.playoff!;
  const c = data.career;
  const seasons = open ? data.seasons : data.seasons.slice(0, SEASONS_VISIBLE);
  const tiles = [
    { label: "위닝샷", value: `${c.winning}`, unit: "회", sub: c.buzzer > 0 ? `버저비터 ${c.buzzer}회` : null },
    { label: "클러치 득점", value: `${c.pts}`, unit: "점", sub: `${c.games}경기` },
    { label: "클러치 야투", value: `${c.fgm}/${c.fga}`, unit: "", sub: pct(clutchFgPct(c)) },
    { label: "클러치 자유투", value: `${c.ftm}/${c.fta}`, unit: "", sub: pct(c.fta > 0 ? (c.ftm / c.fta) * 100 : null) },
  ];

  return (
    <section aria-labelledby="clutch-title" className="surface-card rounded-container p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="clutch-title" className="flex items-center gap-1 text-h2 font-bold">
          클러치 <InfoLink term="clutch" />
        </h2>
        {view.regular && view.playoff ? (
          <Segmented
            label="경기 구분"
            options={[
              { value: "regular", label: "정규시즌" },
              { value: "playoff", label: "플레이오프" },
            ]}
            value={stage}
            onChange={(v) => {
              trackFilters("player", { clutch: v });
              setStage(v);
              setOpen(false);
            }}
          />
        ) : (
          <p className="text-sub text-ink-3">{view.regular ? "정규시즌" : "플레이오프"} 통산</p>
        )}
      </div>
      <dl className="tabular mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-card bg-surface-2 px-3 py-2.5">
            <dt className="text-caption text-ink-3">{t.label}</dt>
            <dd className="mt-0.5">
              {/* deslop-ignore-next-line 11 */}
              <span className="text-xl font-bold leading-tight text-ink">{t.value}</span>
              {t.unit && <span className="ml-0.5 text-caption text-ink-3">{t.unit}</span>}
              {t.sub && <span className="block text-caption text-ink-2">{t.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>

      {data.shots.length > 0 && (
        <>
          <h3 className="mt-5 flex items-center gap-1 text-body font-bold text-ink">
            위닝샷 <InfoLink term="winningShot" />
          </h3>
          <ul className="tabular mt-1 divide-y divide-line">
            {data.shots.map((s) => (
              <li key={s.gmkey}>
                <ShotLink s={s}>
                  <span className="w-16 shrink-0 text-caption text-ink-3">{dotDate(s.date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5 text-sub">
                      <span
                        className={`shrink-0 rounded-sm border px-1 text-caption font-bold leading-[1.15rem] ${
                          s.buzzer ? "border-[var(--gold-ink)] text-[var(--gold-ink)]" : "border-line text-ink-2"
                        }`}
                      >
                        {s.label}
                      </span>
                      <span className="w-3 shrink-0 text-caption text-ink-3" aria-label={s.home ? "홈" : "원정"}>
                        {s.home ? "vs" : "@"}
                      </span>
                      <TeamLogo logoUrl={s.opp.logoUrl} shortName={s.opp.shortName} color={s.opp.color} size={18} />
                      <span className="min-w-0 truncate text-ink">{s.opp.shortName}</span>
                      <span className="ml-auto shrink-0 whitespace-nowrap pl-1">
                        <ResultTag win /> <span className="text-ink-2">{s.teamScore}-{s.oppScore}</span>
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-caption text-ink-2">
                      {s.stage !== "regular" && <span className="font-semibold text-ink">{STAGE_LABEL[s.stage]} · </span>}
                      {s.line}
                    </span>
                  </span>
                </ShotLink>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="mt-5 text-body font-bold text-ink">시즌별</h3>
      <table className="tabular mt-1 w-full table-fixed text-sub lg:max-w-3xl">
        <colgroup>
          <col className="w-[3.25rem]" />
          <col />
          <col />
          <col className="hidden sm:table-column" />
          <col />
          <col className="w-[3.5rem]" />
        </colgroup>
        <thead>
          <tr className="border-b border-line text-caption text-ink-3">
            <th scope="col" className="py-2 text-left font-medium">시즌</th>
            <th scope="col" className="text-right font-medium">득점</th>
            <th scope="col" className="text-right font-medium">야투</th>
            <th scope="col" className="hidden text-right font-medium sm:table-cell">3점</th>
            <th scope="col" className="text-right font-medium">자유투</th>
            <th scope="col" className="text-right font-medium">위닝샷</th>
          </tr>
        </thead>
        <tbody>
          {seasons.map((s) => (
            <tr key={s.seasonCode} className="border-b border-line">
              <th scope="row" className="py-2.5 text-left font-semibold text-ink">{s.seasonShort}</th>
              <td className="text-right font-bold text-ink">{s.totals.pts}</td>
              <td className="text-right text-ink-2">{`${s.totals.fgm}/${s.totals.fga}`}</td>
              <td className="hidden text-right text-ink-2 sm:table-cell">{`${s.totals.tpm}/${s.totals.tpa}`}</td>
              <td className="text-right text-ink-2">{`${s.totals.ftm}/${s.totals.fta}`}</td>
              <td className={`text-right ${s.totals.winning > 0 ? "font-bold text-ink" : "text-ink-3"}`}>{s.totals.winning}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!open && data.seasons.length > SEASONS_VISIBLE && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            trackFilters("player", { clutch: "more" });
          }}
          className="focus-ring mt-2 flex h-10 w-full items-center justify-center gap-1 rounded-control border border-line text-sub font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2"
        >
          {data.seasons.length - SEASONS_VISIBLE}시즌 더 보기 <IconChevronDown size={16} />
        </button>
      )}
    </section>
  );
}

/** 위닝샷 한 줄 링크: 정규시즌 = 그날 일정, 플레이오프 = KBL 공홈 경기 기록(새 창) */
function ShotLink({ s, children }: { s: ClutchShotRow; children: React.ReactNode }) {
  const cls = "focus-ring-inset flex min-h-12 items-center gap-2.5 py-2 transition-colors duration-200 hover:bg-surface-2";
  if (s.stage === "regular")
    return (
      <Link href={scheduleDayHref(s.seasonCode, s.date)} onClick={() => trackEvent("game_link_click", { game_key: s.gmkey, place: "player_winning" })} className={cls}>
        {children}
      </Link>
    );
  return (
    <a
      href={officialGameUrl(s.gmkey)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("official_link_click", { place: "player_winning", game_key: s.gmkey })}
      className={cls}
    >
      {children}
      <IconExternal size={16} className="shrink-0 text-ink-3" />
    </a>
  );
}
