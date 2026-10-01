// 선수 페이지 머리말 (PLAN.md §2-2 ①, §5-4): 최근 시즌 팀 색 배경 + 큰 세로 사진 + 로고 + 이름·소속·활동 기간,
// 이름 아래 국적 배지(국내/외국/아시아쿼터)·활동 기간, 프로필 한 줄(포지션·키·몸무게·등번호·드래프트 — 선수 마스터,
// 나이·국적(국가명)·출신교 — 서버 B 프로필, 없으면 뺌),
// 이름 아래 칭호 배지 줄(lib/badges, 최대 5개 + "+n"), 그 아래 통산 요약 8칸(모바일 4×2, PC 8×1)과 소속 팀 이력. 계산은 lib/metrics careerSummary, 표기는 lib/career.
// 머리말 팀 색은 가장 최근 시즌 팀 (카드 영역은 고른 시즌 팀 색을 따로 쓴다).
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import type { CareerSeason, PlayerIndexEntry, TeamColor } from "@/lib/types";
import { careerSummary } from "@/lib/metrics";
import { activeSpanLabel, personalFacts, profileFacts, seasonShortLabel, teamStints } from "@/lib/career";
import { nationalityOf, NATIONALITY_LABELS } from "@/lib/roster";
import { mixHex, teamShortLabel } from "@/lib/images";
import PlayerAvatar from "./PlayerAvatar";
import FavoriteButton from "./FavoriteButton";
import TeamLogo from "./TeamLogo";
import BadgeRow, { type BadgeItem } from "./BadgeRow";

const FALLBACK: TeamColor = FALLBACK_TEAM_COLOR;
const NF1 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NF0 = new Intl.NumberFormat("ko-KR");
const pctText = (v: number | null) => (v === null ? "–" : NF1.format(v));

interface Props {
  entry: PlayerIndexEntry;
  /** 시즌 오름차순 */
  seasons: CareerSeason[];
  /** 만 나이 기준일 "YYYY-MM-DD" (빌드 시각, 한국 시간 — 페이지가 넘긴다) */
  today: string;
  /** 칭호 배지 (우선순위 순, 빌드 시점 lib/badges playerBadges) */
  badges: BadgeItem[];
}

