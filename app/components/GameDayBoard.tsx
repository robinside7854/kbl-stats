"use client";
// 홈 "오늘의 경기" (2026-10-03 사용자 요청: 오늘 경기 기록·맞대결·선수 기록).
// 끝난 경기가 있는 가장 최근 날짜의 경기 카드(점수·팀·수훈 선수) → "선수 기록"을 누르면 그 경기 두 팀 박스스코어.
// 날짜가 브라우저의 한국 날짜와 같으면 "오늘의 경기", 아니면 "최근 경기". 다음 경기 날짜의 대진은 아래 한 줄씩.
// 데이터·계산은 lib/games (서버에서 고른 경기만 받는다). GA4: 박스스코어 열기 boxscore_open {game_key, team}.
import Link from "next/link";
import { useEffect, useState } from "react";
import type { GameBoxRow, SeasonGame, TeamColor } from "@/lib/types";
import { gameDayLabel, minutesLabel, performerLine, topPerformer, winnerSide, type GameDay } from "@/lib/games";
import { kstDateString } from "@/lib/home";
import { teamShortLabel } from "@/lib/images";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import { IconChevronDown, IconChevronUp } from "./icons";
import Segmented from "./Segmented";
import TeamLogo from "./TeamLogo";
import { trackEvent } from "./track";

export interface GameTeamInfo {
  shortName: string;
  logoUrl: string | null;
  color: TeamColor;
}

interface Props {
  day: GameDay;
  next: GameDay | null;
  seasonCode: number;
  /** 팀 코드 → 이름·로고 (이 시즌, 없으면 직전 시즌 팀표) */
  teams: Record<string, GameTeamInfo>;
}

