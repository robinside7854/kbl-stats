"use client";
// 홈 "시상 레이스" 한 줄 카드 (2026-11-05 사용자: 기록 탭 시상 레이스 + 홈 + 선수 머리말 칩).
// 국내 MVP 1위 · 외국 선수 MVP 1위 · MIP 1위 세 사람만 — 누르면 /records/race (전체 후보·지표별 순위).
// GA4: award_race_open {place: "home"}
import Link from "next/link";
import { MVP_GROUP_LABELS, type AwardRace } from "@/lib/award-race";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import { IconChevronRight } from "./icons";
import PlayerAvatar from "./PlayerAvatar";
import { trackEvent } from "./track";

interface Leader {
  key: string;
  label: string;
  id: string;
  nameKo: string;
  photoUrl: string | null;
  teamCode: string;
  hash: string;
}

export function raceLeaders(race: AwardRace): Leader[] {
  const out: Leader[] = [];
  const d = race.mvp.domestic[0];
  const f = race.mvp.foreign[0];
  const m = race.mip[0];
  if (d) out.push({ key: "mvp_domestic", label: `MVP · ${MVP_GROUP_LABELS.domestic}`, id: d.id, nameKo: d.nameKo, photoUrl: d.photoUrl, teamCode: d.teamCode, hash: "mvp" });
  if (f) out.push({ key: "mvp_foreign", label: `MVP · ${MVP_GROUP_LABELS.foreign}`, id: f.id, nameKo: f.nameKo, photoUrl: f.photoUrl, teamCode: f.teamCode, hash: "mvp" });
  if (m) out.push({ key: "mip", label: "MIP", id: m.id, nameKo: m.nameKo, photoUrl: m.photoUrl, teamCode: m.teamCode, hash: "mip" });
  return out;
}

export default function AwardRaceStrip({ race }: { race: AwardRace }) {
  const leaders = raceLeaders(race);
  if (leaders.length === 0) return null;
  const open = () => trackEvent("award_race_open", { place: "home" });
  return (
    <section aria-labelledby="race-title" className="mx-auto mt-8 max-w-page px-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="race-title" className="text-h2 font-bold">
          시상 레이스
        </h2>
        <Link href="/records/race" onClick={open} className="link-shortcut">
          후보 전체 보기 <IconChevronRight size={16} aria-hidden />
        </Link>
      </div>
      <ul className="surface-card mt-3 grid divide-y divide-line rounded-container sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {leaders.map((l) => {
          const team = race.teams[l.teamCode] ?? { shortName: l.teamCode, logoUrl: null, color: FALLBACK_TEAM_COLOR };
          return (
            <li key={l.key} className="min-w-0">
              <Link
                href={`/records/race#${l.hash}`}
                onClick={open}
                className="focus-ring-inset flex min-h-16 items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-surface-2"
              >
                <PlayerAvatar photoUrl={l.photoUrl} nameKo={l.nameKo} color={team.color} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-caption font-semibold text-ink-3">{l.label} 1위</span>
                  <span className="block truncate text-body font-bold text-ink">
                    {l.nameKo} <span className="text-sub font-medium text-ink-3">{team.shortName}</span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
