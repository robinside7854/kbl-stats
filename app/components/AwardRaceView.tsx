"use client";
// 기록 탭 "시상 레이스" (/records/race, 2026-11-05 사용자): 이번 시즌 MVP 후보(국내 선수(아시아쿼터 포함) / 외국 선수 각 3명) + MIP 후보(전체 3명).
// 규칙은 lib/award-race (지난 11시즌 실제 MVP 기록으로 잡은 기준: 팀 6위 이내·출전·기록 합·종합 점수 하한, MVP 점수 = 개인 30% + 팀 승률 40% + 기록 합 30%
// / MIP 지난 시즌 C 이하 → 이번 시즌 B 이상 + 최근 3시즌 평균 C 이하 + 볼륨·효율·출전 시간 상승),
// 재료는 lib/data loadAwardRace — 기록을 받을 때마다 다시 계산된다. 설명은 ⓘ(NoteInfo) 안에만.
// GA4: award_race_click {kind: mvp_domestic·mvp_foreign·mip, player_no} — 후보 이름·사진을 눌러 선수 페이지로
import Link from "next/link";
import { MIP_HISTORY_SEASONS, MIP_MIN_SCORE_GAIN, MVP_GROUP_LABELS, MVP_GROUP_RULES, MVP_GROUPS, MVP_MIN_GAMES_SHARE, MVP_PROD_RANK_MAX, MVP_TEAM_RANK_MAX, MVP_WEIGHTS, type AwardRace, type MipCandidate, type MipLine, type MvpCandidate, type MvpGroup } from "@/lib/award-race";
import { seasonShortLabel } from "@/lib/career";
import { playerHref } from "@/lib/cardview";
import { NATIONALITY_LABELS, positionLabel } from "@/lib/roster";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import { TeamLink } from "./EntityLinks";
import GradeChip from "./GameGradeChip";
import { IconArrowRight } from "./icons";
import NoteInfo from "./NoteInfo";
import PlayerAvatar from "./PlayerAvatar";
import TeamLogo from "./TeamLogo";
import { trackEvent } from "./track";
import { useThemeColors, type ThemeColors } from "./useThemeColors";

const pct = (v: number) => Math.round(v * 100);

const { domestic: DR, foreign: FR } = MVP_GROUP_RULES;
const MVP_NOTE =
  `지난 11시즌 실제 MVP들의 기록을 보고 정한 기준이에요. 팀이 지금 ${MVP_TEAM_RANK_MAX}위 이내, 팀 경기의 ${Math.round(MVP_MIN_GAMES_SHARE * 3)}/3 이상 출전, ` +
  `기록 합(경기당 득점+리바운드+어시스트+스틸+블록)이 같은 묶음 ${MVP_PROD_RANK_MAX}위 안. ` +
  `국내 선수는 경기당 ${DR.minMpg}분·종합 ${DR.minOverall}점 이상, 외국 선수는 ${FR.minMpg}분·${FR.minOverall}점 이상이어야 해요. ` +
  `MVP 점수 = 개인 종합 점수 ${pct(MVP_WEIGHTS.overall)}% + 팀 승률 ${pct(MVP_WEIGHTS.team)}% + 기록 합 순위 ${pct(MVP_WEIGHTS.prod)}%. ` +
  "아시아쿼터 선수는 국내 선수로 쳐요. KBL 공식 시상 기준이 아닌 우리 규칙이에요.";

const MIP_NOTE =
  `지난 시즌 종합 C 이하였다가 이번 시즌 B 이상으로 올라온 선수예요. 최근 ${MIP_HISTORY_SEASONS}시즌 평균도 C 이하여야 해서, 원래 잘하던 선수가 반등한 경우는 빠져요. ` +
  `출전 시간·경기당 득점+리바운드+어시스트·TS%·PER 도 모두 오르고 종합 점수가 ${MIP_MIN_SCORE_GAIN}점 이상 올라야 해요. 오른 폭이 큰 순서, 팀 성적은 보지 않아요. KBL 공식 시상 기준이 아닌 우리 규칙이에요.`;