export default function PlayerHero({ entry, seasons, today, badges }: Props) {
  const latest = seasons[seasons.length - 1];
  const first = seasons[0];
  const team = latest?.team ?? null;
  const color = team?.color ?? FALLBACK;
  const teamName = team?.shortName ?? latest?.teamShort ?? "";
  const dark = mixHex(color.primary, "#000000", 0.62);
  const mid = mixHex(color.primary, "#000000", 0.3);
  const sum = careerSummary(seasons);
  const span = first && latest ? activeSpanLabel(first.seasonLabel, latest.seasonLabel, seasons.length) : "";
  const stints = teamStints(seasons);
  const facts = [...profileFacts(entry), ...personalFacts(entry, today)];
  // 통산 타일 8칸: 경기 · 경기당 득점·리바운드·어시스트·스틸·블록 · 통산 야투%·3점%(성공 합계 ÷ 시도 합계). 계산은 careerSummary
  const tiles = [
    { label: "통산 경기", value: NF0.format(sum.games), perGame: false, sub: `${NF0.format(sum.wins)}승 ${NF0.format(sum.losses)}패` },
    { label: "득점", value: NF1.format(sum.points), perGame: true },
    { label: "리바운드", value: NF1.format(sum.reb), perGame: true },
    { label: "어시스트", value: NF1.format(sum.ast), perGame: true },
    { label: "스틸", value: NF1.format(sum.stl), perGame: true },
    { label: "블록", value: NF1.format(sum.blk), perGame: true },
    { label: "야투%", value: pctText(sum.fgPct), perGame: false },
    { label: "3점%", value: pctText(sum.tpPct), perGame: false },
  ];

  return (
    <section aria-label={`${entry.nameKo} 선수 소개`}>
      {/* ── 팀 색 띠 + 사진 ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${color.primary} 0%, ${mid} 55%, ${dark} 100%)`, color: color.text }}
      >
        {/* 장식: 최근 팀 약칭 큰 글씨 */}
        <span
          aria-hidden
          // deslop-ignore-next-line 11
          className="pointer-events-none absolute -right-3 top-2 select-none whitespace-nowrap text-[7.5rem] font-black leading-none tracking-tighter opacity-10 sm:text-[11rem]"
        >
          {teamShortLabel(teamName, 5)}
        </span>
        <div className="relative mx-auto flex min-h-[250px] max-w-5xl items-end px-4 sm:min-h-[300px]">
          <div className="relative z-10 min-w-0 flex-1 pb-5 pt-5 pr-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-control bg-white p-1 shadow-card">
                <TeamLogo logoUrl={team?.logoUrl} shortName={teamName} color={color} size={40} />
              </span>
              <span className="text-sub font-semibold opacity-90 sm:text-body">
                {latest ? `${seasonShortLabel(latest.seasonLabel)} ${teamShortLabel(teamName)}` : ""}
              </span>
            </div>
            {/* deslop-ignore-next-line 11 */}
            <h1 className="mt-3 text-[2rem] font-black leading-[1.1] tracking-tight [overflow-wrap:anywhere] sm:text-5xl">
              {entry.nameKo}
            </h1>
            <p className="mt-1 truncate text-sub font-medium opacity-85 sm:text-body">{entry.nameEn}</p>
            <FavoriteButton playerId={entry.id} nameKo={entry.nameKo} className="mt-2" />
            {badges.length > 0 && (
              <div className="mt-2.5">
                <BadgeRow badges={badges} teamPrimary={color.primary} />
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5 text-sub font-semibold">
              <span className="rounded-control px-2 py-0.5" style={{ background: "rgba(255,255,255,0.18)" }}>
                {NATIONALITY_LABELS[nationalityOf(entry)]}
              </span>
              <span className="rounded-control px-2 py-0.5" style={{ background: "rgba(0,0,0,0.25)" }}>
                {span}
              </span>
            </div>
            {facts.length > 0 && (
              <dl className="mt-3 flex max-w-md flex-wrap gap-x-3 gap-y-1 text-sub sm:text-body">
                {facts.map((f) => (
                  <div key={f.label} className="flex items-baseline gap-1">
                    <dt className="opacity-75">{f.label}</dt>
                    <dd className="min-w-0 font-bold [overflow-wrap:anywhere]">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div className="relative -mr-2 shrink-0 self-end sm:mr-4">
            <span className="sm:hidden">
              <PlayerAvatar photoUrl={entry.photoUrl} nameKo={entry.nameKo} color={color} variant="portrait" size={210} />
            </span>
            <span className="hidden sm:inline">
              <PlayerAvatar photoUrl={entry.photoUrl} nameKo={entry.nameKo} color={color} variant="portrait" size={280} />
            </span>
          </div>
        </div>
      </div>

      {/* ── 통산 요약 + 소속 이력 ── */}
      <div className="mx-auto max-w-5xl px-4">
        <dl className="tabular -mt-px grid grid-cols-4 gap-px overflow-hidden rounded-b-container border border-t-0 border-line bg-line shadow-card lg:grid-cols-8">
          {tiles.map((t) => (
            <div key={t.label} className="min-w-0 bg-surface px-1.5 py-3 text-center sm:px-3">
              <dt className="truncate text-caption font-medium text-ink-3 sm:text-sub">
                {t.perGame ? <span className="hidden sm:inline">경기당 </span> : null}
                {t.label}
              </dt>
              <dd className="mt-0.5 text-xl font-bold tracking-tight text-ink sm:text-3xl lg:text-2xl">{t.value}</dd>
              {"sub" in t && t.sub && <dd className="mt-0.5 truncate text-caption text-ink-3">{t.sub}</dd>}
            </div>
          ))}
        </dl>
        <p className="mt-1.5 text-caption text-ink-3">
          통산 {sum.seasons}시즌 정규시즌 · 득점~블록은 경기당 · 승패는 뛴 경기만{sum.winPct !== null ? ` (승률 ${NF1.format(sum.winPct)}%)` : ""}
        </p>

        <div className="mt-4">
          <p id="stints-title" className="text-sub font-semibold text-ink-2">소속 팀 이력</p>
          <ol aria-labelledby="stints-title" className="mt-1.5 flex flex-wrap gap-1.5">
            {stints.map((st, i) => {
              // 같은 팀 코드라도 시즌마다 이름·로고가 다를 수 있어(KT&G → 정관장) 구간 마지막 시즌의 팀 정보를 쓴다
              const s = seasons.find((x) => x.seasonLabel === st.toLabel);
              const t = s?.team ?? undefined;
              const name = t?.shortName ?? s?.teamShort ?? st.teamCode;
              const from = seasonShortLabel(st.fromLabel);
              const to = seasonShortLabel(st.toLabel);
              return (
                <li
                  key={`${st.teamCode}-${i}`}
                  className="flex h-10 items-center gap-1.5 rounded-control border border-line bg-surface pl-1.5 pr-2.5 text-sub"
                >
                  <TeamLogo logoUrl={t?.logoUrl} shortName={name} color={t?.color} size={20} />
                  <span className="font-semibold text-ink">{teamShortLabel(name)}</span>
                  <span className="text-ink-3">
                    {from === to ? from : `${from}~${to}`}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
