// 선수 페이지 머리말 (PLAN.md §2-2 ①, §5-4): 최근 시즌 팀 색 배경 + 큰 세로 사진 + 로고 + 이름·소속·활동 기간,
// 이름 아래 국적 배지(국내/외국/아시아쿼터)·활동 기간, 프로필 한 줄(포지션·키·몸무게·등번호·드래프트 — 선수 마스터,
// 나이·국적(국가명)·출신교 — 서버 B 프로필, 없으면 뺌), 우승·MVP 금색 칩, 통산 요약 아래 수상 경력 표(lib/career awardLines),
// 이름 아래 칭호("칭호 N개" 한 줄로 접힘 — 2026-10-16 디자인 정리 M3, 꼬리표는 수상·현역 상태 합쳐 3개까지), 그 아래 통산 요약 8칸(모바일 4×2, PC 8×1)·프로필 줄과 소속 팀 이력. 계산은 lib/metrics careerSummary, 표기는 lib/career.
// 머리말 팀 색은 가장 최근 시즌 팀 (카드 영역은 고른 시즌 팀 색을 따로 쓴다).
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import type { CareerSeason, PlayerIndexEntry, TeamColor } from "@/lib/types";
import { careerSummary } from "@/lib/metrics";
import { activeSpanLabel, awardChipText, awardLines, personalFacts, profileFacts, seasonRangeLabel, seasonShortLabel, teamStints } from "@/lib/career";
import { nationalityOf, NATIONALITY_LABELS, ROSTER_STATUS_LABELS } from "@/lib/roster";
import { mixHex, teamShortLabel } from "@/lib/images";
import PlayerAvatar from "./PlayerAvatar";
import FavoriteButton from "./FavoriteButton";
import CompareButton from "./CompareButton";
import LikeButton from "./LikeButton";
import TeamLogo from "./TeamLogo";
import { TeamLink } from "./EntityLinks";
import TeamJersey from "./TeamJersey";
import Link from "next/link";
import { MILESTONE_STEPS, type Milestone } from "@/lib/records";
import { IconChevronRight, IconInfo, IconTrophy } from "./icons";
import HelpPopover from "./HelpPopover";
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
  /** 현역 선수의 다음 통산 이정표 (lib/records nextMilestones, 은퇴 선수는 []) */
  milestones?: Milestone[];
}