export default function AwardRaceView({ race }: { race: AwardRace }) {
  const colors = useThemeColors();
  const teamOf = (code: string) => race.teams[code] ?? { shortName: code, logoUrl: null, color: FALLBACK_TEAM_COLOR };
  return (
    <div className="space-y-8 pb-4">
      <p className="text-sub text-ink-3">
        {seasonShortLabel(race.seasonLabel)} 정규시즌 · 팀당 {race.teamGames}경기 기준 · 기록이 들어올 때마다 바뀌어요
      </p>

      <section id="mvp" aria-labelledby="mvp-title" className="scroll-mt-20">
        <h2 id="mvp-title" className="flex items-center gap-1 text-h2 font-bold">
          MVP 레이스 <NoteInfo title="MVP 후보 기준" text={MVP_NOTE} />
        </h2>
        <div className="mt-3 grid gap-4 xl:grid-cols-2">
          {MVP_GROUPS.map((g) => (
            <div key={g} className="min-w-0">
              <h3 className="text-body font-bold text-ink-2">{MVP_GROUP_LABELS[g]}</h3>
              {race.mvp[g].length === 0 ? (
                <p className="surface-card mt-2 rounded-container p-4 text-sub text-ink-3">아직 조건을 채운 선수가 없어요</p>
              ) : (
                <ol className="mt-2 space-y-3">
                  {race.mvp[g].map((c) => (
                    <MvpCard key={c.id} c={c} group={g} team={teamOf(c.teamCode)} seasonCode={race.seasonCode} colors={colors} />
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </section>

      <section id="mip" aria-labelledby="mip-title" className="scroll-mt-20">
        <h2 id="mip-title" className="flex items-center gap-1 text-h2 font-bold">
          MIP 레이스 <NoteInfo title="MIP 후보 기준" text={MIP_NOTE} />
        </h2>
        <p className="mt-0.5 text-sub text-ink-3">
          {seasonShortLabel(race.prevSeasonLabel)} 대비 {seasonShortLabel(race.seasonLabel)}
        </p>
        {race.mip.length === 0 ? (
          <p className="surface-card mt-3 rounded-container p-4 text-sub text-ink-3">아직 조건을 채운 선수가 없어요</p>
        ) : (
          <ol className="mt-3 grid gap-3 lg:grid-cols-3">
            {race.mip.map((m) => (
              <MipCard key={m.id} m={m} team={teamOf(m.teamCode)} seasonCode={race.seasonCode} colors={colors} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

type TeamBrand = AwardRace["teams"][string];
type Colors = ThemeColors;

/** 사진 + 이름 (누르면 선수 페이지) */
function PlayerHead({ id, nameKo, photoUrl, team, seasonCode, kind, children }: { id: string; nameKo: string; photoUrl: string | null; team: TeamBrand; seasonCode: number; kind: string; children: React.ReactNode }) {
  const href = playerHref(id, seasonCode);
  const click = () => trackEvent("award_race_click", { kind, player_no: id });
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link href={href} onClick={click} tabIndex={-1} aria-hidden className="shrink-0">
        <PlayerAvatar photoUrl={photoUrl} nameKo={nameKo} color={team.color} size={56} />
      </Link>
      <div className="min-w-0">
        <Link href={href} onClick={click} className="focus-ring rounded-md text-body font-bold text-ink underline-offset-2 hover:underline">
          {nameKo}
        </Link>
        {children}
      </div>
    </div>
  );
}

function TeamBadge({ code, team, seasonCode, rank, wins, losses }: { code: string; team: TeamBrand; seasonCode: number; rank?: number; wins?: number; losses?: number }) {
  return (
    <TeamLink code={code} season={seasonCode} place="award_race" className="inline-flex items-center gap-1 text-sub text-ink-2">
      <TeamLogo logoUrl={team.logoUrl} shortName={team.shortName} color={team.color} size={18} />
      <span className="whitespace-nowrap">{team.shortName}</span>
      {rank !== undefined && (
        <span className="tabular whitespace-nowrap text-ink-3">
          · {rank}위 {wins}승 {losses}패
        </span>
      )}
    </TeamLink>
  );
}

function MvpCard({ c, group, team, seasonCode, colors }: { c: MvpCandidate; group: MvpGroup; team: TeamBrand; seasonCode: number; colors: Colors }) {
  const pos = positionLabel(c.position);
  return (
    <li className="surface-card rounded-container p-4">
      <div className="flex items-start gap-3">
        <span className="tabular w-6 shrink-0 pt-1 text-h2 font-black text-ink">{c.rank}</span>
        <div className="min-w-0 flex-1">
          <PlayerHead id={c.id} nameKo={c.nameKo} photoUrl={c.photoUrl} team={team} seasonCode={seasonCode} kind={`mvp_${group}`}>
            <div>
              <TeamBadge code={c.teamCode} team={team} seasonCode={seasonCode} rank={c.team.rank} wins={c.team.wins} losses={c.team.losses} />
            </div>
            <p className="tabular mt-0.5 flex flex-wrap items-center gap-x-1.5 text-caption text-ink-3">
              <GradeChip score={c.score} color={team.color} colors={colors} />
              <span>종합 {c.score}점</span>
              {pos && c.posRank && (
                <span className="whitespace-nowrap">
                  · {pos} {c.posRank.rank}위/{c.posRank.of}
                </span>
              )}
              {c.nationality === "asia" && <span className="whitespace-nowrap">· {NATIONALITY_LABELS.asia}</span>}
            </p>
          </PlayerHead>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-caption text-ink-3">MVP 점수</p>
          <p className="tabular text-h2 font-black text-ink">{c.mvpScore.toFixed(1)}</p>
        </div>
      </div>
      <dl className="tabular mt-3 grid grid-cols-3 gap-x-2 gap-y-2.5 border-t border-line pt-3 sm:grid-cols-9">
        {c.stats.map((s) => {
          const top = s.rank !== null && s.rank <= 3;
          return (
            <div key={s.key} className="min-w-0">
              <dt className="truncate text-caption text-ink-3">{s.label === "3점 성공률" ? "3점%" : s.label === "야투율" ? "야투%" : s.label}</dt>
              <dd className="text-sub font-semibold text-ink">{s.text}</dd>
              <dd className={`whitespace-nowrap text-caption ${top ? "font-bold text-ink" : "text-ink-3"}`}>{s.rank !== null ? `${s.rank}위` : "–"}</dd>
            </div>
          );
        })}
      </dl>
      <p className="tabular mt-2 text-caption text-ink-3">
        {c.games}경기 출전 · 팀 {c.teamGames}경기 · 순위는 {MVP_GROUP_LABELS[group]} 중
      </p>
    </li>
  );
}

const MIP_ROWS: { label: string; get: (l: MipLine) => number; unit?: string; pct?: boolean }[] = [
  { label: "출전", get: (l) => l.mpg, unit: "분" },
  { label: "득점", get: (l) => l.ppg },
  { label: "리바운드", get: (l) => l.rpg },
  { label: "어시스트", get: (l) => l.apg },
  { label: "TS%", get: (l) => l.tsPct, pct: true },
  { label: "PER", get: (l) => l.per },
];

function MipCard({ m, team, seasonCode, colors }: { m: MipCandidate; team: TeamBrand; seasonCode: number; colors: Colors }) {
  return (
    <li className="surface-card rounded-container p-4">
      <div className="flex items-start gap-3">
        <span className="tabular w-6 shrink-0 pt-1 text-h2 font-black text-ink">{m.rank}</span>
        <div className="min-w-0 flex-1">
          <PlayerHead id={m.id} nameKo={m.nameKo} photoUrl={m.photoUrl} team={team} seasonCode={seasonCode} kind="mip">
            <div>
              <TeamBadge code={m.teamCode} team={team} seasonCode={seasonCode} />
            </div>
            <p className="tabular mt-1 flex flex-wrap items-center gap-1.5 text-caption text-ink-3">
              <GradeChip score={m.prev.score} color={team.color} colors={colors} />
              <span>{m.prev.score}</span>
              <IconArrowRight size={16} aria-hidden />
              <span className="sr-only">에서</span>
              <GradeChip score={m.cur.score} color={team.color} colors={colors} />
              <span className="font-semibold text-ink">{m.cur.score}</span>
            </p>
          </PlayerHead>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-caption text-ink-3">종합 점수</p>
          <p className="tabular text-h2 font-black text-ink">+{m.gain.toFixed(0)}</p>
        </div>
      </div>
      <dl className="tabular mt-3 space-y-1 border-t border-line pt-3 text-sub">
        {MIP_ROWS.map((r) => {
          const a = r.get(m.prev);
          const b = r.get(m.cur);
          const fmt = (v: number) => `${v.toFixed(1)}${r.pct ? "%" : r.unit ?? ""}`;
          return (
            <div key={r.label} className="flex items-baseline justify-between gap-2">
              <dt className="text-ink-3">{r.label}</dt>
              <dd className="whitespace-nowrap text-ink-2">
                {fmt(a)} <IconArrowRight size={16} aria-hidden className="inline align-[-3px]" />
                <span className="sr-only">에서</span> <span className="font-semibold text-ink">{fmt(b)}</span>
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="tabular mt-2 text-caption text-ink-3">
        지난 시즌 {m.prev.games}경기 · 올 시즌 {m.cur.games}경기 · 최근 {m.recent.seasons}시즌 평균 {m.recent.score}점
      </p>
    </li>
  );
}