export default function GameDayBoard({ day, next, seasonCode, teams }: Props) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(kstDateString(new Date())), []);
  const isToday = today === day.date;
  const teamOf = (code: string, fallback: string): GameTeamInfo =>
    teams[code] ?? { shortName: fallback, logoUrl: null, color: FALLBACK_TEAM_COLOR };

  return (
    <section aria-labelledby="games-title" className="mx-auto mt-6 max-w-5xl px-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="games-title" className="text-h2 font-bold">
          {isToday ? "오늘의 경기" : "최근 경기"}
        </h2>
        <p className="text-sub text-ink-3">{gameDayLabel(day.date)}</p>
      </div>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {day.games.map((g) => (
          <li key={g.gmkey}>
            <GameCard game={g} seasonCode={seasonCode} teamOf={teamOf} />
          </li>
        ))}
      </ul>
      {next && next.games.length > 0 && (
        <div className="surface-card mt-3 rounded-container p-3">
          <p className="text-sub font-bold text-ink">다음 경기 · {gameDayLabel(next.date)}</p>
          <ul className="mt-1 divide-y divide-line">
            {next.games.map((g) => {
              const away = teamOf(g.away.teamCode, g.away.name);
              const home = teamOf(g.home.teamCode, g.home.name);
              return (
                <li key={g.gmkey} className="tabular flex min-h-10 items-center gap-2 py-1.5 text-sub">
                  <span className="w-12 shrink-0 text-ink-3">{g.start ?? ""}</span>
                  <TeamLogo logoUrl={away.logoUrl} shortName={away.shortName} color={away.color} size={20} />
                  <span className="min-w-0 truncate font-semibold text-ink">{teamShortLabel(away.shortName)}</span>
                  <span className="text-ink-3">vs</span>
                  <TeamLogo logoUrl={home.logoUrl} shortName={home.shortName} color={home.color} size={20} />
                  <span className="min-w-0 truncate font-semibold text-ink">{teamShortLabel(home.shortName)}</span>
                  {g.stadium && <span className="ml-auto hidden shrink-0 text-caption text-ink-3 sm:inline">{g.stadium}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function GameCard({
  game: g,
  seasonCode,
  teamOf,
}: {
  game: SeasonGame;
  seasonCode: number;
  teamOf: (code: string, fallback: string) => GameTeamInfo;
}) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"away" | "home">("away");
  const win = winnerSide(g);
  // 원정 → 홈 순서 (공홈 표기와 같게)
  const sides = (["away", "home"] as const).map((k) => ({
    key: k,
    info: teamOf(g[k].teamCode, g[k].name),
    score: g[k].score,
    star: topPerformer(g.box?.[k]),
    won: win === k,
  }));

  return (
    <article className="surface-card tabular rounded-container p-3">
      {sides.map((s) => (
        <div key={s.key} className="flex min-h-10 items-center gap-2.5">
          <TeamLogo logoUrl={s.info.logoUrl} shortName={s.info.shortName} color={s.info.color} size={28} />
          <span className={`min-w-0 flex-1 truncate text-body ${s.won ? "font-bold text-ink" : "font-medium text-ink-2"}`}>
            {s.info.shortName}
            <span className="ml-1 text-caption font-medium text-ink-3">{s.key === "home" ? "홈" : "원정"}</span>
          </span>
          <span className={`text-h2 leading-none ${s.won ? "font-black text-ink" : "font-semibold text-ink-3"}`}>
            {g.ended ? (s.score ?? "–") : ""}
          </span>
        </div>
      ))}
      <p className="mt-1 text-caption text-ink-3">
        {[g.ended ? "종료" : g.start ? `${g.start} 시작` : "예정", g.stadium].filter(Boolean).join(" · ")}
      </p>
      {g.box && (
        <>
          <ul className="mt-2 space-y-0.5 border-t border-line pt-2 text-sub">
            {sides.map((s) =>
              s.star ? (
                <li key={s.key} className="flex min-w-0 items-baseline gap-1.5">
                  <span className="w-16 shrink-0 truncate text-caption text-ink-3">{teamShortLabel(s.info.shortName)}</span>
                  <Link
                    href={`/player/${s.star.id}?season=${seasonCode}`}
                    className="focus-ring min-w-0 truncate rounded-md font-semibold text-ink underline-offset-2 hover:underline"
                  >
                    {s.star.nameKo}
                  </Link>
                  <span className="shrink-0 text-ink-2">{performerLine(s.star)}</span>
                </li>
              ) : null,
            )}
          </ul>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => {
              if (!open) trackEvent("boxscore_open", { game_key: g.gmkey, season_code: seasonCode });
              setOpen((v) => !v);
            }}
            className="focus-ring mt-2 flex h-10 w-full items-center justify-center gap-1 rounded-control border border-line text-sub font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2"
          >
            선수 기록 {open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </button>
          {open && (
            <div className="mt-2">
              <Segmented
                label="팀 고르기"
                options={sides.map((s) => ({ value: s.key, label: s.info.shortName }))}
                value={side}
                onChange={(v) => setSide(v)}
              />
              <BoxTable rows={g.box[side]} seasonCode={seasonCode} />
            </div>
          )}
        </>
      )}
    </article>
  );
}

const COLS: { key: keyof GameBoxRow | "min" | "tp"; label: string }[] = [
  { key: "min", label: "분" },
  { key: "pts", label: "득점" },
  { key: "reb", label: "리바" },
  { key: "ast", label: "어시" },
  { key: "stl", label: "스틸" },
  { key: "blk", label: "블록" },
  { key: "tp", label: "3점" },
];

function cell(r: GameBoxRow, key: (typeof COLS)[number]["key"]): string {
  if (key === "min") return minutesLabel(r.sec);
  if (key === "tp") return `${r.tpm}/${r.tpa}`;
  return String(r[key as keyof GameBoxRow]);
}

/** 한 팀 박스스코어 (출전 시간 순). 폰 360px 에서도 가로 스크롤 없이 8열 */
function BoxTable({ rows, seasonCode }: { rows: GameBoxRow[]; seasonCode: number }) {
  const total = rows.reduce(
    (t, r) => ({ pts: t.pts + r.pts, reb: t.reb + r.reb, ast: t.ast + r.ast, stl: t.stl + r.stl, blk: t.blk + r.blk, tpm: t.tpm + r.tpm, tpa: t.tpa + r.tpa }),
    { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0, tpa: 0 },
  );
  return (
    <table className="mt-2 w-full table-fixed text-caption sm:text-sub">
      <colgroup>
        <col />
        <col className="w-[2.6rem]" />
        {COLS.slice(1).map((c) => (
          <col key={c.key} className={c.key === "tp" ? "w-[3rem]" : "w-[2.1rem] sm:w-[2.6rem]"} />
        ))}
      </colgroup>
      <thead>
        <tr className="border-b border-line text-ink-3">
          <th scope="col" className="py-1.5 text-left font-medium">선수</th>
          {COLS.map((c) => (
            <th key={c.key} scope="col" className="py-1.5 text-right font-medium">{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-line">
            <th scope="row" className="min-w-0 text-left font-semibold">
              <Link
                href={`/player/${r.id}?season=${seasonCode}`}
                className="focus-ring-inset flex h-10 min-w-0 items-center truncate rounded-md text-ink underline-offset-2 hover:underline"
              >
                <span className="truncate">{r.nameKo}</span>
              </Link>
            </th>
            {COLS.map((c) => (
              <td key={c.key} className={`text-right ${c.key === "pts" ? "font-bold text-ink" : "text-ink-2"}`}>
                {cell(r, c.key)}
              </td>
            ))}
          </tr>
        ))}
        <tr className="font-semibold text-ink">
          <th scope="row" className="py-2 text-left">합계</th>
          <td />
          <td className="text-right">{total.pts}</td>
          <td className="text-right">{total.reb}</td>
          <td className="text-right">{total.ast}</td>
          <td className="text-right">{total.stl}</td>
          <td className="text-right">{total.blk}</td>
          <td className="text-right">{`${total.tpm}/${total.tpa}`}</td>
        </tr>
      </tbody>
    </table>
  );
}