export default function PlayerHero({ entry, seasons, today, badges, milestones = [] }: Props) {
  const latest = seasons[seasons.length - 1];
  const first = seasons[0];
  const team = latest?.team ?? null;
  const color = team?.color ?? FALLBACK;
  const teamName = team?.shortName ?? latest?.teamShort ?? "";
  const dark = mixHex(color.primary, "#000000", 0.62);
  const mid = mixHex(color.primary, "#000000", 0.3);
  // 폰 바닥 줄(칩·프로필) 색 — 띠 아래쪽보다 한 단계 어두운 단색(반투명 겹치기 대신)
  const floor = mixHex(color.primary, "#000000", 0.72);
  const sum = careerSummary(seasons);
  const span = first && latest ? activeSpanLabel(first.seasonLabel, latest.seasonLabel, seasons.length) : "";
  const stints = teamStints(seasons);
  const facts = [...profileFacts(entry), ...personalFacts(entry, today)];
  // 우승(정규시즌 소속 팀 = 챔프전 우승팀, scripts/champions.ts) + 역대 수상(공홈 역대수상현황, scripts/awards.ts)
  const awards = awardLines(entry.awards, entry.championships, seasons);
  // 머리말 꼬리표는 3개까지 (2026-10-16 M3): 수상(우승·MVP 금색) 먼저, 현역 상태가 있으면 그 한 칸을 남긴다
  const heroAwards = awards.filter((a) => a.hero).slice(0, entry.rosterStatus ? 2 : 3);
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

  const careerNote = `통산 ${sum.seasons}시즌 정규시즌 · 득점~블록은 경기당 · 승패는 뛴 경기만${sum.winPct !== null ? ` (승률 ${NF1.format(sum.winPct)}%)` : ""}`;

  return (
    <section id="player-hero" aria-label={`${entry.nameKo} 선수 소개`}>
      {/* ── 팀 색 띠 + 사진 ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${color.primary} 0%, ${mid} 55%, ${dark} 100%)`, color: color.text }}
      >
        {/* 배치: 왼쪽 글 한 열 + 오른쪽 사진(바닥에 붙음). PC(1024px+)는 사진이 글 바로 옆, 1280px 이상은 오른쪽 빈자리에 통산 기록 8칸.
            2026-10-16 디자인 정리 M3(사용자 결정): 꼬리표는 3개까지(수상 → 현역 상태), 국적·활동 기간은 영문 이름 줄에 글자로,
            칭호는 "칭호 N개" 한 줄로 접고, 버튼 셋은 폰에서 아이콘만 한 줄. 폰의 진한 바닥 줄은 없애고 프로필은 띠 아래 흰 면으로 */}
        <div className="relative mx-auto grid max-w-page grid-cols-[minmax(0,1fr)_auto] px-4 lg:grid-cols-[fit-content(36rem)_auto] lg:justify-start lg:gap-x-10 xl:grid-cols-[fit-content(30rem)_auto_minmax(0,1fr)] xl:justify-normal">
          <div className="relative z-10 min-w-0 pb-4 pr-2 pt-5 sm:pb-6">
            <TeamLink code={latest?.teamCode} season={latest?.seasonCode} place="player_hero" className="inline-flex min-h-10 items-center gap-2">
              <span className="inline-flex rounded-control bg-white p-1 shadow-card">
                <TeamLogo logoUrl={team?.logoUrl} shortName={teamName} color={color} size={32} />
              </span>
              <span className="text-sub font-semibold opacity-90 sm:text-body">
                {latest ? `${seasonShortLabel(latest.seasonLabel)} ${teamShortLabel(teamName)}` : ""}
              </span>
            </TeamLink>
            {/* deslop-ignore-next-line 11 */}
            <h1 id="player-name" className="mt-2 text-[2rem] font-black leading-[1.1] tracking-tight [overflow-wrap:anywhere] sm:text-5xl lg:text-6xl">
              {entry.nameKo}
            </h1>
            <p className="mt-1 text-sub font-medium opacity-85 sm:text-body">
              {entry.nameEn && <span>{entry.nameEn} · </span>}
              <span className="whitespace-nowrap">{NATIONALITY_LABELS[nationalityOf(entry)]}</span>
              {span && <span className="whitespace-nowrap"> · {span}</span>}
            </p>
            {(heroAwards.length > 0 || entry.rosterStatus) && (
              <div className="mt-3 flex flex-wrap gap-1.5 text-sub font-semibold">
                {heroAwards.map((a) => (
                  <span
                    key={a.key}
                    className="inline-flex items-center gap-1 rounded-control px-2 py-0.5"
                    style={{ background: "var(--grade-s)", color: "var(--grade-s-ink)" }}
                    title={`${a.label}: ${a.seasons}`}
                  >
                    <IconTrophy size={16} aria-hidden />
                    {awardChipText(a)}
                  </span>
                ))}
                {entry.rosterStatus && (
                  // 현역·미등록·은퇴 (KBL 등록 명단 기준, lib/roster rosterStatusOf) — 누르면 기준 설명. 누르는 영역은 위아래로 늘려 40px
                  <HelpPopover
                    term="rosterStatus"
                    ariaLabel={`${ROSTER_STATUS_LABELS[entry.rosterStatus]} — 판정 기준 보기`}
                    className="group -my-2 inline-flex h-10 items-center rounded-control"
                  >
                    <span
                      className="inline-flex items-center gap-1 rounded-control px-2 py-0.5 transition-colors duration-200 group-hover:underline group-hover:underline-offset-4"
                      style={{ background: "rgba(0,0,0,0.25)" }}
                    >
                      {ROSTER_STATUS_LABELS[entry.rosterStatus]}
                      <IconInfo size={16} aria-hidden />
                    </span>
                  </HelpPopover>
                )}
              </div>
            )}
            {badges.length > 0 && (
              <div className="mt-2.5">
                <BadgeRow badges={badges} teamPrimary={color.primary} collapsed />
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <LikeButton kind="player" target={entry.id} label={entry.nameKo} compact />
              <FavoriteButton playerId={entry.id} nameKo={entry.nameKo} compact />
              <CompareButton playerId={entry.id} nameKo={entry.nameKo} seasonCodes={seasons.map((s) => s.seasonCode)} compact />
            </div>
          </div>
          <div className="relative -mr-2 self-end sm:mr-4 lg:mr-0">
            {/* flex 로 감싼다: 인라인이면 글자 기준선 아래 빈칸이 생겨 사진이 바닥에서 떠 보인다 (2026-10-03) */}
            <span className="flex sm:hidden">
              <PlayerAvatar photoUrl={entry.photoUrl} nameKo={entry.nameKo} color={color} variant="portrait" size={170} />
            </span>
            <span className="hidden sm:flex lg:hidden">
              <PlayerAvatar photoUrl={entry.photoUrl} nameKo={entry.nameKo} color={color} variant="portrait" size={260} />
            </span>
            <span className="hidden lg:flex">
              <PlayerAvatar photoUrl={entry.photoUrl} nameKo={entry.nameKo} color={color} variant="portrait" size={300} />
            </span>
          </div>
          {/* 넓은 PC(1280px 이상): 통산 요약 8칸을 띠 오른쪽에 (그보다 좁으면 띠 아래 흰 줄) */}
          <div
            className="relative z-10 hidden min-w-0 self-center py-6 xl:block"
            style={{ "--hero-floor": floor } as React.CSSProperties}
          >
            <dl className="tabular grid grid-cols-4 gap-1.5">
              {tiles.map((t) => (
                <div key={t.label} className="min-w-0 rounded-card bg-[var(--hero-floor)] px-3 py-2.5">
                  <dt className="truncate text-sub font-medium opacity-75">{t.label}</dt>
                  <dd className="mt-0.5 text-2xl font-bold tracking-tight">{t.value}</dd>
                  {"sub" in t && t.sub && <dd className="whitespace-nowrap text-caption opacity-75">{t.sub}</dd>}
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* ── 통산 요약 + 소속 이력 ── */}
      <div className="mx-auto max-w-page px-4">
        <dl className="tabular -mt-px grid grid-cols-4 gap-px overflow-hidden rounded-b-container border border-t-0 border-line bg-line shadow-card lg:grid-cols-8 xl:hidden">
          {tiles.map((t) => (
            <div key={t.label} className="min-w-0 bg-surface px-1.5 py-3 text-center sm:px-3">
              <dt className="truncate text-caption font-medium text-ink-3 sm:text-sub">
                {t.perGame ? <span className="hidden sm:inline lg:hidden">경기당 </span> : null}
                {t.label}
              </dt>
              <dd className="mt-0.5 text-xl font-bold tracking-tight text-ink sm:text-3xl lg:text-2xl">{t.value}</dd>
              {"sub" in t && t.sub && <dd className="mt-0.5 truncate text-caption text-ink-3">{t.sub}</dd>}
            </div>
          ))}
        </dl>
        {/* 프로필 (2026-10-16 M3: 띠 안 진한 바닥 줄 → 흰 면). 통산 기록 설명은 ⓘ 안으로(M4) */}
        <div className="mt-3 flex flex-wrap items-start gap-x-5 gap-y-1">
          {facts.length > 0 && (
            <dl className="grid min-w-0 flex-1 grid-cols-1 gap-x-4 gap-y-1 text-sub min-[400px]:grid-cols-2 sm:flex sm:flex-wrap sm:gap-x-5">
              {facts.map((f) => (
                <div key={f.label} className="flex min-w-0 items-baseline gap-1.5">
                  <dt className="shrink-0 text-ink-3">{f.label}</dt>
                  <dd className="min-w-0 font-semibold text-ink [overflow-wrap:anywhere]">
                    {f.href ? (
                      <Link href={f.href} className="focus-ring -my-2.5 inline-flex items-center rounded-control py-2.5 underline decoration-ink-3 underline-offset-4 transition-colors duration-200 hover:decoration-ink">
                        {f.value}
                        <IconChevronRight size={16} aria-hidden />
                      </Link>
                    ) : (
                      f.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <HelpPopover content={{ title: "통산 기록", short: careerNote, formula: null, href: "/glossary" }} ariaLabel="통산 기록 기준 보기" />
        </div>

        {awards.length > 0 && (
          <section aria-labelledby="awards-title" className="mt-4">
            <p id="awards-title" className="text-sub font-semibold text-ink-2">
              수상 경력 <span className="font-normal text-ink-3">· KBL 역대수상현황</span>
            </p>
            <dl className="surface-card tabular mt-1.5 divide-y divide-line rounded-card lg:hidden">
              {awards.map((a) => (
                <div key={a.key} className="grid grid-cols-[6.5rem_2.75rem_minmax(0,1fr)] items-baseline gap-2 px-3 py-2 text-sub sm:grid-cols-[8rem_3rem_minmax(0,1fr)]">
                  <dt className="font-semibold text-ink">{a.label}</dt>
                  <dd className="font-bold text-ink">{a.count}회</dd>
                  <dd className="min-w-0 text-ink-2 [overflow-wrap:anywhere]">{a.seasons}</dd>
                </div>
              ))}
            </dl>
            {/* PC: 상마다 카드 한 장, 네 칸 (2026-10-06 사용자: 넓은 표 오른쪽이 빈다) */}
            <dl className="tabular mt-1.5 hidden grid-cols-4 gap-2 lg:grid">
              {awards.map((a) => (
                <div key={a.key} className="surface-card min-w-0 rounded-card px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="truncate text-body font-semibold text-ink">{a.label}</dt>
                    {/* deslop-ignore-next-line 11 */}
                    <dd className="shrink-0 text-2xl font-black leading-none text-ink">
                      {a.count}
                      <span className="ml-0.5 text-sub font-bold text-ink-3">회</span>
                    </dd>
                  </div>
                  <dd className="mt-1.5 text-sub text-ink-2 [overflow-wrap:anywhere]">{a.seasons}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {milestones.length > 0 && (
          <section aria-labelledby="milestones-title" className="mt-4">
            <p id="milestones-title" className="text-sub font-semibold text-ink-2">
              다음 이정표 <span className="font-normal text-ink-3">· 통산 정규시즌</span>
            </p>
            <ul className="tabular mt-1.5 grid gap-2 sm:grid-cols-3">
              {milestones.map((m) => {
                const step = MILESTONE_STEPS[m.key] ?? m.target;
                const done = Math.min(1, Math.max(0, (m.current - (m.target - step)) / step));
                return (
                  <li key={m.key} className="surface-card rounded-card px-3 py-2.5">
                    <p className="flex items-baseline justify-between gap-2 text-sub">
                      <span className="font-semibold text-ink">
                        {m.label} {NF0.format(m.target)}
                        {m.unit}
                      </span>
                      <span className="text-ink-3">역대 {NF0.format(m.rank)}위</span>
                    </p>
                    <span
                      className="mt-1.5 block h-2 overflow-hidden rounded-md bg-surface-2"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(done * 100)}
                      aria-label={`${m.label} ${NF0.format(m.target)}${m.unit}까지 ${Math.round(done * 100)}%`}
                    >
                      <span className="block h-full rounded-md bg-series-1" style={{ width: `${done * 100}%` }} />
                    </span>
                    <p className="mt-1 text-caption text-ink-2">
                      지금 {NF0.format(m.current)}
                      {m.unit} · <b className="font-bold text-ink">{NF0.format(m.remaining)}{m.unit}</b> 남음
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="mt-4">
          <p id="stints-title" className="text-sub font-semibold text-ink-2">소속 팀 이력</p>
          {/* 유니폼 한 줄 (넘치면 옆으로 밀기), 아래에 몸담은 시즌 */}
          <ol aria-labelledby="stints-title" className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
            {stints.map((st, i) => {
              // 같은 팀 코드라도 시즌마다 이름·로고가 다를 수 있어(KT&G → 정관장) 구간 마지막 시즌의 팀 정보를 쓴다
              const s = seasons.find((x) => x.seasonLabel === st.toLabel);
              const t = s?.team ?? undefined;
              const name = t?.shortName ?? s?.teamShort ?? st.teamCode;
              return (
                <li key={`${st.teamCode}-${i}`} className="w-[4.75rem] shrink-0">
                  {/* 누르면 그 팀 페이지의 마지막 시즌 로스터 (2026-10-04) */}
                  <Link
                    href={`/team/${st.teamCode}${s ? `?season=${s.seasonCode}` : ""}`}
                    className="focus-ring flex flex-col items-center rounded-card pb-1 text-center transition-colors duration-200 hover:bg-surface-2"
                  >
                    <TeamJersey color={t?.color ?? FALLBACK} logoUrl={t?.logoUrl} shortName={name} width={56} />
                    <span className="mt-1 w-full truncate text-caption font-semibold text-ink">{teamShortLabel(name)}</span>
                    <span className="tabular text-caption text-ink-3">{seasonRangeLabel(st.fromLabel, st.toLabel)}</span>
                    <span className="tabular text-caption text-ink-3">{st.seasons}시즌</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
